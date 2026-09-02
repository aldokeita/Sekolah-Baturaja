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
	r.Get("/deskripsi-mapel", h.GetDeskripsiMapel)
	r.Put("/deskripsi-mapel", h.SaveDeskripsiMapel)
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

	var catatan, kokurikuler, ekstrakurikuler *string
	var updatedAt *string
	err := h.db.QueryRow(r.Context(), `
		SELECT catatan, deskripsi_kokurikuler, ekstrakurikuler, updated_at::text
		FROM rapor_catatan
		WHERE santri_id = $1 AND periode_id = $2
	`, santriID, periodeID).Scan(&catatan, &kokurikuler, &ekstrakurikuler, &updatedAt)
	if err == pgx.ErrNoRows {
		// Belum ada catatan bukan kesalahan: sebagian besar murid memang belum
		// diisi. Mengembalikan 404 memaksa setiap pemanggil menerjemahkannya.
		jsonOK(w, map[string]any{"data": map[string]any{
			"catatan": "", "deskripsi_kokurikuler": "", "ekstrakurikuler": "", "updated_at": nil,
		}})
		return
	}
	if err != nil {
		jsonError(w, "gagal mengambil catatan rapor", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]any{"data": map[string]any{
		"catatan":               teksAtauKosong(catatan),
		"deskripsi_kokurikuler": teksAtauKosong(kokurikuler),
		"ekstrakurikuler":       teksAtauKosong(ekstrakurikuler),
		"updated_at":            updatedAt,
	}})
}

func teksAtauKosong(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}

// nilaiAtauNil mengubah string kosong menjadi NULL. Kolom narasi rapor memakai
// NULL untuk "belum diisi"; menyimpan string kosong membuat batasan
// rapor_catatan_ada_isinya menganggap barisnya tetap terisi.
func nilaiAtauNil(s string) any {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return strings.TrimSpace(s)
}

