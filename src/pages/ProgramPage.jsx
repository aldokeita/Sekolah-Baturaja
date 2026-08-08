import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import ProgramBody from '@/components/sdnb/generated/ProgramBody';
import { fetchProgramContent, normalizeProgramContent } from '@/lib/programContent';
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

  useSdnbMotion([]);

  useEffect(() => {
    let hidup = true;
    fetchProgramContent()
      .then((data) => { if (hidup && data) setContent(data); })
      .catch(() => { /* biarkan bawaan; halaman tetap tampil */ });
    return () => { hidup = false; };
  }, []);

  // Tuple program: [nama, jenis, kelas, waktu, gradien, ringkas, cerita, meta].
  const P = useMemo(() => (content.programs || []).map((p, i) => [
    p.nama, p.jenis, p.kelas, p.waktu, GRADIEN[i % GRADIEN.length], p.ringkas, p.cerita,
    (p.meta || []).map((m) => [m.label, m.value]),
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
    judulProgram: `${P.length} program`,
    ringkasProgram: 'Program yang benar-benar dijalankan sepanjang tahun ajaran — sebagian menempel pada jam pelajaran, sebagian berupa kebiasaan harian yang dijaga seluruh kelas.',
    gridProgram: 'margin-top:26px;display:grid;grid-template-columns:repeat(3,1fr);gap:22px',

    pintas: P.map((p) => ({
      label: p[0],
      href: '#program',
      style: 'display:inline-flex;align-items:center;padding:10px 16px;border-radius:999px;font-size:12.5px;font-weight:700;color:#3d4166;background:rgba(255,255,255,.68);border:1px solid rgba(255,255,255,.95);box-shadow:0 10px 24px -14px rgba(60,70,120,.6)',
    })),

    angka: [
      { n: P.length, suf: '', label: 'program berjalan' },
      { n: totalJp, suf: ' JP', label: 'jam pelajaran per pekan' },
      { n: content.stats?.temaProjek || 0, suf: '', label: 'tema projek per tahun' },
      { n: content.stats?.muridTerlibat || 0, suf: '', label: 'murid terlibat' },
    ].map((a, i) => ({ ...a, box: `padding:26px 28px;border-right:${i === 3 ? 'none' : '1px solid rgba(120,132,200,.24)'}` })),

    program: P.map((p, i) => ({
      nama: p[0], jenis: p[1], kelas: p[2], waktu: p[3], ringkas: p[5],
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
