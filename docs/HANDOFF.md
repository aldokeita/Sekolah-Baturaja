# HANDOFF — Status Migrasi SDN Baturaja

**Diperbarui:** 2026-08-08 · **Branch:** `feat/sederhanakan-tab-konten` · **HEAD:** `abb1c00`

HEAD saat ini sudah tersinkron ke `origin/feat/sederhanakan-tab-konten`. Branch ini belum di-merge
ke `master`; `master` tetap berada di commit `8c80e39` pada checkout lokal.

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
| `npm test` | **160 test hijau** (Vitest 3, 9 berkas) |
| Guard `scripts/validate-*.ps1` | **7 dari 8 hijau** — lihat catatan di bawah |
| Kompilasi backend Go | Hijau (lewat Docker; Go tidak terpasang di mesin dev) |
| Login 6 akun | **Terbukti jalan** lewat API |
| `resolveUser` tahan kegagalan | **Terbukti lewat uji suntik kerusakan** (rename kolom `nisn`) |
| 18 tab dashboard admin | **Semua merender**, nol crash — disapu satu per satu di browser |
| **Navigasi Manajemen Konten Website** | **Tuntas di browser**: 11 tab datar disusun menjadi 6 kelompok untuk superadmin dan 5 kelompok untuk admin; semua sub-tab dan panel lama tetap tersedia |
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
| **PPDB — validasi server** | **Tuntas lewat API, 10 kasus**: nama <3 huruf, tanpa jenis kelamin, tanggal lahir kosong/masa depan, NISN 5 angka, NIK 10 angka, email ngawur, HP terlalu pendek, alamat kosong, NISN ganda — semuanya ditolak dengan pesan Indonesia |
| **PPDB — penjagaan peran** | **Tuntas lewat API**: tanpa token 403 pada daftar & statistik, guru 403, tata usaha 200 menyunting tapi **403 menghapus**, admin 200 |
| **PPDB — kirim ganda** | **Tuntas**: pengiriman kedua mengembalikan id & nomor yang sama, `duplikat: true`, tanpa baris kedua |
| **PPDB — nomor & normalisasi** | **Tuntas**: `PPDB-2026-0001…0003` berurutan; `+62 812-3456-7890` dan `6281377778888` tersimpan `081234567890` / `081377778888` |
| **PPDB — formulir publik di browser** | **Tuntas**: keempat langkah diisi, formulir kosong ditolak dengan spanduk galat, kirim berhasil menampilkan **nomor asli dari server**, seluruh 20 kolom terbukti masuk kolomnya masing-masing di DB |
| **PPDB — panel di browser** | **Tuntas**: kartu ringkasan, penyaring tahun & status, rincian terbuka, simpan catatan (PUT), ubah status, cacah ikut berubah, nama berkas terbaca, CSV berisi 21 kolom |
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
  jatuh ke default (semua panel nyala). Verifikasi layar TV menuntut login peran operasional — belum
  dilihat di browser, hanya lolos lint + build.
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
- **Verifikasi editor admin menuntut login** (agen tak boleh isi sandi) — jalur simpan belum diklik di
  browser; hanya lolos lint + build + render publik. Uji klik saat login untuk memastikan.

### Galeri & Fasilitas dinamis — TUNTAS (2026-08-08, commit `5ce5a71`)

Kedua halaman kini render daftar CMS **penuh** (jumlah bebas), bukan lagi menimpa slot per-indeks.
Modal editor di ContentManagement diperluas: Galeri → kategori/keterangan/tanggal (di samping foto &
judul); Fasilitas → kategori/luas/ringkasan/deskripsi. Halaman publik memakai daftar `source` (CMS
bila ada, jika kosong contoh bawaan `FOTO`/`F`); span mosaik & gradien dipilih otomatis dari urutan
(pembeli tak menulis tata letak); filter kategori/tur/chip/mozaik/lightbox atas daftar aktif.
Terverifikasi render default di browser (18 foto, 10 ruang), lint + build hijau.

**Sisa kecil (opsional):** rincian per-ruang (meta grid) belum ada di editor Fasilitas — saat ruang
dari CMS, grid rincian kosong (bawaan tetap menampilkannya). Statistik hero/band/ringkas kedua
halaman dibiarkan hardcoded (dekoratif). Verifikasi klik-simpan editor menuntut login (belum diuji).

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

**Rencana (pola sama seperti trio di atas):**
1. Perluas editor yang ADA di ContentManagement (jangan bikin key baru — `galleryPhotos`/`facilities`
   sudah dipakai HomePage & halaman ini). Tambah field per item: galeri → kategori (dari `KAT`),
   keterangan, tanggal; fasilitas → kategori, luas, ringkas, meta[]. Pertahankan alur unggah foto
   (`handleFileUpload`) yang sudah jalan.
