# Sintesis Studi UI — "Sekolah Negeri Baturaja" (Claude Design)

Ringkasan hasil pelajari folder `Sekolah Negeri Baturaja Homepage` (hasil Claude Design) untuk dijadikan acuan kombinasi UI/komponen/layout template sekolah tunggal (Umum). Dibuat supaya bisa dibawa langsung ke sesi Claude Code tanpa perlu mengulang eksplorasi.

## 1. Apa isi folder ini

Export dari Claude Design berbasis design system **Modernist** (`_ds/modernist-.../styles.css`) — tapi penting: token asli Modernist itu flat, mono merah-di-putih, radius 0px (`readme.md` di dalamnya menyebut ini eksplisit). **Situs Sekolah Negeri Baturaja tidak memakai tampilan Modernist itu langsung** — `DESIGN.md` di root folder mendefinisikan lapisan visual custom di atasnya (glassmorphism pastel, radius besar, gradient blob). Kalau lanjut di Claude Code, ikuti `DESIGN.md`, bukan `styles.css` Modernist secara literal.

10 halaman didesain sebagai Design Component (`.dc.html`) — Beranda, Profil, Galeri, Berita, Kontak, Prestasi, Ekstrakurikuler, Fasilitas, Program, Formulir PPDB — plus satu render lengkap `Beranda Sekolah Negeri Baturaja.html` yang berhasil aku screenshot penuh (file `.dc.html` lain butuh runtime Design Canvas, tidak render sebagai HTML statis biasa).

## 2. Token visual konkret (diambil dari kode asli, bukan perkiraan)

**Warna & latar**
- Dasar: `#e9edf6` + `linear-gradient(160deg,#eef1f8 0%,#e7edf7 40%,#f4eef4 100%)`, `position:fixed`.
- Tiga bola cahaya lembut (blue/pink/mint) `position:fixed`, `blur(20–24px)`, animasi lambat.
- Kartu kaca: `rgba(255,255,255,.5–.58)` + `backdrop-filter:blur(26px) saturate(185%)` + border putih tipis.
- Aksen: `#5b6cff → #9a6cf0 → #f0779f` (dipakai di tombol utama & CTA gradasi).
- Blok gambar placeholder: gradasi pastel — contoh nyata dari kode: `linear-gradient(150deg,#c6b6f6,#9fc4f8 55%,#a9eede)`, `linear-gradient(140deg,#a7f3d0,#7dd3fc)`, `linear-gradient(140deg,#fbcfe8,#f9a8d4)`, dst.

**Tipografi**: judul **Plus Jakarta Sans 800** (letter-spacing negatif), badan **Archivo** 400–700. Semua rata kiri, tidak ada teks tengah kecuali label pil kecil.

**Bentuk**: radius bertingkat sesuai konteks — pil/tombol 12–16px, kartu 22–26px, panel besar 28–34px (terverifikasi di kode: 6, 8, 9, 11–30, 999px semua dipakai konsisten sesuai peran elemen, bukan satu radius seragam).

**Keputusan final**: gunakan permukaan kaca lembut dan bayangan drop biasa
(`0 26px 56px -24px rgba(55,65,120,.5)`) seperti desain ini. Jangan menambah
inset shadow atau lapisan cahaya dekoratif pada kontrol dan ruang kerja padat.

## 3. Yang membuat desain ini terasa premium & tidak generik

- Angka nyata dan spesifik di hero (1.482 siswa, akreditasi A · 96,4, bukan badge generik "terpercaya").
- Headline flush-left, bold, tanpa ilustrasi orang stok — cukup tipografi kuat + blok warna.
- Tiap halaman "berkarakter" punya nada berbeda yang disengaja (bukan template seragam): Prestasi bernada arsip gelap dengan angka outline besar, Ekstrakurikuler bernada poster kinetik dengan stiker berputar, Fasilitas bernada denah teknis (radius turun ke 6px, garis hitam-biru tebal), Program bernada dokumen kurikulum dengan timeline jam pelajaran. Halaman umum lain tetap konsisten pakai kartu kaca terang — jadi variasi tidak mengorbankan kesatuan sistem.
- Batasan disiplin: maksimal dua keluarga warna latar per halaman, dilarang menambah aksen warna baru sembarangan.

## 4. Screenshot acuan

Beranda (fold & full page) sudah dirender dan dikirim terpisah di chat — dipakai sebagai bukti visual nyata, bukan deskripsi saja.

## 5. Keputusan desain yang berlaku

| Poin | Keputusan |
|---|---|
| Latar | Gunakan dasar `#e9edf6` dan blob pastel blue/pink/mint sesuai DESIGN.md. |
| Kartu dan panel | Gunakan permukaan putih lembut dengan drop shadow biasa; tidak ada depth inset atau cahaya dekoratif. |
| Tipografi | Plus Jakarta Sans 800 untuk judul dan Archivo untuk isi/interface. |
| Radius | Gunakan sistem bertingkat 6–34px sesuai peran elemen. |
| Dashboard | Ikuti palet dan tipografi publik; mode gelap memakai permukaan tinta solid, divider tenang, dan fokus indigo. |
| Konten hero | Pertahankan angka nyata, komposisi editorial, dan tidak ada ilustrasi stok generik. |

## 6. Yang perlu diadaptasi untuk konteks kita (bukan copy langsung)

- Sejumlah kontrak data lama masih memiliki istilah spesifik. Layout kartu dan grid boleh dipakai, tetapi field/copy baru harus memakai bahasa SDN Baturaja serta tetap melalui adapter Go+Postgres yang ada.
- Halaman `/login` di desain ini (`Login.dc.html`) belum berhasil aku render sebagai gambar (butuh runtime Design Canvas) — deskripsi pola form ada di `DESIGN.md` bagian 8 (Formulir): label 12.5px tebal, kolom radius 16px, focus ring `rgba(120,132,255,.16)`.
- Beberapa halaman kita (Berita, Pendaftaran, Parenting, Profil, Kontak) punya pasangan langsung di desain ini (Berita, Formulir PPDB→Pendaftaran, Profil Sekolah, Kontak) — Parenting tidak ada pasangan, perlu dirancang menyesuaikan pola kartu editorial yang sama.

## 7. Rencana lanjutan

Pekerjaan detail (porting komponen, penyesuaian token ke Tailwind/CSS project, penyesuaian per halaman) dilanjutkan di Claude Code sesuai rencana. Dokumen ini + screenshot Beranda dipakai sebagai brief awal supaya konteks studi ini tidak hilang saat pindah sesi/tool.
