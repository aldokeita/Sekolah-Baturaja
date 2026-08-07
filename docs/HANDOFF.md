# HANDOFF — Status Migrasi SDN Baturaja

**Diperbarui:** 2026-08-06 · **Branch:** `migrate-frontpage-baru` (**sudah di-push**, sinkron dengan origin) · **HEAD:** `9fbe113`

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
| Hafalan | **Dipertahankan**; rute publik Qiroati dicopot, tapi hafalan tetap hidup di dashboard guru & murid | Sebagian sekolah umum punya program tahfizh |
| Jilid/Sesi di Data Murid | Filter & kolom dihapus, field tetap ada di balik flag | Jadi isian bebas, bukan dropdown Qiroati |
| Metode mengaji | Sekolah **memilih metode**, tingkat mengikuti | Qiroati/Iqro/Ummi/Wafa/Tilawati/Tahfizh-Juz/Kustom |
| Kategori murid & kelas | **Dihapus seluruhnya.** Tidak ada kelas dewasa, tidak ada PTPT, istilah TPQ tidak dipakai | SD negeri dengan satu jenis murid |
| Hafalan | Dua bentuk tetap ada, **tapi keduanya terbuka untuk semua murid** | Per Kelas 1–6 dan per Juz Al-Qur'an; status murid tidak lagi membatasi |
| Absensi | **Tetap harian, tidak diubah sama sekali** | Sudah harian sejak semula — lihat di bawah |
| Jadwal pelajaran | **Fitur baru**, tetap per periode, CRUD penuh | Tiga tabel baru, murni aditif |
| Email admin | Pindah ke `admin@sdnbaturaja.sch.id` | Konsisten dengan tiga akun staf lain |
| **Identitas sekolah** | **Dikustomisasi dari dashboard, jangan ditanam di kode** | Aplikasi ini **template yang akan dijual**; pembeli mengganti identitasnya sendiri |
| **Peran `superadmin`** | **Hanya superadmin boleh mengubah identitas website**; admin (pembeli) bebas mengelola konten | Penjual memegang identitas produk, pembeli memegang isi administrasi sekolah |

### Dua tingkat izin: superadmin vs admin

`superadmin` adalah **superset** admin — pemilik/penjual template. Nilainya ditambahkan ke enum
`app_role` lewat `20260806000700_superadmin_role.sql`.

| Aksi | admin (pembeli) | superadmin (penjual) |
|---|---|---|
| Identitas sekolah (`school_identity`) | **403** | **200** |
| Logo & ikon (`logoUrl`) | **403** | 200 |
| Konten beranda, berita, galeri, fasilitas, dll. | **200** | 200 |

Keempat baris di atas **sudah diuji lewat API**, bukan hanya dibaca dari kode.

Penjagaannya di `brandKeys` pada `content.go` — **berbasis kunci, bukan berbasis rute**, karena
router hanya melihat path sedangkan kuncinya baru diketahui dari parameter URL. Menyembunyikan tab
di frontend bukan penjagaan; server tetap menolak.

Tiga hal yang membuat superadmin tidak perlu ditambal di puluhan tempat:

- `RequireRole` **selalu memperbolehkan superadmin** secara otomatis. Ada 20+ `RequireRole("admin",…)`
  di handler; menambah `"superadmin"` satu per satu rawan terlewat dan menghasilkan lubang senyap.
- `middleware.IsAdmin(role)` mengganti seluruh perbandingan `role == "admin"` (11 tempat).
- `CanManage` kini memanggil `IsAdmin`, jadi superadmin ikut lolos.

Sisi UI punya padanannya di `src/lib/roles.js` (`isAdminRole`, `isSuperadminRole`, `canManageRole`).
Sebelum itu ada 6 komponen yang menulis `role === 'admin'` langsung, dan superadmin **kehilangan
tombol tanpa galat apa pun** di sana — Backup/Restore malah menampilkan "Akses Ditolak". Kalau
menambah pemeriksaan peran baru di UI, pakai helper itu, jangan bandingkan string.

**Akun superadmin tersembunyi dari pembeli.** Lihat §5 untuk cara kerjanya dan untuk alasan sandinya
tidak boleh ditulis di repo.

**Jebakan id akun dummy:** superadmin memakai id `…0020`, **bukan `…0014`**. Id `0014` sudah dipakai
akun murid Naila di `03_dummy_accounts.sql`; menabraknya menimpa profil murid tersebut — sempat
terjadi dan harus dipulihkan manual. Periksa id yang belum terpakai sebelum menambah akun seed.

