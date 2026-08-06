# HANDOFF — Status Migrasi SDN Baturaja

**Diperbarui:** 2026-08-06 · **Branch:** `migrate-frontpage-baru` (**sudah di-push**, sinkron dengan origin) · **HEAD:** `cb4c53a`

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
| Absensi | **Tetap harian, tidak diubah sama sekali** | Sudah harian sejak semula — lihat di bawah |
| Jadwal pelajaran | **Fitur baru**, tetap per periode, CRUD penuh | Tiga tabel baru, murni aditif |
| Email admin | Pindah ke `admin@sdnbaturaja.sch.id` | Konsisten dengan tiga akun staf lain |

Manajemen Kelas kini **satu panel tanpa sub-tab**. Tiga sub-tab lama (Murid TPQ, Murid PTPT, Murid
Dewasa) dicabut dan `AdultClassManagement.jsx` dihapus.

Penyaringan kategori **dihapus, bukan dipatok ke `'Anak'`**. Basis data masih menyimpan 1 kelas dan
3 murid berkategori `PTPT` dari era lama; mematoknya ke `'Anak'` akan membuat data itu tak terlihat
dan tak terkelola. Semua kelas aktif dan semua murid aktif kini tampil dalam satu daftar. Nilai
`kategori` hanya tersisa sebagai default saat membuat kelas baru.

### Absensi TIDAK dirombak, dan itu keputusan sadar

Rencana "modelkan ulang absensi" **dibatalkan setelah pemeriksaan**, bukan karena terlupa.

Tabel `attendance` **sudah harian sejak semula**: index `attendance_santri_first_daily_unique
(user_id, attendance_date) WHERE role='santri'` sudah menjamin satu catatan per murid per hari.
Tidak ada yang perlu diubah di lapisan data.

Yang membuat absensi *terasa* ngaji adalah lima sesi (Pagi/Pagi 2/Siang/Sore/Malam) di
`src/utils/sessionMapping.js` beserta `DEFAULT_SESSION_TIMES`. Membongkarnya menyentuh **27
pemanggil** (`getSessionName` 16, `buildSessionStartTimestamp` 11) yang tersebar di seluruh layar
absensi — risiko besar, manfaat kecil, dan tidak diminta.

Bila suatu saat benar-benar dirombak: jangan hapus kolom `sesi`. Sekolah bisa saja punya kelas
pagi dan siang, dan data historis di staging memakainya.

### Jadwal pelajaran memakai tabel sendiri, bukan menempel di absensi

Tiga tabel baru di `20260806000500_jadwal_pelajaran.sql`:

| Tabel | Isi |
|---|---|
| `periode_ajaran` | tahun ajaran + semester, hanya **satu boleh aktif** |
| `mata_pelajaran` | daftar mapel, 9 mapel kurikulum SD tersemai otomatis |
| `jadwal_pelajaran` | satu baris = satu slot (kelas × hari × jam) |

Jadwal ini untuk **perencanaan dan tampilan**, BUKAN untuk absen per mata pelajaran. Absensi tetap
harian dan tidak tersambung ke jadwal.

`hari` disimpan sebagai `smallint` 1..6 (Senin..Sabtu). Minggu ditolak constraint. Nama hari
Indonesia hanya label di UI.

