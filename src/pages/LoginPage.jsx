import React, { useCallback, useEffect, useRef, useState } from 'react';
import JudulHalaman from '@/components/sdnb/JudulHalaman';
import { useNavigate, useLocation } from 'react-router-dom';
import LoginBody from '@/components/sdnb/generated/LoginBody';
import SiteNav from '@/components/sdnb/SiteNav';
import { useAuth } from '@/contexts/AuthContext';
import '@/styles/sdnb.css';
import '@/styles/login-page.css';

/**
 * Login — markup generated verbatim from `Login.dc.html` by
 * tools/dc-convert.mjs. The sign-in content stays standalone, while the
 * public navbar remains available as the entry point around it.
 *
 * Scope decision: the mockup also contains a *simulated* post-login dashboard
 * for Tata Usaha / Guru / Wali built on invented data. This app already has the
 * real dashboards behind /dashboard with real data and role permissions, so
 * only the sign-in screen is used here: `sudahMasuk` stays false and a
 * successful sign-in navigates to the real dashboard instead.
 *
 * Wiring: the mockup's in-memory credential check is replaced by the app's JWT
 * auth (`signInWithUsername`). The role tabs keep their design role — they set
 * the field label and placeholder — while the backend resolves the actual role.
 * Karena peran sebenarnya ditentukan backend, tab yang dipilih tidak membatasi
 * siapa yang boleh masuk; ia hanya memberi tahu apa yang harus diisi.
 */

/* Label dan contoh isian tiap tab HARUS sesuai dengan yang benar-benar diterima
 * backend. `resolveUser` di backend/internal/handler/auth.go mencari murid lewat
 * nomor induk (atau nama panggilan), lalu pegawai lewat **email** — tidak ada
 * jalur NIP dan tidak ada jalur nama pengguna.
 *
 * Sebelumnya tab Guru meminta "Nomor induk pegawai" dengan contoh 198703142009
 * dan tab Tata usaha meminta "Nama pengguna" dengan contoh tu.baturaja. Keduanya
 * dari mockup, dan keduanya tidak pernah bisa masuk: pegawai yang menuruti
 * labelnya selalu ditolak. Contoh emailnya memakai domain example.sch.id supaya
 * tidak menyodorkan alamat sekolah tertentu sebagai milik pembeli. */
/* Murid masuk memakai NAMA PANGGILAN, dan sandinya nomor induknya sendiri.
 * `resolveUser` menerima nisn, nis, nomor_induk, MAUPUN nama panggilan sebagai
 * nama pengguna, jadi keempatnya tetap bekerja — label ini menyebut yang dipilih
 * pemilik untuk diberitahukan ke murid. Nama panggilan yang sama dipakai dua
 * murid tidak jadi masalah: auth.go mengumpulkan semua kandidat lalu sandinya
 * yang memutuskan, dan sandi keduanya berbeda karena nomor induknya berbeda. */
const PERAN = [
  ['Orang tua', 'Nama panggilan murid', 'Contoh: Naila'],
  ['Guru', 'Email', 'Contoh: nama@example.sch.id'],
  ['Tata usaha', 'Email', 'Contoh: nama@example.sch.id'],
];

