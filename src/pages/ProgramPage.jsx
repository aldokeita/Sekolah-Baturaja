import React, { useCallback, useEffect, useMemo, useState } from 'react';
import JudulHalaman from '@/components/sdnb/JudulHalaman';
import ProgramBody from '@/components/sdnb/generated/ProgramBody';
import { fetchProgramContent, normalizeProgramContent, PROGRAM_CONTENT_KEY } from '@/lib/programContent';
import {
  getPublicContentErrorMessage,
  WEBSITE_CONTENT_UPDATED_EVENT,
  WEBSITE_CONTENT_UPDATED_STORAGE_KEY,
} from '@/lib/publicContentAdapters';
import useSdnbMotion from '@/hooks/useSdnbMotion';
import '@/styles/sdnb.css';

/**
 * Program — markup dari mockup (ProgramBody), datanya kini dari Konten → Program
 * (`website_content` kunci `program_content`): daftar program, beban jam
 * pelajaran, dan ritme harian. Nama guru karangan sudah dihapus dari bawaan.
 * Warna kartu dipilih otomatis dari GRADIEN berdasarkan urutan.
 */

const GRADIEN = [
  'var(--sekolah-aksen),var(--sekolah-aksen-tengah)',
  'var(--sekolah-aksen-tengah),var(--sekolah-aksen-ujung)',
  '#6ab8f0,#8fd8ec',
  '#7bbf6a,#b6e8a0',
  'var(--sekolah-aksen-pekat),#9fb6f8',
  'var(--sekolah-aksen-ujung),var(--sekolah-aksen-hangat)',
  'var(--sekolah-aksen-tengah-2),var(--sekolah-aksen-ujung)',
];

