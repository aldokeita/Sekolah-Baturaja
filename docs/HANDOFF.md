# HANDOFF — Status Migrasi SDN Baturaja

**Diperbarui:** 2026-08-15 · **Branch:** `feat/vercel-ready`

Pekerjaan berjalan di `feat/vercel-ready`, dengan dua remote: `origin` (aldokeita) dan
`upstream` (npdkdev). Branch ini belum di-merge ke `master`.

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
| **Shift masuk** | **Hanya Pagi & Siang.** Sore, Malam, dan "Pagi 2" dihapus | SD negeri masuk pagi; yang kekurangan ruang kelas membagi rombel jadi dua shift. Sore/Malam adalah jadwal madrasah, tidak pernah terjadi di SD |
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
| **PPDB** | **Modul sungguhan dengan tabel dan panelnya sendiri**, bukan lagi dititipkan ke `feedbacks` | Pendaftaran punya siklus hidup dan 20 kolom; pesan pengunjung tidak punya satu pun |
| **Istilah SPMB** | **Seluruh tulisan yang dilihat orang memakai SPMB, bukan PPDB.** Nama berkas, tabel, dan rute TIDAK diubah | Permendikdasmen No. 3 Tahun 2025 mencabut aturan PPDB; lihat "Aturan SPMB 2025" di bawah |
| **Kuota jalur** | **Angka pemerintah jadi bawaan, sistem TIDAK menegur** bila dilanggar | Ada kondisi lapangan yang tidak bisa ditebak sistem; memblokir berisiko melumpuhkan tata usaha |
| **Bisyaroh (gaji guru)** | **DICABUT PERMANEN.** Panel dan berkasnya dihapus | Tidak pernah menyimpan apa pun, dan tarifnya memakai istilah sekolah Al-Qur'an — lihat "Bisyaroh dicabut" di bawah |
| **Warna sekolah** | **Dua warna saja** (atau satu bila solid). Palet tidak boleh memunculkan rona ketiga | Sekolah memilih dua warna; warna ketiga yang diturunkan mendarat di rona yang tidak dipilih siapa pun |

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

Model data absensi tetap harian dan tidak diubah. Sejak 2026-08-09, perhitungan rekap murid/guru,
matriks detail, ringkasan performa, laporan rapor, statistik absensi, dan validasi kios membaca
`academic_calendar_month_settings` serta agenda manual sebagai sumber hari aktif. Konfigurasi
Sabtu aktif memasukkan Sabtu ke total hari belajar dan persentase; konfigurasi yang tidak tersedia
tetap memakai bawaan lama (Sabtu dan Minggu libur otomatis). Agenda manual `Libur` tetap menang,
dan `Hari Masuk` tetap dapat mengesampingkan libur otomatis. Tidak ada baris absensi yang diubah.

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
test persis melahirkan kelas bug "penghapusan meninggalkan lubang". Vitest **sudah terpasang** (183
test pada 10 berkas), tapi baru menutupi logika murni di `src/lib/` — belum cukup untuk rename lintas
komponen. Test Go langsung baru ada untuk utilitas berkas (`backend/internal/handler/file_test.go`),
bukan untuk jadwal.
Lihat bagian 7 nomor 3.

**Koreksi catatan lama:** dokumen ini pernah menulis absensi sebagai "pengecualian yang layak
dimodelkan ulang". Itu **dibatalkan** setelah pemeriksaan — lihat "Absensi TIDAK dirombak" di atas.
Jangan mengikuti kalimat lama itu.

---

## 3. Status verifikasi

| Lapisan | Status |
|---|---|
| Build produksi (`node tools/build.js`) | Hijau, exit 0 |
| Lint langsung (`node node_modules/eslint/bin/eslint.js . --quiet`) | Bersih, exit 0 |
| Vitest langsung (`node node_modules/vitest/vitest.mjs run`) | **189 test hijau** (11 berkas) |
| Guard `scripts/validate-*.ps1` | **7 dari 8 hijau** — lihat catatan di bawah |
| Kompilasi backend Go | Hijau (lewat Docker; Go tidak terpasang di mesin dev) |
| Login 6 akun | **Terbukti jalan** lewat API |
| `resolveUser` tahan kegagalan | **Terbukti lewat uji suntik kerusakan** (rename kolom `nisn`) |
| 18 tab dashboard admin | **Semua merender**, nol crash — disapu satu per satu di browser |
| **Navigasi Manajemen Konten Website** | **Tuntas di browser**: 11 tab datar disusun menjadi 6 kelompok untuk superadmin dan 5 kelompok untuk admin; semua sub-tab dan panel lama tetap tersedia |
| **Editor konten & layar operasional** | **Tuntas di smoke test browser 2026-08-09**: Program, Prestasi, Ekstrakurikuler, Media/Galeri/Fasilitas, Informasi Pendaftaran, TV Display, serta formulir SPMB merender tanpa crash; tidak ada penyimpanan atau pengiriman data dilakukan |
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
| Panel Identitas Sekolah (klik-tayang) | **Tuntas** — verifikasi klik tercatat pada 2026-08-08; jalur simpan memakai `saveSchoolBrand`/`saveWebsiteContentItem` dan hak ubah tetap superadmin-only |
| **Isi beranda tersambung** | **Tuntas lewat DB + browser**: menulis `home_content` berbeda membuat kartu program (beserta labelnya), testimoni, dan FAQ di beranda ikut berubah; bawaan hilang; satu kartu tetap merender rapi dengan ikonnya; setelah baris uji dihapus semuanya kembali ke bawaan |
| Panel Isi Halaman Depan (klik-tayang) | **Tuntas** — verifikasi klik tercatat pada 2026-08-08; perubahan teks, tambah, dan hapus tersimpan serta tampil publik |
| **Izin superadmin vs admin** | **Tuntas lewat API**: admin 403 pada `school_identity` dan `logoUrl`, superadmin 200, admin tetap 200 pada `home_content` |
| **Direktori staf halaman Kontak** | **Tuntas di browser**: staf asli tampil, nama karangan dan surel pribadi hilang, akun sistem tidak bocor |
| **Bentrok jam jadwal** | **Tuntas**: implementasi dan keenam kasus API lulus pada rerun 2026-08-09; skrip kini membuat fixture periode sementara bila DB lokal belum memiliki periode aktif lalu membersihkannya kembali |
| **Penyaring jadwal guru & murid** | **Tuntas lewat API**: `guru_id` mengembalikan 2 jadwal guru itu, `class_id` mengembalikan 1 jadwal kelas beserta nama gurunya |
| Tampilan `JadwalSaya` di dashboard guru/murid | **Tuntas di kode dan verifikasi sebelumnya** — komponen baca-saja terpasang di kedua dashboard dan memakai filter `guru_id`/`class_id`; smoke test peran perlu diulang hanya bila ingin bukti browser terbaru |
| **PPDB — validasi server** | **Tuntas lewat API, 10 kasus**: nama <3 huruf, tanpa jenis kelamin, tanggal lahir kosong/masa depan, NISN 5 angka, NIK 10 angka, email ngawur, HP terlalu pendek, alamat kosong, NISN ganda — semuanya ditolak dengan pesan Indonesia |
| **PPDB — penjagaan peran** | **Tuntas lewat API**: tanpa token 403 pada daftar & statistik, guru 403, tata usaha 200 menyunting tapi **403 menghapus**, admin 200 |
| **PPDB — kirim ganda** | **Tuntas**: pengiriman kedua mengembalikan id & nomor yang sama, `duplikat: true`, tanpa baris kedua |
| **PPDB — nomor & normalisasi** | **Tuntas**: `PPDB-2026-0001…0003` berurutan; `+62 812-3456-7890` dan `6281377778888` tersimpan `081234567890` / `081377778888` |
| **PPDB — formulir publik di browser** | **Tuntas**: keempat langkah diisi, formulir kosong ditolak dengan spanduk galat, kirim berhasil menampilkan **nomor asli dari server**, seluruh 20 kolom terbukti masuk kolomnya masing-masing di DB |
| **PPDB — panel di browser** | **Tuntas**: kartu ringkasan, penyaring tahun & status, rincian terbuka, simpan catatan (PUT), ubah status, cacah ikut berubah, nama berkas terbaca, CSV berisi 21 kolom |
| **PPDB — pagination daftar** | **Tuntas di kode & build**: total dihitung setelah filter, API memakai `X-Total-Count` dengan halaman maksimal 200, panel menampilkan 50 baris per halaman, dan CSV mengambil seluruh hasil yang cocok |
| **PPDB — jejak keputusan** | **Tuntas**: menyunting catatan saja TIDAK menyentuh `diproses_pada`; mengubah status mencatat pelaku & waktu |
| **Info Sekolah (pembeli) di browser** | **Tuntas**: visi, telepon, dan misi disimpan lewat panel → masuk `school_info`, `school_identity` tidak tersentuh, terbaca publik tanpa token; nilai uji sudah dipulihkan |
| **Pemilih dua warna di browser** | **Tuntas sebagai superadmin**: mode solid menyembunyikan warna kedua dan meratakan seluruh sapuan; hijau→jingga menghasilkan rona 146→124→111→38 tanpa satu pun keluar rentang, `aksen-hangat` rona 38° sama dengan warna akhir (dulu magenta). Tidak disimpan — identitas tersimpan tetap bawaan |
| **Tampilan ponsel 375px** | **Tuntas, 10 halaman publik** nol geser mendatar; formulir PPDB dari terpotong-tanpa-bilah-geser menjadi satu kolom penuh; panel PPDB dashboard nol elemen keluar layar |
| **PPDB — Diterima jadi murid** | **Tuntas lewat API + browser**: dialog terisi usulan nomor `2026042` & daftar kelas; tersimpan membuat baris `santri` berisi 16 field yang benar (jenis kelamin jadi "Perempuan", nomor wali diutamakan), `class_mutations` tercatat dengan `from_class_id` NULL, `user_profiles` peran santri dibuat, pendaftaran tertaut |
| **PPDB — murid baru bisa login** | **Tuntas**: NISN `0011223344` maupun nomor induk `2026042` keduanya menerima token dengan sandi awal NISN |
| **PPDB — konversi ganda ditolak** | **Tuntas**: penekanan kedua menerima 409 "sudah dicatat sebagai murid"; konversi sebelum status Diterima juga ditolak |
| **PPDB — pembatas laju** | **Tuntas**: kiriman ke-1 sampai 12 diterima, ke-13 dan ke-14 menerima **429** beserta pesan Indonesia |
| **PPDB — cek status publik** | **Tuntas di browser tanpa login**: nomor + tanggal lahir benar menampilkan status; tanggal lahir salah menampilkan pesan yang sama dengan nomor tidak ada (tidak membocorkan bahwa nomornya benar) |
| **PPDB — pesan WhatsApp** | **Tuntas di browser**: `window.open` disadap, tautan `wa.me/6281299887766` dengan pesan lengkap berisi nama ibu, nama anak, nomor pendaftaran, telepon & nama sekolah |
| **Tampilan ponsel dashboard** | **Tuntas, 19 panel disapu** pada 375px. Dua ditemukan rusak dan diperbaiki (bilah sub-tab Konten 1144px, Pengaturan TV 444px); sapuan ulang nol panel bergeser |
| **Istilah SPMB** | **Tuntas di browser**: halaman pendaftaran nol kemunculan kata "PPDB", judul "Formulir pendaftaran murid baru", ketiga jalur sah (Domisili/Afirmasi/Mutasi) beserta keterangannya, syarat usia menyebut prioritas 7 tahun, nomor baru `SPMB-2026-0002` |
| **Kuota & daya tampung** | **Tuntas di browser**: 3 kelas × 28 = 84 kursi → Domisili 70% = 58, Afirmasi 15% = 12, Mutasi 5% = 4; menerima satu pendaftar domisili mengubah kolom Diterima menjadi 1 dan Sisa menjadi 57 secara langsung |
| **Impor dari Pesan Masuk** | **Tuntas lewat API + browser**: 5 pesan ditemukan, 1 diimpor, 4 dilewati dengan alasan yang benar satu per satu; seluruh 18 kolom terurai tepat; `—` menjadi kosong; dijalankan ulang tidak menggandakan; pesan aslinya tetap ada |
| **Impor — dua jebakan penguraian** | **Ditemukan lewat uji dan diperbaiki**: `nama_ayah` hilang, dan `no_hp_wali` menyerap angka dari baris berikutnya menjadi 14 digit. Keduanya terbukti benar setelah perbaikan |
| **Cetak bukti** | **Tuntas**: aturan `@media print` terurai (6 aturan), dan saat diterapkan sebagai uji hanya blok bukti yang terlihat — judul halaman, formulir, dan navigasi tersembunyi; kepala surat muncul; tombol Cetak tidak ikut tercetak |
| **Wilayah domisili — penjagaan server** | **Tuntas lewat API**: kosong ditolak, wilayah karangan ditolak, wilayah sah diterima, beda besar-kecil huruf diterima. Empat ejaan berbeda (termasuk berspasi tepi) tersimpan menjadi **dua** nilai kanonik, dan penyaring menemukan ketiganya |
| **Wilayah domisili — formulir** | **Tuntas di browser**: pemilih memuat daftar sekolah, mengirim tanpa memilih ditolak dengan spanduk galat, memilih lalu mengirim berhasil (`SPMB-2026-0005`), dan nilainya masuk kolom `wilayah` |
| **Penyaring wilayah di panel** | **Tuntas di browser**: menyaring "Kelurahan Baturaja Timur" menyisakan tepat satu pendaftar yang benar |
| **Lembar rekap** | **Tuntas di browser**: keempat pengelompokan terisi, total 5 pendaftar konsisten, dan pemecahan wilayah 4/1 benar |
| **Cetak lembar rekap dari dashboard** | **Tuntas**: aturan cetak terbukti dimuat DI DASHBOARD (4 aturan `.bukti-cetak`) setelah dipindah ke `cetak-bukti.css`; saat diterapkan, bilah menu dan kartu statistik tersembunyi dan hanya lembar rekap berkepala surat yang terlihat |
| **Akses peran ke data inti** | **Tuntas lewat API**: admin, tata usaha, dan superadmin ketiganya 200 pada `/api/santri`, `/api/guru`, `/api/classes`, `/api/academic/murojah`, `/api/ppdb`, dan **PUT murid berhasil** — sebelumnya tata usaha & superadmin 403 pada dua di antaranya. Guru tetap 403 pada `/api/ppdb` |
| **Penjaga akses peran bisa gagal** | **Terbukti**: bug-nya dimasukkan kembali dengan sengaja, `validate-akses-peran.ps1` melaporkan `FAIL tata_usaha /api/santri -> 403` dan keluar bukan-nol; perbaikannya lalu dipulihkan dan guard hijau kembali |
| **Pencabutan Bisyaroh** | **Tuntas di browser**: tab Bisyaroh hilang (19 → 18 tab admin), dan **kedelapan belas panel sisanya dibuka satu per satu** dengan sesi yang sah — nol panel kosong, nol pesan galat. Dashboard tata usaha 16 tab, Data Murid kini memuat daftar murid |
| **Data Guru — hash sandi tak lagi bocor** | **Tuntas lewat API**: `GET /api/guru` sebagai admin tidak lagi memuat field `password`; sebelumnya `SELECT *` mengembalikan hash bcrypt tiap guru ke klien mana pun |
| **Manajemen Kelas — pindah sinkron membership** | **Tuntas lewat API**: memindahkan murid membuat `Detail` kelas tujuan (yang baca `class_memberships`) langsung memuatnya, kelas lama tidak lagi; pindah ke kelas sama ditolak 400 |
| **Kalender publik tanpa login** | **Tuntas lewat API**: `GET /api/public/calendar` menjawab tanpa token dan hanya event `is_public`; buat event → muncul di endpoint publik → hapus, semuanya jalan; tanggal ngawur ditolak 400 |
| **Hari aktif kalender ↔ rekap absensi** | **Tuntas pada 2026-08-09**: rekap murid/guru, detail kelas/murid, ringkasan guru, rapor, statistik bulanan, dan kios memakai agenda lengkap + konfigurasi Sabtu per bulan; API guru dapat membaca konfigurasi, browser Agustus 2026 menunjukkan **7 hari aktif** (termasuk Sabtu 1 dan 8); konfigurasi uji dihapus kembali |

### Guard kelima tidak bisa jalan di mesin dev, dan itu wajar

Ada **delapan** skrip `validate-*.ps1`.

**`validate-akses-peran.ps1` ditambahkan setelah audit modul**, dan alasannya perlu
diingat: seluruh uji dan guard lain memakai akun **admin**, sehingga cacat yang
hanya menimpa `tata_usaha` dan `superadmin` lolos berbulan-bulan (lihat bagian
"Tata usaha dan superadmin terkunci dari Data Murid"). Guard ini masuk sebagai tiap
peran lalu memastikan jalur inti terbuka — dan memastikan guru TETAP ditolak pada
`/api/ppdb`. Penjaganya sendiri sudah diuji: bug-nya dimasukkan kembali dengan
sengaja, guard-nya gagal dan keluar bukan-nol, lalu perbaikannya dipulihkan.

Bila menambah peran baru, tambahkan ia ke guard ini juga.

`validate-production-migration-local.ps1` selalu gagal dengan "Safe summary tidak
ditemukan" karena menuntut `_private_reference/migration-work/prepared-production-data/safe-summary.json`
dan container `supabase_db_*`. Keduanya **tidak ada** di repo maupun di Docker sini —
skrip itu validator gladi resik migrasi produksi, bukan guard harian.

Menjalankan semuanya dalam satu loop akan berhenti di skrip ini dan
`validate-seed-dummy-only.ps1` tak pernah ikut terjalankan. Jalankan satu per satu,
atau lewati yang produksi.

**`validate-migration-order.ps1` memasang daftar nama migrasi secara literal.**
Menambah migrasi baru berarti menambahkan namanya ke `$expectedNames` di skrip itu,
kalau tidak guard-nya gagal dengan "Expected N migration files, found N+1". Ini
kejadian nyata saat `20260807000100_pendaftaran_ppdb.sql` ditambahkan.

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

### `X-Total-Count` tidak di-expose CORS — seluruh paginasi lumpuh — SUDAH DIPERBAIKI

Backend mengirim `X-Total-Count`, tapi `corsMiddleware` tidak menyertakan
`Access-Control-Expose-Headers`. Browser menyembunyikan header itu dari JavaScript, jadi
`res.headers.get('X-Total-Count')` selalu `null`.

Di `apiClient.js` penjagaannya memperburuk keadaan: `Number(null)` menghasilkan `0`, dan `0` lolos
`Number.isFinite`, sehingga fallback panjang array **tidak pernah terpakai**. Setiap panel
berhalaman melaporkan `total = 0`, `totalPages` jatuh ke 1, dan tombol **Berikutnya mati permanen**.
Baris di halaman kedua ke atas tidak bisa dibuka sama sekali — murid ke-11 benar-benar hilang dari
panel Data Murid meski ada di basis data.

Terkena: Data Murid, Rekap Absensi Murid, Riwayat Bayar, Pendaftaran SPMB, Log Login.

Dua perbaikan, keduanya diperlukan:

- `backend/main.go` — `Access-Control-Expose-Headers: X-Total-Count`.
- `src/lib/apiClient.js` — bedakan header hilang dari header bernilai `"0"`; periksa string
  mentahnya, bukan hasil `Number()`-nya.

Polanya layak diingat: **header respons kustom tidak terbaca lintas asal kecuali di-expose**, dan
`Number.isFinite` bukan alat untuk mendeteksi nilai yang tidak ada.

### `fetchClassList()` tanpa `includeGuru` mengosongkan kolom guru

`/api/classes` hanya menyertakan data guru bila diminta `include_guru=true`. `SantriManagement`
memanggilnya tanpa argumen, jadi `cls.guru` selalu `undefined` dan kolom **GURU PENGAMPU** berbunyi
"Belum ada guru" untuk seluruh murid — padahal wali kelasnya terisi dan Manajemen Kelas
menampilkannya dengan benar.

Gejalanya menipu karena terlihat seperti data yang belum diisi, bukan permintaan yang kurang lengkap.

### Panel Log Aktivitas Login tidak pernah mencatat apa pun — SUDAH DIPERBAIKI

`recordLoginAttempt` di `src/lib/loginSecurityAdapters.js` diekspor lengkap dengan rate limit di
sisi backend, tetapi **tidak dipanggil satu berkas pun**. Panelnya hidup dan endpointnya bekerja;
yang hilang hanya pemanggilnya. Efeknya panel keamanan yang tampak berfungsi padahal isinya beku.

Sekarang `AuthContext.signInWithUsername` memanggilnya di dua cabang: gagal (sebelum melempar error)
dan berhasil (setelah `apiClient.setTokens`, supaya backend bisa membaca `user_id` dan `role` dari
Bearer token, bukan dari badan permintaan).

Ikutannya: constraint `login_logs_role_check` hanya mengenal admin/guru/santri/pentashih, sehingga
sesi `tata_usaha` dan `superadmin` tersimpan dengan role NULL dan tampil "Peran: N/A". Diperluas
oleh `20260815000700_login_logs_role_lengkap.sql`; daftar di `loginRoleAllowed` (loginlogs.go) harus
tetap sama persis dengan constraint tersebut.

### Kalender akademik kosong membuat rekap kehadiran salah hitung

`academic_calendar` tidak berisi satu baris pun, jadi 17 Agustus tampil sebagai Hari Efektif.
Dampaknya bukan kosmetik: `GuruAttendanceRecap` dan Rekap Absensi Murid menurunkan hari efektif dari
kalender, sehingga setiap libur yang tidak tercatat menaikkan penyebut dan menurunkan persentase
kehadiran semua orang.

`20260815000800_libur_nasional_tanggal_tetap.sql` menyemai lima libur **bertanggal tetap** untuk
2026–2030: Tahun Baru Masehi, Hari Buruh, Hari Lahir Pancasila, Hari Kemerdekaan, dan Natal.

Yang **sengaja tidak disemai**: libur yang tanggalnya ditetapkan SKB 3 Menteri tiap tahun — Idul
Fitri, Idul Adha, Tahun Baru Islam, Maulid Nabi, Isra Mikraj, Imlek, Nyepi, Waisak, Wafat Isa
Almasih, Kenaikan Isa Almasih, dan seluruh cuti bersama. Tanggalnya mengikuti kalender
lunar/lunisolar dan baru pasti setelah SKB terbit; menebaknya di migrasi menanam tanggal salah yang
sulit ditemukan. Sekolah memasukkannya lewat panel Kalender.

### Tidak ada periode ajaran aktif — konsumen ketat diam-diam kosong

Seluruh baris `periode_ajaran` berangkat dengan `is_active = false`. Panel Jadwal Pelajaran
menutupi keadaan itu karena punya fallback ke periode pertama, jadi pengelola tidak pernah tahu ada
yang kurang. Konsumen yang menyaring ketat justru kosong terus:

- `TVDisplayPage` panel "Jadwal Hari Ini" mensyaratkan `p.is_active` tanpa fallback — layar lobi
  selamanya menulis "Tidak ada jadwal untuk hari ini".
- `ModulNilai`, `ModulKontenKelas`, dan `JadwalSaya` memilih periode aktif lebih dulu; tanpa penanda
  itu ketiganya bergantung pada urutan baris.

`20260815000900_aktifkan_periode_ajaran.sql` menyalakan satu periode bila belum ada yang aktif, dan
panel Jadwal kini memasang peringatan bila keadaan itu terulang.

Polanya: **fallback yang ramah di satu panel bisa menyembunyikan keadaan yang mematikan panel lain.**

### Kolom Sesi di Rekap SPP membaca kolom warisan yang sudah dikosongkan

`PaymentRecap` mengambil `santri.sesi_mengaji`. Sejak `20260815000600_santri_sesi_ikut_kelas.sql`
kolom itu sengaja NULL untuk hampir semua murid, karena shift memang tinggal di kelasnya. Akibatnya
kolom Sesi kosong melompong. Sekarang panel memuat daftar kelas dan menurunkan shift dari
`class.sesi`, dengan `sesi_mengaji` tetap didahulukan bila baris muridnya memang mengisi.

Ikutan yang ditemukan bersamaan: `paymentItemsList` di berkas yang sama masih memuat item Qiroati
(Buku Jilid Pra TK, Buku Jilid 1-6, Gharib & Tajwid) yang tidak pernah lagi muncul di kasir,
sementara Sarpras dan LKS yang benar-benar dipakai justru tidak terdaftar. Daftar itu harus sejalan
dengan `paymentItems` di `PaymentSystem.jsx`.

### Pembeli hanya menerima TIGA murid contoh

Dulu `supabase/seed.sql` menyemai delapan murid dan `backend/init/03_dummy_accounts.sql` satu lagi,
jadi setiap pemasangan baru memberi pembeli sembilan baris contoh yang harus dihapus satu per satu.

Sekarang tepat tiga: dua dari seed (`Murid Contoh Satu`, `Murid Contoh Dua`, keduanya di Kelas 1A)
dan `Naila Rahmadani` dari `03_dummy_accounts.sql`, yang memegang akun login murid dan ditempatkan
ke Kelas 2A. Kelas 3A dibiarkan kosong dengan sengaja supaya pembeli melihat tampilan kelas yang
belum terisi.

Tiga hal yang harus ikut berubah bila jumlahnya diubah lagi:

1. Daftar stub `auth.users` di `backend/init/01_migrate.sh` — ini FK target bagi `user_profiles`,
   `guru`, dan `santri`. Stub yang tertinggal menyisakan baris `auth.users` tanpa pemilik.
