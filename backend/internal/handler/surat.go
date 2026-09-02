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
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"lpq-backend/internal/middleware"
)

/* SuratHandler melayani agenda surat keluar sekolah.
 *
 * Tiga aturan yang menentukan seluruh berkas ini:
 *
 *  1. NOMOR SURAT DITENTUKAN SERVER, tidak pernah dikirim klien. Nomor surat
 *     adalah nomor agenda resmi; membiarkan klien mengusulkannya berarti dua
 *     petugas bisa mengetik nomor yang sama, atau seseorang bisa menyelipkan
 *     surat bernomor mundur.
 *
 *  2. Deretnya SATU per tahun untuk semua jenis surat, berulang dari 1 setiap
 *     Januari. Itu cara buku agenda surat sekolah bekerja.
 *
 *  3. Surat yang salah DIBATALKAN, tidak dihapus. Nomor yang lompat adalah
 *     pertanyaan pertama pengawas, jadi nomornya tetap tercatat beserta alasan
 *     pembatalannya.
 *
 * Hak akses: admin dan tata usaha penuh; kepala sekolah (pentashih) boleh
 * MEMBACA karena ia yang menandatangani; guru dan murid tidak sama sekali —
 * surat memuat data pribadi murid beserta keperluannya.
 */
type SuratHandler struct {
	db *pgxpool.Pool
}

func NewSuratHandler(db *pgxpool.Pool) *SuratHandler {
	return &SuratHandler{db: db}
}

func (h *SuratHandler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Get("/", h.List)
	r.Get("/{id}", h.Detail)
	r.Post("/", h.Create)
	r.Put("/{id}", h.Update)
	r.Post("/{id}/batal", h.Batal)

	return r
}

// jenisSurat yang dikenal, beserta label dan kode klasifikasi bawaannya.
//
// Kode klasifikasi mengikuti kebiasaan tata naskah sekolah: 421.2 untuk urusan
// kemuridan, 422 untuk mutasi. Sekolah bisa menimpanya lewat konfigurasi
// `surat_config`; yang di sini hanya nilai jatuh-balik supaya surat tetap
// bernomor wajar pada pemasangan yang belum diatur.
var jenisSurat = map[string]struct {
	Label string
	Kode  string
}{
	"keterangan_aktif": {"Surat Keterangan Aktif Sekolah", "421.2"},
	"pindah":           {"Surat Keterangan Pindah Sekolah", "422"},
	"tidak_mampu":      {"Surat Keterangan Murid Tidak Mampu", "421.2"},
	"umum":             {"Surat Keterangan", "400"},
}

// bulanRomawi dipakai pada nomor surat. Ditulis sebagai tabel, bukan dihitung,
// karena hanya ada dua belas dan tabel tidak bisa salah.
var bulanRomawi = [...]string{
	"", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII",
}

const suratCols = `
	s.id, s.nomor, s.nomor_urut, s.tahun, s.jenis,
	s.santri_id, s.santri_nama, s.santri_nomor, s.santri_kelas,
	s.perihal, s.penerima, s.isi, s.tanggal_surat, s.data,
	s.dibatalkan, s.alasan_batal, s.dibatalkan_pada,
	s.created_at, s.updated_at`

// bolehBacaSurat: pengelola penuh, plus kepala sekolah yang menandatanganinya.
func bolehBacaSurat(role string) bool {
	return middleware.CanManage(role) || role == "pentashih"
}