### Ini template, bukan aplikasi satu sekolah

Keputusan ini mengubah cara menilai banyak hal: **apa pun yang khas satu sekolah harus bisa
disunting pembeli dari dashboard**, bukan menjadi konstanta di kode.

Identitas sekolah kini bersumber dari `src/lib/schoolIdentity.js`, disimpan di `website_content`
dengan kunci `school_identity`, dan disunting lewat tab **Identitas Sekolah** (tab pertama di
Manajemen Konten). Yang mengikutinya: nav dan footer publik, halaman Kontak, subjudul dashboard
admin/tata usaha/wakil kepala sekolah, judul tab browser, kuitansi pembayaran (tiga tempat), berkas
backup, notulensi rapat, dan slide baru.

Kenapa `website_content`, bukan `/api/config`: halaman publik harus bisa membacanya **tanpa token**.
`GET /api/content/website` terbuka, `/api/config` di balik `RequireAuth`. Penulisannya tetap dijaga
`CanManage` di Go, jadi tidak ada backend yang perlu diubah — dan tidak ada allowlist kunci di
`UpsertWebsiteContent`, berbeda dari `validConfigKeys` pada appconfig.

`normalizeSchoolIdentity` menggabungkan isi tersimpan dengan bawaan, jadi identitas tidak pernah
tampil bolong walau pembeli baru mengisi sebagiannya.

**Dua domain memang berbeda peruntukan, jangan "diseragamkan":** halaman publik memakai
`sekolahbta.id` (keputusan pengguna), sedangkan akun login memakai `@sdnbaturaja.sch.id`.

`index.html` statis dan dimuat sebelum React, jadi judulnya tidak bisa membaca basis data. Judul
bawaan ada di sana, dan `App.jsx` menyelaraskan `document.title` setelah identitas dimuat.

### Panel Konten: mana yang benar-benar tampil di halaman publik

Ini pernah menjadi cacat serius: panel Konten dibangun untuk desain beranda **lama**, sedangkan
halaman publik SDN yang sekarang punya isinya sendiri. Belasan field tersimpan dengan sukses tanpa
memengaruhi apa pun — pembeli menyunting, menekan simpan, dan situsnya tidak berubah, tanpa pesan
galat apa pun. **Sekarang sudah tuntas: kendali yang tak berpengaruh dicabut.**

| Kunci | Status |
|---|---|
| `school_identity` | **Tampil** — nav, footer, Kontak, Profil, dashboard, kuitansi |
| `home_content` | **Tampil** — kartu program, testimoni, FAQ di beranda |
| `profile_content` | **Tampil** — seluruh naratif halaman Profil |
| `ppdb_content` | **Tampil** — jalur, berkas, jadwal, dan syarat halaman PPDB |
| `galleryPhotos` | **Tampil** — beranda dan halaman Galeri |
| `facilities` | **Tampil** — halaman Fasilitas |
| berita & pengumuman | **Tampil** — lewat endpoint tersendiri |
| `level_config` | **Tampil** — Absensi Digital (gamifikasi) |
| `logoUrl` | **Tampil** — nav situs dan kuitansi pembayaran |
| `hafalanVideos` | Hanya dashboard murid, dan hanya bila `VITE_ENABLE_TAHFIZH` menyala |

Kendali yang **sudah dicabut** dari panel karena tidak dirender halaman mana pun: slideshow
(`heroSlides`, `slideshowTimer`, `heroOverlayOpacity`), latar CTA (`ctaBackgroundUrl`,
`ctaBackgroundOverlayOpacity`), `quotas`, `schedules`, `proofPoints`, `faqs`, `model3dSettings`,
`qiroatiVideos`, `parentingArticles`, `waliDiscussions`, dan **`enrollmentInfo`**.

`enrollmentInfo` yang terakhir itu paling buruk dari semuanya: tab "Informasi Pendaftaran" mengelola
kategori **"Murid TPQ (Anak)"** dan **"Murid Dewasa"** beserta rincian biaya sekolah Al-Qur'an —
konten LPQ utuh di dalam template sekolah dasar umum — dan tidak dirender halaman mana pun. Tab itu
kini berisi penyunting `ppdb_content` yang sungguhan; `src/lib/enrollmentContent.js` dihapus.

