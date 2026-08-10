import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import EkskulBody from '@/components/sdnb/generated/EkskulBody';
import { EKSKUL_CONTENT_KEY, fetchEkskulContent, normalizeEkskulContent } from '@/lib/ekskulContent';
import {
  fetchPublicTeachers,
  getPublicContentErrorMessage,
  WEBSITE_CONTENT_UPDATED_EVENT,
  WEBSITE_CONTENT_UPDATED_STORAGE_KEY,
} from '@/lib/publicContentAdapters';
import useSdnbMotion from '@/hooks/useSdnbMotion';
import '@/styles/sdnb.css';

/**
 * Ekstrakurikuler — markup dari mockup (EkskulBody), datanya kini bersumber dari
 * Konten → Ekstrakurikuler (`website_content` kunci `ekskul_content`). Nama
 * pembina karangan yang dulu ditanam di kode sudah dihapus. Warna kartu dipilih
 * otomatis dari GRADIEN berdasarkan urutan; peserta dan pembina berasal dari master.
 */

const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
const ROT = [-2, 3, -2, 3, -3, 2, -2, 3];
// Palet warna kartu, dipilih berdasarkan urutan kegiatan. Pembeli tidak
// menyunting warna — hanya teks. (Pola sama seperti PROGRAM_STYLE/FASILITAS_GAYA.)
const GRADIEN = [
  'var(--sekolah-aksen),var(--sekolah-aksen-tengah)',
  'var(--sekolah-aksen-tengah),var(--sekolah-aksen-ujung)',
  'var(--sekolah-aksen-tengah-2),var(--sekolah-aksen-ujung)',
  'var(--sekolah-aksen-ujung),var(--sekolah-aksen-hangat)',
  'var(--sekolah-aksen-pekat),#9fb6f8',
  '#6ab8f0,#8fd8ec',
  'var(--sekolah-aksen-tengah),#c8a4f0',
  '#5fb8a0,#8fe0c0',
  '#7bbf6a,#b6e8a0',
  'var(--sekolah-aksen),#b4b8f8',
];