const ProgramPage = () => {
  const [content, setContent] = useState(() => normalizeProgramContent(undefined));
  const [idx, setIdx] = useState(-1);
  const [contentStatus, setContentStatus] = useState('loading');
  const [contentError, setContentError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useSdnbMotion([contentStatus]);

  useEffect(() => {
    let hidup = true;
    setContentStatus((previous) => (previous === 'ready' || previous === 'empty' ? 'refreshing' : 'loading'));
    fetchProgramContent()
      .then((data) => {
        if (!hidup || !data) return;
        setContent(data);
        setContentError('');
        const hasData = (data.programs || []).length > 0 || (data.jam || []).length > 0 || (data.ritme || []).length > 0;
        setContentStatus(hasData ? 'ready' : 'empty');
      })
      .catch((error) => {
        if (!hidup) return;
        setContentError(getPublicContentErrorMessage(error));
        setContentStatus('error');
      });
    return () => { hidup = false; };
  }, [reloadToken]);

  useEffect(() => {
    const shouldRefresh = (keys) => !keys.length || keys.includes(PROGRAM_CONTENT_KEY);
    const onContentUpdate = (event) => {
      const keys = Array.isArray(event.detail?.keys) ? event.detail.keys : [];
      if (shouldRefresh(keys)) setReloadToken((token) => token + 1);
    };
    const onStorage = (event) => {
      if (event.key !== WEBSITE_CONTENT_UPDATED_STORAGE_KEY || !event.newValue) return;
      try {
        const payload = JSON.parse(event.newValue);
        const keys = Array.isArray(payload?.keys) ? payload.keys : [];
        if (shouldRefresh(keys)) setReloadToken((token) => token + 1);
      } catch {
        setReloadToken((token) => token + 1);
      }
    };
    window.addEventListener(WEBSITE_CONTENT_UPDATED_EVENT, onContentUpdate);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(WEBSITE_CONTENT_UPDATED_EVENT, onContentUpdate);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // Tuple program: [nama, jenis, kelas, waktu, gradien, ringkas, cerita, meta, foto].
  const P = useMemo(() => (content.programs || []).map((p, i) => [
    p.nama, p.jenis, p.kelas, p.waktu, GRADIEN[i % GRADIEN.length], p.ringkas, p.cerita,
    (p.meta || []).map((m) => [m.label, m.value]), p.foto_url,
  ]), [content.programs]);

  const JAM = useMemo(() => (content.jam || []).map((j) => [j.mapel, j.jp]), [content.jam]);
  const maxJp = Math.max(1, ...JAM.map((j) => j[1]));
  const totalJp = JAM.reduce((t, j) => t + (Number(j[1]) || 0), 0);

  const URUTAN = content.ritme || [];
  const URUTAN_GRAD = ['var(--sekolah-aksen),var(--sekolah-aksen-tengah)', 'var(--sekolah-aksen-tengah),var(--sekolah-aksen-ujung)', 'var(--sekolah-aksen-tengah-2),var(--sekolah-aksen-ujung)', 'var(--sekolah-aksen-ujung),var(--sekolah-aksen-hangat)', 'var(--sekolah-aksen-pekat),#9fb6f8', '#6ab8f0,#8fd8ec', '#7bbf6a,#b6e8a0'];

  const geser = useCallback((dir) => setIdx((n) => (P.length ? (n + dir + P.length) % P.length : -1)), [P.length]);

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
    bebanTampil: JAM.length > 0,
    judulProgram: 'Program Utama',
    judulHero: content.hero?.title || '',
    judulHeroAksen: content.hero?.accent || '',
    ringkasProgram: content.hero?.description || '',
    headerStatus: {
      state: contentStatus,
      message: contentStatus === 'loading'
        ? 'Memuat statistik…'
        : contentStatus === 'refreshing'
          ? 'Memperbarui statistik…'
          : contentStatus === 'empty'
            ? 'Belum ada data program tersimpan.'
            : contentStatus === 'error'
              ? `Statistik belum dapat dimuat${contentError ? `: ${contentError}` : '.'}`
              : '',
    },
    gridProgram: 'margin-top:26px;display:grid;grid-template-columns:repeat(3,1fr);gap:22px',

    pintas: P.map((p) => ({
      label: p[0],
      href: '#program',
      style: 'display:inline-flex;align-items:center;padding:10px 16px;border-radius:999px;font-size:12.5px;font-weight:700;color:var(--sdnb-teks-badan);background:rgba(255,255,255,.68);border:1px solid rgba(255,255,255,.95);box-shadow:0 10px 24px -14px rgba(60,70,120,.6)',
    })),

    angka: [
      { n: P.length, suf: '', label: 'program berjalan' },
      { n: totalJp, suf: ' JP', label: 'jam pelajaran per pekan' },
      { n: content.stats?.temaProjek || 0, suf: '', label: 'tema projek per tahun' },
      { n: content.stats?.muridTerlibat || 0, suf: '', label: 'murid terlibat' },
    ].map((a, i) => ({ ...a, state: contentStatus, box: `padding:26px 28px;border-right:${i === 3 ? 'none' : '1px solid rgba(120,132,200,.24)'}` })),

    program: P.map((p, i) => ({
      nama: p[0], jenis: p[1], kelas: p[2], waktu: p[3], ringkas: p[5],
      foto: p[8],
      no: String(i + 1).padStart(2, '0'),
      open: () => setIdx(i),
      card: 'position:relative;overflow:hidden;cursor:pointer;min-height:320px;border-radius:28px;border:1px solid rgba(255,255,255,.5);box-shadow:0 30px 64px -26px rgba(55,65,120,.55)',
      fill: `position:absolute;inset:0;background:linear-gradient(145deg,${p[4]})`,
    })),

    urutan: URUTAN.map((u, i) => ({
      jam: u.jam, judul: u.judul, teks: u.teks,
      bulat: `width:74px;height:44px;border-radius:999px;font-size:13.5px;letter-spacing:-.01em;font-variant-numeric:tabular-nums;background:linear-gradient(140deg,${URUTAN_GRAD[i % URUTAN_GRAD.length]})`,
    })),

    jam: JAM.map(([mapel, jp]) => ({
      mapel,
      jp: `${jp} JP`,
      bar: `height:100%;width:${Math.round((jp / maxJp) * 100)}%;border-radius:99px;background:linear-gradient(90deg,var(--sekolah-aksen),var(--sekolah-aksen-ujung))`,
    })),
    totalJpLabel: `${totalJp} JP`,

    detilAda: idx >= 0,
    detil: d ? {
      nama: d[0], jenis: d[1], cerita: d[6],
      meta: d[7].map(([k, v]) => ({ k, v })),
      foto: d[8],
      hero: `position:relative;height:236px;overflow:hidden;background:linear-gradient(145deg,${d[4]})`,
    } : { nama: '', jenis: '', cerita: '', meta: [], foto: '', hero: '' },
    sebelum: () => geser(-1),
    sesudah: () => geser(1),
    tutup: () => setIdx(-1),
    stop: (e) => e.stopPropagation(),
  };

  return (
    <div className="sdnb-program">
      <JudulHalaman
        judul="Program"
        deskripsi="Program pembelajaran, ritme satu hari di sekolah, dan beban jam pelajaran per pekan."
      />
      {ProgramBody(vals)}
    </div>
  );
};

export default ProgramPage;
