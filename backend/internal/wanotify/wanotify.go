// Package wanotify mengirim notifikasi WhatsApp otomatis lewat gateway
// eksternal yang kompatibel dengan API Fonnte (POST target+message dengan
// header Authorization berisi token perangkat).
//
// Alur kerjanya pola outbox: aksi bisnis (absensi tercatat, pembayaran masuk,
// status PPDB berubah) hanya MENULIS baris pending ke tabel wa_outbox, lalu
// pekerja latar belakang di sini yang benar-benar mengirim dan mencatat hasil.
// Dengan begitu gateway yang mati atau lambat tidak pernah menggagalkan aksi
// utama sekolah, dan setiap pesan punya jejak yang bisa dilihat serta diulang.
//
// Konfigurasi:
//   - Token & URL gateway dari environment: WA_GATEWAY_TOKEN, WA_GATEWAY_URL.
//     Token sengaja TIDAK disimpan di database agar tidak ikut terekspos ke
//     jalur pembaca konfigurasi mana pun. Tanpa token, seluruh fitur diam.
//   - Saklar per kejadian dan template pesan dapat dioverride admin lewat kunci
//     `wa_notify_config` pada website_content (PUT /api/config/wa_notify_config).
package wanotify

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	configKey        = "wa_notify_config"
	defaultGatewayURL = "https://api.fonnte.com/send"
	maxAttempts      = 5
	sendTimeout      = 15 * time.Second
	pollInterval     = 5 * time.Second
	batchSize        = 20
)

// Nama bulan Indonesia untuk placeholder {{bulan}} pada kwitansi.
var namaBulan = [13]string{"", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
	"Juli", "Agustus", "September", "Oktober", "November", "Desember"}

// Template bawaan. Admin dapat menimpa lewat wa_notify_config.templates.
const (
	tplAbsensi = "Assalamualaikum. Kami informasikan bahwa ananda *{{nama}}* tercatat *{{status}}* pada {{tanggal}}{{sesi}} di {{sekolah}}. Terima kasih atas perhatiannya."
	tplPembayaran = "Terima kasih, pembayaran ananda *{{nama}}* untuk {{bulan}} {{tahun}} sebesar *{{jumlah}}* melalui {{metode}} telah tercatat di {{sekolah}}."
	tplPPDBDiterima = "Selamat! Pendaftaran ananda *{{nama}}* dengan nomor pendaftaran *{{nomor_pendaftaran}}* di {{sekolah}} telah *DITERIMA*. Informasi teknis daftar ulang akan disampaikan menyusul."
	tplPPDBDitolak  = "Mohon maaf, pendaftaran ananda *{{nama}}* dengan nomor pendaftaran *{{nomor_pendaftaran}}* di {{sekolah}} belum dapat kami terima pada gelombang ini. Salam hangat."
)

type eventFlags struct {
	Absensi    bool
	Pembayaran bool
	PPDB       bool
}

type Config struct {
	Enabled   eventFlags
	Templates map[string]string
}

func defaultConfig() Config {
	return Config{
		Enabled: eventFlags{Absensi: true, Pembayaran: true, PPDB: true},
		Templates: map[string]string{
			"absensi":        tplAbsensi,
			"pembayaran":     tplPembayaran,
			"ppdb_diterima":  tplPPDBDiterima,
			"ppdb_ditolak":   tplPPDBDitolak,
		},
	}
}

// LoadConfig membaca override admin dari website_content. Kunci tidak ada atau
// JSON rusak bukan kegagalan: nilai bawaan dipakai, karena notifikasi boleh
// jalan tanpa konfigurasi apa pun.
func LoadConfig(ctx context.Context, db *pgxpool.Pool) Config {
	cfg := defaultConfig()
	var raw []byte
	if err := db.QueryRow(ctx,
		`SELECT content FROM website_content WHERE key = $1`, configKey,
	).Scan(&raw); err != nil {
		return cfg
	}

	var over struct {
		Enabled *struct {
			Absensi    *bool `json:"absensi"`
			Pembayaran *bool `json:"pembayaran"`
			PPDB       *bool `json:"ppdb"`
		} `json:"enabled"`
		Templates map[string]string `json:"templates"`
	}
	if err := json.Unmarshal(raw, &over); err != nil {
		log.Printf("wanotify: wa_notify_config tidak valid, pakai bawaan: %v", err)
		return cfg
	}
	if over.Enabled != nil {
		if over.Enabled.Absensi != nil {
			cfg.Enabled.Absensi = *over.Enabled.Absensi
		}
		if over.Enabled.Pembayaran != nil {
			cfg.Enabled.Pembayaran = *over.Enabled.Pembayaran
		}
		if over.Enabled.PPDB != nil {
			cfg.Enabled.PPDB = *over.Enabled.PPDB
		}
	}
	for k, v := range over.Templates {
		if strings.TrimSpace(v) != "" {
			cfg.Templates[k] = v
		}
	}
	return cfg
}

