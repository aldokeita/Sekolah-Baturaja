import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import BeritaBody from '@/components/sdnb/generated/BeritaBody';
import { fetchPublishedNews } from '@/lib/publicContentAdapters';
import useSdnbMotion from '@/hooks/useSdnbMotion';
import '@/styles/sdnb.css';

/**
 * Berita — markup generated verbatim from `Berita.dc.html` by
 * tools/dc-convert.mjs. This file reproduces the mockup's logic class: the
 * headline ticker, category filter + search, the featured lead/secondary
 * layout, the list, the agenda and archive rails, and the built-in article
 * reader with keyboard navigation.
 *
 * Backend fill-in: published news from the CMS is prepended to the list using
 * the same card shape, so the admin dashboard drives this page while the
 * mockup's own articles remain as the default content.
 */

const N_MOCKUP = [
  ['Sekolah meraih Adiwiyata tingkat nasional', 'Prestasi', '12 Mei 2026', 6,
    'Penilaian tim kementerian berlangsung dua hari, meninjau kebun sekolah, bank sampah, dan catatan pemakaian air setiap kelas.',
    ['Tim penilai datang pada Selasa pagi dan langsung menuju petak kebun di sisi timur halaman. Murid kelas lima yang sedang bertugas menyiram menjelaskan sendiri jadwal perawatan mereka, termasuk cara memisahkan kompos dari sampah plastik.',
      'Penilaian hari kedua difokuskan pada dokumen: catatan pemakaian air per kelas, daftar tanaman, dan laporan bank sampah yang dikelola pengurus kelas enam. Semua catatan ditulis tangan dan direkap setiap akhir bulan oleh guru pendamping.',
      'Penghargaan diserahkan di Palembang pada akhir Mei. Kepala sekolah menyampaikan bahwa program ini akan diperluas ke kelas satu sampai tiga dengan bentuk yang lebih sederhana, yaitu memilah sampah di dalam kelas masing-masing.'],
    'linear-gradient(150deg,#b6f0c8,#8fe0c0 55%,#9fc4f8)', 'Hj. Rosmiati, S.Pd.', 'Kepala Sekolah'],
  ['Pendaftaran murid baru 2026/2027 dibuka 3 Juni', 'PPDB', '28 Mei 2026', 4,
    'Kuota 96 murid untuk empat rombongan belajar kelas satu. Pendaftaran dilakukan daring maupun langsung di ruang tata usaha.',
    ['Berkas yang perlu disiapkan adalah kartu keluarga, akta kelahiran, dan satu lembar foto terbaru. Calon murid berusia paling rendah enam tahun pada 1 Juli 2026.',
      'Tata usaha membuka layanan setiap hari kerja pukul 07.30 sampai 15.00. Bagi orang tua yang mendaftar daring, formulir dapat diisi lewat halaman PPDB dan berkas diunggah pada langkah terakhir.',
      'Pengumuman hasil seleksi zonasi dijadwalkan pada 20 Juni, disusul daftar ulang sampai 27 Juni.'],
    'linear-gradient(150deg,#c6b6f6,#9fc4f8)', 'Lestari Ningsih, A.Md.', 'Tata Usaha'],
  ['Dua murid kelas VI juara MTQ kabupaten', 'Prestasi', '14 Maret 2026', 3,
    'Cabang tilawah putra dan putri, masing-masing meraih peringkat pertama pada seleksi tingkat Kabupaten Ogan Komering Ulu.',
    ['Latihan berjalan tiga bulan setiap Selasa dan Kamis sore, dibimbing guru pendidikan agama bersama seorang qari dari masjid dekat sekolah.',
      'Keduanya akan mewakili kabupaten pada seleksi tingkat provinsi bulan Agustus. Sekolah menyediakan waktu latihan tambahan tanpa mengurangi jam pelajaran.'],
    'linear-gradient(150deg,#ffeab3,#ffd08c)', 'Ahmad Zulkarnain, S.Pd.', 'Wakil Kepala Sekolah'],
  ['Waktu membaca pagi kini berjalan di seluruh kelas', 'Kegiatan', '9 Februari 2026', 5,
    'Lima belas menit sebelum pelajaran pertama, setiap murid membaca buku pilihan sendiri tanpa tugas ringkasan.',
    ['Program ini dimulai di dua kelas pada 2024 dan diperluas setelah guru mencatat kemajuan pada murid yang sebelumnya enggan membaca.',
      'Perpustakaan menyediakan kotak buku bergilir untuk tiap kelas, diganti setiap dua pekan. Murid boleh membaca ulang buku yang sama sesering yang mereka mau.',
      'Guru tidak meminta laporan bacaan. Satu-satunya catatan adalah daftar judul yang dipinjam, dipakai pustakawan untuk menambah koleksi yang paling sering dicari.'],
    'linear-gradient(150deg,#bcd6ff,#9fb6f8)', 'Siti Aminah, S.Pd.SD', 'Guru Kelas I'],
  ['Pentas seni tahunan menampilkan 14 kelas', 'Kegiatan', '20 Desember 2025', 4,
    'Tari daerah, drama, dan paduan suara ditampilkan di panggung halaman depan selama satu hari penuh.',
    ['Persiapan berjalan sebulan pada jam ekstrakurikuler. Kostum dibuat bersama orang tua murid, sebagian memakai kain yang dipinjam dari sanggar kota.',
      'Acara ditutup dengan paduan suara gabungan kelas lima dan enam. Hasil penjualan makanan di stan kelas dipakai untuk menambah koleksi buku perpustakaan.'],
    'linear-gradient(150deg,#ffc9dc,#f2a9c8 60%,#c6b6f6)', 'Yuliana Sari, S.Pd.SD', 'Guru Kelas II'],
  ['Kantin sekolah berhenti menjual minuman berpemanis', 'Pengumuman', '5 November 2025', 3,
    'Keputusan diambil setelah rapat guru dan komite sekolah pada akhir Oktober.',
    ['Kantin kini hanya menyediakan air putih, susu tawar, dan jus buah tanpa gula tambahan. Menu makanan diperiksa guru piket setiap pekan.',
      'Murid tetap diperbolehkan membawa bekal dari rumah. Sekolah mengimbau orang tua mengurangi makanan kemasan berpewarna.'],
    'linear-gradient(150deg,#ffd9b3,#f7b7a0)', 'Hendra Wijaya, S.Pd.', 'Guru Penjas'],
  ['Ruang komputer bertambah enam belas unit', 'Fasilitas', '18 Oktober 2025', 3,
    'Bantuan dari pemerintah kabupaten melengkapi kelas literasi digital untuk kelas empat sampai enam.',
    ['Seluruh unit dipasang pada pekan pertama Oktober bersama jaringan internet baru. Setiap kelas memperoleh satu jam pemakaian per pekan.',
      'Guru kelas menyusun materi dasar: mengetik, menyimpan berkas, dan mencari informasi dengan pendampingan.'],
    'linear-gradient(150deg,#d7d2ff,#b4b8f8)', 'Dedi Kurniawan, S.Pd.', 'Guru Kelas IV'],
  ['Jadwal ujian akhir semester ganjil', 'Pengumuman', '2 Oktober 2025', 2,
    'Ujian berlangsung 1 sampai 6 Desember 2025, dua mata pelajaran setiap hari, selesai pukul 11.00.',
    ['Daftar lengkap mata pelajaran per hari dibagikan lewat wali kelas dan ditempel di papan pengumuman depan ruang guru.',
      'Murid diminta datang pukul 07.00. Tidak ada pelajaran tambahan selama pekan ujian.'],
    'linear-gradient(150deg,#c9e8ff,#a5c8f5)', 'Ahmad Zulkarnain, S.Pd.', 'Wakil Kepala Sekolah'],
  ['Kebun sekolah panen pertama tahun ini', 'Kegiatan', '21 September 2025', 3,
    'Kangkung dan bayam dari petak kelas empat dimasak bersama di kantin pada Jumat pagi.',
    ['Petak dibagi per kelas sejak awal tahun ajaran, masing-masing dirawat empat murid yang bergilir setiap pekan.',
      'Hasil panen berikutnya dijadwalkan November, dengan tambahan petak cabai di sisi selatan halaman.'],
    'linear-gradient(150deg,#ffe0b3,#ffc39c 55%,#b6f0e0)', 'Ratna Dewi, S.Pd.SD', 'Guru Kelas VI'],
  ['Perpustakaan buka setiap hari sampai pukul 14.00', 'Fasilitas', '3 September 2025', 2,
    'Jam layanan diperpanjang satu jam agar murid dapat membaca setelah jam pelajaran terakhir.',
    ['Pustakawan mencatat kenaikan peminjaman sejak jam layanan diperpanjang, terutama pada buku cerita bergambar.',
      'Ruang baca menampung dua puluh empat murid sekaligus. Murid kelas satu sampai tiga perlu didampingi wali kelas.'],
    'linear-gradient(150deg,#b6e8f0,#8fd8ec)', 'Lestari Ningsih, A.Md.', 'Pustakawan'],
];

