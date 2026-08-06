import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import PrestasiBody from '@/components/sdnb/generated/PrestasiBody';
import useSdnbMotion from '@/hooks/useSdnbMotion';
import '@/styles/sdnb.css';

/**
 * Prestasi — markup generated verbatim from `Prestasi.dc.html` by
 * tools/dc-convert.mjs. This file reproduces the mockup's logic class: the
 * level filter (`tingkat`), the record list, the per-year and per-field charts,
 * the podium, and the detail modal with keyboard navigation.
 */

const P = [
  ['2026', 'Adiwiyata Sekolah Berbudaya Lingkungan', 'Nasional', 'Juara', 'Seluruh warga sekolah', 'Lingkungan',
    'Penilaian berlangsung dua hari, meninjau kebun sekolah, bank sampah, dan catatan pemakaian air setiap kelas. Penghargaan diserahkan di Palembang pada akhir Mei 2026.',
    [['Penyelenggara', 'Kementerian LHK'], ['Lokasi', 'Palembang'], ['Peserta', '212 sekolah'], ['Pendamping', 'Dedi Kurniawan, S.Pd.']]],
  ['2026', 'MTQ Pelajar cabang tilawah putra', 'Kabupaten', 'Juara 1', 'Rafi Alfarizi, kelas VI A', 'Keagamaan',
    'Latihan berjalan tiga bulan setiap Selasa dan Kamis sore bersama guru pendidikan agama dan seorang qari dari masjid dekat sekolah.',
    [['Penyelenggara', 'Kemenag OKU'], ['Lokasi', 'Baturaja'], ['Peserta', '48 peserta'], ['Pendamping', 'Ratna Dewi, S.Pd.SD']]],
  ['2026', 'MTQ Pelajar cabang tilawah putri', 'Kabupaten', 'Juara 1', 'Nayla Syakira, kelas VI B', 'Keagamaan',
    'Mewakili kabupaten pada seleksi tingkat provinsi Agustus 2026. Sekolah menyediakan waktu latihan tambahan tanpa mengurangi jam pelajaran.',
    [['Penyelenggara', 'Kemenag OKU'], ['Lokasi', 'Baturaja'], ['Peserta', '52 peserta'], ['Pendamping', 'Ratna Dewi, S.Pd.SD']]],
  ['2025', 'O2SN cabang atletik lari 60 meter', 'Provinsi', 'Juara 3', 'Bagas Pratama, kelas V A', 'Olahraga',
    'Berangkat setelah menjuarai seleksi kecamatan dan kabupaten. Latihan pagi dijalankan tiga kali sepekan di lapangan sekolah.',
    [['Penyelenggara', 'Dinas Pendidikan'], ['Lokasi', 'Palembang'], ['Peserta', '17 kabupaten'], ['Pendamping', 'Hendra Wijaya, S.Pd.']]],
  ['2025', 'Festival Tari Daerah tingkat kabupaten', 'Kabupaten', 'Juara 2', 'Sanggar tari, 8 murid', 'Seni',
    'Membawakan Gending Sriwijaya dengan kostum yang dijahit bersama orang tua murid. Tampil kembali pada pentas seni sekolah Desember 2025.',
    [['Penyelenggara', 'Disdikbud OKU'], ['Lokasi', 'Baturaja'], ['Peserta', '24 sekolah'], ['Pendamping', 'Yuliana Sari, S.Pd.SD']]],
  ['2025', 'Lomba Cerdas Cermat SD se-kecamatan', 'Kecamatan', 'Juara 1', 'Tim kelas VI, 3 murid', 'Akademik',
    'Babak final berlangsung tiga putaran dengan materi matematika, IPA, dan pengetahuan umum.',
    [['Penyelenggara', 'UPTD Kecamatan'], ['Lokasi', 'Baturaja Timur'], ['Peserta', '19 sekolah'], ['Pendamping', 'Ahmad Zulkarnain, S.Pd.']]],
  ['2024', 'Jambore Pramuka Penggalang', 'Kabupaten', 'Regu terbaik', 'Regu Rajawali, 8 murid', 'Kepramukaan',
    'Penilaian mencakup pendirian tenda, sandi morse, pertolongan pertama, dan kebersihan area perkemahan selama tiga hari.',
    [['Penyelenggara', 'Kwarcab OKU'], ['Lokasi', 'Bumi perkemahan OKU'], ['Peserta', '36 regu'], ['Pendamping', 'Hendra Wijaya, S.Pd.']]],
  ['2024', 'Olimpiade Matematika SD tingkat kabupaten', 'Kabupaten', 'Juara 3', 'Kirana Maheswari, kelas V B', 'Akademik',
    'Persiapan dilakukan lewat kelas tambahan setiap Sabtu pagi selama satu semester.',
    [['Penyelenggara', 'Disdikbud OKU'], ['Lokasi', 'Baturaja'], ['Peserta', '96 murid'], ['Pendamping', 'Dedi Kurniawan, S.Pd.']]],
  ['2023', 'Akreditasi sekolah', 'Nasional', 'Nilai 96,4', 'Seluruh warga sekolah', 'Akademik',
    'Peringkat A diperoleh kembali dengan nilai 96,4 pada visitasi BAN-S/M, naik dari 91,2 pada periode sebelumnya.',
    [['Penyelenggara', 'BAN-S/M'], ['Lokasi', 'SDN Baturaja'], ['Aspek dinilai', '8 standar'], ['Pendamping', 'Hj. Rosmiati, S.Pd.']]],
  ['2023', 'Lomba Kebersihan Sekolah', 'Kecamatan', 'Juara 1', 'Seluruh warga sekolah', 'Lingkungan',
    'Penilaian mencakup pengelolaan sampah, kondisi toilet, dan perawatan taman kelas selama satu bulan pengamatan.',
    [['Penyelenggara', 'UPTD Kecamatan'], ['Lokasi', 'Baturaja Timur'], ['Peserta', '19 sekolah'], ['Pendamping', 'Lestari Ningsih, A.Md.']]],
  ['2022', 'Festival Mendongeng Anak', 'Kabupaten', 'Juara 2', 'Alika Rahma, kelas IV A', 'Seni',
    'Membawakan cerita rakyat Sumatera Selatan tanpa teks selama tujuh menit.',
    [['Penyelenggara', 'Perpustakaan Daerah'], ['Lokasi', 'Baturaja'], ['Peserta', '31 murid'], ['Pendamping', 'Siti Aminah, S.Pd.SD']]],
  ['2021', 'Lomba Poster Hemat Energi', 'Provinsi', 'Juara harapan', 'Fauzan Ramadhan, kelas VI A', 'Seni',
    'Karya dikirim secara daring pada masa pembelajaran jarak jauh dan dipamerkan di kantor dinas provinsi.',
    [['Penyelenggara', 'Dinas ESDM'], ['Lokasi', 'Daring'], ['Peserta', '240 karya'], ['Pendamping', 'Yuliana Sari, S.Pd.SD']]],
  ['2019', 'Gerak Jalan Indah HUT RI', 'Kecamatan', 'Juara 1', 'Regu putri, 20 murid', 'Olahraga',
    'Latihan berlangsung dua pekan setiap sore di jalan depan sekolah bersama guru penjas dan pembina pramuka.',
    [['Penyelenggara', 'Panitia HUT RI'], ['Lokasi', 'Baturaja Timur'], ['Peserta', '28 regu'], ['Pendamping', 'Hendra Wijaya, S.Pd.']]],
];