2. `auth_login_aliases`, `class_memberships`, `attendance`, dan `payments` di seed — semuanya
   menyebut id murid secara harfiah.
3. Penempatan Naila ada di `03_dummy_accounts.sql`, BUKAN di seed: seed jalan lebih dulu dan tidak
   bisa menyebut baris yang belum dibuat. Penempatannya dibungkus `if exists (... classes ...)`
   supaya pemasangan tanpa seed tetap lolos.

Diverifikasi pada basis data kosong dengan urutan lengkap
(`00_bootstrap` → migrasi → stub auth → `seed.sql` → `02_auth_columns` → `03_dummy_accounts`):
tiga murid, semuanya punya kelas, nol baris `auth.users` tanpa pemilik.

### `status_guru` menampung dua kosakata sekaligus

Kolom ini berisi campuran `'Bersertifikat'`/`'Belum Bersertifikat'` (sertifikasi pendidik) DAN
`'Aktif'`/`'Nonaktif'` (keaktifan kerja) — padahal keaktifan sudah punya kolomnya sendiri,
`guru.status`. Panel lalu membaca apa pun yang bukan `'Bersertifikat'` sebagai "Belum
Bersertifikat", sehingga guru bernilai `'Aktif'` tampak belum bersertifikat, dan Administrator serta
Tata Usaha — yang bukan guru — ikut diberi label itu.

Sekarang: kolom bernama **Sertifikasi**, peran non-mengajar menampilkan `—`, dan nilai di luar
kosakata sertifikasi tampil `Belum terdata` alih-alih ditebak. Form sertifikasi hanya muncul untuk
peran `Pengajar`/`Pentashih`, dan nilai bawaannya kosong supaya membuka form tidak mengubah data.

Nilai lama tidak dinormalkan lewat migrasi dengan sengaja: `'Aktif'` tidak memuat informasi
sertifikasi apa pun, jadi tidak ada yang bisa dipulihkan — sekolah mengisinya sendiri.

### `Progress` mengabaikan `indicatorClassName`

`src/components/ui/progress.jsx` tidak menerima prop itu, jadi `{...props}` menyalurkannya ke elemen
DOM: warna bilah tidak pernah berlaku dan React memperingatkan setiap render. Satu-satunya pemanggil
adalah `GuruAttendanceRecap`, yang memakainya untuk mewarnai bilah menurut persentase kehadiran —
jadi bilahnya selalu berwarna bawaan. Prop-nya sekarang diterima dan digabung ke `Indicator`.

### Kepala Sekolah memakai app_role `pentashih`, dibedakan oleh sebutannya

Setelah dashboard Wakil Kepala Sekolah ditulis ulang jadi panel pengawasan SD (lihat catatan di
atas), alasan menahan pemetaannya hilang. `getOperationalRoleFromGuruForm` sekarang memetakan peran
`'Kepala Sekolah'` ke app_role `pentashih` — **bukan** app_role baru.

Alasannya: keduanya mengawasi hal yang persis sama (kehadiran, keterisian kelas, murid yang perlu
perhatian) dan sama-sama tidak berhak menyunting. Menambah app_role kembar hanya menggandakan
jumlah tempat yang harus diperiksa ulang di setiap handler Go, dan setiap tempat yang terlewat
menjadi lubang otorisasi senyap.

Admin dan Tata Usaha tetap didahulukan bila akunnya juga memegang salah satunya.

**Konsekuensi yang harus diingat: `role` saja tidak lagi cukup untuk memberi sebutan.** Kepala
Sekolah dan wakilnya berbagi satu app_role, jadi setiap tempat yang menerjemahkan peran menjadi
sebutan harus memakai `isKepalaSekolah` lebih dulu. Sudah dipasang di judul dashboard, kartu profil,
dan bilah atas. `/api/auth/me` kini ikut mengirim `jabatan` dan `roles` supaya bilah atas punya
bahan untuk membedakannya — sebelumnya ia hanya menerima `role` dan memanggil kepala sekolah
"Wakil".

### 'Kepala Sekolah' sebagai sebutan

Struktur sekolah sempat punya Wakil Kepala Sekolah tanpa kepalanya. Peran
`'Kepala Sekolah'` kini ada di kosakata `guru.roles`, tetapi **tidak** dipetakan ke app_role mana
pun — `getOperationalRoleFromGuruForm` sengaja tidak menyebutnya. Akun kepala sekolah mengikuti peran
lain di akunnya (Admin, Tata Usaha, atau Pengajar), sama seperti di sekolah sungguhan kepala sekolah
tetap guru bersertifikat.

Alasan menahan pemetaan itu: satu-satunya dashboard pengawasan yang ada adalah
`PentashihDashboard`, dan isinya **masih program Qur'an** — "Penguji & Quality Assurance",
"pengawasan mutu bacaan", "distribusi tingkat", "calon khotim", distribusi jilid. Mengarahkan kepala
sekolah dasar umum ke sana akan menyuguhkan materi yang tidak berlaku sama sekali. Keputusan
dashboard mana yang ia terima belum diambil.

Yang ditentukan peran ini: sebutannya di direktori publik, penanda tangan pada dokumen, dan kutipan
di halaman Profil. `sebutanStaf` mendahulukan `'Kepala Sekolah'` atas peran lain di akun yang sama —
tanpa itu `find` mengambil peran mana pun yang lebih dulu tersimpan, sehingga kepala sekolah bisa
muncul sebagai "Guru". `isKepalaSekolah` juga mengenali dari `jabatan` bebas teks, karena halaman
Profil publik sudah lama memakai jalur itu dan data sekolah yang sudah terisi tidak boleh berhenti
dikenali. Wakil kepala sekolah dikecualikan secara eksplisit.

Satu baris kepala sekolah disemai di `03_dummy_accounts.sql`. Tanpa itu kutipan di halaman Profil
menampilkan **nama sekolah** di tempat nama orang, dan pemasangan pembeli terlihat belum selesai.

Penanda tangan dokumen diubah dari "Wakil Kepala Sekolah" menjadi "Kepala Sekolah" di
`reportUtils.js` (PDF dan DOCX) serta `SantriDetailModal.jsx` — yang mengesahkan dokumen sekolah
adalah kepala sekolahnya. Di modal itu sebutannya sempat tercetak dua kali, di baris keterangan dan
di baris tanda tangan; baris tanda tangan sekarang dikosongkan seperti kolom Orang Tua di sebelahnya.

### Dashboard Wakil Kepala Sekolah ditulis ulang jadi panel pengawasan SD

Isi lamanya adalah panel mutu program Qur'an: "Penguji & Quality Assurance", matriks distribusi
jilid, pipeline calon khotim & pra-imtihan, dan daftar murid yang lama belum naik jilid. Di sekolah
dasar umum semuanya tidak berlaku — dan lebih buruk, `levelStats` punya cabang `else dasar++`,
sehingga **seluruh murid SD yang kolom jilid-nya kosong dilaporkan "Jilid Dasar 100%"**. Angka yang
salah, bukan sekadar kosakata yang salah.

Sekarang isinya yang benar-benar diawasi seorang wakil kepala sekolah:

- kehadiran hari ini per sekolah dan **per kelas**, dengan wali kelasnya;
- **murid perlu perhatian** — kehadiran bulan berjalan di bawah 75%, lengkap dengan tautan WA wali;
- dua peringatan keterisian yang hanya muncul bila memang ada: kelas tanpa wali kelas, dan murid
  yang belum ditempatkan.

Tiga jebakan yang sudah dibereskan di dalamnya, jangan dibalik lagi:

1. **Baris "tidak hadir" bukan kehadiran.** Admin bisa menandai murid alpa, dan barisnya tetap ada
   di tabel `attendance`. Tanpa `isExplicitAbsentAttendance` murid yang alpa setiap hari justru
   terhitung hadir penuh.
2. **Hitung HARI, bukan BARIS.** Satu murid bisa punya lebih dari satu baris absensi per hari,
   jadi rekapnya memakai `Set` tanggal.
3. **Penyebutnya hari efektif kalender akademik**, bukan jumlah hari kalender — akhir pekan dan
   libur nasional tidak boleh menurunkan persentase siapa pun.

Peran ini tetap **baca saja**: menyunting kehadiran milik admin lewat Rekap Absensi, dijaga
`CanManage` pada `Update` dan `MarkAbsent`.

### Pentashih boleh membaca absensi seluruh sekolah

`attendance.List` dulu memaku setiap peran di luar `CanManage` ke barisnya sendiri. Pentashih pun
ikut terkena, padahal ia sudah boleh membaca seluruh kelas beserta rosternya (`classes.go`) dan
seluruh murid (`santri.go`, policy `santri_pentashih_select`). Akibatnya dashboard pengawasannya
mustahil dibangun tanpa menaikkannya jadi admin.

Pelebarannya **baca saja** dan hanya untuk peran itu; `Update` dan `MarkAbsent` tetap `CanManage`.

Ikutannya: `/api/attendance` membatasi satu permintaan pada 500 baris dan **tidak** mengirim
`X-Total-Count`, jadi rentang sebulan untuk seluruh sekolah pasti terpotong diam-diam bila diambil
sekali jalan. Rekap lintas sekolah wajib lewat `fetchAllAttendance`, yang menyusuri halaman sampai
halaman pendek — bukan lewat `fetchAttendance` dengan limit besar.

### Rapor dicetak dari HTML, bukan jsPDF

Laporan lain di `src/utils/reportUtils.js` disusun dengan jsPDF. Rapor **tidak**, dan bedanya
disengaja: rapor harus memakai identitas sekolah termasuk **warna** pilihan pembeli, dan warna itu
hidup sebagai properti CSS (`--sekolah-aksen*`) yang dipasang `applySchoolIdentity`. Menyusunnya di
jsPDF berarti menyalin palet ke JavaScript dan menjaga dua sumber warna tetap sama; dengan HTML rapor
ikut berganti warna sendiri begitu pembeli mengubah identitasnya. Diperiksa di browser: gradasi
lambang terbaca `linear-gradient(135deg, rgb(100,112,255), rgb(229,143,196))` — tepat
`accentColor`/`accentColor2`, bukan heks yang ditulis di CSS.

**Lembarnya dirender DUA kali, dan itu bukan kelalaian.** Satu di dalam dialog sebagai pratinjau,
satu lewat portal ke anak LANGSUNG `body` (`#rapor-cetak-root`) sebagai salinan yang benar-benar
dicetak. Alasannya: dialog Radix hidup di portalnya sendiri di akhir `body`, dan lembarnya belasan
tingkat di dalamnya — aturan cetak harus menebak seluruh rantai pembungkus. Dengan akar sendiri di
`body`, aturannya cukup satu baris: `body > *:not(#rapor-cetak-root) { display: none }`.

Salinan cetak disembunyikan lewat class `.rapor-hanya-cetak`, **bukan** style inline: style inline
mengalahkan `@media print` kecuali dipaksa `!important`.

`print-color-adjust: exact` dipasang pada lambang dan latar baris tabel. Tanpa itu banyak browser
membuang latar berwarna saat mencetak, dan lambang bergradasi menjadi teks putih di kertas putih.

Angka yang tercetak diambil dari sumber yang menjadi acuannya — `nilai/summary` dan
`attendance/recap` — bukan dari tabel rapor tersendiri. Menyalinnya berarti dua angka yang bisa
berselisih, dan yang tercetak di rapor adalah yang paling tidak boleh salah.

### Catatan wali kelas: HANYA catatannya yang disimpan

`rapor_catatan` (migrasi `20260816000100`) menyimpan satu catatan per murid per periode, dijaga
`UNIQUE (santri_id, periode_id)` — tanpa itu menyimpan dua kali menghasilkan dua baris dan rapor
mencetak salah satunya tanpa aturan.

**Nilai dan kehadiran sengaja TIDAK ikut disimpan.** Keduanya tetap dibaca dari `nilai/summary` dan
`attendance/recap` setiap kali rapor disusun. Menyalinnya ke tabel rapor akan membuat rapor yang
dicetak ulang berbeda dari data sekolah yang sebenarnya.

Hak tulisnya **lebih sempit** daripada hak baca, dan itu disengaja: catatan rapor adalah penilaian
pribadi wali kelas, jadi guru mata pelajaran yang kebetulan mengajar di kelas yang sama tidak boleh
menimpanya. Menulis = wali kelas murid itu + back-office. Membaca = itu semua, plus pengawas dan
murid yang bersangkutan.

Diuji: tata usaha menulis **200** dan isinya kembali utuh saat dibaca; murid menulis catatan murid
lain **403**; murid membaca catatan murid lain **403**; murid membaca catatannya sendiri **200**.

Mengosongkan kotak catatan memanggil jalur **DELETE**, bukan menyimpan string kosong — kolomnya
punya `CHECK (btrim(catatan) <> '')`, jadi menyimpan kosong akan ditolak dan mengosongkan catatan
terasa gagal tanpa sebab.

### Rapor dinamai "Laporan Kemajuan Belajar", bukan "Rapor"

Riset `docs/51-riset-rapor-resmi-kemendikdasmen.md` menegakkan dua hal dari sumber primer:
Kemendikdasmen **punya** aplikasi rapor resmi (e-Rapor SD 2025.1, aplikasi lokal, tersambung
Dapodik), dan pemakaiannya **tidak wajib** — Permendikbudristek 21/2022 tidak menyebut aplikasi apa
pun, dan Pasal 8 ayat (5) mengakui "rapor **atau bentuk laporan hasil Penilaian lainnya**".

Konsekuensinya untuk produk ini: cetakan kita **sah** sebagai laporan hasil belajar, tetapi **bukan**
keluaran sistem Kemendikdasmen — dan tidak boleh terbaca seolah-olah begitu.

- Judul lembar memakai **"Laporan Kemajuan Belajar"**, istilah Pasal 8 ayat (1) itu sendiri. Jangan
  menggantinya menjadi "Rapor", "e-Rapor", atau apa pun yang mengesankan afiliasi.
- Kaki lembar memuat penafian: dokumen ini terbitan sekolah, rapor resmi mengikuti mekanisme yang
  ditetapkan sekolah. Penafian itu melindungi sekolah sekaligus produk.

**Jangan membangun integrasi Dapodik.** Web service-nya berjalan lokal di komputer sekolah,
versinya berganti tiap tahun, dan tidak ada API publik yang stabil untuk pihak ketiga.

### Dua belas komponen minimal BSKAP sudah dipenuhi

Panduan Pembelajaran dan Asesmen BSKAP (Edisi Revisi Ke-3, Juli 2025, hlm. 66) menyebut dua belas
komponen minimal rapor. Semuanya kini ada di lembar cetak; tiga terakhir ditambahkan oleh migrasi
`20260816000200`:

| # | Komponen | Sumber |
|---|---|---|
| 1–6 | Identitas murid, satuan pendidikan, kelas, semester, mata pelajaran, nilai | sudah ada |
| 7 | Deskripsi Capaian Kompetensi | `rapor_deskripsi_mapel`, per mata pelajaran |
| 8 | Deskripsi Capaian Kokurikuler | kolom baru `rapor_catatan.deskripsi_kokurikuler` |
| 9 | Kegiatan ekstrakurikuler | kolom baru `rapor_catatan.ekstrakurikuler` |
| 10–11 | Ketidakhadiran, Catatan Wali Kelas | sudah ada |
| 12 | Tanggapan Orang Tua/Wali | **kotak kosong**, tidak disimpan |

Komponen 12 sengaja tidak punya isian: pada rapor kertas kolom itu ditulis tangan wali murid.

Tambahan: **Fase** (A–F) di kepala rapor, diturunkan dari angka pada nama kelas. Nama kelas tanpa
angka membuat barisnya **disembunyikan**, bukan ditebak.

Dua jebakan basis data yang sudah dibereskan di migrasi itu:

1. `rapor_catatan.catatan` **tidak lagi NOT NULL**. Murid bisa punya catatan ekstrakurikuler tanpa
   catatan wali kelas; batasan lama menolak baris semacam itu. Diganti
   `rapor_catatan_ada_isinya` — setidaknya satu dari tiga kolom terisi.
2. Kolom narasi menyimpan **NULL** untuk "belum diisi", bukan string kosong. String kosong membuat
   batasan di atas menganggap barisnya tetap terisi.

Menyimpan deskripsi mata pelajaran memakai **satu transaksi untuk seluruh peta**, bukan satu
permintaan per mata pelajaran: guru mengisi semuanya dalam satu duduk, dan penyimpanan satuan
membuat sebagian tersimpan ketika koneksi putus di tengah.

Nama tabel `rapor_catatan` **dipertahankan** meski isinya kini lebih dari catatan. Menggantinya
memutus data tersimpan demi nama yang lebih rapi — pertukaran yang tidak sepadan.

### Cetak rapor sekelas: konteks bersama diambil sekali

`fetchRapor` untuk satu murid memanggil sembilan endpoint, empat di antaranya
mengembalikan jawaban yang **sama untuk setiap murid**: daftar periode, daftar kelas, daftar guru,
dan konfigurasi predikat. Memanggilnya berulang untuk 28 murid berarti 28× daftar kelas dan 28×
daftar guru.

Karena itu `fetchKonteksRapor()` dipisahkan dan `fetchRapor` menerimanya sebagai argumen ketiga.
`fetchRaporKelas` mengambil konteks **sekali**, lalu tiap murid hanya menambah empat permintaan
miliknya sendiri.

Pengambilannya **berkelompok lima**, bukan `Promise.all` atas seluruh kelas: melepas seratus lebih
permintaan serentak membuat peramban mengantre sendiri — lebih lambat, dan kegagalannya sulit
dibaca.

Murid yang gagal dimuat **tidak menggagalkan seluruh kelas**; ia dikembalikan dengan `gagal: true`
dan namanya disebut di dialog. Mencetak 26 dari 28 rapor tanpa memberi tahu dua yang hilang adalah
kegagalan senyap.

Pemisah halaman memakai `break-before: page` **dan** `page-break-before: always`. Yang kedua bukan
duplikasi sia-sia — mesin cetak lama hanya mengenal properti lama itu.

Dialog sekelas sengaja **baca saja**. Menyunting 28 rapor dalam satu layar mengundang salah tulis
pada murid yang salah; pengisian tetap lewat dialog per murid, yang kini punya navigasi antarmurid.

Navigasi itu **meminta persetujuan** bila masih ada isian yang belum disimpan — berpindah murid
sambil membuang pekerjaan orang tanpa peringatan adalah kegagalan yang sama seperti kehilangan
catatan dulu.

### Rentang predikat rapor bisa diatur sekolah

Bawaannya A≥90 / B≥80 / C≥70 / D, kebiasaan umum SD Indonesia — tetapi setiap sekolah menetapkan
KKM-nya sendiri, jadi angkanya tidak boleh tinggal sebagai konstanta. Tersimpan pada kunci
app-config `rapor_predikat` (sudah ditambahkan ke `validConfigKeys` di `appconfig.go`; kunci di luar
allowlist ditolak saat tulis), disunting di Konfigurasi → Predikat Rapor.

`normalisasiPredikat` mengurutkan daftar **menurun** menurut `min` dan memaksa ambang terbawah ke 0.
Keduanya syarat, bukan kerapian: `predikatDari` mengambil `find` pertama yang ambangnya terlampaui,
jadi daftar yang tersimpan menaik akan memberi predikat TERENDAH kepada setiap nilai, dan tanpa
ambang nol ada rentang skor yang jatuh tanpa predikat.

Diuji dari ujung ke ujung: dengan ambang diubah menjadi 85/75/60, nilai 88.33 berpindah dari B ke A
dan 78.67 dari C ke B, termasuk baris rata-rata keseluruhan.

### `attendance/recap` tidak memeriksa hak akses apa pun — SUDAH DIPERBAIKI

Endpoint ini menerima `user_id` mana pun dari siapa pun yang sudah masuk, lalu mengembalikan seluruh
riwayat kehadiran orang itu. Seorang murid bisa membaca riwayat murid lain. Terlewat karena
penjagaan lain di berkas yang sama (`List`, `Update`, `MarkAbsent`) sudah ada, sehingga `Recap`
tampak ikut terjaga.

Aturannya sekarang sama dengan `List`: back-office dan pengawas melihat semua, guru melihat murid
yang diajarnya dan dirinya sendiri, sisanya hanya dirinya sendiri. Diuji: murid meminta rekap murid
lain menerima **403**, rekapnya sendiri **200**.

Ikutannya, `guruTeachesSantri` diangkat menjadi fungsi paket di `santri.go` dan metodenya sekarang
memanggilnya. Dua salinan aturan "guru mana boleh melihat murid mana" akan berselisih begitu salah
satunya disunting.

### Judul halaman publik WAJIB lewat `JudulHalaman`

Sembilan halaman publik dulu menulis judulnya sebagai teks mati —
`<title>Prestasi — Sekolah Dasar Negeri Baturaja</title>`. Header halamannya benar karena membaca
identitas, tapi judulnya tidak; dan justru judul itu yang keluar dari situs: tab peramban, penanda
buku, hasil pencarian, dan pratinjau tautan saat dibagikan. Pembeli yang sudah mengganti nama
sekolahnya tetap menyebarkan nama sekolah CONTOH.

`src/components/sdnb/JudulHalaman.jsx` menyusunnya dari `useSchoolIdentity`. Dibuat sebagai komponen,
bukan sekadar hook yang dipasang di tiap halaman, supaya susunan judulnya ada di **satu** tempat —
menyalin polanya ke sembilan berkas mengundang salinan kesepuluh yang lupa. `{sekolah}` di dalam
`deskripsi` diganti nama sekolah.

**Halaman publik baru jangan memakai `<Helmet><title>` langsung.**

### Angka di halaman publik tidak boleh punya nilai contoh

`HomePage` dulu memulai dengan `useState({ siswa: 624, guru: 34 })` dan menyimpan hasilnya sebagai
`siswa || 624`. `||` menyala pada **nol yang sah**, bukan hanya saat gagal — jadi sekolah yang baru
memasang dan belum memasukkan murid memasang klaim "624 siswa" dan "34 guru" di halaman depannya.

Sekarang: `null` berarti belum termuat, `0` berarti benar-benar nol. Kartu statistik menampilkan
tanda pisah selagi `null`, dan baris jumlah murid di hero disembunyikan sampai angkanya didapat.
Kalimat "Enam ratus lebih anak belajar di sini setiap hari" ikut dicabut dari paragraf hero, dan
nama sekolah di paragraf itu kini diambil dari identitas.

Aturannya: **jangan pernah memasang bilangan contoh sebagai nilai awal atau fallback untuk angka
yang seharusnya datang dari data sekolah.** Teks contoh boleh — pembeli menyuntingnya, dan sudah
jelas itu teks. Angka contoh terbaca sebagai fakta.

### Klaim sekolah di halaman depan kini disunting pembeli

Badge akreditasi dan dua kartu statistik terakhir (persentase lulusan, jumlah prestasi) dulu ditanam
di kode `HomePage`. Keduanya **fakta per-sekolah tanpa sumber data**, jadi setiap salinan yang
terjual memasang capaian sekolah CONTOH sebagai capaiannya sendiri — dan pembeli tidak punya cara
mengubahnya.

Sekarang di `home_content` kunci `badge` dan `stats`, disunting di Konten → Halaman Depan.

**Kosong berarti disembunyikan, bukan jatuh ke bawaan.** Aturan ini sama seperti daftar wilayah SPMB
dan sengaja berbeda dari blok lain di berkas yang sama: sekolah yang belum terakreditasi tidak boleh
dipaksa menampilkan akreditasi sekolah contoh. Karena itu `badge` dan `stats` **tidak** memakai
`normalizeBlok` — fungsi itu memulihkan bawaan saat isinya kosong. Yang dibedakan adalah `undefined`
(kunci belum pernah disimpan → bawaan benar) dari kosong (pilihan sekolah).

Baris statistik menyusut sendiri: kolom gridnya `2 + jumlah stats`. Dua kartu pertama — murid dan
guru — datang dari endpoint hitungan dan **tidak** boleh masuk daftar yang disunting.

Diuji dari ujung ke ujung: mengosongkan badge dan menyisakan satu statistik membuat badge hilang dan
baris menyusut dari empat kolom ke tiga, dengan penghitung tetap benar.

### Berita dan pengumuman contoh disemai sebagai DRAF

Seed dulu menerbitkan "Berita Demo" dan "Pengumuman Demo" berisi "Excerpt … dummy" dengan status
`published`, sehingga halaman `/berita` setiap pembeli langsung menayangkan dua artikel omong kosong
kepada calon orang tua murid — dan ikut muncul di halaman depan.

Tetap disemai, bukan dihapus: tanpa satu baris pun panel Berita terlihat rusak pada pemasangan baru
dan pembeli tidak punya contoh bentuk isian. Yang berubah **statusnya menjadi `draft`**, jadi tidak
tampil di halaman publik sampai sekolah menerbitkannya sendiri, dan judulnya kini berbunyi seperti
petunjuk ("Contoh berita sekolah").

### Hasil periksa angka di empat halaman publik sisanya

Pertanyaannya: mana angka yang bersumber data, mana yang tertanam dan tidak bisa diubah pembeli.

| Halaman | Hasil |
|---|---|
| Program | **Bersih.** Diturunkan dari daftar program + `content.stats` (disunting) |
| Ekstrakurikuler | **Bersih.** Seluruhnya diturunkan dari daftar kegiatan yang disunting |
| Prestasi | **Bersih.** Diturunkan dari daftar prestasi + `content.stats` (disunting) |
| Fasilitas | **Bercacat** — sudah diperbaiki, lihat di bawah |

Daftar fasilitasnya sendiri sudah bisa disunting (kunci `facilities`, panel Konten → Fasilitas);
array `F` di `FacilitiesPage` hanya cadangan saat CMS kosong. Yang bercacat adalah dua hal lain.