// PUT /api/rapor/catatan
// Body: {santri_id, periode_id, catatan}
func (h *RaporHandler) SaveCatatan(w http.ResponseWriter, r *http.Request) {
	var body struct {
		SantriID    string `json:"santri_id"`
		PeriodeID   string `json:"periode_id"`
		Catatan     string `json:"catatan"`
		Kokurikuler string `json:"deskripsi_kokurikuler"`
		Ekstra      string `json:"ekstrakurikuler"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 32<<10)).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}

	santriID := strings.TrimSpace(body.SantriID)
	periodeID := strings.TrimSpace(body.PeriodeID)
	if santriID == "" || periodeID == "" {
		jsonError(w, "santri_id dan periode_id wajib diisi", http.StatusBadRequest)
		return
	}

	// Ketiganya boleh diisi sebagian. Yang ditolak adalah menyimpan baris yang
	// seluruhnya kosong — itu bukan penyimpanan, melainkan penghapusan.
	isi := map[string]string{
		"catatan":               strings.TrimSpace(body.Catatan),
		"deskripsi kokurikuler": strings.TrimSpace(body.Kokurikuler),
		"ekstrakurikuler":       strings.TrimSpace(body.Ekstra),
	}
	adaIsi := false
	for nama, teks := range isi {
		if teks != "" {
			adaIsi = true
		}
		if len([]rune(teks)) > raporCatatanMaks {
			jsonError(w, nama+" terlalu panjang", http.StatusBadRequest)
			return
		}
	}
	if !adaIsi {
		jsonError(w, "tidak ada isi untuk disimpan; pakai hapus untuk mengosongkannya", http.StatusBadRequest)
		return
	}
	if !h.bolehTulis(r, santriID) {
		jsonError(w, "hanya wali kelas dan tata usaha yang boleh menulis catatan rapor", http.StatusForbidden)
		return
	}

	userID := middleware.UserIDFromCtx(r.Context())
	_, err := h.db.Exec(r.Context(), `
		INSERT INTO rapor_catatan
			(santri_id, periode_id, catatan, deskripsi_kokurikuler, ekstrakurikuler, created_by, updated_by)
		VALUES ($1, $2, $3, $4, $5, $6, $6)
		ON CONFLICT (santri_id, periode_id) DO UPDATE
		SET catatan               = excluded.catatan,
		    deskripsi_kokurikuler = excluded.deskripsi_kokurikuler,
		    ekstrakurikuler       = excluded.ekstrakurikuler,
		    updated_by            = excluded.updated_by
	`, santriID, periodeID,
		nilaiAtauNil(body.Catatan), nilaiAtauNil(body.Kokurikuler), nilaiAtauNil(body.Ekstra),
		userID)
	if err != nil {
		jsonError(w, "gagal menyimpan catatan rapor", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]any{"data": map[string]any{
		"catatan":               isi["catatan"],
		"deskripsi_kokurikuler": isi["deskripsi kokurikuler"],
		"ekstrakurikuler":       isi["ekstrakurikuler"],
	}})
}

// GET /api/rapor/deskripsi-mapel?santri_id=&periode_id=
// Mengembalikan peta mata_pelajaran_id -> deskripsi.
func (h *RaporHandler) GetDeskripsiMapel(w http.ResponseWriter, r *http.Request) {
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

	rows, err := h.db.Query(r.Context(), `
		SELECT mata_pelajaran_id::text, deskripsi FROM rapor_deskripsi_mapel
		WHERE santri_id = $1 AND periode_id = $2
	`, santriID, periodeID)
	if err != nil {
		jsonError(w, "gagal mengambil deskripsi capaian", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	hasil := map[string]string{}
	for rows.Next() {
		var id, deskripsi string
		if err := rows.Scan(&id, &deskripsi); err != nil {
			jsonError(w, "gagal membaca deskripsi capaian", http.StatusInternalServerError)
			return
		}
		hasil[id] = deskripsi
	}
	jsonOK(w, map[string]any{"data": hasil})
}

// PUT /api/rapor/deskripsi-mapel
// Body: {santri_id, periode_id, deskripsi: {mata_pelajaran_id: teks, ...}}
//
// Seluruh peta dikirim sekaligus, bukan satu mata pelajaran per permintaan: guru
// mengisi deskripsi untuk semua mata pelajaran dalam satu duduk, dan menyimpannya
// satu per satu membuat sebagian tersimpan ketika koneksi putus di tengah.
func (h *RaporHandler) SaveDeskripsiMapel(w http.ResponseWriter, r *http.Request) {
	var body struct {
		SantriID  string            `json:"santri_id"`
		PeriodeID string            `json:"periode_id"`
		Deskripsi map[string]string `json:"deskripsi"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 128<<10)).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}

	santriID := strings.TrimSpace(body.SantriID)
	periodeID := strings.TrimSpace(body.PeriodeID)
	if santriID == "" || periodeID == "" {
		jsonError(w, "santri_id dan periode_id wajib diisi", http.StatusBadRequest)
		return
	}
	for _, teks := range body.Deskripsi {
		if len([]rune(teks)) > raporCatatanMaks {
			jsonError(w, "deskripsi capaian terlalu panjang", http.StatusBadRequest)
			return
		}
	}
	if !h.bolehTulis(r, santriID) {
		jsonError(w, "hanya wali kelas dan tata usaha yang boleh menulis deskripsi capaian", http.StatusForbidden)
		return
	}

	userID := middleware.UserIDFromCtx(r.Context())
	tx, err := h.db.Begin(r.Context())
	if err != nil {
		jsonError(w, "gagal menyimpan deskripsi capaian", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(r.Context())

	for mapelID, teks := range body.Deskripsi {
		id := strings.TrimSpace(mapelID)
		if id == "" {
			continue
		}
		// Deskripsi yang dikosongkan berarti dihapus. Kolomnya NOT NULL dan punya
		// batasan tidak-kosong, jadi menyimpan string kosong akan gagal.
		if strings.TrimSpace(teks) == "" {
			if _, err := tx.Exec(r.Context(),
				`DELETE FROM rapor_deskripsi_mapel
				 WHERE santri_id = $1 AND periode_id = $2 AND mata_pelajaran_id = $3`,
				santriID, periodeID, id,
			); err != nil {
				jsonError(w, "gagal menghapus deskripsi capaian", http.StatusInternalServerError)
				return
			}
			continue
		}
		if _, err := tx.Exec(r.Context(), `
			INSERT INTO rapor_deskripsi_mapel
				(santri_id, periode_id, mata_pelajaran_id, deskripsi, created_by, updated_by)
			VALUES ($1, $2, $3, $4, $5, $5)
			ON CONFLICT (santri_id, periode_id, mata_pelajaran_id) DO UPDATE
			SET deskripsi = excluded.deskripsi, updated_by = excluded.updated_by
		`, santriID, periodeID, id, strings.TrimSpace(teks), userID); err != nil {
			jsonError(w, "gagal menyimpan deskripsi capaian", http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		jsonError(w, "gagal menyimpan deskripsi capaian", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]any{"data": map[string]any{"tersimpan": len(body.Deskripsi)}})
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