// GET /api/surat
func (h *SuratHandler) List(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !bolehBacaSurat(middleware.RoleFromCtx(ctx)) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}

	q := r.URL.Query()
	where := make([]string, 0, 5)
	args := make([]any, 0, 5)
	add := func(cond string, val any) {
		args = append(args, val)
		where = append(where, fmt.Sprintf(cond, len(args)))
	}

	if v := q.Get("jenis"); v != "" {
		add("s.jenis = $%d", v)
	}
	if v := q.Get("tahun"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			add("s.tahun = $%d", n)
		}
	}
	if v := q.Get("santri_id"); v != "" {
		add("s.santri_id = $%d", v)
	}
	// Surat yang dibatalkan tetap ada di agenda dan ikut tampil secara bawaan —
	// justru itu gunanya. Penyaring ini untuk petugas yang ingin melihat yang
	// berlaku saja.
	if q.Get("hanya_berlaku") == "true" {
		where = append(where, "s.dibatalkan = false")
	}
	if v := strings.TrimSpace(q.Get("search")); v != "" {
		args = append(args, "%"+v+"%")
		i := len(args)
		where = append(where, fmt.Sprintf(
			"(s.nomor ILIKE $%d OR s.perihal ILIKE $%d OR s.santri_nama ILIKE $%d OR s.penerima ILIKE $%d)",
			i, i, i, i))
	}

	whereSQL := ""
	if len(where) > 0 {
		whereSQL = " WHERE " + strings.Join(where, " AND ")
	}

	var total int
	if err := h.db.QueryRow(ctx, "SELECT count(*) FROM surat s"+whereSQL, args...).Scan(&total); err != nil {
		log.Printf("surat: hitung gagal: %v", err)
		jsonError(w, "gagal menghitung surat", http.StatusInternalServerError)
		return
	}

	limit, offset := paginate(r)
	args = append(args, limit, offset)
	query := "SELECT " + suratCols + " FROM surat s" + whereSQL +
		fmt.Sprintf(" ORDER BY s.tahun DESC, s.nomor_urut DESC LIMIT $%d OFFSET $%d",
			len(args)-1, len(args))

	rows, err := h.db.Query(ctx, query, args...)
	if err != nil {
		log.Printf("surat: query gagal: %v", err)
		jsonError(w, "gagal mengambil surat", http.StatusInternalServerError)
		return
	}
	items, err := pgx.CollectRows(rows, rowToMap)
	if err != nil {
		jsonError(w, "gagal membaca surat", http.StatusInternalServerError)
		return
	}
	w.Header().Set("X-Total-Count", strconv.Itoa(total))
	jsonData(w, items)
}

// GET /api/surat/{id}
func (h *SuratHandler) Detail(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !bolehBacaSurat(middleware.RoleFromCtx(ctx)) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}
	rows, err := h.db.Query(ctx,
		"SELECT "+suratCols+" FROM surat s WHERE s.id = $1", chi.URLParam(r, "id"))
	if err != nil {
		jsonError(w, "gagal mengambil surat", http.StatusInternalServerError)
		return
	}
	item, err := pgx.CollectOneRow(rows, rowToMap)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			jsonError(w, "surat tidak ditemukan", http.StatusNotFound)
			return
		}
		jsonError(w, "gagal membaca surat", http.StatusInternalServerError)
		return
	}
	jsonData(w, item)
}

type suratBody struct {
	Jenis        string          `json:"jenis"`
	SantriID     *string         `json:"santri_id"`
	Perihal      string          `json:"perihal"`
	Penerima     *string         `json:"penerima"`
	Isi          *string         `json:"isi"`
	TanggalSurat *string         `json:"tanggal_surat"`
	Data         json.RawMessage `json:"data"`
}

/* konfigSurat membaca kode klasifikasi dan kode sekolah dari website_content
 * (kunci `surat_config`), dengan nilai jatuh-balik per jenis surat.
 *
 * Kunci yang tidak ada BUKAN kesalahan: pemasangan baru belum pernah membukanya,
 * dan surat pertama sekolah tidak boleh gagal karena itu. */
func (h *SuratHandler) konfigSurat(ctx context.Context, jenis string) (kodeKlasifikasi, kodeSekolah string) {
	kodeKlasifikasi = jenisSurat[jenis].Kode
	kodeSekolah = "SD"

	var raw []byte
	err := h.db.QueryRow(ctx,
		`SELECT content FROM website_content WHERE key = 'surat_config'`).Scan(&raw)
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			log.Printf("surat: baca surat_config gagal: %v", err)
		}
		return kodeKlasifikasi, kodeSekolah
	}

	var cfg struct {
		KodeSekolah string            `json:"kode_sekolah"`
		Klasifikasi map[string]string `json:"klasifikasi"`
	}
	if err := json.Unmarshal(raw, &cfg); err != nil {
		log.Printf("surat: surat_config tidak terbaca, pakai bawaan: %v", err)
		return kodeKlasifikasi, kodeSekolah
	}
	if v := strings.TrimSpace(cfg.KodeSekolah); v != "" {
		kodeSekolah = v
	}
	if v := strings.TrimSpace(cfg.Klasifikasi[jenis]); v != "" {
		kodeKlasifikasi = v
	}
	return kodeKlasifikasi, kodeSekolah
}

// POST /api/surat
func (h *SuratHandler) Create(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	role := middleware.RoleFromCtx(ctx)
	if !middleware.CanManage(role) {
		jsonError(w, "hanya admin dan tata usaha yang dapat menerbitkan surat", http.StatusForbidden)
		return
	}

	var body suratBody
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10)).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}

	item, status, msg := h.terbitkanSurat(ctx, body, middleware.UserIDFromCtx(ctx))
	if msg != "" {
		jsonError(w, msg, status)
		return
	}
	w.WriteHeader(http.StatusCreated)
	jsonData(w, item)
}