**Baris ringkasan** memuat empat angka mati: 4200 m² luas lahan, 12 ruang kelas, 10 ruang penunjang,
24 guru dan staf — fakta sekolah CONTOH, tidak bisa diubah pembeli. Tiga kini diturunkan: ruang kelas
dan guru dari endpoint hitungan, ruang penunjang dari daftar Fasilitas yang disunting sekolah.
Kartu yang angkanya belum didapat disembunyikan, bukan ditampilkan nol.

**"Luas lahan" kini field `landArea` di Identitas Sekolah**, sejajar dengan alamat dan jam layanan.
Bukan brand field, jadi pembeli boleh mengisinya sendiri. Dikosongkan berarti kartunya hilang —
sekolah yang tidak mencatat luas lahannya tidak dipasangi angka karangan. Disimpan sebagai teks
supaya "4.200" dan "4200" sama-sama diterima.

**Baris ringkasan itu dirancang mockup untuk latar GELAP, padahal halamannya terang.** Teksnya `#fff`
dan garis pemisahnya `rgba(255,255,255,.16)` — nyaris tidak terbaca, dan pemisahnya tidak terlihat
sama sekali. Cacat ini sudah ada sejak awal, hanya tersamar selagi barisnya penuh empat kolom.
Sekarang barisnya memakai panel kaca yang sama dengan baris statistik Beranda, dengan warna teks
nada gelap.

**Jumlah kolomnya mengikuti jumlah kartu** (`kolomRingkas`). Sebelumnya dipaku `repeat(4,1fr)` di
markup, jadi begitu satu kartu hilang tersisa kolom kosong dan garis pemisah menggantung.

**Judul "Sepuluh perhentian"** juga tertanam, sementara daftar di bawahnya mengikuti fasilitas milik
sekolah — sekolah dengan tiga ruang tetap dijuduli sepuluh. Kini mengikuti jumlah sebenarnya.

### `prefers-reduced-motion` tidak boleh ikut menyembunyikan informasi

`useSdnbMotion` dulu keluar lebih awal ketika pengunjung meminta lebih sedikit gerakan. Masalahnya,
angka pada markup ditulis `<span data-count="624">0</span>` — nolnya teks nyata, dan animasinyalah
yang menggantinya. Tanpa animasi angka itu tinggal nol selamanya: halaman depan mengaku punya
"0 Siswa aktif", "0 Guru", "0% Lulusan". Terkena tujuh halaman.

Sekarang jalur itu menulis nilai akhirnya langsung, tanpa animasi. Yang dikurangi **gerakannya**,
bukan informasinya. Diuji dengan `matchMedia` yang ditambal: seluruh penghitung menampilkan angka
benar tanpa digulir sama sekali.

### Penghitung angka mati bila halaman dibuka lewat klik menu — SUDAH DIPERBAIKI

Cacat kedua pada mekanisme yang sama, dan lebih luas daripada yang pertama. `useSdnbMotion`
memantau tiap `[data-count]` dengan `IntersectionObserver`. Saat halaman dibuka lewat **klik menu**
alih-alih muat ulang, data susulan tiba sesudah pemantauan dimulai, React mengganti simpul yang
sama, dan yang dipantau menjadi simpul buangan. Simpul penggantinya berisi `0` bawaan markup dan
tidak pernah disentuh lagi.

Akibatnya seluruh situs publik menampilkan nol kepada pengunjung yang menjelajah secara wajar:
"0 program berjalan" tepat di atas daftar enam program, "0 Tahun berdiri", "0 m² luas lahan",
"0 ruang kelas". Muat ulang halaman menampilkan angka yang benar — itulah sebabnya cacat ini lolos
berkali-kali: setiap pemeriksaan sebelumnya dilakukan dengan navigasi langsung ke URL.

Perbaikannya: simpul yang sudah dipantau ditandai `__dc`, dan sebuah penjaga memindai ulang tiap
350 ms selama 8 detik pertama. Simpul pengganti tidak membawa penanda itu, jadi terambil sebagai
baru. Penjaga berhenti sendiri agar tidak ada timer yang hidup selamanya.

**Cara mengujinya harus lewat klik tautan**, bukan `navigate()` ke URL — jalur muat ulang tidak
pernah menunjukkan cacat ini.

### Grid halaman publik tidak boleh mematok jumlah kolom

Markup halaman publik diturunkan dari mockup, dan mockup selalu digambar dengan barisnya penuh —
umumnya empat kartu. Begitu isinya milik sekolah sungguhan jumlahnya bebas, dan kolom yang dipaku
menyisakan lubang di kanan, kadang lengkap dengan garis pemisah yang menggantung.

Ditemukan nyata di tiga tempat: mozaik ruang di Fasilitas (satu kartu di dalam grid 4×2), baris chip
di Kontak (tiga chip karena WhatsApp dikosongkan), dan album di Galeri (dua album). Pola yang sama
ada di belasan tempat lain dan hanya kebetulan tidak terlihat karena datanya pas.

`src/lib/gridKolom.js` menyediakan dua penolong: `kolomUntuk(jumlah, maks)` untuk grid biasa dan
`kapasitasKolom(lebar, maks)` untuk mozaik, yang menghitung kapasitas dari lebar tiap kartu. Untuk
mozaik, lebar kartu juga harus dipangkas ke jumlah kolom — kartu `span 2` di dalam grid satu kolom
akan melebar keluar.

Aturannya: **setiap grid yang isinya berasal dari data sekolah wajib memakai salah satu penolong
ini.** Yang boleh tetap mematok kolom hanyalah grid yang isinya struktural, misalnya lima hari kerja.

### Tiker dan angka ringkasan Profil boleh dikosongkan sampai habis

`normalizeDaftar` di `profileContent.js` memulihkan bawaan setiap kali daftar tersimpan kosong,
supaya halaman tidak bolong. Untuk blok naratif itu benar. Untuk **tiker** dan **angka ringkasan**
itu salah: isinya klaim tentang sekolah — "Terakreditasi A", "Adiwiyata Nasional", "1966",
"18 rombongan belajar" — dan bawaannya milik sekolah contoh. Sekolah yang menghapusnya mendapatkan
capaian sekolah lain kembali terbit sebagai capaiannya sendiri, tanpa cara mematikannya.

Keduanya kini lewat `normalizeKlaim`, yang membedakan `undefined` (kunci belum pernah disimpan,
bawaan memang benar) dari `[]` (pilihan sekolah, dihormati). ProfilePage menyembunyikan seluruh
baris statistik dan seluruh tikernya ketika kosong, bukan menyisakan panel atau dua garis tanpa isi.

Sejalan dengan `badge` dan `stats` di `homeContent.js`, yang sudah memakai aturan ini lebih dulu.

### Warna aksen tidak boleh dipakai langsung sebagai teks kecil

Warna aksen dipilih sekolah untuk gradasi, tombol, dan judul besar — di sana ia memang harus terang.
Dipakai sebagai teks 11–13px di atas latar terang, warna yang sama gagal ambang keterbacaan: aksen
bawaan hanya mencapai rasio **3.56** dari 4.5 yang diminta WCAG AA, dan itu terjadi di hampir setiap
halaman karena semua label kecil memakainya.

