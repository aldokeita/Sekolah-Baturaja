package handler

import (
	"context"
	"crypto/subtle"
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
	db       *pgxpool.Pool
	cfg      *config.Config
	throttle *loginThrottle
}

func NewAuthHandler(db *pgxpool.Pool, cfg *config.Config) *AuthHandler {
	return &AuthHandler{db: db, cfg: cfg, throttle: newLoginThrottle(db)}
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	// Endpoint publik tanpa auth tidak boleh membaca body tanpa batas.
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10)).Decode(&req); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	req.Password = strings.TrimSpace(req.Password)
	if req.Username == "" || req.Password == "" {
		jsonError(w, "username dan password wajib diisi", http.StatusBadRequest)
		return
	}

	ip := clientIP(r)
	if h.throttle.blocked(r.Context(), ip, req.Username) {
		jsonError(w, "terlalu banyak percobaan login gagal, coba lagi beberapa menit lagi", http.StatusTooManyRequests)
		return
	}

	userID, role, err := h.resolveUser(r.Context(), req.Username, req.Password)
	if err != nil {
		// Hanya percobaan GAGAL yang mengisi counter — login sukses dari
		// keluarga satu IP tidak pernah bisa ter-kunci (lihat login_limit.go).
		h.throttle.fail(r.Context(), ip, req.Username)
		jsonError(w, "username atau password salah", http.StatusUnauthorized)
		return
	}
	h.throttle.clear(r.Context(), req.Username)

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
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&body); err != nil || body.RefreshToken == "" {
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
// Nama panggilan TIDAK unik — dua murid boleh sama-sama "Adit". Karena itu
// SEMUA kandidat dikumpulkan lalu diverifikasi satu per satu: password-lah
// (nomor induk, yang unik) yang menentukan kandidat mana yang benar — bukan
// LIMIT 1 yang dulu memilih baris secara arbitrer dan bisa menolak kredensial
// benar karena jatuh ke baris milik murid lain.
//
// Kegagalan nyata pada salah satu query (kolom hilang, tabel rusak) TIDAK boleh
// menghentikan pencarian di tabel lain: santri dan guru adalah dua jalur yang
// berdiri sendiri. Dulu error apa pun dari query santri langsung menghentikan
// fungsi ini, sehingga satu migrasi yang belum diterapkan menjatuhkan login
// SEMUA peran — termasuk admin yang datanya tidak tersentuh.
func (h *AuthHandler) resolveUser(ctx context.Context, username, password string) (id, role string, err error) {
	var santriErr error

	candidates, qErr := h.santriCandidates(ctx, username)
	if qErr != nil {
		santriErr = qErr
		// Rusak sungguhan. Dicatat supaya tidak membisu, tapi pencarian diteruskan.
		log.Printf("resolveUser: query santri gagal: %v", qErr)
	} else {
		for _, c := range candidates {
			if h.tryVerify(ctx, c, password, true) {
				return c.id, c.role, nil
			}
		}
	}

	// Coba guru/admin/pentashih: login by email (unique index di lower(email)).
	var row userRow
	guruErr := h.db.QueryRow(ctx, `
		SELECT g.id, up.role, COALESCE(g.password,'')
		FROM guru g
		JOIN user_profiles up ON up.id = g.id
		WHERE LOWER(g.email) = LOWER($1)
		  AND g.status = 'active'
		  AND up.status = 'active'
		LIMIT 1
	`, username).Scan(&row.id, &row.role, &row.hash)
	switch {
	case guruErr == nil:
		if h.tryVerify(ctx, row, password, false) {
			return row.id, row.role, nil
		}
	case !errors.Is(guruErr, pgx.ErrNoRows):
		// Rusak sungguhan pada jalur guru. Dicatat supaya tidak membisu.
		log.Printf("resolveUser: query guru gagal: %v", guruErr)
		return "", "", guruErr
	}

	// Guru memang tidak ada. Bila query santri tadi rusak, laporkan kerusakan itu —
	// bukan "user tidak ditemukan" yang menyesatkan saat skema sedang bermasalah.
	if santriErr != nil {
		return "", "", santriErr
	}
	return "", "", errors.New("user tidak ditemukan")
}

// santriCandidates mengembalikan semua santri Aktif yang cocok dengan username
// lewat salah satu identitasnya (nisn/nis/nomor_induk/nama_panggilan).
// ORDER BY id menjaga urutan deterministik supaya mudah direproduksi saat debug.
func (h *AuthHandler) santriCandidates(ctx context.Context, username string) ([]userRow, error) {
	rows, err := h.db.Query(ctx, `
		SELECT id, COALESCE(password,'')
		FROM santri
		WHERE (nisn = $1 OR nis = $1 OR nomor_induk = $1 OR LOWER(nama_panggilan) = LOWER($1))
		  AND status = 'Aktif'
		ORDER BY id
		LIMIT 20
	`, username)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []userRow
	for rows.Next() {
		var c userRow
		c.role = "santri"
		if err := rows.Scan(&c.id, &c.hash); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// bcryptHashPrefix menandai kolom password yang sudah berupa hash bcrypt
// ($2a$/$2b$/$2y$). Nilai lain dianggap warisan plaintext pra-migrasi.
const bcryptHashPrefix = "$2"

// tryVerify memverifikasi satu kandidat terhadap password yang diketik.
//
// Jalur legacy-heal (khusus santri): baris yang masih menyimpan PLAINTEXT
// diterima hanya bila nilainya persis sama dengan password yang diketik, lalu
// langsung di-upgrade menjadi hash bcrypt. Setelah ter-hash, jalur ini tidak
// pernah aktif lagi untuk akun tersebut — password custom TIDAK mungkin ditimpa
// orang yang sekadar tahu NISN/NIS/nama panggilan (celah takeover yang sudah
// ditutup). Akun tanpa password sama sekali sengaja tidak di-heal: tetap
// terkunci sampai admin menetapkan password.
func (h *AuthHandler) tryVerify(ctx context.Context, row userRow, password string, allowLegacyHeal bool) bool {
	if strings.HasPrefix(row.hash, bcryptHashPrefix) {
		return auth.CheckPassword(row.hash, password) == nil
	}
	if !allowLegacyHeal || row.hash == "" {
		return false
	}
	if subtle.ConstantTimeCompare([]byte(row.hash), []byte(password)) != 1 {
		return false
	}
	newHash, err := auth.HashPassword(password)
	if err != nil {
		log.Printf("self-heal: hash password gagal: %v", err)
		return false
	}
	if _, err := h.db.Exec(ctx, `UPDATE santri SET password = $1 WHERE id = $2`, newHash, row.id); err != nil {
		log.Printf("self-heal: upgrade password ke bcrypt gagal: %v", err)
		return false
	}
	return true
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
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&body); err != nil || body.Password == "" {
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
