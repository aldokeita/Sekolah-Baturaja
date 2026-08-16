package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"lpq-backend/internal/middleware"
)

// RaporHandler menyimpan catatan wali kelas pada rapor.
//
// HANYA catatannya yang disimpan. Nilai dan kehadiran tetap dibaca dari sumber
// masing-masing (`/api/nilai/summary` dan `/api/attendance/recap`) setiap kali
// rapor disusun. Menyalin angka-angka itu ke tabel rapor akan membuat rapor yang
// dicetak ulang berbeda dari data sekolah yang sebenarnya, dan yang tercetak di
// rapor justru yang paling tidak boleh salah.
//
// Batas panjang catatan dipasang di sisi server, bukan hanya di form: kolomnya
// bertipe text tanpa batas, dan satu tempelan raksasa dari papan klip akan
// terbawa ke setiap pemuatan rapor sesudahnya.
type RaporHandler struct {
	db *pgxpool.Pool
}

func NewRaporHandler(db *pgxpool.Pool) *RaporHandler {
	return &RaporHandler{db: db}
}

const raporCatatanMaks = 2000

func (h *RaporHandler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/catatan", h.GetCatatan)
	r.Put("/catatan", h.SaveCatatan)
	r.Delete("/catatan", h.DeleteCatatan)
	return r
}

// bolehBaca menjawab apakah pemanggil boleh melihat rapor seorang murid.
//
// Aturannya sama dengan yang dipakai absensi dan data murid, dan sengaja dipanggil
// ulang ke `guruTeachesSantri` alih-alih disalin: satu tempat saja yang menyatakan
// guru mana boleh melihat murid mana.
func (h *RaporHandler) bolehBaca(r *http.Request, santriID string) bool {
	role := middleware.RoleFromCtx(r.Context())
	userID := middleware.UserIDFromCtx(r.Context())
	if userID == "" {
		return false
	}
	switch {
	case middleware.CanManage(role), role == "pentashih":
		return true
	case role == "guru":
		return guruTeachesSantri(r.Context(), h.db, userID, santriID)
	case role == "santri":
		// Murid boleh membaca rapornya sendiri; catatan wali kelas memang
		// ditujukan untuknya dan orang tuanya.
		return userID == santriID
	}
	return false
}

// bolehTulis lebih sempit daripada bolehBaca. Catatan rapor adalah penilaian
// pribadi wali kelas terhadap seorang murid, jadi guru mata pelajaran yang
// kebetulan mengajar di kelas itu TIDAK boleh menimpanya — hanya wali kelasnya
// dan back-office.
func (h *RaporHandler) bolehTulis(r *http.Request, santriID string) bool {
	role := middleware.RoleFromCtx(r.Context())
	userID := middleware.UserIDFromCtx(r.Context())
	if userID == "" {
		return false
	}
	if middleware.CanManage(role) {
		return true
	}
	if role != "guru" {
		return false
	}
	var wali bool
	err := h.db.QueryRow(r.Context(), `
		SELECT EXISTS (
			SELECT 1 FROM santri s
			JOIN classes c ON c.id = s.current_class_id
			WHERE s.id = $1 AND c.id_guru = $2
		)
	`, santriID, userID).Scan(&wali)
	return err == nil && wali
}

// GET /api/rapor/catatan?santri_id=&periode_id=
func (h *RaporHandler) GetCatatan(w http.ResponseWriter, r *http.Request) {
	santriID := strings.TrimSpace(r.URL.Query().Get("santri_id"))
	periodeID := strings.TrimSpace(r.URL.Query().Get("periode_id"))
	if santriID == "" || periodeID == "" {
		jsonError(w, "santri_id dan periode_id wajib diisi", http.StatusBadRequest)
		return
	}
	if !h.bolehBaca(r, santriID) {
		jsonError(w, "tidak berhak melihat rapor murid ini", http.StatusForbidden)
		return
	}

	var catatan string
	var updatedAt *string
	err := h.db.QueryRow(r.Context(), `
		SELECT catatan, updated_at::text FROM rapor_catatan
		WHERE santri_id = $1 AND periode_id = $2
	`, santriID, periodeID).Scan(&catatan, &updatedAt)
	if err == pgx.ErrNoRows {
		// Belum ada catatan bukan kesalahan: sebagian besar murid memang belum
		// diisi. Mengembalikan 404 memaksa setiap pemanggil menerjemahkannya.
		jsonOK(w, map[string]any{"data": map[string]any{"catatan": "", "updated_at": nil}})
		return
	}
	if err != nil {
		jsonError(w, "gagal mengambil catatan rapor", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]any{"data": map[string]any{"catatan": catatan, "updated_at": updatedAt}})
}

// PUT /api/rapor/catatan
// Body: {santri_id, periode_id, catatan}
func (h *RaporHandler) SaveCatatan(w http.ResponseWriter, r *http.Request) {
	var body struct {
		SantriID  string `json:"santri_id"`
		PeriodeID string `json:"periode_id"`
		Catatan   string `json:"catatan"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10)).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}

	santriID := strings.TrimSpace(body.SantriID)
	periodeID := strings.TrimSpace(body.PeriodeID)
	catatan := strings.TrimSpace(body.Catatan)
	if santriID == "" || periodeID == "" {
		jsonError(w, "santri_id dan periode_id wajib diisi", http.StatusBadRequest)
		return
	}
	if catatan == "" {
		jsonError(w, "catatan tidak boleh kosong; pakai hapus untuk mengosongkannya", http.StatusBadRequest)
		return
	}
	if len([]rune(catatan)) > raporCatatanMaks {
		jsonError(w, "catatan terlalu panjang", http.StatusBadRequest)
		return
	}
	if !h.bolehTulis(r, santriID) {
		jsonError(w, "hanya wali kelas dan tata usaha yang boleh menulis catatan rapor", http.StatusForbidden)
		return
	}

	userID := middleware.UserIDFromCtx(r.Context())
	_, err := h.db.Exec(r.Context(), `
		INSERT INTO rapor_catatan (santri_id, periode_id, catatan, created_by, updated_by)
		VALUES ($1, $2, $3, $4, $4)
		ON CONFLICT (santri_id, periode_id) DO UPDATE
		SET catatan = excluded.catatan, updated_by = excluded.updated_by
	`, santriID, periodeID, catatan, userID)
	if err != nil {
		jsonError(w, "gagal menyimpan catatan rapor", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]any{"data": map[string]any{"catatan": catatan}})
}

// DELETE /api/rapor/catatan?santri_id=&periode_id=
func (h *RaporHandler) DeleteCatatan(w http.ResponseWriter, r *http.Request) {
	santriID := strings.TrimSpace(r.URL.Query().Get("santri_id"))
	periodeID := strings.TrimSpace(r.URL.Query().Get("periode_id"))
	if santriID == "" || periodeID == "" {
		jsonError(w, "santri_id dan periode_id wajib diisi", http.StatusBadRequest)
		return
	}
	if !h.bolehTulis(r, santriID) {
		jsonError(w, "hanya wali kelas dan tata usaha yang boleh menghapus catatan rapor", http.StatusForbidden)
		return
	}
	if _, err := h.db.Exec(r.Context(),
		`DELETE FROM rapor_catatan WHERE santri_id = $1 AND periode_id = $2`,
		santriID, periodeID,
	); err != nil {
		jsonError(w, "gagal menghapus catatan rapor", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