const LoginPage = () => {
  const [peran, setPeran] = useState('Orang tua');
  const [akun, setAkun] = useState('');
  const [sandi, setSandi] = useState('');
  const [lihat, setLihat] = useState(false);
  const [ingat, setIngat] = useState(true);
  const [toastMsg, setToastMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const toastTimer = useRef(null);

  const { signInWithUsername, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const pesan = useCallback((t) => {
    setToastMsg(t);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 2600);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Already signed in → straight to the real dashboard.
  useEffect(() => {
    if (user) navigate(location.state?.from?.pathname || '/dashboard', { replace: true });
  }, [user, navigate, location.state]);

  const cur = PERAN.find((p) => p[0] === peran) || PERAN[0];
  /* Cukup keduanya terisi. Ambang lama — nama pengguna lebih dari 3 huruf dan
   * sandi lebih dari 5 — mengunci akun yang sah begitu murid memakai nama
   * panggilan dan nomor induk: "Ani" hanya 3 huruf, dan NIS lima angka seperti
   * 26001 tidak akan pernah lolos, sehingga tombol Masuk tidak bisa ditekan
   * sama sekali. Panjang sandi yang sah ditentukan backend dan panel admin
   * (minimal 4 karakter saat dibuat), bukan diterka di halaman login. */
  const siap = akun.trim().length > 0 && sandi.length > 0;

  const masuk = async () => {
    if (!siap || busy) { if (!siap) pesan('Lengkapi akun dan kata sandi'); return; }
    setBusy(true);
    try {
      const { error } = await signInWithUsername(akun.trim(), sandi);
      if (error) { pesan(error.message || 'Akun atau kata sandi tidak cocok'); return; }
      if (ingat === false) {
        // "Ingat saya" unchecked: drop the refresh token so the session ends
        // when the tab closes; the access token stays in memory for this visit.
        try { localStorage.removeItem('refresh_token'); } catch { /* ignore */ }
      }
      navigate(location.state?.from?.pathname || '/dashboard', { replace: true });
    } catch (err) {
      pesan(err?.message || 'Gagal masuk, coba lagi');
    } finally {
      setBusy(false);
    }
  };

  const vals = {
    belumMasuk: true,
    sudahMasuk: false,

    peran: PERAN.map(([label]) => {
      const on = peran === label;
      return {
        label,
        aktif: on,
        pick: () => { setPeran(label); setAkun(''); setSandi(''); },
        style: on
          ? 'border:0;color:#fff;background:linear-gradient(135deg,var(--sekolah-aksen),var(--sekolah-aksen-tengah-2) 60%,var(--sekolah-aksen-ujung));box-shadow:0 14px 30px -14px rgba(110,120,255,.95)'
          : 'border:0;color:#a9b2ff;background:transparent',
      };
    }),

    labelAkun: cur[1],
    contohAkun: cur[2],
    ingat,
    nilaiAkun: akun,
    nilaiSandi: sandi,
    setAkun: (e) => setAkun(e.target.value),
    setSandi: (e) => setSandi(e.target.value),
    tipeSandi: lihat ? 'text' : 'password',
    toggleSandi: () => setLihat((v) => !v),
    toggleIngat: () => setIngat((v) => !v),
    kotakIngat: 'width:20px;height:20px;border-radius:7px;display:flex;align-items:center;justify-content:center;transition:background .25s ease,border-color .25s ease;' + (ingat
      ? 'background:linear-gradient(140deg,#8ee0b8,#a9b2ff);border:1px solid rgba(255,255,255,.6)'
      : 'background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.28)'),
    centangIngat: `opacity:${ingat ? '1' : '0'};transition:opacity .2s ease`,
    statusIsi: busy ? 'Memeriksa…' : siap ? 'Siap masuk' : 'Isi akun dan sandi',
    tombolMasuk: 'position:relative;overflow:hidden;margin-top:18px;width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 22px;border-radius:16px;border:0;font-family:inherit;font-size:15px;font-weight:800;letter-spacing:-.01em;color:#fff;background:linear-gradient(135deg,var(--sekolah-aksen),var(--sekolah-aksen-tengah) 55%,var(--sekolah-aksen-ujung));box-shadow:0 22px 46px -18px rgba(110,120,255,.95);transition:opacity .3s ease;' + (siap && !busy ? 'cursor:pointer;opacity:1' : 'cursor:not-allowed;opacity:.45'),
    masuk,

    // The mockup listed three demo accounts that auto-fill the form. Those
    // credentials only existed for the prototype and would fail against the
    // real backend, so the list is empty here (the section renders nothing).
    contoh: [],

    toastAda: !!toastMsg,
    toast: toastMsg,

    // Bindings used only by the mockup's simulated dashboard. `sudahMasuk` is
    // false so that branch never renders; these keep the markup safe.
    sesi: {}, kartu: [], pil: [], grup: [], subTab: [], barisTU: [], aksiTU: [], saring: [],
    guru: { murid: [] }, wali: { mini: [], tab: [], progres: [], isi: [] },
    isTU: false, isGuru: false, isWali: false,
    judul: '', sub: '', jumlahTU: '', kosongTU: false, tabAktif: '',
    modulMurid: [], modulLain: [], modulKet: '',
    setCari: () => {}, tambah: () => {}, keluar: () => {}, kembaliMurid: () => {},
  };

  return (
    <div className="sdnb sdnb-login">
      <JudulHalaman
        judul="Masuk"
        deskripsi="Masuk ke portal {sekolah} untuk orang tua, guru, dan tata usaha."
      />
      <SiteNav />
      {LoginBody(vals)}
    </div>
  );
};

export default LoginPage;