Bentrok jam **diperiksa di Go**, bukan exclusion constraint, karena Postgres tidak punya range type
bawaan untuk `time`. Yang dijaga database hanya keabsahan baris dan duplikat persis. Bila nanti
butuh jaminan anti-balapan, buat range type kustom lebih dulu.

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
| `npm run lint` | Bersih, exit 0 |
| `npm test` | **40 test hijau** (Vitest 3, 3 berkas) |
| Guard `scripts/validate-*.ps1` | **4 dari 5 hijau** — lihat catatan di bawah |
| Kompilasi backend Go | Hijau (lewat Docker; Go tidak terpasang di mesin dev) |
| Login 6 akun | **Terbukti jalan** lewat API |
| `resolveUser` tahan kegagalan | **Terbukti lewat uji suntik kerusakan** (rename kolom `nisn`) |
| 18 tab dashboard admin | **Semua merender**, nol crash — disapu satu per satu di browser |
| Panel Metode Mengaji | **Tuntas di browser**: pilih Iqro → simpan → DB → bertahan setelah muat ulang |
| Tab Rapat Guru | **Tuntas**, tab merender bersih |
| Dashboard guru — 4 tombol hafalan | **Tuntas di browser** (Doa/Sholat/Surat/Tahfizh, Tahfizh terbuka berisi) |
| Dashboard murid — 4 bagian hafalan | **Tuntas lewat API + kode**: token murid biasa menerima Doa 44, Sholat 33, Surat 26, Tahfizh 98; kedua `program_scope` terkirim; 4 `<HafalanSection>` dirender tanpa syarat status |
| **Panel Jadwal Pelajaran** | **Tuntas di browser**: render, tambah, tolak bentrok, konfirmasi hapus, empty state kembali, 390px nol scroll horizontal |
| **CRUD jadwal lewat API** | **Tuntas**: 7 penjagaan DB + 8 alur CRUD + penjagaan peran (guru 403 menyunting, 200 membaca, 401 tanpa token) |
| **Email admin domain baru** | **Tuntas**: email baru masuk, email lama ditolak, 4 akun lain tanpa regresi |
| Simpan murid baru + NISN | **Masih terhalang** — lihat jebakan "password `required`" di bawah |
| `GET /api/content/feedback` | **200 OK** (sebelumnya 405) |
| `ErrorBoundary` | **Sudah diuji** dengan crash sengaja di kedua lapisan — lihat bagian 4 |

### Guard kelima tidak bisa jalan di mesin dev, dan itu wajar

Ada **lima** skrip `validate-*.ps1`, bukan empat seperti tercatat sebelumnya.
`validate-production-migration-local.ps1` selalu gagal dengan "Safe summary tidak
ditemukan" karena menuntut `_private_reference/migration-work/prepared-production-data/safe-summary.json`
dan container `supabase_db_*`. Keduanya **tidak ada** di repo maupun di Docker sini —
skrip itu validator gladi resik migrasi produksi, bukan guard harian.

Menjalankan kelimanya dalam satu loop akan berhenti di skrip ini dan
`validate-seed-dummy-only.ps1` tak pernah ikut terjalankan. Jalankan satu per satu,
atau lewati yang produksi.

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

### Kolom `time` pgx jadi objek, bukan string — dan uji API bisa melewatkannya

Jam pada jadwal sempat tampil `[obje–[obje` di layar. Kolom `time` dipetakan pgx ke `pgtype.Time`,
yang menjadi `{"Microseconds":25200000000,"Valid":true}` begitu di-JSON-kan — bukan `"07:00"`.

Sudah diperbaiki: `schedule.go` memakai daftar kolom eksplisit dengan `to_char(...,'HH24:MI')`,
dan insert/update **membaca ulang** barisnya lewat `jadwalByID` karena `RETURNING *` mengembalikan
bentuk `pgtype.Time` lagi.

**Pelajaran yang lebih penting dari bug-nya:** uji API sebelumnya lulus semua padahal bug ini ada,
karena hanya memeriksa kolom teks (`ruang`, `mata_pelajaran_nama`) dan tidak pernah menyentuh field
jam. Bila menambah kolom bertipe `time`, `date`, `numeric`, atau `interval`, **periksa bentuk JSON-nya
sendiri**, jangan cuma cek request berhasil.

### `.playwright-mcp/` melumpuhkan ESLint, persis seperti `.claude/worktrees`

Begitu skill Playwright dipakai, direktori `.playwright-mcp/` muncul dan di Windows sering terkunci
proses. ESLint **gagal total** (exit 2, nol berkas diperiksa) saat traversal glob menabraknya —
bukan gagal lint, tapi gagal membaca direktori.

Sudah ditambahkan ke `ignores` di `eslint.config.mjs` dan ke `.gitignore`. Pola yang sama pernah
terjadi pada `.claude/worktrees`. Bila ESLint tiba-tiba exit 2, curigai direktori artefak alat bantu
lebih dulu, bukan kode.

Cara memastikan lint benar-benar memeriksa berkas, bukan sekadar exit 0:

```powershell
npx eslint src/lib/scheduleAdapters.js --format json | ConvertFrom-Json |
  ForEach-Object { "$($_.filePath): $($_.messages.Count) temuan" }
```

### Email admin: catatan lama SALAH, dan sudah dibereskan

