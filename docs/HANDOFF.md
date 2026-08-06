# HANDOFF — Status Migrasi SDN Baturaja

**Diperbarui:** 2026-08-06 · **Branch:** `migrate-frontpage-baru` (belum pernah di-push) · **HEAD:** `779473c`

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

**Nilai `'Pentashih'` di database TIDAK diubah.** Hanya labelnya yang diterjemahkan lewat
`ROLE_LABELS` di `GuruManagement.jsx`. Mengubah nilainya akan merusak data lama dan RLS.

Rencana migrasi drop-table untuk MMQ/jilid **dibatalkan**.

---

## 3. Status verifikasi

| Lapisan | Status |
|---|---|
| `npm run build` | Hijau, exit 0 |
| Guard `scripts/validate-*.ps1` (4 skrip) | Hijau, exit 0 |
| Kompilasi backend Go | Hijau (lewat Docker; Go tidak terpasang di mesin dev) |
| `npm run lint` | **Bisa dijalankan lagi**; sisa 5 error, semuanya dari file yatim |
| Login 6 akun | **Terbukti jalan** lewat API |
| Simpan murid baru + NISN | Rantai kode **terverifikasi statis** ujung ke ujung; klik-tayang belum |
| Panel Metode Mengaji | Penyimpanan & hidrasi **terverifikasi statis**; klik-tayang belum |
| Tab Rapat Guru | Tab & tabel DB ada; klik-tayang belum |

Verifikasi statis untuk NISN/Angkatan: field form (`SantriManagement.jsx:1132`) → validasi regex
(`:677`, `:683`) → normalisasi adapter (`dataMasterAdapters.js:52`) → allowlist handler
(`santri.go:63`) → kolom + `CHECK` di DB. Regex frontend **cocok persis** dengan constraint
`santri_nisn_format_chk` (10 digit) dan `santri_angkatan_format_chk` (`YYYY/YYYY`).

Metode Mengaji: `tahfizh_config` disimpan di tabel `website_content`, dan **dihidrasi untuk semua
peran** lewat `DashboardWorkspace.jsx:101`, bukan hanya di panel admin — jadi guru ikut melihat
metode pilihan sekolah. localStorage murni singgahan.

Yang tersisa pada ketiga item itu murni klik-tayang di browser, bukan risiko kode.

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
Worktree `mystifying-nobel-977ad1` (detached di `7f61898`) masih ada dan belum dibersihkan.

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

1. Uji simpan murid baru dengan NISN + Angkatan, pastikan bertahan setelah refresh.
2. Uji panel Metode Mengaji (`VITE_ENABLE_TAHFIZH=true`) — pilih Iqro, simpan, muat ulang.
3. Uji tab Rapat Guru.
4. Hapus tiga file mati (menunggu keputusan pengguna — lihat di bawah).
5. Push branch agar Vercel membuat Preview Deployment.

### File mati yang menunggu keputusan

| File | Kondisi |
|---|---|
| `src/components/Navbar.jsx` | Yatim. Digantikan `src/components/sdnb/SiteNav.jsx`. Mengimpor `@/lib/schoolProfile` & `@/styles/school-home.css` yang tidak ada → 2 error lint |
| `src/components/Footer.jsx` | Yatim. Digantikan `src/components/sdnb/SiteFooter.jsx`. Error impor yang sama → 2 error lint |
| `lib/customSupabaseClient.js` | Shim di akar repo, meneruskan ke `src/lib/customSupabaseClient.js` yang **sudah tidak ada** (data layer kini lewat backend Go). Tidak ada yang mengimpor → 1 error lint |

Menghapus ketiganya menuntaskan seluruh 5 error lint. Belum dieksekusi karena butuh persetujuan.

`CLAUDE.md` masih menyebut `src/lib/customSupabaseClient.js` sebagai lapisan data dan komponen
memanggil `supabase.from()`. Itu sudah tidak berlaku — semua request lewat `src/lib/apiClient.js`
ke backend Go. Perlu disegarkan.
