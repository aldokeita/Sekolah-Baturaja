# AGENTS.md — supabase/

Konfigurasi Supabase: migration SQL, edge functions (Deno), dan test suite.

## Struktur

```
supabase/
├── config.toml               # Konfigurasi lokal Supabase CLI
├── migrations/                # 46 migration SQL (berurutan timestamp)
├── functions/                 # 5 Deno edge functions + _shared/
│   ├── _shared/               # Kode bersama antar edge functions
│   ├── generate-signed-upload-url/
│   ├── manage-user/
│   ├── record-login-attempt/
│   ├── reset-user-password/
│   └── signin-with-nomor-induk/
└── tests/
    ├── fixtures/              # Data test & dokumentasi keamanan
    ├── functions/             # Test edge functions (run-function-tests.ps1)
    ├── rls/                   # Test RLS policies (run-rls-tests.ps1)
    └── storage/               # Test storage policies (run-storage-tests.ps1)
```

## Migration

- 46 file SQL berurutan berdasarkan timestamp
- Naming: `YYYYMMDDHHMMSS_deskripsi.sql`
- **SELALU buat migration baru** — JANGAN edit migration lama yang sudah deployed
- Migration mencakup: tabel, kolom, index, RLS policies, functions, triggers
- Urutan validasi: `scripts/validate-migration-order.ps1`

## Edge Functions (Deno runtime)

| Function | Fungsi |
|----------|--------|
| `generate-signed-upload-url` | Buat signed URL untuk upload file ke Storage |
| `manage-user` | Admin: create/update/delete Auth user |
| `record-login-attempt` | Catat percobaan login untuk rate limiting |
| `reset-user-password` | Reset password user via admin |
| `signin-with-nomor-induk` | Login santri dengan Nomor Induk (bukan email) |

- Shared code di `_shared/` (CORS headers, auth helpers, response format)
- Deploy via Supabase CLI: `supabase functions deploy <nama>`
- Toggle aktif/non-aktif via `src/lib/featureFlags.js`

## Test Suite

- **RLS tests**: Verifikasi Row Level Security policies per role (admin, guru, santri, pentashih, tata_usaha)
- **Storage tests**: Verifikasi bucket policies (avatars, website-assets, murojaah-recordings, music-files)
- **Function tests**: Verifikasi edge function behavior
- Semua runner script: PowerShell (`.ps1`)

## Konvensi

- RLS policy naming: `<tabel>_<role>_<operasi>` (contoh: `payments_admin_select`)
- Setiap tabel yang menyimpan data pengguna WAJIB punya RLS policy
- Storage bucket: 4 bucket (avatars, website-assets, murojaah-recordings, music-files)
- Edge function response format: `{ data, error }` konsisten dengan Supabase SDK

## Anti-pattern

- JANGAN edit migration yang sudah di-deploy — buat migration baru
- JANGAN buat tabel tanpa RLS policy
- JANGAN bypass RLS dengan `security definer` tanpa alasan kuat
- JANGAN deploy edge function ke production tanpa test di staging
- JANGAN hapus migration file — urutan harus terjaga