const EkstrakurikulerPage = () => {
  const [content, setContent] = useState(() => normalizeEkskulContent(undefined));
  const [publicTeachers, setPublicTeachers] = useState([]);
  const [aktif, setAktif] = useState(0);
  const [tick, setTick] = useState(0);
  const [contentStatus, setContentStatus] = useState('loading');
  const [contentError, setContentError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useSdnbMotion([contentStatus]);

  useEffect(() => {
    let hidup = true;
    setContentStatus((previous) => (previous === 'ready' || previous === 'empty' ? 'refreshing' : 'loading'));
    fetchEkskulContent()
      .then((data) => {
        if (!hidup || !data) return;
        setContent(data);
        setContentError('');
        setContentStatus(data.records?.length ? 'ready' : 'empty');
      })
      .catch((error) => {
        if (!hidup) return;
        setContentError(getPublicContentErrorMessage(error));
        setContentStatus('error');
      });
    fetchPublicTeachers()
      .then((teachers) => {
        if (hidup && Array.isArray(teachers)) setPublicTeachers(teachers);
      })
      .catch(() => { /* snapshot nama pembina tetap menjadi fallback */ });
    return () => { hidup = false; };
  }, [reloadToken]);

  useEffect(() => {
    const shouldRefresh = (keys) => !keys.length || keys.includes(EKSKUL_CONTENT_KEY);
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

  const teacherNameById = useMemo(() => new Map(
    publicTeachers
      .filter((teacher) => teacher?.id && teacher?.nama)
      .map((teacher) => [String(teacher.id), teacher.nama]),
  ), [publicTeachers]);

  // Bentuk tuple yang diharapkan EkskulBody: [nama, bidang, hari, jam, pembina,
  // tempat, terisi, kuota, kelas, cerita, gradien, foto, pembinaId].
  const E = useMemo(() => (content.records || []).map((r, i) => [
    r.nama, r.bidang, r.hari, r.jam, teacherNameById.get(String(r.pembina_id)) || r.pembina, r.tempat, r.terisi, r.kuota, r.kelas, r.cerita,
    GRADIEN[i % GRADIEN.length], r.foto_url, r.pembina_id,
  ]), [content.records, teacherNameById]);

  const pilih = (i) => { setAktif(i); setTick((t) => t + 1); };

  const idxAktif = E.length ? Math.min(aktif, E.length - 1) : 0;
  const a = E[idxAktif] || null;
  const no = String(idxAktif + 1).padStart(2, '0');

  const muridTerdaftar = E.reduce((t, e) => t + (Number(e[6]) || 0), 0);
  const pembinaUnik = new Set(E.map((e) => String(e[12] || e[4] || '').trim()).filter(Boolean)).size;

  const vals = {
    heroKicker: content.hero?.kicker || '',
    heroYear: content.hero?.yearLabel || '',
    heroTitle: content.hero?.title || '',
    heroSuffix: content.hero?.suffix || '',
    heroDescription: content.hero?.description || '',
    headerStatus: {
      state: contentStatus,
      message: contentStatus === 'loading'
        ? 'Memuat statistik…'
        : contentStatus === 'refreshing'
          ? 'Memperbarui statistik…'
          : contentStatus === 'empty'
            ? 'Belum ada kegiatan tersimpan.'
            : contentStatus === 'error'
              ? `Statistik belum dapat dimuat${contentError ? `: ${contentError}` : '.'}`
              : '',
    },
    angka: [
      { n: E.length, suf: '', label: content.hero?.stats?.activities || 'kegiatan aktif' },
      { n: muridTerdaftar, suf: '', label: content.hero?.stats?.students || 'murid terdaftar' },
      { n: pembinaUnik, suf: '', label: content.hero?.stats?.mentors || 'guru pembina' },
    ].map((a) => ({ ...a, state: contentStatus })),

    stiker: E.slice(0, 8).map((e, i) => {
      return {
        nama: e[0].split(' ')[0],
        style: `--stiker-index:${i};--stiker-rot:${ROT[i]}deg;--stiker-delay:${(i * 0.06).toFixed(2)}s;`,
      };
    }),

    total: `${E.length} kegiatan`,
    judulJumlah: E.length,

    indeks: E.map((e, i) => {
      const on = i === idxAktif;
      const c = e[10].split(',');
      return {
        nomor: String(i + 1).padStart(2, '0'),
        judul: e[0],
        hari: `${e[2]}, ${e[3]}`,
        on: on ? '1' : '0',
        foto: `background-image:radial-gradient(58% 120% at 80% 16%,${c[1]} 0%,rgba(255,255,255,0) 62%),radial-gradient(48% 104% at 20% 90%,${c[0]} 0%,rgba(255,255,255,0) 58%),linear-gradient(118deg,${c[0]} 0%,${c[1]} 100%)`,
        fotoUrl: e[11],
        pick: () => pilih(i),
        no: `font-family:'Plus Jakarta Sans','Archivo',system-ui,sans-serif;font-size:22px;font-weight:800;letter-spacing:-.03em;font-variant-numeric:tabular-nums;transition:color .3s ease;color:${on ? 'var(--sekolah-aksen-pekat)' : '#c2c6dd'}`,
        nama: `display:block;font-size:15.5px;font-weight:${on ? '800' : '600'};letter-spacing:-.015em;transition:color .3s ease;color:${on ? '#191b2c' : '#3f4468'}`,
      };
    }),

    panelCls: tick % 2 === 0 ? 'panA' : 'panB',

    poster: a ? {
      nomor: no, judul: a[0], bidang: a[1], hari: a[2], jam: a[3], pembina: a[4], tempat: a[5],
      cerita: a[9], kelas: a[8],
      foto: a[11],
      kuotaTeks: `${a[6]} / ${a[7]} murid`,
      kuotaBar: `height:100%;width:${a[7] > 0 ? Math.round((a[6] / a[7]) * 100) : 0}%;border-radius:99px;background:linear-gradient(90deg,var(--sekolah-aksen),var(--sekolah-aksen-ujung));transition:width .7s cubic-bezier(.22,.9,.28,1)`,
      wrap: `position:relative;overflow:hidden;min-height:340px;border-radius:32px;background:linear-gradient(140deg,${a[10]});border:1px solid rgba(255,255,255,.4);box-shadow:0 40px 86px -30px rgba(60,70,160,.72)`,
    } : {
      nomor: '00', judul: 'Belum ada kegiatan', bidang: '', hari: '', jam: '', pembina: '', tempat: '',
      cerita: 'Tambahkan kegiatan ekstrakurikuler dari menu Konten → Ekstrakurikuler.', kelas: '', foto: '',
      kuotaTeks: '', kuotaBar: 'height:100%;width:0%', wrap: 'position:relative;min-height:340px;border-radius:32px;background:rgba(120,132,200,.12)',
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
        <meta name="description" content="Kegiatan ekstrakurikuler, jadwal sepekan, dan cara mendaftar." />
      </Helmet>
      {EkskulBody(vals)}
    </div>
  );
};

export default EkstrakurikulerPage;
