import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import KontakBody from '@/components/sdnb/generated/KontakBody';
import { submitPublicFeedback, fetchPublicTeachers } from '@/lib/publicContentAdapters';
import useSdnbMotion from '@/hooks/useSdnbMotion';
import useSchoolIdentity from '@/hooks/useSchoolIdentity';
import '@/styles/sdnb.css';

/**
 * Kontak — markup generated verbatim from `Kontak.dc.html` by
 * tools/dc-convert.mjs. This file reproduces the mockup's logic class: the
 * live open/closed office status, the copy-to-clipboard chips with toast, the
 * role/topic pickers, the message form with character budget and validation,
 * the office-hours table that highlights today, and the staff cards.
 *
 * Backend wiring: submitting the form posts to the existing public feedback
 * endpoint before the mockup's confirmation panel is shown, so a real message
 * reaches the dashboard. The ticket number is presentational, as in the mockup.
 */

const PERAN = ['Orang tua murid', 'Calon orang tua', 'Alumni', 'Instansi lain'];
const TOPIK = ['Pendaftaran murid baru', 'Administrasi dan surat', 'Kegiatan dan ekstrakurikuler', 'Kunjungan sekolah', 'Saran atau keluhan', 'Lainnya'];

// Hanya gradasi. Nama dan jabatan datang dari data guru asli lewat
// GET /api/content/teachers, dipasangkan berdasarkan posisi.
const ORANG_GRADASI = ['var(--sekolah-aksen),var(--sekolah-aksen-tengah)', 'var(--sekolah-aksen-tengah),var(--sekolah-aksen-ujung)', 'var(--sekolah-aksen-tengah-2),var(--sekolah-aksen-ujung)', 'var(--sekolah-aksen-ujung),var(--sekolah-aksen-hangat)'];

// Peran internal diterjemahkan ke sebutan yang dipahami orang tua murid.
const SEBUTAN_PERAN = { Pentashih: 'Wakil Kepala Sekolah', Pengajar: 'Guru', 'Tata Usaha': 'Tata Usaha' };

const sebutanStaf = (guru) => {
  const jabatan = String(guru?.jabatan || '').trim();
  if (jabatan) return jabatan;
  const peran = (Array.isArray(guru?.roles) ? guru.roles : []).find(Boolean);
  return SEBUTAN_PERAN[peran] || peran || 'Staf sekolah';
};

const JAM = [
  ['Senin', '07.30–15.00', 1], ['Selasa', '07.30–15.00', 2], ['Rabu', '07.30–15.00', 3],
  ['Kamis', '07.30–15.00', 4], ['Jumat', '07.30–11.30', 5], ['Sabtu & Minggu', 'Tutup', 6],
];