const KAT = ['Semua', 'Pengumuman', 'Kegiatan', 'Prestasi', 'Fasilitas', 'PPDB'];
const CMS_GRADS = ['linear-gradient(150deg,#c4b7f7,#93b8f7)', 'linear-gradient(150deg,#ffc6da,#f6a8c6)', 'linear-gradient(150deg,#b3eee0,#8ed4ea)'];

const fmtDate = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** Map a CMS article onto the mockup's tuple shape so both render identically. */
const cmsToTuple = (item, i) => {
  const body = item.content || item.body || item.isi || '';
  const paragraphs = String(body).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const ringkas = item.excerpt || item.summary || item.ringkasan || paragraphs[0] || '';
  const img = item.image_url || item.cover_image_url;
  return [
    item.title || item.judul || 'Berita sekolah',
    item.category || 'Pengumuman',
    fmtDate(item.date || item.published_at || item.created_at),
    Math.max(1, Math.round(String(body).split(/\s+/).length / 200)) || 2,
    ringkas,
    paragraphs.length ? paragraphs : [ringkas].filter(Boolean),
    img ? `url("${img}") center/cover no-repeat` : CMS_GRADS[i % CMS_GRADS.length],
    item.author || 'Tata Usaha',
    item.author_role || 'Sekolah',
  ];
};

