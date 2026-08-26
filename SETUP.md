# Panduan Pemasangan — Sistem Informasi Sekolah

Panduan ini untuk **pembeli template**: memasang aplikasi, menjalankannya, lalu mengubah isinya
menjadi milik sekolah Anda sendiri.

Bacalah sampai **bagian 7**. Bagian 1–6 membuat aplikasi hidup; bagian 7 yang membuatnya menjadi
sekolah Anda. Aplikasi yang baru dipasang berisi sekolah contoh bernama "Sekolah Dasar Negeri
Baturaja" dengan guru dan murid contoh — semuanya bisa Anda ganti dari dalam aplikasi, tanpa
menyentuh kode.

**Susunannya:** situs publik (React) · API (Go) · database (PostgreSQL). API dan database berjalan
bersama lewat Docker, jadi Anda tidak perlu memasang Go atau PostgreSQL satu per satu.

---

## Prasyarat

| Kebutuhan | Versi | Untuk apa |
|---|---|---|
| Docker Desktop | 24 atau lebih baru | menjalankan API dan database |
| Node.js | 22 | membangun situs publik |
| Git | apa saja | mengambil kode |

Node 22 dianjurkan persis; berkas `.nvmrc` sudah menyebutkannya. Kalau Anda memakai `nvm`, cukup
jalankan `nvm use` di folder proyek.

---

## 1 · Ambil kodenya

```bash
git clone <url-repo> sekolah
cd sekolah
```

---

## 2 · Siapkan pengaturan API

```bash
cd backend
cp .env.example .env
```

Buka `backend/.env` dan isi **tiga** nilai yang wajib. Penjelasan masing-masing ada di dalam berkas
itu sendiri:

| Nilai | Isi dengan |
|---|---|
| `POSTGRES_PASSWORD` | sandi acak apa pun untuk database |
| `JWT_SECRET` | 32 karakter acak |
| `JWT_REFRESH_SECRET` | 32 karakter acak **yang lain** |
| `CORS_ORIGIN` | `http://localhost:3000` untuk mencoba di komputer sendiri |

Cara cepat membuat nilai acak:

```bash
openssl rand -hex 32
```

Di Windows tanpa `openssl`:

```powershell
-join ((1..64) | ForEach-Object { '0123456789abcdef'[(Get-Random -Maximum 16)] })
```

**Jangan biarkan nilai bawaan.** Dua kunci JWT itu yang menjaga sesi login; kalau nilainya bisa
ditebak, orang lain bisa membuat sesi palsu.

---

## 3 · Nyalakan API dan database

Masih dari folder `backend/`:

```bash
docker compose up -d --build
```

Sekali jalan, perintah ini akan:

- membangun API dari kode Go,
- menyalakan PostgreSQL 16,
- menerapkan seluruh 57 berkas migrasi database secara berurutan,
- mengisi data contoh (sekolah, guru, murid, kelas) supaya aplikasi tidak kosong saat pertama dibuka.

Pertama kali biasanya 2–5 menit karena Docker harus mengunduh dan membangun. Periksa keadaannya:

```bash
docker compose ps
```

Lihat log API sampai muncul `server running on :8080`:

```bash
docker compose logs -f api
```

> **Kalau `docker compose` tidak dikenali,** Docker Desktop Anda terlalu lama. Perbarui ke versi 24
> atau lebih baru. Perintah lama `docker-compose` (dengan tanda hubung) tidak dipakai proyek ini.

---

## 4 · Siapkan pengaturan situs

Kembali ke folder utama:

```bash
cd ..
cp .env.example .env.local
```

Untuk mencoba di komputer sendiri, isinya sudah benar apa adanya. Yang perlu diubah hanya saat
dipasang di internet:

```env
VITE_API_URL=https://api.sekolahmu.sch.id
```

Alamat ini **harus cocok** dengan `CORS_ORIGIN` di `backend/.env` — satu menyebut alamat situs, satu
menyebut alamat API. Salah pasangan membuat login gagal tanpa pesan yang jelas.

Pengaturan opsional di berkas yang sama:

| Nilai | Bila dinyalakan |
|---|---|
| `VITE_ENABLE_TAHFIZH` | menampilkan modul hafalan Al-Qur'an. Biarkan `false` untuk sekolah umum. |
| `VITE_ENABLE_DEFERRED_FEATURES` | membuka fitur permainan kelas yang masih dikembangkan |
| `VITE_ENABLE_EDGE_FUNCTIONS` | jangan diubah; peninggalan arsitektur lama |

---

## 5 · Jalankan situsnya

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`. Halaman depan sekolah contoh akan muncul, dan Anda bisa masuk ke
dashboard di `http://localhost:3000/login`.

---

## 6 · Pasang di internet

**Situs publik** cukup berkas statis:

```bash
npm run build
```

Hasilnya di folder `dist/`.

Situs dan API tinggal di **satu VPS dengan satu domain**: Nginx atau Caddy menyajikan `dist/` dan
meneruskan `/api` ke Go yang berjalan di mesin yang sama. Karena satu domain, peramban tidak pernah
mengirim permintaan lintas-asal, jadi CORS tidak ikut bermain.

`VITE_API_URL` harus berisi **asal domain situs itu sendiri** — skema dan host saja:

```
VITE_API_URL=https://sekolah.contoh.sch.id
```

Jangan diisi `/api` dan jangan dikosongkan. `src/lib/apiClient.js` menyusun alamat sebagai
`${VITE_API_URL}${path}` sementara `path` sudah memuat `/api`, jadi `/api` menghasilkan
`/api/api/…`; dan nilai kosong jatuh ke bawaan `http://localhost:8080` karena barisnya memakai `||`.
Tanpa garis miring di akhir, supaya tidak muncul `//api/…`.

Contoh Caddy (`/etc/caddy/Caddyfile`) — HTTPS diurus sendiri oleh Caddy:

```
sekolah.contoh.sch.id {
    root * /var/www/sekolah/dist
    handle /api/* {
        reverse_proxy localhost:8080
    }
    handle /files/* {
        reverse_proxy localhost:8080
    }
    handle {
        try_files {path} /index.html
        file_server
    }
}
```

Contoh Nginx yang setara:

```nginx
server {
    server_name sekolah.contoh.sch.id;
    root /var/www/sekolah/dist;

    location /api/   { proxy_pass http://127.0.0.1:8080; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme; }
    location /files/ { proxy_pass http://127.0.0.1:8080; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme; }
    location /       { try_files $uri /index.html; }
}
```

Tiga hal yang wajib benar:

| Hal | Nilai | Kalau salah |
|---|---|---|
| `try_files … /index.html` | fallback semua alamat | `/berita` jadi 404 saat dimuat ulang |
| `X-Forwarded-Proto` | diteruskan ke API | tautan berkas jadi `http://` di situs `https://` |
| `/files/` | ikut diteruskan ke API | foto guru dan murid tidak muncul |

**API dan database** perlu server yang menyala terus (VPS). Salin folder proyek ke sana, buat
`backend/.env` seperti bagian 2 tapi dengan `CORS_ORIGIN` berisi domain situs Anda, lalu jalankan
`docker compose up -d --build`. Pasang HTTPS di depannya dengan Caddy atau Nginx.

---

## 7 · Jadikan milik sekolah Anda

Ini bagian yang paling penting dan sering dilewati. Semuanya dikerjakan dari dalam aplikasi.

### 7.1 · Masuk sebagai admin

| Kolom | Nilai |
|---|---|
| Email | `admin@sdnbaturaja.sch.id` |
| Sandi | `admin123` |

### 7.2 · Ganti sandi itu sekarang

Sandi di atas tertulis dalam panduan ini, jadi bukan rahasia. Selama belum diganti, siapa pun yang
tahu alamat situs Anda bisa masuk sebagai admin.

Caranya: **Data Guru** → cari baris **Administrator** → tombol ubah → isi kolom sandi → simpan.
Sandi lama langsung mati begitu disimpan.

Lakukan hal yang sama untuk akun contoh lain yang akan Anda pakai. Semuanya bersandi lemah:

| Peran | Email | Sandi bawaan |
|---|---|---|
| Tata Usaha | `tatausaha@sdnbaturaja.sch.id` | `tatausaha123` |
| Guru | `guru@sdnbaturaja.sch.id` | `guru123` |
| Wakil Kepala Sekolah | `pentashih@sdnbaturaja.sch.id` | `pentashih123` |

Murid masuk memakai **nama panggilan** sebagai nama pengguna, dan **NIS sebagai sandi**. Bukan email.

Kalau seorang murid belum punya NIS, sandinya diambil dari NISN, lalu dari nomor induk — urutannya
NIS, NISN, nomor induk. Murid contoh Naila tidak punya NIS, jadi sandinya nomor induknya, `2026041`.

| Murid | Nama pengguna | Sandi |
|---|---|---|
| Naila Rahmadani | `Naila` | `2026041` (nomor induk, tidak punya NIS) |
| Ahmad Fauzan | `Ahmad` | `26001` (NIS) |

Aturan ini berlaku untuk semua murid, bukan hanya yang contoh: murid yang ditambahkan lewat aplikasi
maupun lewat impor Excel langsung mendapat sandi awal dari nomornya. Nama panggilan diisi otomatis
dari kata pertama nama lengkap kalau dibiarkan kosong.

**Yang perlu Anda sadari.** Nama panggilan dan NIS keduanya bukan rahasia — keduanya tertulis di
daftar kelas dan berkas sekolah. Siapa pun yang tahu keduanya bisa masuk sebagai murid itu, dan akun
murid memuat riwayat pembayaran serta catatan karakter. Ini konvensi yang lazim di sekolah Indonesia,
tetapi anggaplah akun murid sebagai kemudahan, bukan pengamanan.

Satu hal lagi: **murid belum bisa mengganti sandinya sendiri.** Yang boleh diubah murid hanya nama
panggilan, nomor HP, dan alamat. Kalau sekolah Anda perlu murid mengganti sandi, itu belum ada.

### 7.3 · Ganti data contoh

Semua data contoh bisa diubah atau dinonaktifkan tanpa risiko. Tombol hapus di aplikasi ini
sebenarnya **menonaktifkan**, bukan menghapus permanen — jadi Anda tidak akan pernah kena pesan
galat gara-gara data itu masih terpakai di absensi atau jadwal.

| Yang perlu diganti | Di mana |
|---|---|
| Guru contoh ("Guru Demo A/B", "Pentashih Demo") | **Data Guru** |
| Murid contoh ("Santri Demo …", "Naila Rahmadani") | **Data Murid** |
| Kelas contoh ("Kelas Demo A/B") | **Manajemen Kelas** |
| Jadwal pelajaran contoh | **Jadwal Pelajaran** |
| Berita contoh ("Berita Demo") | **Konten → Media & Galeri → Berita** |

Urutan yang paling lancar: buat guru dulu, lalu kelas, lalu murid. Kelas memilih guru pengampu dari
daftar guru yang sudah ada, dan murid ditempatkan ke kelas yang sudah ada.

### 7.4 · Isi konten situs

Semuanya di menu **Konten**:

| Tab | Yang bisa Anda ubah |
|---|---|
| **Info Sekolah** | kontak, alamat, jam layanan, tahun ajaran, visi, misi, dan tujuan |
| **Halaman Depan** | tiga kartu program, testimoni, dan tanya-jawab di beranda |
| **Halaman Profil** | pembuka, riwayat sekolah, fasilitas, angka ringkasan, kutipan kepala sekolah, dan data pokok |
| **Apresiasi** | murid dan guru berprestasi |
| **Media & Galeri** | galeri foto, berita, pengumuman, dan daftar fasilitas |
| **Informasi Pendaftaran** | jalur pendaftaran beserta kuotanya, berkas yang diminta, jadwal, dan syarat SPMB |
| **Pesan Masuk** | pesan yang dikirim pengunjung dari halaman Kontak |

Pendaftaran murid baru **tidak** masuk ke Pesan Masuk. Ia punya menunya sendiri; lihat 7.6.

Empat hal yang memudahkan:

- **Daftar guru tidak perlu diisi dua kali.** Halaman Profil, Kontak, dan penulis berita contoh
  semuanya mengambil dari **Data Guru**. Cukup isi guru sekali, dan ketiganya ikut.
