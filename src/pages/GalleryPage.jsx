import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import GaleriBody from '@/components/sdnb/generated/GaleriBody';
import { fetchWebsiteContentMap } from '@/lib/publicContentAdapters';
import { fetchClassCount, fetchSantriCount } from '@/lib/dataMasterAdapters';
import useSchoolIdentity from '@/hooks/useSchoolIdentity';
import useSdnbMotion from '@/hooks/useSdnbMotion';
import { deriveGalleryAlbums, normalizeGalleryAlbums, normalizeGalleryPhotos, resolveGalleryAlbumPhotos, selectGalleryHeroPhotos } from '@/lib/galleryContent';
import '@/styles/sdnb.css';

/**
 * Galeri — the markup is generated verbatim from `Galeri.dc.html` by
 * tools/dc-convert.mjs (see components/sdnb/generated/GaleriBody.jsx). This
 * file reproduces the mockup's logic class: state (`kat`, `view`, `idx`), the
 * category filter, the mosaic/sinema switch, the lightbox with keyboard
 * navigation, and the parallax scroll handler.
 *
 * Backend fill-in: when the CMS has gallery photos they replace the mockup's
 * gradient placeholders (caption + image), keeping every layout span intact.
 */

const FOTO = [
  ['Kelas membaca pagi', 'Belajar', '15 menit sebelum pelajaran dimulai, seluruh kelas membaca buku pilihan sendiri.', 'Agustus 2025', 'linear-gradient(150deg,#c6b6f6,#9fc4f8 60%,#a9eede)', 2, 2],
  ['Praktik sains kelas V', 'Belajar', 'Percobaan penjernihan air memakai kerikil, ijuk, dan arang dari kebun sekolah.', 'September 2025', 'linear-gradient(150deg,#bcd6ff,#9fb6f8)', 1, 1],
  ['Latihan pramuka', 'Ekstrakurikuler', 'Regu penggalang berlatih tali dan sandi setiap Jumat sore di halaman belakang.', 'Oktober 2025', 'linear-gradient(150deg,#bbf7d0,#86efac)', 1, 1],
  ['Pentas seni tahunan', 'Acara', 'Tari daerah, drama kelas, dan paduan suara di panggung halaman depan.', 'Desember 2025', 'linear-gradient(150deg,#ffc9dc,#f2a9c8)', 2, 1],
  ['Panen kebun sekolah', 'Belajar', 'Kangkung dan bayam hasil petak kelas empat, dimasak bersama di kantin.', 'November 2025', 'linear-gradient(150deg,#ffe0b3,#ffc39c 55%,#b6f0e0)', 1, 1],
  ['Tim atletik', 'Ekstrakurikuler', 'Latihan lari 60 meter menjelang seleksi O2SN tingkat kecamatan.', 'Februari 2026', 'linear-gradient(150deg,#c9e8ff,#a5c8f5)', 1, 2],
  ['Peringatan 17 Agustus', 'Acara', 'Lomba balap karung, makan kerupuk, dan upacara bendera pagi hari.', 'Agustus 2025', 'linear-gradient(150deg,#ffd8ea,#e8b6f0)', 2, 1],
  ['Perpustakaan', 'Fasilitas', 'Empat ribu judul buku anak, buka setiap hari sekolah sampai pukul 14.00.', 'Januari 2026', 'linear-gradient(150deg,#d7d2ff,#b4b8f8)', 1, 1],
  ['Sanggar tari', 'Ekstrakurikuler', 'Latihan tari Gending Sriwijaya untuk pembukaan pentas seni.', 'November 2025', 'linear-gradient(150deg,#f6c6e8,#c6b6f6)', 1, 1],
  ['Juara MTQ kabupaten', 'Prestasi', 'Dua murid kelas enam membawa piala tilawah tingkat kabupaten.', 'Maret 2026', 'linear-gradient(150deg,#ffeab3,#ffd08c)', 1, 1],
  ['Literasi digital', 'Belajar', 'Enam belas komputer dipakai bergantian oleh kelas empat sampai enam.', 'Februari 2026', 'linear-gradient(150deg,#b6e8f0,#8fd8ec)', 2, 1],
  ['Halaman bermain', 'Fasilitas', 'Lapangan serbaguna, ayunan, dan area pasir saat jam istirahat kedua.', 'Oktober 2025', 'linear-gradient(150deg,#a9eede,#9fc4f8)', 1, 1],
  ['Klub mendongeng', 'Ekstrakurikuler', 'Murid membacakan cerita rakyat Sumatera Selatan di depan kelas satu.', 'Januari 2026', 'linear-gradient(150deg,#ffc6c6,#f2a9c8)', 1, 1],
  ['Wisuda kelas VI', 'Acara', 'Enam puluh delapan lulusan menerima rapor terakhir bersama orang tua.', 'Juni 2026', 'linear-gradient(150deg,#c8b6ff,#9fb6f8 60%,#ffc9dc)', 2, 2],
  ['Adiwiyata nasional', 'Prestasi', 'Penyerahan penghargaan sekolah berbudaya lingkungan tingkat nasional.', 'Mei 2026', 'linear-gradient(150deg,#b6f0c8,#8fe0c0)', 1, 1],
  ['Musala sekolah', 'Fasilitas', 'Salat Zuhur berjamaah bergantian antar kelas sebelum pulang.', 'September 2025', 'linear-gradient(150deg,#b6f0e0,#8fd8ec)', 1, 1],
  ['Pasar murid', 'Acara', 'Kelas lima berjualan hasil karya sendiri selama dua hari di aula.', 'April 2026', 'linear-gradient(150deg,#ffd9b3,#f7b7a0)', 1, 1],
  ['Kunjungan orang tua', 'Acara', 'Pertemuan bulanan wali murid di ruang kelas masing-masing.', 'Maret 2026', 'linear-gradient(150deg,#cfd6ff,#b4b8f8)', 1, 1],
];