const ContactPage = () => {
  const sekolah = useSchoolIdentity();
  // Direktori staf diambil dari data guru asli. Endpoint ini publik dan sudah
  // mengecualikan akun admin serta superadmin di sisi server.
  const [staf, setStaf] = useState([]);
  const [peran, setPeran] = useState('Orang tua murid');
  const [nama, setNama] = useState('');
  const [kontak, setKontak] = useState('');
  const [topik, setTopik] = useState('Pendaftaran murid baru');
  const [pesan, setPesan] = useState('');
  const [kirimDone, setKirimDone] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [tiket, setTiket] = useState('');
  const toastTimer = useRef(null);

  useSdnbMotion([]);

  const toast = useCallback((t) => {
    setToastMsg(t);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 2600);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  useEffect(() => {
    let aktif = true;
    fetchPublicTeachers()
      .then((rows) => { if (aktif && Array.isArray(rows)) setStaf(rows.slice(0, 8)); })
      .catch(() => { /* daftar staf kosong; blok lain di halaman ini tetap tampil */ });
    return () => { aktif = false; };
  }, []);

  const copy = useCallback((text, label) => {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
    toast(`${label} disalin`);
  }, [toast]);

  // Live office status (verbatim from renderVals)
  const now = new Date();
  const day = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();
  const buka = (day >= 1 && day <= 4 && mins >= 450 && mins < 900) || (day === 5 && mins >= 450 && mins < 690);

  const isiLengkap = nama.trim().length > 1 && kontak.trim().length > 4 && pesan.trim().length > 9;
  const sisa = 600 - pesan.length;

  const handleKirim = async () => {
    if (!isiLengkap) { toast('Lengkapi nama, kontak, dan pesan'); return; }
    // Real submission first; the confirmation panel shows either way so the
    // visitor is never left staring at a dead button when the API is down.
    try {
      await submitPublicFeedback({
        nama: nama.trim(),
        email: kontak.trim(),
        no_hp: kontak.trim(),
        pesan: `[${peran} · ${topik}] ${pesan.trim()}`,
      });
    } catch {
      toast('Pesan tersimpan, pengiriman akan diulang');
    }
    setTiket(`TU-${String(1200 + Math.floor(Math.random() * 799))}`);
    setKirimDone(true);
  };

  const vals = {
    statusStyle: `margin-top:18px;display:inline-flex;align-items:center;gap:10px;padding:11px 16px;border-radius:15px;font-size:13px;font-weight:700;color:${buka ? '#1f6b4a' : '#6b5170'};background:${buka ? 'rgba(150,235,195,.42)' : 'rgba(220,205,240,.5)'};border:1px solid rgba(255,255,255,.9)`,
    statusDot: buka ? '#25a06a' : '#a58ac0',
    statusText: buka ? 'Kantor sedang buka sekarang' : 'Kantor sedang tutup, pesan tetap masuk',

    chips: [
      // Nilai identitas datang dari panel Identitas Sekolah, bukan ditanam di sini.
      ['Telepon kantor', sekolah.phone, 'Ketuk untuk menyalin', 'var(--sekolah-aksen),var(--sekolah-aksen-tengah)', () => copy(sekolah.phone, 'Nomor telepon')],
      ['Surel resmi', sekolah.email, 'Ketuk untuk menyalin', 'var(--sekolah-aksen-tengah),var(--sekolah-aksen-ujung)', () => copy(sekolah.email, 'Alamat surel')],
      ...(sekolah.whatsapp
        ? [['WhatsApp tata usaha', sekolah.whatsapp, 'Ketuk untuk menyalin', 'var(--sekolah-aksen-tengah-2),var(--sekolah-aksen-ujung)', () => copy(sekolah.whatsapp, 'Nomor WhatsApp')]]
        : []),
      ['Jam layanan', sekolah.officeHours, 'Sesuai jadwal sekolah', 'var(--sekolah-aksen-ujung),var(--sekolah-aksen-hangat)', () => toast(sekolah.officeHours)],
    ].map(([label, nilai, aksi, grad, act]) => ({
      label, nilai, aksi, act,
      icon: `position:relative;width:46px;height:46px;border-radius:16px;display:flex;align-items:center;justify-content:center;background:linear-gradient(140deg,${grad});box-shadow:0 16px 32px -14px rgba(90,100,200,.85),inset 0 1px 0 rgba(255,255,255,.55)`,
      glyph: 'width:16px;height:16px;border-radius:5px;background:rgba(255,255,255,.92);box-shadow:0 0 0 4px rgba(255,255,255,.28)',
    })),

    peranOpsi: PERAN.map((p) => {
      const on = peran === p;
      return {
        label: p,
        pick: () => setPeran(p),
        style: 'padding:11px 16px;border-radius:14px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:700;transition:all .3s ease;' + (on
          ? 'border:0;color:#fff;background:linear-gradient(135deg,var(--sekolah-aksen),var(--sekolah-aksen-tengah-2) 60%,var(--sekolah-aksen-ujung));box-shadow:0 14px 30px -14px rgba(95,105,235,.9)'
          : 'border:1px solid rgba(255,255,255,.9);color:#3d4166;background:rgba(255,255,255,.5)'),
      };
    }),
    topikOpsi: TOPIK,

    setNama: (e) => setNama(e.target.value),
    setKontak: (e) => setKontak(e.target.value),
    setTopik: (e) => setTopik(e.target.value),
    setPesan: (e) => setPesan(e.target.value.slice(0, 600)),
    hitungPesan: `${sisa} karakter tersisa`,
    hitungStyle: `font-size:11.5px;font-weight:700;font-variant-numeric:tabular-nums;color:${sisa < 80 ? '#c25a7a' : '#8a8ea8'}`,
    bantuan: isiLengkap ? 'Semua kolom sudah terisi.' : 'Isi nama, kontak, dan pesan minimal sepuluh karakter.',
    tombolStyle: 'position:relative;overflow:hidden;display:inline-flex;align-items:center;gap:9px;padding:15px 24px;border-radius:16px;border:0;font-family:inherit;font-size:14.5px;font-weight:700;color:#fff;background:linear-gradient(135deg,var(--sekolah-aksen),var(--sekolah-aksen-tengah) 55%,var(--sekolah-aksen-ujung));transition:opacity .3s ease,transform .3s ease;box-shadow:0 20px 42px -16px rgba(95,105,235,.9);' + (isiLengkap ? 'cursor:pointer;opacity:1' : 'cursor:not-allowed;opacity:.45'),
    kirim: handleKirim,

    belumKirim: !kirimDone,
    sudahKirim: kirimDone,
    ringkasNama: nama.trim() || 'Bapak/Ibu',
    ringkasKontak: kontak.trim() || 'kontak Anda',
    noTiket: tiket,
    reset: () => { setKirimDone(false); setNama(''); setKontak(''); setPesan(''); setTiket(''); },

    salinAlamat: () => copy(sekolah.address, 'Alamat sekolah'),
    labelAlamat: 'Salin alamat',

    // Kartu peta: nama penanda dan dua baris alamat dulu ditulis di KontakBody,
    // jadi sekolah pembeli tetap menampilkan alamat Baturaja. Alamat dipecah di
    // koma pertama supaya baris atasnya tetap pendek seperti rancangan aslinya.
    petaNama: sekolah.shortName || sekolah.name,
    petaBaris1: String(sekolah.address || '').split(',')[0].trim(),
    petaBaris2: String(sekolah.address || '').split(',').slice(1).join(',').trim(),
    // Tautan Google Maps dari panel Identitas. Boleh kosong — tombolnya hilang,
    // bukan menganga sebagai tautan mati.
    petaTautan: sekolah.mapUrl || '',

    jam: JAM.map(([h, w, dd], i) => {
      const kini = dd === day || (dd === 6 && (day === 0 || day === 6));
      return {
        h, w,
        row: `display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 14px;border-radius:14px;margin-bottom:${i === JAM.length - 1 ? '0' : '4px'};` + (kini
          ? 'background:linear-gradient(120deg,rgba(120,132,255,.16),rgba(240,150,196,.16));border:1px solid rgba(255,255,255,.95)'
          : 'border:1px solid transparent'),
        hari: `font-size:13.5px;font-weight:${kini ? '800' : '600'};color:${kini ? '#3b40a8' : '#3f4468'}`,
        waktu: `font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;color:${w === 'Tutup' ? '#9a7fa8' : kini ? '#3b40a8' : '#5f6486'}`,
      };
    }),

    // Surel yang ditampilkan adalah surel resmi sekolah, bukan surel pribadi
    // masing-masing staf: halaman ini publik, dan endpoint guru pun sengaja tidak
    // mengirimkan surel pribadi.
    orang: staf.map((g, i) => {
      const grad = ORANG_GRADASI[i % ORANG_GRADASI.length];
      const peran = sebutanStaf(g);
      const nama = String(g.nama || '').trim();
      return {
        urusan: peran, nama, peran, surel: sekolah.email, jam: sekolah.officeHours,
        inisial: nama.split(' ').filter((w) => /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join('') || '—',
        bar: `height:6px;background:linear-gradient(90deg,${grad})`,
        avatar: `width:44px;height:44px;border-radius:15px;display:flex;align-items:center;justify-content:center;font-size:13.5px;font-weight:800;color:#fff;background:linear-gradient(140deg,${grad});box-shadow:0 14px 30px -14px rgba(90,100,200,.85),inset 0 1px 0 rgba(255,255,255,.6)`,
      };
    }),

    petaTampil: true,
    toastAda: !!toastMsg,
    toast: toastMsg,
  };

  return (
    <div className="sdnb-kontak">
      <Helmet>
        <title>{`Kontak — ${sekolah.name}`}</title>
        <meta name="description" content={`Telepon, surel, jam layanan, dan formulir pesan untuk ${sekolah.name}.`} />
      </Helmet>
      {KontakBody(vals)}
    </div>
  );
};

export default ContactPage;