- **Data pokok sekolah bebas Anda tentukan.** Di tab Halaman Profil, baris NPSN, akreditasi, dan
  seterusnya bisa dihapus atau ditambah sesuai yang berlaku di sekolah Anda. Baris tanpa isi tidak
  tampil di situs. Nama sekolah, tahun ajaran, dan jam layanan sudah otomatis — tidak perlu ditulis
  ulang di sini.
- **Tahun ajaran cukup diisi sekali.** Di halaman pendaftaran, tulis `{tahun}` pada daftar syarat
  dan angkanya akan mengikuti tahun ajaran berjalan. Contoh: `berusia 6 tahun pada 1 Juli {tahun}`.
- **Satu frasa bisa diberi warna.** Pada kalimat besar kutipan kepala sekolah, apit sebuah frasa
  dengan tanda bintang untuk mewarnainya dengan warna khas sekolah — `membawa *cara belajarnya
  sendiri*`.

Satu catatan: bagian **Video Hafalan** di Media & Galeri hanya muncul di dashboard murid, dan hanya
bila `VITE_ENABLE_TAHFIZH` dinyalakan. Sekolah umum boleh mengabaikannya.

### 7.5 · Yang tidak bisa Anda ubah sendiri

Hanya tiga hal: **nama sekolah, logo, dan warna khas sekolah**. Ketiganya dikunci untuk pemegang
lisensi template. Kalau Anda membutuhkannya diganti, **hubungi penjual** — perubahannya cepat.

Visi, misi, tujuan, nomor telepon, alamat, dan tahun ajaran **bukan** termasuk. Semuanya ada di tab
**Info Sekolah** dan sepenuhnya Anda yang mengaturnya, karena itu data sekolah Anda sendiri.

Semua hal lain — seluruh isi administrasi sekolah, seluruh konten situs, semua akun — juga milik
Anda.

### 7.6 · Menerima pendaftaran murid baru (SPMB)

Menu **Pendaftaran SPMB** (di kelompok Data, sebelah Data Murid) berisi calon murid yang mengisi
formulir di halaman pendaftaran situs Anda. Terbuka untuk **Admin** dan **Tata Usaha**.

> **Kenapa SPMB dan bukan PPDB?** Sejak **Permendikdasmen No. 3 Tahun 2025**, istilah resminya
> berganti dari PPDB menjadi **SPMB** (Sistem Penerimaan Murid Baru), dan jalur **Zonasi** menjadi
> **Domisili**. Aplikasi ini sudah memakai istilah yang baru. Banyak orang masih menyebut "PPDB"
> sehari-hari, jadi Anda boleh mengubah kalimat di halaman pendaftaran lewat
> **Konten → Informasi Pendaftaran** bila daerah Anda masih memakai istilah lama.

Setiap pendaftar mendapat nomor urut sendiri — `SPMB-2026-0001`, `SPMB-2026-0002`, dan seterusnya —
yang ditunjukkan ke orang tua di layar terakhir formulir. Nomornya kembali ke 1 setiap tahun ajaran.

#### Jalur dan kuota

Bawaannya sudah mengikuti ketentuan untuk SD:

| Jalur | Kuota | Keterangan |
|---|---|---|
| **Domisili** | paling sedikit 70% | berdasarkan wilayah tempat tinggal yang ditetapkan pemerintah daerah |
| **Afirmasi** | paling sedikit 15% | keluarga tidak mampu dan penyandang disabilitas |
| **Mutasi** | paling **banyak** 5% | anak dari orang tua yang dipindahtugaskan |

**Jalur prestasi tidak diberlakukan untuk murid kelas satu SD**, jadi tidak kami sertakan. Kalau
ketentuan daerah Anda berbeda, ubah di **Konten → Informasi Pendaftaran** — persentase maupun nama
jalurnya bisa Anda atur bebas, dan sistem tidak akan menegur.

#### Wilayah penerimaan — wajib Anda ganti

