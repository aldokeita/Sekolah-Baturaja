package handler

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
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

	// Publik: formulir pendaftaran, dan pemeriksaan status oleh orang tua.
	// Keduanya dibatasi laju — lihat batasiLaju.
	r.Post("/", h.Submit)
	r.Post("/cek", h.CekStatus)

	// Back-office: tata usaha, admin, superadmin. Dijaga CanManage di tiap handler.
	r.Get("/", h.List)
	r.Get("/statistik", h.Stats)
	// Sebelum /{id} supaya keduanya tidak dibaca sebagai id.
	r.Get("/usulan-nomor", h.UsulanNomorInduk)
	r.Post("/impor-pesan", h.ImporDariPesan)
	r.Get("/{id}", h.Get)
	r.Post("/{id}/murid", h.JadikanMurid)
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
	// Terisi bila pendaftaran ini sudah dicatat sebagai murid; panel memakainya
	// untuk mematikan tombol "Jadikan murid".
	SantriID  *string `json:"santri_id"`
	CreatedAt string  `json:"created_at"`
	UpdatedAt string  `json:"updated_at"`
}

// Daftar kolom dipakai bersama oleh List dan Get supaya keduanya tidak pernah
// berbeda urutan — pemindaian pgx berdasarkan posisi, bukan nama.
const pendaftaranKolom = `
	id, nomor_pendaftaran, tahun_ajaran, nama_lengkap, nisn, nik,
	tempat_lahir, tanggal_lahir::text, jenis_kelamin, alamat, no_hp, email,
	sekolah_asal, npsn_asal, usia_keterangan, jalur, jalur_label, minat,
	nama_ayah, nama_ibu, pekerjaan_orang_tua, no_hp_wali, berkas_siap,
	status, catatan, diproses_pada::text, santri_id, created_at::text, updated_at::text
`