/* terbitkanSurat menyimpan satu surat beserta nomornya.
 *
 * Dipisah dari handler HTTP supaya mutasi keluar murid (santri.go) bisa
 * menerbitkan surat pindah lewat jalur yang SAMA — satu tempat yang menentukan
 * nomor, satu tempat yang menyalin identitas murid.
 *
 * Nomor urut diambil dengan `max + 1` lalu diandalkan pada indeks unik untuk
 * menangkap dua petugas yang menyimpan bersamaan; bentrokan diulang beberapa
 * kali. Alternatifnya sequence Postgres, tetapi sequence tidak bisa berulang
 * per tahun tanpa penataan ulang setiap Januari, dan lubang nomor akibat
 * transaksi yang dibatalkan justru hal yang harus dihindari di buku agenda.
 */
func (h *SuratHandler) terbitkanSurat(ctx context.Context, body suratBody, userID string) (map[string]any, int, string) {
	body.Jenis = strings.TrimSpace(body.Jenis)
	if _, ok := jenisSurat[body.Jenis]; !ok {
		return nil, http.StatusBadRequest, "jenis surat tidak dikenal"
	}
	body.Perihal = strings.TrimSpace(body.Perihal)
	if body.Perihal == "" {
		body.Perihal = jenisSurat[body.Jenis].Label
	}

	tanggal := time.Now()
	if body.TanggalSurat != nil && strings.TrimSpace(*body.TanggalSurat) != "" {
		t, err := time.Parse("2006-01-02", strings.TrimSpace(*body.TanggalSurat)[:10])
		if err != nil {
			return nil, http.StatusBadRequest, "tanggal surat tidak valid"
		}
		tanggal = t
	}

	// Identitas murid disalin apa adanya saat ini. Lihat catatan kolomnya di
	// migrasi 20260902000200.
	var santriNama, santriNomor, santriKelas *string
	if body.SantriID != nil && strings.TrimSpace(*body.SantriID) != "" {
		var nama, nomor string
		var kelas *string
		err := h.db.QueryRow(ctx, `
			SELECT s.nama_lengkap,
			       COALESCE(NULLIF(s.nis,''), NULLIF(s.nisn,''), COALESCE(s.nomor_induk,'')),
			       c.nama_kelas
			FROM santri s
			LEFT JOIN classes c ON c.id = s.current_class_id
			WHERE s.id = $1
		`, *body.SantriID).Scan(&nama, &nomor, &kelas)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, http.StatusBadRequest, "murid tidak ditemukan"
			}
			log.Printf("surat: baca murid gagal: %v", err)
			return nil, http.StatusInternalServerError, "gagal membaca data murid"
		}
		santriNama, santriNomor, santriKelas = &nama, &nomor, kelas
	}

	if len(body.Data) == 0 {
		body.Data = json.RawMessage(`{}`)
	}

	kodeKlasifikasi, kodeSekolah := h.konfigSurat(ctx, body.Jenis)
	tahun := tanggal.Year()

	var last error
	for coba := 0; coba < 8; coba++ {
		var urut int
		if err := h.db.QueryRow(ctx,
			`SELECT COALESCE(max(nomor_urut), 0) + 1 FROM surat WHERE tahun = $1`, tahun,
		).Scan(&urut); err != nil {
			log.Printf("surat: ambil nomor urut gagal: %v", err)
			return nil, http.StatusInternalServerError, "gagal menyiapkan nomor surat"
		}

		nomor := fmt.Sprintf("%s/%03d/%s/%s/%d",
			kodeKlasifikasi, urut, kodeSekolah, bulanRomawi[int(tanggal.Month())], tahun)

		rows, qErr := h.db.Query(ctx, `
			INSERT INTO surat (
				nomor, nomor_urut, tahun, jenis,
				santri_id, santri_nama, santri_nomor, santri_kelas,
				perihal, penerima, isi, tanggal_surat, data, created_by
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
			RETURNING `+strings.ReplaceAll(suratCols, "s.", "")+`
		`, nomor, urut, tahun, body.Jenis,
			body.SantriID, santriNama, santriNomor, santriKelas,
			body.Perihal, body.Penerima, body.Isi, tanggal.Format("2006-01-02"),
			[]byte(body.Data), nullIfBlank(userID))
		/* Bentrokan nomor muncul saat baris hasilnya DIBACA, bukan saat perintah
		 * dikirim: pgx menunda galat server sampai Query hasilnya dipindai. Versi
		 * pertama kode ini hanya memeriksa galat dari Query, sehingga pengulangan
		 * tidak pernah aktif dan satu dari enam penyimpanan serentak menjawab 500
		 * padahal cukup diulang. Keduanya kini diperiksa bersama. */
		err := qErr
		var item map[string]any
		if qErr == nil {
			var cErr error
			item, cErr = pgx.CollectOneRow(rows, rowToMap)
			if cErr == nil {
				return item, 0, ""
			}
			err = cErr
		}

		last = err
		// unique_violation: petugas lain memakai nomor itu lebih dulu. Diulang
		// dengan nomor berikutnya, bukan dilaporkan sebagai kegagalan.
		if !bentrokNomor(err) {
			break
		}
	}

	log.Printf("surat: simpan gagal: %v", last)
	return nil, http.StatusInternalServerError, "gagal menyimpan surat"
}

