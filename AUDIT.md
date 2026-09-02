# AUDIT Proyek — SDN Baturaja

**Tanggal:** 2026-08-23 · **Branch:** `feat/sdnb-migration` · **HEAD:** `6a3ede1` · **Worktree:** bersih

> Audit titik-titik-mati (point-in-time) pada branch fitur — bukan penilaian atas `master`/production.
> Metode: pembacaan langsung berkas inti + grep menyeluruh + sampling handler/komponen (read-only,
> tanpa build/test/deploy). Area yang hanya disampling diberi catatan cakupan eksplisit.

---

## Ringkasan Eksekutif

| Area | Nilai | Satu kalimat |
|---|---|---|
| Frontend (`src/`) | **B+** | Arsitektur data-access rapi dan konsisten; beban teknis utamanya komponen raksasa & token di localStorage |
| Backend Go (`backend/`) | **B−** | Infrastruktur solid (JWT, pool, storage, SQL whitelist), tapi ada 1 lubang auth nyata di alur login santri |
| Database / RLS (`supabase/`) | **A−** | RLS aktif di seluruh 48 tabel (diverifikasi satu per satu); yang mengkhawatirkan adalah tidak ada tes regresinya |
| Repo / Tooling | **B−** | Hygiene git & secrets bersih; kelemahan terbesar: tidak ada CI sama sekali |

**Temuan paling penting (lihat detail di bawah):**
1. 🔴 `backend/internal/handler/auth.go` — "self-heal" password santri memungkinkan takeover akun murid.
2. 🟠 Tidak ada CI — suite vitest/eslint ada tapi tak pernah dipaksa jalan.
3. 🟠 `supabase/tests/` kosong padahal didokumentasikan berisi tes RLS/storage/function.
4. 🟡 Brute-force `/api/auth/login` tidak dijaga server-side; rate limit hanya di endpoint pencatat.

