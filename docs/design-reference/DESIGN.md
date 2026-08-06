# DESIGN.md — Panduan UI/UX Situs SDN Baturaja

Acuan wajib untuk setiap halaman baru maupun perubahan halaman lama, agar seluruh situs terasa satu kesatuan. Design system terikat: **Modernist** (`_ds/modernist-bd3286f0-e7ed-4ed6-ad5c-0fe277f2f24e/styles.css`, dimuat di `<helmet>` setiap halaman). Di atas itu, situs ini memakai lapisan visual sendiri yang dijelaskan di bawah.

## 1. Berkas dan struktur

| Halaman | Berkas |
| --- | --- |
| Beranda | `Beranda SMAN Baturaja.dc.html` |
| Profil sekolah | `Profil Sekolah.dc.html` |
| Galeri | `Galeri.dc.html` |
| Berita | `Berita.dc.html` |
| Kontak | `Kontak.dc.html` |
| Prestasi | `Prestasi.dc.html` |
| Ekstrakurikuler | `Ekstrakurikuler.dc.html` |
| Fasilitas | `Fasilitas.dc.html` |
| Program | `Program.dc.html` |
| Formulir PPDB | `Formulir PPDB.dc.html` |

Setiap halaman adalah satu Design Component mandiri. Semua gaya ditulis **inline**; hanya yang tidak bisa inline (`@keyframes`, reset `body`, aturan `:hover` pada elemen anak, media query) yang ditaruh di `<style>` dalam `<helmet>` di bagian paling atas template.

## 2. Warna

Latar dan permukaan
- Latar dasar: `#e9edf6`, dilapisi `linear-gradient(160deg,#eef1f8 0%,#e7edf7 40%,#f4eef4 100%)` yang dipasang `position:fixed`.
- Tiga bola cahaya `position:fixed` dengan `radial-gradient` biru `rgba(150,170,255,.7)`, merah muda `rgba(255,178,214,.6)`, hijau mint `rgba(160,240,225,.5)`, `filter:blur(20–24px)`, animasi `floaty`.
- Permukaan kaca: `rgba(255,255,255,.5–.58)` + `backdrop-filter:blur(26px) saturate(185%)` + `border:1px solid rgba(255,255,255,.75–.9)` + `inset 0 1px 0 rgba(255,255,255,.95)`.

Aksen (dipakai untuk aksi utama, penanda aktif, dan gradasi teks)
- `#5b6cff` → `#9a6cf0` → `#f0779f`
- Tombol utama: `linear-gradient(135deg,#6470ff,#8a6cf0 55%,#e58fc4)`.
- Blok poster/CTA: `linear-gradient(135deg,rgba(95,108,242,.95),rgba(152,110,235,.9) 48%,rgba(238,142,190,.9))`.

Teks
- Judul: `#171827`; subjudul/badan: `#4c5175`, `#535878`, `#565b7d`; sekunder: `#6d7192`; label kecil: `#8a8ea8`.
- Tautan: `#4f46e5`, hover `#3730a3`. Selalu didefinisikan di `<helmet>`.
- Di atas foto/gradasi gelap: putih dengan `text-shadow:0 2px 14px rgba(25,30,70,.5)`.

Batas: maksimal dua keluarga warna latar per halaman (kaca putih + satu blok gradasi aksen). Jangan menambah warna aksen baru.

### Halaman berkarakter khusus

Dua halaman sengaja dibedakan nada visualnya, tetapi tetap memakai navigasi, footer, latar, dan palet aksen yang sama:

- **Prestasi** — nada arsip/ledger. Panel hero gelap `linear-gradient(150deg,#181b3a,#232455 46%,#3a2a52)` dengan raster garis putih tipis, judul Archivo 900 huruf besar, angka besar bergaya outline (`-webkit-text-stroke`), daftar berupa baris bergaris (bukan kartu kaca), tab kategori berupa teks huruf besar bergaris bawah animatif, dan seluruh angka `font-variant-numeric:tabular-nums`.
- **Ekstrakurikuler** — nada kinetik/poster. Judul Plus Jakarta Sans 86px dengan satu kata beroutline biru, stiker nama kegiatan berputar-ringan (`floaty` + `--rot`), tata letak indeks-dan-poster (klik indeks di kiri, poster besar berganti dengan animasi `swapin`), serta jadwal sepekan berbentuk kartu berwarna per hari.

