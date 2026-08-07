package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"lpq-backend/internal/middleware"
)

// PPDB — pendaftaran murid baru.
//
// Sebelum ada berkas ini, formulir pendaftaran di halaman publik meratakan
// seluruh isinya menjadi satu string lalu mengirimkannya ke /api/content/feedback.
// Akibatnya pendaftaran bercampur dengan pesan pengunjung, tidak punya status,
// dan tidak bisa disaring — tata usaha membacanya seperti membaca surat.
//
// Gerbang izin: POST /api/ppdb terbuka untuk umum (orang tua tidak punya akun).
// Semua rute lain hanya untuk peran pengelola, diperiksa di dalam handler lewat
// middleware.CanManage — bukan lewat RequireRole — karena sub-router ini dipasang
// di bawah OptionalAuth agar POST publiknya tetap bisa masuk. Pola yang sama
// dipakai handler content.

type PpdbHandler struct {
	db *pgxpool.Pool
}

func NewPpdbHandler(db *pgxpool.Pool) *PpdbHandler {
	return &PpdbHandler{db: db}
}

func (h *PpdbHandler) Routes() chi.Router {
	r := chi.NewRouter()

	// Publik: formulir pendaftaran di halaman /ppdb.
	r.Post("/", h.Submit)

	// Back-office: tata usaha, admin, superadmin. Dijaga CanManage di tiap handler.
	r.Get("/", h.List)
	r.Get("/statistik", h.Stats)
	r.Get("/{id}", h.Get)
	// PUT, bukan PATCH: corsMiddleware hanya mengizinkan GET/POST/PUT/DELETE, jadi
	// PATCH akan ditolak browser sebelum sampai ke sini. Muatannya tetap sebagian —
	// pola yang sama dipakai endpoint konten.
	r.Put("/{id}", h.Update)
	r.Delete("/{id}", h.Delete)

	return r
}

// ---------------------------------------------------------------------------
// Bentuk data
// ---------------------------------------------------------------------------

type pendaftaranRow struct {
	ID                string         `json:"id"`
	NomorPendaftaran  string         `json:"nomor_pendaftaran"`
	TahunAjaran       string         `json:"tahun_ajaran"`
	NamaLengkap       string         `json:"nama_lengkap"`
	Nisn              *string        `json:"nisn"`
	Nik               *string        `json:"nik"`
	TempatLahir       *string        `json:"tempat_lahir"`
	TanggalLahir      *string        `json:"tanggal_lahir"`
	JenisKelamin      *string        `json:"jenis_kelamin"`
	Alamat            *string        `json:"alamat"`
	NoHp              string         `json:"no_hp"`
	Email             *string        `json:"email"`
	SekolahAsal       *string        `json:"sekolah_asal"`
	NpsnAsal          *string        `json:"npsn_asal"`
	UsiaKeterangan    *string        `json:"usia_keterangan"`
	Jalur             *string        `json:"jalur"`
	JalurLabel        *string        `json:"jalur_label"`
	Minat             *string        `json:"minat"`
	NamaAyah          *string        `json:"nama_ayah"`
	NamaIbu           *string        `json:"nama_ibu"`
	PekerjaanOrangTua *string        `json:"pekerjaan_orang_tua"`
	NoHpWali          *string        `json:"no_hp_wali"`
	BerkasSiap        map[string]any `json:"berkas_siap"`
	Status            string         `json:"status"`
	Catatan           *string        `json:"catatan"`
	DiprosesPada      *string        `json:"diproses_pada"`
	CreatedAt         string         `json:"created_at"`
	UpdatedAt         string         `json:"updated_at"`
}

// Daftar kolom dipakai bersama oleh List dan Get supaya keduanya tidak pernah
// berbeda urutan — pemindaian pgx berdasarkan posisi, bukan nama.
const pendaftaranKolom = `
	id, nomor_pendaftaran, tahun_ajaran, nama_lengkap, nisn, nik,
	tempat_lahir, tanggal_lahir::text, jenis_kelamin, alamat, no_hp, email,
	sekolah_asal, npsn_asal, usia_keterangan, jalur, jalur_label, minat,
	nama_ayah, nama_ibu, pekerjaan_orang_tua, no_hp_wali, berkas_siap,
	status, catatan, diproses_pada::text, created_at::text, updated_at::text
`