Catatan sebelumnya menyebut `admin@lpqalfathmaulana.id` dikunci constraint
`user_profiles_admin_email_check` dan index `user_profiles_single_admin_idx`.
**Keduanya sudah dihapus** oleh `20260723000200_enable_guru_admin_roles.sql` sejak lama — tidak ada
constraint apa pun yang mengunci email admin di tingkat database.

Email sudah dipindahkan ke `admin@sdnbaturaja.sch.id` lewat `20260806000600_admin_email_domain.sql`.
Migrasinya idempoten dan **berhenti diam-diam** bila email tujuan sudah dipakai akun lain, karena
menimpanya akan mengunci dua orang keluar sekaligus.

---

## 5. Kredensial pengujian (data dummy lokal)

| Peran | Username | Password |
|---|---|---|
| Admin | `admin@sdnbaturaja.sch.id` | `admin123` |
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
prop `dismiss` pada toast, perbaiki alamat foto, perbaiki form tambah murid, hapus
`SantriDewasaManagement.jsx`, verifikasi hafalan sisi guru dan murid, pasang jaring test, perbaiki
`resolveUser`, **ganti email admin**, dan **bangun jadwal pelajaran beserta CRUD-nya**.

Absensi **sengaja tidak dirombak** — alasannya di bagian 2, jangan diajukan ulang tanpa alasan baru.

Yang tersisa:

1. **Bereskan sisa identitas LPQ yang masih tampil ke pengguna.** Ini yang paling terlihat sekarang:
   - Dashboard admin bertulis "Kelola seluruh sistem **LPQ Al-Fath Maulana**"
   - Judul tab browser "Dashboard - **LPQ Al-Fath Maulana**"
   - `src/lib/institutionContent.js` menyimpan identitas LPQ seutuhnya (nama, website
     `lpqalfathmaulana.id`, visi, misi, deskripsi Qiroati) dan **masih hidup** di dua komponen:
     `CallToAction.jsx` dan `PaymentStatusPage.jsx`

   AGENTS.md melarang memakai identitas lembaga sumber, jadi ini bukan sekadar kosmetik. Tapi
   menggantinya butuh **keputusan konten dari pengguna**: nama resmi, alamat, telepon, visi, misi.
   Jangan mengarang sendiri. Catatan: halaman publik SDN memakai `sdnbaturaja@sekolah.id`,
   sedangkan akun login memakai `@sdnbaturaja.sch.id` — dua domain berbeda, perlu diselaraskan.

2. **Putuskan nasib dua berkas yatim**: `src/components/Navbar.jsx` dan `src/components/Footer.jsx`.
   Tidak ada yang mengimpor keduanya, dan keduanya mengimpor berkas yang sudah dihapus.
   Menunggu persetujuan pengguna untuk dihapus.

3. **Perluas jaring test.** 40 test yang ada hanya menutupi logika murni di `src/lib/`.
   Belum ada satu pun test komponen (butuh `@testing-library/react`) maupun test Go
   (`go test` hanya bisa lewat Docker). Penjagaan yang masih inline di dalam komponen
   tetap tak terjangkau sampai diekstrak seperti `validateDefaultSppAmount`.
   Sasaran paling layak berikutnya: `periksaBentrok` di `schedule.go` — logika irisan jam yang
   saat ini hanya terbukti lewat uji manual.

4. **Hubungkan jadwal pelajaran ke tempat lain.** Sekarang jadwal berdiri sendiri di panel admin.
   Yang masuk akal berikutnya: guru melihat jadwal mengajarnya di dashboard sendiri, dan murid
   melihat jadwal kelasnya. Endpoint `GET /api/schedule/jadwal?guru_id=` dan `?class_id=` sudah
   tersedia dan sudah diuji.

### Cara memakai jaring test

```powershell
npm test          # sekali jalan
npm run test:watch
```

Konfigurasi di `vitest.config.js` (berdiri sendiri, tidak memuat plugin build; environment
`jsdom` karena beberapa modul menyinggung localStorage saat dimuat).

**Test baru wajib dibuktikan menangkap sesuatu.** Cara yang dipakai di sini: kembalikan bug
lamanya sebentar, pastikan test jatuh, lalu pulihkan. Tanpa langkah itu, test hijau tidak
membuktikan apa pun — percobaan pertama pada `normalizeDefaultSppAmount` lulus terus
meski bug-nya disuntik ulang, karena fungsi itu memang tidak pernah jadi sumber masalah.

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
