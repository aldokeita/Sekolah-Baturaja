package handler

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"lpq-backend/internal/auth"
	"lpq-backend/internal/config"
	"lpq-backend/internal/middleware"
)

type AuthHandler struct {
	db  *pgxpool.Pool
	cfg *config.Config
}

func NewAuthHandler(db *pgxpool.Pool, cfg *config.Config) *AuthHandler {
	return &AuthHandler{db: db, cfg: cfg}
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	req.Password = strings.TrimSpace(req.Password)
	if req.Username == "" || req.Password == "" {
		jsonError(w, "username dan password wajib diisi", http.StatusBadRequest)
		return
	}

	userID, role, hash, err := h.resolveUser(r.Context(), req.Username)
	if err != nil {
		jsonError(w, "username atau password salah", http.StatusUnauthorized)
		return
	}

	if err := auth.CheckPassword(hash, req.Password); err != nil {
		// Self-heal: santri yang passwordnya masih nomor_induk plain
		if role == "santri" && req.Password == req.Username {
			if newHash, err := auth.HashPassword(req.Password); err == nil {
				h.db.Exec(r.Context(), `UPDATE santri SET password = $1 WHERE id = $2`, newHash, userID)
			}
		} else {
			jsonError(w, "username atau password salah", http.StatusUnauthorized)
			return
		}
	}

	pair, err := auth.IssueTokenPair(
		userID, role,
		h.cfg.JWTSecret, h.cfg.JWTRefreshSecret,
		time.Duration(h.cfg.AccessTokenTTL)*time.Minute,
		time.Duration(h.cfg.RefreshTokenTTL)*24*time.Hour,
	)
	if err != nil {
		jsonError(w, "gagal membuat token", http.StatusInternalServerError)
		return
	}
	jsonOK(w, pair)
}

func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.RefreshToken == "" {
		jsonError(w, "refresh_token wajib diisi", http.StatusBadRequest)
		return
	}
	claims, err := auth.ValidateRefreshToken(body.RefreshToken, h.cfg.JWTRefreshSecret)
	if err != nil {
		jsonError(w, "refresh token tidak valid atau kedaluwarsa", http.StatusUnauthorized)
		return
	}
	pair, err := auth.IssueTokenPair(
		claims.UserID, claims.Role,
		h.cfg.JWTSecret, h.cfg.JWTRefreshSecret,
		time.Duration(h.cfg.AccessTokenTTL)*time.Minute,
		time.Duration(h.cfg.RefreshTokenTTL)*24*time.Hour,
	)
	if err != nil {
		jsonError(w, "gagal membuat token", http.StatusInternalServerError)
		return
	}
	jsonOK(w, pair)
}

type userRow struct {
	id   string
	role string
	hash string
}

// resolveUser mencari user di santri (NISN/NIS/panggilan) atau guru (email).
// Santri dicek duluan; jika tidak ketemu baru coba guru/admin/pentashih.
//
// Kegagalan nyata pada salah satu query (kolom hilang, tabel rusak) TIDAK boleh
// menghentikan pencarian di tabel lain: santri dan guru adalah dua jalur yang
// berdiri sendiri. Dulu error apa pun dari query santri langsung menghentikan
// fungsi ini, sehingga satu migrasi yang belum diterapkan menjatuhkan login
// SEMUA peran — termasuk admin yang datanya tidak tersentuh.
func (h *AuthHandler) resolveUser(ctx context.Context, username string) (id, role, hash string, err error) {
	// Murid login pakai NISN atau NIS. nomor_induk tetap diterima sebagai
	// fallback agar murid lama tidak terkunci sebelum NISN mereka terisi.
	var row userRow
	santriErr := h.db.QueryRow(ctx, `
		SELECT id, 'santri', COALESCE(password,'')
		FROM santri
		WHERE (nisn = $1 OR nis = $1 OR nomor_induk = $1 OR LOWER(nama_panggilan) = LOWER($1))
		  AND status = 'Aktif'
		LIMIT 1
	`, username).Scan(&row.id, &row.role, &row.hash)
	if santriErr == nil {
		return row.id, row.role, row.hash, nil
	}
	if errors.Is(santriErr, pgx.ErrNoRows) {
		// Bukan murid — wajar, lanjut ke guru.
		santriErr = nil
	} else {
		// Rusak sungguhan. Dicatat supaya tidak membisu, tapi pencarian diteruskan.
		log.Printf("resolveUser: query santri gagal: %v", santriErr)
	}

	// Coba guru/admin/pentashih: login by email
	guruErr := h.db.QueryRow(ctx, `
		SELECT g.id, up.role, COALESCE(g.password,'')
		FROM guru g
		JOIN user_profiles up ON up.id = g.id
		WHERE LOWER(g.email) = LOWER($1)
		  AND g.status = 'active'
		  AND up.status = 'active'
		LIMIT 1
	`, username).Scan(&row.id, &row.role, &row.hash)
	if guruErr == nil {
		return row.id, row.role, row.hash, nil
	}
	if !errors.Is(guruErr, pgx.ErrNoRows) {
		log.Printf("resolveUser: query guru gagal: %v", guruErr)
		return "", "", "", guruErr
	}
	// Guru memang tidak ada. Bila query santri tadi rusak, laporkan kerusakan itu —
	// bukan "user tidak ditemukan" yang menyesatkan saat skema sedang bermasalah.
	if santriErr != nil {
		return "", "", "", santriErr
	}
	return "", "", "", errors.New("user tidak ditemukan")
}

