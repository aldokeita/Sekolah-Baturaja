# AGENTS.md — backend/

Go API server. Proxy antara frontend React dan Supabase. Semua request frontend melewati server ini.

## Struktur

```
backend/
├── main.go                    # Entry point, route registration, server startup
├── go.mod                     # Module: lpq-backend, Go 1.22
├── cmd/seed-admin/main.go     # CLI tool: seed admin user ke Supabase Auth
├── init/                      # (kosong / placeholder)
└── internal/
    ├── auth/
    │   ├── jwt.go             # JWT parsing, validation, claims extraction
    │   └── password.go        # Password hashing (bcrypt)
    ├── config/config.go       # Environment config loader (Supabase URL, keys, port)
    ├── db/db.go               # Supabase PostgreSQL connection pool
    ├── handler/               # 17 handler files — satu per domain (lihat di bawah)
    ├── middleware/auth.go     # JWT auth middleware, role extraction
    └── storage/storage.go     # Supabase Storage client (upload, signed URL)
```

## Handler (17 file, satu per domain)

| File | Endpoint prefix | Domain |
|------|-----------------|--------|
| `academic.go` | `/api/academic/*` | Hafalan items, progress, kalender |
| `appconfig.go` | `/api/config/*` | Konfigurasi aplikasi |
| `attendance.go` | `/api/attendance/*` | Absensi santri & guru |
| `auth.go` | `/api/auth/*` | Login, logout, refresh token, register |
| `classes.go` | `/api/classes/*` | CRUD kelas, membership, mutasi |
| `content.go` | `/api/content/*` | Konten website publik |
| `file.go` | `/api/storage/*` | Upload/download file |
| `forum.go` | `/api/forum/*` | Forum diskusi |
| `gamification.go` | `/api/gamification/*` | Poin & reward |
| `guru.go` | `/api/guru/*` | CRUD guru |
| `loginlogs.go` | `/api/auth/login-logs/*` | Log login & rate limit |
| `mediaplayer.go` | `/api/media/*` | Audio/music player |
| `mmq.go` | `/api/mmq/*` | MMQ schedule, attendance, notulensi |
| `payment.go` | `/api/payments/*` | Pembayaran SPP |
| `santri.go` | `/api/santri/*` | CRUD santri, arsip |
| `whatsapp.go` | `/api/whatsapp/*` | Template & grup WA |
| `file_test.go` | — | Unit test untuk file handler |

## Konvensi

- Satu handler file per domain — jangan campur
- Handler menerima `*http.Request`, return JSON via `encoding/json`
- Auth middleware inject user claims ke context
- Semua query ke Supabase melalui `db.go` connection pool (PostgREST atau direct SQL)
- Error response format: `{"error": "message"}`
- Success response format: `{"data": ...}` dengan optional `X-Total-Count` header
- Route registration terpusat di `main.go`

## Anti-pattern

- JANGAN bypass auth middleware untuk endpoint yang butuh autentikasi
- JANGAN akses Supabase langsung dari handler — gunakan `db.go`
- JANGAN tambah handler tanpa register route di `main.go`
- JANGAN return error tanpa HTTP status code yang sesuai