- **Fasilitas** — nada denah teknis. Radius sudut turun ke 6px (bukan 22–34px), judul Archivo 900 dengan titik aksen, garis pemisah 3px hitam-biru, denah interaktif gelap bergaris grid dengan titik hotspot berdenyut, dan daftar ruang berupa baris penuh dengan foto pada kolom kiri.
- **Program** — nada dokumen kurikulum. Panel hero kaca besar dengan bola conic-gradient, baris pintasan berbentuk pil, kartu program bergradasi tinggi 320px, garis waktu "satu hari di sekolah" bernomor jam dengan garis tumbuh, dan bilah beban jam pelajaran.

Jangan menyalin nada-nada ini ke halaman lain; halaman umum tetap memakai kartu kaca terang.

## 3. Tipografi

- Judul: **Plus Jakarta Sans** (800), `letter-spacing` negatif `-.02em` sampai `-.05em`, `line-height` .9–1.2.
- Badan: **Archivo** (400–700).
- Tangga ukuran yang dipakai: hero 70–96px, judul seksi 38px, judul kartu 16.5–20px, badan 13.5–16.5px, label huruf besar 11–12px dengan `letter-spacing:.08–.16em`.
- Paragraf panjang selalu `text-wrap:pretty` dan dibatasi `max-width` 300–640px.
- Semua teks rata kiri. Tidak ada teks tengah kecuali label di dalam pil kecil.

## 4. Bentuk dan bayangan

- Radius: pil/tombol 12–16px, kartu 22–26px, panel besar 28–34px, avatar/ikon 13–16px.
- Bayangan kartu: `0 26px 56px -24px rgba(55,65,120,.5)`; panel besar `0 32px 68px -26px`; hover `0 40px 78px -28px rgba(50,60,125,.6)`.
- **Setiap wadah yang punya bayangan dan `overflow:hidden` harus menyisakan padding bawah** (mis. carousel dan marquee memakai 64–70px) supaya bayangan tidak terpotong seksi berikutnya.
- Bar navigasi tidak boleh `overflow:hidden` (memotong dropdown).

## 5. Navigasi

Susunan tetap di semua halaman: **Beranda · Profil (dropdown) · Berita · Kontak**, lalu tombol sekunder kaca dan CTA "Daftar PPDB".

Dropdown Profil berisi: Tentang kami, Galeri, Prestasi, Program, Ekstrakurikuler, Fasilitas. Kelas yang dipakai: `.navdd`, `.ddmenu`, `.ddpanel`, `.ddlink`, `.ddcaret` (muncul saat `:hover` dan `:focus-within`, panah kanan menyembul pada `:hover`).

Tautan aktif: `font-weight:700;color:#4a4fd0;background:rgba(255,255,255,.72)`. Tautan pasif: `font-weight:600;color:#2c2f45` dengan `style-hover="background:rgba(255,255,255,.7);color:#4a58e0"`.

Bar navigasi selalu `position:sticky;top:0`, lebar isi `max-width:1240px`, padding `12px 14px 12px 20px`.

## 6. Tata letak

- Lebar isi: `max-width:1240px;margin:0 auto;padding:0 28px`.
- Jarak antar seksi: 56–92px di atas.
- Susun kelompok elemen dengan `display:flex`/`grid` + `gap`, bukan margin per elemen.
- Bar filter/kategori: `position:sticky;top:96px`, panel kaca, pil kategori di kiri dan kontrol tambahan di kanan.

## 7. Gerak

Kelas bersama yang sudah ada dan harus dipakai ulang, bukan dibuat baru:
`floaty` (bola latar), `sheen` + `.shine` (kilau tombol), `fadeup`, `popin`, `slidein`, `marquee` + `.mq-track`/`.mq-wrap` (berhenti saat hover), `ping` (titik denyut), `.lift`, `.tilt`, `.gtile`/`.gcell` (angkat + zoom isi + caption naik).

