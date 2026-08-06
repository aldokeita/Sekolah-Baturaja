import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import EkskulBody from '@/components/sdnb/generated/EkskulBody';
import useSdnbMotion from '@/hooks/useSdnbMotion';
import '@/styles/sdnb.css';

/**
 * Ekstrakurikuler — markup generated verbatim from `Ekstrakurikuler.dc.html` by
 * tools/dc-convert.mjs. This file reproduces the mockup's logic class: the
 * rotating name stickers, the index-and-poster layout (clicking an index entry
 * swaps the poster, alternating the `panA`/`panB` animation), and the weekly
 * schedule cards.
 */

const E = [
  ['Pramuka Siaga & Penggalang', 'Kepramukaan', 'Jumat', '15.00–16.30', 'Hendra Wijaya, S.Pd.', 'Halaman belakang', 68, 80, 'Kelas III–VI',
    'Regu berlatih tali-temali, sandi morse, dan pertolongan pertama. Setiap semester diadakan perkemahan satu malam di halaman sekolah, dengan orang tua diundang pada malam api unggun.',
    '#6470ff,#8a6cf0'],
  ['Atletik', 'Olahraga', 'Selasa', '15.30–16.30', 'Hendra Wijaya, S.Pd.', 'Lapangan sekolah', 24, 30, 'Kelas IV–VI',
    'Latihan lari jarak pendek, lompat jauh, dan lempar bola. Murid yang menonjol disiapkan untuk seleksi O2SN tingkat kecamatan setiap Februari.',
    '#7a6cf5,#c07ad8'],
  ['Sanggar Tari', 'Seni', 'Rabu', '15.00–16.30', 'Yuliana Sari, S.Pd.SD', 'Aula sekolah', 22, 24, 'Kelas II–VI',
    'Tari daerah Sumatera Selatan, terutama Gending Sriwijaya dan Tanggai. Kostum dijahit bersama orang tua murid, tampil pada pentas seni Desember.',
    '#a86ce8,#e58fc4'],
  ['Klub Mendongeng', 'Literasi', 'Kamis', '13.30–14.30', 'Siti Aminah, S.Pd.SD', 'Perpustakaan', 18, 20, 'Kelas I–IV',
    'Murid berlatih membaca nyaring lalu bercerita tanpa teks di depan kelas satu setiap dua pekan. Cerita diambil dari koleksi cerita rakyat perpustakaan.',
    '#e0839a,#f0a06c'],
  ['Tahfiz & Tilawah', 'Keagamaan', 'Selasa', '13.30–14.30', 'Ratna Dewi, S.Pd.SD', 'Musala', 34, 40, 'Kelas III–VI',
    'Setoran hafalan juz 30 dan latihan tilawah. Dua anggota kelompok ini menjuarai MTQ pelajar tingkat kabupaten pada 2026.',
    '#5b6cff,#9fb6f8'],
  ['Klub Sains', 'Akademik', 'Rabu', '13.30–14.30', 'Dedi Kurniawan, S.Pd.', 'Ruang kelas V A', 20, 24, 'Kelas IV–VI',
    'Percobaan sederhana memakai bahan dari sekitar sekolah: penjernihan air, tekanan udara, dan tumbuhan. Hasil percobaan dipamerkan pada pekan sains.',
    '#6ab8f0,#8fd8ec'],
  ['Seni Musik & Paduan Suara', 'Seni', 'Kamis', '15.00–16.30', 'Yuliana Sari, S.Pd.SD', 'Aula sekolah', 30, 36, 'Kelas III–VI',
    'Latihan pianika, angklung, dan paduan suara. Mengisi upacara bendera setiap awal bulan serta penutupan pentas seni.',
    '#8a6cf0,#c8a4f0'],
  ['Dokter Kecil', 'Kesehatan', 'Senin', '13.30–14.30', 'Lestari Ningsih, A.Md.', 'Ruang UKS', 16, 18, 'Kelas IV–VI',
    'Belajar pertolongan pertama, mengukur tinggi dan berat badan teman, serta menjaga kebersihan kelas. Bertugas bergilir saat upacara.',
    '#5fb8a0,#8fe0c0'],
  ['Kebun & Bank Sampah', 'Lingkungan', 'Senin', '15.00–16.00', 'Dedi Kurniawan, S.Pd.', 'Kebun sekolah', 40, 48, 'Kelas IV–VI',
    'Merawat petak sayur, memilah sampah, dan mencatat hasil panen. Kegiatan ini menjadi dasar penilaian Adiwiyata nasional 2026.',
    '#7bbf6a,#b6e8a0'],
  ['Klub Komputer', 'Akademik', 'Jumat', '13.30–14.30', 'Ahmad Zulkarnain, S.Pd.', 'Ruang komputer', 26, 32, 'Kelas V–VI',
    'Mengetik sepuluh jari, menyusun dokumen sederhana, dan mencari informasi dengan pendampingan guru.',
    '#6470ff,#b4b8f8'],
];

const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
const ROT = [-7, 5, -3, 8, -5, 4, -8, 6];
const POS = [
  [2, 6, null, null], [40, null, 0, null], [null, 4, 22, null], [6, null, null, 24],
  [null, 0, 46, null], [30, null, null, 6], [null, 22, 68, null], [0, null, 92, null],
];