func scanPendaftaran(row pgx.Row) (pendaftaranRow, error) {
	var p pendaftaranRow
	err := row.Scan(
		&p.ID, &p.NomorPendaftaran, &p.TahunAjaran, &p.NamaLengkap, &p.Nisn, &p.Nik,
		&p.TempatLahir, &p.TanggalLahir, &p.JenisKelamin, &p.Alamat, &p.NoHp, &p.Email,
		&p.SekolahAsal, &p.NpsnAsal, &p.UsiaKeterangan, &p.Jalur, &p.JalurLabel, &p.Minat,
		&p.NamaAyah, &p.NamaIbu, &p.PekerjaanOrangTua, &p.NoHpWali, &p.BerkasSiap,
		&p.Status, &p.Catatan, &p.DiprosesPada, &p.CreatedAt, &p.UpdatedAt,
	)
	return p, err
}

// ---------------------------------------------------------------------------
// Validasi
// ---------------------------------------------------------------------------

var (
	angkaSaja   = regexp.MustCompile(`^[0-9]+$`)
	emailBentuk = regexp.MustCompile(`^[^@\s]+@[^@\s.]+\.[^@\s]+$`)
	statusSah   = map[string]bool{"baru": true, "diverifikasi": true, "diterima": true, "ditolak": true}
)

// Nomor telepon Indonesia ditulis bermacam-macam: 0812…, +62812…, 62812…, dan
// sering diselingi spasi atau tanda hubung. Semuanya dirapikan ke bentuk 08…
// supaya tata usaha bisa menyalinnya ke WhatsApp tanpa menyunting.
func rapikanHp(raw string) string {
	bersih := strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, strings.TrimSpace(raw))

	switch {
	case strings.HasPrefix(bersih, "62"):
		return "0" + strings.TrimPrefix(bersih, "62")
	case strings.HasPrefix(bersih, "0"):
		return bersih
	case bersih != "":
		// Ditulis tanpa nol depan, misalnya "812…".
		return "0" + bersih
	}
	return ""
}

// Field opsional: string kosong disimpan sebagai NULL, bukan '' — supaya indeks
// parsial NISN bekerja dan panel tidak perlu membedakan keduanya.
func opsional(raw string) *string {
	t := strings.TrimSpace(raw)
	if t == "" {
		return nil
	}
	return &t
}

type ppdbInput struct {
	TahunAjaran       string          `json:"tahun_ajaran"`
	NamaLengkap       string          `json:"nama_lengkap"`
	Nisn              string          `json:"nisn"`
	Nik               string          `json:"nik"`
	TempatLahir       string          `json:"tempat_lahir"`
	TanggalLahir      string          `json:"tanggal_lahir"`
	JenisKelamin      string          `json:"jenis_kelamin"`
	Alamat            string          `json:"alamat"`
	NoHp              string          `json:"no_hp"`
	Email             string          `json:"email"`
	SekolahAsal       string          `json:"sekolah_asal"`
	NpsnAsal          string          `json:"npsn_asal"`
	UsiaKeterangan    string          `json:"usia_keterangan"`
	Jalur             string          `json:"jalur"`
	JalurLabel        string          `json:"jalur_label"`
	Minat             string          `json:"minat"`
	NamaAyah          string          `json:"nama_ayah"`
	NamaIbu           string          `json:"nama_ibu"`
	PekerjaanOrangTua string          `json:"pekerjaan_orang_tua"`
	NoHpWali          string          `json:"no_hp_wali"`
	BerkasSiap        map[string]bool `json:"berkas_siap"`
}