2. Render publik dari daftar CMS **penuh** (berapa pun jumlahnya), bukan dipatok jumlah slot. colSpan/
   rowSpan diberikan otomatis dari pola indeks (pembeli tak menulis span), gradien fallback dari palet
   indeks. Fallback ke `FOTO`/`F` bawaan saat CMS kosong.
3. Filter kategori & hitungannya dari daftar aktif. Lightbox/tur jalan atas daftar aktif.
4. Statistik dekoratif (hero/band/ringkas) boleh diturunkan (mis. jumlah foto/ruang) atau dibiarkan —
   keputusan kecil, bukan penghalang.

Risiko: `galleryPhotos` juga dibaca HomePage (beranda) — pastikan penambahan field tidak merusak
konsumsi di sana (HomePage hanya pakai url/caption, jadi field tambahan aman diabaikan).

### Branding bawaan dan navigasi Konten — TUNTAS (2026-08-08)

#### Branding legacy dicabut — commit `8c80e39`

Permukaan template yang masih menampilkan identitas LPQ dinetralkan. Fallback logo sekarang memakai
`public/logo-sekolah.svg` melalui `src/lib/schoolAssets.js`; identitas sekolah tersimpan tetap menjadi
sumber utama. Metadata publik, sitemap, robots, pesan WhatsApp, laporan, kuitansi, absensi digital,
permainan, kuis, dan beberapa kartu/placeholder konten juga sudah diarahkan ke identitas sekolah
yang netral. Asset lama `public/logo-lpq-al-fath-maulana.webp` masih disimpan sebagai legacy dan belum
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

**Verifikasi perubahan navigasi:** lint, 160 test Vitest, build, `git diff --check`, dan pemindaian
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

1. **Audit modul inti SELESAI — delapan modul disisir.** Absensi, Pembayaran, Backup, Data Murid,
   Guru, Kelas, Kalender, dan Jadwal Pelajaran semuanya tuntas (lihat "Putaran audit modul
   2026-08-08"). Bila menambah modul baru, sisir dengan pola yang sama dan jalankan sebagai peran
   **selain admin** — itulah yang membuat cacat terparah lolos berbulan-bulan.
2. **Kalender publik SENGAJA tidak ditampilkan di situs — keputusan pemilik (2026-08-08).** Endpoint
   `/api/public/calendar` dan adapter `fetchPublicCalendar` sudah siap dan terbukti jalan tanpa login,
   tetapi pemilik memutuskan **tidak** menampilkannya di situs untuk saat ini. Endpoint & adapter
   dibiarkan menganggur sebagai infrastruktur siap-pakai (pola yang sama seperti infra dorman lain di
   app ini). **Jangan bangun UI kalender publik tanpa instruksi baru.** Catatan: endpoint tetap dapat
   diakses tanpa login dan mengembalikan event `is_public` — datanya tidak sensitif (agenda/hari
   libur), dan pemilik sudah tahu ini saat memilih membiarkannya.
3. **Kuota jalur tidak menahan apa pun, dan itu keputusan pemilik.** Panel menunjukkan sisa kursi
   tapi tidak menegur maupun memblokir. Bila kelak diminta menegur, tempatnya di `ubahStatus` pada
   panel — bukan di server, supaya tata usaha tidak pernah terhalang bekerja.
4. **`GET /api/ppdb` dibatasi 500 baris tanpa pagination.** Cukup untuk satu gelombang sekolah dasar,
   tapi sekolah besar dengan beberapa gelombang akan melewatinya. Batasnya dicatat di panel, tidak
   disembunyikan. Lembar rekap TIDAK terkena batas ini — ia dihitung di basis data.
5. **Aturan SPMB bisa berubah lagi.** Bawaan sekarang mengikuti Permendikdasmen No. 3 Tahun 2025.
   Sebelum gelombang penerimaan berikutnya, periksa ulang apakah jalur, persentase, dan syarat usia
   masih sama — semuanya bisa disunting pembeli, jadi perubahan aturan tidak menuntut rilis kode,
   hanya pembaruan bawaan dan `SETUP.md`.
6. **Belum ada yang menguji alur SPMB sebagai pengguna sungguhan.** Seluruh verifikasi dilakukan agen
   lewat API dan penyuntikan JavaScript di browser; pemilik memilih tidak menguji sendiri. Yang
   BELUM pernah dijalankan: mengetik dengan papan ketik sungguhan, menekan tombol dengan tetikus,
   dan **melihat hasil cetak yang sebenarnya** — aturan cetaknya dibuktikan dengan menerapkannya
   sebagai aturan layar, bukan dengan membuka pratayang cetak. Bila ada laporan janggal dari
   pembeli, mulailah dari ketiga hal itu.

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

Kenapa tidak dihitung di browser dari daftar yang sudah ada: **daftarnya dibatasi
500 baris.** Menghitung di browser akan diam-diam benar untuk sekolah kecil lalu
diam-diam salah begitu pendaftarnya lebih banyak — dan lembar rekap yang salah
dikirim ke dinas pendidikan lebih buruk daripada tidak ada lembar rekap.

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