Jumlah temuan: **2 High · 4 Medium · 8 Low** (tidak ada Critical yang bisa dieksploitasi anonym dari internet
tanpa kredensial, namun #1 mendekati itu untuk seluruh populasi santri).

---

## 1. Backend Go (`backend/`) — B−

### Yang sudah baik
- Pemisahan route publik/terproteksi jelas di `main.go`; semua mount domain di dalam grup `RequireAuth`.
  Dua mount campuran (`/api/content`, `/api/ppdb`) memakai `OptionalAuth` + self-gating role — didokumentasikan alasannya.
- `internal/auth/jwt.go`: HS256 dengan pemeriksaan metode HMAC eksplisit, pemisahan tipe token access/refresh, expiry.
- `internal/auth/password.go`: bcrypt cost 12.
- `internal/storage/storage.go`: validasi path (Clean + tolak `..`/absolut), allowlist MIME per bucket,
  batas ukuran + `LimitReader`, signed URL HMAC-SHA256 dengan expiry + `hmac.Equal` (constant-time).
- SQL dinamis aman: `buildInsert`/`updateRow` (santri.go) memakai **whitelist kolom** + placeholder `$n`;
  backup.go memvalidasi nama tabel terhadap map whitelist sebelum interpolasi.
- `http.Server` punya Read/Write/IdleTimeout + graceful shutdown; pgxpool dikonfigurasi (MaxConns 20, lifetime, idle).
- Komentar kode menjelaskan *mengapa* (mis. sejarah bug Konten panel, fallback CORS) — nilai dokumentasi tinggi.

### Temuan

| Severity | Lokasi | Temuan |
|---|---|---|
| **HIGH** | `internal/handler/auth.go:54–64` | **Self-heal password santri.** Jika bcrypt gagal DAN `role == "santri"` DAN `password == username`, server me-hash password itu, **menimpa password lama**, lalu tetap login. Akibat: siapa pun yang tahu NISN/NIS/nama_panggilan murid (identifier semi-publik) bisa login sebagai murid itu **dan menghancurkan password aslinya** — meski murid sudah ganti password. Mekanisme migrasi ini tidak punya batas waktu/sekali-pakai. |
| **HIGH** | `main.go:72`, `loginlogs.go` | Tidak ada rate-limit/lockout server-side pada `POST /api/auth/login`. Limiter (20/5 menit) hanya menjaga endpoint pencatat attempt yang dipanggil *fire-and-forget* oleh frontend — penyerang langsung ke `/api/auth/login` tidak terkena apa pun. |
| Medium | `auth.go:79–103` | Refresh token tidak dirotasi/dicabut: tanpa `jti`/allowlist, refresh token curian valid hingga 30 hari penuh. |
| Medium | semua endpoint JSON publik | Body request tanpa `http.MaxBytesReader` (usage `MaxBytesReader` hanya 4, tampaknya di upload) → permukaan DoS body tak berbatas di login/refresh/form publik. |
| Low | `main.go:223` | `CORS_ORIGIN` kosong ⇒ fallback `Access-Control-Allow-Origin: *`. |
| Low | `config.go:34–40` | `mustEnv` panic alih-alih mengembalikan error (inkonsisten dengan signature `Load()`); tanpa panjang minimum untuk secret JWT. |
| Low | `auth.go:41–42` | `strings.TrimSpace` pada password — mengubah password yang (sah) mengandung spasi tepi. |
| Low | handlers | Tidak ada `context.WithTimeout` per query (bergantung pada WriteTimeout 30s). Cakupan: inti dibaca penuh; 17+ handler lain discan pola + sampling. |

---

## 2. Frontend React (`src/`) — B+

### Yang sudah baik
- `src/lib/apiClient.js`: single-flight refresh (dedup promise), retry 401 otomatis, event `auth:logout`,
  penanganan `X-Total-Count` yang benar (membedakan header hilang vs 0).
- Konvensi adapter layer (`src/lib/*Adapters.js`) **dipegang**: grep repo-wide menemukan hanya **1** pemanggilan
  `fetch` langsung di luar lib (`AuthContext.jsx:89` — panggilan login pre-auth).
- `ProtectedRoute.jsx`: desain matang — ref `hasAuthorized` mencegah flash login/unmount saat refresh profil latar.
- `TODO/FIXME`: **0**. `console.log`: hanya 5 berkas. Sentuhan a11y ada (`role="status"`, `aria-live`).
- 311 berkas JS/JSX; tidak ada berkas >100KB (terbesar `SantriDetailModal.jsx` 80KB).

### Temuan

| Severity | Lokasi | Temuan |
|---|---|---|
| Medium | `apiClient.js:3–12` | Access & refresh token di `localStorage` — rentan dicuri via XSS. Tradeoff umum, tapi layak dievaluasi (httpOnly cookie via backend proxy). |
| Medium | `ProtectedRoute.jsx:31–41` | `console.log` setiap update route **termasuk userId & role** — noise produksi + kebocoran metadata ke console. |
| Low | `AGENTS.md` root vs `src/App.jsx:4` | Dokumen menunjuk `SupabaseAuthContext.jsx` yang sudah tidak ada; aktual `AuthContext.jsx`. Drift dokumen. |
| Low | `apiClient.js:1`, `AuthContext.jsx:8` | Fallback `http://localhost:8080` di-hardcode dua tempat. |
| Low | dashboard | Komponen raksasa (PaymentSystem 70KB, SantriManagement 68KB, GuruDashboard 69KB) — beban pemeliharaan; kandidat dekomposisi. |
| Catatan | — | Cakupan: berkas auth/data-access dibaca penuh; 36 panel admin hanya direpresentasikan via grep pola + sampling ukuran, bukan dibaca satu per satu. |

---

## 3. Supabase (migrasi, RLS, functions) — A−

### Yang sudah baik
- **RLS aktif di seluruh 48 tabel** yang dibuat — diverifikasi per tabel, termasuk 5 tabel migrasi Agustus
  (`nilai`, `kelas_konten`, `murojaah_audit`, `rapor_catatan`, `rapor_deskripsi_mapel`) yang memakai nama tanpa prefix `public.`.
- Policy `USING (true)` terbatas pada SELECT data referensi/publik; insert anonim hanya untuk `feedbacks` (form kontak);
  `WITH CHECK` hadir di 10 berkas policy.
- Edge functions: `service_role` terkurung di `_shared/supabaseAdmin.ts`; `safeLogger.ts` meredaksi key sensitif;
  `verify_jwt = false` hanya untuk 2 fungsi yang memang publik (`signin-with-nomor-induk`, `record-login-attempt`);
  storage `file_size_limit = "25MiB"`.
- Penamaan migrasi kronologis konsisten (`YYYYMMDDNNNNNN_nama.sql`), 73 berkas.

### Temuan

| Severity | Lokasi | Temuan |
|---|---|---|
| Medium | `supabase/tests/` | **Direktori tes KOSONG**, padahal AGENTS.md & HANDOFF mengklaim ada tes RLS/storage/function. Klaim ≠ realitas; policy RLS tidak punya jaring pengaman regresi. |
| Medium | (dependensi FE) | `xlsx@^0.18.5` memiliki advisory publik (prototype pollution/ReDoS; SheetJS tidak lagi rilis ke npm registry versi patch ini). Pertimbangkan upgrade jalur SheetJS CDN atau sanitasi input. |
| Low | migrasi policy | Evolusi policy bergaya `DROP POLICY IF EXISTS` + recreate di migrasi baru — konvensional, tapi rawan drift antara berkas awal dan akhir. |
| Low | `AGENTS.md` | Disebut 46 migrasi; faktanya 73. Juga "17 handler"; faktanya ±24 berkas handler `.go`. |

---

## 4. Repo, Ops & Kebersihan — B−

### Yang sudah baik
- Worktree bersih; hanya `.env.example` yang terlacak (`.env` nyata tidak); `.gitignore` mencakup `.env*`, `dist/`, dump DB.
- Scan pola secret (`SERVICE_ROLE=...`, JWT literal, private key block, `sk_live_`) di seluruh berkas terlacak: **bersih**.
- Log commit terakhir patuh Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`).
- Script produksi terjaga: `run-production-data-promotion.ps1` menuntut frase konfirmasi diketik manual
  (`IMPORT-PRODUCTION-<ref>`), pin URL project ref, dan flag `EXECUTE` eksplisit. `docs/HANDOFF.md` ada.
- ESLint 9 + Vitest terkonfigurasi di package.json.

### Temuan

| Severity | Lokasi | Temuan |
|---|---|---|
| **Medium-High** | `.github/workflows` | **Tidak ada CI sama sekali.** Suite tes (vitest) & lint ada tapi tidak pernah dipaksa berjalan — regresi baru ketahuan saat manusia ingat menjalankannya. |
| Low | `package.json` | `react-helmet` tidak dirawat lagi; beban visual berat (three.js + gsap + framer-motion) — pastikan lazy-load agar tidak masuk bundle jalur kritis. |
| Low | `AGENTS.md` header | Branch/commit snapshot (`migrate-frontpage-baru` @ `7f61898`) sudah tidak sesuai realitas (`feat/sdnb-migration` @ `6a3ede1`). Regenerasi berkala disarankan. |

---

## Rekomendasi Prioritas

1. **[High] Hentikan/beri batas self-heal password santri** (`auth.go`). Opsi: matikan sepenuhnya + sediakan reset oleh admin;
   atau batasi sekali-pakai dengan kolom `password_needs_heal`/token reset berbatas waktu. Wajib: jangan menimpa
   password yang sudah di-set.
2. **[High] Rate-limit server-side di `POST /api/auth/login`** (per username + per IP, pakai tabel `auth_rate_limits`
   yang sudah ada), dan buat pencatatan attempt dilakukan di dalam handler login itu sendiri — jangan bergantung pada
   panggilan frontend kedua.
3. **[Med-High] Pasang CI minimal** (`npm run lint && npm test` + `go vet ./... && go build ./...`) pada PR ke `master`.
4. **[Medium] Isi ulang `supabase/tests/`** minimal untuk RLS tabel sensitif (`payments`, `santri`, `expenses`, `login_logs`)
   agar klaim keamanan bisa diverifikasi ulang.
5. **[Medium] Rotasi refresh token + MaxBytesReader** pada semua decoder body (awali dengan endpoint publik).
6. **[Medium] Upgrade/isolasi `xlsx`** dan pertimbangkan migrasi token ke cookie httpOnly (perlu perubahan backend).
7. **[Low] Bersihkan console.log** dari `ProtectedRoute.jsx` dkk.; regenerasi AGENTS.md; hapus fallback localhost duplikat.

## Langkah Retest Singkat
- Setelah #1/#2: coba login `username=NISN&password=NISN` untuk santri yang sudah ganti password → harus ditolak;
  spam 25× password salah pada satu username → harus terkena limit HTTP 429.
- Setelah #3: buka PR dummy → workflow harus jalan dan gagal bila test gagal.
