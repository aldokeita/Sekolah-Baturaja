package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"lpq-backend/internal/middleware"
)

type ScheduleHandler struct {
	db *pgxpool.Pool
}

func NewScheduleHandler(db *pgxpool.Pool) *ScheduleHandler {
	return &ScheduleHandler{db: db}
}

func (h *ScheduleHandler) Routes() chi.Router {
	r := chi.NewRouter()

	// Baca terbuka untuk semua peran yang sudah masuk: guru dan murid perlu
	// melihat jadwal, hanya admin/tata usaha yang boleh menyuntingnya.
	r.Get("/periode", h.ListPeriode)
	r.With(middleware.RequireRole("admin", "tata_usaha")).Post("/periode", h.CreatePeriode)
	r.With(middleware.RequireRole("admin", "tata_usaha")).Put("/periode/{id}", h.UpdatePeriode)
	r.With(middleware.RequireRole("admin", "tata_usaha")).Delete("/periode/{id}", h.DeletePeriode)

	r.Get("/mapel", h.ListMapel)
	r.With(middleware.RequireRole("admin", "tata_usaha")).Post("/mapel", h.CreateMapel)
	r.With(middleware.RequireRole("admin", "tata_usaha")).Put("/mapel/{id}", h.UpdateMapel)
	r.With(middleware.RequireRole("admin", "tata_usaha")).Delete("/mapel/{id}", h.DeleteMapel)

	r.Get("/jadwal", h.ListJadwal)
	r.With(middleware.RequireRole("admin", "tata_usaha")).Post("/jadwal", h.CreateJadwal)
	r.With(middleware.RequireRole("admin", "tata_usaha")).Put("/jadwal/{id}", h.UpdateJadwal)
	r.With(middleware.RequireRole("admin", "tata_usaha")).Delete("/jadwal/{id}", h.DeleteJadwal)

	return r
}

var periodeEditable = map[string]bool{
	"nama": true, "tahun_ajaran": true, "semester": true,
	"tanggal_mulai": true, "tanggal_selesai": true, "is_active": true,
}

var mapelEditable = map[string]bool{
	"nama": true, "kode": true, "urutan": true, "is_active": true,
}

var jadwalEditable = map[string]bool{
	"periode_id": true, "class_id": true, "mata_pelajaran_id": true,
	"guru_id": true, "hari": true, "jam_mulai": true, "jam_selesai": true,
	"ruang": true, "catatan": true,
}

// ---- Periode ajaran ----

func (h *ScheduleHandler) ListPeriode(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(r.Context(), `
		SELECT * FROM periode_ajaran
		ORDER BY tahun_ajaran DESC, semester DESC
	`)
	if err != nil {
		jsonError(w, "gagal mengambil periode ajaran", http.StatusInternalServerError)
		return
	}
	items, err := pgx.CollectRows(rows, rowToMap)
	if err != nil {
		jsonError(w, "gagal membaca periode ajaran", http.StatusInternalServerError)
		return
	}
	jsonData(w, items)
}