const KAT = ['Semua', 'Belajar', 'Ekstrakurikuler', 'Acara', 'Fasilitas', 'Prestasi'];
const KAT_ITEM = ['Belajar', 'Ekstrakurikuler', 'Acara', 'Fasilitas', 'Prestasi'];

// Pola span mosaik & gradien fallback, dipilih otomatis berdasarkan urutan foto
// sehingga pembeli tidak perlu menentukan tata letak. (Pola "tampilan di kode".)
const SPAN = [[2, 2], [1, 1], [1, 1], [2, 1], [1, 1], [1, 2], [2, 1], [1, 1]];
const PHOTO_GRAD = [
  'linear-gradient(150deg,#c6b6f6,#9fc4f8 60%,#a9eede)', 'linear-gradient(150deg,#bcd6ff,#9fb6f8)',
  'linear-gradient(150deg,#bbf7d0,#86efac)', 'linear-gradient(150deg,#ffc9dc,#f2a9c8)',
  'linear-gradient(150deg,#ffe0b3,#ffc39c 55%,#b6f0e0)', 'linear-gradient(150deg,#c9e8ff,#a5c8f5)',
  'linear-gradient(150deg,#ffd8ea,#e8b6f0)', 'linear-gradient(150deg,#d7d2ff,#b4b8f8)',
];

const HERO_GRADS = [
  'linear-gradient(150deg,#c6b6f6,#9fc4f8)', 'linear-gradient(150deg,#ffc9dc,#f2a9c8)',
  'linear-gradient(150deg,#a9eede,#8fd8ec)', 'linear-gradient(150deg,#ffe0b3,#ffc39c)',
  'linear-gradient(150deg,#d7d2ff,#b4b8f8)', 'linear-gradient(150deg,#bbf7d0,#86efac)',
  'linear-gradient(150deg,#ffd8ea,#e8b6f0)', 'linear-gradient(150deg,#c9e8ff,#a5c8f5)',
];
const HEIGHTS = [104, 138, 92, 124, 110, 150, 118, 132];
const COLS = 4;