Jalur Domisili memakai **wilayah administratif** yang ditetapkan pemerintah daerah — kelurahan/desa,
kecamatan, atau radius — bukan jarak rumah ke sekolah. Karena itu berbeda di tiap kabupaten,
**Anda yang mengisi daftarnya** di **Konten → Informasi Pendaftaran → Wilayah Penerimaan**.

Daftar bawaannya wilayah di sekitar sekolah contoh. **Gantilah sebelum membuka pendaftaran** —
kalau tidak, orang tua akan memilih wilayah yang tidak berlaku di sekolah Anda. Tanyakan daftar
resminya ke Dinas Pendidikan setempat.

Setelah terisi, pilihan wilayah muncul di formulir pendaftaran, dan panel mendapat penyaring wilayah
— cara tercepat melihat "siapa saja yang tinggal di wilayah kami".

Kalau sekolah Anda tidak memakai pembagian wilayah, **kosongkan daftarnya**. Kolom pilihannya akan
hilang dari formulir dan tidak ada yang diwajibkan.

Agar sisa kursi tampil, dua hal harus terisi: **kapasitas tiap kelas** di Manajemen Kelas, dan
**kuota jalur** di Konten. Panel lalu menghitung sendiri:

> 3 kelas × 28 kursi = 84 kursi → Domisili 58, Afirmasi 12, Mutasi 4

Angka sisa boleh menjadi minus. Sistem **tidak memblokir** penerimaan yang melewati kuota —
keputusannya tetap milik sekolah, karena ada keadaan yang tidak bisa ditebak aplikasi.

Alur kerjanya empat status:

| Status | Artinya |
|---|---|
| **Baru masuk** | belum disentuh siapa pun |
| **Sudah diperiksa** | berkas dan datanya sudah dicek petugas |
| **Diterima** | lolos seleksi |
| **Tidak diterima** | tidak lolos |

Yang perlu diketahui:

- **Menekan angka di kartu ringkasan ikut menyaring daftarnya.** Cara tercepat melihat "siapa yang
  belum diperiksa".
- **Nomor WhatsApp bisa diklik** untuk langsung membuka percakapan dengan orang tua.
- **Data calon murid tidak bisa disunting**, disengaja: yang mengisinya orang tua, dan catatan
  verifikasi kehilangan artinya bila isinya bisa diubah belakangan. Salah tulis diselesaikan lewat
  kolom **Catatan verifikasi**.
- **Hanya Admin yang bisa menghapus.** Tata Usaha boleh menolak, tapi pendaftaran yang ditolak
  sebaiknya dibiarkan sebagai riwayat — supaya tetap bisa ditunjukkan bila orang tua bertanya.
- **Unduh CSV** mengikuti penyaring yang aktif. Berkasnya bisa dibuka di Excel, untuk memindahkan
  data ke Dapodik atau mencetak daftar hadir daftar ulang.
- **Kirim ganda tidak menggandakan data.** Bila orang tua menekan kirim dua kali, nomor yang sama
  dikembalikan alih-alih membuat baris kedua.

Satu hal yang perlu Anda sampaikan ke orang tua: **berkas tidak diunggah lewat situs.** Daftar di
langkah ketiga formulir hanyalah pernyataan "sudah saya siapkan"; berkas aslinya dibawa saat daftar
ulang. Ini disengaja — membuka unggahan untuk pengunjung yang tidak dikenal berarti menerima berkas
dari siapa saja.

Formulir pendaftaran juga **dibatasi 12 kiriman per jam dari satu jaringan.** Itu untuk mencegah
pembanjiran otomatis, bukan menghalangi orang tua. Kalau ada yang mengeluh terkena batas — misalnya
beberapa orang mendaftar dari satu warnet — mereka bisa mencoba lagi setengah jam kemudian, atau
mendaftar di sekolah.

#### Mencatat murid yang diterima

Pada pendaftaran berstatus **Diterima**, tombol **Jadikan murid** memindahkan seluruh datanya ke Data
Murid sekaligus: NISN, NIK, tempat dan tanggal lahir, alamat, nama orang tua, dan nomor WhatsApp.
Anda hanya perlu memeriksa tiga hal di kotak yang muncul:

| Kolom | Keterangan |
|---|---|
| **Nomor induk** | sudah diusulkan otomatis dari nomor yang belum terpakai; boleh Anda ganti |
| **Kelas** | boleh dikosongkan dan ditentukan nanti di Manajemen Kelas |
| **Angkatan** | terisi dari tahun ajaran |

Akun murid langsung dibuat, dengan **NISN sebagai sandi awal**. Ingatkan orang tua menggantinya.

Satu pendaftaran hanya bisa dijadikan murid **sekali** — setelah itu tombolnya berganti menjadi
penanda "Sudah jadi murid", jadi satu anak tidak akan tercatat dua kali.

#### Mengabari orang tua

Tombol **Kabari** membuka WhatsApp dengan pesan yang sudah terisi lengkap: nama anak, nomor
pendaftaran, dan nama sekolah Anda. Isi pesannya berbeda menurut status, dan **semuanya bisa Anda
ubah** di **Konfigurasi → Pesan WhatsApp** (tiga template: SPMB Berkas Sudah Diperiksa, SPMB
Diterima, SPMB Tidak Diterima).

**Pengirimannya tidak otomatis.** Aplikasi ini tidak mengirim WhatsApp maupun surel sendiri —
tombolnya menyiapkan pesan, Anda yang menekan kirim. Ini disengaja: pengiriman otomatis menuntut
layanan gerbang WhatsApp berbayar yang harus Anda daftarkan sendiri.

Orang tua juga bisa memeriksa sendiri lewat halaman **Cek pendaftaran** (tertaut di footer situs),
memakai nomor pendaftaran beserta tanggal lahir anaknya. Halaman itu hanya menampilkan status —
bukan NIK, alamat, maupun catatan verifikasi Anda.

Di halaman itu, dan juga di layar terakhir formulir, ada tombol **Cetak bukti pendaftaran**. Yang
tercetak selembar bukti berkepala nama dan alamat sekolah Anda — bukan tangkapan seluruh halaman
situs. Orang tua bisa membawanya saat daftar ulang.

#### Memindahkan pendaftaran lama

Kalau sekolah Anda sudah memakai aplikasi ini **sebelum** menu SPMB ada, pendaftaran waktu itu masuk
ke **Konten → Pesan Masuk** sebagai pesan biasa. Tombol **Impor dari Pesan Masuk** (hanya Admin)
memindahkannya ke menu ini.

Cara kerjanya aman untuk dicoba:

- Sebelum menyimpan apa pun, muncul ringkasan berapa yang bisa dipindahkan dan berapa yang tidak,
  **beserta alasannya satu per satu**. Anda yang memutuskan lanjut atau tidak.
- **Pesan aslinya tidak dihapus.** Kalau ada yang salah baca, aslinya masih bisa Anda periksa.
- **Boleh dijalankan berulang** tanpa menggandakan data.
- Nomornya berawalan `LAMA-` supaya jelas nomor itu dibuat saat pemindahan, bukan nomor yang pernah
  Anda sampaikan ke orang tua.

Pendaftaran yang datanya tidak lengkap — misalnya tanggal lahirnya tidak terbaca — akan dilewati.
Yang seperti itu perlu Anda catat sendiri, atau minta orang tuanya mendaftar ulang lewat formulir.

#### Lembar rekap untuk dinas

Tombol **Lembar rekap** menyusun rekapitulasi siap cetak: jumlah pendaftar menurut jalur, jenis
kelamin, wilayah domisili, dan sekolah asal — masing-masing dipecah menjadi mendaftar, diperiksa,
diterima, dan tidak diterima. Kepala suratnya memakai nama dan alamat sekolah Anda.

Angkanya dihitung dari **seluruh** pendaftaran, bukan dari yang sedang tampil di panel. Jadi lembar
rekapnya tetap benar walaupun daftar di layar sedang disaring atau pendaftarnya lebih dari 500.

Pilih tahun ajaran di penyaring sebelum menekan tombolnya bila Anda ingin rekap satu tahun tertentu.

---

## Perintah yang sering dipakai

Semuanya dijalankan dari folder `backend/` kecuali disebut lain.