Aturan
- Durasi 0.25–0.6s untuk interaksi, easing `cubic-bezier(.22,.8,.28,1)`; efek pantul memakai `cubic-bezier(.3,1.3,.4,1)`.
- Animasi latar 15–46s, `linear` atau `ease-in-out`, selalu berulang mulus (untuk loop `-50%`, isi harus diduplikasi dua kali).
- Sertakan `@media (prefers-reduced-motion:reduce)` untuk mematikan animasi berjalan.
- Gerakan hanya `transform` dan `opacity`.

## 8. Komponen berulang

- **Kartu isi**: permukaan kaca, badge kategori huruf besar di kiri atas, judul Plus Jakarta Sans 800, ringkasan, garis pemisah `1px solid rgba(255,255,255,.85)`, lalu meta + tombol panah 34px.
- **Modal/lightbox**: latar `rgba(24,30,60,.6)` + `backdrop-filter:blur(18–20px)`, panel radius 28–30px, animasi masuk `slidein`/`zoomin`, tutup lewat klik latar, tombol X, dan tombol Esc; panah kiri/kanan untuk pindah isi.
- **Formulir**: label 12.5px tebal di atas kolom, kolom radius 16px `rgba(255,255,255,.62)`, fokus memakai `box-shadow:0 0 0 4px rgba(120,132,255,.16)` dan border aksen. Tombol nonaktif memakai `opacity:.45;cursor:not-allowed` — jangan disembunyikan.
- **Blok CTA gradasi**: satu per halaman, teks putih, dua tombol (putih pekat + kaca transparan).
- **Footer**: identik di semua halaman, grid `1.6fr 1fr 1fr` (identitas, daftar halaman, kontak) plus baris hak cipta.
- **Toast**: `position:fixed;bottom:32px`, tengah, `rgba(28,32,66,.9)`, hilang otomatis 2.6s.

## 9. Gambar

Belum ada foto asli. Semua bidang gambar diisi gradasi pastel dari palet berikut, dengan lapisan `radial-gradient(115% 75% at 22% 10%,rgba(255,255,255,.45),transparent 58%)` di atasnya:
`#c6b6f6/#9fc4f8`, `#ffc9dc/#f2a9c8`, `#a9eede/#8fd8ec`, `#ffe0b3/#ffc39c`, `#d7d2ff/#b4b8f8`, `#bbf7d0/#86efac`, `#ffd8ea/#e8b6f0`, `#c9e8ff/#a5c8f5`.
Saat foto asli tersedia, ganti isi bidang tanpa mengubah ukuran, radius, atau lapisan gradasi gelapnya.

## 10. Bahasa dan penulisan

- Bahasa Indonesia baku, kalimat pendek dan faktual. Tanpa emoji, tanpa tanda seru, tanpa jargon pemasaran.
- Angka mengikuti format Indonesia (`96,4`, `4.200 m²`), jam memakai titik (`07.30–15.00`), rentang memakai en dash.
- Sapaan: "murid", "orang tua", "tata usaha", "wali kelas".
- Label tombol berupa perintah singkat: "Kirim pesan", "Baca selengkapnya", "Salin alamat".

## 11. Responsif

Titik putus yang dipakai konsisten: 1120px (subjudul brand hilang), 1040px (padding nav mengecil), 940px (menu dan tombol sekunder hilang), 1000px (grid dua kolom jadi satu, grid empat jadi dua), 640px (semua grid jadi satu kolom, hero mengecil).
Target sentuh minimal 44px. Tombol geser carousel tidak boleh disembunyikan di layar kecil, cukup diperkecil.

## 12. Aksesibilitas

- Setiap tombol ikon wajib punya `aria-label`.
- Modal dapat ditutup dengan Esc; navigasi isi memakai panah kiri/kanan.
- Elemen dekoratif diberi `aria-hidden="true"`.
- Fokus papan tik tidak dihapus; pakai cincin fokus aksen sesuai design system.
