# docs/design-reference — Acuan desain SDN Baturaja

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

2. **`design-tokens.css`** — token siap pakai yang menyalin nilai dari
   `DESIGN.md`: dasar `#e9edf6`, indigo–violet–rose, Plus Jakarta Sans, Archivo,
   serta radius dan bayangan yang sama. Pakai variabel ini; jangan membuat palet
   atau kedalaman kontrol alternatif.

3. **`sintesis-studi-ui-sekolah-baturaja.md`** — ringkasan studi UI + tabel
   rekonsiliasi arah desain + catatan adaptasi ke skema data kita.

4. **`ARCHITECTURE.md`** — keputusan arsitektur PaaS (deploy per sekolah,
   feature flag runtime, backend Go+Postgres per sekolah, dll).

## Keputusan yang sudah final (jangan dibuka ulang)

- Baseline visual = desain Claude Design SDN Baturaja (bukan mulai dari nol).
- DESIGN.md dan halaman publik yang sedang berjalan adalah sumber kebenaran visual.
- Dashboard memakai token yang sama; mode gelapnya adalah ruang kerja solid dengan
  fokus indigo dan divider tenang.
- Urutan kerja: **Beranda dulu**, lalu Profil, Kontak, Berita, Pendaftaran
  (acu Formulir PPDB), Login, terakhir Parenting (tanpa pasangan langsung —
  rancang mengikuti bahasa kartu editorial yang sama).

## Adaptasi wajib (bukan copy mentah)

Desain referensi ini untuk sekolah negeri umum. Sejumlah kontrak data lama masih
memakai nama seperti `santri`, `hafalan`, atau `MMQ`; jangan ubah kontrak tersebut
tanpa migrasi, tetapi gunakan bahasa SDN Baturaja pada copy UI dan desain baru.

## Aset sumber

Halaman referensi `.dc.html` (10 halaman) + `DESIGN.md` asli ada di folder
Downloads user: `Sekolah Negeri Baturaja Homepage`. Screenshot Beranda (fold &
full) sudah dibagikan di chat sesi Cowork.