const TINGKAT = ['Semua', 'Nasional', 'Provinsi', 'Kabupaten', 'Kecamatan'];

const warna = (t) => (t === 'Nasional' ? '#6470ff,#8a6cf0' : t === 'Provinsi' ? '#7a6cf5,#c07ad8' : t === 'Kabupaten' ? '#a86ce8,#e58fc4' : '#e0839a,#f0a06c');

const foto = (p) => {
  const B = {
    Lingkungan: ['#7bbf6a', '#b6e8a0', '#5fb8a0'],
    Keagamaan: ['#5b6cff', '#9fb6f8', '#c6b6f6'],
    Olahraga: ['#e0839a', '#f0a06c', '#ffd08c'],
    Seni: ['#a86ce8', '#e58fc4', '#f6c6e8'],
    Akademik: ['#6470ff', '#8fd8ec', '#b4b8f8'],
    Kepramukaan: ['#6ab8f0', '#8fe0c0', '#a9eede'],
  };
  const c = B[p[5]] || B.Akademik;
  return `radial-gradient(58% 120% at 78% 18%,${c[1]} 0%,rgba(255,255,255,0) 62%),`
    + `radial-gradient(46% 100% at 24% 88%,${c[2]} 0%,rgba(255,255,255,0) 58%),`
    + `linear-gradient(118deg,${c[0]} 0%,${c[1]} 52%,${c[2]} 100%)`;
};

const TAHUN_UNIK = ['2019', '2021', '2022', '2023', '2024', '2025', '2026'];
const BIDANG_NAMA = ['Akademik', 'Seni', 'Olahraga', 'Keagamaan', 'Lingkungan', 'Kepramukaan'];