func (c Config) enabledFor(purpose string) bool {
	switch purpose {
	case "absensi":
		return c.Enabled.Absensi
	case "pembayaran":
		return c.Enabled.Pembayaran
	case "ppdb":
		return c.Enabled.PPDB
	default:
		return true // test & broadcast selalu diizinkan
	}
}

func render(tpl string, vars map[string]string) string {
	pairs := make([]string, 0, len(vars)*2)
	for k, v := range vars {
		pairs = append(pairs, "{{"+k+"}}", v)
	}
	return strings.NewReplacer(pairs...).Replace(tpl)
}

// Entry adalah satu pesan keluar siap antre.
type Entry struct {
	Purpose     string // absensi | pembayaran | ppdb | test | broadcast
	RefID       string // kunci dedup bersama Purpose
	SantriID    *string
	TargetPhone string
	Message     string
	CreatedBy   *string
}

func Enqueue(ctx context.Context, db *pgxpool.Pool, e Entry) error {
	_, err := db.Exec(ctx, `
		INSERT INTO wa_outbox (purpose, ref_id, santri_id, target_phone, message, created_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (purpose, ref_id) DO NOTHING
	`, e.Purpose, e.RefID, e.SantriID, e.TargetPhone, e.Message, e.CreatedBy)
	return err
}

// ---------------------------------------------------------------------------
// Klien gateway
// ---------------------------------------------------------------------------

type Client struct {
	baseURL string
	token   string
	http    *http.Client
}

func NewClient(baseURL, token string) *Client {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = defaultGatewayURL
	}
	return &Client{
		baseURL: strings.TrimSpace(baseURL),
		token:   strings.TrimSpace(token),
		http:    &http.Client{Timeout: sendTimeout},
	}
}

func (c *Client) Enabled() bool { return c != nil && c.token != "" }

// Send mengirim satu pesan. Respons Fonnte berbentuk {"status":true|false};
// status bisa datang sebagai boolean maupun string, jadi dibaca longgar.
func (c *Client) Send(ctx context.Context, target, message string) error {
	form := url.Values{"target": {target}, "message": {message}}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL, strings.NewReader(form.Encode()))
	if err != nil {
		return fmt.Errorf("siap permintaan: %w", err)
	}
	req.Header.Set("Authorization", c.token)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("gateway tidak merespons: %w", err)
	}
	defer resp.Body.Close()

	var body struct {
		Status any    `json:"status"`
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil && resp.StatusCode != http.StatusOK {
		return fmt.Errorf("gateway HTTP %d", resp.StatusCode)
	}
	flattened := strings.ToLower(fmt.Sprintf("%v", body.Status))
	if resp.StatusCode != http.StatusOK || (body.Status != nil && flattened != "true") {
		reason := body.Reason
		if reason == "" {
			reason = fmt.Sprintf("HTTP %d", resp.StatusCode)
		}
		return fmt.Errorf("gateway menolak: %s", reason)
	}
	return nil
}

// ---------------------------------------------------------------------------
// Pekerja latar belakang
// ---------------------------------------------------------------------------

// StartWorker menjalankan pengirim outbox sampai ctx dibatalkan. Tanpa token
// gateway pekerja tidak pernah dinyalakan — pemanggil di main.go sudah
// memeriksa Enabled() lebih dulu, penjagaan ini lapis kedua.
func StartWorker(ctx context.Context, db *pgxpool.Pool, c *Client) {
	if !c.Enabled() {
		return
	}
	go func() {
		ticker := time.NewTicker(pollInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				processBatch(ctx, db, c)
			}
		}
	}()
}

func processBatch(ctx context.Context, db *pgxpool.Pool, c *Client) {
	for i := 0; i < batchSize; i++ {
		if !claimAndSendOne(ctx, db, c) {
			return
		}
	}
}

