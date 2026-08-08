import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import PrestasiBody from '@/components/sdnb/generated/PrestasiBody';
import { fetchPrestasiContent, normalizePrestasiContent } from '@/lib/prestasiContent';
import useSdnbMotion from '@/hooks/useSdnbMotion';
import '@/styles/sdnb.css';

/**
 * Prestasi — markup dari mockup (PrestasiBody), tapi datanya kini bersumber dari
 * dashboard: catatan prestasi + dua statistik disunting di Konten → Prestasi dan
 * disimpan pada `website_content` kunci `prestasi_content`. Bila belum diisi,
 * tampil catatan contoh netral (lihat DEFAULT_PRESTASI_CONTENT). Nama juara
 * karangan yang dulu ditanam di kode sudah dihapus — semuanya milik pembeli.
 */

const TINGKAT = ['Semua', 'Nasional', 'Provinsi', 'Kabupaten', 'Kecamatan'];

const warna = (t) => (t === 'Nasional' ? 'var(--sekolah-aksen),var(--sekolah-aksen-tengah)' : t === 'Provinsi' ? 'var(--sekolah-aksen-tengah),var(--sekolah-aksen-ujung)' : t === 'Kabupaten' ? 'var(--sekolah-aksen-tengah-2),var(--sekolah-aksen-ujung)' : 'var(--sekolah-aksen-ujung),var(--sekolah-aksen-hangat)');

const foto = (bidang) => {
  const B = {
    Lingkungan: ['#7bbf6a', '#b6e8a0', '#5fb8a0'],
    Keagamaan: ['var(--sekolah-aksen-pekat)', '#9fb6f8', '#c6b6f6'],
    Olahraga: ['var(--sekolah-aksen-ujung)', 'var(--sekolah-aksen-ujung)', '#ffd08c'],
    Seni: ['var(--sekolah-aksen-tengah-2)', 'var(--sekolah-aksen-ujung)', '#f6c6e8'],
    Akademik: ['var(--sekolah-aksen)', '#8fd8ec', '#b4b8f8'],
    Kepramukaan: ['#6ab8f0', '#8fe0c0', '#a9eede'],
  };
  const c = B[bidang] || B.Akademik;
  return `radial-gradient(58% 120% at 78% 18%,${c[1]} 0%,rgba(255,255,255,0) 62%),`
    + `radial-gradient(46% 100% at 24% 88%,${c[2]} 0%,rgba(255,255,255,0) 58%),`
    + `linear-gradient(118deg,${c[0]} 0%,${c[1]} 52%,${c[2]} 100%)`;
};

const BIDANG_NAMA = ['Akademik', 'Seni', 'Olahraga', 'Keagamaan', 'Lingkungan', 'Kepramukaan'];