Tiga jebakan yang ditemukan saat mencabutnya:

- **`faqs` adalah penyunting FAQ kedua yang mati.** Beranda membaca `home_content.faq`, bukan kunci
  `faqs`. Jadi ada dua kotak FAQ di panel: satu hidup di tab Halaman Depan, satu mati. Pembeli yang
  memilih yang salah tidak akan pernah tahu mengapa tanya-jawabnya tidak muncul.
- **`quotas` dan `schedules` sempat terlihat masih dipakai.** Keduanya muncul di `TvDisplayPage.jsx`
  dan `MmqSection.jsx`, tapi itu variabel lokal dan kunci MMQ dengan nama yang sama — bukan kunci
  `website_content`. Periksa asal datanya, jangan hanya mencocokkan nama.

Kuncinya **tetap dibiarkan** di bentuk data `ContentManagement` walau kendalinya dicabut. Kalau
dihapus, "Simpan Semua Perubahan" akan menimpa isi tersimpan pembeli dengan kekosongan.

`src/components/public/home/homeUtils.js` kini hanya diimpor `ContentManagement` — tidak ada halaman
publik yang memakainya. Ia bertahan sebagai penyedia bentuk data bawaan panel.

Pola pemisahannya: **teks disunting pembeli, tampilan tetap di kode.** Gradasi, ikon, dan warna peran
ada di `PROGRAM_STYLE` serta `TESTI_STYLE` di `HomePage.jsx`, dan `FASILITAS_GAYA`, `RIWAYAT_GRADASI`,
`FOTO_GAYA`, `ORANG_GRADASI` di `ProfilePage.jsx` — semuanya dipasangkan dengan teks berdasarkan
posisi memakai modulo, jadi jumlah item boleh berubah tanpa merusak tampilan. Jangan memindahkan
gradasi atau ikon ke basis data; pembeli sekolah tidak perlu memilih warna.

Satu kekecualian yang disengaja: kalimat besar kutipan di halaman Profil (`quoteLead`) menerima
**tanda bintang** untuk menyorot satu frasa dengan warna aksen — `membawa *kecepatan belajarnya
sendiri*`. Itu satu-satunya cara pembeli menyentuh tampilan, dan ada supaya kalimat khas halaman itu
bisa diganti tanpa kehilangan aksen warnanya. Lihat `teksBeraksen`.

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

Prasyarat sebelum rename apa pun: jaring test harus menutupi area yang disentuh, karena rename tanpa
test persis melahirkan kelas bug "penghapusan meninggalkan lubang". Vitest **sudah terpasang** (40
test), tapi baru menutupi logika murni di `src/lib/` — belum cukup untuk rename lintas komponen.
Lihat bagian 7 nomor 3.

**Koreksi catatan lama:** dokumen ini pernah menulis absensi sebagai "pengecualian yang layak
dimodelkan ulang". Itu **dibatalkan** setelah pemeriksaan — lihat "Absensi TIDAK dirombak" di atas.
Jangan mengikuti kalimat lama itu.

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
| Simpan murid baru + NISN | **Tuntas di browser**: tersimpan, bertahan setelah muat ulang, murid aktif 9 → 10. Baris uji `Uji NISN Baturaja` / NISN `1234567890` / angkatan `2026/2027` masih ada di DB sebagai bukti |
| `GET /api/content/feedback` | **200 OK** (sebelumnya 405) |
| `ErrorBoundary` | **Sudah diuji** dengan crash sengaja di kedua lapisan — lihat bagian 4 |
| **Identitas sekolah tersambung** | **Tuntas lewat DB + browser**: menulis identitas berbeda ke `website_content` membuat judul tab, nama di nav, inisial logo, nama & alamat footer, serta telepon & surel halaman Kontak ikut berubah; nilai lama hilang; setelah baris uji dihapus semuanya kembali ke bawaan |
| Panel Identitas Sekolah (klik-tayang) | **Belum** — menuntut login admin, dan agen tidak boleh mengisi kata sandi. Jalur simpannya memakai `saveWebsiteContentItem` yang sudah dipakai panel Konten lain |
| **Isi beranda tersambung** | **Tuntas lewat DB + browser**: menulis `home_content` berbeda membuat kartu program (beserta labelnya), testimoni, dan FAQ di beranda ikut berubah; bawaan hilang; satu kartu tetap merender rapi dengan ikonnya; setelah baris uji dihapus semuanya kembali ke bawaan |
| Panel Isi Halaman Depan (klik-tayang) | **Belum** — alasan sama seperti panel Identitas |
| **Izin superadmin vs admin** | **Tuntas lewat API**: admin 403 pada `school_identity` dan `logoUrl`, superadmin 200, admin tetap 200 pada `home_content` |
| **Direktori staf halaman Kontak** | **Tuntas di browser**: staf asli tampil, nama karangan dan surel pribadi hilang, akun sistem tidak bocor |
| **Bentrok jam jadwal** | **Tuntas, 6 kasus batas**, lewat `scripts/validate-jadwal-bentrok.ps1` yang dapat diulang |
| **Penyaring jadwal guru & murid** | **Tuntas lewat API**: `guru_id` mengembalikan 2 jadwal guru itu, `class_id` mengembalikan 1 jadwal kelas beserta nama gurunya |
| Tampilan `JadwalSaya` di dashboard guru/murid | **Belum dilihat** — menuntut login sebagai peran itu |

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

