import React, { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import ProgramBody from '@/components/sdnb/generated/ProgramBody';
import useSdnbMotion from '@/hooks/useSdnbMotion';
import '@/styles/sdnb.css';

/**
 * Program — markup generated verbatim from `Program.dc.html` by
 * tools/dc-convert.mjs. This file reproduces the mockup's logic class: the
 * programme cards with their detail modal (keyboard navigable), the
 * "satu hari di sekolah" timeline, and the weekly lesson-hour bars.
 */

const P = [
  ['Membaca pagi', 'Kebiasaan', 'Kelas I–VI', '15 menit', 'var(--sekolah-aksen),var(--sekolah-aksen-tengah)',
    'Lima belas menit membaca buku pilihan sendiri sebelum pelajaran pertama.',
    'Program dimulai di dua kelas pada 2024 dan kini berjalan di seluruh kelas. Perpustakaan menyediakan kotak buku bergilir yang diganti setiap dua pekan. Guru tidak meminta ringkasan; satu-satunya catatan adalah daftar judul yang dipinjam, dipakai untuk menambah koleksi yang paling sering dicari.',
    [['Waktu', '07.15–07.30'], ['Hari', 'Senin–Jumat'], ['Penanggung jawab', 'Wali kelas'], ['Mulai', 'Tahun 2024']]],
  ['Projek Penguatan Profil Pelajar Pancasila', 'Kurikuler', 'Kelas IV–VI', '2 JP/pekan', 'var(--sekolah-aksen-tengah),var(--sekolah-aksen-ujung)',
    'Satu tema besar per semester, dikerjakan berkelompok lintas mata pelajaran.',
    'Tema semester ganjil adalah Gaya Hidup Berkelanjutan, dijalankan lewat kebun sekolah dan bank sampah. Semester genap mengangkat Kearifan Lokal, berupa pengumpulan cerita rakyat dan permainan tradisional dari orang tua murid. Hasilnya dipamerkan pada pekan projek.',
    [['Tema per tahun', '2 tema'], ['Bentuk', 'Kerja kelompok'], ['Pameran', 'Akhir semester'], ['Koordinator', 'Ahmad Zulkarnain, S.Pd.']]],
  ['Literasi digital', 'Kurikuler', 'Kelas IV–VI', '1 JP/pekan', '#6ab8f0,#8fd8ec',
    'Mengetik, menyimpan berkas, dan mencari informasi dengan pendampingan guru.',
    'Setiap kelas memperoleh satu jam pemakaian ruang komputer per pekan sejak enam belas unit baru dipasang pada Oktober 2025. Materi disusun bertahap: mengetik sepuluh jari di kelas empat, menyusun dokumen sederhana di kelas lima, dan mencari informasi secara aman di kelas enam.',
    [['Ruang', 'Ruang komputer'], ['Unit', '16 komputer'], ['Rasio', '2 murid per unit'], ['Pengampu', 'Dedi Kurniawan, S.Pd.']]],
  ['Kebun kelas dan bank sampah', 'Kebiasaan', 'Kelas IV–VI', 'Harian', '#7bbf6a,#b6e8a0',
    'Setiap kelas merawat satu petak sayur dan memilah sampahnya sendiri.',
    'Sembilan petak dibagi per kelas sejak awal tahun ajaran, masing-masing dirawat empat murid yang bergilir tiap pekan. Catatan pemakaian air dan hasil panen ditulis tangan lalu direkap tiap akhir bulan. Program ini menjadi dasar penilaian Adiwiyata nasional 2026.',
    [['Petak', '9 petak'], ['Panen', 'Dua kali setahun'], ['Catatan', 'Direkap bulanan'], ['Pendamping', 'Dedi Kurniawan, S.Pd.']]],
  ['Tahfiz juz 30', 'Keagamaan', 'Kelas III–VI', '1 JP/pekan', 'var(--sekolah-aksen-pekat),#9fb6f8',
    'Setoran hafalan bertahap dan salat Zuhur berjamaah bergilir antar kelas.',
    'Setoran dilakukan sepekan sekali kepada guru pendidikan agama, dengan target satu surah pendek per bulan. Murid yang menonjol diarahkan ke ekstrakurikuler tilawah, yang pada 2026 menghasilkan dua juara MTQ tingkat kabupaten.',
    [['Target', '1 surah per bulan'], ['Setoran', 'Sepekan sekali'], ['Salat', 'Zuhur bergilir'], ['Pengampu', 'Ratna Dewi, S.Pd.SD']]],
  ['Pendampingan belajar', 'Kebiasaan', 'Kelas I–III', '2 sore/pekan', 'var(--sekolah-aksen-ujung),var(--sekolah-aksen-hangat)',
    'Kelas tambahan gratis untuk murid yang belum lancar membaca dan berhitung.',
    'Wali kelas mendata murid yang perlu pendampingan pada akhir bulan pertama tiap semester. Kelompok berisi paling banyak enam murid, bertemu dua sore setiap pekan sampai capaian dasarnya terpenuhi. Orang tua menerima catatan kemajuan setiap bulan.',
    [['Ukuran kelompok', 'Maks. 6 murid'], ['Jadwal', 'Selasa & Kamis'], ['Biaya', 'Tidak ada'], ['Laporan', 'Bulanan ke orang tua']]],
];

const JAM = [
  ['Bahasa Indonesia', 7], ['Matematika', 6], ['IPAS', 5], ['Pendidikan Pancasila', 4],
  ['Pendidikan Agama', 4], ['Seni dan Budaya', 3], ['PJOK', 3], ['Bahasa Inggris', 2], ['Muatan lokal', 2],
];
const MAX_JP = 7;

const URUTAN = [
  ['07.15', 'Membaca pagi', 'Murid masuk kelas, mengambil buku dari kotak bergilir, dan membaca sendiri selama lima belas menit.'],
  ['07.30', 'Pelajaran pertama', 'Dua jam pelajaran pertama diisi mata pelajaran inti: Bahasa Indonesia atau Matematika.'],
  ['09.30', 'Istirahat pertama', 'Dua puluh menit di halaman atau kantin. Anggota dokter kecil bertugas bergilir di ruang UKS.'],
  ['09.50', 'Pelajaran kedua', 'IPAS, Pendidikan Pancasila, atau jam projek untuk kelas empat sampai enam.'],
  ['11.30', 'Salat Zuhur berjamaah', 'Kelas bergiliran ke musala, didampingi wali kelas masing-masing.'],
  ['12.00', 'Istirahat kedua dan makan bekal', 'Murid makan bekal di kelas atau kantin, lalu merapikan meja sebelum jam terakhir.'],
  ['12.30', 'Jam terakhir dan piket', 'Pelajaran terakhir ditutup dengan piket kelas dan penyiraman petak kebun, pulang pukul 13.00.'],
];
const URUTAN_GRAD = ['var(--sekolah-aksen),var(--sekolah-aksen-tengah)', 'var(--sekolah-aksen-tengah),var(--sekolah-aksen-ujung)', 'var(--sekolah-aksen-tengah-2),var(--sekolah-aksen-ujung)', 'var(--sekolah-aksen-ujung),var(--sekolah-aksen-hangat)', 'var(--sekolah-aksen-pekat),#9fb6f8', '#6ab8f0,#8fd8ec', '#7bbf6a,#b6e8a0'];

const ProgramPage = () => {
  const [idx, setIdx] = useState(-1);

  useSdnbMotion([]);

  const geser = useCallback((dir) => setIdx((n) => (n + dir + P.length) % P.length), []);

  useEffect(() => {
    const onKey = (e) => {
      if (idx < 0) return;
      if (e.key === 'Escape') setIdx(-1);
      if (e.key === 'ArrowRight') geser(1);
      if (e.key === 'ArrowLeft') geser(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx, geser]);

  const d = idx >= 0 ? P[idx] : null;

  const vals = {
    bebanTampil: true,
    gridProgram: 'margin-top:26px;display:grid;grid-template-columns:repeat(3,1fr);gap:22px',

    pintas: P.map((p) => ({
      label: p[0],
      href: '#program',
      style: 'display:inline-flex;align-items:center;padding:10px 16px;border-radius:999px;font-size:12.5px;font-weight:700;color:#3d4166;background:rgba(255,255,255,.68);border:1px solid rgba(255,255,255,.95);box-shadow:0 10px 24px -14px rgba(60,70,120,.6)',
    })),

    angka: [
      { n: 6, suf: '', label: 'program berjalan' },
      { n: 36, suf: ' JP', label: 'jam pelajaran per pekan' },
      { n: 2, suf: '', label: 'tema projek per tahun' },
      { n: 624, suf: '', label: 'murid terlibat' },
    ].map((a, i) => ({ ...a, box: `padding:26px 28px;border-right:${i === 3 ? 'none' : '1px solid rgba(120,132,200,.24)'}` })),

    program: P.map((p, i) => ({
      nama: p[0], jenis: p[1], kelas: p[2], waktu: p[3], ringkas: p[5],
      no: String(i + 1).padStart(2, '0'),
      open: () => setIdx(i),
      card: 'position:relative;overflow:hidden;cursor:pointer;min-height:320px;border-radius:28px;border:1px solid rgba(255,255,255,.5);box-shadow:0 30px 64px -26px rgba(55,65,120,.55)',
      fill: `position:absolute;inset:0;background:linear-gradient(145deg,${p[4]})`,
    })),

    urutan: URUTAN.map(([jam, judul, teks], i) => ({
      jam, judul, teks,
      bulat: `width:74px;height:44px;border-radius:999px;font-size:13.5px;letter-spacing:-.01em;font-variant-numeric:tabular-nums;background:linear-gradient(140deg,${URUTAN_GRAD[i]})`,
    })),

    jam: JAM.map(([mapel, jp]) => ({
      mapel,
      jp: `${jp} JP`,
      bar: `height:100%;width:${Math.round((jp / MAX_JP) * 100)}%;border-radius:99px;background:linear-gradient(90deg,var(--sekolah-aksen),var(--sekolah-aksen-ujung))`,
    })),

    detilAda: idx >= 0,
    detil: d ? {
      nama: d[0], jenis: d[1], cerita: d[6],
      meta: d[7].map(([k, v]) => ({ k, v })),
      hero: `position:relative;height:236px;overflow:hidden;background:linear-gradient(145deg,${d[4]})`,
    } : { nama: '', jenis: '', cerita: '', meta: [], hero: '' },
    sebelum: () => geser(-1),
    sesudah: () => geser(1),
    tutup: () => setIdx(-1),
    stop: (e) => e.stopPropagation(),
  };

  return (
    <div className="sdnb-program">
      <Helmet>
        <title>Program — Sekolah Dasar Negeri Baturaja</title>
        <meta name="description" content="Program pembelajaran, ritme satu hari di sekolah, dan beban jam pelajaran per pekan." />
      </Helmet>
      {ProgramBody(vals)}
    </div>
  );
};

export default ProgramPage;
