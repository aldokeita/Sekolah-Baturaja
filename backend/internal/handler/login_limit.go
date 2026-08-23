package handler

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"log"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Throttle login publik di atas tabel public.auth_rate_limits
// (migrasi 20260624000300). Sengaja DB-backed, bukan in-memory seperti
// attemptLimiter di loginlogs.go: batasnya tetap berlaku lintas restart proses
// dan lintas replika saat backend nanti di-scale di PaaS/VPS.
//
// Hanya percobaan LOGIN GAGAL yang dikonsumsi — login sukses tidak pernah
// menyentuh counter dan justru menghapus hitungan aliasnya, supaya keluarga
// satu IP yang bergantian membantu anak-anaknya tidak pernah ter-kunci.
//
// Fail-open: bila Postgres gagal mengurus tabel ini, login tetap dibolehkan
// dengan catatan log. Untuk aplikasi sekolah, ketersediaan login lebih penting
// daripada throttling yang sempurna.

const (
	rateLimitPurposeAlias = "backend-login-alias"
	rateLimitPurposeIP    = "backend-login-ip"
	loginMaxFailsAlias    = 5  // percobaan gagal per username sebelum blokir
	loginMaxFailsIP       = 30 // percobaan gagal per IP lintas username
	loginFailWindow       = 15 * time.Minute
	loginBlockFor         = 15 * time.Minute
)

type loginThrottle struct {
	db *pgxpool.Pool
}

func newLoginThrottle(db *pgxpool.Pool) *loginThrottle {
	return &loginThrottle{db: db}
}

func shaHex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}

// keys mengembalikan dua dimensi penghitungan: per username dan per IP.
// Kolom ip_hash/alias_hash bertipe NOT NULL dengan unique index pada
// (purpose, ip_hash, alias_hash), jadi sisi yang tidak relevan diisi sentinel
// konstan agar kedua dimensi tidak saling bertabrakan.
func (t *loginThrottle) keys(ip, username string) [][3]string {
	return [][3]string{
		{rateLimitPurposeAlias, shaHex(ip), shaHex(strings.ToLower(username))},
		{rateLimitPurposeIP, shaHex(ip), shaHex("__all_aliases__")},
	}
}

// blocked melaporkan true bila salah satu dimensi masih dalam masa blokir.
func (t *loginThrottle) blocked(ctx context.Context, ip, username string) bool {
	for _, k := range t.keys(ip, username) {
		var until time.Time
		err := t.db.QueryRow(ctx, `
			SELECT blocked_until FROM auth_rate_limits
			WHERE purpose = $1 AND ip_hash = $2 AND alias_hash = $3
			  AND blocked_until IS NOT NULL AND blocked_until > now()
			LIMIT 1
		`, k[0], k[1], k[2]).Scan(&until)
		switch {
		case err == nil:
			return true
		case !errors.Is(err, pgx.ErrNoRows):
			log.Printf("throttle: cek blokir gagal (fail-open): %v", err)
		}
	}
	return false
}

// upsertLoginFail menaikkan counter kegagalan untuk satu kunci. Jendela fixed:
// begitu window_start berganti, hitungan mulai dari 1 lagi; melewati batas
// memasang blocked_until sambil mempertahankan blokir yang masih aktif.
const upsertLoginFail = `
INSERT INTO auth_rate_limits (purpose, ip_hash, alias_hash, window_start, attempts)
VALUES ($1, $2, $3, $4, 1)
ON CONFLICT (purpose, ip_hash, alias_hash) DO UPDATE SET
	attempts = CASE WHEN auth_rate_limits.window_start = EXCLUDED.window_start
		THEN auth_rate_limits.attempts + 1 ELSE 1 END,
	window_start = EXCLUDED.window_start,
	blocked_until = CASE
		WHEN COALESCE(auth_rate_limits.blocked_until, to_timestamp(0)) > now()
			THEN auth_rate_limits.blocked_until
		WHEN CASE WHEN auth_rate_limits.window_start = EXCLUDED.window_start
				THEN auth_rate_limits.attempts + 1 ELSE 1 END >= $5
			THEN now() + ($6::int * interval '1 second')
		ELSE NULL END,
	updated_at = now()
`

func (t *loginThrottle) fail(ctx context.Context, ip, username string) {
	windowStart := time.Now().Truncate(loginFailWindow)
	for _, k := range t.keys(ip, username) {
		max := loginMaxFailsAlias
		if k[0] == rateLimitPurposeIP {
			max = loginMaxFailsIP
		}
		if _, err := t.db.Exec(ctx, upsertLoginFail,
			k[0], k[1], k[2], windowStart, max, int(loginBlockFor.Seconds())); err != nil {
			log.Printf("throttle: catat kegagalan login gagal (fail-open): %v", err)
		}
	}
}

// clear menghapus hitungan level username setelah login sukses.
func (t *loginThrottle) clear(ctx context.Context, username string) {
	if _, err := t.db.Exec(ctx, `
		DELETE FROM auth_rate_limits WHERE purpose = $1 AND alias_hash = $2
	`, rateLimitPurposeAlias, shaHex(strings.ToLower(username))); err != nil {
		log.Printf("throttle: reset hitungan login gagal (abaikan): %v", err)
	}
}
