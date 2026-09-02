package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"lpq-backend/internal/middleware"
)

/* JurnalHandler melayani jurnal mengajar guru — catatan harian tiap pertemuan.
 *
 * Dua aturan yang menentukan seluruh berkas ini:
 *
 *  1. Guru hanya boleh menulis jurnal untuk kombinasi kelas + mata pelajaran +
 *     periode yang benar-benar diampunya menurut `jadwal_pelajaran`. Ini bukan
 *     kerapian: jurnal adalah catatan yang diperiksa kepala sekolah, dan jurnal
 *     yang bisa ditulis atas nama kelas orang lain tidak ada gunanya sebagai
 *     catatan.
 *
 *  2. Guru membaca jurnalnya SENDIRI. Kepala sekolah, admin, dan tata usaha
 *     membaca seluruhnya — merekalah yang memeriksa. Murid tidak sama sekali;
 *     jurnal memuat kendala kelas dan catatan tentang muridnya.
 */
type JurnalHandler struct {
	db *pgxpool.Pool
}

func NewJurnalHandler(db *pgxpool.Pool) *JurnalHandler {
	return &JurnalHandler{db: db}
}

func (h *JurnalHandler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Get("/", h.List)
	r.Post("/", h.Create)
	r.Put("/{id}", h.Update)
	r.Delete("/{id}", h.Delete)

	return r
}

const jurnalCols = `
	j.id, j.guru_id, j.class_id, j.mata_pelajaran_id, j.periode_id,
	j.tanggal, j.jam_ke, j.materi, j.jumlah_hadir, j.jumlah_murid,
	j.kendala, j.tindak_lanjut, j.created_at, j.updated_at,
	g.nama       AS guru_nama,
	c.nama_kelas AS nama_kelas,
	m.nama       AS mata_pelajaran_nama,
	p.nama       AS periode_nama`

const jurnalFrom = `
	FROM jurnal_mengajar j
	LEFT JOIN guru g            ON g.id = j.guru_id
	LEFT JOIN classes c         ON c.id = j.class_id
	LEFT JOIN mata_pelajaran m  ON m.id = j.mata_pelajaran_id
	LEFT JOIN periode_ajaran p  ON p.id = j.periode_id`

// bolehPeriksaJurnal: yang memeriksa jurnal — pengelola dan kepala sekolah.
func bolehPeriksaJurnal(role string) bool {
	return middleware.CanManage(role) || role == "pentashih"
}

/* guruMengampu memeriksa jadwal: apakah guru ini benar-benar mengajar mata
 * pelajaran tersebut di kelas itu pada periode tersebut?
 *
 * Sengaja memakai `jadwal_pelajaran` dan bukan daftar kelas yang diwalikan:
 * guru mata pelajaran mengajar di kelas yang bukan kelasnya, dan wali kelas pun
 * mengajar menurut jadwal. Jadwal adalah satu-satunya sumber yang tahu keduanya.
 *
 * COALESCE(j.guru_id, c.id_guru) — dan ini bukan hiasan. Baris jadwal boleh
 * dibuat TANPA guru, dan artinya "diajar wali kelasnya"; itulah keadaan yang
 * paling umum di SD, tempat satu wali kelas mengajar hampir seluruh mata
 * pelajaran kelasnya. Endpoint jadwal sudah lama memakai aturan yang sama
 * (schedule.go: `COALESCE(j.guru_id, c.id_guru) AS guru_id`), jadi memeriksa
 * `j.guru_id` saja akan menolak wali kelas dari jurnalnya sendiri — persis yang
 * terjadi pada percobaan pertama kode ini. */