func (h *ScheduleHandler) CreatePeriode(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	// Menyalakan periode baru harus mematikan yang lama, kalau tidak index
	// periode_ajaran_satu_aktif menolak seluruh penyimpanan.
	if aktif, _ := body["is_active"].(bool); aktif {
		if err := h.matikanPeriodeLain(r.Context(), ""); err != nil {
			jsonError(w, "gagal menonaktifkan periode lama", http.StatusInternalServerError)
			return
		}
	}
	item, err := insertRow(r.Context(), h.db, "periode_ajaran", body, periodeEditable)
	if err != nil {
		jsonError(w, pesanGalatJadwal(err, "periode"), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusCreated)
	jsonData(w, item)
}

func (h *ScheduleHandler) UpdatePeriode(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	if aktif, _ := body["is_active"].(bool); aktif {
		if err := h.matikanPeriodeLain(r.Context(), id); err != nil {
			jsonError(w, "gagal menonaktifkan periode lama", http.StatusInternalServerError)
			return
		}
	}
	item, err := updateRow(r.Context(), h.db, "periode_ajaran", id, body, periodeEditable)
	if err != nil {
		if errors.Is(err, errNoFields) {
			jsonError(w, "tidak ada field yang bisa diperbarui", http.StatusBadRequest)
			return
		}
		if errors.Is(err, pgx.ErrNoRows) {
			jsonError(w, "periode tidak ditemukan", http.StatusNotFound)
			return
		}
		jsonError(w, pesanGalatJadwal(err, "periode"), http.StatusBadRequest)
		return
	}
	jsonData(w, item)
}

func (h *ScheduleHandler) DeletePeriode(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ct, err := h.db.Exec(r.Context(), `DELETE FROM periode_ajaran WHERE id = $1`, id)
	if err != nil {
		jsonError(w, "gagal menghapus periode", http.StatusInternalServerError)
		return
	}
	if ct.RowsAffected() == 0 {
		jsonError(w, "periode tidak ditemukan", http.StatusNotFound)
		return
	}
	jsonData(w, map[string]any{"id": id})
}

func (h *ScheduleHandler) matikanPeriodeLain(ctx context.Context, kecuali string) error {
	if kecuali == "" {
		_, err := h.db.Exec(ctx, `UPDATE periode_ajaran SET is_active = false WHERE is_active`)
		return err
	}
	_, err := h.db.Exec(ctx,
		`UPDATE periode_ajaran SET is_active = false WHERE is_active AND id <> $1`, kecuali)
	return err
}

// ---- Mata pelajaran ----

func (h *ScheduleHandler) ListMapel(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(r.Context(), `
		SELECT * FROM mata_pelajaran
		WHERE ($1 = '' OR is_active = ($1 = 'true'))
		ORDER BY COALESCE(urutan, 999), nama
	`, strings.TrimSpace(r.URL.Query().Get("is_active")))
	if err != nil {
		jsonError(w, "gagal mengambil mata pelajaran", http.StatusInternalServerError)
		return
	}
	items, err := pgx.CollectRows(rows, rowToMap)
	if err != nil {
		jsonError(w, "gagal membaca mata pelajaran", http.StatusInternalServerError)
		return
	}
	jsonData(w, items)
}

func (h *ScheduleHandler) CreateMapel(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	item, err := insertRow(r.Context(), h.db, "mata_pelajaran", body, mapelEditable)
	if err != nil {
		jsonError(w, pesanGalatJadwal(err, "mata pelajaran"), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusCreated)
	jsonData(w, item)
}

func (h *ScheduleHandler) UpdateMapel(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	item, err := updateRow(r.Context(), h.db, "mata_pelajaran", id, body, mapelEditable)
	if err != nil {
		if errors.Is(err, errNoFields) {
			jsonError(w, "tidak ada field yang bisa diperbarui", http.StatusBadRequest)
			return
		}
		if errors.Is(err, pgx.ErrNoRows) {
			jsonError(w, "mata pelajaran tidak ditemukan", http.StatusNotFound)
			return
		}
		jsonError(w, pesanGalatJadwal(err, "mata pelajaran"), http.StatusBadRequest)
		return
	}
	jsonData(w, item)
}

// DeleteMapel menonaktifkan, bukan menghapus. Mapel yang sudah dipakai jadwal
// ditahan foreign key ON DELETE RESTRICT, dan menghapus paksa akan melenyapkan
// riwayat jadwal periode lalu.
func (h *ScheduleHandler) DeleteMapel(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ct, err := h.db.Exec(r.Context(),
		`UPDATE mata_pelajaran SET is_active = false WHERE id = $1`, id)
	if err != nil {
		jsonError(w, "gagal menonaktifkan mata pelajaran", http.StatusInternalServerError)
		return
	}
	if ct.RowsAffected() == 0 {
		jsonError(w, "mata pelajaran tidak ditemukan", http.StatusNotFound)
		return
	}
	jsonData(w, map[string]any{"id": id, "is_active": false})
}

// ---- Jadwal pelajaran ----

func (h *ScheduleHandler) ListJadwal(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	rows, err := h.db.Query(r.Context(), `
		SELECT j.*,
		       m.nama  AS mata_pelajaran_nama,
		       m.kode  AS mata_pelajaran_kode,
		       c.nama_kelas,
		       g.nama  AS guru_nama
		FROM jadwal_pelajaran j
		JOIN mata_pelajaran m ON m.id = j.mata_pelajaran_id
		JOIN classes c        ON c.id = j.class_id
		LEFT JOIN guru g      ON g.id = j.guru_id
		WHERE ($1 = '' OR j.periode_id = $1::uuid)
		  AND ($2 = '' OR j.class_id   = $2::uuid)
		  AND ($3 = '' OR j.guru_id    = $3::uuid)
		ORDER BY j.hari, j.jam_mulai, c.nama_kelas
	`,
		strings.TrimSpace(q.Get("periode_id")),
		strings.TrimSpace(q.Get("class_id")),
		strings.TrimSpace(q.Get("guru_id")),
	)
	if err != nil {
		jsonError(w, "gagal mengambil jadwal", http.StatusInternalServerError)
		return
	}
	items, err := pgx.CollectRows(rows, rowToMap)
	if err != nil {
		jsonError(w, "gagal membaca jadwal", http.StatusInternalServerError)
		return
	}
	jsonData(w, items)
}

func (h *ScheduleHandler) CreateJadwal(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	if pesan := h.periksaBentrok(r.Context(), body, ""); pesan != "" {
		jsonError(w, pesan, http.StatusConflict)
		return
	}
	item, err := insertRow(r.Context(), h.db, "jadwal_pelajaran", body, jadwalEditable)
	if err != nil {
		jsonError(w, pesanGalatJadwal(err, "jadwal"), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusCreated)
	jsonData(w, item)
}

func (h *ScheduleHandler) UpdateJadwal(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	if pesan := h.periksaBentrok(r.Context(), body, id); pesan != "" {
		jsonError(w, pesan, http.StatusConflict)
		return
	}
	item, err := updateRow(r.Context(), h.db, "jadwal_pelajaran", id, body, jadwalEditable)
	if err != nil {
		if errors.Is(err, errNoFields) {
			jsonError(w, "tidak ada field yang bisa diperbarui", http.StatusBadRequest)
			return
		}
		if errors.Is(err, pgx.ErrNoRows) {
			jsonError(w, "jadwal tidak ditemukan", http.StatusNotFound)
			return
		}
		jsonError(w, pesanGalatJadwal(err, "jadwal"), http.StatusBadRequest)
		return
	}
	jsonData(w, item)
}

func (h *ScheduleHandler) DeleteJadwal(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ct, err := h.db.Exec(r.Context(), `DELETE FROM jadwal_pelajaran WHERE id = $1`, id)
	if err != nil {
		jsonError(w, "gagal menghapus jadwal", http.StatusInternalServerError)
		return
	}
	if ct.RowsAffected() == 0 {
		jsonError(w, "jadwal tidak ditemukan", http.StatusNotFound)
		return
	}
	jsonData(w, map[string]any{"id": id})
}

// periksaBentrok menolak dua hal yang tidak bisa dijaga index unik: satu kelas
// dipakai dua pelajaran pada jam yang beririsan, dan satu guru mengajar di dua
// kelas pada waktu yang sama. Index unik hanya menangkap duplikat persis.
//
// Mengembalikan pesan untuk pengguna, atau string kosong bila aman. Saat data
// yang dikirim tidak cukup untuk diperiksa (mis. update parsial tanpa jam),
// pemeriksaan dilewati dan constraint database tetap jadi jaring terakhir.
func (h *ScheduleHandler) periksaBentrok(ctx context.Context, body map[string]any, abaikanID string) string {
	periodeID := asString(body["periode_id"])
	classID := asString(body["class_id"])
	jamMulai := asString(body["jam_mulai"])
	jamSelesai := asString(body["jam_selesai"])

	hari, adaHari := body["hari"].(float64)
	if periodeID == "" || jamMulai == "" || jamSelesai == "" || !adaHari {
		return ""
	}

	if classID != "" {
		var bentrok bool
		err := h.db.QueryRow(ctx, `
			SELECT EXISTS (
				SELECT 1 FROM jadwal_pelajaran
				WHERE periode_id = $1::uuid AND class_id = $2::uuid AND hari = $3
				  AND ($4 = '' OR id <> $4::uuid)
				  AND jam_mulai < $6::time AND jam_selesai > $5::time
			)
		`, periodeID, classID, int(hari), abaikanID, jamMulai, jamSelesai).Scan(&bentrok)
		if err == nil && bentrok {
			return "Kelas ini sudah punya pelajaran lain pada jam tersebut."
		}
	}

	if guruID := asString(body["guru_id"]); guruID != "" {
		var bentrok bool
		err := h.db.QueryRow(ctx, `
			SELECT EXISTS (
				SELECT 1 FROM jadwal_pelajaran
				WHERE periode_id = $1::uuid AND guru_id = $2::uuid AND hari = $3
				  AND ($4 = '' OR id <> $4::uuid)
				  AND jam_mulai < $6::time AND jam_selesai > $5::time
			)
		`, periodeID, guruID, int(hari), abaikanID, jamMulai, jamSelesai).Scan(&bentrok)
		if err == nil && bentrok {
			return "Guru ini sudah mengajar di kelas lain pada jam tersebut."
		}
	}

	return ""
}

// pesanGalatJadwal menerjemahkan pelanggaran constraint jadi kalimat yang bisa
// dibaca pengguna. Tanpa ini yang muncul di layar adalah teks SQLSTATE mentah.
func pesanGalatJadwal(err error, entitas string) string {
	pesan := err.Error()
	switch {
	case strings.Contains(pesan, "periode_ajaran_satu_aktif"):
		return "Hanya boleh ada satu periode aktif."
	case strings.Contains(pesan, "periode_ajaran_unik"):
		return "Periode dengan tahun ajaran dan semester itu sudah ada."
	case strings.Contains(pesan, "periode_ajaran_tahun_format_chk"):
		return "Format tahun ajaran harus seperti 2026/2027."
	case strings.Contains(pesan, "periode_ajaran_semester_chk"):
		return "Semester harus Ganjil atau Genap."
	case strings.Contains(pesan, "periode_ajaran_rentang_chk"):
		return "Tanggal selesai tidak boleh mendahului tanggal mulai."
	case strings.Contains(pesan, "mata_pelajaran_nama_unik"):
		return "Mata pelajaran dengan nama itu sudah ada."
	case strings.Contains(pesan, "mata_pelajaran_nama_not_blank"):
		return "Nama mata pelajaran wajib diisi."
	case strings.Contains(pesan, "jadwal_pelajaran_hari_chk"):
		return "Hari harus antara Senin sampai Sabtu."
	case strings.Contains(pesan, "jadwal_pelajaran_jam_chk"):
		return "Jam selesai harus setelah jam mulai."
	case strings.Contains(pesan, "jadwal_pelajaran_slot_unik"):
		return "Slot jadwal yang sama persis sudah ada."
	case strings.Contains(pesan, "violates foreign key"):
		return "Kelas, mata pelajaran, atau guru yang dipilih tidak ditemukan."
	case errors.Is(err, errNoFields):
		return "Tidak ada field yang bisa disimpan."
	}
	return "Gagal menyimpan " + entitas + ": " + pesan
}