### `resolveUser` rapuh terhadap kegagalan query santri — SUDAH DIPERBAIKI

Di `backend/internal/handler/auth.go`, santri dicek lebih dulu. Dulu error apa pun yang bukan
`pgx.ErrNoRows` langsung menghentikan fungsi, sehingga **query guru tidak pernah dijalankan** —
satu query santri yang rusak menjatuhkan login semua peran.

Sudah diperbaiki di commit `11001c8`, dan **dibuktikan lewat uji suntik kerusakan**: kolom `nisn`
sengaja di-rename supaya query santri gagal, lalu login guru/admin diuji tetap berhasil.

Polanya tetap layak diingat: pada fungsi yang mencoba beberapa jalur berurutan, kegagalan jalur
pertama tidak boleh menghentikan jalur berikutnya.

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

### Dua guru demo TIDAK punya sandi — jangan buang waktu mencobanya

`Guru Demo A` dan `Guru Demo B` (`guru-*-demo@example.invalid`) memegang seluruh kelas demo, tetapi
kolom `password`-nya kosong sehingga **tidak bisa dipakai login**. Hal yang sama berlaku untuk
`Pentashih Demo`. Satu-satunya akun guru yang bisa login adalah `guru@sdnbaturaja.sch.id`
(Siti Aminah) — dan akun itu **tidak memegang kelas apa pun**, jadi daftar muridnya kosong.

Akibatnya, memverifikasi apa pun yang bergantung pada daftar murid di dashboard guru butuh fixture
sementara. Resep yang sudah terbukti:

```sql
insert into classes (nama_kelas, sesi, id_guru, kategori, is_active)
values ('Kelas Uji Sementara','Pagi','a1fa7a10-0000-0000-0000-000000000012','Anak',true);
update santri set current_class_id='<id kelas di atas>' where nisn='1234567890';
-- setelah selesai: kosongkan current_class_id, lalu hapus kelasnya
```

Pakai murid uji `1234567890`, jangan murid demo, supaya data demo tetap utuh.

---

## 5. Kredensial pengujian (data dummy lokal)

| Peran | Username | Password |
|---|---|---|
| Admin (pembeli) | `admin@sdnbaturaja.sch.id` | `admin123` |
| Tata Usaha | `tatausaha@sdnbaturaja.sch.id` | `tatausaha123` |
| Guru | `guru@sdnbaturaja.sch.id` | `guru123` |
| Wakil Kepala Sekolah | `pentashih@sdnbaturaja.sch.id` | `pentashih123` |
| Murid | `2026041` atau `Naila` | `santri123` |

Sumber: `backend/init/03_dummy_accounts.sql`. Bukan kredensial produksi.

### Superadmin sengaja TIDAK ada di tabel itu

Akun penjual `superadmin@sekolahbta.id` ikut terkirim ke pembeli — harus, karena hanya peran itu yang
boleh mengubah identitas produk pada salinan yang terjual. Tapi **sandinya tidak tertulis di repo
mana pun**: `03_dummy_accounts.sql` hanya memuat hash bcrypt-nya. Sandi aslinya hidup di pengelola
sandi penjual saja.

Jangan pernah menuliskannya kembali ke dalam repo, termasuk ke berkas ini. Untuk menjalankan skrip
yang membutuhkannya, setel lewat variabel lingkungan sekali pakai:

```powershell
$env:SEED_SUPERADMIN_PASS = '<sandi penjual>'
pwsh -NoProfile -File scripts\validate-data-dummy-pembeli.ps1
```

Mengganti sandinya (jalankan dari mesin penjual):

```powershell
"update public.guru set password = extensions.crypt('<sandi baru>', extensions.gen_salt('bf', 12)) where id = 'a1fa7a10-0000-0000-0000-000000000020';" |
  docker compose -f backend\docker-compose.yml exec -T db psql -U postgres -d lpq_db
```

**Sandi lama `superadmin123` sudah mati** dan salah satu pemeriksaan di
`scripts/validate-data-dummy-pembeli.ps1` menjaga agar ia tidak pernah hidup lagi.

Yang menyembunyikan akun ini dari pembeli ada di `backend/internal/handler/guru.go` lewat
`hideSuperadmin`: baris superadmin disaring dari `GET /api/guru`, dan `Detail`/`Update`/`Delete`
menjawab **404, bukan 403**, supaya keberadaan akun itu sendiri tidak terungkap. `POST /api/guru`
juga menolak `role: "superadmin"` dengan 400, dan tidak ada endpoint mana pun yang bisa mengubah
`user_profiles.role` — jadi pembeli tidak punya jalan naik pangkat lewat aplikasi. Yang tidak bisa
dicegah: pembeli memegang servernya sendiri, jadi ia selalu bisa masuk lewat `psql`. Itu batas yang
memang tidak ada solusi teknisnya.

**Batas yang perlu diperhitungkan saat merencanakan verifikasi:** agen tidak boleh mengisi kata sandi
ke form login, termasuk sandi dummy di atas. Verifikasi yang menuntut masuk sebagai peran tertentu
harus dirancang begini: pengguna yang login, agen yang memeriksa. Alternatif tanpa login sama sekali
adalah menguji lewat API dengan token, atau memeriksa jalur kode plus isi database — cara itu yang
dipakai untuk membuktikan dashboard murid menerima keempat kategori hafalan.

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

Sudah tuntas juga: peran superadmin, direktori staf dari data guru, jadwal pelajaran di dashboard
guru dan murid, guard bentrok jadwal, penyembunyian akun superadmin dari pembeli,
**`SETUP.md` sebagai panduan pemasangan untuk pembeli**, halaman Profil memakai data sungguhan, serta
**aksen warna, tahun ajaran, dan tautan Maps yang benar-benar berfungsi**.

Form Identitas dan Isi Halaman Depan **sudah diuji klik**, bukan hanya jalur datanya: mengubah teks,
menambah kartu, dan menghapus kartu semuanya tersimpan dan tampil di halaman depan; identitas berlaku
seketika tanpa muat ulang dan bertahan setelah dimuat ulang penuh.

### `SETUP.md` sekarang dokumen pembeli, bukan dokumen developer

Isinya ditulis untuk orang yang membeli template dan belum pernah melihat kodenya: pemasangan,
penyalaan, penempatan di internet, lalu **bagian 7** yang mengubah sekolah contoh menjadi sekolah
pembeli — ganti sandi admin, ganti data contoh, isi konten, dan penjelasan bahwa identitas produk
dikunci untuk penjual.

Kalau mengubah alur pemasangan, `SETUP.md` harus ikut diperbarui. Catatan lama di sana pernah salah
selama berbulan-bulan: judulnya masih "LPQ Al-Fath Maulana", email admin masih
`admin@lpqalfathmaulana.id`, jumlah migrasi masih 45, dan tabel troubleshooting-nya menyuruh memasang
`docker-compose` v1 padahal proyek ini memakai `docker compose` v2. Pembeli tidak punya cara
mengetahui bahwa panduannya keliru.

`backend/.env.example` juga **tidak memuat `POSTGRES_PASSWORD`** padahal `docker-compose.yml`
mewajibkannya — jadi `cp .env.example .env` diikuti `docker compose up` selalu gagal. Sudah
ditambahkan.

### Aksen warna: satu heks menurunkan seluruh palet

Palet halaman publik dulu ditulis langsung sebagai heks di **30 berkas, 328
kemunculan**, jadi pemilih "Aksen warna" di panel Identitas tersimpan tanpa
mengubah apa pun. Ternyata palet itu bukan kumpulan warna acak melainkan **satu
sapuan yang teratur**: setiap warna adalah aksen yang digeser rona sambil menurun
kejenuhannya, pada terang yang hampir sama.