// claimAndSendOne mengambil satu baris pending dengan FOR UPDATE SKIP LOCKED
// (aman dipanggil beberapa replika sekaligus), menaikkan attempts, mengirim,
// lalu memfinalisasi statusnya. Mengembalikan false saat antrean kosong.
func claimAndSendOne(ctx context.Context, db *pgxpool.Pool, c *Client) bool {
	tx, err := db.Begin(ctx)
	if err != nil {
		log.Printf("wanotify: buka transaksi gagal: %v", err)
		return false
	}
	defer tx.Rollback(ctx)

	var id, target, message string
	var attempts int
	err = tx.QueryRow(ctx, `
		UPDATE wa_outbox SET attempts = attempts + 1
		WHERE id = (
			SELECT id FROM wa_outbox
			WHERE status = 'pending' AND next_attempt_at <= now()
			ORDER BY created_at
			FOR UPDATE SKIP LOCKED
			LIMIT 1
		)
		RETURNING id, target_phone, message, attempts
	`).Scan(&id, &target, &message, &attempts)
	if errors.Is(err, pgx.ErrNoRows) {
		return false
	}
	if err != nil {
		log.Printf("wanotify: klaim pesan gagal: %v", err)
		return false
	}
	if err := tx.Commit(ctx); err != nil {
		log.Printf("wanotify: komit klaim gagal: %v", err)
		return false
	}

	sendCtx, cancel := context.WithTimeout(context.Background(), sendTimeout)
	defer cancel()
	sendErr := c.Send(sendCtx, target, message)

	if sendErr == nil {
		if _, err := db.Exec(ctx,
			`UPDATE wa_outbox SET status = 'sent', sent_at = now(), last_error = NULL WHERE id = $1`, id,
		); err != nil {
			log.Printf("wanotify: tandai terkirim gagal: %v", err)
		}
		return true
	}

	log.Printf("wanotify: kirim #%s gagal (percobaan %d): %v", id, attempts, sendErr)
	if attempts >= maxAttempts {
		if _, err := db.Exec(ctx,
			`UPDATE wa_outbox SET status = 'failed', last_error = $2 WHERE id = $1`, id, sendErr.Error(),
		); err != nil {
			log.Printf("wanotify: tandai gagal permanen bermasalah: %v", err)
		}
		return true
	}
	if _, err := db.Exec(ctx,
		`UPDATE wa_outbox SET next_attempt_at = now() + $2::interval, last_error = $3 WHERE id = $1`,
		id, backoff(attempts), sendErr.Error(),
	); err != nil {
		log.Printf("wanotify: jadwal ulang gagal: %v", err)
	}
	return true
}

// backoff memberi jeda naik: 1m, 5m, 15m, lalu 60m bertahan.
func backoff(attempts int) string {
	switch {
	case attempts <= 1:
		return "1 minute"
	case attempts == 2:
		return "5 minutes"
	case attempts == 3:
		return "15 minutes"
	default:
		return "60 minutes"
	}
}

// ---------------------------------------------------------------------------
// Hook siap-pakai untuk handler
// ---------------------------------------------------------------------------

// fire menjalankan pekerjaan antrean di latar belakang: kegagalan WA tidak
// boleh menggagalkan respons absensi/pembayaran/PPDB kepada pengguna.
func fire(fn func(ctx context.Context)) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("wanotify: panik tertelan: %v", r)
			}
		}()
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		fn(ctx)
	}()
}

// QueueAbsensi mengantre kabar absensi untuk orang tua satu murid. Dipanggil
// setelah baris absensi BERHASIL dibuat (bukan duplikat), sehingga ref_id =
// id absensi otomatis mencegah pesan ganda.
func QueueAbsensi(ctx context.Context, db *pgxpool.Pool, userID, status, tanggal, sesi, refID string) {
	fire(func(ctx context.Context) {
		cfg := LoadConfig(ctx, db)
		if !cfg.enabledFor("absensi") {
			return
		}
		nama, phone, err := santriContact(ctx, db, userID)
		if err != nil {
			log.Printf("wanotify: kontak absensi %s gagal: %v", userID, err)
			return
		}
		if phone == "" {
			return // nomor ortu belum diisi — bukan kegagalan
		}
		msg := cfg.renderFor("absensi", map[string]string{
			"nama":    nama,
			"status":  status,
			"tanggal": tanggal,
			"sesi":    sesiSuffix(sesi),
			"sekolah": schoolName(ctx, db),
		})
		sid := userID
		if err := Enqueue(ctx, db, Entry{Purpose: "absensi", RefID: refID, SantriID: &sid, TargetPhone: phone, Message: msg}); err != nil {
			log.Printf("wanotify: antre absensi gagal: %v", err)
		}
	})
}