// Memeriksa isi formulir dan mengembalikan pesan pertama yang gagal.
//
// Diperiksa di server, bukan hanya di browser: endpoint ini terbuka untuk umum,
// jadi apa pun bisa dikirim langsung ke sini. Pesannya berbahasa Indonesia karena
// ditampilkan apa adanya di formulir.
func (in *ppdbInput) periksa() error {
	if strings.TrimSpace(in.TahunAjaran) == "" {
		return errors.New("tahun ajaran tidak terbaca, muat ulang halaman lalu coba lagi")
	}
	if len([]rune(strings.TrimSpace(in.NamaLengkap))) < 3 {
		return errors.New("nama lengkap wajib diisi, minimal tiga huruf")
	}
	if in.TanggalLahir == "" {
		return errors.New("tanggal lahir wajib diisi")
	}
	lahir, err := time.Parse("2006-01-02", strings.TrimSpace(in.TanggalLahir))
	if err != nil {
		return errors.New("tanggal lahir tidak terbaca")
	}
	if lahir.After(time.Now()) {
		return errors.New("tanggal lahir tidak boleh melewati hari ini")
	}
	// Batas bawah yang longgar; hanya untuk menangkap salah ketik tahun.
	if lahir.Year() < 1900 {
		return errors.New("tanggal lahir tidak wajar, periksa tahunnya")
	}
	if in.JenisKelamin != "L" && in.JenisKelamin != "P" {
		return errors.New("jenis kelamin wajib dipilih")
	}
	if len([]rune(strings.TrimSpace(in.Alamat))) < 5 {
		return errors.New("alamat tempat tinggal wajib diisi")
	}

	hp := rapikanHp(in.NoHp)
	if len(hp) < 9 || len(hp) > 15 {
		return errors.New("nomor WhatsApp tidak wajar, tulis seperti 08123456789")
	}

	// NISN dan NIK boleh kosong — sebagian pendaftar kelas satu belum memilikinya —
	// tapi bila ditulis, panjangnya harus benar. Nomor yang salah panjang lebih
	// merepotkan daripada kolom kosong: ia lolos ke Dapodik dan ditolak di sana.
	if nisn := strings.TrimSpace(in.Nisn); nisn != "" {
		if !angkaSaja.MatchString(nisn) || len(nisn) != 10 {
			return errors.New("NISN harus 10 angka, atau biarkan kosong bila belum ada")
		}
	}
	if nik := strings.TrimSpace(in.Nik); nik != "" {
		if !angkaSaja.MatchString(nik) || len(nik) != 16 {
			return errors.New("NIK harus 16 angka sesuai kartu keluarga")
		}
	}
	if npsn := strings.TrimSpace(in.NpsnAsal); npsn != "" {
		if !angkaSaja.MatchString(npsn) || len(npsn) != 8 {
			return errors.New("NPSN asal harus 8 angka, atau biarkan kosong")
		}
	}
	if email := strings.TrimSpace(in.Email); email != "" && !emailBentuk.MatchString(email) {
		return errors.New("alamat email tidak sah")
	}
	if strings.TrimSpace(in.NamaAyah) == "" && strings.TrimSpace(in.NamaIbu) == "" {
		return errors.New("nama ayah atau nama ibu wajib diisi setidaknya satu")
	}
	return nil
}

// ---------------------------------------------------------------------------
// Submit — publik
// ---------------------------------------------------------------------------