`turunkanPalet` di `src/lib/schoolIdentity.js` memakai selisih HSL tetap
(`SELISIH_PALET`) untuk menurunkan **delapan** properti CSS dari satu heks.
Sifat yang wajib dijaga: **pada aksen bawaan `#6470ff`, hasilnya sama persis
dengan palet asli desain** — diuji di `schoolIdentity.test.js`. Kalau uji itu
gagal, setiap pemasangan baru berubah tampilannya tanpa ada yang memintanya.

Tiga hal yang mudah terlewat:

- Nilai bawaan **juga** ada di `:root` pada `src/index.css`. Tanpa itu, cat
  pertama sebelum JavaScript selesai merender `var(--sekolah-…)` tanpa nilai dan
  tombol kehilangan warnanya sekejap. Mengubah `SELISIH_PALET` berarti menyamakan
  daftar itu juga.
- `applySchoolIdentity(cached)` dipanggil di akhir modul supaya pengunjung yang
  kembali tidak melihat warna bawaan berkedip ke warna sekolahnya.
- Bayangan memakai `--sekolah-aksen-rgb` (kanal dipisah spasi) karena alfa tidak
  bisa ditempelkan pada heks di dalam `var()`.

Empat berkas **sengaja** masih memuat heks palet dan jangan disapu:
`schoolIdentity.js` (bawaan), `index.css` (cadangan CSS), `schoolIdentity.test.js`
(nilai acuan), dan `SchoolIdentitySettings.jsx` (placeholder kotak isian).

### Berkas di `sdnb/generated/` disunting tangan, bukan lagi hasil generator

`tools/dc-convert.mjs` yang membuatnya **tidak** dijalankan `npm run build`, dan
berkas-berkas itu sudah beberapa kali disunting langsung — termasuk oleh sapuan
aksen dan penyambungan identitas. Menjalankan ulang generator itu akan menimpa
semuanya. Perlakukan sebagai kode biasa.

### Nama orang karangan: sudah bersih dari halaman publik

Tidak ada lagi nama karangan di halaman publik. Yang dulu ada dan sudah dibuang:
delapan guru di halaman Profil (lengkap dengan surel palsu `@sekolah.id`), penulis
berita di `NewsPage`, dan pendamping prestasi di `PrestasiPage`. Ketiganya kini
memakai Data Guru lewat `GET /api/content/teachers`.

**Kalau menambah halaman yang menampilkan orang, ambil dari endpoint itu** dan
pakai `src/lib/staf.js` (`sebutanStaf`, `inisialNama`, `stafKe`). Jangan menulis
nama contoh di kode: pada salinan yang terjual, itu berarti sekolah pembeli
memperkenalkan orang yang tidak ada.

Naratif halaman Profil dan seluruh ketentuan halaman PPDB juga sudah tidak
ditanam di kode — masing-masing di `profile_content` dan `ppdb_content` (lihat
bagian Panel Konten). Tidak ada lagi data per-sekolah yang tertulis di kode.

### Visi, misi, dan tujuan ada di tempat yang mungkin salah — perlu keputusan

Ketiganya disimpan di `school_identity`, dan kunci itu ada di `brandKeys`, jadi
**hanya superadmin yang boleh mengubahnya**. Pembeli tidak bisa menyunting visi
dan misi sekolahnya sendiri.

Ini bisa dibaca dua arah, dan belum ada keputusan pemilik. Aturan yang dipakai
sejauh ini: identitas produk milik penjual, konten administrasi sekolah milik
pembeli. Visi dan misi lebih dekat ke yang kedua — itu kalimat milik sekolah
pembeli, bukan ciri produk.

Kalau diputuskan menjadi hak pembeli, pindahkan `vision`, `missions`, dan `goals`
dari `schoolIdentity.js` ke `profileContent.js`. Tidak bisa diselesaikan dengan
menambah pengecualian di `brandKeys`: penjagaannya per-kunci, sedangkan ketiga
field itu berada **di dalam** objek `school_identity`, jadi izinnya
seluruhnya-atau-tidak.

### Yang perlu diperiksa penjual sebelum menyerahkan salinan

1. `docs/` berisi 50+ catatan pengembangan internal dan `HANDOFF.md` ini, termasuk keputusan
   komersial. Pertimbangkan menyerahkan salinan tanpa `docs/`, atau repo terpisah untuk pembeli.