const PrestasiPage = () => {
  const [content, setContent] = useState(() => normalizePrestasiContent(undefined));
  const [tingkat, setTingkat] = useState('Semua');
  const [idx, setIdx] = useState(-1);

  useSdnbMotion([]);

  useEffect(() => {
    let aktif = true;
    fetchPrestasiContent()
      .then((data) => { if (aktif && data) setContent(data); })
      .catch(() => { /* biarkan bawaan; halaman tetap tampil */ });
    return () => { aktif = false; };
  }, []);

  const records = content.records || [];

  // Bentuk tuple yang diharapkan PrestasiBody: [tahun, judul, tingkat, peringkat,
  // oleh, bidang, cerita, [[label, value], ...]].
  const P = useMemo(() => records.map((r) => [
    r.tahun, r.judul, r.tingkat, r.peringkat, r.oleh, r.bidang, r.cerita,
    (r.meta || []).map((m) => [m.label, m.value]),
  ]), [records]);

  const items = useMemo(
    () => P.map((p, i) => ({ p, i })).filter((o) => tingkat === 'Semua' || o.p[2] === tingkat),
    [P, tingkat],
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

  const tahunUnik = useMemo(() => Array.from(new Set(P.map((p) => p[0]))).sort(), [P]);
  const perTahun = tahunUnik.map((th) => ({ th, n: P.filter((p) => p[0] === th).length }));
  const maxTahun = Math.max(1, ...perTahun.map((x) => x.n));
  const perBidang = BIDANG_NAMA.map((b) => ({ nama: b, n: P.filter((p) => p[5] === b).length }));
  const maxBidang = Math.max(1, ...perBidang.map((x) => x.n));
  const d = idx >= 0 ? P[idx] : null;

  const nasional = P.filter((p) => p[2] === 'Nasional').length;
  const provinsi = P.filter((p) => p[2] === 'Provinsi').length;

  const vals = {
    stat: [
      { n: nasional, suf: '', label: 'Tingkat nasional' },
      { n: provinsi, suf: '', label: 'Tingkat provinsi' },
      { n: content.stats?.muridTerlibat || 0, suf: '', label: 'Murid terlibat' },
      { n: content.stats?.tahunBerturut || 0, suf: '', label: 'Tahun berturut' },
    ].map((s, i) => ({ ...s, box: `padding:26px 24px 26px ${i === 0 ? '0' : '24px'};border-right:${i === 3 ? 'none' : '1px solid rgba(255,255,255,.16)'}` })),

    grafikTampil: P.length > 0,
    total: P.length,
    jumlah: `${items.length} dari ${P.length} catatan`,

    tingkatOpsi: TINGKAT.map((t) => {
      const on = tingkat === t;
      return {
        label: t,
        pick: () => { setTingkat(t); setIdx(-1); },
        style: `position:relative;padding:10px 0 12px;border:0;background:transparent;cursor:pointer;font-family:inherit;font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;transition:color .3s ease;color:${on ? '#21243f' : '#8a8ea8'}`,
        rule: `position:absolute;left:0;right:0;bottom:0;height:3px;transition:transform .35s cubic-bezier(.22,.9,.28,1),opacity .3s ease;transform-origin:left;transform:scaleX(${on ? '1' : '0'});opacity:${on ? '1' : '0'};background:linear-gradient(90deg,var(--sekolah-aksen-pekat),var(--sekolah-aksen-ujung))`,
      };
    }),

    daftar: items.map(({ p, i }) => ({
      tahun: p[0], judul: p[1], tingkat: p[2], peringkat: p[3], oleh: p[4],
      open: () => setIdx(i),
      foto: `background-image:${foto(p[5])}`,
      medali: `justify-self:start;padding:8px 14px;border-radius:999px;font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#fff;background:linear-gradient(135deg,${warna(p[2])});box-shadow:0 12px 26px -14px rgba(90,100,200,.9)`,
    })),

    grafik: perTahun.map((x) => ({
      th: x.th, n: x.n,
      bar: `width:100%;height:${Math.max(10, Math.round((x.n / maxTahun) * 118))}px;border-radius:8px 8px 3px 3px;background:linear-gradient(180deg,var(--sekolah-aksen),var(--sekolah-aksen-tengah-2))`,
    })),

    bidang: perBidang.map((x) => ({
      nama: x.nama, n: x.n,
      track: 'width:92px;height:6px;border-radius:99px;background:rgba(120,132,200,.2);overflow:hidden;display:inline-block',
      fill: `display:block;height:100%;width:${Math.round((x.n / maxBidang) * 100)}%;border-radius:99px;background:linear-gradient(90deg,var(--sekolah-aksen),var(--sekolah-aksen-ujung))`,
    })),

    podium: P.slice(0, 3).map((p, k) => {
      const tinggi = [300, 262, 234][k];
      return {
        no: `0${k + 1}`, judul: p[1], oleh: p[4], tahun: p[0], tingkat: p[2], peringkat: p[3],
        open: () => setIdx(k),
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
