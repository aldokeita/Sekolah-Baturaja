package middleware

import (
	"context"
	"net/http"
	"strings"

	"lpq-backend/internal/auth"
)

type contextKey string

const (
	CtxUserID contextKey = "user_id"
	CtxRole   contextKey = "role"
)

func RequireAuth(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if !strings.HasPrefix(header, "Bearer ") {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			claims, err := auth.ValidateAccessToken(strings.TrimPrefix(header, "Bearer "), secret)
			if err != nil {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			ctx := context.WithValue(r.Context(), CtxUserID, claims.UserID)
			ctx = context.WithValue(ctx, CtxRole, claims.Role)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// OptionalAuth fills the user id and role into the request context when a valid
// Bearer token is present, and passes the request through untouched when the
// token is absent or invalid. It never rejects a request — the handler decides.
//
// Use it for routers that mix genuinely public reads with back-office writes
// that gate themselves on RoleFromCtx/CanManage. /api/content is exactly that:
// news, announcements, and the contact form must stay readable/postable without
// a token, while the write endpoints are admin-only.
//
// Without this middleware those self-gating handlers see an empty role and
// reject EVERYONE including admin, because only RequireAuth ever populates the
// context — which is what silently disabled the whole Konten panel.
func OptionalAuth(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if !strings.HasPrefix(header, "Bearer ") {
				next.ServeHTTP(w, r)
				return
			}
			claims, err := auth.ValidateAccessToken(strings.TrimPrefix(header, "Bearer "), secret)
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}
			ctx := context.WithValue(r.Context(), CtxUserID, claims.UserID)
			ctx = context.WithValue(ctx, CtxRole, claims.Role)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RoleSuperadmin memegang aplikasi sebagai produk: pemilik/penjual template.
// Peran ini SUPERSET dari admin — semua yang boleh admin, boleh superadmin.
const RoleSuperadmin = "superadmin"

// RequireRole memperbolehkan superadmin secara otomatis tanpa perlu disebut di
// setiap pemanggilan. Ada 20+ RequireRole("admin", ...) di handler; menambahkan
// "superadmin" satu per satu justru rawan terlewat dan menghasilkan lubang
// otorisasi yang senyap.
func RequireRole(roles ...string) func(http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(roles)+1)
	for _, r := range roles {
		allowed[r] = struct{}{}
	}
	allowed[RoleSuperadmin] = struct{}{}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role, _ := r.Context().Value(CtxRole).(string)
			if _, ok := allowed[role]; !ok {
				http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// IsAdmin dipakai pengganti perbandingan langsung role == "admin", supaya
// superadmin tidak tertolak di area admin-only.
func IsAdmin(role string) bool {
	return role == "admin" || role == RoleSuperadmin
}

// CanManage reports whether the role holds back-office management privileges:
// admin, tata_usaha, dan superadmin. It gates the operational modules the Tata
// Usaha dashboard shares with admin (data santri, kelas, rekap absensi, MMQ,
// kalender, pembayaran/pengeluaran, konten, TV/media, app-config).
//
// It deliberately does NOT cover the admin-only areas, which keep an explicit
// IsAdmin() check so tata_usaha can never reach them:
//   - account & role provisioning (create/delete staff, assign role/status/password)
//   - login logs
//   - backup & restore
//   - bisyaroh/salary
func CanManage(role string) bool {
	return IsAdmin(role) || role == "tata_usaha"
}

// CanManageBrand menjaga identitas website: logo, ikon, nama sekolah, dan aksen
// warna. HANYA superadmin.
//
// Aplikasi ini template yang dijual. Pembeli menerima peran admin dan bebas
// mengubah seluruh konten administrasi sekolah, tetapi identitas produk bukan
// wewenangnya — karena itu admin sengaja TIDAK disertakan di sini.
func CanManageBrand(role string) bool {
	return role == RoleSuperadmin
}

func UserIDFromCtx(ctx context.Context) string {
	v, _ := ctx.Value(CtxUserID).(string)
	return v
}

func RoleFromCtx(ctx context.Context) string {
	v, _ := ctx.Value(CtxRole).(string)
	return v
}