// QueuePembayaran mengantre kwitansi untuk pembayaran berstatus paid.
func QueuePembayaran(ctx context.Context, db *pgxpool.Pool, santriID string, bulan, tahun *int, jumlah float64, metode, refID string) {
	fire(func(ctx context.Context) {
		cfg := LoadConfig(ctx, db)
		if !cfg.enabledFor("pembayaran") {
			return
		}
		nama, phone, err := santriContact(ctx, db, santriID)
		if err != nil {
			log.Printf("wanotify: kontak pembayaran %s gagal: %v", santriID, err)
			return
		}
		if phone == "" {
			return
		}
		msg := cfg.renderFor("pembayaran", map[string]string{
			"nama":    nama,
			"bulan":   bulanNama(bulan),
			"tahun":   intNama(tahun),
			"jumlah":  FormatRupiah(jumlah),
			"metode":  metode,
			"sekolah": schoolName(ctx, db),
		})
		sid := santriID
		if err := Enqueue(ctx, db, Entry{Purpose: "pembayaran", RefID: refID, SantriID: &sid, TargetPhone: phone, Message: msg}); err != nil {
			log.Printf("wanotify: antre kwitansi gagal: %v", err)
		}
	})
}

// QueuePPDB mengantre kabar hasil seleksi ke nomor pendaftar (fallback wali).
func QueuePPDB(ctx context.Context, db *pgxpool.Pool, namaLengkap, noHp, noHpWali, nomorPendaftaran, hasil, refID string) {
	fire(func(ctx context.Context) {
		key := "ppdb_" + hasil
		cfg := LoadConfig(ctx, db)
		if !cfg.enabledFor("ppdb") {
			return
		}
		target := normalizePhone(noHp)
		if target == "" {
			target = normalizePhone(noHpWali)
		}
		if target == "" {
			return
		}
		msg := cfg.renderFor(key, map[string]string{
			"nama":              namaLengkap,
			"nomor_pendaftaran": nomorPendaftaran,
			"sekolah":           schoolName(ctx, db),
		})
		if err := Enqueue(ctx, db, Entry{Purpose: "ppdb", RefID: refID, TargetPhone: target, Message: msg}); err != nil {
			log.Printf("wanotify: antre ppdb gagal: %v", err)
		}
	})
}

func (c Config) renderFor(key string, vars map[string]string) string {
	tpl, ok := c.Templates[key]
	if !ok {
		tpl = "{{pesan}}"
	}
	return render(tpl, vars)
}

// santriContact mengambil nama lengkap dan nomor WhatsApp orang tua. attendance
// .user_id untuk murid ADALAH santri.id, jadi pencarian cukup satu kunci.
func santriContact(ctx context.Context, db *pgxpool.Pool, santriID string) (nama, phone string, err error) {
	err = db.QueryRow(ctx,
		`SELECT COALESCE(nama_lengkap,''), COALESCE(no_hp_ortu,'') FROM santri WHERE id = $1`,
		santriID,
	).Scan(&nama, &phone)
	if err != nil {
		return "", "", err
	}
	return nama, normalizePhone(phone), nil
}

// schoolName membaca identitas sekolah yang sama dengan yang dipakai frontend.
// Gagal membaca bukan masalah: placeholder dikosongkan saja.
func schoolName(ctx context.Context, db *pgxpool.Pool) string {
	var raw []byte
	if err := db.QueryRow(ctx,
		`SELECT content FROM website_content WHERE key = 'school_identity'`,
	).Scan(&raw); err != nil {
		return ""
	}
	var m map[string]any
	if json.Unmarshal(raw, &m) != nil {
		return ""
	}
	for _, field := range []string{"name", "nama", "institutionName"} {
		if v, ok := m[field].(string); ok && strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

// normalizePhone mengubah 08…/+62/628… menjadi 62… sesuai bentuk yang
// diterima gateway; karakter non-digit dibuang lebih dulu.
func normalizePhone(raw string) string {
	digits := strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, strings.TrimSpace(raw))
	switch {
	case strings.HasPrefix(digits, "62"):
		return digits
	case strings.HasPrefix(digits, "0"):
		return "62" + strings.TrimPrefix(digits, "0")
	default:
		return digits
	}
}

func sesiSuffix(sesi string) string {
	if strings.TrimSpace(sesi) == "" {
		return ""
	}
	return ", sesi " + sesi
}

func bulanNama(b *int) string {
	if b == nil || *b < 1 || *b > 12 {
		return "-"
	}
	return namaBulan[*b]
}

func intNama(i *int) string {
	if i == nil {
		return "-"
	}
	return fmt.Sprintf("%d", *i)
}

// FormatRupiah mencetak 250000 menjadi Rp250.000 tanpa dependensi luar.
func FormatRupiah(v float64) string {
	n := int64(math.Round(v))
	neg := n < 0
	if neg {
		n = -n
	}
	s := fmt.Sprintf("%d", n)
	var b strings.Builder
	if neg {
		b.WriteByte('-')
	}
	b.WriteString("Rp")
	for i, digit := range []byte(s) {
		if i > 0 && (len(s)-i)%3 == 0 {
			b.WriteByte('.')
		}
		b.WriteByte(digit)
	}
	return b.String()
}