const AGENDA = [
  ['03', 'Jun', 'Pendaftaran murid baru dibuka', '07.30 di ruang tata usaha'],
  ['12', 'Jun', 'Rapat wali murid kelas VI', '09.00 di aula sekolah'],
  ['20', 'Jun', 'Pengumuman hasil seleksi PPDB', 'Papan pengumuman dan daring'],
  ['27', 'Jun', 'Batas akhir daftar ulang', '15.00 di ruang tata usaha'],
  ['13', 'Jul', 'Hari pertama tahun ajaran baru', '07.15 upacara di halaman'],
];
const AGENDA_GRAD = ['#6470ff,#8a6cf0', '#7a6cf5,#c07ad8', '#a86ce8,#e58fc4', '#e0839a,#f0a06c', '#5b6cff,#9fb6f8'];

const NewsPage = () => {
  const [kat, setKat] = useState('Semua');
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(-1);
  const [cmsNews, setCmsNews] = useState([]);

  useSdnbMotion([]);

  useEffect(() => {
    let mounted = true;
    fetchPublishedNews()
      .then((rows) => { if (mounted && Array.isArray(rows) && rows.length) setCmsNews(rows); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Published CMS articles come first, then the mockup's own set.
  const N = useMemo(
    () => [...cmsNews.map(cmsToTuple), ...N_MOCKUP],
    [cmsNews],
  );

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return N.map((n, i) => ({ n, i })).filter((o) => (kat === 'Semua' || o.n[1] === kat)
      && (!query || `${o.n[0]} ${o.n[4]} ${o.n[1]} ${o.n[7]}`.toLowerCase().includes(query)));
  }, [N, kat, q]);

  const move = useCallback((dir) => {
    const l = list.length ? list : N.map((n, i) => ({ n, i }));
    setIdx((current) => {
      const at = l.findIndex((o) => o.i === current);
      return l[(at + dir + l.length) % l.length].i;
    });
  }, [list, N]);

  useEffect(() => {
    const onKey = (e) => {
      if (idx < 0) return;
      if (e.key === 'Escape') setIdx(-1);
      if (e.key === 'ArrowRight') move(1);
      if (e.key === 'ArrowLeft') move(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx, move]);

  const card = (o) => ({
    judul: o.n[0], kat: o.n[1], tanggal: o.n[2], baca: o.n[3], ringkas: o.n[4], penulis: o.n[7],
    open: () => setIdx(o.i),
    fill: `position:absolute;inset:0;background:${o.n[6]}`,
  });

  const polos = kat === 'Semua' && !q.trim();
  const rest = polos ? list.filter((o) => o.i > 2) : list;
  const a = idx >= 0 ? N[idx] : null;
  const pos = idx >= 0 ? `${idx + 1} dari ${N.length}` : '';

  const vals = {
    tickerCls: 'mq-track',
    ticker: [
      'PPDB 2026/2027 dibuka 3 Juni', 'Adiwiyata tingkat nasional diraih Mei 2026',
      'Dua juara MTQ kabupaten dari kelas VI', 'Rapat wali murid kelas VI 12 Juni',
      'Perpustakaan buka sampai pukul 14.00', 'Kantin tanpa minuman berpemanis',
      'PPDB 2026/2027 dibuka 3 Juni', 'Adiwiyata tingkat nasional diraih Mei 2026',
      'Dua juara MTQ kabupaten dari kelas VI', 'Rapat wali murid kelas VI 12 Juni',
      'Perpustakaan buka sampai pukul 14.00', 'Kantin tanpa minuman berpemanis',
    ],

    lead: card({ n: N[0], i: 0 }),
    sekunder: [1, 2].map((i) => card({ n: N[i], i })),

    kategori: KAT.map((k) => {
      const on = kat === k;
      return {
        label: k,
        pick: () => setKat(k),
        style: 'padding:11px 16px;border-radius:14px;cursor:pointer;font-family:inherit;font-size:13.5px;font-weight:700;transition:background .3s ease,color .3s ease,box-shadow .3s ease,transform .3s cubic-bezier(.4,1.3,.4,1);' + (on
          ? 'border:0;color:#fff;background:linear-gradient(135deg,#6470ff,#a06cf0 60%,#e58fc4);box-shadow:0 14px 30px -12px rgba(95,105,235,.95),inset 0 1px 0 rgba(255,255,255,.5);transform:translateY(-1px)'
          : 'border:1px solid rgba(255,255,255,.85);color:#3d4166;background:rgba(255,255,255,.5)'),
      };
    }),
    search: (e) => setQ(e.target.value),
    unggulanTampil: polos,
    hitung: `${rest.length} dari ${N.length} berita`,
    judulDaftar: polos ? 'Semua berita' : 'Hasil pencarian',
    berita: rest.map((o) => card(o)),
    kosong: rest.length === 0,

    agenda: AGENDA.map(([d, m, judul, jam], i) => ({
      d, m, judul, jam,
      chip: `flex:none;width:52px;padding:10px 0;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;color:#fff;background:linear-gradient(140deg,${AGENDA_GRAD[i]});box-shadow:0 12px 26px -12px rgba(90,100,200,.8),inset 0 1px 0 rgba(255,255,255,.5)`,
    })),

    arsip: [
      { bulan: 'Mei 2026', n: 4 }, { bulan: 'April 2026', n: 6 }, { bulan: 'Maret 2026', n: 5 },
      { bulan: 'Februari 2026', n: 7 }, { bulan: 'Januari 2026', n: 3 },
    ],

    bacaOpen: idx >= 0,
    artikel: a ? {
      judul: a[0], kat: a[1], tanggal: a[2], baca: a[3], ringkas: a[4], isi: a[5],
      penulis: a[7], peran: a[8], pos,
      inisial: a[7].split(' ').filter((w) => /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join(''),
      hero: `position:relative;height:296px;overflow:hidden;background:${a[6]}`,
      avatar: 'flex:none;width:42px;height:42px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#fff;background:linear-gradient(140deg,#7d8bff,#c8a4f0 45%,#ffb3d1);box-shadow:inset 0 1px 0 rgba(255,255,255,.8)',
    } : { judul: '', kat: '', tanggal: '', baca: '', ringkas: '', isi: [], penulis: '', peran: '', pos: '', inisial: '', hero: '', avatar: '' },
    prev: () => move(-1),
    next: () => move(1),
    close: () => setIdx(-1),
    stop: (e) => e.stopPropagation(),
  };

  return (
    <div className="sdnb-berita">
      <Helmet>
        <title>Berita — Sekolah Dasar Negeri Baturaja</title>
        <meta name="description" content="Kabar terbaru, pengumuman, prestasi, dan agenda Sekolah Dasar Negeri Baturaja." />
      </Helmet>
      {BeritaBody(vals)}
    </div>
  );
};

export default NewsPage;