func scanPendaftaran(row pgx.Row) (pendaftaranRow, error) {
	var p pendaftaranRow
	err := row.Scan(
		&p.ID, &p.NomorPendaftaran, &p.TahunAjaran, &p.NamaLengkap, &p.Nisn, &p.Nik,
		&p.TempatLahir, &p.TanggalLahir, &p.JenisKelamin, &p.Alamat, &p.NoHp, &p.Email,
		&p.SekolahAsal, &p.NpsnAsal, &p.UsiaKeterangan, &p.Jalur, &p.JalurLabel, &p.Minat,
		&p.NamaAyah, &p.NamaIbu, &p.PekerjaanOrangTua, &p.NoHpWali, &p.BerkasSiap,
		&p.Status, &p.Catatan, &p.DiprosesPada, &p.SantriID, &p.CreatedAt, &p.UpdatedAt,
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
// Pembatas laju
// ---------------------------------------------------------------------------

/* Kedua endpoint publik dibatasi lewat RPC `consume_auth_rate_limit` yang sudah
 * ada di basis data (20260624001500_rls_helper_functions.sql), BUKAN pencacah di
 * memori seperti loginlogs.go.
 *
 * Alasannya: pencacah di memori hilang setiap kali kontainer dimuat ulang dan
 * tidak berlaku lintas proses — catatan di loginlogs.go sendiri menyebut
 * "move to Postgres or Redis if the backend is ever scaled horizontally". RPC ini
 * memakai `select ... for update` jadi aman terhadap request bersamaan, dan
 * fungsinya sudah terpasang tanpa perlu tabel baru. Sebelumnya hanya dipanggil
 * edge function Deno yang sudah tidak dipakai.
 *
 * IP di-hash, tidak disimpan apa adanya: tabelnya menyimpan `ip_hash`, dan alamat
 * IP pengunjung adalah data pribadi yang tidak perlu kami pegang. */
func hashLaju(nilai string) string {
	sum := sha256.Sum256([]byte(nilai))
	return hex.EncodeToString(sum[:])
}

// Mengembalikan true bila request masih boleh diteruskan.
//
// Bila RPC-nya gagal (fungsinya belum ada, misalnya pada basis data yang belum
// dimigrasi penuh), request DIIZINKAN. Menolak pendaftaran karena pembatas lajunya
// sendiri rusak jauh lebih buruk daripada melewatkan satu pembatasan.
func (h *PpdbHandler) batasiLaju(ctx context.Context, tujuan, ip string, maks, jendela, blokir int) bool {
	if ip == "" {
		ip = "unknown"
	}
	var boleh bool
	err := h.db.QueryRow(ctx, `
		SELECT allowed FROM public.consume_auth_rate_limit($1, $2, $3, $4, $5, $6)
	`, tujuan, hashLaju(ip), hashLaju(tujuan), maks, jendela, blokir).Scan(&boleh)
	if err != nil {
		return true
	}
	return boleh
}

// ---------------------------------------------------------------------------
// Submit — publik
// ---------------------------------------------------------------------------

// Submit POST /api/ppdb (publik, tanpa auth)
func (h *PpdbHandler) Submit(w http.ResponseWriter, r *http.Request) {
	/* 12 pendaftaran per jam per IP, lalu diblokir 30 menit. Batasnya dilonggarkan
	 * dari nilai bawaan RPC (5) karena satu keluarga wajar mendaftarkan beberapa
	 * anak, dan satu warnet atau satu jaringan sekolah bisa dipakai banyak orang
	 * dalam sehari. Yang mau dicegah adalah pembanjiran skrip, bukan orang tua. */
	if !h.batasiLaju(r.Context(), "ppdb_submit", clientIP(r), 12, 3600, 1800) {
		jsonError(w, "terlalu banyak pendaftaran dari jaringan ini. Coba lagi setengah jam lagi, atau hubungi tata usaha sekolah.", http.StatusTooManyRequests)
		return
	}

	// Muatan dibatasi supaya kiriman raksasa tidak menghabiskan memori; formulir
	// terpanjang pun jauh di bawah 32 KB.
	r.Body = http.MaxBytesReader(w, r.Body, 32<<10)

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

	/* Tahun pembuka dipakai pada nomor: "SPMB-2026-0001" dari tahun ajaran
	 * "2026/2027". Bila isinya tidak memuat tahun, seluruh nilai dipakai apa adanya.
	 *
	 * Awalannya "SPMB", bukan "PPDB": Permendikdasmen No. 3 Tahun 2025 mencabut
	 * aturan PPDB dan menamainya SPMB. Nomor lama berawalan PPDB TIDAK diubah —
	 * orang tua sudah mencatatnya, dan pencarian di CekStatus membandingkan
	 * nomornya apa adanya, jadi keduanya tetap bisa diperiksa. */
	tahunNomor := tahun
	if len(tahun) >= 4 && angkaSaja.MatchString(tahun[:4]) {
		tahunNomor = tahun[:4]
	}
	nomor := fmt.Sprintf("SPMB-%s-%04d", tahunNomor, urut)

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
// Cek status — publik
// ---------------------------------------------------------------------------

/* CekStatus POST /api/ppdb/cek (publik, tanpa auth)
 *
 * Orang tua memasukkan nomor pendaftaran BESERTA tanggal lahir anaknya. Tanggal
 * lahir bukan hiasan: nomor pendaftaran berurutan dan mudah diterka, jadi tanpa
 * pasangan kedua siapa pun bisa menyisir PPDB-2026-0001 sampai 9999 dan memanen
 * nama seluruh pendaftar. Nomor saja tidak cukup untuk membuka data anak.
 *
 * Yang dikembalikan sengaja sedikit: nomor, nama, tahun ajaran, jalur, dan status.
 * TIDAK ada NIK, alamat, nomor telepon, maupun catatan verifikasi — catatan itu
 * tulisan internal petugas dan tidak ditulis untuk dibaca orang tua.
 */
func (h *PpdbHandler) CekStatus(w http.ResponseWriter, r *http.Request) {
	// Lebih ketat daripada Submit: menerka pasangan nomor + tanggal lahir menuntut
	// banyak percobaan, dan justru itu yang harus dibuat tidak sepadan.
	if !h.batasiLaju(r.Context(), "ppdb_cek", clientIP(r), 15, 900, 1800) {
		jsonError(w, "terlalu banyak percobaan. Coba lagi setengah jam lagi, atau hubungi tata usaha sekolah.", http.StatusTooManyRequests)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 2<<10)

	var body struct {
		Nomor        string `json:"nomor_pendaftaran"`
		TanggalLahir string `json:"tanggal_lahir"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}

	nomor := strings.ToUpper(strings.TrimSpace(body.Nomor))
	lahir := strings.TrimSpace(body.TanggalLahir)
	if nomor == "" || lahir == "" {
		jsonError(w, "nomor pendaftaran dan tanggal lahir wajib diisi", http.StatusBadRequest)
		return
	}
	if _, err := time.Parse("2006-01-02", lahir); err != nil {
		jsonError(w, "tanggal lahir tidak terbaca", http.StatusBadRequest)
		return
	}

	var (
		namaLengkap string
		tahunAjaran string
		status      string
		jalurLabel  *string
		sudahMurid  bool
	)
	err := h.db.QueryRow(r.Context(), `
		SELECT nama_lengkap, tahun_ajaran, status, jalur_label, santri_id IS NOT NULL
		FROM pendaftaran_ppdb
		WHERE upper(nomor_pendaftaran) = $1 AND tanggal_lahir = $2::date
		LIMIT 1
	`, nomor, lahir).Scan(&namaLengkap, &tahunAjaran, &status, &jalurLabel, &sudahMurid)
	if errors.Is(err, pgx.ErrNoRows) {
		/* Satu pesan untuk "nomor tidak ada" dan "tanggal lahir tidak cocok".
		 * Membedakan keduanya akan memberi tahu penyisir bahwa nomornya benar dan
		 * hanya tanggalnya yang perlu ditebak — 365 tebakan alih-alih tak terhingga. */
		jsonError(w, "pendaftaran tidak ditemukan. Periksa kembali nomor pendaftaran dan tanggal lahirnya.", http.StatusNotFound)
		return
	}
	if err != nil {
		jsonError(w, "gagal memeriksa pendaftaran", http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]any{"data": map[string]any{
		"nomor_pendaftaran": nomor,
		"nama_lengkap":      namaLengkap,
		"tahun_ajaran":      tahunAjaran,
		"jalur_label":       jalurLabel,
		"status":            status,
		"sudah_jadi_murid":  sudahMurid,
	}})
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

	/* Berapa yang sudah DITERIMA per jalur. Panel membandingkannya dengan kuota
	 * persentase di `ppdb_content` supaya tata usaha melihat sisa kursi tiap jalur.
	 *
	 * Dikelompokkan berdasarkan `jalur` (id), bukan `jalur_label`: labelnya boleh
	 * berubah kapan saja saat pembeli menyunting daftar jalur, dan pengelompokan
	 * berdasarkan teks yang bisa berubah akan memecah satu jalur menjadi dua. */
	jalurRows, err := h.db.Query(r.Context(), `
		SELECT coalesce(jalur, ''), count(*)
		FROM pendaftaran_ppdb
		WHERE ($1 = '' OR tahun_ajaran = $1) AND status = 'diterima'
		GROUP BY coalesce(jalur, '')
	`, tahun)
	if err != nil {
		jsonError(w, "gagal menghitung penerimaan per jalur", http.StatusInternalServerError)
		return
	}
	defer jalurRows.Close()

	diterimaJalur := map[string]int{}
	for jalurRows.Next() {
		var j string
		var n int
		if err := jalurRows.Scan(&j, &n); err != nil {
			jsonError(w, "gagal membaca penerimaan per jalur", http.StatusInternalServerError)
			return
		}
		diterimaJalur[j] = n
	}

	/* Daya tampung = jumlah kapasitas seluruh kelas AKTIF. Kelas tanpa kapasitas
	 * dihitung nol, dan `dayaTampung` nol berarti pembeli belum mengisinya —
	 * panel menampilkan ajakan mengisinya alih-alih membagi dengan nol. */
	var dayaTampung int
	if err := h.db.QueryRow(r.Context(), `
		SELECT coalesce(sum(coalesce(kapasitas, 0)), 0)
		FROM classes
		WHERE is_active = true AND deleted_at IS NULL
	`).Scan(&dayaTampung); err != nil {
		jsonError(w, "gagal menghitung daya tampung", http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]any{"data": map[string]any{
		"cacah":          cacah,
		"total":          total,
		"tahun_ajaran":   daftarTahun,
		"diterima_jalur": diterimaJalur,
		"daya_tampung":   dayaTampung,
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

// ---------------------------------------------------------------------------
// Diterima → Data Murid
// ---------------------------------------------------------------------------

// UsulanNomorInduk GET /api/ppdb/usulan-nomor?tahun=2026/2027
//
// Mengusulkan nomor induk berikutnya yang belum terpakai, berbentuk tahun pembuka
// diikuti tiga angka: `2026001`, `2026002`, … mengikuti pola data contoh
// (`2026041`). Petugas tetap bisa menggantinya; ini hanya menghemat pengetikan dan
// mencegah tabrakan yang paling sering.
//
// Ini USULAN, bukan jaminan. Penjaga sebenarnya indeks unik
// `santri_nomor_induk_qiroati_unique`; dua petugas yang membuka dialog pada detik
// yang sama akan menerima usulan yang sama, dan yang kedua ditolak basis data.
func (h *PpdbHandler) UsulanNomorInduk(w http.ResponseWriter, r *http.Request) {
	if !middleware.CanManage(middleware.RoleFromCtx(r.Context())) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}

	tahun := strings.TrimSpace(r.URL.Query().Get("tahun"))
	prefiks := tahun
	if len(tahun) >= 4 && angkaSaja.MatchString(tahun[:4]) {
		prefiks = tahun[:4]
	}
	if !angkaSaja.MatchString(prefiks) {
		jsonError(w, "tahun ajaran tidak terbaca", http.StatusBadRequest)
		return
	}

	/* Mengambil angka terbesar di antara nomor induk yang berawalan tahun ini.
	 * Baris yang sisanya bukan angka diabaikan lewat penyaring `~` — data contoh
	 * lama memakai bentuk seperti `AFMLOCAL-ANAK-A01` dan tidak boleh membuat
	 * konversi ini gagal. */
	var terpakai *int
	err := h.db.QueryRow(r.Context(), `
		SELECT max(substring(nomor_induk_qiroati from '^' || $1 || '(\d+)$')::int)
		FROM santri
		WHERE nomor_induk_qiroati ~ ('^' || $1 || '\d+$')
	`, prefiks).Scan(&terpakai)
	if err != nil {
		jsonError(w, "gagal menghitung nomor induk", http.StatusInternalServerError)
		return
	}

	berikut := 1
	if terpakai != nil {
		berikut = *terpakai + 1
	}

	jsonOK(w, map[string]any{"data": map[string]any{
		"nomor_induk": fmt.Sprintf("%s%03d", prefiks, berikut),
	}})
}

// ---------------------------------------------------------------------------
// Impor pendaftaran lama dari Pesan Masuk
// ---------------------------------------------------------------------------

/* Sebelum modul ini ada, formulir pendaftaran meratakan seluruh isiannya menjadi
 * satu paragraf lalu mengirimkannya ke endpoint pesan pengunjung, dengan penanda
 * "[Pendaftaran PPDB 2026/2027]" di baris pertama dan sisanya berbentuk
 * "Label: nilai" per baris.
 *
 * Impor ini MENGURAI TEKS BEBAS, dan itu tidak bisa dijamin benar seratus persen —
 * itu sebabnya migrasinya sengaja tidak melakukannya. Tiga hal yang membuatnya
 * aman untuk dijalankan:
 *
 *   1. Barisnya TIDAK dihapus dari `feedbacks`. Asli tetap ada sebagai pembanding,
 *      jadi salah urai bisa selalu diperiksa ulang.
 *   2. Yang gagal diurai dilewati beserta ALASANNYA, bukan disimpan setengah jadi.
 *   3. Bisa dijalankan berulang: pendaftaran yang sudah ada dikenali dari nama +
 *      tanggal lahir dan tidak digandakan.
 *
 * Nomor pendaftarannya berawalan "LAMA-" supaya jelas bahwa nomor itu dibuat saat
 * impor dan bukan nomor yang pernah dibacakan ke orang tua — nomor aslinya
 * memang tidak pernah ada, karena penomoran belum diterapkan waktu itu. */

var penandaPesan = regexp.MustCompile(`^\s*\[Pendaftaran (?:PPDB|SPMB)\s*([^\]]*)\]`)

// Mengambil nilai dari baris "Label: nilai". Label dicocokkan tanpa peduli huruf
// besar-kecil, dan "—" (nilai kosong pada format lama) dianggap tidak ada.
func nilaiBaris(pesan, label string) string {
	for _, baris := range strings.Split(pesan, "\n") {
		potong := strings.SplitN(baris, ":", 2)
		if len(potong) != 2 {
			continue
		}
		if !strings.EqualFold(strings.TrimSpace(potong[0]), label) {
			continue
		}
		nilai := strings.TrimSpace(potong[1])
		if nilai == "—" || nilai == "-" {
			return ""
		}
		return nilai
	}
	return ""
}

// ImporDariPesan POST /api/ppdb/impor-pesan — hanya admin.
func (h *PpdbHandler) ImporDariPesan(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	// Hanya admin: ini menulis banyak baris sekaligus berdasarkan penguraian teks,
	// dan kalau hasilnya keliru yang membereskannya juga admin.
	if !middleware.IsAdmin(middleware.RoleFromCtx(ctx)) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}

	var body struct {
		// Bila true, hanya melaporkan apa yang AKAN terjadi tanpa menyimpan.
		Simulasi bool `json:"simulasi"`
	}
	// Muatan boleh kosong; bawaannya menyimpan sungguhan.
	_ = json.NewDecoder(r.Body).Decode(&body)

	rows, err := h.db.Query(ctx, `
		SELECT id, coalesce(nama, ''), coalesce(email, ''), coalesce(phone, ''), message, created_at::text
		FROM feedbacks
		WHERE message LIKE '[Pendaftaran PPDB%' OR message LIKE '[Pendaftaran SPMB%'
		ORDER BY created_at
	`)
	if err != nil {
		jsonError(w, "gagal membaca pesan masuk", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type pesanLama struct {
		id, nama, email, phone, message, createdAt string
	}
	var kandidat []pesanLama
	for rows.Next() {
		var p pesanLama
		if err := rows.Scan(&p.id, &p.nama, &p.email, &p.phone, &p.message, &p.createdAt); err != nil {
			jsonError(w, "gagal membaca pesan masuk", http.StatusInternalServerError)
			return
		}
		kandidat = append(kandidat, p)
	}
	rows.Close()

	diimpor := []map[string]any{}
	dilewati := []map[string]any{}

	for _, p := range kandidat {
		lewati := func(alasan string) {
			dilewati = append(dilewati, map[string]any{
				"feedback_id": p.id,
				"nama":        p.nama,
				"alasan":      alasan,
			})
		}

		cocok := penandaPesan.FindStringSubmatch(p.message)
		tahun := ""
		if cocok != nil {
			tahun = strings.TrimSpace(cocok[1])
		}
		if tahun == "" {
			lewati("tahun ajaran tidak terbaca pada penanda pesan")
			continue
		}

		nama := nilaiBaris(p.message, "Nama")
		if nama == "" {
			nama = strings.TrimSpace(p.nama)
		}
		if len([]rune(nama)) < 3 || strings.EqualFold(nama, "Pendaftar PPDB") {
			lewati("nama calon murid tidak terbaca")
			continue
		}

		/* Tanggal lahir ada di dalam baris "TTL: <tempat>, <tanggal>". Tanpa
		 * tanggal lahir, pendaftaran tidak bisa dicek statusnya oleh orang tua dan
		 * tidak bisa dibedakan dari anak bernama sama — jadi barisnya dilewati
		 * alih-alih disimpan tanpa tanggal. */
		ttl := nilaiBaris(p.message, "TTL")
		tempat, lahir := "", ""
		if idx := strings.LastIndex(ttl, ","); idx >= 0 {
			tempat = strings.TrimSpace(ttl[:idx])
			lahir = strings.TrimSpace(ttl[idx+1:])
		}
		if _, err := time.Parse("2006-01-02", lahir); err != nil {
			lewati("tanggal lahir tidak terbaca dari baris TTL")
			continue
		}

		hp := rapikanHp(nilaiBaris(p.message, "WhatsApp"))
		if hp == "" {
			hp = rapikanHp(p.phone)
		}
		if hp == "" {
			lewati("nomor WhatsApp tidak terbaca")
			continue
		}

		// Sudah pernah diimpor atau sudah didaftarkan ulang lewat formulir baru.
		var ada string
		err := h.db.QueryRow(ctx, `
			SELECT nomor_pendaftaran FROM pendaftaran_ppdb
			WHERE tahun_ajaran = $1 AND lower(nama_lengkap) = lower($2) AND tanggal_lahir = $3::date
			LIMIT 1
		`, tahun, nama, lahir).Scan(&ada)
		if err == nil {
			lewati("sudah ada sebagai " + ada)
			continue
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			lewati("gagal memeriksa duplikat")
			continue
		}

		jenisKelamin := ""
		switch strings.ToLower(nilaiBaris(p.message, "Jenis kelamin")) {
		case "laki-laki":
			jenisKelamin = "L"
		case "perempuan":
			jenisKelamin = "P"
		}

		// "Asal TK/RA: TK Melati (NPSN 12345678)" — NPSN-nya dipisah dari namanya.
		asal := nilaiBaris(p.message, "Asal TK/RA")
		npsn := ""
		if idx := strings.Index(asal, "(NPSN"); idx >= 0 {
			npsn = strings.Trim(strings.TrimSpace(strings.TrimPrefix(asal[idx:], "(NPSN")), ")")
			npsn = strings.TrimSpace(npsn)
			asal = strings.TrimSpace(asal[:idx])
		}
		if !angkaSaja.MatchString(npsn) || len(npsn) != 8 {
			npsn = ""
		}

		nisn := nilaiBaris(p.message, "NISN")
		if !angkaSaja.MatchString(nisn) || len(nisn) != 10 {
			nisn = ""
		}
		nik := nilaiBaris(p.message, "NIK")
		if !angkaSaja.MatchString(nik) || len(nik) != 16 {
			nik = ""
		}

		/* Empat data orang tua ditulis dalam SATU baris, dipisah titik tengah:
		 * "Ayah: A · Ibu: B · Pekerjaan: C · HP wali: D"
		 *
		 * Barisnya harus dipisah dulu, baru dipecah per titik tengah. Memecah
		 * SELURUH pesan per titik tengah tidak bisa: bagian pertamanya lalu memuat
		 * semua baris sebelumnya, sehingga "Ayah" hilang karena titik dua pertama
		 * ada di baris lain — dan bagian terakhirnya menelan baris SESUDAHNYA,
		 * sehingga "HP wali" menyerap angka dari "Berkas terunggah: 3 dari 4" dan
		 * menghasilkan nomor 14 digit. Keduanya benar-benar terjadi saat diuji. */
		var ayah, ibu, kerja, hpWali string
		for _, baris := range strings.Split(p.message, "\n") {
			if !strings.Contains(baris, "·") {
				continue
			}
			for _, bagian := range strings.Split(baris, "·") {
				isi := strings.SplitN(bagian, ":", 2)
				if len(isi) != 2 {
					continue
				}
				nilai := strings.TrimSpace(isi[1])
				if nilai == "—" || nilai == "-" {
					nilai = ""
				}
				switch strings.ToLower(strings.TrimSpace(isi[0])) {
				case "ayah":
					ayah = nilai
				case "ibu":
					ibu = nilai
				case "pekerjaan":
					kerja = nilai
				case "hp wali":
					hpWali = nilai
				}
			}
			break
		}
		if ayah == "" && ibu == "" {
			lewati("nama ayah dan ibu keduanya tidak terbaca")
			continue
		}

		if body.Simulasi {
			diimpor = append(diimpor, map[string]any{
				"feedback_id": p.id, "nama": nama, "tahun_ajaran": tahun, "tanggal_lahir": lahir,
			})
			continue
		}

		// Nomor impor memakai stempel waktu pesan aslinya supaya urutannya masih
		// mengikuti kapan orang tua benar-benar mendaftar.
		var urut int
		if err := h.db.QueryRow(ctx, `
			INSERT INTO ppdb_nomor_urut (tahun_ajaran, urut) VALUES ($1, 1)
			ON CONFLICT (tahun_ajaran) DO UPDATE SET urut = ppdb_nomor_urut.urut + 1
			RETURNING urut
		`, tahun).Scan(&urut); err != nil {
			lewati("gagal membuat nomor pendaftaran")
			continue
		}
		tahunNomor := tahun
		if len(tahun) >= 4 && angkaSaja.MatchString(tahun[:4]) {
			tahunNomor = tahun[:4]
		}
		nomor := fmt.Sprintf("LAMA-%s-%04d", tahunNomor, urut)

		var baruID string
		err = h.db.QueryRow(ctx, `
			INSERT INTO pendaftaran_ppdb (
				nomor_pendaftaran, tahun_ajaran, nama_lengkap, nisn, nik,
				tempat_lahir, tanggal_lahir, jenis_kelamin, alamat, no_hp, email,
				sekolah_asal, npsn_asal, usia_keterangan, jalur_label, minat,
				nama_ayah, nama_ibu, pekerjaan_orang_tua, no_hp_wali, catatan, created_at
			) VALUES (
				$1,$2,$3,$4,$5,$6,$7::date,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22::timestamptz
			) RETURNING id
		`,
			nomor, tahun, nama, opsional(nisn), opsional(nik),
			opsional(tempat), lahir, opsional(jenisKelamin), opsional(nilaiBaris(p.message, "Alamat")),
			hp, opsional(p.email),
			opsional(asal), opsional(npsn), opsional(nilaiBaris(p.message, "Usia per 1 Juli "+tahunNomor)),
			opsional(nilaiBaris(p.message, "Jalur")), opsional(nilaiBaris(p.message, "Program pendukung")),
			opsional(ayah), opsional(ibu), opsional(kerja), opsional(rapikanHp(hpWali)),
			opsional("Diimpor dari Pesan Masuk. Pesan aslinya masih tersimpan di sana."),
			p.createdAt,
		).Scan(&baruID)
		if err != nil {
			if strings.Contains(err.Error(), "pendaftaran_ppdb_nisn_unik") {
				lewati("NISN sudah dipakai pendaftaran lain")
				continue
			}
			lewati("gagal menyimpan: " + err.Error())
			continue
		}

		diimpor = append(diimpor, map[string]any{
			"id": baruID, "nomor_pendaftaran": nomor, "nama": nama, "feedback_id": p.id,
		})
	}

	jsonOK(w, map[string]any{"data": map[string]any{
		"simulasi":  body.Simulasi,
		"ditemukan": len(kandidat),
		"diimpor":   diimpor,
		"dilewati":  dilewati,
	}})
}

// JadikanMurid POST /api/ppdb/{id}/murid
//
// Membuat baris murid dari sebuah pendaftaran, menempatkannya di kelas, lalu
// menautkan keduanya — seluruhnya dalam SATU transaksi.
//
// Kenapa satu transaksi dan bukan tiga panggilan dari browser seperti yang
// dilakukan panel Data Murid: bila penempatan kelas gagal setelah muridnya dibuat,
// hasilnya murid tanpa kelas yang pendaftarannya tetap tampak "belum jadi murid" —
// dan menekan tombolnya lagi akan membuat murid kedua. Di sini kegagalan apa pun
// membatalkan semuanya.
//
// Pembuatan akunnya memakai `insertSantriTx`, fungsi yang sama dipakai
// POST /api/santri, supaya murid dari PPDB tidak berbeda sedikit pun dari murid
// yang diketik tangan: baris `auth.users`, `user_profiles`, dan `santri` sekaligus,
// dengan sandi awal dari NISN.
func (h *PpdbHandler) JadikanMurid(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !middleware.CanManage(middleware.RoleFromCtx(ctx)) {
		jsonError(w, "forbidden", http.StatusForbidden)
		return
	}

	var body struct {
		NomorInduk string `json:"nomor_induk"`
		ClassID     string `json:"class_id"`
		Angkatan    string `json:"angkatan"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	nomorInduk := strings.TrimSpace(body.NomorInduk)
	if nomorInduk == "" {
		jsonError(w, "nomor induk wajib diisi", http.StatusBadRequest)
		return
	}
	if strings.ContainsAny(nomorInduk, " \t\n") {
		jsonError(w, "nomor induk tidak boleh memuat spasi", http.StatusBadRequest)
		return
	}

	id := chi.URLParam(r, "id")

	tx, err := h.db.Begin(ctx)
	if err != nil {
		jsonError(w, "gagal memulai transaksi", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	/* Barisnya dikunci (`FOR UPDATE`) supaya dua petugas yang menekan tombol
	 * bersamaan tidak sama-sama lolos pemeriksaan "belum jadi murid" dan membuat
	 * dua murid untuk satu anak. Yang kedua menunggu, lalu melihat santri_id sudah
	 * terisi dan ditolak. */
	var p pendaftaranRow
	p, err = scanPendaftaran(tx.QueryRow(ctx,
		`SELECT `+pendaftaranKolom+` FROM pendaftaran_ppdb WHERE id = $1 FOR UPDATE`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		jsonError(w, "pendaftaran tidak ditemukan", http.StatusNotFound)
		return
	}
	if err != nil {
		jsonError(w, "gagal membaca pendaftaran", http.StatusInternalServerError)
		return
	}
	if p.SantriID != nil {
		jsonError(w, "pendaftaran ini sudah dicatat sebagai murid", http.StatusConflict)
		return
	}
	// Hanya yang sudah diterima. Mencatat pendaftar yang belum diputuskan sebagai
	// murid mendahului keputusan seleksi.
	if p.Status != "diterima" {
		jsonError(w, "hanya pendaftaran berstatus Diterima yang bisa dijadikan murid", http.StatusBadRequest)
		return
	}

	angkatan := strings.TrimSpace(body.Angkatan)
	if angkatan == "" {
		angkatan = p.TahunAjaran
	}
	// Kolom `santri.angkatan` menuntut bentuk YYYY/YYYY; tahun ajaran sudah
	// berbentuk itu, tapi pembeli boleh menulisnya bebas di Info Sekolah.
	if !regexp.MustCompile(`^\d{4}/\d{4}$`).MatchString(angkatan) {
		angkatan = ""
	}

	// Bentuk muatannya mengikuti pickSantriProfileFields di dataMasterAdapters.js.
	profil := map[string]any{
		"nomor_induk_qiroati": nomorInduk,
		"nama_lengkap":        p.NamaLengkap,
		"kategori":            "Anak",
		"status":              "Aktif",
		"points":              0,
	}
	// Field opsional hanya dikirim bila ada isinya, supaya tidak menimpa kolom
	// dengan string kosong yang bisa melanggar CHECK format (NISN, misalnya).
	tetapkan := func(kolom string, nilai *string) {
		if nilai != nil && strings.TrimSpace(*nilai) != "" {
			profil[kolom] = strings.TrimSpace(*nilai)
		}
	}
	tetapkan("nisn", p.Nisn)
	tetapkan("no_nik", p.Nik)
	tetapkan("tempat_lahir", p.TempatLahir)
	tetapkan("tanggal_lahir", p.TanggalLahir)
	tetapkan("alamat", p.Alamat)
	tetapkan("nama_ayah", p.NamaAyah)
	tetapkan("nama_ibu", p.NamaIbu)
	tetapkan("pekerjaan_ayah", p.PekerjaanOrangTua)
	tetapkan("pekerjaan_ibu", p.PekerjaanOrangTua)
	tetapkan("email", p.Email)
	if angkatan != "" {
		profil["angkatan"] = angkatan
	}
	// Nomor orang tua: nomor wali dipakai bila ada, kalau tidak nomor pendaftar.
	if p.NoHpWali != nil && strings.TrimSpace(*p.NoHpWali) != "" {
		profil["no_hp_ortu"] = strings.TrimSpace(*p.NoHpWali)
	} else {
		profil["no_hp_ortu"] = p.NoHp
	}
	if p.JenisKelamin != nil {
		// Kolom santri menyimpan kata penuh, formulir PPDB menyimpan satu huruf.
		if *p.JenisKelamin == "L" {
			profil["jenis_kelamin"] = "Laki-laki"
		} else if *p.JenisKelamin == "P" {
			profil["jenis_kelamin"] = "Perempuan"
		}
	}
	// Tanggal pendaftaran = tanggal formulirnya masuk, bukan hari ini.
	if len(p.CreatedAt) >= 10 {
		profil["tanggal_pendaftaran"] = p.CreatedAt[:10]
	}
	// Kesiapan berkas yang dinyatakan orang tua ikut terbawa.
	for kunci, kolom := range map[string]string{"kk": "berkas_kk", "akta": "berkas_akta", "foto": "berkas_foto"} {
		if siap, ok := p.BerkasSiap[kunci].(bool); ok && siap {
			profil[kolom] = true
		}
	}

	murid, err := insertSantriTx(ctx, tx, profil)
	if err != nil {
		pesan := err.Error()
		if strings.Contains(pesan, "santri_nomor_induk_qiroati_unique") {
			jsonError(w, "nomor induk "+nomorInduk+" sudah dipakai murid lain. Ganti nomornya.", http.StatusConflict)
			return
		}
		if strings.Contains(pesan, "santri_nisn_unique_idx") {
			jsonError(w, "NISN pendaftar ini sudah tercatat pada murid lain.", http.StatusConflict)
			return
		}
		jsonError(w, "gagal membuat murid: "+pesan, http.StatusBadRequest)
		return
	}

	muridID, _ := murid["id"].(string)
	if muridID == "" {
		jsonError(w, "gagal membaca id murid baru", http.StatusInternalServerError)
		return
	}

	// Penempatan kelas mengikuti alur MoveClass di santri.go: mutasinya dicatat,
	// bukan hanya kolomnya diperbarui — supaya riwayat kelas murid utuh sejak awal.
	if strings.TrimSpace(body.ClassID) != "" {
		pelaku := middleware.UserIDFromCtx(ctx)
		var pelakuArg any
		if pelaku != "" {
			pelakuArg = pelaku
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO class_mutations (santri_id, from_class_id, to_class_id, reason, created_by, mutation_date)
			VALUES ($1, NULL, $2, $3, $4, now())
		`, muridID, body.ClassID, "Penerimaan PPDB "+p.NomorPendaftaran, pelakuArg); err != nil {
			jsonError(w, "gagal mencatat mutasi kelas", http.StatusInternalServerError)
			return
		}
		if _, err := tx.Exec(ctx,
			`UPDATE santri SET current_class_id = $1 WHERE id = $2`, body.ClassID, muridID); err != nil {
			jsonError(w, "gagal menempatkan kelas", http.StatusInternalServerError)
			return
		}
	}

	if _, err := tx.Exec(ctx,
		`UPDATE pendaftaran_ppdb SET santri_id = $1 WHERE id = $2`, muridID, id); err != nil {
		jsonError(w, "gagal menautkan pendaftaran ke murid", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		jsonError(w, "gagal menyimpan murid baru", http.StatusInternalServerError)
		return
	}

	jsonCreated(w, map[string]any{
		"santri_id":   muridID,
		"nomor_induk": nomorInduk,
		"nama":        p.NamaLengkap,
	})
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