Menurunkan warna aksennya sendiri bukan jawaban — itu mengubah merek sekolah di mana-mana. Palet
sekarang punya satu turunan khusus, `--sekolah-aksen-teks`: rona dan kejenuhan **persis sama** dengan
`--sekolah-aksen-pekat`, hanya terangnya diturunkan bertahap sampai lolos ambang terhadap latar
terang paling gelap yang dipakai halaman publik (#e9edf6). Untuk biru bawaan turunnya hanya 5 poin
dan mata hampir tidak membedakannya; untuk kuning terang turunnya besar, dan itu memang konsekuensi
memilih warna terang, bukan tanda hitungannya salah. Diuji dengan enam warna termasuk kuning dan
putih.

**Aturannya:** `color:` memakai `--sekolah-aksen-teks`; gradasi, latar, garis, dan `WebkitTextStroke`
tetap memakai `--sekolah-aksen-pekat`. Nilai bawaannya juga tertulis di `:root` `src/index.css` —
kalau STOP_PALET berubah, samakan keduanya, dan uji pertama di `schoolIdentity.test.js` menguncinya.

### Abu-abu redup halaman publik dinaikkan, abu-abu dashboard TIDAK

Enam nada abu di markup mockup gagal ambang di atas latar terang: `#9aa1d8` (2.12), `#8a8ea8` (2.75),
`#7b80a4` (3.28), `#70759a` (3.81), `#6d7192` (4.05), `#6b7093` (4.10), ditambah `#6a6f95`, `#7b7fa0`,
dan `#6c718f` yang menyusul. Semuanya diringkas ke dua nada yang lolos dan tetap menjaga urutan
terang-gelapnya: **`#63678a`** (4.67) untuk label, dan **`#5f6389`** (4.93) untuk teks pendamping.

Yang **tidak** disentuh: `src/styles/sdnb-dashboard.css` dan `src/styles/admin-dashboard.css`. Nada
yang sama di sana duduk di atas permukaan **gelap**, jadi angka kontrasnya justru bagus —
menggelapkannya akan merusak yang sudah benar. Warna redup selalu harus dinilai bersama latarnya,
bukan sendirian.

Satu pengecualian disengaja: `#6a6f95` pada baris hero Profil berukuran 34px. Teks besar hanya
butuh 3.0 dan ia sudah 4.18, jadi menggelapkannya cuma mengubah desain tanpa manfaat.

Diperiksa dengan pemindai kontras yang dijalankan sambil menggulir seluruh halaman: **dua belas
halaman publik, nol pelanggaran** pada permukaan yang bisa diukur. Teks di atas foto dan gradasi
dilewati pemindai — itu harus dinilai dengan mata.

### Gulungan tidak pernah kembali ke atas saat pindah halaman — SUDAH DIPERBAIKI

`src/components/ScrollToTop.jsx` sudah lama ada di repositori tapi **tidak pernah dipasang**: App
hanya mengimpor `ScrollToTopButton`, yang namanya mirip tapi pekerjaannya lain (tombol melayang di
pojok). Akibatnya setiap perpindahan di dalam aplikasi membawa posisi gulungan halaman sebelumnya —
pengunjung yang menggulir ke tengah Beranda lalu menekan menu "Program" mendarat di tengah halaman
Program, melewati judul dan pembukanya.

Sekarang dipasang di dalam `<Router>`, dengan dua tambahan:

- **Ulangi sekali pada bingkai berikutnya.** Animasi "muncul saat digulir" mengubah tinggi bagian
  sesaat setelah cat pertama, dan penjangkaran gulungan bawaan peramban kadang menggeser posisi
  kembali ke bawah. Tanpa pengulangan ini hasilnya tidak menentu — kadang 0, kadang 347.
- **Tautan berjangkar diantar, bukan dipaksa ke atas.** `/#faq` sebelumnya tidak bergerak ke mana
  pun: peramban hanya menangani jangkar saat memuat dokumen, dan tidak ada yang menanganinya pada
  perpindahan di dalam aplikasi. Bagiannya dicari beberapa kali karena isinya bisa datang belakangan.
  `.sdnb section[id]` diberi `scroll-margin-top: 104px` supaya judul bagiannya tidak tertutup bilah
  navigasi yang menempel.

Cacat ini hanya terlihat lewat **klik tautan**. Membuka URL langsung selalu benar.

### Beranda dan halaman Berita tidak boleh saling membantah

Beranda memasang tiga kartu berita karangan lengkap dengan tanggal ketika sekolah belum menerbitkan
apa pun, sementara halaman Berita di menu yang sama berkata "Belum ada berita". Situs yang sama
membantah dirinya sendiri, dan yang dipasang di halaman pertama adalah berita yang tidak ada.

`NEWS_FALLBACK` diganti nama menjadi `NEWS_STYLE` supaya perannya jelas: ia HANYA memasok warna
sampul, warna label kategori, dan teks pengganti untuk artikel yang tidak punya ringkasan sendiri.
Ia tidak lagi menjadi isi cadangan. Kosong tetap kosong, dan kata-kata keadaan kosongnya disalin
persis dari halaman Berita.

`newsStatus` dibedakan dari daftar kosong: selagi memuat, "Belum ada berita" belum tentu benar, jadi
yang tampil "Memuat kabar terbaru…". Deretan pil kategori ikut disembunyikan saat kosong — kategori
di atas tulisan "Belum ada berita" terbaca seperti halaman rusak.

Pil kategori itu **hiasan, bukan penyaring** — menekannya tidak melakukan apa-apa. Itu cacat
tersendiri yang belum ditangani.

### Label kolom login harus sesuai dengan yang diterima backend — SUDAH DIPERBAIKI

`resolveUser` di `backend/internal/handler/auth.go` mencari murid lewat nomor induk (atau nama
panggilan), lalu pegawai lewat **email**. Tidak ada jalur NIP dan tidak ada jalur nama pengguna.
Padahal tab Guru meminta "Nomor induk pegawai" dengan contoh `198703142009`, dan tab Tata usaha
meminta "Nama pengguna" dengan contoh `tu.baturaja`. Keduanya warisan mockup, dan keduanya membuat
pegawai yang menuruti labelnya **selalu ditolak** — dua dari lima peran tidak bisa masuk.

Keduanya kini berbunyi "Email" dengan contoh `nama@example.sch.id`. Domain contohnya sengaja netral
supaya tidak menyodorkan alamat sekolah tertentu sebagai milik pembeli.

Tab peran itu **tidak membatasi** siapa yang boleh masuk — peran sebenarnya ditentukan backend. Ia
hanya memberi tahu apa yang harus diisi, jadi labelnya wajib jujur.

### Dashboard Murid: empat cacat yang ditemukan lewat pemeriksaan langsung

Semuanya di `src/components/dashboard/SantriDashboard.jsx`.

1. **Satu layar, dua jawaban.** Kartu profil menyebut hari ini "Belum Absen", sementara daftar di
   bawahnya menyebut hari yang sama **"Alpha"** — tuduhan bolos, padahal jam sekolahnya bisa jadi
   belum mulai. Keduanya kini memakai kalimat yang sama.
2. **Status absensi diringkas jadi "Hadir".** Absensi mengenal Hadir, Terlambat, Izin, dan Sakit,
   tapi daftar teman sekelas menuliskan keempatnya "Hadir" karena hanya memeriksa ada-tidaknya
   catatan. Sekarang statusnya dipakai apa adanya. Diuji dengan menyisipkan satu catatan Izin: kartu
   profil dan daftar sama-sama berbunyi "Izin".
3. **Kolom dipaku empat.** Baris Poin/Level/Sesi memakai `sm:grid-cols-4` padahal isinya tiga saat
   program tahfizh dimatikan, jadi tersisa satu kotak kosong. Sekarang `auto-fit`, yang melipat
   jalur tak terpakai — keluarga cacat yang sama dengan grid halaman publik, lihat `gridKolom.js`.
4. **Kosakata yang salah sasaran.** Judul panelnya "Manajemen Kelas & Absensi Hari Ini" di layar yang
   dibaca murid dan orang tuanya, padahal tidak ada yang bisa mereka kelola di sana. Menjadi "Teman
   Sekelas & Kehadiran Hari Ini". Kartu "Sesi" juga hanya tampil bila ada isinya, dan `jilid` teman
   sekelas hanya tampil bila tahfizh dinyalakan.

Kartu "Sesi" **belum dicabut**, hanya disembunyikan saat kosong. Di sekolah dasar nilainya selalu
"Pagi", jadi kartunya nyaris tanpa informasi — mencabutnya keputusan produk, bukan perbaikan cacat.

### Sandi akun demo pegawai bisa menyimpang dari yang didokumentasikan

Sandi di basis data pengembangan lokal pernah tidak lagi cocok dengan nilai yang tertulis di
`backend/init/03_dummy_accounts.sql`, sehingga login guru gagal padahal akunnya aktif. Berkas init
hanya dijalankan saat kontainer pertama kali dibuat, jadi perubahan sesudahnya tidak ikut kembali.

Untuk menyetel ulang satu akun demo (JANGAN dipakai untuk admin atau superadmin — sandi keduanya
milik penjual dan tidak boleh ada di berkas mana pun):

```sql
update public.guru
set password = extensions.crypt('guru123', extensions.gen_salt('bf', 12))
where email = 'guru@sdnbaturaja.sch.id';
```

Memastikan sebuah sandi cocok tanpa menampilkannya:

```sql
select email, (password = extensions.crypt('<sandi>', password)) as cocok from public.guru;
```

### Pagar `enableTahfizh` harus dipasang di SELURUH jalan masuk, bukan sebagian

`VITE_ENABLE_TAHFIZH` sudah menutup tombol Setoran Muroja'ah di `GuruDashboard.jsx`, lengkap dengan
komentar yang menjelaskan alasannya — tapi dua jalan masuk lain di berkas dan komponen yang sama
terlewat, sehingga sekolah dasar umum tetap mendapat perangkat sekolah Qur'an:

- Tabel murid di dashboard guru: kolom **Jilid** (dengan tombol naik/turun jilid) dan kolom
  **Hafalan** (Doa, Sholat, Surat, Tahfizh).
- `SantriDetailModal.jsx` sama sekali tidak punya pagarnya: "Tingkat Saat Ini", "Terakhir Naik
  Tingkat", tombol "Naik Tingkat"/"Turun", dan lencana "N Hari di tingkat …". CLAUDE.md menyebut
  saklar ini menutup "kolom Tingkat berikut riwayatnya", jadi modal ini memang termasuk.

Semuanya kini dipagari. Datanya tetap utuh; yang disembunyikan hanya jalan masuknya.

**Saat menambah apa pun yang menyebut jilid, tingkat, hafalan, atau muroja'ah, pasang pagarnya di
tempat yang sama.** Cacat ini muncul dua kali karena pagarnya dipasang per-tombol, bukan per-modul.

### Modal Detail Murid tidak bisa tahu nama kelas sendiri

Baris murid yang dipegang dashboard guru hanya membawa `current_class_id`, dan endpoint detail murid
juga begitu — tidak ada nama kelas di mana pun yang bisa dibaca modal. Akibatnya modal menulis
"Kelas: -" untuk murid yang di layar yang sama terdaftar di Kelas 4A, dan yang di tab Komunikasi
Wali juga tertulis Kelas 4A.

Yang tahu namanya adalah pemanggilnya, karena daftar murid memang dikelompokkan per kelas. Jadi
`openDetailModal(santri, cls)` menitipkan `className`. Pemanggil lain yang membuka modal ini
sebaiknya melakukan hal yang sama selama endpointnya belum mengembalikan nama kelas.

### `/quiz-hafalan` ada halamannya tapi tidak pernah didaftarkan — SUDAH DIPERBAIKI

`src/pages/QuizHafalanPage.jsx` lengkap dan berfungsi, tapi rutenya tidak ada di `App.jsx`. Tombol
"Play Quiz" di dashboard guru dan di layar absensi digital karena itu membuang penekannya ke halaman
publik tanpa isi — bukan ke pesan kesalahan, melainkan navbar dan footer dengan badan kosong.

Kini terdaftar dengan `operationalDisplayRoles`: kuis dijalankan guru untuk muridnya dan gurulah
yang memberi poin, jadi murid tidak termasuk. Diuji: murid yang memaksa membuka `/quiz-hafalan`
dipantulkan kembali ke dashboardnya.

Sengaja **di luar** pagar `enableGameFeatures` — ini alat mengajar, bukan permainan hadiah seperti
Gatcha, dan pemilik template memutuskan guru selalu boleh memakainya.

### Alamat tak dikenal menghasilkan halaman kosong — SUDAH DIPERBAIKI

Rute penampung di `App.jsx` membungkus halaman publik di dalam `PublicLayout`, tapi di dalamnya
tidak ada penampung terakhir. Alamat yang tidak cocok dengan satu pun rute menghasilkan navbar di
atas, footer di bawah, dan **tidak ada apa-apa di antaranya** — pengunjung tidak diberi tahu bahwa
ia salah alamat, dan tidak diberi jalan keluar.

`src/pages/NotFoundPage.jsx` mengisi tempat itu, memakai gaya halaman publik dan `JudulHalaman`
supaya judul tabnya ikut nama sekolah pembeli. Alamat yang diminta ikut ditampilkan supaya pengunjung
bisa mengenali salah ketiknya sendiri dan sekolah punya sesuatu untuk disebut saat dilapori.

### Judul tab: hidrasi identitas menimpa judul halaman

`App.jsx` menyelaraskan `document.title` dengan nama sekolah setiap kali identitas berubah. Hidrasi
itu selesai **sesudah** Helmet menulis judul halaman, jadi baris itu menimpanya. Di sebagian besar
halaman Helmet menulis ulang sesudahnya sehingga tidak pernah terlihat — kebetulan, bukan rancangan.
Di halaman yang tidak menulis ulang, judulnya jatuh kembali ke nama sekolah saja; itulah cara cacat
ini akhirnya terlihat, lewat halaman 404 yang baru.

Sekarang penimpaan hanya terjadi bila judul yang ada memang judul yang ditulis App sendiri (atau
judul statis dari `index.html`). Begitu sebuah halaman memasang judulnya sendiri, App mundur.

### Modul permainan menyala secara bawaan — KEPUTUSAN, bukan cacat

Pemilik template memutuskan modul permainan **tetap menyala secara bawaan**. Pembeli yang tidak
menginginkannya menulis satu baris di `.env`:

```
VITE_ENABLE_GAME_FEATURES=false
```

Sesudah itu tombol Play Gatcha dan Acak Nama hilang dari dashboard guru maupun layar absensi, dan
rutenya berganti menjadi halaman "fitur ditunda". **Play Quiz tetap ada** — ia di luar pagar itu
secara sengaja, karena alat mengajar, bukan permainan hadiah.

Jangan mengubahnya menjadi mati-secara-bawaan tanpa keputusan baru dari pemilik template.

### `enableGameFeatures` menyala secara BAWAAN

`featureFlags.js` menulis `VITE_ENABLE_GAME_FEATURES !== 'false'` — jadi modul permainan **aktif
kecuali dimatikan secara eksplisit**, kebalikan dari `enableTahfizh` dan `enableDeferredFeatures`
yang mati kecuali dinyalakan. Mudah salah baca, dan pernah salah dibaca: tombol Gatcha di dashboard
guru sempat disangka "tampil padahal saklarnya mati", padahal saklarnya memang menyala.

Tombol Gatcha dan Acak Nama di `GuruDashboard.jsx` memang belum mengikuti saklarnya sama sekali —
`DashboardWorkspace.jsx` sudah, jadi dashboard guru yang menyimpang. Sekarang keduanya ikut. Diuji
dua arah: dengan `VITE_ENABLE_GAME_FEATURES=false` hanya "Play Quiz" yang tersisa.

**Play Quiz sengaja DI LUAR pagar itu**, di dashboard guru maupun di layar absensi digital. Ia alat
mengajar yang selalu boleh dipakai guru, bukan permainan hadiah — keputusan pemilik template. Di
layar absensi ia dulu ikut di dalam pagar, jadi mematikan permainan ikut mencabut kuisnya.

### Rekap kehadiran dimulai dari tanggal murid masuk kelas — SUDAH DIPERBAIKI

Rekap menyisir seluruh hari aktif dalam sebulan dan memperlakukan setiap hari tanpa catatan sebagai
tidak hadir. Masuk akal untuk murid yang memang sudah di kelas, keliru untuk murid pindahan: hari
sebelum ia tiba ikut dihitung bolos. Satu murid yang baru masuk kelas langsung berbunyi **92,3%
tidak hadir**.

`class_memberships.start_date` sudah lama ditulis saat mutasi tapi **tidak pernah dikembalikan
endpoint mana pun**, jadi frontend tidak punya cara mengetahuinya. `Detail` di `santri.go` kini
mengembalikannya sebagai `class_start_date`, diambil lewat LATERAL join dari keanggotaan yang
berstatus aktif.

Dipakai tanggal **PINDAH**, bukan tanggal pertama kali murid masuk sekolah — keputusan pemilik
template. Murid yang pindah kelas di tengah bulan memulai rekap bulan itu dari tanggal pindahnya.

Dua layar ikut: `SantriAbsensiRecap` memulai jendelanya dari tanggal itu, dan matriks kehadiran di
`SantriDetailModal` memberi hari sebelum itu keadaan tersendiri — "Belum masuk kelas ini", bukan
libur dan bukan pula bolos — serta mengeluarkannya dari hitungan Tidak Hadir.

Diuji dengan murid yang masuk 12 Agustus: matriks menandai 1–11 sebagai belum masuk, 12–14 sebagai
Tidak Hadir, dan totalnya turun dari 12 menjadi 3.

Efek sampingnya: bulan tanpa satu pun hari belajar (murid pindah di akhir bulan, atau bulan yang
libur seluruhnya) dulu berbunyi "0% kehadiran" — kabar buruk padahal tidak ada yang diukur. Sekarang
tanda hubung. **0% yang sungguhan tetap 0%**, yaitu murid yang punya hari belajar tapi tidak hadir
sekali pun.

Rapor **tidak** terpengaruh, dulu maupun sekarang: ia memakai ringkasan per status dari backend, yang
hanya menghitung baris yang benar-benar ada, jadi hari tanpa catatan tidak pernah menjadi alpa di
sana.

### "Sabtu ikut dihitung" bukan cacat — periksa `academic_calendar_month_settings` dulu

Rekap yang menghitung Sabtu sebagai hari belajar mudah disangka salah. Bawaan sistemnya sudah benar
(`DEFAULT_SATURDAY_IS_HOLIDAY = true`), tapi sekolah bisa menetapkan lain **per bulan** lewat
`academic_calendar_month_settings`. Basis data pengembangan ini punya baris untuk Agustus 2026
dengan `saturday_is_holiday = false`, jadi 13 hari belajar (1–16 Agustus dikurangi hari Minggu)
memang benar.

Sebelum melaporkan hitungan hari belajar sebagai cacat, periksa tabel itu untuk bulan yang
bersangkutan.

### Tombol kembali jangan menebak asalnya — pakai `useKembali`

Halaman alat bantu — kuis, gatcha, acak nama, papan skor, mode TV — bisa dibuka dari lebih dari satu
tempat: dashboard guru, layar absensi digital, atau URL langsung. Kelimanya dulu menulis tujuan
tombol kembalinya mati, umumnya `/absensi-digital`, karena dulu memang hanya dari sana. Begitu
tombolnya muncul juga di dashboard guru, guru yang menekannya dari dashboard terlempar ke layar
absensi — bukan kembali ke tempat ia tadi.

`src/hooks/useKembali.js` menanganinya: `navigate(-1)`, dengan penjaga `useLocation().key !==
'default'`. Nilai `'default'` hanya muncul pada entri PERTAMA riwayat peramban — halaman dibuka lewat
URL langsung, tab baru, atau muat ulang — dan di situ `navigate(-1)` akan membuang penekan keluar
aplikasi, jadi tujuan cadangan yang dipakai.

**Halaman baru yang bisa dicapai dari lebih dari satu tempat wajib memakai hook ini**, bukan menulis
tujuannya sendiri. Diuji dari dashboard, dari layar absensi, dan lewat URL langsung.

### ENAM aturan cetak, dulu saling meniadakan — SUDAH DIPERBAIKI

Aplikasi ini punya **enam** jalur cetak yang masing-masing perlu menyapu seluruh halaman. Dua berkas
CSS yang selalu termuat, empat `<style>` sebaris di dalam komponen:

| Sumber | Sasaran yang diselamatkan |
|---|---|
| `rapor-cetak.css` | `#rapor-cetak-root` (lembar rapor sekelas) |
| `cetak-bukti.css` | `.bukti-cetak` (bukti pendaftaran, rekap SPMB) |
| `PaymentSystem.jsx` | `#receipt-content` (kuitansi pembayaran) |
| `PaymentProofModal.jsx` | `#payment-proof-content` (bukti bayar) |
| `PentashihDashboard.jsx` | `#pengawasan-cetak` (laporan pengawasan sekolah) |
| `SantriDetailModal.jsx` | `#rapor-akademik-cetak` (rapor akademik & karakter) |

Empat yang pertama sudah ada aturannya tapi tanpa pagar, jadi saling membunuh. Yang paling gawat:
PaymentSystem merender PaymentProofModal, jadi keduanya selalu terpasang bersamaan di panel
Pembayaran, dan aturan modal memakai `!important` sementara aturan kuitansi tidak — **kuitansi
pembayaran keluar kosong**.

Dua yang terakhir sebaliknya: isinya sudah lama disiapkan untuk dicetak (puluhan kelas `print:`)
tapi tombolnya memanggil `window.print()` **polos**, tanpa aturan apa pun yang menyingkirkan
cangkang di luarnya — yang keluar seluruh layar beserta bilah navigasi dan menu.

Keenamnya kini memakai pola yang sama. **Setiap jalur cetak baru WAJIB dipagari `:has()` pada
sasarannya sendiri, pengecualiannya ikut dipagari, dan barisnya ditambahkan ke tabel ini.**

Keduanya berlaku bersamaan dan masing-masing membunuh cetakan yang lain: rapor tercetak **kosong**
karena disembunyikan aturan bukti, dan bukti pendaftaran tercetak **kosong** karena seluruh
leluhurnya disembunyikan aturan rapor. Halamannya tetap keluar — jumlahnya benar, isinya tidak.

**Kenapa lolos bertahun-tahun:** di server pengembangan Vite hanya memuat CSS milik halaman yang
pernah dibuka, jadi keduanya jarang bertemu dalam satu sesi. `npm run build` menggabungkan seluruh
CSS jadi **satu berkas**, sehingga di produksi keduanya SELALU aktif bersamaan. Cacat yang hampir
tidak mungkin terlihat saat dikembangkan, dan selalu terjadi pada pembeli.

Perbaikannya: tiap aturan penyapu dipagari `:has()` sehingga hanya berlaku bila sasarannya benar-benar
ada di halaman. `#rapor-cetak-root` selalu ada di DOM tapi kosong selama dialog tertutup, jadi yang
diperiksa isinya (`:has(#rapor-cetak-root .rapor-lembar)`), bukan keberadaannya.

**Jebakan yang muncul saat memperbaikinya, dan hampir lolos lagi:** `:has()` mewarisi bobot
argumennya, jadi `body:has(.bukti-cetak) *` berkekuatan (0,1,1) sedangkan pengecualian `.bukti-cetak`
hanya (0,1,0) — kalah, meski keduanya `!important`. Sebelum dipagari, penyapunya cuma `body *`
(0,0,1) sehingga pengecualian polos masih menang. **Memasang pagar tanpa menaikkan bobot
pengecualiannya justru membuat bukti tercetak kosong.** Pengecualiannya kini ikut dipagari.

**Cara mengujinya tanpa mencetak sungguhan:** salin kedua blok `@media print` ke sebuah `<style>`
sementara tanpa media query, lalu baca `getComputedStyle().visibility` pada wadah rapor dan blok
bukti. `visibility: hidden` bersama `display: block` adalah tanda khas halaman kosong yang tetap
keluar dari mesin cetak.

### Menguji aturan cetak: awas transisi CSS

Cara mengujinya tanpa mencetak sungguhan ada di bagian sebelumnya — salin aturannya ke `<style>`
sementara tanpa media query, lalu baca `getComputedStyle().visibility`.

**Beri jeda minimal 300 ms sebelum membaca.** Elemen ber-`transition-all` (banyak tombol memakainya,
mis. `.school-shine-button`) menahan nilai lamanya selama transisi berjalan, dan transisi menang atas
`!important` di kaskade. Membaca setelah 80 ms memberi "visible" untuk elemen yang sebenarnya sudah
tersembunyi — kesimpulan salah yang tampak seperti kegagalan kaskade.

### Cetak rapor sekelas sudah diuji pada beban sebenarnya

28 murid dalam satu kelas: **1,0 detik**, 145 panggilan ke server, semuanya berhasil, 56 lembar
terbentuk (28 pratinjau + 28 salinan cetak), tanpa error konsol dan tanpa murid yang gagal.
Pemuatan berkelompok lima-lima di `fetchRaporKelas` bekerja seperti rancangannya. Beban bukan
masalah; yang bermasalah hanya stylesheet cetaknya di atas.

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

Model data absensi **sengaja tidak dirombak** — sinkronisasi hari aktif kalender sudah selesai tanpa
mengubah data absensi; jangan mengusulkan perubahan skema harian tanpa alasan baru.

Sudah tuntas juga: peran superadmin, direktori staf dari data guru, jadwal pelajaran di dashboard
guru dan murid, guard bentrok jadwal, penyembunyian akun superadmin dari pembeli,
**`SETUP.md` sebagai panduan pemasangan untuk pembeli**, halaman Profil memakai data sungguhan, serta
**aksen warna, tahun ajaran, dan tautan Maps yang benar-benar berfungsi**.

Form Identitas dan Isi Halaman Depan **sudah diuji klik**, bukan hanya jalur datanya: mengubah teks,
menambah kartu, dan menghapus kartu semuanya tersimpan dan tampil di halaman depan; identitas berlaku
seketika tanpa muat ulang dan bertahan setelah dimuat ulang penuh.

Tuntas pada 2026-08-07: **modul PPDB penuh** (migrasi, handler, adapter, panel, formulir tersambung),
**palet dua warna tanpa rona ketiga**, **tab Info Sekolah dan pemilih dua warna diuji klik di
browser**, dan **tampilan ponsel sepuluh halaman publik**.

Tuntas pada 2026-08-08: **Diterima → Data Murid dalam satu transaksi**, **pembatas laju pada kedua
endpoint publik**, **halaman cek status publik beserta pesan WhatsApp per status**, dan **sapuan
ponsel 19 panel dashboard**.

Tuntas pada 2026-08-08 (putaran kedua): **istilah SPMB beserta jalur yang sah menurut Permendikdasmen
No. 3 Tahun 2025**, **kuota jalur dan daya tampung**, **impor pendaftaran lama dari Pesan Masuk**, dan
**cetak bukti pendaftaran**.

Tuntas pada 2026-08-08 (putaran ketiga): **wilayah domisili yang diisi pembeli** dan **lembar rekap
SPMB siap cetak**. Otomatisasi pengiriman kabar **ditolak pemilik dengan sengaja** — WhatsApp manual
ke nomor yang sudah terdaftar dianggap cukup; jangan mengajukannya lagi tanpa alasan baru.

Tuntas pada 2026-08-08 (putaran audit modul): **delapan modul inti disisir** — Absensi, Pembayaran,
Backup & Restore, Data Murid, Data Guru, Manajemen Kelas, Kalender Akademik, dan Jadwal Pelajaran.
Rincian per modul dan polanya di "Putaran audit modul 2026-08-08" pada bagian 7.

Tuntas pada 2026-08-08 (rapikan sisa LPQ + fitur situs):
- **Pengumuman tersambung ke situs** — halaman Berita menampilkan pengumuman terbit sebagai kartu
  kategori "Pengumuman" (dulu dibuat admin tapi tak pernah tampil).
- **Tab "Apresiasi" di Konten dimatikan** (Papan Peringkat + Murid/Guru of the Month). Data tetap di
  state agar "Simpan Semua" tidak menimpanya.
- **WhatsApp jilid dirapikan** — template Kenaikan/Penurunan Jilid & "Link grup per jilid"
  disembunyikan saat `VITE_ENABLE_TAHFIZH` mati (default sekolah umum); template Pembayaran & SPMB
  tetap tampil untuk semua sekolah.
- **Mode TV dirombak untuk SD umum** — panel ngaji (kuota sesi pagi/siang/sore, leaderboard ngaji,
  kutipan wali, kartu profil) diganti panel umum: Pengumuman, Jadwal Hari Ini, Galeri Foto; header
  pakai identitas sekolah. **Mesin absensi RFID dipertahankan utuh** (kios scan tetap mencatat
  kehadiran di semua panel). Panel setting TV disederhanakan; bentuk `tv_config` baru, nilai lama
  jatuh ke default (semua panel nyala). Smoke test layar TV pada 2026-08-09 dengan sesi operasional
  merender identitas sekolah, jam/tanggal, Pengumuman, Jadwal Hari Ini, dan Galeri tanpa crash.
- **Kuis Hafalan sengaja dibiarkan menyala**: fitur "Tambah Kategori" sudah ada, jadi kategori
  pertanyaan umum bisa ditambah pembeli langsung dari dashboard. Keputusan pemilik: jangan matikan.

Tuntas pada 2026-08-08 (tiga halaman publik jadi bisa disunting pembeli):
- **Prestasi, Ekstrakurikuler, Program** — dulu isinya terkunci di kode, termasuk nama juara & pembina
  karangan ("Rafi Alfarizi, kelas VI A", "Hendra Wijaya, S.Pd.") yang tampil di situs pembeli seolah
  nyata, plus statistik hardcoded ("86 penghargaan", "Enam/Sepuluh"). Kini masing-masing punya kunci
  `website_content` (`prestasi_content`, `ekskul_content`, `program_content`), lib normalize/fetch/save,
  komponen `*ContentSettings.jsx`, dan tab di Manajemen Konten. Pola sama persis seperti
  `ppdbContent.js` + `PpdbContentSettings.jsx`.
- **Pola yang ditegakkan** ("teks disunting pembeli, tampilan tetap di kode"): warna kartu/gradien
  dipilih otomatis dari palet berdasarkan urutan (pembeli tidak menulis CSS); statistik yang bisa
  dihitung (jumlah item, total JP, hitungan tingkat) diturunkan otomatis dari daftar, bukan disimpan;
  angka & kata hardcoded di berkas `generated/*Body.jsx` (mis. "86", "Enam", "Sepuluh") diganti prop
  dinamis. Bawaan sengaja NETRAL (placeholder tanpa nama terlihat asli) dengan peringatan "ganti".
- Terbukti end-to-end untuk Prestasi: seed `prestasi_content` lewat API → halaman publik menampilkan
  data tersimpan (catatan, grafik, podium). Ekskul & Program memakai mekanisme simpan/muat yang sama.
- **Smoke test editor admin 2026-08-09** membuka tab Program, Prestasi, dan Ekstrakurikuler dengan
  sesi yang sudah tersedia; panel merender tanpa crash. Tombol simpan tidak ditekan agar tidak
  mengubah konten sekolah.

### Galeri & Fasilitas dinamis — TUNTAS (2026-08-08, commit `5ce5a71`)

Kedua halaman kini render daftar CMS **penuh** (jumlah bebas), bukan lagi menimpa slot per-indeks.
Modal editor di ContentManagement diperluas: Galeri → kategori/keterangan/tanggal (di samping foto &
judul); Fasilitas → kategori/luas/ringkasan/deskripsi. Halaman publik memakai daftar `source` (CMS
bila ada, jika kosong contoh bawaan `FOTO`/`F`); span mosaik & gradien dipilih otomatis dari urutan
(pembeli tak menulis tata letak); filter kategori/tur/chip/mozaik/lightbox atas daftar aktif.
Terverifikasi render default di browser (18 foto, 10 ruang), lint + build hijau.

**Sisa kecil (opsional):** rincian per-ruang (meta grid) belum ada di editor Fasilitas — saat ruang
dari CMS, grid rincian kosong (bawaan tetap menampilkannya). Statistik hero/band/ringkas kedua
halaman dibiarkan hardcoded (dekoratif). Smoke test membuka editor Media/Galeri/Fasilitas;
klik-simpan sengaja belum dilakukan karena bukan bagian verifikasi non-mutatif.

**Catatan sejarah — masalah sebelum perbaikan ini:** CMS dulu hanya *menimpa slot per-indeks*, bukan
daftar dinamis penuh.
- `GalleryPage.jsx`: 18 foto hardcoded di `FOTO` (nama, kategori, keterangan, tanggal, gradien,
  colSpan, rowSpan). Kunci `galleryPhotos` (dikelola di ContentManagement tab Media, modal
  `galleryPhotos`: hanya **url + caption**) menimpa url/caption per slot `i`. Foto ke-19 diabaikan;
  kategori/keterangan/tanggal tetap dari kode. Hero stats (428/12/9), band stats (624/38/18), dan 4
  ALBUM juga hardcoded — itu dekorasi, boleh dibiarkan.
- `FacilitiesPage.jsx`: 10 ruang hardcoded di `F` (nama, kategori, luas, gradien, cerita, ringkas,
  meta[], colSpan, rowSpan). Kunci `facilities` (modal `facilities`: name + description + image_url)
  menimpa name/foto per slot `k`. Ruang ke-11 diabaikan; kategori/luas/meta tetap dari kode. Ringkas
  stats (4200 m²/12/10/24) hardcoded — dekorasi.

**Status implementasi:**
1. Editor yang sudah ada memakai kunci `galleryPhotos`/`facilities` dan memuat field galeri
   (kategori, keterangan, tanggal) serta fasilitas (kategori, luas, ringkas, deskripsi); alur unggah
   foto tetap dipertahankan.
2. Halaman publik merender daftar CMS penuh dengan span dan gradien fallback yang ditentukan otomatis,
   serta kembali ke `FOTO`/`F` bila CMS kosong.
3. Filter kategori, hitungan, lightbox, dan tur bekerja atas daftar aktif.
4. Statistik dekoratif tetap hardcoded sesuai keputusan; bukan data administrasi yang harus disunting.

Risiko: `galleryPhotos` juga dibaca HomePage (beranda) — pastikan penambahan field tidak merusak
konsumsi di sana (HomePage hanya pakai url/caption, jadi field tambahan aman diabaikan).

### Branding bawaan dan navigasi Konten — TUNTAS (2026-08-08)

#### Branding legacy dicabut — commit `8c80e39`

Permukaan template yang masih menampilkan identitas LPQ dinetralkan. Fallback logo sekarang memakai
`public/logo-sekolah.svg` melalui `src/lib/schoolAssets.js`; identitas sekolah tersimpan tetap menjadi
sumber utama. Metadata publik, sitemap, robots, pesan WhatsApp, laporan, kuitansi, absensi digital,
permainan, kuis, dan beberapa kartu/placeholder konten juga sudah diarahkan ke identitas sekolah
yang netral. Asset lama kini bernama `public/logo-legacy-sekolah.webp` dan tetap disimpan sebagai legacy
dihapus karena belum diperlukan untuk perubahan ini.

#### Navigasi Manajemen Konten disederhanakan — commit `abb1c00`

Panel `src/components/dashboard/admin/ContentManagement.jsx` tidak lagi menampilkan seluruh fungsi
sebagai deretan tab datar. Fitur yang sudah ada dikelompokkan berdasarkan tujuan:

| Kelompok | Bagian yang tetap tersedia |
|---|---|
| **Sekolah** | Identitas Sekolah (superadmin), Info Sekolah |
| **Halaman Publik** | Halaman Depan, Halaman Profil |
| **Program & Kegiatan** | Program, Prestasi, Ekstrakurikuler |
| **Media & Pendaftaran** | Media & Galeri, Informasi Pendaftaran |
| **Pesan** | Pesan Masuk |
| **Hafalan** | Hafalan, dengan sub-tab Per Kelas dan Per Juz tetap utuh |

Visibilitas Identitas Sekolah tetap khusus `superadmin`. Handler, state konten, kunci
`website_content`, upload, CRUD, dan tombol Simpan Semua tidak dihapus atau dipindahkan ke API baru.

**Verifikasi perubahan navigasi:** lint, 183 test Vitest, build, `git diff --check`, dan pemindaian
no-secret semuanya hijau. Di preview `http://localhost:3000/dashboard`, seluruh kelompok serta sub-tab
yang relevan dibuka satu per satu; pada desktop tidak ada overflow horizontal. Saat membuka Hafalan
per Juz, sesi browser sempat menerima `401` dari endpoint item akademik; ini memengaruhi pemuatan data
panel, bukan perpindahan navigasinya. Kemampuan viewport pada browser yang digunakan tidak tersedia,
jadi sapuan ulang khusus pada lebar 375px perlu dilakukan bila perubahan mobile ini akan diserahkan.

### Audit modul: cakupan yang SUDAH dan BELUM diperiksa

Audit dijalankan untuk mencari satu kelas cacat: **panel yang tampak jadi tapi
tidak benar-benar tersambung.** Pola yang dicari diambil dari yang sudah terbukti
terjadi di modul PPDB — data karangan di markup, tulisan tanpa `await` dengan galat
ditelan, nol validasi, janji ke pengguna yang tak pernah ditepati, kolom yang
ditulis tapi tak pernah dibaca, kontrol mati, dan penjagaan peran yang bolong.

Putaran audit kedua (2026-08-08) menuntaskan tujuh modul inti yang sebelumnya
BELUM — lihat "Putaran audit modul 2026-08-08" di bawah untuk rinciannya.
Cakupan sekarang:

| Bagian | Status | Hasil |
|---|---|---|
| Bisyaroh / gaji | **Dalam** | Dicabut permanen — lihat di atas |
| Penjagaan peran (empat switch) | **Dalam** | Cacat terparah ditemukan & diperbaiki |
| Kunci konten seluruh panel | **Tuntas** | Kesepuluhnya terbukti dibaca. Pola "panel menyimpan ke tempat yang tak dibaca siapa pun" **tidak terulang** |
| Izin & kepemilikan Forum | **Tuntas** | **Sehat, dan patut dicontoh:** identitas dari JWT, `author_id` dari badan permintaan sengaja diabaikan, penghapusan memeriksa kepemilikan (`!isAdmin && authorID != userID`) |
| Angka karangan (seluruh kode) | **Tuntas** | Bersih. Setiap `Math.random()` sah (kutipan, gatcha, pengocok nama, konfeti) |
| Survei rasio penjagaan 18 handler | **Permukaan** | Hanya hitungan; `forum.go` yang paling mencurigakan justru terbukti benar |
| Absensi | **Tuntas** | 3 bug — lihat putaran kedua di bawah |
| Data Murid | **Tuntas** | 6 bug diperbaiki |
| Data Guru | **Tuntas** | 9 bug — termasuk kebocoran hash sandi |
| Manajemen Kelas | **Tuntas** | 10 bug — termasuk membership tak sinkron |
| Kalender Akademik | **Tuntas** | 3 fix + endpoint publik baru |
| Pembayaran & Pengeluaran | **Tuntas** | 2 kebocoran data ditutup + sisa TPQ |
| Backup & Restore | **Tuntas** | Backend dibangun dari nol |
| Jadwal Pelajaran | **Tuntas** | 6 bug — termasuk aktivasi periode tak atomik |

**Seluruh modul inti kini sudah diaudit.** Tidak ada lagi baris BELUM.

### Putaran audit modul 2026-08-08

Tujuh modul inti diperiksa dengan pola yang sama seperti PPDB (penjagaan peran
bolong, panel yang tak menyimpan, data karangan, kolom ditulis tak dibaca).
Setiap modul: satu agen membaca handler Go, satu membaca panel React; temuan
disajikan sebagai opsi; perbaikan diverifikasi lewat API + build.

| Modul | Commit | Perbaikan utama |
|---|---|---|
| Absensi | `6aa292b` | Rekap terpotong 50 baris → diperbaiki; tata usaha terkunci menyunting → dibuka; jam sesi tidak lagi dari `DEFAULT_SESSION_TIMES`, tapi dari konfigurasi admin |
| Pembayaran & Pengeluaran | `c484772` | **Dua kebocoran:** `ListPayments` tanpa penjagaan peran (siapa pun baca semua riwayat) & `GetPayment` cek peran SETELAH query — ditutup; item TPQ dibersihkan; adapter `createExpense` ganda dihapus |
| Backup & Restore | `59485fc` | Endpoint Go dibangun dari nol (`backup.go`): dump per-tabel & restore upsert, admin-only, allowlist 12 tabel; frontend disambungkan (dulu stub `throw`) |
| Data Murid | `cd04165` | `ByRFID` santri hanya bisa lihat dirinya; `MoveClass` guru dibatasi kelasnya; role gate frontend; placeholder TPQ; gender wajib; sandi import "1234" dibuang |
| Data Guru | `462544f` | **Hash sandi bocor** di List/Detail/ByRFID (`SELECT *`) → kolom eksplisit tanpa `password`; tata usaha tak boleh ubah email; validasi email & panjang sandi; role badge pakai `ROLE_LABELS`; Syahadah/Qiroati → Bersertifikat/NUPTK |
| Manajemen Kelas | `6cbf6d8` | Roster PII & riwayat mutasi ditutup dari santri; **`MoveClass` kini sinkron `class_memberships`** (dulu hanya `current_class_id`, bikin roster beda); role gate dari peran asli (bukan prop default 'admin'); cek nama kelas duplikat; drag-reorder murid dihidupkan (dulu no-op) |
| Kalender Akademik | `1e3e8f3` | Validasi tanggal (400 bukan 500); bug tampilan UTC; **endpoint publik `/api/public/calendar`** agar situs bisa tampilkan agenda tanpa login (infrastruktur `is_public` sebelumnya menganggur) |
| Jadwal Pelajaran | `3808749` | **Aktivasi periode kini atomik** (dulu insert gagal bisa sisakan NOL periode aktif); cek bentrok jam saat edit sebagian (dulu ubah jam_mulai saja lolos); baca-ulang gagal tak balikkan jam objek; DeletePeriode error FK jadi 409 jelas; tombol master-data digate `canManage` |

Kalender akademik ternyata ada di `attendance.go` (bukan `academic.go`), di bawah
`/api/attendance/calendar`. `academic.go` hanya menangani hafalan/murojaah/karakter.

Dua pola yang paling perlu diingat dari putaran ini:

- **`MoveClass` memutakhirkan `current_class_id` tapi tidak `class_memberships`**,
  padahal `Detail` kelas membaca anggota dari memberships. Kalau menyentuh
  perpindahan murid, jaga kedua sumber tetap sinkron dalam satu transaksi.
- **Aktivasi periode ajaran dulu dua statement tanpa transaksi** (matikan lama →
  insert baru). Index `periode_ajaran_satu_aktif` hanya mencegah DUA aktif, bukan
  NOL — jadi insert yang gagal setelah mematikan yang lama meninggalkan sekolah
  tanpa periode aktif. Operasi "matikan lalu aktifkan pengganti" wajib satu tx.

### Yang masih terbuka

Diurutkan dari yang paling berdampak ke penjualan.

1. **Perluas jaring test — P1/P2.** Sekarang ada 183 test Vitest pada 10 berkas, termasuk test
   utilitas jadwal dan helper pagination PPDB; guard bentrok sudah diuji lewat API. Belum ada test
   komponen React dan belum ada test Go khusus handler jadwal/PPDB. Tambahkan hanya bila area tersebut
   akan diubah lintas komponen atau kontrak API-nya berkembang; jangan membuat mock besar tanpa risiko
   yang jelas.
2. **Uji penerimaan sebagai pengguna sungguhan — P1.** Smoke test agen sudah melewati alur formulir,
   editor, panel, dan TV dengan sesi yang ada, tetapi belum menggantikan verifikasi manusia: mengetik
   dengan papan ketik fisik, menekan tombol dengan tetikus, serta membuka hasil cetak/pratayang cetak
   yang sebenarnya. Pemilik atau tester dengan akun yang sah perlu menyelesaikan tiga pemeriksaan ini
   sebelum paket pembeli diserahkan.
3. **Juknis SPMB daerah sebelum gelombang berikutnya — P1 operasional.** Verifikasi sumber pusat
   2026-08-09 mengonfirmasi bahwa template kelas 1 SD benar: jalur Prestasi tidak diberlakukan,
   Domisili minimal 70%, Afirmasi minimal 15%, dan Mutasi maksimal 5%. Yang belum bisa diputuskan
   dari repository adalah Juknis pemerintah daerah, wilayah penerimaan, jadwal, kapasitas/rombel,
   dan syarat lokal sekolah pembeli. Isi melalui dashboard setelah keputusan resmi tersedia; jangan
   mengubah bawaan pusat berdasarkan asumsi.

Kalender publik, penahanan kuota otomatis, pengiriman WhatsApp otomatis, perombakan absensi, dan
pengembalian Bisyaroh tetap **ditutup oleh keputusan pemilik**, bukan pekerjaan yang tertunda.

### `SETUP.md` sekarang dokumen pembeli, bukan dokumen developer

Isinya ditulis untuk orang yang membeli template dan belum pernah melihat kodenya: pemasangan,
penyalaan, penempatan di internet, lalu **bagian 7** yang mengubah sekolah contoh menjadi sekolah
pembeli — ganti sandi admin, ganti data contoh, isi konten, dan penjelasan bahwa identitas produk
dikunci untuk penjual.

Kalau mengubah alur pemasangan, `SETUP.md` harus ikut diperbarui. Catatan lama di sana pernah salah
selama berbulan-bulan: judulnya masih memakai identitas pendahulu, email admin masih
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

Sekolah memilih **dua warna** — awal dan akhir gradasi — atau **satu warna** bila
memilih tampilan solid (`accentMode`). `turunkanPalet(awal, akhir, mode)` di
`src/lib/schoolIdentity.js` menurunkan delapan properti CSS dari pilihan itu lewat
`STOP_PALET`.

Sifat yang wajib dijaga: **pada pilihan bawaan `#6470ff` → `#e58fc4`, hasilnya
sama persis dengan palet asli desain** — diuji di `schoolIdentity.test.js`. Kalau
uji itu gagal, setiap pemasangan baru berubah tampilannya tanpa ada yang
memintanya.

Empat hal pada `STOP_PALET` yang tampak berlebihan tapi semuanya menjawab
kerusakan nyata yang sudah terjadi:

- **`bentuk`** pada dua stop tengah: selisih kecil dari interpolasi lurus, diukur
  dari palet aslinya. Tanpa ini kejenuhan stop tengah meleset ~10% dan palet
  bawaan tidak lagi cocok. Pada mode solid `bentuk` TIDAK dipakai — ia justru
  menggeser warna sedikit dari yang dipilih sekolah.
- **Rona jalur terpendek** (`bukaRona`): tanpa ini gradasi merah→ungu memutari
  seluruh roda warna dan melewati hijau serta biru.
- **`tint` dicampur menuju putih**, bukan penambahan terang tetap. Versi pertama
  memakai `+12,2` terang, yang hanya memucat bila aksennya sudah terang; pada
  hijau tua hasilnya hijau menyala, padahal kedua nilai itu dipakai sebagai latar
  lembut kartu guru dan mosaik fasilitas.
- **`dariAkhir`** untuk `aksen-hangat`: rona SAMA dengan warna akhir, hanya lebih
  pekat dan sedikit lebih dalam. Lihat "Dua warna berarti dua rona" di bawah.

### Dua warna berarti dua rona — `aksen-hangat` tidak lagi warna ketiga

Keputusan pengguna: **dua warna saja.** Palet tidak boleh memunculkan rona yang
tidak dipilih sekolah.

`aksen-hangat` dulu melanggarnya. Dua cara sudah dicoba dan **keduanya salah**:

| Cara | Akibatnya pada hijau `#12a150` → jingga `#f59e0b` |
|---|---|
| Putar rona `+60°` tetap | hijau limau menyala |
| Lanjutkan arah sapuan ke posisi 1,69 | **magenta** `#e8008f` |

Sekarang `dariAkhir: [0, 19.2, -4.7]` — rona persis sama dengan warna akhir,
kejenuhan +19,2, terang −4,7. Hijau→jingga kini menghasilkan `#e89200`: jingga
yang lebih dalam, rona 38° sama dengan warna akhirnya.

Kenapa tidak disamakan saja dengan `aksen-ujung`: nilai ini **selalu dipasangkan
dengan `aksen-ujung` sebagai gradasi** di sembilan tempat pada halaman publik
(Fasilitas, Ekstrakurikuler, Program, Berita, Prestasi, Kontak, Profil). Kalau
nilainya identik, kesembilan gradasi itu jadi rata. Yang dibedakan kedalamannya,
bukan ronanya — hubungan yang sama seperti `aksen-pekat` terhadap `aksen`.

**Konsekuensi yang diterima:** satu nilai palet bawaan bergeser dari desain
aslinya, `aksen-hangat` `#f0a06c` (jingga) menjadi `#f06cbd` (merah muda lebih
dalam). Itu **satu-satunya** pergeseran tampilan bawaan, dan sudah disetujui.
Uji `describe('dua warna saja')` di `schoolIdentity.test.js` mengunci sifat ini
untuk empat pasangan warna.

Tiga hal yang mudah terlewat:

- Nilai bawaan **juga** ada di `:root` pada `src/index.css`. Tanpa itu, cat
  pertama sebelum JavaScript selesai merender `var(--sekolah-…)` tanpa nilai dan
  tombol kehilangan warnanya sekejap. Mengubah `STOP_PALET` berarti menyamakan
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

### Nama orang karangan: fallback halaman publik dinetralkan

Profil, Kontak, dan pendamping Prestasi memakai data guru atau konten pembeli.
Audit 2026-08-09 juga menutup dua celah fallback yang tersisa:

- `src/pages/NewsPage.jsx` kini memakai label penulis **Sekolah** bila
  `GET /api/content/teachers` kosong atau gagal; guru nyata tetap dipakai bila tersedia.
- `src/pages/FacilitiesPage.jsx` kini memakai label peran seperti **Petugas perpustakaan**
  dan **Guru pendamping**, bukan nama orang yang tidak berasal dari data publik.

Nama yang masih tampak saat smoke test berasal dari data guru/CMS yang sedang tersimpan,
bukan konstanta fallback. Jangan menulis nama contoh baru; pakai endpoint publik atau
label peran netral.

**Kalau menambah halaman yang menampilkan orang, ambil dari endpoint itu** dan
pakai `src/lib/staf.js` (`sebutanStaf`, `inisialNama`, `stafKe`). Jangan menulis
nama contoh di kode: pada salinan yang terjual, itu berarti sekolah pembeli
memperkenalkan orang yang tidak ada.

Naratif halaman Profil dan seluruh ketentuan halaman PPDB juga sudah tidak
ditanam di kode — masing-masing di `profile_content` dan `ppdb_content` (lihat
bagian Panel Konten). Tidak ada lagi data per-sekolah yang tertulis di kode.

### Identitas dipecah dua kunci karena pemiliknya berbeda — SUDAH DIPUTUSKAN

Keputusan pemilik: **hanya nama sekolah (beserta logo dan warna) yang milik
penjual.** Sisanya — termasuk visi, misi, dan tujuan — milik pembeli.

Sebelumnya seluruh field berada di dalam satu objek `school_identity`, dan kunci
itu ada di `brandKeys`. Karena penjagaan di Go bekerja **per-kunci**, izinnya
seluruhnya-atau-tidak: pembeli tidak bisa mengubah nomor teleponnya sendiri,
apalagi visi sekolahnya. Menambah pengecualian di `brandKeys` tidak bisa
menyelesaikannya.

| Kunci | Pemilik | Isi |
|---|---|---|
| `school_identity` | superadmin (ada di `brandKeys`) | `name`, `shortName`, `logoAbbr`, `accentColor`, `accentColor2`, `accentMode` |
| `school_info` | pembeli (peran admin) | kontak, alamat, jam layanan, tahun ajaran, deskripsi, visi, misi, tujuan |

Daftarnya tunggal: `BRAND_FIELDS` di `schoolIdentity.js`. Empat uji menjaga agar
tidak ada field yang bocor ke sisi yang salah, hilang, atau muncul di keduanya.

**`getSchoolIdentity()` tetap mengembalikan gabungan keduanya**, jadi seluruh
pembaca (nav, footer, Kontak, Profil, PPDB, kuitansi, dashboard) tidak perlu tahu
soal pemecahan ini. Yang berbeda hanya penulisannya: `saveSchoolBrand` versus
`saveSchoolInfo`.

Panelnya juga dua: `SchoolIdentitySettings` (tab Identitas Sekolah, superadmin)
dan `SchoolInfoSettings` (tab Info Sekolah, admin).

Pemasangan lama yang masih menyimpan semuanya di `school_identity` tetap tampil
benar: `hydrateSchoolIdentity` menumpuk `school_info` **di atas**
`school_identity`, jadi field lama terbaca sampai ada yang menyimpan sekali.

### PPDB jadi modul sungguhan — tidak lagi dititipkan ke `feedbacks`

Formulir PPDB dulu **meratakan seluruh isiannya menjadi satu paragraf** lalu
mengirimkannya ke `POST /api/content/feedback`. Akibatnya pendaftaran bercampur
dengan pesan pengunjung, tanpa kolom, tanpa status, dan tanpa cara menandai mana
yang sudah diperiksa.

Kenapa tabel sendiri dan bukan kolom tambahan pada `feedbacks`: pendaftaran punya
siklus hidup, nomor pendaftaran, dan dua puluh kolom data calon murid. Pesan
pengunjung tidak punya satu pun. Menggabungkan keduanya membuat setiap kolom
pendaftaran wajib nullable dan setiap query harus menyaring jenis barisnya.

| Lapisan | Berkas |
|---|---|
| Migrasi | `20260807000100_pendaftaran_ppdb.sql` — dua tabel, murni aditif |
| Handler | `backend/internal/handler/ppdb.go`, dipasang di `/api/ppdb` |
| Adapter | `src/lib/ppdbAdapters.js` |
| Panel | `src/components/dashboard/admin/PpdbRegistrations.jsx`, tab `ppdb` |
| Formulir | `src/pages/PpdbPage.jsx` (rute `/pendaftaran`, **bukan** `/ppdb`) |

Tujuh hal yang perlu diketahui sebelum menyentuhnya:

- **Penomoran dipindah ke UPSERT atomik.** `ppdb_nomor_urut` dinaikkan lewat satu
  pernyataan `ON CONFLICT DO UPDATE … RETURNING`. `max(urut)+1` akan membagikan
  nomor yang sama ke dua pendaftar yang menekan kirim bersamaan. Sequence biasa
  tidak dipakai karena tidak bisa dibuat ulang per tahun tanpa DDL saat berjalan.
  Seluruh penyimpanan dalam satu transaksi, supaya nomor yang sudah dinaikkan
  tidak terpakai bila penyisipan barisnya gagal.
- **`PUT`, bukan `PATCH`.** `corsMiddleware` di `main.go` hanya mengizinkan
  `GET, POST, PUT, DELETE, OPTIONS`. Rute PATCH lolos uji lewat PowerShell tapi
  ditolak browser dengan **405** — ini benar-benar terjadi saat pengembangan.
  `apiClient` juga tidak punya `patch`.
- **Mount di bawah `OptionalAuth`, gerbangnya `CanManage` di dalam handler.**
  POST-nya publik (orang tua tidak punya akun), sisanya back-office. `RequireAuth`
  akan mematikan POST publiknya; tanpa middleware apa pun, peran kosong dan admin
  pun ditolak. Pola yang sama dipakai handler content.
- **Hapus hanya untuk admin** (`IsAdmin`), verifikasi untuk `CanManage`. Menolak
  dan menghapus dua keputusan yang berbeda beratnya; pendaftaran yang ditolak
  tetap harus bisa ditunjukkan bila orang tua bertanya.
- **Data calon murid tidak bisa disunting lewat API.** Handler `Update` hanya
  menerima `status` dan `catatan`. `diproses_oleh`/`diproses_pada` dicatat **hanya
  saat status berubah**, bukan saat catatan disunting — supaya jejaknya menjawab
  "siapa yang memutuskan", bukan "siapa yang terakhir mengetik".
- **`jalur` disimpan dua kali** (`jalur` = id, `jalur_label` = nama saat mendaftar).
  Daftar jalur disunting pembeli kapan saja; tanpa label tersimpan, pendaftaran
  tahun lalu berubah artinya ketika jalurnya diganti nama atau dihapus.
- **Kirim ganda mengembalikan pendaftaran yang sudah ada**, dicocokkan dari nama +
  tanggal lahir dalam tahun ajaran yang sama, ditandai `duplikat: true`. Bukan
  galat, dan bukan baris kedua. Indeks unik NISN bersifat **parsial** (`where nisn
  is not null and nisn <> ''`) karena sebagian pendaftar kelas satu belum punya.

**Tidak ada unggahan berkas, dan itu disengaja.** Endpoint unggah ada di balik
`RequireAuth`; membukanya untuk pengunjung yang tidak dikenal berarti menerima
berkas dari siapa saja. `berkas_siap` adalah **pernyataan kesiapan** (jsonb, id
mengikuti `ppdb_content.berkas` yang boleh diubah pembeli), bukan berkas terunggah.
Markup lama menyebut "unggah berkas", "maks 2 MB per file", dan menampilkan
"Terunggah · kartu-keluarga.pdf" — nama berkas karangan untuk unggahan yang tidak
pernah terjadi. Semuanya sudah diselaraskan dengan kenyataan.

**Tiga kebohongan pada formulir lama yang sudah dibereskan:**

1. `kirim()` dipanggil **tanpa `await`** dan galatnya ditelan `catch {}` kosong,
   lalu `setDone(true)` langsung dijalankan — layar "Pendaftaran terkirim" muncul
   walau tidak ada data yang masuk sama sekali.
2. **Nol validasi.** Formulir kosong pun bisa dikirim.
3. Nomor pendaftaran `PPDB-${tahunAwal}-04187` **dikarang di markup** dan sama
   untuk semua orang, ditambah janji "Konfirmasi juga dikirim ke WhatsApp" yang
   tidak pernah dikirim.

Validasi sekarang ada di **server** (`ppdbInput.periksa()`), berbahasa Indonesia
dan ditampilkan apa adanya di formulir. Pemeriksaan di browser (`kurang` di
`PpdbPage.jsx`) hanya menutup kesalahan yang paling sering, **bukan salinan seluruh
aturannya** — supaya keduanya tidak bisa berbeda pendapat.

### Bisyaroh dicabut permanen, dan kenapa

Keputusan pemilik setelah audit. Panelnya (`SalaryCalculation.jsx`, 451 baris) dan
tabnya sudah dihapus dari kedua dashboard.

Tiga alasan, ditemukan dengan melacak kodenya:

1. **Tombol Simpan tidak menyimpan apa pun.** Isinya hanya
   `toast({ title: "Disimpan" })` lalu menutup dialog. Nol panggilan API. Dan
   memang tidak ada yang bisa dipanggil: nol tabel gaji di basis data, nol rute
   salary di Go, nol adapter. Seluruh isian — jabatan tiap guru, potongan absen,
   entri badal, bahkan nominal tarifnya — hilang setiap halaman dimuat ulang.
   Bendahara mengisi ulang semuanya setiap bulan, dan hasilnya hanya bisa diekspor.
2. **Tarifnya milik sekolah Al-Qur'an.** Kolomnya berbunyi "Sesi Syahadah"
   Rp700.000 dan "Sesi Non-Syahadah" Rp400.000 — syahadah itu sertifikasi guru
   Al-Qur'an, tidak berarti apa pun di SD negeri. Ada juga `deductionTpQ`.
3. **Ia bertentangan dengan panel lain.** Rekap Guru menyimpan koreksi sesi
   mengajar ke `guru_session_overrides` (dan itu sungguhan tersimpan), tapi
   Bisyaroh menghitung dari penugasan kelas dan mengabaikannya. Dua panel menjawab
   "berapa sesi guru ini" dengan angka berbeda.

Ia juga memuat kode mati: `c.kategori === 'Dewasa'`, padahal kategori murid sudah
dihapus seluruhnya.

**Jangan dikembalikan tanpa membangun penyimpanannya lebih dulu** (migrasi →
handler → adapter), dan tanpa memastikan sekolah pembeli memang menggaji gurunya
sendiri — guru PNS bergaji pemerintah, bukan dari kas sekolah.

`VisitorStats.jsx` ikut dihapus di kesempatan yang sama: berkas mati, tidak diimpor
di mana pun, isinya hanya papan penunjuk ke tab Log Login.

### Tata usaha dan superadmin terkunci dari Data Murid — SUDAH DIPERBAIKI

Ditemukan saat audit modul, dan ini **cacat terparah yang pernah ditemukan di
repo ini**: dua dari lima peran tidak bisa membuka maupun menyunting data murid.

Penyebabnya satu kebiasaan yang terulang di empat tempat — daftar peran ditulis
satu per satu alih-alih memakai predikat yang sudah ada:

```go
switch role {
case "admin":
    // full access
...
default:
    jsonError(w, "forbidden", http.StatusForbidden)
```

`tata_usaha` (ditambahkan `20260805000100`) dan `superadmin` (ditambahkan
`20260806000700`) masuk ke enum `app_role` lewat migrasi yang lebih baru, dan
keempat switch ini tidak pernah ikut diperbarui. Keduanya jatuh ke `default`.

| Tempat | Akibatnya |
|---|---|
| `santri.go` List | tata usaha & superadmin **403** saat membuka Data Murid |
| `santri.go` Update | tata usaha & superadmin **tidak bisa menyunting satu pun murid** |
| `academic.go` ListMurojah | keduanya 403 |
| `attendance.go` `isValidAppRole` | absensi yang dicatat kedua peran itu ditolak sebagai "peran tidak sah" |

Data Murid adalah **pekerjaan utama tata usaha**, tabnya tetap ditampilkan kepada
mereka, dan panelnya gagal dengan "Gagal memuat data murid: forbidden".

**Perbaikannya bukan menambah dua `case` lagi** — itu akan terulang pada peran
berikutnya. Cabang akses-penuh sekarang memakai `middleware.CanManage(role)`,
predikat yang sudah menjadi acuan seluruh handler lain. `isValidAppRole` diperbaiki
dengan memuat keenam nilai enum dan diberi catatan bahwa daftarnya harus ikut
bertambah.

**Kenapa tidak ada yang menangkapnya selama berbulan-bulan:** setiap uji dan setiap
guard memakai akun **admin**. Peran lain tidak pernah diuji sama sekali. Itu celah
metode, bukan celah kode — dan itulah yang ditutup
`scripts/validate-akses-peran.ps1` (lihat bagian guard).

### Aturan SPMB 2025 — bawaan lama memakai aturan yang sudah dicabut

**Permendikdasmen No. 3 Tahun 2025** mencabut Permendikbud No. 1 Tahun 2021, dan
bawaan aplikasi ini semula mengikuti aturan lama itu. Riset ini dilakukan atas
permintaan pemilik sebelum kuota dikerjakan, dan hasilnya mengubah rencananya.

| Bawaan lama | Yang berlaku | Kenapa penting |
|---|---|---|
| PPDB | **SPMB** (Sistem Penerimaan Murid Baru) | istilah resminya berganti |
| Jalur **Zonasi** | Jalur **Domisili** | bukan hanya nama: zonasi menghitung jarak garis lurus, domisili memakai wilayah administratif yang ditetapkan pemda |
| Jalur **Prestasi** | **DIBUANG** | "jalur prestasi tidak diberlakukan dalam penerimaan murid kelas I Sekolah Dasar" |
| Jalur **Perpindahan tugas** | Jalur **Mutasi** | penamaan |
| usia "minimal 6 tahun" | **diprioritaskan 7, paling rendah 6** | orang tua anak 7 tahun sebelumnya tidak tahu dirinya diutamakan |

Kuota SD: **Domisili ≥70%, Afirmasi ≥15%, Mutasi ≤5%.** Perhatikan Mutasi adalah
batas **ATAS**, bukan bawah — dua sumber sempat berbeda soal ini dan keduanya
diperiksa sebelum dipakai.

**Satu akibat yang tidak disangka:** keputusan pemilik "tanpa peringkat otomatis"
ternyata justru yang BENAR. Menghitung peringkat dari jarak akan salah, karena
domisili ditentukan wilayah administratif oleh pemerintah daerah, bukan jarak.
Jangan menambahkan peringkat berbasis jarak nanti tanpa memeriksa ulang aturannya.

**Yang diganti dan yang TIDAK.** Diganti: seluruh tulisan yang dilihat orang, label
menu, judul halaman, template WhatsApp, dan awalan nomor pendaftaran
(`SPMB-2026-0001`). TIDAK diganti, dengan sengaja:

- nama berkas (`ppdb.go`, `ppdbAdapters.js`, `PpdbRegistrations.jsx`),
- nama tabel (`pendaftaran_ppdb`, `ppdb_nomor_urut`) dan kunci konten (`ppdb_content`),
- rute (`/api/ppdb`, `/pendaftaran`).

Alasannya: mengganti nama tabel menuntut migrasi yang berisiko tanpa manfaat bagi
siapa pun, dan mengganti rute publik mematikan tautan yang sudah disebar sekolah.
Perbedaan nama-kode dengan nama-tampilan itu **disengaja**; jangan "dirapikan".

Nomor lama berawalan `PPDB-` tidak diubah — orang tua sudah mencatatnya, dan
`CekStatus` membandingkan nomornya apa adanya, jadi keduanya tetap bisa diperiksa.

### Kuota dan daya tampung: angka saja, tanpa teguran

Keputusan pemilik: bawaan mengikuti aturan, **tanpa peringatan dan tanpa blokir.**
Memblokir berisiko melumpuhkan tata usaha bila angkanya salah isi atau kebijakan
daerahnya berbeda; menegur terus-menerus akan diabaikan.

- **Kuota per jalur** disimpan sebagai `kuota` (persen) pada tiap baris
  `ppdb_content.jalur`, dijepit 0–100 dan dibulatkan oleh `angkaKuota`.
- **Daya tampung** = `sum(classes.kapasitas)` untuk kelas aktif. Kolomnya sudah ada
  sejak `20260806000200_classes_kapasitas.sql` tapi belum pernah dibaca siapa pun.
- **Kursi per jalur** = `floor(daya tampung × kuota / 100)`, dibandingkan dengan
  cacah `status = 'diterima'` yang dikelompokkan per `jalur`.

Dikelompokkan berdasarkan `jalur` (id), **bukan** `jalur_label`: labelnya berubah
kapan saja saat pembeli menyunting daftar jalur, dan mengelompokkan berdasarkan
teks yang bisa berubah akan memecah satu jalur menjadi dua.

Akibat wajar yang bukan kerusakan: pendaftaran hasil impor punya `jalur_label`
("Zonasi") tapi `jalur` kosong, jadi tidak terhitung ke kuota jalur mana pun. Nama
jalur lama memang tidak punya padanan id yang sah.

---

## Dashboard Guru — rangkaian fitur bertahap

Enam fitur diminta berurutan; tiap fitur diselesaikan, diuji, dan di-commit sendiri
sebelum lanjut. Bagian ini mencatat yang sudah tuntas.

### 1. Absensi terpusat, dashboard guru baca saja — **Tuntas**

Aturannya: **satu pintu**. Semua absensi dicatat lewat halaman Absensi Digital dengan
kartu RFID. Dashboard guru hanya menampilkan, tidak pernah menulis. Koreksi absensi
adalah wewenang admin lewat panel rekap. Tidak ada tabel, endpoint, atau alur absensi
baru yang dibuat.

**Yang ditemukan rusak sebelum perbaikan.** Empat celah, semuanya di jalur absensi:

| Endpoint | Sebelum | Akibat |
|---|---|---|
| `PUT /api/attendance/{id}` | tanpa otorisasi sama sekali | **siapa pun yang login, termasuk santri, bisa mengubah baris absensi mana pun** |
| `PUT /api/attendance/{id}/absent` | `RequireRole("admin","guru","tata_usaha")` | guru bisa membatalkan kehadiran yang sudah tercatat |
| `GET /api/attendance` | tanpa scoping | guru bisa membuka rekap guru lain cukup dengan mengganti `user_id` |
| `AttendanceDetailsModal` | `role === 'guru' || isAdminRole(role)` | tombol koreksi muncul untuk guru |

**Yang dikerjakan.**

- `Update` dan `MarkAbsent` dijaga `middleware.CanManage` **di dalam handler**, bukan di
  router, supaya `superadmin` ikut tercakup — `RequireRole` di rute lama tidak
  menyebutkan `superadmin`.
- `List` disaring berdasarkan akun pemanggil. Guru mendapat
  `(user_id = $n OR role <> 'guru')`: baris absensi guru hanya miliknya sendiri, tapi
  baris santri tetap terbaca karena daftar kelasnya membutuhkannya. Peran non-staf lain
  dikunci ke `user_id` sendiri.
- `Create` **sengaja dibiarkan terbuka** untuk peran operasional. Kios `/absensi-digital`
  berjalan di bawah akun staf mana pun yang membukanya (`operationalDisplayRoles` di
  `App.jsx` memuat `guru` dan `pentashih`), jadi mengunci `Create` akan mematikan absensi
  pusat — hal yang justru dilarang.
- `AttendanceDetailsModal` memakai `canManageRole`, cerminan `CanManage` di sisi Go.
- Komponen baru `src/components/dashboard/shared/AbsensiSaya.jsx`: status hari ini, jam
  check-in, sesi, rekap bulan berjalan, dan tujuh riwayat terakhir. Murni baca.

**Beda "belum absen" dan "hari libur".** Panel membaca `fetchCalendarContext` dan
memisahkan keduanya. Tanpa itu hari Minggu akan terbaca sebagai absensi yang terlewat.
Hitungan "Tidak Hadir" memakai `getActiveCalendarDates` sampai **hari ini saja**, bukan
seluruh bulan — sisa bulan belum terjadi.

**Bukti uji.** Diuji dengan panggilan API sungguhan memakai akun guru sementara yang
dibuat lewat API admin lalu dihapus beserta baris absensinya:

| Uji | Hasil |
|---|---|
| guru `PUT /attendance/{id}` | 403 |
| guru `PUT /attendance/{id}/absent` | 403 |
| admin `PUT /attendance/{id}` | 200 |
| admin `PUT /attendance/{id}/absent` | 200 |
| guru minta `user_id` guru lain | 0 baris |
| guru minta semua baris `role=guru` | hanya dirinya |
| admin minta semua baris `role=guru` | 3 guru terlihat |
| guru baca absensi santri | tetap bisa, tanpa regresi |

**Belum diverifikasi:** tampilan panel di browser. Verifikasi itu butuh login dengan akun
guru, dan agen tidak dapat mengisi field password.

### 2. Modul nilai asesmen mata pelajaran — **Tuntas**

Tabel baru `nilai` (migrasi `20260815000100_nilai_asesmen.sql`, **sudah diterapkan** ke
Postgres lokal dan diperiksa dengan `\d nilai`).

**Kepemilikan bersandar pada `jadwal_pelajaran`, tidak disalin.** Itu keputusan
rancangan yang menentukan seluruh modul: `jadwal_pelajaran` adalah satu-satunya sumber
yang menyatakan guru mana mengajar mata pelajaran apa di kelas mana pada periode berapa.
Kalau kombinasi itu disalin ke tabel `nilai`, dua sumber kebenaran akan berselisih begitu
admin memindahkan jadwal — guru yang sudah dicabut tetap memegang nilainya. Karena itu
`nilai.go` selalu bertanya ulang lewat `guruMengajar()`.

**Aturan hak akses.**

| Peran | Baca | Tulis |
|---|---|---|
| admin, tata usaha, superadmin | semua | semua, termasuk memindahkan nilai antar kelas/mapel |
| guru | hanya kombinasi yang diampunya | hanya kombinasi yang diampunya |
| murid | hanya nilainya sendiri | tidak sama sekali |
| peran lain | dikunci ke `santri_id` sendiri | tidak sama sekali |

Peran yang tidak dikenali jatuh ke cakupan **paling sempit**, bukan paling longgar.

Dua penjagaan tambahan yang mudah terlewat:

- **Memindahkan nilai** ke kelas atau mata pelajaran lain berarti memindahkan
  kepemilikannya, jadi hanya back-office yang boleh. Tanpa ini guru bisa melempar nilai ke
  kelas yang tidak diampunya lalu kehilangan jejaknya.
- **Hak diperiksa terhadap baris yang ADA**, bukan terhadap kiriman klien. Kalau yang
  diperiksa kiriman, guru cukup mengirim `class_id` miliknya untuk menyunting nilai kelas
  lain.
- **Keanggotaan kelas divalidasi** saat menyimpan: murid harus benar-benar terdaftar di
  kelas itu (`class_memberships.status = 'active'` atau `santri.current_class_id`), supaya
  nilai tidak nyasar ke murid kelas lain hanya karena id-nya diketahui.

**Berkas.** `backend/internal/handler/nilai.go`, terdaftar di `main.go` sebagai
`/api/nilai`; `src/lib/nilaiAdapters.js`; `src/components/dashboard/shared/ModulNilai.jsx`.
Dropdown kelas dan mata pelajaran diturunkan dari jadwal guru — penyaringan itu hanya
kenyamanan, penjagaannya tetap di Go.

**Bukti uji.** Panggilan API sungguhan dengan guru uji yang dibuat lewat API admin, diberi
satu jadwal (Pendidikan Pancasila / Kelas Demo A), lalu dihapus beserta seluruh barisnya:

| Uji | Hasil |
|---|---|
| guru simpan nilai mapel yang diampu | 201 |
| guru simpan nilai mapel yang **tidak** diampu | 403 |
| guru simpan nilai untuk kelas lain | 403 |
| skor 150 | 400 |
| murid bukan anggota kelas | 400 |
| jenis asesmen kosong | 400 |
| guru `LIST` | 1 baris, hanya mapel ampuannya |
| admin `LIST` | 2 baris, kedua mapel |
| guru ubah nilainya sendiri | 200 |
| guru ubah nilai bukan ampuannya | 403 |
| guru hapus nilai bukan ampuannya | 403 |
| guru pindahkan nilai ke kelas lain | 403 |
| guru hapus nilainya sendiri | 200 |
| ringkasan (`/summary`) | jumlah, rata-rata, min, maks benar |

**Catatan kebersihan data.** Saat menyiapkan uji, `jadwal_pelajaran`
`d212e593-b36e-414a-8163-6c0f0179d79a` (Pendidikan Pancasila / Kelas Demo A) sempat
ditugaskan ke guru uji. Nilai `guru_id` aslinya **tidak tercatat di repositori** — tidak
ada seed jadwal di `supabase/migrations/` maupun `backend/init/` — jadi setelah uji kolom
itu dikembalikan ke `NULL` (belum ditugaskan), bukan ke nilai semula. Hanya berdampak pada
basis data pengembangan lokal.

**Belum diverifikasi:** tampilan panel di browser, karena alasan yang sama seperti fitur 1.

### Tata letak dashboard guru — subtab, dan panel absensi dinonaktifkan

Permintaan pemilik: **tabel data murid harus yang pertama terlihat.** Sebelumnya tiga panel
(jadwal, absensi, nilai) menumpuk di atas tabel dan mendorongnya jauh ke bawah.

- **Jadwal Mengajar** dan **Nilai Asesmen** dipindah ke `Tabs`, ditaruh **di bawah** tabel
  kelas. Isinya tidak berubah, hanya letak dan pembungkusnya.
- **Panel `AbsensiSaya` dinonaktifkan** — komponennya masih ada di
  `src/components/dashboard/shared/AbsensiSaya.jsx` dan tidak dihapus, hanya tidak lagi
  dirender di `GuruDashboard`. Mengaktifkannya kembali cukup dengan mengimpor dan
  memasangnya lagi sebagai subtab ketiga.

**Penting — yang TIDAK ikut dinonaktifkan:** seluruh penjagaan backend dari fitur 1 tetap
berlaku. `Update` dan `MarkAbsent` tetap dijaga `CanManage`, `List` tetap disaring per akun,
dan `AttendanceDetailsModal` tetap memakai `canManageRole`. Itu perbaikan keamanan, bukan
fitur tampilan, jadi mematikannya akan membuka kembali lubang yang memungkinkan santri
mengubah baris absensi mana pun.

Tombol **Absensi** di kartu profil guru (membuka `GuruAttendanceRecap` mode baca) sudah ada
sejak sebelum rangkaian ini dan tetap dibiarkan.

### 3. Materi, tugas, dan pengumuman kelas — **Tuntas**

Tabel baru `kelas_konten` (migrasi `20260815000200_kelas_konten.sql`, **sudah diterapkan**
dan diperiksa dengan `\d kelas_konten`). Subtab ketiga: **Materi & Tugas**.

**Kenapa tidak menumpang `announcements`.** Tabel itu memasok situs publik dan punya
kebijakan baca anonim `announcements_anon_select_published`. Konten kelas yang dititipkan ke
sana akan **bocor ke halaman Berita** begitu statusnya terbit. Audiensnya berbeda, jadi
tabelnya berbeda. `kelas_konten` sengaja **tidak punya kebijakan untuk peran `anon`** sama
sekali.

**Tiga jenis dalam satu tabel:** `materi`, `tugas`, `pengumuman`, dijaga CHECK. Batas
pengumpulan dijaga CHECK terpisah supaya hanya bisa menempel pada `tugas` — aturan yang sama
diuji lebih awal di Go agar pesannya jelas, dan di UI agar fieldnya tidak muncul sama sekali.

**Aturan hak akses.**

| Peran | Baca | Tulis |
|---|---|---|
| admin, tata usaha, superadmin | semua | semua, termasuk memindahkan antar kelas |
| guru | kelas yang diajarnya, **termasuk drafnya** | kelas yang diajarnya |
| murid | **hanya yang terbit, hanya kelasnya** | tidak sama sekali |
| tanpa sesi sah | ditolak 401 | ditolak |

Pengumuman kelas boleh **tanpa mata pelajaran**. Karena itu `guruPegangKelas()` punya dua
tingkat: bila kontennya menyebut mata pelajaran, guru harus mengampu mata pelajaran itu di
kelas tersebut; bila tidak, cukup mengampu apa pun di kelas itu.

**Lampiran adalah TAUTAN, bukan unggahan.** `authorizeFileWrite` di `file.go` mengunci
bucket `documents` pada tingkat `CanManage`, jadi guru tidak dapat mengunggah berkas. Bucket
itu memang dirancang untuk arsip dokumen resmi. Permintaan pemilik berbunyi "lampiran **jika**
storage yang ada mendukungnya" — untuk guru, tidak mendukung. Melonggarkan gate itu berarti
mengubah keamanan berkas di luar lingkup modul ini, jadi tidak dilakukan. Kolomnya
`lampiran_url` + `lampiran_nama`, diisi dengan menempel tautan. **Bila unggahan berkas oleh
guru memang diinginkan, itu keputusan tersendiri** dan perlu perubahan sadar pada
`authorizeFileWrite`.

**Menerbitkan menstempel tanggal.** `status = 'published'` tanpa `tanggal_publikasi` akan
diisi `now()`, baik saat membuat maupun saat menerbitkan draf lama (`COALESCE`, jadi tanggal
terbit pertama tidak tertimpa). Tanpa ini konten terbit tidak akan pernah naik ke urutan
teratas milik murid. Urutan memakai `COALESCE(tanggal_publikasi, created_at)` supaya draf
baru tidak tenggelam di daftar guru.

**Berkas.** `backend/internal/handler/kelaskonten.go` (`/api/kelas-konten`);
`src/lib/kelasKontenAdapters.js`; `src/components/dashboard/shared/ModulKontenKelas.jsx`.

**Bukti uji.** Guru uji dengan satu jadwal di Kelas Demo A; murid sungguhan (Kelas Purnama)
dipakai untuk menguji lingkup baca. Semua dihapus setelahnya:

| Uji | Hasil |
|---|---|
| guru buat materi di kelas yang diajar | 201 |
| guru buat tugas + batas pengumpulan | 201, terbit tersetempel otomatis |
| guru buat pengumuman kelas tanpa mata pelajaran | 201 |
| guru buat konten untuk kelas lain | 403 |
| guru pakai mata pelajaran yang tidak diampu | 403 |
| batas pengumpulan pada `materi` | 400 |
| jenis di luar tiga nilai sah | 400 |
| judul kosong | 400 |
| **murid `LIST`** | **1 baris — hanya terbit, hanya kelasnya; draf di kelasnya sendiri tidak terlihat** |
| guru `LIST` | 3 baris, hanya kelasnya, termasuk drafnya |
| admin `LIST` | 5 baris |
| guru terbitkan drafnya | 200, tanggal tersetempel |
| guru sembunyikan lagi | 200, kembali draf |
| guru ubah konten kelas lain | 403 |
| guru hapus konten kelas lain | 403 |
| status di luar tiga nilai sah | 400 |
| guru pindahkan ke kelas lain | 403 |
| guru hapus kontennya sendiri | 200 |

**Catatan kebersihan data.** Sama seperti fitur 2, jadwal `d212e593` sempat ditugaskan ke
guru uji lalu dikembalikan ke `NULL`.

**Belum diverifikasi:** tampilan di browser, karena alasan yang sama seperti fitur 1 dan 2.

### 4. Komunikasi guru dengan wali murid — **Tuntas**

Subtab keempat: **Komunikasi Wali**. **Tidak ada tabel baru** — kontak wali sudah tersimpan
di `santri.no_hp_ortu`, `nama_ayah`, `nama_ibu`.

**Tidak ada integrasi luar dan tidak ada kredensial.** Yang dibuat hanya tautan `wa.me`
berisi pesan yang sudah terisi, dibuka di peramban guru. **Pesannya belum terkirim** saat
tautan dibuka — guru masih membaca dan menekan kirim sendiri di WhatsApp. Persis seperti
mengetik nomor di aplikasi WhatsApp sendiri, hanya lebih cepat.

**Kenapa endpoint sendiri, bukan `/api/santri`.** Dua alasan:

1. Cakupan guru di `santri.List` bersandar pada `classes.id_guru` — **wali kelas saja**. Guru
   mata pelajaran yang mengajar lewat `jadwal_pelajaran` tidak termasuk, padahal ia juga
   perlu menghubungi wali muridnya. Melebarkan cakupan di sana akan mengubah perilaku Data
   Murid yang tidak berkaitan dengan permintaan ini.
2. Kontak wali adalah data pribadi. `/api/kontak-wali` hanya mengembalikan kolom yang
   benar-benar dipakai untuk menghubungi — bukan seluruh baris murid.

**Cakupan `/api/kontak-wali`.**

| Peran | Hasil |
|---|---|
| admin, tata usaha, superadmin | semua murid aktif |
| guru | murid di kelas yang dipegangnya — sebagai **wali kelas** (`classes.id_guru`) **atau** lewat **jadwal mengajar** (`jadwal_pelajaran.guru_id`) |
| murid | **403** |
| peran lain | 403 |

Murid nonaktif tidak masuk daftar: wali mereka bukan lagi tanggung jawab guru kelas berjalan.

**Normalisasi nomor.** `normalizeNomorWa` mengubah `08xx`, `+62 8xx`, dan `8xx` menjadi
`628xx`, lalu menolak apa pun yang panjangnya di luar 10–15 digit. Nomor yang tidak lolos
membuat tombolnya nonaktif dan murid itu dihitung di peringatan "belum punya nomor wali",
alih-alih membuka tautan yang pasti gagal. **Tidak ada nomor yang ditanam di kode.**

**Lima template** (perkenalan, konfirmasi ketidakhadiran, pengingat tugas, apresiasi,
undangan pertemuan) dengan placeholder `{wali} {murid} {kelas} {guru} {sekolah}`. Disimpan
sebagai teks biasa di adapter, bukan tabel tersendiri — guru selalu dapat menyunting isinya
sebelum mengirim, jadi menyimpannya di basis data hanya menambah beban tanpa menambah
kegunaan. Nama sekolah diambil dari `useSchoolIdentity`, bukan ditulis mati.

**Berkas.** `backend/internal/handler/kontakwali.go` (`/api/kontak-wali`);
`src/lib/kontakWaliAdapters.js`; `src/components/dashboard/shared/ModulKomunikasiWali.jsx`.

**Bukti uji.** Guru uji diberi satu jadwal di Kelas Purnama (kelas yang punya murid aktif),
lalu jadwal dan akunnya dihapus:

| Uji | Hasil |
|---|---|
| guru yang mengajar Kelas Purnama | 2 baris, hanya Kelas Purnama, nomor wali terbaca |
| admin | 11 baris, lima kelas |
| **murid membuka kontak wali** | **403** |
| guru meminta `class_id` kelas lain secara eksplisit | 0 baris |

**Belum diverifikasi:** tampilan di browser dan perilaku tautan `wa.me` sungguhan, karena
alasan yang sama seperti fitur sebelumnya.

### 5. Input dan pengelolaan setoran murojaah — **Tuntas**

Panel "Pusat Muroja'ah Kelas" sudah ada di dashboard guru dan **UI-nya sudah lengkap sejak
dulu** — form pilih murid, kategori, item hafalan, umpan balik, semuanya terpasang. Yang
tidak ada adalah isinya: dua fungsinya hanya menampilkan toast penolakan.

```js
// handleManualMurojaahInsert — sebelum
setIsSubmittingManual(true);
setIsSubmittingManual(false);
toast({ title: "Belum tersedia", ... });

// confirmDeleteSubmission — sebelum
onConfirm: async () => { toast({ title: "Aksi tidak tersedia", ... }); }
```

**Tiga lubang backend yang ditemukan saat mengaktifkannya.**

| Endpoint | Sebelum | Akibat |
|---|---|---|
| `POST /api/academic/murojah` | tanpa pemeriksaan kelas | guru dapat mencatatkan penilaian pada **murid mana pun** cukup dengan mengetahui id-nya |
| `PUT /api/academic/murojah/{id}` | `RequireRole("admin","guru")` saja | guru mana pun dapat menilai — bahkan menimpa — setoran murid kelas lain; tata usaha & superadmin justru tertutup |
| `DELETE` | **tidak ada** | tidak ada jalan menghapus sama sekali |

Semuanya kini melewati `pastikanBolehMurojah`, yang bertanya pada `guruPegangSantri`: guru
berhak bila menjadi **wali kelas** murid itu (`classes.id_guru`) **atau** mengajar di
kelasnya (`jadwal_pelajaran`). Keanggotaan kelas ikut diperiksa supaya roster dan
`current_class_id` yang sempat berbeda tidak membuat guru kehilangan muridnya sendiri.
Penjagaan ditaruh **di dalam handler**, bukan daftar peran di router — daftar peran tidak
dapat memeriksa apakah muridnya memang murid guru tersebut.

**Pencatatan perubahan: tabel `murojaah_audit`** (migrasi `20260815000300_murojaah_audit.sql`,
**sudah diterapkan**). Mencatat `buat`, `ubah`, `hapus` beserta aktor, perannya, dan
perpindahan statusnya.

Dua keputusan rancangan yang penting:

- **Tanpa foreign key ke `murojaah_submissions`.** FK dengan `ON DELETE CASCADE` justru akan
  ikut menghapus bukti penghapusannya. Catatan hapus harus tetap hidup setelah baris aslinya
  lenyap.
- **Menyimpan `data_lama` (jsonb) berisi salinan penuh baris** sebelum dihapus. Itu
  satu-satunya cara memulihkan setoran yang terhapus keliru. Terbukti pada uji: setelah
  penghapusan, isi `Al-Fatihah` masih terbaca di `data_lama->>'content'`.

Kegagalan menulis audit **tidak** membatalkan aksi utama — setoran yang sudah tersimpan tidak
boleh dianggap gagal hanya karena catatannya meleset — tetapi tetap masuk log server.

**Status `perlu_perbaikan` akhirnya bisa dicapai.** Basis data dan backend sudah lama
menerimanya, tetapi layar penilaian menulis mati `status: 'diterima'`, jadi tidak ada jalan
menandai setoran perlu diulang. Sekarang ada dua tombol: **Terima Setoran** dan **Perlu
Perbaikan**. Setoran yang dicatat guru secara tatap muka langsung berstatus `diterima` —
sudah dinilai di tempat, bukan masuk antrean `menunggu` seperti pengajuan murid.

**Bukti uji.** Guru uji dengan jadwal di Kelas Purnama; murid dalam dan luar kelas itu:

| Uji | Hasil |
|---|---|
| guru catat setoran murid kelasnya | 201 |
| guru catat setoran murid **kelas lain** | 403 |
| status di luar empat nilai sah | 400 |
| isi setoran kosong | 400 |
| guru nilai setoran muridnya | 200 |
| guru nilai setoran murid kelas lain | 403 |
| guru hapus setoran murid kelas lain | 403 |
| guru hapus setoran muridnya | 200 |
| hapus id tak dikenal | 404 |
| isi `murojaah_audit` | 4 baris: buat/buat/ubah/hapus, dengan perpindahan status dan salinan penuh pada penghapusan |

**Belum diverifikasi:** tampilan di browser, karena alasan yang sama seperti fitur sebelumnya.

### 6. Normalisasi Rapat Guru — **Tuntas**

Fitur **dipertahankan** sebagai rapat internal sekolah, sesuai keputusan mengikat di bagian
"Keputusan yang mengikat". Yang dirapikan hanya istilah dan penamaan.

**Garis pemisahnya: apa yang boleh berubah, apa yang tidak.**

| Lapisan | Tindakan | Alasan |
|---|---|---|
| Tabel `mmq_schedule`, `mmq_attendance`, `mmq_notulensi` | **TIDAK diganti** | data rapat yang sudah tersimpan harus tetap terbaca |
| Rute `/api/mmq/*` | **TIDAK diganti** | kontrak backend; mengganti berarti memutus klien yang ada |
| Nama constraint `mmq_attendance_status_check` | **TIDAK diganti** | dicocokkan apa adanya oleh penerjemah pesan galat |
| Berkas & pengenal frontend | **Diganti** | inilah yang dibaca dan dirawat orang |
| Tulisan yang dilihat pengguna | **Diganti** | istilah sekolah umum |
| Dokumentasi teknis (`AGENTS.md`) | **Diperbarui** | tabelnya menunjuk berkas yang sudah tidak ada |

**Berkas yang diganti nama** (lewat `git mv`, jadi riwayatnya tetap tersambung):

```
src/lib/mmqAdapters.js                          -> src/lib/rapatGuruAdapters.js
src/hooks/useMMQAttendance.js                   -> src/hooks/useRapatGuruAttendance.js
src/components/dashboard/guru/MmqSection.jsx    -> .../guru/RapatGuruSection.jsx
src/components/dashboard/admin/MMQManagement.jsx     -> .../admin/RapatGuruManagement.jsx
src/components/dashboard/admin/MMQScheduleForm.jsx   -> .../admin/RapatGuruScheduleForm.jsx
src/components/dashboard/admin/MMQAttendanceModal.jsx -> .../admin/RapatGuruAttendanceModal.jsx
```

Seluruh pengenal `MMQ`/`Mmq` di dalamnya ikut berubah, **kecuali** string `/api/mmq` dan
`mmq_` yang sengaja dilindungi selama penggantian lalu dikembalikan utuh.

**Tulisan yang diperbaiki.** Penggantian mekanis sempat menghasilkan "RapatGuru" tanpa spasi
di kalimat — semuanya dirapikan jadi "Rapat Guru":

- `GuruManagement.jsx` — "Jadikan sebagai Notulen MMQ" → "Jadikan sebagai Notulen Rapat Guru"
- `RapatGuruAttendanceModal.jsx` — "Edit Absensi MMQ" → "Edit Absensi Rapat Guru"
- `rapatGuruAdapters.js` — lima pesan galat, dari "fitur MMQ" jadi "fitur Rapat Guru"
- `guruAttendance.js` + berkas ujinya — komentar "MMQ-only branch" jadi "meeting-only branch"

Judul dialog guru (`Rapat Guru`), tab `Absensi`/`Notulensi`/`Riwayat`, dan kunci rute
`rapat-guru` **sudah benar sejak sebelumnya** dan tidak disentuh.

**Bukti uji.** Setelah penggantian, ketiga endpoint diminta ulang dengan akun admin dan data
lamanya masih terbaca:

| Endpoint | Hasil |
|---|---|
| `GET /api/mmq/schedules` | 200, 1 baris |
| `GET /api/mmq/attendance` | 200, 1 baris |
| `GET /api/mmq/notulensi` | 200, 1 baris |

`npm run lint` dan `npm run build` bersih.

### Guru mata pelajaran kini melihat murid kelas yang diajarnya

Ditemukan saat verifikasi browser: guru uji yang punya jadwal mengajar melihat **tabel murid
kosong**. Penyebabnya, roster bersandar pada `classes.id_guru` — **wali kelas** — sedangkan
subtab Nilai dan Materi bersandar pada `jadwal_pelajaran`. Guru mata pelajaran berhak memberi
nilai untuk sebuah kelas tetapi tidak dapat melihat muridnya.

**Yang dilebarkan — hanya jalur BACA:**

| Tempat | Sebelum | Sesudah |
|---|---|---|
| `classes.List` saat guru menanyakan kelasnya sendiri | `cl.id_guru = $1` | wali kelas **atau** `jadwal_pelajaran` |
| `santri.List` cakupan guru | wali kelas | wali kelas **atau** jadwal |
| `santri.Detail` | `guruOwnsSantri` | `guruTeachesSantri` (baru) |

**Yang sengaja TIDAK dilebarkan — jalur TULIS:** `MoveClass` dan `TransferDestinations` tetap
memakai `guruOwnsSantri` (wali kelas saja). Penempatan murid tetap wewenang wali kelas dan
admin; menyatukan keduanya akan membuat setiap guru mata pelajaran dapat memindahkan murid
antar kelas hanya karena mengajar satu jam di sana. Karena itu helper barunya **terpisah**,
bukan `guruOwnsSantri` yang diubah — tiga pemanggilnya tidak boleh berubah bersamaan.

**Panel admin tidak ikut berubah.** Pelebaran di `classes.List` hanya berlaku ketika
`id_guru` yang diminta sama dengan akun pemanggil dan perannya guru. Admin yang menyaring
`id_guru=X` tetap memperoleh arti lama — kelas yang **diwalikan** X — supaya kolom wali kelas
di panel admin tidak tercampur kelas yang sekadar diajar X.

**Bukti uji.** Guru uji diberi jadwal di Kelas Purnama **tanpa** dijadikan wali kelasnya
(wali tetap Siti Aminah):

| Uji | Hasil |
|---|---|
| daftar kelas miliknya | 1 baris — Kelas Purnama muncul |
| daftar murid | 2 baris — murid Kelas Purnama terlihat |
| buka detail murid kelas yang diajar | 200 |
| buka detail murid kelas lain | 403 |
| **tujuan transfer murid** | **403** — bukan wali kelas |
| **pindahkan murid ke kelas lain** | **403** |
| admin saring `id_guru` = guru mapel | 0 baris — arti lama terjaga |
| admin saring `id_guru` = Siti Aminah | 1 baris — Kelas Purnama |

#### Dua temuan saat menguji guru mapel di browser

**1. Kebocoran roster antar kelas (sudah lama ada, sudah ditutup).**
`GET /api/classes?include_santri=true` **tanpa penyaring apa pun** mengembalikan SELURUH
kelas beserta rosternya kepada guru mana pun — nama setiap murid di sekolah terbaca hanya
dengan menghapus parameter `id_guru`. Terlihat saat memeriksa data Rina: ia menerima kelima
kelas padahal hanya mengajar satu.

Ini berselisih dengan `santri.List`, yang sudah lama membatasi guru ke kelasnya sendiri. Dua
pintu ke data yang sama tidak boleh berbeda aturannya. `classes.List` kini menyaring peran
`guru` ke kelas yang benar-benar dipegangnya. **Pentashih sengaja tidak dibatasi** — perannya
memang meninjau murid lintas kelas, sejalan dengan `santri_pentashih_select`.

Terbukti: permintaan yang sama kini mengembalikan 1 kelas untuk Rina, sementara admin tetap
menerima kelima kelas.

**2. Tombol Transfer menawarkan aksi yang pasti gagal.**
Karena guru mapel kini melihat kelas yang diajarnya, tombol "Transfer kelas" ikut muncul
untuk murid yang bukan perwaliannya. Menekannya memanggil `transfer-destinations`, dijawab
**403** dengan benar — tetapi modalnya menampilkan *"Daftar kelas belum dapat dimuat.
Periksa koneksi Anda"*, menyalahkan jaringan padahal ini soal hak akses.

Tombolnya kini **dimatikan** bila guru bukan wali kelas, dengan tooltip "Hanya wali kelas
yang dapat memindahkan murid". Penjagaan backend tidak diubah — yang diperbaiki hanya
menawarkan aksi yang mustahil lalu berbohong soal sebabnya.

#### Rekap Absensi & Rapat Guru — hasil pemeriksaan

**Rekap Kinerja membocorkan daftar guru (PELANGGARAN, sudah diperbaiki).**
Tab "Rekap Kinerja" punya dropdown **PILIH GURU PENGAJAR** berisi **seluruh 12 guru**. Seorang
guru dapat memilih rekannya — bertentangan langsung dengan aturan pemilik: *"Guru hanya dapat
melihat kinerjanya sendiri dan tidak boleh memilih atau membuka data guru lain."* Ini lolos
dari audit fitur 1 karena `GuruPerformanceSummary` sama sekali tidak mengenal peran.

Datanya sendiri sebenarnya sudah tertutup — penyaring pada `attendance.List`, `classes.List`,
dan `santri.List` mengembalikan kosong untuk guru lain. Tetapi membiarkan dropdownnya terisi
tetap salah dua kali: **membocorkan daftar nama seluruh guru**, dan hasil kosongnya terbaca
seperti *"guru ini tidak pernah hadir"* padahal artinya *"Anda tidak berhak melihat"*.

Kini bagi peran `guru` dropdownnya **dihapus sama sekali** — bukan diisi satu nama, supaya
tidak terkesan pembatasan sementara — diganti label "Kinerja Mengajar Anda" dan namanya
sebagai teks biasa. Terverifikasi di browser: hanya Bulan dan Tahun yang tersisa sebagai
pilihan.

**Rapat Guru — sehat.** Judul "Rapat Guru", keterangan "Sistem absensi dan notulensi untuk
guru", jadwal lama termuat (`Jumat 16:00–17:00, Ruang Demo`), dan riwayat notulensi lama
(`Notulensi Demo, 5/8/2026 oleh Guru Demo A`) tetap terbaca — bukti penggantian nama fitur 6
tidak memutus data lama. Tab **Notulensi nonaktif** untuk Rina karena ia bukan notulen; itu
perilaku yang benar.

**Rekap Absensi kini membaca jadwal pelajaran — SUDAH dirombak.**
Sebelumnya `GuruAttendanceRecap` menurunkan sesi wajib seorang guru dari
`classes.filter(c => c.id_guru === guru.id)` — **kelas yang diwalikannya**, memakai model sesi
lama. Guru mata pelajaran tidak mewalikan kelas mana pun, jadi `assignedSessions` kosong dan
seluruh rekapnya hilang dengan pesan "Tidak ada data guru atau jadwal mengajar ditemukan".
Bukan akibat penyempitan cakupan kelas — bahkan saat kelima kelas terlihat, tidak satu pun
ber-`id_guru` miliknya.

Akarnya ketidaksesuaian model: sejak `2a362b6` absensi guru dicatat lewat **jadwal
pelajaran**, sementara rekapnya masih mengukur **sesi kelas perwalian**.

**Cara kerja sekarang.** Rekap memuat `jadwal_pelajaran` periode aktif dan membangun peta
`sesiJadwalPerHari`: `{ guruId: { 1: Set('Pagi'), 3: Set('Siang') } }`, kunci hari 1..6
(Senin..Sabtu) yang kebetulan sama dengan `Date.getDay()` untuk Senin–Sabtu.

Perbedaan penting dari model lama: kewajiban **dijumlahkan per hari**, bukan
`hari_aktif × jumlah_sesi`. Guru hanya ditagih pada hari yang benar-benar ada jam mengajarnya.

**Tiga jalur, berurutan prioritas:**

1. Ada override manual (`guru_session_overrides`) → pakai itu, tak berubah.
2. Punya jadwal pelajaran → model jadwal (baru).
3. Tidak keduanya → model sesi kelas perwalian (lama), tetap utuh untuk sekolah yang masih
   memakainya.

**Label sesi mengikuti kelas, bukan jam pelajaran — dan itu disengaja.**
`getTeacherLessonSession` mendahulukan `schedule.sesi` (diwarisi dari kelas) sebelum menebak
dari `jam_mulai`. Pada data demo, Kelas Purnama bersesi "Sore" padahal jam pelajarannya 07:00,
jadi rekapnya menulis "Sore". Terlihat janggal, tetapi **fungsi yang sama dipakai kios saat
mencatat absensi** — kalau rekap memakai aturan berbeda, kewajiban dan catatannya tidak akan
pernah bertemu. Kejanggalannya ada di data demo, bukan di kode. Mengubahnya berarti mengubah
cara absensi pusat dicatat, yang dilarang.

**Batas ketelitian yang diketahui.** Nilai petanya `Set`, jadi dua jam pelajaran pada sesi dan
hari yang sama terhitung **satu** kewajiban. Grid rekap memang berkolom sesi
(Pagi/Siang/Sore), bukan per jam pelajaran; menghitung per jam berarti merombak tampilannya
juga. Akibat wajarnya: guru yang mengajar dua jam Pagi lalu hadir di salah satunya tetap
terbaca 100% untuk hari itu. Dicatat di komentar kode agar tidak terbaca sebagai bug.

**Bukti uji ujung-ke-ujung** dengan akun Rina (jadwal Senin 07.00, Kelas Purnama):

| Keadaan | Rekap |
|---|---|
| belum ada absensi | `0 / 2` · 0% |
| setelah satu kehadiran dicatat Senin 10 Agu | `1 / 2` · 50% · "Sore 1 Sesi" |

Pembagi `2` benar: Senin aktif hingga 15 Agustus 2026 hanya tanggal 3 dan 10. Baris absensi
ujinya sudah dihapus setelah verifikasi.

### Shift masuk sekolah: dari sesi madrasah ke dua shift SD — **Tuntas**

Pemilik bertanya apakah konsep "tiap kelas punya jadwal sendiri, ada yang masuk pagi dan ada
yang masuk siang" sudah diterapkan. Pemeriksaan menunjukkan **rangkanya sudah benar**, yang
keliru hanya kosakata dan jamnya:

| Konsep | Sebelum |
|---|---|
| Tiap kelas punya jadwal mingguan sendiri | **sudah ada** — `jadwal_pelajaran` |
| Absensi guru mengikuti jam pelajaran | **sudah** — lihat bagian rekap di atas |
| Kelas ditempatkan di shift | **ada, tapi lima pilihan ala madrasah** |
| Absensi murid pakai jendela shift kelasnya | **sudah jalan** — tapi jamnya jam mengaji |

`DEFAULT_SESSION_TIMES` memuat Pagi 07.45, **Pagi 2** 10.00, Siang 13.45, **Sore** 15.45, dan
**Malam** 18.30. Itu jadwal TPQ. Sekolah dasar negeri masuk pagi; sekolah yang kekurangan ruang
kelas membagi rombelnya jadi shift pagi dan siang, dan berhenti di situ.

**Yang diubah.** Kosakata dipangkas jadi **Pagi (07.00)** dan **Siang (12.30)** — tetap dapat
disunting pembeli lewat "Konfigurasi Waktu Sesi", angka itu hanya bawaan. Ikut dirapikan:
`SESSION_MAP` (nilai angka 0..4 jadi 0..1), `inferSessionFromStartTime` di `guruAttendance.js`
(sebelum 12.00 → Pagi, selebihnya Siang), penebakan sesi di Mode TV, `timeMap` sesi berikutnya
di halaman absensi, serta urutan dan warna shift di modal transfer murid.

**Nama shift lama tetap terbaca.** `LEGACY_SESSION_ALIASES` memetakan `Pagi 2 → Pagi`,
`Sore → Siang`, `Malam → Siang` saat dibaca, supaya baris lama tidak jatuh ke null dan merusak
rekap.

**Migrasi `20260815000400_shift_pagi_siang.sql`** (sudah diterapkan) menempatkan ulang kelas
berdasarkan **jadwalnya sendiri**, bukan menebak dari nama lamanya: jam pelajaran paling awal
sebelum 12.00 → Pagi, selebihnya Siang, dan kelas tanpa jadwal → Pagi. Kedelapan kelas demo
yang semula berlabel "Sore" kini Pagi, cocok dengan jam pelajarannya yang memang 07.00–08.40.

**Baris `attendance` sengaja TIDAK diubah.** Absensi adalah catatan peristiwa yang sudah
terjadi; menulis ulang label sesinya berarti memalsukan arsip — rekap bulan lalu berubah
angkanya tanpa ada yang benar-benar hadir atau absen. Empat baris bersesi "Sore" dibiarkan dan
dibaca lewat alias.

**Jebakan yang sempat terjadi saat menulis migrasinya.** Versi pertama memakai
`COALESCE((SELECT CASE WHEN min(jam_mulai) < '12:00' ...), 'Pagi')`. Agregat selalu
mengembalikan satu baris, dan `NULL < TIME` bukan TRUE, jadi kelas **tanpa jadwal** jatuh ke
`ELSE` dan salah ditandai "Siang" — `COALESCE` tidak pernah kena. Diperbaiki dengan cabang
`WHEN min(...) IS NULL THEN NULL` eksplisit. Lima kelas yang terlanjur salah sudah dibetulkan.

**Terverifikasi di browser:** rekap Rina yang tadinya menulis "Sore" untuk pelajaran pukul
07.00 kini menulis **"Pagi"**.

### Nama kelas jadi pola SD — **Tuntas**

Nama kelas demo (Purnama, Cendekia, Harmoni, Pelita, Tunas) lebih mirip nama kelompok
mengaji daripada rombel sekolah dasar. Diganti ke pola **angka tingkat + huruf rombel**, yang
lazim di SD negeri dan langsung siap bila sekolah punya kelas paralel (1A dan 1B).

| Sebelum | Sesudah |
|---|---|
| Kelas Cendekia | **Kelas 1A** |
| Kelas Harmoni | **Kelas 2A** |
| Kelas Pelita | **Kelas 3A** |
| Kelas Purnama | **Kelas 4A** |
| Kelas Tunas | **Kelas 5A** |
| — | **Kelas 6A** (baru, kosong) |

Tingkat enam ditambahkan supaya demo punya enam tingkat lengkap seperti SD sungguhan.

**Tiga kelas demo nonaktif dihapus:** `Kelas Demo A`, `Kelas Demo B`, dan
`Kelas Tahfizh PTPT Demo`.

**Dua penemuan saat menghapusnya.** `classes` dirujuk sembilan tabel, dan tiga di antaranya
memakai `NO ACTION`, bukan `CASCADE`:

- `santri.current_class_id` — delapan murid demo nonaktif harus dilepas dulu
  (`current_class_id = NULL`), tidak dihapus
- `attendance.class_id` — dua baris absensi seed ikut dibuang
- `class_mutations.from_class_id` / `to_class_id` — **ini yang menggagalkan percobaan
  pertama**; ada satu baris riwayat mutasi murid demo antar kelas demo. Transaksi
  ter-*rollback* utuh, tidak ada kerusakan separuh jalan. Baris itu ikut dihapus karena kelas
  yang dirujuknya memang dibuang.

**Yang benar-benar dikirim ke pembeli adalah `supabase/seed.sql`, bukan data lokal ini.**
Kelima kelas berjuluk indah itu ternyata **tidak ada di repositori** — data sisa sesi
pengembangan terdahulu. Yang di-*seed* justru tiga kelas demo tadi, dan itulah yang dilihat
pembeli pada instalasi baru. `seed.sql` sudah dirapikan: nama kelas jadi Kelas 1A/2A/3A, shift
`'Sore'` jadi `'Pagi'`, dan tiga murid berkategori `PTPT` beserta `jilid` "Juz 30/29/28" jadi
murid biasa berkategori `Anak` — kolom jilid dan sesi mengaji hanya relevan bila program
tahfizh opsional dinyalakan.

### Sisa warisan LPQ di data contoh — **Tuntas**

**Ada DUA sumber data contoh**, keduanya dijalankan `backend/init/01_migrate.sh`:
`supabase/seed.sql` (murid, kelas, catatan) dan `backend/init/03_dummy_accounts.sql` (akun
login tiap peran). Kelima kelas berjuluk indah yang sempat terlihat di basis data lokal
**tidak ada di keduanya** — murni sisa sesi pengembangan terdahulu.

**Yang dirapikan di `seed.sql`:**

| Sebelum | Sesudah |
|---|---|
| `site_name` = "LPQ Al-Fath Maulana" | **baris dihapus** |
| `nomor_induk_qiroati` = `AFMLOCAL-ANAK-A01` | `nisn` + `nis` sungguhan (`9100000101` / `26101`) |
| alias login `@auth.lpqalfathmaulana.local` | `@auth.sekolah.local` |
| jabatan "Pengajar Demo" | "Guru Kelas" |
| "Pentashih Demo" | "Wakasek Demo" · jabatan "Wakil Kepala Sekolah" |
| hafalan "Doa Demo"/"Surat Demo", jilid "Pra" | "Doa Harian"/"Surat Pendek", "Tingkat 1" |
| metode bayar "Demo Manual" | "Tunai" |
| pengeluaran kategori "Demo" | "Operasional" |
| rapat 16.00–17.00 "Ruang Demo" | 13.00–14.30 "Ruang Guru" |

`site_name` **dihapus, bukan diganti isinya**: tidak ada satu pun kode yang membacanya. Nama
sekolah datang dari kunci `school_identity` (`src/lib/schoolIdentity.js`), yang bawaannya sudah
"Sekolah Dasar Negeri Baturaja". Baris lamanya hanya menitipkan nama lembaga produk terdahulu
ke basis data setiap pemasangan baru.

Nilai peran `'Pentashih'` di kolom `roles` **tetap dipertahankan** — hanya nama tampilan dan
jabatannya yang berubah, sesuai keputusan mengikat.

`backend/init/01_migrate.sh` ikut disesuaikan: stub `auth.users` untuk id `...004` memakai
`wakasek-demo@example.invalid`.

**Jebakan yang sempat terjadi.** Seed dijalankan langsung ke basis data kerja untuk mengujinya,
padahal basis data itu sudah berisi kelas hasil penggantian nama. Karena kelas seed memakai id
tetap (blok `b2fa7a20`), hasilnya **kelas ganda** — dua "Kelas 1A", dua "2A", dua "3A".
Duplikatnya sudah dibuang. Cara menguji seed yang benar adalah pada basis data kosong, dan
itulah yang akhirnya dipakai.

**Cara verifikasinya.** Basis data `seedtest` dibuat kosong, 66 migrasi dipasang berurutan,
stub `auth.users` disisipkan, lalu `seed.sql` dijalankan — **tanpa satu pun galat**. Hasil
pemasangan baru: tiga kelas `Kelas 1A/2A/3A` shift Pagi, delapan murid ber-NISN/NIS tanpa
jilid, `website_content` hanya berisi kunci `profile`, dan staf berjabatan "Guru Kelas" dan
"Wakil Kepala Sekolah". Basis data uji dihapus setelahnya.

**Perbaikan ketahanan.** Sisipan `auth_login_aliases` semula memakai
`on conflict (alias_type, normalized_alias)`. Ada pula batasan unik satu alias aktif per
pengguna, sehingga menjalankan ulang seed setelah nilai aliasnya berubah menabrak batasan yang
tidak disebut targetnya. Diganti `on conflict do nothing` tanpa target.

### Nama skema warisan madrasah dibuang — **Tuntas**

Migrasi `20260815000500_rename_legacy_qiroati_and_mmq.sql` (**sudah diterapkan**):

```
santri.nomor_induk_qiroati  ->  santri.nomor_induk
mmq_schedule                ->  rapat_guru_jadwal
mmq_attendance              ->  rapat_guru_absensi
mmq_notulensi               ->  rapat_guru_notulensi
```

`ALTER TABLE ... RENAME` mempertahankan seluruh data, indeks, batasan, dan foreign key —
tidak ada baris yang disalin atau hilang. Migrasi ini **wajib paling akhir**: migrasi
terdahulu menyebut nama lamanya dan tidak boleh disunting, jadi pada basis data baru semuanya
berjalan lebih dulu lalu berkas ini mengganti namanya di penghujung.

**Rute `/api/mmq/*` sengaja TIDAK diganti.** Itu kontrak antara frontend dan backend, bukan
nama skema; menggantinya perkara terpisah.

#### Dua bug lama yang ikut terbongkar

**1. Field NUPTK di panel Data Guru tidak pernah tersimpan.** Formulir menulis ke
`nomor_induk_qiroati` pada tabel `guru` — kolom yang **tidak pernah ada** di sana; hanya
`santri` yang memilikinya. Nilainya disaring habis oleh allowlist `guruEditable`, jadi apa pun
yang diketik admin hilang tanpa pesan dan kolomnya selamanya tampil "-".

Diperbaiki menyeluruh: kolom `guru.nuptk` dibuat, ditambahkan ke `guruEditable` dan
`guruSafeColumns`, diteruskan `pickGuruProfileFields` (yang juga tidak meneruskannya), dan
formulirnya menunjuk `nuptk`. Terbukti lewat API: simpan `1987031420091001` lalu baca ulang —
nilainya kembali utuh.

**2. Penerjemah pesan galat rapat guru tidak pernah aktif.** `rapatGuruAdapters.js` mencocokkan
nama batasan `mmq_attendance_status_check`. Batasan itu sebenarnya bernama
`mmq_attendance_status_not_blank` — nama yang dicocokkan tidak pernah ada, jadi cabangnya mati.
Ketahuan justru karena migrasi rename-nya gagal pada nama yang salah. Kini keduanya memakai
`rapat_guru_absensi_status_not_blank`.

#### Yang sengaja tidak disentuh

`scripts/*` masih menyebut nama lama — **itu benar**. Semuanya perkakas era Supabase yang
membaca skema produk terdahulu: `prepare-production-migration.mjs` memuat
`backup-lpq-full-2026-07-21.json`, dan `validate-production-migration-local.ps1` menolak target
selain Supabase lokal di port 55321. Nama lama di sana **mendeskripsikan basis data lama**;
menggantinya justru merusak maksudnya. Begitu pula `supabase/functions/*` (dormant),
`supabase/schema-production-backup.sql` (cuplikan), dan migrasi terdahulu.

`scripts/validate-migration-order.ps1` juga dibiarkan: ia memeriksa **nama berkas migrasi**,
bukan nama tabel hidup, dan penjaganya tetap sahih karena migrasi rename berada setelah
`20260624001000_mmq_core.sql`.

#### Bukti uji

Rantai pemasangan penuh dijalankan di basis data kosong `renametest`:
`00_bootstrap` → **67 migrasi** → stub `auth.users` → `seed.sql` → `02_auth_columns` →
`03_dummy_accounts`. **Semua lolos**, ketiga tabel `rapat_guru_*` ada, `santri.nomor_induk`
dan `guru.nuptk` ada. Basis data uji dihapus setelahnya.

Pada basis data kerja, setelah migrasi diterapkan dan backend dikompilasi ulang:

| Uji | Hasil |
|---|---|
| `GET /api/guru`, `/santri`, `/classes`, `/payments`, `/ppdb` | 200 semua |
| `GET /api/mmq/schedules`, `/attendance`, `/notulensi` | 200, data lama terbaca |
| **login murid lewat nomor induk** | **OK** — jalur `auth.go` yang kolomnya berganti nama |
| simpan lalu baca NUPTK | tersimpan dan terbaca |

**Catatan galat uji, bukan cacat migrasi.** Percobaan pertama gagal karena `02_auth_columns.sql`
terlewat dari urutan uji — urutan sebenarnya `00 → 01 (migrasi + seed) → 02 → 03`.

#### Verifikasi panel Data Guru di browser

Diuji sebagai admin di `localhost:3000`, dan inilah bukti bug NUPTK benar-benar tertutup:

| Langkah | Hasil |
|---|---|
| Buka Edit "Andi Pratama, S.Pd." | field `#nuptk` ada, kosong |
| Isi `1987031420091001`, Simpan Perubahan | tersimpan; basis data memuatnya |
| **Muat ulang halaman penuh, buka Data Guru** | kolom NO. INDUK menampilkan `1987031420091001` |
| Cari `19870314` di kotak pencarian | 1 hasil, Andi Pratama |
| Buka panel Rapat Guru | data lama terbaca, tanpa galat setelah tabelnya berganti nama |

Langkah ketiga yang menentukan: sebelum perbaikan, nilai itu hilang tanpa jejak setelah
refresh meski notifikasi mengatakan berhasil.

#### Dua sisa LPQ yang baru ketahuan saat verifikasi ini

**Subjudul panel Rapat Guru masih "Majelis Mu'allimil Qur'an — Absensi & Jadwal Guru".**
Lolos dari normalisasi fitur 6 karena pencarian waktu itu memakai kata "MMQ", bukan
kepanjangannya. Diganti "Jadwal, absensi, dan notulensi rapat internal guru".

**Satu baris `guru.status_guru` masih bernilai `'Non-Syahadah'`.** Itu sertifikasi guru
Al-Qur'an, tidak berlaku di SD negeri. Kodenya sudah lama memakai "Belum Bersertifikat"; yang
tertinggal hanya datanya. Diperbaiki menjadi "Belum Bersertifikat" — hanya data lokal, tidak
ada perubahan kode.

### Panel Bisyaroh & kategori Qiroati — sebagian besar sudah bersih

**Bisyaroh: tidak ada yang perlu dikerjakan.** `SalaryCalculation.jsx` sudah dihapus.
Penyebutan yang tersisa hanyalah komentar penjelas di `AdminDashboard.jsx`,
`DashboardWorkspace.jsx`, `TataUsahaDashboard.jsx`, dan satu baris di
`admin/AGENTS.md` — dan baris itu berada di bawah judul **"Panel yang sudah dicabut — jangan
dikembalikan"**. Itu nisan yang sengaja dipasang beserta alasannya, bukan daftar panel hidup.
Menghapusnya justru menghilangkan peringatan agar panel tanpa penyimpanan itu tidak dibangkitkan
lagi.

**Kategori Qiroati: yang tersisa hanya data, bukan kode.** Tiga baris `santri.kategori = 'PTPT'`
— fixture demo nonaktif tanpa kelas, sisa versi seed sebelum dirapikan. Diselaraskan dengan
`seed.sql` yang baru: nama jadi `Santri Demo C1/C2/C3`, kategori `Anak`, `jilid` dan
`sesi_mengaji` dikosongkan karena keduanya hanya terpakai bila program tahfizh dinyalakan.
Seluruh 20 murid kini berkategori `Anak`. Komentar di `SantriManagement.jsx` yang menyebut
"subCategory era Qiroati" ditulis ulang tanpa jargon itu.

**Yang SENGAJA tidak diubah:** `HAFALAN_SCOPE_PER_KELAS = 'TPQ'` dan
`HAFALAN_SCOPE_PER_JUZ = 'PTPT'` di `academicAdapters.js`. Keduanya **nilai tersimpan** di
kolom `hafalan_items.program_scope`, sekelas dengan `'Pentashih'` — mengubahnya memutus data
hafalan lama. Sudah ada komentar yang menjelaskannya di berkas itu.

### Kategori `'Dewasa'` dicabut — **Tuntas**

Sesuai keputusan mengikat *"Kategori murid & kelas: dihapus seluruhnya. Tidak ada kelas
dewasa"*. Tidak ada satu pun baris data berkategori `Dewasa`, jadi seluruhnya kode mati.

| Berkas | Yang dicabut |
|---|---|
| `DigitalAttendancePage.jsx` | `isAdult`, larik `adultQuotes`, blok `adultStats`, dan **satu cabang tampilan hasil scan penuh** untuk murid dewasa |
| `DashboardPage.jsx` | prop `isAdult` ke `SantriDashboard` |
| `SantriDashboard.jsx` | prop `isAdult` beserta varian gaya ungunya di `MurojaahRecorder` |
| `JilidChangeModal.jsx` | imbuhan judul `(Dewasa)` |
| `PaymentSystem.jsx` | badge kategori murid |
| `paymentAdapters.js` | fungsi `formatSantriCategory` |
| `appConfigAdapters.js` | kunci `ADULT_SESSION` yang tidak dipakai siapa pun |

**Cabang tampilan hasil scan yang dicabut ternyata identik** dengan cabang murid biasa, kecuali
tidak menampilkan kartu level. Jadi mencabutnya justru **menambah** yang dilihat murid, bukan
mengurangi.

**Temuan sampingan: layar pembayaran menampilkan "TPQ" kepada pembeli.**
`formatSantriCategory` memetakan kategori `'Anak'` menjadi label **"TPQ"**, dan `PaymentSystem`
menampilkannya sebagai badge di bawah nama tiap murid. Jadi panel pembayaran sebuah SD negeri
memasang istilah lembaga Al-Qur'an di layar. Badge dan fungsinya sama-sama dicabut — pada
sekolah dengan satu jenis murid, badge kategori memang tidak menerangkan apa pun.

`kategori` di `JilidChangeModal` **tetap dipertahankan**: di sana ia variabel template pesan
WhatsApp, bukan cabang tampilan.

**Bukti uji.** `npm run lint` dan `npm run build` bersih. Jalur absensi diperiksa ulang lewat
API: lookup RFID murid mengembalikan `Aisyah Putri (kategori=Anak)`, dan pembacaan absensi
murid tetap 200.

#### Verifikasi tampilan hasil scan di browser

Diuji di `/absensi-digital` dengan RFID sungguhan. Ahmad Fauzan sudah absen hari ini, jadi
memindainya menampilkan kartu "sudah tercatat" **tanpa menulis baris baru** — seluruh jalur
render terlewati tanpa mengubah data.

Kartunya tampil lengkap: nama, sesi, status "Tepat Waktu", jam check-in, **JILID, POIN, LEVEL
Bronze, HAFALAN**, rekap bulan ini, pesan, dan kutipan. **Kemunculan kartu LEVEL itu buktinya**:
justru bagian inilah yang dulu ditahan cabang "dewasa". Kartu peringatan juga diperiksa lewat
Aisyah Putri — di luar jam shift, muncul "Tidak ada sesi absensi yang sedang dibuka saat ini."

**Catatan cara uji:** penekanan Enter sintetis tidak memicu submit implisit form, jadi
handlernya dipanggil lewat `form.requestSubmit()` di konsol. Jalur kodenya sama persis dengan
kartu RFID sungguhan; yang berbeda hanya pemicunya.

### Celah migrasi shift yang baru ketahuan — **sudah ditutup**

Verifikasi di atas memunculkan kejanggalan: kartu Ahmad Fauzan tertulis **"Sesi Siang"**
padahal Kelas 4A bershift Pagi.

Penyebabnya migrasi shift terdahulu (`20260815000400`) hanya menata `classes.sesi` dan
**melewatkan `santri.sesi_mengaji`**. Sepuluh murid masih bernilai `'Sore'`.

Itu bukan sekadar label yang jelek. `getSantriSession` mendahulukan `sesi_mengaji` sebelum
jatuh ke shift kelas, dan `'Sore'` kini dipetakan ke `'Siang'` oleh alias — sehingga jendela
absensi mereka menjadi **11.30–17.00**. Murid kelas pagi yang datang pukul 07.00 akan **ditolak
karena dianggap di luar jam absensi**.

Migrasi `20260815000600_santri_sesi_ikut_kelas.sql` (**sudah diterapkan**) mengosongkan nilai
yang bukan shift sah, bukan menebaknya. Dengan `NULL`, `getSantriSession` jatuh ke `class.sesi`
— dan shift kelas memang satu-satunya sumber yang benar. Menyimpan shift terpisah di baris
murid justru yang mengundang selisih ini sejak awal.

Terbukti di browser: kartu yang sama kini menulis **"Sesi Pagi"**, dan tidak ada lagi murid
yang shift-nya berbeda dari kelasnya.

### Verifikasi browser rangkaian dashboard guru — **Selesai**

Seluruh fitur 1–6 diperiksa langsung di `localhost:3000` dengan akun guru sungguhan, bukan
hanya lewat API. Tabel murid tampil paling atas; empat subtab hadir di bawahnya; panel
`AbsensiSaya` benar-benar sudah tidak dirender.

Yang terbukti tersimpan dan bertahan setelah muat ulang halaman: **nilai asesmen** (beserta
ringkasan rata-rata/min/maks), **konten kelas** (buat lalu terbitkan, status berubah
Draf → Terbit), dan **setoran murojaah manual** (tersimpan `diterima` plus satu baris di
`murojaah_audit`). Template WhatsApp terisi lengkap — nama wali, nama guru, nama sekolah dari
identitas, nama murid, dan kelas. Mode gelap dan terang keduanya benar.

**Tidak diuji:** tombol "Buka WhatsApp", karena membuka layanan luar.

**Berkas coret-coretan dihapus.** Empat artefak penelusuran era Supabase menumpuk di `src/`
dan sudah dibuang: `inspect_mmq_constraint.sql`, `fix_mmq_rls_policies.sql`,
`inspect_database.sql`, dan `rls_audit_report.md`. Semuanya berisi kueri diagnostik untuk
"Supabase SQL Editor" — perkakas yang tidak lagi dipakai aplikasi ini — tidak diimpor kode
mana pun, dan tidak ikut build. Sebutan atasnya masih tertinggal di
`docs/13-phase-1-5-baseline-result.md` dan `docs/migration/authz-spec.md` sebagai catatan
sejarah; keduanya memang dokumen arsip, jadi dibiarkan.

Bila daya tampung nol, panel menampilkan ajakan mengisi kapasitas alih-alih tabel
berisi nol — dan tidak ada pembagian dengan nol.

### Wilayah domisili: teks bebas dari daftar pembeli, dengan ejaan dikanonkan server

Keputusan pemilik: **pembeli mengisi daftar wilayahnya sendiri.** Disimpan sebagai
`ppdb_content.wilayah` (array teks), dan pada pendaftaran sebagai kolom `wilayah`
berisi teks apa adanya — bukan kunci asing ke tabel wilayah.

Kenapa bukan tabel referensi: daftar wilayah penerimaan ditetapkan pemerintah
DAERAH, berbeda tiap kabupaten, dan berubah tiap tahun. Tabel dengan kunci asing
memaksa pembeli mengelola data master untuk sesuatu yang mereka ubah sekali setahun,
dan akan menolak pendaftaran lama ketika wilayahnya dihapus dari daftar.

Empat hal yang menjaganya:

- **Daftar kosong mematikan fiturnya dengan tenang.** Kolom pilihan hilang dari
  formulir, penyaring hilang dari panel, dan server berhenti mewajibkannya. Sekolah
  yang tidak memakainya tidak dipaksa.
- **`normalizePpdbContent` TIDAK memakai `normalizeDaftar` untuk wilayah.** Fungsi
  itu memulihkan bawaan ketika daftarnya kosong, sedangkan kosong di sini punya arti
  tersendiri. Membedakan `[]` (sengaja dikosongkan) dari `undefined` (belum pernah
  disimpan) itu inti perilakunya — ada uji untuk keduanya.
- **Server membaca daftarnya dari basis data, bukan dari browser.** `POST /api/ppdb`
  terbuka untuk umum; tanpa `daftarWilayah()`, siapa pun bisa menyisipkan wilayah
  karangan dan tata usaha akan menyeleksi jalur Domisili berdasarkan data yang tidak
  pernah ditawarkan sekolahnya.
- **Ejaan yang disimpan diambil dari daftar sekolah**, bukan dari yang dikirim.
  Pencocokannya `EqualFold`, jadi tanpa pengkanonan "kelurahan sukaraya" dan
  "Kelurahan Sukaraya" tersimpan sebagai dua nilai berbeda — lembar rekap memecah
  satu wilayah menjadi dua baris, dan penyaring wilayah kehilangan sebagian
  pendaftarnya. **Ini benar-benar terjadi saat diuji**, terlihat dari lembar rekap.

Bawaannya wilayah sekolah CONTOH dan wajib diganti pembeli; panelnya memuat
peringatan mencolok, dan `SETUP.md` mendaftarnya sebagai hal yang harus diganti.

### Lembar rekap dihitung di basis data, bukan di browser

`GET /api/ppdb/rekap` mengembalikan cacah per jalur, jenis kelamin, wilayah, dan
asal sekolah — masing-masing dipecah menurut status lewat `count(*) FILTER (WHERE …)`.

Kenapa tidak dihitung di browser dari daftar yang sudah ada: **daftar panel kini
dipaginasi.** Menghitung di browser dari satu halaman akan diam-diam benar untuk
sekolah kecil lalu salah begitu pendaftarnya lebih banyak — dan lembar rekap yang
salah dikirim ke dinas pendidikan lebih buruk daripada tidak ada lembar rekap.

Keempat pengelompokan memakai satu fungsi `kelompokkan(kolom, kosong)`. Nilai
`kolom` berasal dari daftar tetap di dalam handler, **tidak pernah dari request**,
jadi penyisipannya ke string SQL tidak bisa dipakai menyuntik. Jenis kelamin
dipetakan ke kata penuh di SQL, bukan di panel: lembar ini dibaca orang luar, dan
"L" di kertas resmi terbaca seperti kode internal.

### Aturan cetak pindah ke berkas sendiri karena dashboard tidak memuat sdnb.css

Aturan `@media print` semula ditaruh di `sdnb.css`. Itu salah, dan cacatnya baru
terlihat ketika lembar rekap dibuat: **`sdnb.css` hanya diimpor halaman publik**,
sedangkan lembar rekap dicetak dari DASHBOARD. Menekan Cetak di sana akan mencetak
seluruh dashboard — bilah menu, kartu statistik, dan daftar pendaftaran.

Sekarang di `src/styles/cetak-bukti.css`, diimpor tiga tempat yang memakainya:
`PpdbPage`, `CekPendaftaranPage`, dan `PpdbRegistrations`. Kalau menambah tempat
cetak baru, impor berkas itu — jangan mengandalkan stylesheet halaman.

Blok itu juga menetralkan `[role="dialog"]`: Radix membatasi tinggi dialog dan
menggulung isinya, yang di kertas memotong tabel rekap yang panjang.

### Diterima → Data Murid dikerjakan di SATU transaksi Go, bukan tiga panggilan browser

`POST /api/ppdb/{id}/murid` membuat baris murid, menempatkannya di kelas, dan
menautkan pendaftarannya sekaligus. Panel Data Murid melakukan hal setara lewat
**tiga** panggilan terpisah dari browser (`createSantri` → `updateSantri` →
`moveSantriClass`); di sini tidak boleh begitu, karena bila penempatan kelas gagal
setelah muridnya dibuat, hasilnya murid tanpa kelas yang pendaftarannya masih
tampak "belum jadi murid" — dan menekan tombolnya lagi membuat murid **kedua**.

Empat hal yang menjaganya:

- **`insertSantriTx` dipakai ulang**, fungsi yang sama dipanggil `POST /api/santri`.
  Jadi murid dari PPDB tidak berbeda sedikit pun: baris `auth.users`,
  `user_profiles`, dan `santri` sekaligus, sandi awal dari NISN. Jangan menyalin
  logikanya — panggil fungsinya.
- **`SELECT … FOR UPDATE`** pada barisnya. Dua petugas yang menekan tombol
  bersamaan tidak sama-sama lolos pemeriksaan "belum jadi murid"; yang kedua
  menunggu lalu ditolak 409.
- **`pendaftaran_ppdb.santri_id`** dengan indeks unik parsial. Ini penanda tunggal
  "sudah jadi murid"; jangan menyimpulkannya dari kesamaan nama, karena nama boleh
  sama antar anak dan boleh diperbaiki ejaannya setelah dicatat.
- **Penempatan kelas menulis `class_mutations`**, bukan hanya `current_class_id` —
  mengikuti `MoveClass` di santri.go, supaya riwayat kelas murid utuh sejak awal.

Nomor induk: `GET /api/ppdb/usulan-nomor` mengembalikan `<tahun><NNN>` berikutnya
yang belum terpakai (`2026042` setelah data contoh `2026041`). Ia **usulan, bukan
jaminan** — penjaga sebenarnya indeks unik `santri_nomor_induk_qiroati_unique`, dan
petugas boleh menggantinya. Penyaring `~ '^<tahun>\d+$'` mengabaikan nomor lama
berbentuk `AFMLOCAL-ANAK-A01` supaya data contoh lama tidak membuat konversi gagal.

Konversi hanya menerima status `diterima`; mencatat pendaftar yang belum diputuskan
sebagai murid mendahului keputusan seleksi.

### Pembatas laju memakai RPC yang sudah ada, bukan pencacah di memori

Kedua endpoint publik (`POST /api/ppdb` dan `POST /api/ppdb/cek`) memanggil
`consume_auth_rate_limit`, RPC yang sudah terpasang sejak
`20260624001500_rls_helper_functions.sql` tapi **hanya pernah dipakai edge function
Deno yang sudah mati**. Tidak ada tabel baru.

Kenapa bukan `attemptLimiter` di `loginlogs.go`: pencacah itu di memori, hilang
setiap kontainer dimuat ulang, dan tidak berlaku lintas proses — catatannya sendiri
menyebut "move to Postgres or Redis if the backend is ever scaled horizontally".
RPC-nya memakai `select … for update`, jadi aman terhadap request bersamaan.

| Endpoint | Batas | Blokir |
|---|---|---|
| `POST /api/ppdb` | 12 / jam per IP | 30 menit |
| `POST /api/ppdb/cek` | 15 / 15 menit per IP | 30 menit |

Batas submit dilonggarkan dari bawaan RPC (5) karena satu keluarga wajar
mendaftarkan beberapa anak dan satu jaringan bisa dipakai banyak orang. Yang mau
dicegah pembanjiran skrip, bukan orang tua.

Dua hal yang sengaja: **IP di-hash** (`sha256`) karena tabelnya menyimpan `ip_hash`
dan alamat IP adalah data pribadi; dan **bila RPC-nya gagal, request DIIZINKAN** —
menolak pendaftaran karena pembatas lajunya sendiri rusak jauh lebih buruk daripada
melewatkan satu pembatasan.

### Cek status publik: tanggal lahir bukan formalitas

`POST /api/ppdb/cek` menuntut nomor pendaftaran **beserta** tanggal lahir. Nomornya
berurutan dan mudah diterka, jadi tanpa pasangan kedua siapa pun bisa menyisir
`PPDB-2026-0001` sampai `9999` dan memanen nama seluruh pendaftar.

Dua keputusan yang menyertainya:

- **Satu pesan untuk "nomor tidak ada" dan "tanggal tidak cocok".** Membedakan
  keduanya memberi tahu penyisir bahwa nomornya benar dan hanya tanggalnya yang
  perlu ditebak — 365 tebakan alih-alih tak terhingga.
- **Muatan balasannya sengaja sedikit**: nomor, nama, tahun ajaran, jalur, status.
  TIDAK ada NIK, alamat, telepon, maupun `catatan` — catatan itu tulisan internal
  petugas dan tidak ditulis untuk dibaca orang tua.

Halamannya `src/pages/CekPendaftaranPage.jsx` di rute `/cek-pendaftaran`, tertaut
dari footer, menu ponsel, dan layar konfirmasi formulir. Ia dirender **tanpa**
`PublicLayout` sendiri: blok rute publik di `App.jsx` sudah memasangnya.

### Pemberitahuan ke orang tua manual, dan itu bukan kelalaian

Aplikasi ini **tidak punya kemampuan mengirim apa pun**: nol SMTP (tidak ada
pustaka mail di `go.mod`, tidak ada templat surel, `[local_smtp]` di
`supabase/config.toml` hanya Inbucket untuk uji lokal), dan `whatsapp.go` hanya
menyimpan tautan grup — ia tidak mengirim pesan.

Jadi pola yang dipakai sama dengan bukti pembayaran dan kenaikan jilid yang sudah
ada: tombol menyusun pesan, `wa.me` membuka WhatsApp, petugas menekan kirim. Tiga
template baru (`ppdbDiverifikasi`, `ppdbDiterima`, `ppdbDitolak`) ada di
`whatsappTemplateAdapters.js` dan disunting pembeli di Konfigurasi → Pesan WhatsApp.

Bahasanya **netral tanpa salam keagamaan**, berbeda dari tiga template lama yang
peninggalan sekolah Al-Qur'an — ini template untuk sekolah negeri mana pun. Uji di
`whatsappTemplateAdapters.test.js` mengunci sifat itu, plus memastikan tidak ada
penanda `{{…}}` yang lolos belum terisi ke pesan yang terkirim.

Mengirim otomatis menuntut gerbang WhatsApp berbayar atau kredensial SMTP yang
harus disediakan pembeli. Jangan menambahkannya tanpa keputusan pemilik.

### Impor pendaftaran lama dari Pesan Masuk mengurai teks bebas

`POST /api/ppdb/impor-pesan` (admin saja) menyisir `feedbacks` untuk baris
berpenanda `[Pendaftaran PPDB …]` atau `[Pendaftaran SPMB …]`, mengurai format
"Label: nilai" per baris, lalu menyimpannya sebagai pendaftaran sungguhan.

Ini **tidak bisa dijamin benar seratus persen** — itu sebabnya migrasinya sengaja
tidak melakukannya. Empat hal yang membuatnya aman dijalankan:

1. **Barisnya tidak dihapus** dari `feedbacks`. Aslinya tetap ada sebagai pembanding.
2. **Yang gagal diurai dilewati beserta alasannya**, bukan disimpan setengah jadi.
3. **Bisa dijalankan berulang** — dikenali dari nama + tanggal lahir.
4. **`simulasi: true`** melaporkan tanpa menyimpan. Panel selalu menjalankannya
   lebih dulu dan menampilkan ringkasannya untuk disetujui; persetujuan itu bukan
   formalitas.

Nomornya berawalan **`LAMA-`** supaya jelas bahwa nomor itu dibuat saat impor dan
bukan nomor yang pernah dibacakan ke orang tua — nomor aslinya memang tidak pernah
ada. Pencacahnya dibagi dengan nomor SPMB, jadi urutannya berselang-seling
(`SPMB-2026-0002`, `LAMA-2026-0003`); itu benar, karena keunikannya pada nomor utuh
beserta awalannya.

**Dua jebakan penguraian yang benar-benar terjadi dan sudah diperbaiki.** Keempat
data orang tua ditulis dalam SATU baris dipisah titik tengah
(`Ayah: A · Ibu: B · Pekerjaan: C · HP wali: D`). Memecah **seluruh pesan** per
titik tengah menghasilkan dua kesalahan sekaligus:

- bagian pertamanya memuat semua baris sebelumnya, sehingga titik dua pertama ada
  di baris lain dan **`Ayah` hilang**;
- bagian terakhirnya menelan baris SESUDAHNYA, sehingga **`HP wali` menyerap angka
  dari `Berkas terunggah: 2 dari 4`** dan menghasilkan nomor 14 digit.

Barisnya harus dipisah lebih dulu, baru dipecah per titik tengah. Kalau menyentuh
kode ini, uji dengan pesan yang punya baris sebelum DAN sesudah baris orang tua.

`—` dan `-` diperlakukan sebagai kosong: format lama memakainya untuk kolom yang
tidak diisi, dan menyimpannya apa adanya akan mengisi kolom dengan tanda hubung.

### Cetak bukti pendaftaran memakai @media print, bukan pustaka

Tombol Cetak ada di dua tempat: layar konfirmasi formulir dan halaman cek status.
Keduanya memanggil `window.print()`; aturan `@media print` di `sdnb.css` yang
mengerjakan sisanya.

Caranya: `body * { visibility: hidden }` lalu `.bukti-cetak, .bukti-cetak *`
dikembalikan terlihat. **`visibility`, bukan `display`** — dengan `display:none`
tata letaknya runtuh saat blok buktinya dipindah ke pojok kiri atas kertas.

Dua kelas pendamping: `.bukti-kepala` (kepala surat berisi nama dan alamat sekolah,
`display:none` di layar karena namanya sudah ada di navigasi, tapi di kertas tidak
ada apa pun yang menyebutnya) dan `.bukti-sembunyi-cetak` (tombol Cetak dan
Kembali, yang tidak boleh ikut tercetak).

Tanpa aturan ini, Ctrl+P mencetak seluruh situs: navigasi, bulatan latar
bergradasi, footer, dan formulir pencarian. `html2canvas` sudah ada di proyek untuk
kuitansi pembayaran, tapi tidak dipakai di sini — untuk selembar teks, CSS cukup
dan hasilnya teks sungguhan yang bisa dipilih, bukan gambar.

### Formulir PPDB tidak responsif sama sekali — SUDAH DIPERBAIKI

Mockup-nya hanya dirancang untuk layar lebar, dan `sdnb-ppdb.css` hasil generator
tidak memuat satu pun aturan tata letak untuk ponsel. Di layar 375px kolom
formulir 493px dan panel jadwal 340px dipaksa masuk, dan separuh formulir
**terpotong di luar layar tanpa bilah geser** — NIK, tanggal lahir, dan email
tidak bisa diisi sama sekali. Untuk halaman yang orang tuanya membuka dari ponsel,
formulirnya tidak bisa dipakai.

Kolomnya inline style dari mockup, jadi CSS-nya perlu `!important`. Kelas
`ppdb-kolom`, `ppdb-grid`, `ppdb-rail`, `ppdb-bar`, `ppdb-pad`, `ppdb-kartu`, dan
`ppdb-langkah` ditambahkan **tangan** ke `PpdbBody.jsx` sebagai sasarannya.

**Jebakan yang memakan waktu:** mengubah `grid-template-columns` ke `1fr` saja
**tidak cukup**. Sebagian isian memakai `grid-column: span 2`, dan span yang
melebihi jumlah kolom eksplisit membuat grid menumbuhkan kolom **implisit** — jadi
hasilnya tetap dua kolom, hanya dengan lebar yang lebih timpang (`99px 188px`).
Span-nya harus dinetralkan juga:

```css
.sdnb-ppdb .ppdb-grid { grid-template-columns: 1fr !important }
.sdnb-ppdb .ppdb-grid > * { grid-column: auto !important }
```

Kesepuluh halaman publik sudah diperiksa pada 375px: tidak ada yang menyisakan
geser mendatar.

### Dua bilah sub-tab dashboard menarik seluruh halaman ikut bergeser

Disapu pada 375px, **17 dari 19** panel dashboard bersih. Dua tidak:

| Panel | Penyebab | Lebar di layar 375px |
|---|---|---|
| Konten | `.admin-segmented-control` (8 sub-tab) | **1144px** → halaman 759px |
| Pengaturan TV | `.admin-glass-tab-list` | 444px → halaman 409px |

Keduanya `display: inline-flex` tanpa pembungkus yang bisa digeser, jadi bilahnya
menarik **seluruh halaman** ikut bergeser mendatar — setiap panel di bawahnya juga
meleset dari layar. Yang benar adalah bilahnya sendiri yang bergeser. Diperbaiki di
`admin-dashboard.css` dengan `overflow-x: auto` di bawah 900px, `flex: none` pada
pilnya supaya tidak gepeng, dan bilah gesernya disembunyikan.

Panel bertabel lebar (Rekap SPP, Riwayat Bayar, Rekap Absensi) **sudah punya**
pembungkus yang bisa digeser sendiri — dugaan sebelumnya di dokumen ini bahwa
merekalah yang bermasalah ternyata salah.

**Cara mengulang sapuan ini:** ukur `documentElement.scrollWidth >
clientWidth` setelah mengeklik tiap `[role=tab]`. Jangan mengandalkan pencarian
elemen lebar saja — elemen yang melampaui layar di dalam pembungkus
`overflow-x: auto` memang benar dan bukan kerusakan.

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

Temuan verifikasi repository 2026-08-09:

- **Sudah selesai:** direktori staf Kontak mengambil `GET /api/content/teachers`, alamat Kontak
  mengambil `schoolIdentity.address`, default `institutionContent.js` sudah netral untuk SD umum,
  `JadwalSaya` terpasang di dashboard guru serta murid, fallback nama publik sudah netral,
  pagination SPMB sudah berjalan, smoke test editor/TV/formulir terbaru lulus, dan guard bentrok
  jadwal lulus dengan fixture periode sementara yang dibersihkan otomatis.
- **Masih nyata:** perluasan coverage test lintas komponen/handler bila area tersebut akan diubah,
  verifikasi manual SPMB dengan keyboard, mouse, dan pratayang cetak nyata, serta pengisian Juknis
  SPMB daerah oleh sekolah pembeli. Rinciannya ada di bagian "Yang masih terbuka".

Nama logo legacy, nama kelas CSS lama, dan arah desain lama sudah ditangani. Nama atau aset lama
yang tersisa di lapisan data hanya dipertahankan bila menjadi kontrak kompatibilitas.

### Cara memakai jaring test

```powershell
npm test          # sekali jalan
npm run test:watch
```

Pada mesin dev 2026-08-09, launcher `npm` global menunjuk ke instalasi yang hilang; fallback
verifikasi yang setara adalah `node node_modules/vitest/vitest.mjs run`.

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
- Ditambahkan: satu arah visual SDN Baturaja untuk publik dan dashboard, jebakan
  "menulis migrasi ≠ menerapkan migrasi", dan allowlist `validConfigKeys`.