// PUT /api/surat/{id} — hanya isi yang bisa diperbaiki, nomor tidak.
func (h *SuratHandler) Update(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !middleware.CanManage(middleware.RoleFromCtx(ctx)) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}

	var body struct {
		Perihal  *string         `json:"perihal"`
		Penerima *string         `json:"penerima"`
		Isi      *string         `json:"isi"`
		Data     json.RawMessage `json:"data"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10)).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}

	/* Nomor, jenis, tahun, dan murid TIDAK bisa diubah — sengaja tidak ada di
	 * struct di atas. Surat yang sudah bernomor dan ditandatangani adalah catatan
	 * resmi; kalau isinya salah, yang benar adalah membatalkannya lalu
	 * menerbitkan yang baru, bukan menulis ulang yang lama tanpa jejak.
	 * Perbaikan di sini hanya untuk salah tulis sebelum surat dicetak. */
	rows, err := h.db.Query(ctx, `
		UPDATE surat SET
			perihal   = COALESCE($2, perihal),
			penerima  = COALESCE($3, penerima),
			isi       = COALESCE($4, isi),
			data      = COALESCE($5, data),
			updated_by = $6
		WHERE id = $1 AND dibatalkan = false
		RETURNING `+strings.ReplaceAll(suratCols, "s.", "")+`
	`, chi.URLParam(r, "id"), body.Perihal, body.Penerima, body.Isi,
		optionalJSON(body.Data), nullIfBlank(middleware.UserIDFromCtx(ctx)))
	if err != nil {
		log.Printf("surat: update gagal: %v", err)
		jsonError(w, "gagal memperbarui surat", http.StatusInternalServerError)
		return
	}
	item, err := pgx.CollectOneRow(rows, rowToMap)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			jsonError(w, "surat tidak ditemukan atau sudah dibatalkan", http.StatusNotFound)
			return
		}
		jsonError(w, "gagal membaca surat", http.StatusInternalServerError)
		return
	}
	jsonData(w, item)
}

// POST /api/surat/{id}/batal
func (h *SuratHandler) Batal(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !middleware.CanManage(middleware.RoleFromCtx(ctx)) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}

	var body struct {
		Alasan string `json:"alasan"`
	}
	// Alasan boleh kosong; body yang tidak terbaca pun tidak menggagalkan
	// pembatalan, karena yang penting suratnya berhenti berlaku.
	_ = json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&body)

	ct, err := h.db.Exec(ctx, `
		UPDATE surat
		SET dibatalkan = true,
		    alasan_batal = NULLIF($2, ''),
		    dibatalkan_pada = now(),
		    dibatalkan_oleh = $3
		WHERE id = $1 AND dibatalkan = false
	`, chi.URLParam(r, "id"), strings.TrimSpace(body.Alasan),
		nullIfBlank(middleware.UserIDFromCtx(ctx)))
	if err != nil {
		log.Printf("surat: batal gagal: %v", err)
		jsonError(w, "gagal membatalkan surat", http.StatusInternalServerError)
		return
	}
	if ct.RowsAffected() == 0 {
		jsonError(w, "surat tidak ditemukan atau sudah dibatalkan", http.StatusNotFound)
		return
	}
	jsonOK(w, map[string]any{"dibatalkan": true})
}

/* bentrokNomor mengenali pelanggaran indeks unik (SQLSTATE 23505) lewat tipe
 * galatnya, bukan lewat mencari teks "23505" di dalam pesannya. Pesan galat
 * ditulis untuk manusia dan berubah antarversi server; kodenya tidak. */
func bentrokNomor(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// optionalJSON mengembalikan nil untuk JSON kosong, supaya COALESCE pada UPDATE
// mempertahankan nilai lama alih-alih menimpanya dengan `{}`.
func optionalJSON(raw json.RawMessage) any {
	if len(raw) == 0 {
		return nil
	}
	return []byte(raw)
}