const PrestasiPage = () => {
  const [tingkat, setTingkat] = useState('Semua');
  const [idx, setIdx] = useState(-1);

  useSdnbMotion([]);

  const items = useMemo(
    () => P.map((p, i) => ({ p, i })).filter((o) => tingkat === 'Semua' || o.p[2] === tingkat),
    [tingkat],
  );

  const geser = useCallback((dir) => {
    setIdx((current) => {
      const at = items.findIndex((o) => o.i === current);
      if (at === -1 || items.length === 0) return current;
      return items[(at + dir + items.length) % items.length].i;
    });
  }, [items]);

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

  const perTahun = TAHUN_UNIK.map((th) => ({ th, n: P.filter((p) => p[0] === th).length }));
  const maxTahun = Math.max(...perTahun.map((x) => x.n));
  const perBidang = BIDANG_NAMA.map((b) => ({ nama: b, n: P.filter((p) => p[5] === b).length }));
  const maxBidang = Math.max(...perBidang.map((x) => x.n));
  const d = idx >= 0 ? P[idx] : null;

  const vals = {
    stat: [
      { n: 4, suf: '', label: 'Tingkat nasional' },
      { n: 3, suf: '', label: 'Tingkat provinsi' },
      { n: 27, suf: '', label: 'Murid terlibat' },
      { n: 8, suf: '', label: 'Tahun berturut' },
    ].map((s, i) => ({ ...s, box: `padding:26px 24px 26px ${i === 0 ? '0' : '24px'};border-right:${i === 3 ? 'none' : '1px solid rgba(255,255,255,.16)'}` })),

    grafikTampil: true,
    jumlah: `${items.length} dari ${P.length} catatan`,

    tingkatOpsi: TINGKAT.map((t) => {
      const on = tingkat === t;
      return {
        label: t,
        pick: () => { setTingkat(t); setIdx(-1); },
        style: `position:relative;padding:10px 0 12px;border:0;background:transparent;cursor:pointer;font-family:inherit;font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;transition:color .3s ease;color:${on ? '#21243f' : '#8a8ea8'}`,
        rule: `position:absolute;left:0;right:0;bottom:0;height:3px;transition:transform .35s cubic-bezier(.22,.9,.28,1),opacity .3s ease;transform-origin:left;transform:scaleX(${on ? '1' : '0'});opacity:${on ? '1' : '0'};background:linear-gradient(90deg,#5b6cff,#f0779f)`,
      };
    }),

    daftar: items.map(({ p, i }) => ({
      tahun: p[0], judul: p[1], tingkat: p[2], peringkat: p[3], oleh: p[4],
      open: () => setIdx(i),
      foto: `background-image:${foto(p)}`,
      medali: `justify-self:start;padding:8px 14px;border-radius:999px;font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#fff;background:linear-gradient(135deg,${warna(p[2])});box-shadow:0 12px 26px -14px rgba(90,100,200,.9)`,
    })),

    grafik: perTahun.map((x) => ({
      th: x.th, n: x.n,
      bar: `width:100%;height:${Math.max(10, Math.round((x.n / maxTahun) * 118))}px;border-radius:8px 8px 3px 3px;background:linear-gradient(180deg,#6470ff,#a06cf0)`,
    })),

    bidang: perBidang.map((x) => ({
      nama: x.nama, n: x.n,
      track: 'width:92px;height:6px;border-radius:99px;background:rgba(120,132,200,.2);overflow:hidden;display:inline-block',
      fill: `display:block;height:100%;width:${Math.round((x.n / maxBidang) * 100)}%;border-radius:99px;background:linear-gradient(90deg,#6470ff,#e58fc4)`,
    })),

    podium: [0, 1, 3].map((src, k) => {
      const p = P[src];
      const tinggi = [300, 262, 234][k];
      return {
        no: `0${k + 1}`, judul: p[1], oleh: p[4], tahun: p[0], tingkat: p[2], peringkat: p[3],
        open: () => setIdx(src),
        card: `position:relative;overflow:hidden;cursor:pointer;min-height:${tinggi}px;padding:30px 30px 28px;border-radius:28px;background:linear-gradient(150deg,${warna(p[2])});border:1px solid rgba(255,255,255,.28);box-shadow:0 34px 74px -28px rgba(60,70,160,.7)`,
      };
    }),

    detilAda: idx >= 0,
    detil: d ? {
      tahun: d[0], judul: d[1], tingkat: d[2], peringkat: d[3], cerita: d[6],
      meta: d[7].map(([k, v]) => ({ k, v })),
      top: `position:relative;overflow:hidden;padding:34px 34px 30px;background:linear-gradient(150deg,${warna(d[2])})`,
    } : { tahun: '', judul: '', tingkat: '', peringkat: '', cerita: '', meta: [], top: '' },
    sebelum: () => geser(-1),
    sesudah: () => geser(1),
    tutup: () => setIdx(-1),
    stop: (e) => e.stopPropagation(),
  };

  return (
    <div className="sdnb-prestasi">
      <Helmet>
        <title>Prestasi — Sekolah Dasar Negeri Baturaja</title>
        <meta name="description" content="Catatan prestasi murid dan sekolah dari tingkat kecamatan sampai nasional." />
      </Helmet>
      {PrestasiBody(vals)}
    </div>
  );
};

export default PrestasiPage;
