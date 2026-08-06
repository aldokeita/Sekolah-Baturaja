# HANDOFF — Status Migrasi SDN Baturaja

**Diperbarui:** 2026-08-06 · **Branch:** `migrate-frontpage-baru` (belum pernah di-push) · **HEAD:** `6eae380`

Baca file ini lebih dulu sebelum melanjutkan pekerjaan. `git log` menjelaskan *apa* yang berubah;
file ini menjelaskan *kenapa*, apa yang sudah terbukti jalan, dan apa yang masih berisiko.

---

## 1. Tujuan

Mengubah aplikasi dari LPQ/TPQ (sekolah Al-Qur'an) menjadi **SDN Baturaja**, sekolah dasar negeri
umum. Bukan penulisan ulang — aplikasi lama sudah matang, yang diubah adalah istilah, alur, dan
modul yang tidak relevan bagi sekolah umum.

---

## 2. Keputusan yang mengikat

Keputusan berikut sudah diambil pengguna dan **membatalkan rencana yang lebih awal**. Jangan
dibongkar tanpa instruksi baru.

| Modul | Keputusan | Alasan |
|---|---|---|
| MMQ | **Dialihfungsikan** jadi "Rapat Guru", bukan dihapus | Sekolah tetap butuh rapat internal guru |
| Pentashih | **Dilabel ulang** jadi "Wakil Kepala Sekolah" | Alur persetujuannya tetap berguna |
| Hafalan | **Dipertahankan** di kode, hanya dicopot dari routing & dashboard | Sebagian sekolah umum punya program tahfizh |
| Jilid/Sesi di Data Murid | Filter & kolom dihapus, field tetap ada di balik flag | Jadi isian bebas, bukan dropdown Qiroati |
| Metode mengaji | Sekolah **memilih metode**, tingkat mengikuti | Qiroati/Iqro/Ummi/Wafa/Tilawati/Tahfizh-Juz/Kustom |
| Kategori murid & kelas | **Dihapus seluruhnya.** Tidak ada kelas dewasa, tidak ada PTPT, istilah TPQ tidak dipakai | SD negeri dengan satu jenis murid |
| Hafalan | Dua bentuk tetap ada, **tapi keduanya terbuka untuk semua murid** | Per Kelas 1–6 dan per Juz Al-Qur'an; status murid tidak lagi membatasi |

Manajemen Kelas kini **satu panel tanpa sub-tab**. Tiga sub-tab lama (Murid TPQ, Murid PTPT, Murid
Dewasa) dicabut dan `AdultClassManagement.jsx` dihapus.

Penyaringan kategori **dihapus, bukan dipatok ke `'Anak'`**. Basis data masih menyimpan 1 kelas dan
3 murid berkategori `PTPT` dari era lama; mematoknya ke `'Anak'` akan membuat data itu tak terlihat
dan tak terkelola. Semua kelas aktif dan semua murid aktif kini tampil dalam satu daftar. Nilai
`kategori` hanya tersisa sebagai default saat membuat kelas baru.

**Nilai `'Pentashih'` di database TIDAK diubah.** Hanya labelnya yang diterjemahkan lewat
`ROLE_LABELS` di `GuruManagement.jsx`. Mengubah nilainya akan merusak data lama dan RLS.

Rencana migrasi drop-table untuk MMQ/jilid **dibatalkan**.

### Dashboard TIDAK ditulis ulang dari nol

Opsi menyapu bersih seluruh dashboard dan membangun ulang dari konteks "Sekolah Umum Baturaja"
sudah dipertimbangkan dan **ditolak**. Jangan diajukan ulang tanpa alasan baru.

Alasannya, kosakata lama tidak tinggal di dashboard melainkan di skema:

| Lapisan | `santri` | `jilid` | `mmq` | `pentashih` |
|---|---|---|---|---|
| `src/` | 2372 | 712 | 269 | 79 |
| `backend/` | 532 | 143 | 45 | 22 |
| `supabase/migrations/` | 554 | 65 | 77 | 113 |

Ditambah 11 tabel bernama lama (`santri`, `santri_notes`, `santri_character_scores`,
`santri_behavior_records`, `jilid_history`, `mmq_*`, `hafalan_*`). Dashboard yang ditulis ulang
tetap harus memanggil `/api/santri`, membaca `santri.jilid`, dan join ke `santri_notes` — jadi
biaya penulisan ulang dibayar penuh sementara masalah penamaannya utuh.

Bukti tambahan: dari delapan bug yang ditemukan pada 2026-08-06, hanya **satu** (prop `categories`)
yang merupakan regresi migrasi. Tujuh sisanya bug backend, kontrak API, sisa scaffold, dan tooling —
tidak tersentuh oleh penulisan ulang dashboard.

**Arahnya: ganti nama, jangan tulis ulang.** Bila kosakata `santri` mau dibereskan, lakukan di
lapisan frontend saja dan manfaatkan seam yang sudah ada (`mapSantriForLegacyUi` di
`dataMasterAdapters.js`) sebagai penerjemah. API dan DB tetap `santri`. **Jangan** mengganti nama
tabel: 554 kemunculan di migrasi, dan migrasi lama tidak boleh diedit.

Dua prasyarat sebelum rename apa pun: pasang jaring test lebih dulu (saat ini **nol** framework
test), karena rename tanpa test persis melahirkan kelas bug "penghapusan meninggalkan lubang".

Satu pengecualian yang memang layak dimodelkan ulang, bukan sekadar diganti nama: **absensi**.
`sesi_mengaji` adalah konsep ngaji; SD negeri butuh jam pelajaran dan mata pelajaran. Itu perubahan
model data.

---

## 3. Status verifikasi

| Lapisan | Status |
|---|---|
| `npm run build` | Hijau, exit 0 |
| Guard `scripts/validate-*.ps1` (4 skrip) | Hijau, exit 0 |
| Kompilasi backend Go | Hijau (lewat Docker; Go tidak terpasang di mesin dev) |
| `npm run lint` | **Bersih, exit 0** |
| Login 6 akun | **Terbukti jalan** lewat API |
| 18 tab dashboard admin | **Semua merender**, nol crash — disapu satu per satu di browser |
| Panel Metode Mengaji | **Tuntas di browser**: pilih Iqro → simpan → DB → bertahan setelah muat ulang |
| Tab Rapat Guru | **Tuntas**, tab merender bersih |
| Simpan murid baru + NISN | **Masih terhalang** — lihat jebakan "password `required`" di bawah |
| `GET /api/content/feedback` | **200 OK** (sebelumnya 405) |
| `ErrorBoundary` | Terpasang; tampilan fallback-nya **belum** diuji dengan crash sengaja |

Verifikasi statis untuk NISN/Angkatan: field form (`SantriManagement.jsx:1132`) → validasi regex
(`:677`, `:683`) → normalisasi adapter (`dataMasterAdapters.js:52`) → allowlist handler
(`santri.go:63`) → kolom + `CHECK` di DB. Regex frontend **cocok persis** dengan constraint
`santri_nisn_format_chk` (10 digit) dan `santri_angkatan_format_chk` (`YYYY/YYYY`).

Metode Mengaji: `tahfizh_config` disimpan di tabel `website_content`, dan **dihidrasi untuk semua
peran** lewat `DashboardWorkspace.jsx:101`, bukan hanya di panel admin — jadi guru ikut melihat
metode pilihan sekolah. localStorage murni singgahan. Nilai tersimpan
`{"method": "iqro", "customLevels": []}`; `customLevels` kosong **memang benar** — textarea
menampilkan preset sebagai placeholder, dan kosong berarti "pakai bawaan metode".

Vite menangkap perubahan `.env.local` sendiri; mengaktifkan `VITE_ENABLE_TAHFIZH` tidak perlu
restart dev server manual.

---

## 4. Jebakan yang sudah ditemukan

### Migrasi harus benar-benar diterapkan, bukan sekadar ditulis

Migrasi `20260806000400_santri_school_identity.sql` (kolom `nisn`, `nis`, `angkatan`) sempat hanya
ditulis tanpa diterapkan. Akibatnya query login mereferensikan kolom yang tidak ada dan
**seluruh login gagal**, termasuk admin.

Terapkan dengan:

```powershell
Get-Content "supabase\migrations\<nama>.sql" -Raw |
  docker compose -f backend\docker-compose.yml exec -T db psql -U postgres -d lpq_db
```

### `resolveUser` rapuh terhadap kegagalan query santri

Di `backend/internal/handler/auth.go`, santri dicek lebih dulu. Error apa pun yang bukan
`pgx.ErrNoRows` langsung menghentikan fungsi, sehingga **query guru tidak pernah dijalankan**.
Satu query santri yang rusak menjatuhkan login semua peran.

Cacat ini sudah ada sebelum migrasi SDN dan belum diperbaiki. Layak dibenahi agar kegagalan satu
jalur tidak menjatuhkan seluruhnya.

### Worktree agen di `.claude/` melumpuhkan ESLint sepenuhnya

`npm run lint` sempat **gagal total** (exit 2, nol file terperiksa) karena ESLint menyusuri
`.claude/worktrees/<nama>/`. Worktree itu salinan repo, jadi resolver import-nya menabrak
`node_modules` repo utama dan meledak di `vite/package.json`. Sudah diperbaiki dengan menambahkan
`.claude/**` ke `ignores` di `eslint.config.mjs`.

Pelajarannya: lint yang "hijau" perlu dicek benar-benar memeriksa file, bukan cuma exit code.

Worktree `mystifying-nobel-977ad1` sudah dibongkar: registrasi git dicabut dan **seluruh 521 file
terhapus**. Sebelum dihapus, isinya dibandingkan terhadap `7f61898` lewat index sementara — salinan
persis, nol modifikasi, nol file untracked, jadi tidak ada pekerjaan yang hilang.

Sisa 13 **direktori kosong** masih ada dalam status *delete-pending* Windows (ACL-nya menolak dibaca
karena masih dipegang handle proses). Tidak berbahaya — nol file di dalamnya, sudah tidak terdaftar
di `git worktree list`, dan `.claude/**` kini diabaikan ESLint. Akan hilang sendiri setelah proses
yang memegangnya berakhir atau setelah reboot.

### Handler yang menjaga diri sendiri butuh `OptionalAuth`, bukan tanpa middleware

Seluruh panel Konten hanya bisa membaca dan **tidak pernah bisa menyimpan**. `/api/content`
di-mount di grup publik, sementara handler tulisnya menjaga diri lewat
`CanManage(RoleFromCtx(ctx))` — dan `RoleFromCtx` hanya terisi oleh `RequireAuth`. Role selalu
string kosong, `CanManage("")` selalu `false`, jadi admin pun ditolak.

Sudah diperbaiki dengan `middleware.OptionalAuth` (commit `0590ef0`): mengisi context bila ada token
valid, meneruskan tanpa menolak bila tidak ada.

**Pola yang perlu diwaspadai:** rute publik yang mencampur baca-bebas dengan tulis-khusus-admin
wajib memakai `OptionalAuth`. Tanpa middleware sama sekali, penjagaan di dalam handler jadi mustahil
lolos.

### Layar putih = crash render, bukan role kosong

Tidak ada `ErrorBoundary` sama sekali di `src/` sampai commit `63ca161`. Satu error saat render
melepas seluruh pohon React: putih total tanpa pesan.

Sekarang ada **dua lapis**, dan keduanya perlu:

- `ErrorBoundary` di `DashboardPage` — menangkap error dari komponen dashboard di bawahnya, dengan
  pesan khusus dashboard dan reset saat peran berubah.
- `ErrorBoundary` di `App.jsx` membungkus `<Routes>` — jaring terakhir. Boundary hanya menangkap
  error dari **keturunannya**; error yang dilempar komponen halaman itu sendiri lolos dari boundary
  di dalam halaman tersebut. Ini terbukti saat pengujian: melempar error di dalam `renderDashboard()`
  tetap memutihkan layar sampai lapisan `App.jsx` ditambahkan.

Keduanya sudah diuji dengan error sengaja dan menampilkan kartu pesan yang benar.

Cara membedakan gejala:

- **Putih total** → exception saat render. Cek console, bukan role.
- **Spinner "Menyiapkan Dashboard…"** → role belum terdeteksi (`DashboardPage.jsx:103`).
- **Kartu merah "Role Tidak Terdeteksi"** → ada user tapi tanpa role (`:86`).

### Form murid dulu terhalang dua kali tanpa pesan yang benar

Sudah diperbaiki (commit `02e0f62`), tapi polanya layak diingat karena keduanya **membisu**:

1. Field Password ber-atribut `required`, jadi browser memblokir submit tanpa toast dan tanpa
   request. Padahal `handleSubmit` sudah mengisi password otomatis dari NISN, sama seperti impor
   massal — pengisian otomatis itu mustahil tercapai. Diputuskan: password **opsional**, `required`
   dihapus, placeholder menjelaskan perilakunya.
2. Setelah itu muncul galat "Default SPP minimal Rp10.000 atau kosongkan" pada field yang jelas-jelas
   kosong. `resetForm()` tidak menyertakan `default_spp_amount`, jadi nilainya `undefined`;
   penjagaan lama hanya melewati `''` dan `null`, sehingga `undefined` lolos ke `Number(undefined)`
   = `NaN`.

Pelajarannya: bila submit tidak menghasilkan apa pun — tanpa toast, tanpa request — curigai validasi
HTML5. Tanyakan langsung ke form dengan `form.checkValidity()` dan `el.validationMessage`.

### Semua avatar patah dengan status 200

Sudah diperbaiki (commit `36ee210`), tapi pola kegagalannya penting: **rusak sambil membalas 200.**

`file.go` dulu menyusun `baseURL := r.URL.Scheme + "://" + r.Host`. Pada request sisi server
`r.URL.Scheme` **selalu kosong** — hanya `r.Host` terisi. Hasilnya `://localhost:8080`. Guard lama
membandingkan hasil gabungan dengan `"://"` sehingga tidak pernah kena.

`src` avatar menjadi `://localhost:8080/files/avatars/...`, diresolusi browser relatif ke origin jadi
`http://localhost:3000/://localhost:8080/...`, lalu Vite membalas index.html berstatus **200 OK**.
Karena 200, tidak ada error apa pun — avatar diam-diam jatuh ke inisial.

Skema kini diturunkan dari `r.TLS` dan `X-Forwarded-Proto`, syarat fallback jadi `r.Host == ""`.

Catatan untuk pengujian: `/app/uploads` di container **kosong** — data dummy menyimpan nama berkas
foto yang filenya tidak pernah dibuat. Jadi avatar tetap jatuh ke inisial, dan itu wajar. Untuk
menguji, buat satu berkas di `/app/uploads/avatars/santri/<id>/profile.webp`.

### "Fetch error" di console mode dev BUKAN kerusakan

Catatan sebelumnya di file ini — bahwa request kena 401 tidak diulang setelah refresh — **salah** dan
sudah dikoreksi. `apiClient.request()` memang sudah mengulang request begitu token diperbarui
(`apiClient.js:46`), dan itu terbukti berhasil.

Pesan `Fetch error from http://...: {"error":"unauthorized"}` berasal dari alat pemantau bawaan mode
pengembangan yang disuntikkan `vite.config.js:171`. Alat itu membungkus `window.fetch` dan mencatat
**setiap** respons non-OK, termasuk percobaan pertama yang memang wajar gagal sebelum token
diperbarui. Jangan mengejarnya sebagai bug; tidak muncul di build produksi.

### Email admin masih berdomain lama

`admin@lpqalfathmaulana.id` dikunci oleh constraint `user_profiles_admin_email_check` dan
`user_profiles_single_admin_idx` (migrasi `20260722000100`). Menggantinya butuh migrasi tersendiri.

---

## 5. Kredensial pengujian (data dummy lokal)

| Peran | Username | Password |
|---|---|---|
| Admin | `admin@lpqalfathmaulana.id` | `admin123` |
| Tata Usaha | `tatausaha@sdnbaturaja.sch.id` | `tatausaha123` |
| Guru | `guru@sdnbaturaja.sch.id` | `guru123` |
| Wakil Kepala Sekolah | `pentashih@sdnbaturaja.sch.id` | `pentashih123` |
| Murid | `2026041` atau `Naila` | `santri123` |

Sumber: `backend/init/03_dummy_accounts.sql`. Bukan kredensial produksi.

---

## 6. Menyalakan lingkungan

```powershell
cd backend
docker compose up -d --build     # mengompilasi Go sekaligus menyalakan DB
```

API di `:8080`, PostgreSQL di `:5432` (database `lpq_db`).

Go tidak terpasang di mesin dev, jadi **Docker adalah satu-satunya cara memverifikasi kode Go**.

---

## 7. Langkah berikutnya

Seluruh daftar sebelumnya sudah tuntas: hapus file mati, segarkan `CLAUDE.md`, uji Rapat Guru, uji
Metode Mengaji, perbaiki celah API Konten, pasang `ErrorBoundary` dua lapis dan mengujinya, perbaiki
prop `dismiss` pada toast, perbaiki alamat foto, perbaiki form tambah murid, dan hapus
`SantriDewasaManagement.jsx`.

Yang tersisa:

1. **Verifikasi visual dashboard guru dan murid** untuk perubahan hafalan (commit `066a3cb`).
   Keduanya belum dilihat langsung karena masuk sebagai peran itu menuntut pengisian kata sandi.
   Yang perlu dicek: guru melihat empat tombol (Doa, Sholat, Surat, Tahfizh) pada setiap murid, dan
   murid melihat keempat bagian hafalan.
2. **Pasang jaring test.** Saat ini **nol** framework test. Delapan bug pada 2026-08-06 semuanya
   ditemukan dengan tangan, dan tiga di antaranya membisu — tidak memunculkan pesan apa pun. Ini
   prasyarat sebelum rename kosakata apa pun.
3. Ganti email admin berdomain lama (butuh migrasi tersendiri, lihat jebakan di atas).
4. Perbaiki `resolveUser` yang rapuh (lihat jebakan di atas).
5. Modelkan ulang absensi: `sesi_mengaji` → jam pelajaran & mata pelajaran.

Sebelum menyentuh rename kosakata `santri`, baca dulu keputusan mengikat di bagian 2.

### CLAUDE.md sudah disegarkan

Isi lamanya menyesatkan setiap sesi baru. Yang diperbaiki:

- Lapisan data: `src/lib/customSupabaseClient.js` **tidak ada** dan `@supabase/supabase-js` bukan
  dependensi. Semua request lewat `src/lib/apiClient.js` ke backend Go.
- **Otorisasi ada di Go**, bukan di database. Pool tersambung sebagai superuser `postgres`, jadi
  **RLS tidak menjaga request yang hidup** — gerbangnya `RequireAuth`/`RequireRole` di
  `backend/internal/middleware/auth.go`. Rute baru wajib menambah pemeriksaan peran di Go.
- Dashboard ada **lima**, bukan empat (`TataUsahaDashboard` terlewat).
- Context auth bernama `AuthContext.jsx`, bukan `SupabaseAuthContext.jsx`.
- Edge function di `supabase/functions/` **dorman** — tidak ada satu pun pemanggil di `src/`.
- Env: tidak ada `VITE_SUPABASE_*`; yang dipakai `VITE_API_URL`.
- Hitungan disegarkan: 50 migrasi, 37 panel admin, 19 halaman, 17 handler Go.
- Ditambahkan: dua lapisan visual yang berdampingan (`sdnb/` publik vs dashboard Aurora), jebakan
  "menulis migrasi ≠ menerapkan migrasi", dan allowlist `validConfigKeys`.