func (h *JurnalHandler) guruMengampu(ctx context.Context, guruID, classID, mapelID, periodeID string) (bool, error) {
	var ada bool
	err := h.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM jadwal_pelajaran j
			JOIN classes c ON c.id = j.class_id
			WHERE COALESCE(j.guru_id, c.id_guru) = $1
			  AND j.class_id = $2
			  AND j.mata_pelajaran_id = $3
			  AND j.periode_id = $4
		)
	`, guruID, classID, mapelID, periodeID).Scan(&ada)
	return ada, err
}

// GET /api/jurnal-mengajar
func (h *JurnalHandler) List(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	role := middleware.RoleFromCtx(ctx)
	userID := middleware.UserIDFromCtx(ctx)

	q := r.URL.Query()
	where := make([]string, 0, 6)
	args := make([]any, 0, 6)
	add := func(cond string, val any) {
		args = append(args, val)
		where = append(where, fmt.Sprintf(cond, len(args)))
	}

	switch {
	case bolehPeriksaJurnal(role):
		// Boleh menyaring per guru; tanpa penyaring, seluruh sekolah.
		if v := q.Get("guru_id"); v != "" {
			add("j.guru_id = $%d", v)
		}
	case role == "guru" && userID != "":
		// Dipaksa ke jurnalnya sendiri, apa pun yang diminta klien.
		add("j.guru_id = $%d", userID)
	default:
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}

	if v := q.Get("class_id"); v != "" {
		add("j.class_id = $%d", v)
	}
	if v := q.Get("periode_id"); v != "" {
		add("j.periode_id = $%d", v)
	}
	if v := q.Get("dari"); v != "" && isValidISODate(v) {
		add("j.tanggal >= $%d", v)
	}
	if v := q.Get("sampai"); v != "" && isValidISODate(v) {
		add("j.tanggal <= $%d", v)
	}
	if v := strings.TrimSpace(q.Get("search")); v != "" {
		args = append(args, "%"+v+"%")
		i := len(args)
		where = append(where, fmt.Sprintf("(j.materi ILIKE $%d OR j.kendala ILIKE $%d)", i, i))
	}

	whereSQL := ""
	if len(where) > 0 {
		whereSQL = " WHERE " + strings.Join(where, " AND ")
	}

	var total int
	if err := h.db.QueryRow(ctx,
		"SELECT count(*)"+jurnalFrom+whereSQL, args...).Scan(&total); err != nil {
		log.Printf("jurnal: hitung gagal: %v", err)
		jsonError(w, "gagal menghitung jurnal", http.StatusInternalServerError)
		return
	}

	limit, offset := paginate(r)
	args = append(args, limit, offset)
	query := "SELECT " + jurnalCols + jurnalFrom + whereSQL +
		fmt.Sprintf(" ORDER BY j.tanggal DESC, j.created_at DESC LIMIT $%d OFFSET $%d",
			len(args)-1, len(args))

	rows, err := h.db.Query(ctx, query, args...)
	if err != nil {
		log.Printf("jurnal: query gagal: %v", err)
		jsonError(w, "gagal mengambil jurnal", http.StatusInternalServerError)
		return
	}
	items, err := pgx.CollectRows(rows, rowToMap)
	if err != nil {
		jsonError(w, "gagal membaca jurnal", http.StatusInternalServerError)
		return
	}
	w.Header().Set("X-Total-Count", strconv.Itoa(total))
	jsonData(w, items)
}

type jurnalBody struct {
	GuruID          *string `json:"guru_id"`
	ClassID         string  `json:"class_id"`
	MataPelajaranID string  `json:"mata_pelajaran_id"`
	PeriodeID       string  `json:"periode_id"`
	Tanggal         string  `json:"tanggal"`
	JamKe           *string `json:"jam_ke"`
	Materi          string  `json:"materi"`
	JumlahHadir     *int    `json:"jumlah_hadir"`
	JumlahMurid     *int    `json:"jumlah_murid"`
	Kendala         *string `json:"kendala"`
	TindakLanjut    *string `json:"tindak_lanjut"`
}

// POST /api/jurnal-mengajar
func (h *JurnalHandler) Create(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	role := middleware.RoleFromCtx(ctx)
	userID := middleware.UserIDFromCtx(ctx)

	if !bolehPeriksaJurnal(role) && role != "guru" {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}
	// Kepala sekolah MEMERIKSA jurnal, bukan menulisnya untuk orang lain.
	if role == "pentashih" {
		jsonError(w, "kepala sekolah memeriksa jurnal, tidak menulisnya", http.StatusForbidden)
		return
	}

	var body jurnalBody
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10)).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}

	guruID := userID
	if middleware.CanManage(role) && body.GuruID != nil && strings.TrimSpace(*body.GuruID) != "" {
		// Admin dan tata usaha boleh mengisikan jurnal atas nama guru — dipakai
		// saat guru menitipkan catatannya atau saat memperbaiki entri lama.
		guruID = strings.TrimSpace(*body.GuruID)
	}

	body.Materi = strings.TrimSpace(body.Materi)
	if body.ClassID == "" || body.MataPelajaranID == "" || body.PeriodeID == "" || body.Materi == "" {
		jsonError(w, "kelas, mata pelajaran, periode, dan materi wajib diisi", http.StatusBadRequest)
		return
	}
	if body.Tanggal == "" {
		body.Tanggal = "CURRENT_DATE"
	}
	if body.Tanggal != "CURRENT_DATE" && !isValidISODate(body.Tanggal) {
		jsonError(w, "tanggal tidak valid", http.StatusBadRequest)
		return
	}

	// Guru diperiksa terhadap jadwalnya. Pengelola dilewati — merekalah yang
	// memperbaiki data ketika jadwalnya sendiri yang salah.
	if !middleware.CanManage(role) {
		boleh, err := h.guruMengampu(ctx, guruID, body.ClassID, body.MataPelajaranID, body.PeriodeID)
		if err != nil {
			log.Printf("jurnal: periksa jadwal gagal: %v", err)
			jsonError(w, "gagal memeriksa jadwal mengajar", http.StatusInternalServerError)
			return
		}
		if !boleh {
			jsonError(w, "Anda tidak mengampu mata pelajaran ini di kelas tersebut pada periode itu", http.StatusForbidden)
			return
		}
	}

	tanggal := any(body.Tanggal)
	if body.Tanggal == "CURRENT_DATE" {
		tanggal = nil // biarkan DEFAULT CURRENT_DATE bekerja
	}

	/* Galat penyimpanan diperiksa dari DUA tempat: pengiriman perintah dan
	 * pembacaan barisnya. pgx menunda galat server sampai hasil Query dipindai,
	 * jadi pelanggaran indeks unik — jurnal yang sudah ada untuk pertemuan yang
	 * sama — muncul pada CollectOneRow, bukan pada Query. Memeriksa yang pertama
	 * saja membuat penyimpanan ganda menjawab 500 alih-alih memberi tahu guru
	 * bahwa jurnalnya memang sudah tersimpan. */
	rows, qErr := h.db.Query(ctx, `
		INSERT INTO jurnal_mengajar (
			guru_id, class_id, mata_pelajaran_id, periode_id,
			tanggal, jam_ke, materi, jumlah_hadir, jumlah_murid,
			kendala, tindak_lanjut, created_by
		) VALUES ($1,$2,$3,$4,COALESCE($5::date, CURRENT_DATE),$6,$7,$8,$9,$10,$11,$12)
		RETURNING id
	`, guruID, body.ClassID, body.MataPelajaranID, body.PeriodeID,
		tanggal, nullIfBlankPtr(body.JamKe), body.Materi,
		body.JumlahHadir, body.JumlahMurid,
		nullIfBlankPtr(body.Kendala), nullIfBlankPtr(body.TindakLanjut),
		nullIfBlank(userID))

	var id string
	err := qErr
	if qErr == nil {
		id, err = pgx.CollectOneRow(rows, pgx.RowTo[string])
	}
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			jsonError(w,
				"Jurnal untuk pertemuan ini sudah ada. Buka jurnal yang sudah tersimpan lalu perbaiki isinya.",
				http.StatusConflict)
			return
		}
		log.Printf("jurnal: simpan gagal: %v", err)
		jsonError(w, "gagal menyimpan jurnal", http.StatusInternalServerError)
		return
	}

	item, err := h.satu(ctx, id)
	if err != nil {
		jsonError(w, "gagal membaca jurnal yang baru dibuat", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	jsonData(w, item)
}

func (h *JurnalHandler) satu(ctx context.Context, id string) (map[string]any, error) {
	rows, err := h.db.Query(ctx, "SELECT "+jurnalCols+jurnalFrom+" WHERE j.id = $1", id)
	if err != nil {
		return nil, err
	}
	return pgx.CollectOneRow(rows, rowToMap)
}

// pemilikJurnal mengembalikan guru_id baris jurnal.
func (h *JurnalHandler) pemilikJurnal(ctx context.Context, id string) (string, error) {
	var guruID string
	err := h.db.QueryRow(ctx, `SELECT guru_id FROM jurnal_mengajar WHERE id = $1`, id).Scan(&guruID)
	return guruID, err
}

// PUT /api/jurnal-mengajar/{id}
func (h *JurnalHandler) Update(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	role := middleware.RoleFromCtx(ctx)
	userID := middleware.UserIDFromCtx(ctx)
	id := chi.URLParam(r, "id")

	pemilik, err := h.pemilikJurnal(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			jsonError(w, "jurnal tidak ditemukan", http.StatusNotFound)
			return
		}
		jsonError(w, "gagal membaca jurnal", http.StatusInternalServerError)
		return
	}
	// Guru menyunting jurnalnya sendiri; pengelola menyunting apa pun. Kepala
	// sekolah tidak menyunting — ia memeriksa.
	if !middleware.CanManage(role) && pemilik != userID {
		jsonError(w, "hanya penulisnya atau admin yang dapat mengubah jurnal ini", http.StatusForbidden)
		return
	}

	var body struct {
		JamKe        *string `json:"jam_ke"`
		Materi       *string `json:"materi"`
		JumlahHadir  *int    `json:"jumlah_hadir"`
		JumlahMurid  *int    `json:"jumlah_murid"`
		Kendala      *string `json:"kendala"`
		TindakLanjut *string `json:"tindak_lanjut"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10)).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	if body.Materi != nil && strings.TrimSpace(*body.Materi) == "" {
		jsonError(w, "materi tidak boleh dikosongkan", http.StatusBadRequest)
		return
	}

	/* Kelas, mata pelajaran, periode, dan tanggal TIDAK bisa diubah — sengaja
	 * tidak ada di struct di atas. Mengubahnya sama dengan memindahkan catatan
	 * satu pertemuan menjadi pertemuan lain, dan itu bukan penyuntingan
	 * melainkan penulisan ulang riwayat. Yang salah dihapus lalu dicatat ulang. */
	_, err = h.db.Exec(ctx, `
		UPDATE jurnal_mengajar SET
			jam_ke        = COALESCE($2, jam_ke),
			materi        = COALESCE($3, materi),
			jumlah_hadir  = COALESCE($4, jumlah_hadir),
			jumlah_murid  = COALESCE($5, jumlah_murid),
			kendala       = COALESCE($6, kendala),
			tindak_lanjut = COALESCE($7, tindak_lanjut),
			updated_by    = $8
		WHERE id = $1
	`, id, body.JamKe, body.Materi, body.JumlahHadir, body.JumlahMurid,
		body.Kendala, body.TindakLanjut, nullIfBlank(userID))
	if err != nil {
		log.Printf("jurnal: update gagal: %v", err)
		jsonError(w, "gagal memperbarui jurnal", http.StatusInternalServerError)
		return
	}

	item, err := h.satu(ctx, id)
	if err != nil {
		jsonError(w, "gagal membaca jurnal", http.StatusInternalServerError)
		return
	}
	jsonData(w, item)
}

// DELETE /api/jurnal-mengajar/{id}
func (h *JurnalHandler) Delete(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	role := middleware.RoleFromCtx(ctx)
	userID := middleware.UserIDFromCtx(ctx)
	id := chi.URLParam(r, "id")

	pemilik, err := h.pemilikJurnal(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			jsonError(w, "jurnal tidak ditemukan", http.StatusNotFound)
			return
		}
		jsonError(w, "gagal membaca jurnal", http.StatusInternalServerError)
		return
	}
	if !middleware.CanManage(role) && pemilik != userID {
		jsonError(w, "hanya penulisnya atau admin yang dapat menghapus jurnal ini", http.StatusForbidden)
		return
	}

	if _, err := h.db.Exec(ctx, `DELETE FROM jurnal_mengajar WHERE id = $1`, id); err != nil {
		jsonError(w, "gagal menghapus jurnal", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// nullIfBlankPtr mengubah penunjuk string kosong menjadi nil, supaya kolom
// opsional tersimpan NULL alih-alih string kosong — keduanya terlihat sama di
// layar tetapi berbeda saat disaring.
func nullIfBlankPtr(s *string) any {
	if s == nil || strings.TrimSpace(*s) == "" {
		return nil
	}
	return strings.TrimSpace(*s)
}