// Submit POST /api/ppdb (publik, tanpa auth)
func (h *PpdbHandler) Submit(w http.ResponseWriter, r *http.Request) {
	var in ppdbInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	if err := in.periksa(); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	tahun := strings.TrimSpace(in.TahunAjaran)
	nama := strings.TrimSpace(in.NamaLengkap)
	lahir := strings.TrimSpace(in.TanggalLahir)

	/* Kirim ganda adalah kejadian biasa: orang tua menekan tombol dua kali, atau
	 * memuat ulang halaman konfirmasi. Alih-alih membuat dua baris yang harus
	 * dibereskan tata usaha, pendaftaran yang sudah ada dikembalikan beserta nomor
	 * aslinya — bagi pendaftar hasilnya tampak persis sama. Dicocokkan berdasarkan
	 * nama dan tanggal lahir dalam tahun ajaran yang sama. */
	var adaID, adaNomor string
	err := h.db.QueryRow(r.Context(), `
		SELECT id, nomor_pendaftaran
		FROM pendaftaran_ppdb
		WHERE tahun_ajaran = $1
		  AND lower(nama_lengkap) = lower($2)
		  AND tanggal_lahir = $3::date
		LIMIT 1
	`, tahun, nama, lahir).Scan(&adaID, &adaNomor)
	if err == nil {
		jsonOK(w, map[string]any{"data": map[string]any{
			"id":                adaID,
			"nomor_pendaftaran": adaNomor,
			"duplikat":          true,
		}})
		return
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		jsonError(w, "gagal memeriksa pendaftaran", http.StatusInternalServerError)
		return
	}

	// Seluruh penyimpanan dalam satu transaksi: nomor urut yang sudah dinaikkan
	// tidak boleh terpakai bila penyisipan barisnya gagal.
	tx, err := h.db.Begin(r.Context())
	if err != nil {
		jsonError(w, "gagal menyimpan pendaftaran", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(r.Context())

	var urut int
	if err := tx.QueryRow(r.Context(), `
		INSERT INTO ppdb_nomor_urut (tahun_ajaran, urut)
		VALUES ($1, 1)
		ON CONFLICT (tahun_ajaran)
		DO UPDATE SET urut = ppdb_nomor_urut.urut + 1
		RETURNING urut
	`, tahun).Scan(&urut); err != nil {
		jsonError(w, "gagal membuat nomor pendaftaran", http.StatusInternalServerError)
		return
	}

	// Tahun pembuka dipakai pada nomor: "PPDB-2026-0001" dari tahun ajaran
	// "2026/2027". Bila isinya tidak memuat tahun, seluruh nilai dipakai apa adanya.
	tahunNomor := tahun
	if len(tahun) >= 4 && angkaSaja.MatchString(tahun[:4]) {
		tahunNomor = tahun[:4]
	}
	nomor := fmt.Sprintf("PPDB-%s-%04d", tahunNomor, urut)

	berkas := in.BerkasSiap
	if berkas == nil {
		berkas = map[string]bool{}
	}

	var id string
	err = tx.QueryRow(r.Context(), `
		INSERT INTO pendaftaran_ppdb (
			nomor_pendaftaran, tahun_ajaran, nama_lengkap, nisn, nik,
			tempat_lahir, tanggal_lahir, jenis_kelamin, alamat, no_hp, email,
			sekolah_asal, npsn_asal, usia_keterangan, jalur, jalur_label, minat,
			nama_ayah, nama_ibu, pekerjaan_orang_tua, no_hp_wali, berkas_siap
		) VALUES (
			$1,$2,$3,$4,$5,$6,$7::date,$8,$9,$10,$11,
			$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
		)
		RETURNING id
	`,
		nomor, tahun, nama, opsional(in.Nisn), opsional(in.Nik),
		opsional(in.TempatLahir), lahir, in.JenisKelamin, opsional(in.Alamat),
		rapikanHp(in.NoHp), opsional(in.Email),
		opsional(in.SekolahAsal), opsional(in.NpsnAsal), opsional(in.UsiaKeterangan),
		opsional(in.Jalur), opsional(in.JalurLabel), opsional(in.Minat),
		opsional(in.NamaAyah), opsional(in.NamaIbu), opsional(in.PekerjaanOrangTua),
		opsional(rapikanHp(in.NoHpWali)), berkas,
	).Scan(&id)
	if err != nil {
		// Satu-satunya constraint yang bisa dilanggar pendaftar adalah NISN ganda.
		if strings.Contains(err.Error(), "pendaftaran_ppdb_nisn_unik") {
			jsonError(w, "NISN ini sudah terdaftar pada tahun ajaran yang sama", http.StatusConflict)
			return
		}
		jsonError(w, "gagal menyimpan pendaftaran", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		jsonError(w, "gagal menyimpan pendaftaran", http.StatusInternalServerError)
		return
	}

	jsonCreated(w, map[string]any{"id": id, "nomor_pendaftaran": nomor, "duplikat": false})
}

// ---------------------------------------------------------------------------
// Back-office
// ---------------------------------------------------------------------------

// List GET /api/ppdb?tahun=&status=&q=
func (h *PpdbHandler) List(w http.ResponseWriter, r *http.Request) {
	if !middleware.CanManage(middleware.RoleFromCtx(r.Context())) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}

	q := r.URL.Query()
	// Penyaring dirakit sebagai parameter, bukan disisipkan ke string SQL.
	// `$1 = ''` membuat satu query melayani "semua" maupun "yang disaring".
	tahun := strings.TrimSpace(q.Get("tahun"))
	status := strings.TrimSpace(q.Get("status"))
	if status != "" && !statusSah[status] {
		jsonError(w, "status tidak dikenal", http.StatusBadRequest)
		return
	}
	cari := strings.TrimSpace(q.Get("q"))

	rows, err := h.db.Query(r.Context(), `
		SELECT `+pendaftaranKolom+`
		FROM pendaftaran_ppdb
		WHERE ($1 = '' OR tahun_ajaran = $1)
		  AND ($2 = '' OR status = $2)
		  AND ($3 = '' OR nama_lengkap ILIKE '%' || $3 || '%'
		                OR nomor_pendaftaran ILIKE '%' || $3 || '%'
		                OR coalesce(nisn, '') ILIKE '%' || $3 || '%'
		                OR no_hp ILIKE '%' || $3 || '%')
		ORDER BY created_at DESC
		LIMIT 500
	`, tahun, status, cari)
	if err != nil {
		jsonError(w, "gagal mengambil daftar pendaftaran", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	// Non-nil supaya JSON-nya `[]`, bukan `null`.
	result := []pendaftaranRow{}
	for rows.Next() {
		p, err := scanPendaftaran(rows)
		if err != nil {
			jsonError(w, "gagal membaca daftar pendaftaran", http.StatusInternalServerError)
			return
		}
		result = append(result, p)
	}

	jsonOK(w, map[string]any{"data": result})
}

// Stats GET /api/ppdb/statistik — cacah per status, untuk kartu ringkasan panel.
func (h *PpdbHandler) Stats(w http.ResponseWriter, r *http.Request) {
	if !middleware.CanManage(middleware.RoleFromCtx(r.Context())) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}

	tahun := strings.TrimSpace(r.URL.Query().Get("tahun"))

	rows, err := h.db.Query(r.Context(), `
		SELECT status, count(*)
		FROM pendaftaran_ppdb
		WHERE ($1 = '' OR tahun_ajaran = $1)
		GROUP BY status
	`, tahun)
	if err != nil {
		jsonError(w, "gagal mengambil statistik pendaftaran", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	// Keempat status selalu ada di keluaran walau nol, supaya panel tidak perlu
	// menyiapkan nilai bawaannya sendiri.
	cacah := map[string]int{"baru": 0, "diverifikasi": 0, "diterima": 0, "ditolak": 0}
	total := 0
	for rows.Next() {
		var s string
		var n int
		if err := rows.Scan(&s, &n); err != nil {
			jsonError(w, "gagal membaca statistik pendaftaran", http.StatusInternalServerError)
			return
		}
		cacah[s] = n
		total += n
	}

	// Daftar tahun ajaran yang pernah menerima pendaftaran, untuk pemilih tahun.
	tahunRows, err := h.db.Query(r.Context(), `
		SELECT DISTINCT tahun_ajaran FROM pendaftaran_ppdb ORDER BY tahun_ajaran DESC
	`)
	if err != nil {
		jsonError(w, "gagal mengambil daftar tahun ajaran", http.StatusInternalServerError)
		return
	}
	defer tahunRows.Close()

	daftarTahun := []string{}
	for tahunRows.Next() {
		var t string
		if err := tahunRows.Scan(&t); err != nil {
			jsonError(w, "gagal membaca daftar tahun ajaran", http.StatusInternalServerError)
			return
		}
		daftarTahun = append(daftarTahun, t)
	}

	jsonOK(w, map[string]any{"data": map[string]any{
		"cacah":        cacah,
		"total":        total,
		"tahun_ajaran": daftarTahun,
	}})
}

// Get GET /api/ppdb/{id}
func (h *PpdbHandler) Get(w http.ResponseWriter, r *http.Request) {
	if !middleware.CanManage(middleware.RoleFromCtx(r.Context())) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}

	id := chi.URLParam(r, "id")
	p, err := scanPendaftaran(h.db.QueryRow(r.Context(),
		`SELECT `+pendaftaranKolom+` FROM pendaftaran_ppdb WHERE id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		jsonError(w, "pendaftaran tidak ditemukan", http.StatusNotFound)
		return
	}
	if err != nil {
		jsonError(w, "gagal mengambil pendaftaran", http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]any{"data": p})
}

// Update PUT /api/ppdb/{id} — muatan sebagian: hanya status dan catatan.
//
// Data calon murid TIDAK bisa diubah dari sini dengan sengaja: yang mengisinya
// orang tua, dan riwayat verifikasi kehilangan artinya bila isinya bisa disunting
// belakangan. Salah tulis diselesaikan lewat catatan, atau data dirapikan setelah
// murid resmi dicatat di Data Murid.
func (h *PpdbHandler) Update(w http.ResponseWriter, r *http.Request) {
	role := middleware.RoleFromCtx(r.Context())
	if !middleware.CanManage(role) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}

	var body struct {
		Status  *string `json:"status"`
		Catatan *string `json:"catatan"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	if body.Status == nil && body.Catatan == nil {
		jsonError(w, "tidak ada yang diubah", http.StatusBadRequest)
		return
	}
	if body.Status != nil && !statusSah[*body.Status] {
		jsonError(w, "status tidak dikenal", http.StatusBadRequest)
		return
	}

	id := chi.URLParam(r, "id")
	pelaku := middleware.UserIDFromCtx(r.Context())

	/* Pembaruan sebagian: COALESCE membuat field yang tidak dikirim tidak tersentuh,
	 * jadi mengubah catatan tidak ikut menimpa status dan sebaliknya.
	 *
	 * `diproses_oleh` dan `diproses_pada` hanya dicatat saat STATUS berubah — bukan
	 * saat catatan disunting — supaya jejaknya menjawab "siapa yang memutuskan",
	 * bukan "siapa yang terakhir mengetik". */
	p, err := scanPendaftaran(h.db.QueryRow(r.Context(), `
		UPDATE pendaftaran_ppdb SET
			status  = COALESCE($2, status),
			catatan = COALESCE($3, catatan),
			diproses_oleh = CASE WHEN $2 IS NOT NULL AND $2 <> status
			                     THEN NULLIF($4, '')::uuid ELSE diproses_oleh END,
			diproses_pada = CASE WHEN $2 IS NOT NULL AND $2 <> status
			                     THEN now() ELSE diproses_pada END
		WHERE id = $1
		RETURNING `+pendaftaranKolom,
		id, body.Status, body.Catatan, pelaku,
	))
	if errors.Is(err, pgx.ErrNoRows) {
		jsonError(w, "pendaftaran tidak ditemukan", http.StatusNotFound)
		return
	}
	if err != nil {
		jsonError(w, "gagal memperbarui pendaftaran", http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]any{"data": p})
}

// Delete DELETE /api/ppdb/{id} — hanya admin.
//
// Tata usaha boleh memverifikasi dan menolak, tapi tidak boleh menghilangkan
// jejaknya: pendaftaran yang ditolak tetap harus bisa ditunjukkan bila orang tua
// bertanya. Menolak dan menghapus adalah dua keputusan yang berbeda beratnya.
func (h *PpdbHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if !middleware.IsAdmin(middleware.RoleFromCtx(r.Context())) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}

	id := chi.URLParam(r, "id")
	tag, err := h.db.Exec(r.Context(), `DELETE FROM pendaftaran_ppdb WHERE id = $1`, id)
	if err != nil {
		jsonError(w, "gagal menghapus pendaftaran", http.StatusInternalServerError)
		return
	}
	if tag.RowsAffected() == 0 {
		jsonError(w, "pendaftaran tidak ditemukan", http.StatusNotFound)
		return
	}

	jsonOK(w, map[string]any{"data": map[string]string{"id": id}})
}
