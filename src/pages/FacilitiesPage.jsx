import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import FasilitasBody from '@/components/sdnb/generated/FasilitasBody';
import { fetchWebsiteContentMap } from '@/lib/publicContentAdapters';
import useSdnbMotion from '@/hooks/useSdnbMotion';
import '@/styles/sdnb.css';

/**
 * Fasilitas — markup generated verbatim from `Fasilitas.dc.html` by
 * tools/dc-convert.mjs. This file reproduces the mockup's logic class: the
 * auto-advancing tour (`jalan`), the active room stage, the chip strip, the
 * progress bar, keyboard arrows, and the mosaic.
 *
 * Backend fill-in: when the CMS has `facilities` entries their name and photo
 * replace the mockup's placeholders for the matching slot; every layout span,
 * category and metadata block stays exactly as designed.
 */

const F = [
  ['Ruang kelas', 'Belajar', '12 ruang, @56 m²', 'var(--sekolah-aksen),var(--sekolah-aksen-tengah)',
    'Dua belas ruang untuk delapan belas rombongan belajar, dipakai bergiliran pagi dan siang. Setiap ruang memuat 28 murid dengan meja tunggal, papan tulis putih, dan rak buku kelas.',
    'Dipakai bergilir pagi dan siang',
    [['Kapasitas', '28 murid'], ['Cahaya', 'Jendela dua sisi'], ['Papan', 'Putih magnetik'], ['Diperiksa', 'Awal bulan']], 2, 2],
  ['Perpustakaan', 'Penunjang', '96 m²', 'var(--sekolah-aksen-tengah),var(--sekolah-aksen-ujung)',
    'Empat ribu judul buku anak, dua puluh empat kursi baca, dan kotak buku bergilir untuk tiap kelas yang diganti setiap dua pekan. Buka sampai pukul 14.00 setiap hari sekolah.',
    'Empat ribu judul buku anak',
    [['Koleksi', '4.000 judul'], ['Kursi baca', '24 kursi'], ['Jam buka', '07.30–14.00'], ['Petugas', 'Lestari Ningsih']], 2, 1],
  ['Ruang komputer', 'Penunjang', '64 m²', '#6ab8f0,#8fd8ec',
    'Enam belas unit komputer dan jaringan internet, dipakai kelas empat sampai enam masing-masing satu jam per pekan untuk kelas literasi digital.',
    'Enam belas unit, satu jam per kelas',
    [['Unit', '16 komputer'], ['Jaringan', '50 Mbps'], ['Pemakaian', '1 jam per kelas'], ['Pengampu', 'Ahmad Zulkarnain']], 1, 1],
  ['Musala', 'Ibadah', '72 m²', '#5fb8a0,#8fe0c0',
    'Tempat salat Zuhur berjamaah bergantian antar kelas sebelum pulang, dilengkapi tempat wudu terpisah putra dan putri serta rak mukena.',
    'Salat Zuhur berjamaah bergilir',
    [['Kapasitas', '60 jamaah'], ['Tempat wudu', '12 keran'], ['Jadwal', 'Zuhur bergilir'], ['Pengampu', 'Ratna Dewi']], 1, 1],
  ['Lapangan serbaguna', 'Olahraga', '640 m²', 'var(--sekolah-aksen-ujung),var(--sekolah-aksen-hangat)',
    'Dipakai upacara bendera, senam pagi Jumat, latihan atletik, dan jam istirahat kedua. Permukaan beton dengan garis lapangan bola voli dan kasti.',
    'Upacara, senam, dan atletik',
    [['Luas', '640 m²'], ['Permukaan', 'Beton bergaris'], ['Peneduh', '4 trembesi'], ['Pemakaian', 'Setiap hari']], 2, 1],
  ['Kebun sekolah', 'Lingkungan', '320 m²', '#7bbf6a,#b6e8a0',
    'Petak sayur dibagi per kelas empat sampai enam, masing-masing dirawat empat murid bergilir. Hasil panen dimasak bersama di kantin atau dibagikan ke wali murid.',
    'Sembilan petak sayur per kelas',
    [['Petak', '9 petak kelas'], ['Tanaman', 'Kangkung, bayam'], ['Panen', '2 kali setahun'], ['Pendamping', 'Dedi Kurniawan']], 1, 2],
  ['Ruang UKS', 'Kesehatan', '32 m²', '#f08a8a,#ffc9dc',
    'Dua tempat tidur, kotak obat lengkap, timbangan, dan pengukur tinggi badan. Dijaga bergilir oleh anggota dokter kecil pada jam istirahat.',
    'Dijaga dokter kecil bergilir',
    [['Tempat tidur', '2 unit'], ['Petugas', 'Dokter kecil'], ['Pemeriksaan', 'Tiap semester'], ['Pengampu', 'Lestari Ningsih']], 1, 1],
  ['Kantin sekolah', 'Penunjang', '48 m²', '#ffd08c,#ffe0b3',
    'Empat penjual dengan menu yang diperiksa guru piket setiap pekan. Sejak November 2025 tidak lagi menjual minuman berpemanis.',
    'Tanpa minuman berpemanis',
    [['Penjual', '4 penjual'], ['Menu', 'Diperiksa mingguan'], ['Kursi', '40 kursi'], ['Aturan', 'Tanpa gula tambahan']], 1, 1],
  ['Ruang guru', 'Kantor', '80 m²', 'var(--sekolah-aksen-tengah),#c8a4f0',
    'Meja untuk dua puluh empat guru, ruang rapat kecil, dan lemari arsip kelas. Pertemuan wali murid bulanan diadakan di ruang kelas masing-masing, bukan di sini.',
    'Dua puluh empat meja guru',
    [['Meja', '24 meja'], ['Rapat', '1 ruang kecil'], ['Arsip', 'Per rombel'], ['Jam', '07.00–15.30']], 1, 1],
  ['Ruang tata usaha', 'Kantor', '40 m²', 'var(--sekolah-aksen),#b4b8f8',
    'Layanan surat, pendaftaran murid baru, dan legalisir dokumen. Antrean maksimal enam orang dengan kursi tunggu di teras depan.',
    'Layanan surat dan PPDB',
    [['Layanan', 'Surat & PPDB'], ['Jam', '07.30–15.00'], ['Petugas', '3 orang'], ['Kursi tunggu', '6 kursi']], 2, 1],
];