// VerifyPassword re-checks the logged-in user's own password. Used as a
// confirmation step before destructive actions like restore.
func (h *AuthHandler) VerifyPassword(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromCtx(r.Context())
	role := middleware.RoleFromCtx(r.Context())
	if userID == "" {
		jsonError(w, "tidak terautentikasi", http.StatusUnauthorized)
		return
	}

	var body struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Password == "" {
		jsonError(w, "password wajib diisi", http.StatusBadRequest)
		return
	}

	table := "guru"
	if role == "santri" {
		table = "santri"
	}
	var hash string
	if err := h.db.QueryRow(r.Context(),
		`SELECT COALESCE(password,'') FROM `+table+` WHERE id = $1`, userID).Scan(&hash); err != nil {
		jsonError(w, "akun tidak ditemukan", http.StatusNotFound)
		return
	}
	if hash == "" || bcrypt.CompareHashAndPassword([]byte(hash), []byte(body.Password)) != nil {
		jsonError(w, "password salah", http.StatusUnauthorized)
		return
	}
	jsonOK(w, map[string]any{"verified": true})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromCtx(r.Context())
	role := middleware.RoleFromCtx(r.Context())
	if userID == "" {
		jsonError(w, "tidak terautentikasi", http.StatusUnauthorized)
		return
	}

	var displayName, email, jabatan string
	var roles []string
	var err error
	if role == "santri" {
		err = h.db.QueryRow(r.Context(),
			`SELECT COALESCE(nama_lengkap,''), COALESCE(nomor_induk,'') FROM santri WHERE id = $1`, userID,
		).Scan(&displayName, &email)
	} else {
		// jabatan dan roles ikut dikirim supaya antarmuka bisa membedakan sebutan
		// yang berbagi app_role yang sama. Kepala Sekolah dan Wakil Kepala Sekolah
		// sama-sama memakai app_role `pentashih`; tanpa dua kolom ini bilah atas
		// hanya bisa menebak dari perannya dan menyebut kepala sekolah "Wakil".
		// Ini profil milik pemanggil sendiri, jadi tidak ada data orang lain yang
		// ikut terbuka.
		err = h.db.QueryRow(r.Context(),
			`SELECT COALESCE(nama,''), COALESCE(email,''), COALESCE(jabatan,''), COALESCE(roles, '{}')
			   FROM guru WHERE id = $1`, userID,
		).Scan(&displayName, &email, &jabatan, &roles)
	}
	if err != nil {
		jsonError(w, "profil tidak ditemukan", http.StatusNotFound)
		return
	}

	if roles == nil {
		roles = []string{}
	}

	jsonOK(w, map[string]any{
		"id":           userID,
		"role":         role,
		"display_name": displayName,
		"email":        email,
		"jabatan":      jabatan,
		"roles":        roles,
		"status":       "active",
	})
}

func jsonOK(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
