# docs/design-reference — Acuan Desain Front Page (Sekolah Tunggal / Umum)

Folder ini adalah brief awal untuk pengerjaan front page di Claude Code. Semua
keputusan visual & arsitektur sudah diputuskan; jangan mengulang fase riset.

## Baca dengan urutan ini

1. **`DESIGN.md`** — SUMBER KEBENARAN VISUAL. Hasil Claude Design "SDN Baturaja".
   Ini spesifikasi utama: glassmorphism pastel, blob latar, radius bertingkat,
   Plus Jakarta Sans + Archivo. Ikuti file ini.
   > Catatan: desain ini di-export di atas design system bawaan "Modernist"
   > (`_ds/.../styles.css` di folder sumber). Token Modernist itu flat/mono/
   > radius-0 dan TIDAK mewakili tampilan situs. Abaikan styles.css Modernist;
   > ikuti DESIGN.md.

2. **`design-tokens.css`** — token siap pakai hasil turunan DESIGN.md dengan dua
   penyesuaian yang sudah disepakati:
   - Palet dicondongkan ke **teal-cyan-blue-violet** (identitas platform),
     menggantikan blue-pink-mint asli.
   - **Neumorphism tipis** ditambahkan KHUSUS untuk tombol & input (`--neu-*`).
     Kartu/panel tetap glass murni. Ini penambahan, bukan pengganti DESIGN.md.
   Pakai variabel ini; jangan hardcode hex/px yang sudah ada tokennya.

3. **`sintesis-studi-ui-sekolah-baturaja.md`** — ringkasan studi UI + tabel
   rekonsiliasi arah desain + catatan adaptasi ke skema data kita.

4. **`ARCHITECTURE.md`** — keputusan arsitektur PaaS (deploy per sekolah,
   feature flag runtime, backend Go+Postgres per sekolah, dll).

## Keputusan yang sudah final (jangan dibuka ulang)

- Baseline visual = desain Claude Design SDN Baturaja (bukan mulai dari nol).
- Ikuti DESIGN.md; neumorphism TIDAK di-drop (dipakai tipis di tombol/input).
- Palet condong ke teal-cyan-blue-violet.
- Urutan kerja: **Beranda dulu**, lalu Profil, Kontak, Berita, Pendaftaran
  (acu Formulir PPDB), Login, terakhir Parenting (tanpa pasangan langsung —
  rancang mengikuti bahasa kartu editorial yang sama).
- Varian **Islam Terpadu menyusul** setelah Umum selesai (palette-swap
  emerald-teal-gold), bukan paralel.

## Adaptasi wajib (bukan copy mentah)

Desain referensi ini untuk sekolah negeri umum (siswa/kelas/jurusan). Skema data
kita (Go+Postgres) lebih kaya: santri/guru/pentashih/hafalan/MMQ. Layout & kartu
boleh dipakai, tapi field, copy, dan endpoint harus mengikuti backend yang ada.

## Aset sumber

Halaman referensi `.dc.html` (10 halaman) + `DESIGN.md` asli ada di folder
Downloads user: `Sekolah Negeri Baturaja Homepage`. Screenshot Beranda (fold &
full) sudah dibagikan di chat sesi Cowork.