```bash
docker compose ps                      # keadaan API dan database
docker compose logs -f api             # ikuti log API
docker compose up -d --build api       # nyalakan ulang API setelah ubah kode
docker compose down                    # matikan, data tetap aman
docker compose exec db psql -U postgres -d lpq_db   # masuk ke database
```

Mengulang dari nol — **menghapus seluruh data**, termasuk yang sudah Anda isi:

```bash
docker compose down -v
docker compose up -d --build
```

---

## Kalau ada masalah

| Yang terlihat | Sebabnya biasanya | Yang harus dilakukan |
|---|---|---|
| Login gagal, browser bilang soal CORS | `CORS_ORIGIN` tidak cocok dengan alamat situs | samakan keduanya, tanpa garis miring di akhir, lalu `docker compose up -d api` |
| Situs kosong, tidak ada data | API belum siap atau `VITE_API_URL` salah | tunggu `server running on :8080` di log, periksa alamatnya |
| `docker compose up` langsung berhenti | `POSTGRES_PASSWORD` masih kosong | isi di `backend/.env` |
| API berhenti sendiri saat menyala | `JWT_SECRET` atau `JWT_REFRESH_SECRET` kosong | isi keduanya dengan nilai berbeda |
| Port 8080 sudah dipakai | ada aplikasi lain di port itu | matikan aplikasi itu, atau ubah `PORT` di `backend/.env` |
| `/berita` jadi 404 setelah dimuat ulang | server web belum diarahkan ke `index.html` | atur *fallback* ke `index.html` di server web (lihat bagian build) |
| Data hilang setelah dimatikan | memakai `down -v` | jangan pakai `-v` kecuali memang ingin mengosongkan |
| Foto guru tidak muncul | API diakses lewat alamat berbeda dari yang menyimpan foto | pastikan `VITE_API_URL` konsisten sejak awal |

Membaca pesan galat API secara langsung:

```bash
docker compose logs --tail 100 api
```

---

## Daftar pengaturan

### `backend/.env`

| Nilai | Wajib | Keterangan |
|---|---|---|
| `POSTGRES_PASSWORD` | ya | sandi database |
| `JWT_SECRET` | ya | minimal 32 karakter acak |
| `JWT_REFRESH_SECRET` | ya | minimal 32 karakter acak, berbeda dari di atas |
| `CORS_ORIGIN` | ya | alamat situs, tanpa garis miring di akhir |
| `PORT` | tidak | bawaan `8080` |
| `ACCESS_TOKEN_TTL_MINUTES` | tidak | bawaan `60` |
| `REFRESH_TOKEN_TTL_DAYS` | tidak | bawaan `30` |
| `UPLOAD_DIR` | tidak | bawaan `/app/uploads` |
| `MAX_UPLOAD_MB` | tidak | bawaan `20` |

`DATABASE_URL` diisi otomatis oleh Docker; jangan disetel sendiri.

### `.env.local` (situs)

| Nilai | Wajib | Keterangan |
|---|---|---|
| `VITE_API_URL` | ya | alamat API, tanpa garis miring di akhir |
| `VITE_ENABLE_TAHFIZH` | tidak | bawaan `false` |
| `VITE_ENABLE_DEFERRED_FEATURES` | tidak | bawaan `false` |
| `VITE_ENABLE_EDGE_FUNCTIONS` | tidak | biarkan `false` |

---

## Susunan saat berjalan

```
┌────────────────────────────────────────────┐
│  Pengunjung / staf sekolah                 │
│  situs publik + dashboard  (React)         │
└───────────────────┬────────────────────────┘
                    │ HTTPS
┌───────────────────▼────────────────────────┐
│  API  :8080  (Go)                          │
│  volume uploads — foto guru, murid, galeri  │
└───────────────────┬────────────────────────┘
                    │
┌───────────────────▼────────────────────────┐
│  PostgreSQL 16  :5432                      │
│  volume pgdata — seluruh data sekolah      │
└────────────────────────────────────────────┘
```

Dua volume Docker itu yang menyimpan segalanya. Sertakan keduanya dalam rencana pencadangan Anda;
menu **Backup & Restore** di dashboard mencadangkan isi database, bukan berkas foto.