const EkstrakurikulerPage = () => {
  const [aktif, setAktif] = useState(0);
  const [tick, setTick] = useState(0);

  useSdnbMotion([]);

  const pilih = (i) => { setAktif(i); setTick((t) => t + 1); };

  const a = E[aktif];
  const no = String(aktif + 1).padStart(2, '0');

  const vals = {
    angka: [
      { n: 10, suf: '', label: 'kegiatan aktif' },
      { n: 298, suf: '', label: 'murid terdaftar' },
      { n: 9, suf: '', label: 'guru pembina' },
    ],

    stiker: E.slice(0, 8).map((e, i) => {
      const [l, t, r, b] = POS[i];
      return {
        nama: e[0].split(' ')[0],
        style: 'position:absolute;'
          + (l !== null ? `left:${l}%;` : '') + (t !== null ? `top:${t}%;` : '')
          + (r !== null ? `right:${r}%;` : '') + (b !== null ? `bottom:${b}%;` : '')
          + `--rot:${ROT[i]}deg;transform:rotate(${ROT[i]}deg);animation-delay:${(i * 0.55).toFixed(2)}s;`
          + `padding:14px 20px;border-radius:18px;font-family:'Plus Jakarta Sans','Archivo',system-ui,sans-serif;font-size:${15 + (i % 3) * 3}px;font-weight:800;letter-spacing:-.02em;color:#fff;background:linear-gradient(135deg,${e[10]});box-shadow:0 22px 44px -18px rgba(70,80,170,.75),inset 0 1px 0 rgba(255,255,255,.5)`,
      };
    }),

    total: `${E.length} kegiatan`,

    indeks: E.map((e, i) => {
      const on = i === aktif;
      const c = e[10].split(',');
      return {
        nomor: String(i + 1).padStart(2, '0'),
        judul: e[0],
        hari: `${e[2]}, ${e[3]}`,
        on: on ? '1' : '0',
        foto: `background-image:radial-gradient(58% 120% at 80% 16%,${c[1]} 0%,rgba(255,255,255,0) 62%),radial-gradient(48% 104% at 20% 90%,${c[0]} 0%,rgba(255,255,255,0) 58%),linear-gradient(118deg,${c[0]} 0%,${c[1]} 100%)`,
        pick: () => pilih(i),
        no: `font-family:'Plus Jakarta Sans','Archivo',system-ui,sans-serif;font-size:22px;font-weight:800;letter-spacing:-.03em;font-variant-numeric:tabular-nums;transition:color .3s ease;color:${on ? '#5b6cff' : '#c2c6dd'}`,
        nama: `display:block;font-size:15.5px;font-weight:${on ? '800' : '600'};letter-spacing:-.015em;transition:color .3s ease;color:${on ? '#191b2c' : '#3f4468'}`,
      };
    }),

    panelCls: tick % 2 === 0 ? 'panA' : 'panB',

    poster: {
      nomor: no, judul: a[0], bidang: a[1], hari: a[2], jam: a[3], pembina: a[4], tempat: a[5],
      cerita: a[9], kelas: a[8],
      kuotaTeks: `${a[6]} / ${a[7]} murid`,
      kuotaBar: `height:100%;width:${Math.round((a[6] / a[7]) * 100)}%;border-radius:99px;background:linear-gradient(90deg,#6470ff,#e58fc4);transition:width .7s cubic-bezier(.22,.9,.28,1)`,
      wrap: `position:relative;overflow:hidden;min-height:340px;border-radius:32px;background:linear-gradient(140deg,${a[10]});border:1px solid rgba(255,255,255,.4);box-shadow:0 40px 86px -30px rgba(60,70,160,.72)`,
    },

    jadwal: HARI.map((h) => ({
      hari: h,
      head: "padding:12px 14px;border-radius:14px;font-family:'Plus Jakarta Sans','Archivo',system-ui,sans-serif;font-size:12.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#21243f;background:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.9)",
      isi: E.map((e, i) => ({ e, i })).filter((o) => o.e[2] === h).map(({ e, i }) => ({
        nama: e[0],
        jam: e[3],
        pick: () => pilih(i),
        card: `cursor:pointer;padding:18px 18px 16px;border-radius:20px;background:linear-gradient(140deg,${e[10]});border:1px solid rgba(255,255,255,.35);box-shadow:0 20px 44px -20px rgba(60,70,160,.66),inset 0 1px 0 rgba(255,255,255,.4)`,
      })),
    })),

    langkah: [
      { no: '01', teks: 'Pilih satu kegiatan dan tanyakan sisa tempatnya kepada wali kelas.' },
      { no: '02', teks: 'Tulis nama pada daftar kelas, orang tua cukup memberi tanda tangan.' },
      { no: '03', teks: 'Datang pada jadwal latihan berikutnya, tanpa biaya dan tanpa seragam khusus.' },
    ],
  };

  return (
    <div className="sdnb-ekskul">
      <Helmet>
        <title>Ekstrakurikuler — Sekolah Dasar Negeri Baturaja</title>
        <meta name="description" content="Sepuluh kegiatan ekstrakurikuler, jadwal sepekan, dan cara mendaftar." />
      </Helmet>
      {EkskulBody(vals)}
    </div>
  );
};

export default EkstrakurikulerPage;