const escapeCssUrl = (value) => String(value).replace(/[\\"]/g, '\\$&');

const GalleryPage = () => {
  const schoolIdentity = useSchoolIdentity();
  const [kat, setKat] = useState('Semua');
  const [view, setView] = useState('mosaic');
  const [idx, setIdx] = useState(-1);
  const [cmsPhotos, setCmsPhotos] = useState([]);
  const [cmsAlbums, setCmsAlbums] = useState([]);
  const [albumPhotoIds, setAlbumPhotoIds] = useState(null);
  const [galleryRequest, setGalleryRequest] = useState(0);
  const [galleryState, setGalleryState] = useState({ status: 'loading', error: null });
  const [statsRequest, setStatsRequest] = useState(0);
  const [studentMetric, setStudentMetric] = useState({ status: 'loading', value: null, error: null });
  const [classMetric, setClassMetric] = useState({ status: 'loading', value: null, error: null });

  useEffect(() => {
    let mounted = true;
    setGalleryState({ status: 'loading', error: null });
    fetchWebsiteContentMap({ keys: ['galleryPhotos', 'galleryAlbums'], publicOnly: true })
      .then((map) => {
        if (!mounted) return;
        setCmsPhotos(normalizeGalleryPhotos(map.galleryPhotos));
        setCmsAlbums(normalizeGalleryAlbums(map.galleryAlbums));
        setGalleryState({ status: 'ready', error: null });
      })
      .catch(() => {
        if (!mounted) return;
        setGalleryState({ status: 'error', error: 'Data Galeri Kegiatan belum dapat dimuat.' });
      });
    return () => { mounted = false; };
  }, [galleryRequest]);

  useEffect(() => {
    let mounted = true;
    setStudentMetric({ status: 'loading', value: null, error: null });
    setClassMetric({ status: 'loading', value: null, error: null });

    Promise.allSettled([fetchSantriCount(), fetchClassCount()]).then(([studentResult, classResult]) => {
      if (!mounted) return;
      const parseMetric = (result, label) => {
        if (result.status === 'rejected') return { status: 'error', value: null, error: `${label} belum dapat dimuat.` };
        const total = Number(result.value?.total);
        if (!Number.isInteger(total) || total < 0) return { status: 'error', value: null, error: `${label} belum dapat dimuat.` };
        return { status: total === 0 ? 'empty' : 'ready', value: total, error: null };
      };
      setStudentMetric(parseMetric(studentResult, 'Jumlah murid'));
      setClassMetric(parseMetric(classResult, 'Jumlah rombongan belajar'));
    });

    return () => { mounted = false; };
  }, [statsRequest]);

  const managedPhotos = useMemo(() => normalizeGalleryPhotos(cmsPhotos), [cmsPhotos]);
  const heroPhotoCandidates = useMemo(
    () => selectGalleryHeroPhotos(managedPhotos),
    [managedPhotos],
  );
  const [heroPhotos, setHeroPhotos] = useState([]);

  useEffect(() => {
    let active = true;
    setHeroPhotos([]);
    if (heroPhotoCandidates.length === 0 || typeof window === 'undefined' || typeof window.Image !== 'function') {
      return () => { active = false; };
    }

    const loaded = new Set();
    heroPhotoCandidates.forEach((photo, index) => {
      const image = new window.Image();
      image.decoding = 'async';
      if ('fetchPriority' in image) image.fetchPriority = 'low';
      const settle = (isValid) => {
        if (!active || !isValid || loaded.has(index)) return;
        loaded.add(index);
        setHeroPhotos((current) => {
          const next = heroPhotoCandidates.filter((_, candidateIndex) => loaded.has(candidateIndex));
          return next.length === current.length ? current : next;
        });
      };
      image.onload = () => settle(true);
      image.onerror = () => settle(false);
      image.src = photo.url;
    });

    return () => { active = false; };
  }, [heroPhotoCandidates]);

  // Foto dari CMS bila ada (jumlah bebas), jika kosong pakai contoh bawaan FOTO.
  // Span mosaik & gradien fallback dipilih otomatis dari urutan.
  const source = useMemo(() => {
    if (managedPhotos.length > 0) {
      return managedPhotos.map((p, i) => ({
        id: String(p.id),
        nama: p.caption || p.name || `Foto ${i + 1}`,
        kat: KAT_ITEM.includes(p.kategori) ? p.kategori : 'Belajar',
        ket: p.keterangan || '',
        tanggal: p.tanggal || '',
        url: p.url || '',
        grad: PHOTO_GRAD[i % PHOTO_GRAD.length],
        col: SPAN[i % SPAN.length][0],
        row: SPAN[i % SPAN.length][1],
      }));
    }
    return FOTO.map((f, i) => ({ id: `fallback-gallery-${i + 1}`, nama: f[0], kat: f[1], ket: f[2], tanggal: f[3], url: '', grad: f[4], col: f[5], row: f[6] }));
  }, [managedPhotos]);

  const activeAlbumPhotoIds = useMemo(
    () => (albumPhotoIds ? new Set(albumPhotoIds.map((id) => String(id))) : null),
    [albumPhotoIds],
  );

  const items = useMemo(
    () => source.map((s, i) => ({ s, i })).filter((o) => (
      (!activeAlbumPhotoIds || activeAlbumPhotoIds.has(String(o.s.id)))
      && (kat === 'Semua' || o.s.kat === kat)
    )),
    [source, kat, activeAlbumPhotoIds],
  );

  const move = useCallback((dir) => {
    setIdx((current) => {
      const at = items.findIndex((o) => o.i === current);
      if (at === -1 || items.length === 0) return current;
      return items[(at + dir + items.length) % items.length].i;
    });
  }, [items]);

  // keyboard (verbatim from componentDidMount)
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

  // parallax on [data-par] (verbatim)
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        document.querySelectorAll('[data-par]').forEach((el) => {
          const k = parseFloat(el.getAttribute('data-par')) || 0.1;
          const r = el.getBoundingClientRect();
          const off = (r.top + r.height / 2 - window.innerHeight / 2) * -k;
          el.style.transform = `translate3d(0,${off.toFixed(1)}px,0)`;
        });
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [view, kat]);

  const scrollCine = (dir) => {
    const el = document.getElementById('cine');
    if (el) el.scrollBy({ left: dir * Math.min(760, el.clientWidth * 0.72), behavior: 'smooth' });
  };

  // Isi latar satu foto: gambar bila ada url, jika tidak gradien fallback.
  const fillOf = (s) => (s.url ? `background:url("${s.url}") center/cover no-repeat` : `background:${s.grad}`);

  const heroCols = useMemo(() => Array.from({ length: 5 }).map((_, c) => {
    const base = Array.from({ length: 9 }).map((__, t) => {
      const g = (c * 7 + t * 3) % 8;
      const photo = heroPhotos.length > 0 ? heroPhotos[(c * 7 + t * 3) % heroPhotos.length] : null;
      const background = photo
        ? `background-image:url("${escapeCssUrl(photo.url)}"),${HERO_GRADS[g]};background-size:cover,cover;background-position:center,center;background-repeat:no-repeat,no-repeat`
        : `background:${HERO_GRADS[g]}`;
      return { style: `flex:none;height:${HEIGHTS[(c + t) % HEIGHTS.length]}px;border-radius:16px;${background};border:1px solid rgba(255,255,255,.75);box-shadow:0 16px 34px -18px rgba(55,65,120,.5),inset 0 1px 0 rgba(255,255,255,.85)` };
    });
    return { tiles: base.concat(base), cls: c % 2 ? 'dcol rev' : 'dcol', style: `animation-duration:${38 + c * 7}s` };
  }), [heroPhotos]);

  const galleryMetric = useMemo(() => ({
    status: galleryState.status === 'ready'
      ? (managedPhotos.length === 0 ? 'empty' : 'ready')
      : galleryState.status,
    value: managedPhotos.length,
    error: galleryState.error,
  }), [galleryState, managedPhotos.length]);

  const albumSource = useMemo(
    () => (galleryState.status === 'ready' ? managedPhotos : []),
    [galleryState.status, managedPhotos],
  );
  const albumDefinitions = useMemo(() => {
    const configured = normalizeGalleryAlbums(cmsAlbums)
      .map((album) => ({ ...album, photos: resolveGalleryAlbumPhotos(album, source) }))
      .filter((album) => album.photos.length > 0);
    if (configured.length > 0) return configured;
    if (galleryState.status !== 'ready') return [];
    return deriveGalleryAlbums(albumSource)
      .map((album) => ({ ...album, photos: resolveGalleryAlbumPhotos(album, source) }))
      .filter((album) => album.photos.length > 0);
  }, [albumSource, cmsAlbums, galleryState.status, source]);

  const albumEntries = useMemo(() => albumDefinitions.map((album) => {
    const cover = album.photos[0];
    const photoIds = album.photos.map((photo) => String(photo.id));
    const firstIndex = source.findIndex((photo) => String(photo.id) === String(photoIds[0]));
    const layerFill = fillOf(cover);
    return {
      nama: album.title,
      n: album.photos.length,
      open: () => {
        setAlbumPhotoIds(photoIds);
        setKat('Semua');
        setIdx(firstIndex);
      },
      l1: `position:absolute;inset:0;border-radius:24px;${layerFill};border:1px solid rgba(255,255,255,.7);box-shadow:0 20px 42px -20px rgba(55,65,120,.5)`,
      l2: `position:absolute;inset:0;border-radius:24px;${layerFill};border:1px solid rgba(255,255,255,.7);box-shadow:0 20px 42px -20px rgba(55,65,120,.5)`,
      l3: `position:relative;height:250px;border-radius:24px;overflow:hidden;${layerFill};border:1px solid rgba(255,255,255,.78);box-shadow:0 30px 62px -24px rgba(55,65,120,.6),inset 0 1px 0 rgba(255,255,255,.85)`,
    };
  }), [albumDefinitions, source]);

  const galleryMonths = useMemo(
    () => new Set(managedPhotos.map((photo) => String(photo.tanggal || '').trim()).filter(Boolean)).size,
    [managedPhotos],
  );
  const galleryActivities = useMemo(
    () => new Set(managedPhotos.map((photo) => String(photo.caption || photo.name || '').trim()).filter(Boolean)).size,
    [managedPhotos],
  );
  const metrics = [galleryMetric, studentMetric, classMetric];
  const bandStatsBusy = metrics.some((metric) => metric.status === 'loading');
  const bandStatsHasError = metrics.some((metric) => metric.status === 'error');
  const bandStatsHasEmpty = metrics.some((metric) => metric.status === 'empty');
  const bandStatsNotice = bandStatsBusy
    ? 'Memuat statistik Galeri…'
    : bandStatsHasError
      ? 'Sebagian statistik belum dapat dimuat.'
      : bandStatsHasEmpty
        ? 'Belum ada data pada sebagian statistik.'
        : '';
  const retryStats = () => {
    setGalleryRequest((request) => request + 1);
    setStatsRequest((request) => request + 1);
  };
  const academicYear = String(schoolIdentity?.academicYear || '').trim();
  const academicYearLabel = academicYear ? `Tahun ajaran ${academicYear}` : 'Tahun ajaran';
  const albumMessage = galleryState.status === 'loading'
    ? 'Memuat album dari Galeri Kegiatan…'
    : galleryState.status === 'error'
      ? 'Album belum dapat dimuat. Coba lagi.'
      : 'Belum ada album. Tambahkan album dari foto Galeri Kegiatan melalui Manajemen Konten Website.';

  useSdnbMotion([galleryState.status, studentMetric.status, classMetric.status, source.length, albumEntries.length]);

  const cur = idx >= 0 ? source[idx] : null;
  const at = items.findIndex((o) => o.i === idx);

  const vals = {
    heroCols,
    heroStats: [
      { n: galleryMetric.value, status: galleryMetric.status, suf: '', label: 'foto terkumpul' },
      { n: galleryMonths, status: galleryMetric.status, suf: ' bulan', label: 'dokumentasi berjalan' },
      { n: albumEntries.length, status: galleryMetric.status, suf: '', label: 'album kegiatan' },
    ],
    bandStats: [
      { n: studentMetric.value, status: studentMetric.status, suf: '', label: 'murid dalam bingkai' },
      { n: galleryActivities, status: galleryMetric.status, suf: '', label: 'kegiatan terdokumentasi' },
      { n: classMetric.value, status: classMetric.status, suf: '', label: 'rombongan belajar' },
    ],
    academicYearLabel,
    bandStatsNotice,
    bandStatsBusy,
    retryBandStats: retryStats,
    albumMessage,

    kategori: KAT.map((k) => {
      const n = k === 'Semua' ? source.length : source.filter((s) => s.kat === k).length;
      const on = kat === k;
      return {
        label: k,
        n,
        pick: () => { setKat(k); setAlbumPhotoIds(null); setIdx(-1); },
        style: 'display:inline-flex;align-items:center;gap:8px;padding:11px 15px;border-radius:14px;cursor:pointer;font-family:inherit;font-size:13.5px;font-weight:700;transition:background .3s ease,color .3s ease,box-shadow .3s ease,transform .3s cubic-bezier(.4,1.3,.4,1);' + (on
          ? 'border:0;color:#fff;background:linear-gradient(135deg,var(--sekolah-aksen),var(--sekolah-aksen-tengah-2) 60%,var(--sekolah-aksen-ujung));box-shadow:0 14px 30px -12px rgba(95,105,235,.95),inset 0 1px 0 rgba(255,255,255,.5);transform:translateY(-1px)'
          : 'border:1px solid rgba(255,255,255,.85);color:#3d4166;background:rgba(255,255,255,.5)'),
        badge: 'font-size:11px;font-weight:800;padding:2px 7px;border-radius:8px;font-variant-numeric:tabular-nums;' + (on ? 'background:rgba(255,255,255,.26);color:#fff' : 'background:rgba(120,130,190,.14);color:#6a6f95'),
      };
    }),

    views: [['mosaic', 'Mosaik'], ['sinema', 'Sinema']].map(([k, label]) => {
      const on = view === k;
      return {
        label,
        pick: () => setView(k),
        style: 'padding:9px 16px;border-radius:12px;cursor:pointer;font-family:inherit;font-size:12.5px;font-weight:700;transition:all .3s ease;' + (on
          ? 'border:0;color:#fff;background:linear-gradient(135deg,var(--sekolah-aksen-pekat),var(--sekolah-aksen-tengah-2));box-shadow:0 10px 22px -10px rgba(95,105,235,.9)'
          : 'border:0;background:transparent;color:#5c6188'),
      };
    }),
    isMosaic: view === 'mosaic',
    isSinema: view === 'sinema',

    mosStyle: `display:grid;grid-template-columns:repeat(${COLS},1fr);grid-auto-rows:186px;grid-auto-flow:dense;gap:18px;position:relative;z-index:1`,

    foto: items.map(({ s, i }) => ({
      nama: s.nama,
      kat: s.kat,
      ket: s.ket,
      tanggal: s.tanggal,
      open: () => setIdx(i),
      cell: `grid-column:span ${Math.min(COLS, s.col)};grid-row:span ${s.row};border:1px solid rgba(255,255,255,.72);box-shadow:0 28px 58px -24px rgba(55,65,120,.55),inset 0 1px 0 rgba(255,255,255,.8)`,
      frame: 'position:relative;width:min(72vw,880px);height:min(66vh,560px);border-radius:30px;border:1px solid rgba(255,255,255,.72);box-shadow:0 40px 84px -30px rgba(50,60,125,.62),inset 0 1px 0 rgba(255,255,255,.8)',
      fill: fillOf(s),
    })),
    cinePrev: () => scrollCine(-1),
    cineNext: () => scrollCine(1),

    album: albumEntries,

    lightOpen: idx >= 0,
    cur: cur ? {
      nama: cur.nama,
      kat: cur.kat,
      ket: cur.ket,
      tanggal: cur.tanggal,
      pos: `${at + 1} / ${items.length}`,
      frame: `position:relative;flex:1;max-width:1080px;height:100%;max-height:74vh;border-radius:28px;overflow:hidden;${fillOf(cur)};border:1px solid rgba(255,255,255,.5);box-shadow:0 50px 110px -34px rgba(15,20,60,.8);animation:zoomin .42s cubic-bezier(.2,.9,.25,1) both`,
    } : { nama: '', kat: '', ket: '', tanggal: '', pos: '', frame: '' },
    thumbs: items.map(({ s, i }) => ({
      go: () => setIdx(i),
      style: `flex:none;width:${i === idx ? '104px' : '74px'};height:56px;border-radius:12px;cursor:pointer;padding:0;${fillOf(s)};transition:width .35s cubic-bezier(.4,1.3,.4,1),opacity .3s ease,border-color .3s ease;opacity:${i === idx ? '1' : '.55'};border:2px solid ${i === idx ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.3)'}`,
    })),
    prev: () => move(-1),
    next: () => move(1),
    close: () => { setIdx(-1); setAlbumPhotoIds(null); },
    stop: (e) => e.stopPropagation(),
  };

  return (
    <div className="sdnb-galeri">
      <Helmet>
        <title>Galeri — Sekolah Dasar Negeri Baturaja</title>
        <meta name="description" content="Dokumentasi kegiatan belajar, ekstrakurikuler, acara, dan fasilitas Sekolah Dasar Negeri Baturaja." />
      </Helmet>
      {GaleriBody(vals)}
    </div>
  );
};

export default GalleryPage;