2. Sandi superadmin tidak boleh pernah masuk repo. Lihat §5.
3. Jalankan `scripts/validate-data-dummy-pembeli.ps1` — 22 pemeriksaan yang membuktikan pembeli bisa
   mengganti seluruh data contoh dan tidak bisa menyentuh akun penjual.
4. Kendali `logoUrl` sudah dipindah ke tab **Identitas Sekolah** (superadmin saja). Sebelumnya ada di
   tab **Halaman Depan** yang dilihat pembeli, jadi pembeli mengunggah logo lalu ditolak 403 tanpa
   tahu sebabnya. Kalau menambah kunci ke `brandKeys`, pindahkan kendalinya sekalian.

### Bentrok jadwal diuji lewat API, bukan unit test Go — dan itu memang benar

Irisan jam dihitung di **SQL** (`jam_mulai < $selesai AND jam_selesai > $mulai`), bukan di Go.
Menguji `periksaBentrok` tanpa basis data hanya menguji pembacaan parameter, bukan logika yang
menentukan hasil. Karena itu pengujiannya berupa `scripts/validate-jadwal-bentrok.ps1` yang menembak
API sungguhan, memakai hari Sabtu agar tidak menabrak jadwal hari kerja, dan menghapus jadwal ujinya
sendiri di blok `finally`.

Enam kasus yang dijaga: slot dasar diterima, batas **bersentuhan tepat** diterima (09:50 setelah
08:40–09:50 bukan bentrok), beririsan satu menit ditolak, membungkus penuh ditolak, guru sama di
kelas lain beririsan ditolak, dan guru lain di kelas lain beririsan diterima.

**Jebakan saat menguji lewat skrip:** `$hasil += Fungsi ...` di PowerShell menangkap **seluruh**
keluaran fungsi termasuk `Write-Output` di dalamnya, sehingga skrip tampak "tidak menghasilkan apa
pun" padahal sudah menyisipkan data. Kejadian ini sempat membuat hasil uji terbaca salah — jalankan
berikutnya menolak duplikat buatan jalankan sebelumnya, dan itu disalahartikan sebagai bug aplikasi.
Cetak dengan `Write-Output` eksplisit, jangan lewat nilai balik fungsi.

Yang tersisa:

1. **Sisa identitas yang belum bisa disunting pembeli.** Identitas sekolah sudah selesai (lihat
   bagian 2), tapi masih ada yang khas satu sekolah dan tertanam di kode:
   - **Direktori staf di halaman Kontak** (`ContactPage.jsx:24-27`): empat nama orang beserta surel
     `@sekolah.id`. Ini data orang, bukan identitas lembaga — pilihannya dijadikan konten yang
     disunting admin, atau dibaca dari tabel `guru`. Belum diputuskan.
   - **Alamat di `KontakBody.jsx:138`** masih menuliskan "Jalan Dr. Moh. Hatta No. 14" secara
     harfiah. Berkas `generated/` hasil konversi mockup, jadi perlu ditangani hati-hati.
   - **Nama berkas logo** `public/logo-lpq-al-fath-maulana.webp` masih berbau LPQ. Menggantinya
     berarti memindahkan berkas plus menyesuaikan rujukannya di beberapa tempat.
   - **Contoh isi halaman publik** di `institutionContent.js` (jadwal sesi, kuota, slide hero, FAQ
     biaya TPQ, fasilitas, galeri) masih bernuansa TPQ. Isinya memang cuma nilai awal sebelum admin
     mengisi lewat panel Konten, tapi FAQ "biaya pendaftaran TPQ" jelas tidak pantas bagi pembeli.

   Nama kelas CSS `lpq-*` dan nama design system "LPQ Aurora Neo-Glass" **dibiarkan** — itu nama
   internal, tidak terlihat pengguna.

2. **Perluas jaring test.** 40 test yang ada hanya menutupi logika murni di `src/lib/`.
   Belum ada satu pun test komponen (butuh `@testing-library/react`) maupun test Go
   (`go test` hanya bisa lewat Docker). Penjagaan yang masih inline di dalam komponen
   tetap tak terjangkau sampai diekstrak seperti `validateDefaultSppAmount`.
   Sasaran paling layak berikutnya: `periksaBentrok` di `schedule.go` — logika irisan jam yang
   saat ini hanya terbukti lewat uji manual.

3. **Hubungkan jadwal pelajaran ke tempat lain.** Sekarang jadwal berdiri sendiri di panel admin.
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