const TOUR_MS = 6000;

// Span mosaik & gradien fallback, dipilih otomatis dari urutan ruang.
const SPAN = [[2, 2], [2, 1], [1, 1], [1, 1], [2, 1], [1, 2], [1, 1], [1, 1], [1, 1], [2, 1]];
const GRAD = [
  'var(--sekolah-aksen),var(--sekolah-aksen-tengah)', 'var(--sekolah-aksen-tengah),var(--sekolah-aksen-ujung)',
  '#6ab8f0,#8fd8ec', '#5fb8a0,#8fe0c0', 'var(--sekolah-aksen-ujung),var(--sekolah-aksen-hangat)',
  '#7bbf6a,#b6e8a0', '#f08a8a,#ffc9dc', '#ffd08c,#ffe0b3', 'var(--sekolah-aksen-tengah),#c8a4f0', 'var(--sekolah-aksen),#b4b8f8',
];

const FacilitiesPage = () => {
  const [aktif, setAktif] = useState(0);
  const [jalan, setJalan] = useState(true);
  const [cms, setCms] = useState([]);

  useSdnbMotion([]);

  useEffect(() => {
    let mounted = true;
    fetchWebsiteContentMap({ keys: ['facilities'], publicOnly: true })
      .then((map) => { if (mounted && Array.isArray(map.facilities)) setCms(map.facilities); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Ruang dari CMS bila ada (jumlah bebas), jika kosong pakai contoh bawaan F.
  const source = useMemo(() => {
    if (Array.isArray(cms) && cms.length > 0) {
      return cms.map((r, k) => ({
        nama: r.name || r.nama || `Ruang ${k + 1}`,
        kategori: r.kategori || 'Penunjang',
        luas: r.luas || '',
        cerita: r.description || r.cerita || '',
        ringkas: r.ringkas || '',
        meta: Array.isArray(r.meta) ? r.meta : [],
        url: r.image_url || r.url || '',
        grad: GRAD[k % GRAD.length],
        col: SPAN[k % SPAN.length][0],
        row: SPAN[k % SPAN.length][1],
      }));
    }
    return F.map((f) => ({
      nama: f[0], kategori: f[1], luas: f[2], cerita: f[4], ringkas: f[5],
      meta: (f[6] || []).map(([label, value]) => ({ label, value })),
      url: '', grad: f[3], col: f[7], row: f[8],
    }));
  }, [cms]);

  const n = source.length || 1;

  // auto tour
  useEffect(() => {
    const id = setInterval(() => {
      if (jalan) setAktif((s) => (s + 1) % n);
    }, TOUR_MS);
    return () => clearInterval(id);
  }, [jalan, n]);

  const geser = useCallback((dir) => {
    setAktif((s) => (s + dir + n) % n);
    setJalan(false);
  }, [n]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') geser(1);
      if (e.key === 'ArrowLeft') geser(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [geser]);

  const pilih = (k) => { setAktif(k); setJalan(false); };

  // Isi latar satu ruang: gambar bila ada url, jika tidak gradien berlapis.
  const foto = (s) => {
    if (s.url) return `background-image:url("${s.url}");background-size:cover;background-position:center`;
    const c = String(s.grad || '').split(',');
    return `background-image:radial-gradient(62% 120% at 76% 14%,${c[1]} 0%,rgba(255,255,255,0) 62%),`
      + `radial-gradient(52% 104% at 18% 92%,${c[0]} 0%,rgba(255,255,255,0) 58%),`
      + `linear-gradient(122deg,${c[0]} 0%,${c[1]} 54%,${c[0]} 100%)`;
  };

  const i = Math.min(aktif, n - 1);
  const a = source[i] || { nama: '', kategori: '', luas: '', cerita: '', meta: [] };

  const vals = {
    panggung: source.map((s, k) => ({ on: k === i ? '1' : '0', foto: foto(s) })),

    sorot: {
      nama: a.nama, kategori: a.kategori, luas: a.luas, cerita: a.cerita,
      posisi: `${i + 1} dari ${source.length}`,
      meta: (a.meta || []).map((m) => ({ k: m.label, v: m.value })),
    },

    progres: `height:100%;width:${Math.round(((i + 1) / n) * 100)}%;background:linear-gradient(90deg,#7d8bff,var(--sekolah-aksen-ujung));transition:width .6s cubic-bezier(.22,.9,.28,1)`,

    jalanDot: jalan ? '#8ee0b8' : '#f0b48c',
    jalanTeks: jalan ? 'Tur berjalan otomatis' : 'Tur dijeda',
    jalanLabel: jalan ? 'Jeda' : 'Lanjut',
    tglJalan: () => setJalan((v) => !v),
    maju: () => geser(1),
    mundur: () => geser(-1),

    chip: source.map((s, k) => ({
      nama: s.nama,
      on: k === i ? '1' : '0',
      foto: foto(s),
      pick: () => pilih(k),
    })),

    ringkas: [
      { n: 4200, suf: ' m²', label: 'Luas lahan' },
      { n: 12, suf: '', label: 'Ruang kelas' },
      { n: 10, suf: '', label: 'Ruang penunjang' },
      { n: 24, suf: '', label: 'Guru dan staf' },
    ].map((r, k) => ({ ...r, box: `padding:28px 28px 28px ${k === 0 ? '0' : '28px'};border-right:${k === 3 ? 'none' : '1px solid rgba(255,255,255,.16)'}` })),

    mozaik: source.map((s, k) => ({
      nama: s.nama, kategori: s.kategori, luas: s.luas, ringkas: s.ringkas,
      foto: foto(s),
      pick: () => pilih(k),
      cell: `grid-column:span ${s.col};grid-row:span ${s.row};border-radius:24px;border:1px solid rgba(255,255,255,.16);box-shadow:0 30px 64px -26px rgba(6,10,42,.9)`,
    })),
  };

  return (
    <div className="sdnb-fasilitas">
      <Helmet>
        <title>Fasilitas — Sekolah Dasar Negeri Baturaja</title>
        <meta name="description" content="Ruang kelas, perpustakaan, musala, lapangan, kebun sekolah, dan fasilitas penunjang lainnya." />
      </Helmet>
      {FasilitasBody(vals)}
    </div>
  );
};

export default FacilitiesPage;
