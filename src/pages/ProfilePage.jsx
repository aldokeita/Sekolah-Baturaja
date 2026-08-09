import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import useSdnbMotion from '@/hooks/useSdnbMotion';
import useSchoolIdentity from '@/hooks/useSchoolIdentity';
import { fetchSantriCount } from '@/lib/dataMasterAdapters';
import { fetchPublicTeachers } from '@/lib/publicContentAdapters';
import { DEFAULT_PROFILE_CONTENT, fetchProfileContent } from '@/lib/profileContent';
import { inisialNama, sebutanStaf } from '@/lib/staf';
import '@/styles/sdnb.css';
import '@/styles/sdnb-profil.css';

/**
 * Ported VERBATIM from `Profil Sekolah.dc.html`.
 *
 * Sections, in the mockup's order: hero (`#profil`) with tilted photo cards and
 * a ticker marquee, the stat bar, the headmaster quote, `#visi` tabs
 * (Visi/Misi/Tujuan), the `Riwayat` timeline with a growing axis, the `#guru`
 * carousel with dots + profile modal, the `#fasilitas` mosaic with a lightbox,
 * and the identity/CTA pair. The footer (`#kontak`) comes from PublicLayout.
 *
 * All inline styles, copy and data arrays are copied from the mockup. The logic
 * class (`state`, `slide`, `movePerson`, `moveLight`, `measure`, autoplay,
 * keyboard handling) is reproduced with hooks; the computed style strings from
 * `renderVals()` are reproduced as objects with identical values.
 */

const HEADING_FONT = "'Plus Jakarta Sans','Archivo',system-ui,sans-serif";
const GRAD_TEXT = { background: 'linear-gradient(115deg,var(--sekolah-aksen-pekat),var(--sekolah-aksen-tengah-2) 48%,var(--sekolah-aksen-ujung))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent' };
const glass = { background: 'rgba(255,255,255,.5)', backdropFilter: 'blur(26px) saturate(185%)', WebkitBackdropFilter: 'blur(26px) saturate(185%)', border: '1px solid rgba(255,255,255,.75)' };
const kicker = { fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--sekolah-aksen-pekat)' };
const h2 = { margin: '10px 0 0', fontFamily: HEADING_FONT, fontSize: 38, lineHeight: 1.1, letterSpacing: '-.032em', fontWeight: 800, color: '#171827' };

/* Kartu guru: HANYA gradasi latarnya yang tinggal di kode.
 *
 * Nama, jabatan, dan fotonya datang dari Data Guru lewat GET /api/content/teachers
 * (publik, dan sudah mengecualikan akun admin serta superadmin di sisi server).
 * Sebelumnya di sini ada delapan guru karangan lengkap dengan surel palsu
 * seperti `rosmiati@sekolah.id` — pada salinan yang terjual, itu berarti halaman
 * Profil sekolah pembeli memperkenalkan orang-orang yang tidak ada. Pola yang
 * dipakai sama dengan halaman Kontak: teks dari basis data, gaya dari kode,
 * dipasangkan berdasarkan posisi. */
const ORANG_GRADASI = [
  ['var(--sekolah-aksen-muda)', 'var(--sekolah-aksen-samar)'],
  ['var(--sekolah-aksen)', 'var(--sekolah-aksen-tengah)'],
  ['var(--sekolah-aksen-tengah)', 'var(--sekolah-aksen-tengah-2)'],
  ['var(--sekolah-aksen-tengah-2)', 'var(--sekolah-aksen-ujung)'],
];

/* Teks halaman ini TIDAK lagi ditulis di berkas ini.
 *
 * Naratif (pembuka, riwayat, fasilitas, angka ringkasan, kutipan, data pokok)
 * disunting pembeli di panel Konten → Halaman Profil; lihat
 * src/lib/profileContent.js. Visi, misi, dan tujuan ada di panel Identitas
 * Sekolah karena ikut dipakai di luar halaman ini. Daftar guru dari Data Guru.
 *
 * Yang tinggal di bawah hanyalah GAYA VISUAL, dipasangkan dengan teks berdasarkan
 * posisi — jadi jumlah item boleh berubah dan tampilannya tetap konsisten. */

// Gradasi dan ukuran kotak mosaik fasilitas.
const FASILITAS_GAYA = [
  ['linear-gradient(150deg,#c6b6f6,#9fc4f8 60%,#a9eede)', 'span 2', 'span 2'],
  ['linear-gradient(150deg,#ffc9dc,#f2a9c8)', 'span 1', 'span 1'],
  ['linear-gradient(150deg,#bcd6ff,#9fb6f8)', 'span 1', 'span 1'],
  ['linear-gradient(150deg,#b6f0e0,#8fd8ec)', 'span 1', 'span 1'],
  ['linear-gradient(150deg,#ffe0b3,#ffc39c)', 'span 1', 'span 1'],
  ['linear-gradient(150deg,#c9e8ff,#a5c8f5)', 'span 2', 'span 1'],
  ['linear-gradient(150deg,#ffd8ea,#e8b6f0)', 'span 1', 'span 1'],
  ['linear-gradient(150deg,#d7d2ff,#b4b8f8)', 'span 1', 'span 1'],
];

// Gradasi tiap simpul garis waktu riwayat.
const RIWAYAT_GRADASI = [
  'var(--sekolah-aksen-pekat),var(--sekolah-aksen-tengah-2)',
  'var(--sekolah-aksen-tengah),var(--sekolah-aksen-ujung)',
  'var(--sekolah-aksen-tengah-2),var(--sekolah-aksen-ujung)',
  'var(--sekolah-aksen-ujung),var(--sekolah-aksen-hangat)',
];

// Gaya tiga kartu foto miring di pembuka: posisi, ukuran, sudut, dan gradasi.
const FOTO_GAYA = [
  { left: '2%', top: 44, width: '56%', height: 300, rotate: '-7deg', grad: 'linear-gradient(150deg,#c6b6f6,#9fc4f8 60%,#a9eede)' },
  { right: 0, top: 0, width: '50%', height: 260, rotate: '5deg', grad: 'linear-gradient(150deg,#ffc9dc,#f2a9c8)' },
  { right: '6%', bottom: 16, width: '52%', height: 250, rotate: '-3deg', grad: 'linear-gradient(150deg,#ffe0b3,#ffc39c 55%,#b6f0e0)' },
];

/**
 * Baris "Data pokok sekolah": yang otomatis dari identitas lebih dulu, lalu yang
 * ditentukan pembeli. Yang otomatis tidak ada di panel supaya tidak pernah basi
 * ketika identitas berubah; yang di panel adalah hal yang aplikasi tidak mungkin
 * tahu, seperti NPSN dan akreditasi. Baris tanpa nilai dibuang.
 */
const dataPokok = (sekolah, registry) => [
  ['Nama sekolah', sekolah.name],
  ['Tahun ajaran', sekolah.academicYear],
  ['Jam layanan', sekolah.officeHours],
  ...registry.map((r) => [r.label, r.value]),
].filter(([, nilai]) => String(nilai || '').trim());

/**
 * Angka yang dihitung naik dari nol ketika masuk pandangan (lihat useSdnbMotion).
 *
 * Hanya nilai yang seluruhnya angka yang dianimasikan; sisanya ditampilkan apa
 * adanya. Pembeli bebas mengisi kolom angka dengan "sekitar 600" atau "±18", dan
 * teks semacam itu tidak boleh berubah menjadi NaN.
 *
 * `plain` menekan pemisah ribuan, dipakai untuk tahun supaya 1966 tidak tampil
 * sebagai 1.966.
 */
const angkaHitung = (nilai, plain = false) => {
  const teks = String(nilai ?? '').trim();
  if (!/^\d+$/.test(teks)) return teks;
  return <span data-count={teks} {...(plain ? { 'data-plain': '1' } : {})}>0</span>;
};

const AKSEN_GRADASI = { ...GRAD_TEXT, background: 'linear-gradient(115deg,var(--sekolah-aksen-pekat),var(--sekolah-aksen-tengah-2) 45%,var(--sekolah-aksen-ujung))' };

/**
 * Memecah teks pada tanda bintang dan mewarnai bagian di dalamnya dengan aksen.
 *
 * "membawa *kecepatan belajarnya sendiri*." → bagian di antara bintang tampil
 * bergradasi. Ini memberi pembeli kendali atas kalimat besar di halaman Profil
 * tanpa kehilangan aksen warna yang jadi ciri desainnya. Bintang yang tidak
 * berpasangan cuma ikut tampil sebagai teks biasa, bukan merusak halaman.
 */
const teksBeraksen = (teks) => String(teks ?? '')
  .split(/\*([^*]+)\*/g)
  .map((bagian, i) => (i % 2 === 1
    ? <span key={i} style={AKSEN_GRADASI}>{bagian}</span>
    : bagian));

const PersonSvg = ({ size, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="rgba(255,255,255,.9)" style={style}><circle cx="12" cy="8.4" r="4" /><path d="M3.6 22c.6-4.6 4.2-7.2 8.4-7.2s7.8 2.6 8.4 7.2z" /></svg>
);

const FotoDenganFallback = ({ src, alt, imageStyle, loading = 'lazy', children }) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => setHasError(false), [src]);

  return (
    <>
      {children}
      {src && !hasError && (
        <img
          src={src}
          alt={alt}
          loading={loading}
          style={imageStyle}
          onError={() => setHasError(true)}
        />
      )}
    </>
  );
};

const TiltCard = ({ style, label, imageUrl }) => (
  <div className="tilt" style={style}>
    {imageUrl && <img src={imageUrl} alt={`${label} — foto kartu pembuka`} style={{ position: 'absolute', inset: 0, zIndex: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(110% 70% at 25% 12%,rgba(255,255,255,.55),rgba(255,255,255,0) 60%)' }} />
    <div style={{ position: 'absolute', left: 14, bottom: 14, zIndex: 1, padding: '7px 12px', borderRadius: 11, fontSize: 11.5, fontWeight: 700, color: '#2c2f4d', background: 'rgba(255,255,255,.6)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,.85)' }}>{label}</div>
  </div>
);

const ProfilePage = () => {
  const sekolah = useSchoolIdentity();
  const [tab, setTab] = useState('visi');
  const [gIdx, setGIdx] = useState(0);
  const [person, setPerson] = useState(-1);
  const [light, setLight] = useState(-1);
  const [perView, setPerView] = useState(4);
  const [staf, setStaf] = useState([]);
  const [stafStatus, setStafStatus] = useState('loading');
  const [stafError, setStafError] = useState(null);
  const [jumlahMurid, setJumlahMurid] = useState({ status: 'loading', total: null, error: null });
  // Bawaan dipakai lebih dulu supaya halaman tidak kosong selagi menunggu server.
  const [isi, setIsi] = useState(DEFAULT_PROFILE_CONTENT);
  const vpRef = useRef(null);
  const pausedRef = useRef(false);
  const stafRequestRef = useRef(0);
  const muridRequestRef = useRef(0);

  useEffect(() => {
    let aktif = true;
    fetchProfileContent()
      .then((tersimpan) => { if (aktif && tersimpan) setIsi(tersimpan); })
      .catch(() => { /* bawaan tetap tampil */ });
    return () => { aktif = false; };
  }, []);

  const loadJumlahMurid = useCallback(async ({ initial = false } = {}) => {
    const requestId = ++muridRequestRef.current;
    setJumlahMurid((prev) => ({
      ...prev,
      status: initial || prev.total === null ? 'loading' : prev.status,
      error: null,
    }));

    try {
      const result = await fetchSantriCount();
      const total = Number(result?.total);
      if (!Number.isInteger(total) || total < 0) throw new Error('Jumlah murid tidak valid.');
      if (requestId !== muridRequestRef.current) return;
      setJumlahMurid({ status: total === 0 ? 'empty' : 'ready', total, error: null });
    } catch {
      if (requestId !== muridRequestRef.current) return;
      setJumlahMurid((prev) => ({
        ...prev,
        status: prev.total === null ? 'error' : prev.status,
        error: 'Jumlah murid aktif belum dapat dimuat.',
      }));
    }
  }, []);

  useEffect(() => {
    loadJumlahMurid({ initial: true });
    const refresh = () => {
      if (document.visibilityState !== 'hidden') loadJumlahMurid();
    };
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      muridRequestRef.current += 1;
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [loadJumlahMurid]);

  const loadStaf = useCallback(async ({ initial = false } = {}) => {
    const requestId = ++stafRequestRef.current;
    if (initial) setStafStatus('loading');
    setStafError(null);

    try {
      const rows = await fetchPublicTeachers();
      if (!Array.isArray(rows)) throw new Error('Format daftar guru tidak valid.');
      if (requestId !== stafRequestRef.current) return;
      setStaf(rows);
      setStafStatus(rows.length > 0 ? 'ready' : 'empty');
    } catch {
      if (requestId !== stafRequestRef.current) return;
      setStafStatus((prev) => (prev === 'loading' ? 'error' : prev));
      setStafError('Daftar guru dan staf belum dapat dimuat.');
    }
  }, []);

  useEffect(() => {
    loadStaf({ initial: true });
    const refresh = () => {
      if (document.visibilityState !== 'hidden') loadStaf();
    };
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      stafRequestRef.current += 1;
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [loadStaf]);

  // Data guru dipasangkan dengan gradasi berdasarkan posisi, sama seperti kartu
  // program di halaman depan.
  const tim = useMemo(() => staf.map((g, i) => {
    const nama = String(g.nama || '').trim();
    const [dari, ke] = ORANG_GRADASI[i % ORANG_GRADASI.length];
    return {
      nama,
      peran: sebutanStaf(g),
      inisial: inisialNama(nama),
      foto: String(g.foto_url || '').trim(),
      gradasi: `linear-gradient(150deg,${dari},${ke})`,
      // Hanya fakta yang benar-benar ada di basis data. Kolom "pendidikan",
      // "masa kerja", dan "sertifikasi" pada versi lama semuanya karangan.
      rincian: [
        ['Jabatan', sebutanStaf(g)],
        ...(g.jenis_kelamin ? [['Jenis kelamin', g.jenis_kelamin]] : []),
        ['Kontak sekolah', sekolah.email],
        ['Jam layanan', sekolah.officeHours],
      ],
    };
  }), [staf, sekolah.email, sekolah.officeHours]);

  const kepalaSekolah = useMemo(
    () => tim.find((t) => /kepala\s+sekolah/i.test(t.peran) && !/wakil/i.test(t.peran)) || null,
    [tim],
  );

  useSdnbMotion([tim.length]);

  // measure()
  useEffect(() => {
    const measure = () => {
      const w = vpRef.current ? vpRef.current.clientWidth : 1180;
      const per = Math.max(1, Math.floor((w + 20) / 308));
      setPerView((prev) => (per !== prev ? per : prev));
      setGIdx((prev) => (per !== perView ? 0 : prev));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slide = useCallback((dir) => {
    setGIdx((prev) => {
      const max = Math.max(0, tim.length - perView);
      let n = prev + dir;
      if (n > max) n = 0;
      if (n < 0) n = max;
      return n;
    });
    // tim.length ikut karena jumlah guru datang dari server setelah render pertama.
  }, [perView, tim.length]);

  // autoplay every 4200ms, paused on hover or while a modal is open
  useEffect(() => {
    const id = setInterval(() => {
      if (pausedRef.current || person >= 0 || light >= 0) return;
      slide(1);
    }, 4200);
    return () => clearInterval(id);
  }, [slide, person, light]);

  // keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { setPerson(-1); setLight(-1); }
      if (light >= 0 && e.key === 'ArrowRight') setLight((p) => (p + 1 + isi.facilities.length) % isi.facilities.length);
      if (light >= 0 && e.key === 'ArrowLeft') setLight((p) => (p - 1 + isi.facilities.length) % isi.facilities.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [light, isi.facilities.length]);

  const movePerson = (dir) => setPerson((p) => (p + dir + tim.length) % tim.length);
  const moveLight = (dir) => setLight((p) => (p + dir + isi.facilities.length) % isi.facilities.length);
  const closeAll = () => { setPerson(-1); setLight(-1); };

  const tabKeys = ['visi', 'misi', 'tujuan'];
  const tabIdx = tabKeys.indexOf(tab);
  const PILL_W = 118;

  const p = person >= 0 ? tim[person] : null;
  const l = light >= 0 ? isi.facilities[light] : null;
  const dotCount = Math.max(1, tim.length - perView + 1);
  const badgeValue = jumlahMurid.status === 'loading'
    ? '…'
    : jumlahMurid.total === null ? '—' : String(jumlahMurid.total);
  const badgeLabel = jumlahMurid.status === 'loading'
    ? 'memuat jumlah murid'
    : jumlahMurid.status === 'empty'
      ? 'belum ada murid aktif'
      : jumlahMurid.status === 'error' && jumlahMurid.total === null
        ? 'jumlah murid tidak tersedia'
        : isi.hero.badgeLabel;
  const kepalaAvatarUrl = String(isi.quoteAvatarUrl || kepalaSekolah?.foto || '').trim();

  return (
    <div className="sdnb-profil">
      <Helmet>
        <title>{`Profil Sekolah — ${sekolah.name}`}</title>
        <meta name="description" content={`Profil, visi misi, riwayat, guru dan staf, serta fasilitas ${sekolah.name}.`} />
      </Helmet>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section id="profil" style={{ position: 'relative', maxWidth: 1240, margin: '0 auto', padding: '18px 28px 0' }}>
        <div aria-hidden="true" className="sdnb-profil-mark" style={{ position: 'absolute', left: 14, top: -16, fontFamily: HEADING_FONT, fontSize: 200, fontWeight: 800, letterSpacing: '-.045em', lineHeight: 1, pointerEvents: 'none', userSelect: 'none' }}>PROFIL</div>

        <div className="sdnb-profil-hero" style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1.06fr .94fr', gap: 40, alignItems: 'center', minHeight: 520 }}>
          <div data-reveal="0">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 2, background: 'linear-gradient(90deg,var(--sekolah-aksen-pekat),var(--sekolah-aksen-ujung))' }} />
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--sekolah-aksen-pekat)' }}>{isi.hero.kicker}</span>
            </div>
            <h1 style={{ margin: '22px 0 0', fontFamily: HEADING_FONT, lineHeight: .98, letterSpacing: '-.045em', color: '#171827' }}>
              <span style={{ display: 'block', fontSize: 34, fontWeight: 500, color: '#6a6f95', letterSpacing: '-.02em' }}>{isi.hero.titleTop}</span>
              <span style={{ display: 'block', fontSize: 74, fontWeight: 800 }}>{isi.hero.titleMain}</span>
              <span style={{ display: 'block', fontSize: 74, fontWeight: 800, ...GRAD_TEXT, background: 'linear-gradient(115deg,var(--sekolah-aksen-pekat),var(--sekolah-aksen-tengah-2) 45%,var(--sekolah-aksen-ujung))' }}>{isi.hero.titleAccent}</span>
            </h1>
            <p style={{ margin: '26px 0 0', maxWidth: 470, fontSize: 16, lineHeight: 1.68, color: '#535878', textWrap: 'pretty' }}>{isi.hero.story}</p>
            <div style={{ marginTop: 30, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <a href="#visi" className="shine" style={{ position: 'relative', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', gap: 9, padding: '14px 24px', borderRadius: 16, fontSize: 14.5, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,var(--sekolah-aksen-pekat),var(--sekolah-aksen-tengah) 55%,var(--sekolah-aksen-ujung))', boxShadow: '0 22px 44px -16px rgba(90,100,235,.95),inset 0 1px 0 rgba(255,255,255,.6)' }}>Visi dan misi</a>
              <a href="#guru" className="shine" style={{ position: 'relative', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', gap: 9, padding: '14px 22px', borderRadius: 16, fontSize: 14.5, fontWeight: 700, color: '#33375a', background: 'rgba(255,255,255,.6)', border: '1px solid rgba(255,255,255,.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: '0 18px 38px -18px rgba(60,70,120,.7),inset 0 1px 0 rgba(255,255,255,.95)' }}>Kenali para guru</a>
            </div>
          </div>

          <div style={{ position: 'relative', height: 520 }}>
            {isi.photos.slice(0, FOTO_GAYA.length).map((f, i) => {
              const g = FOTO_GAYA[i];
              return (
                <TiltCard
                  key={`${f.label}-${i}`}
                  label={f.label}
                  imageUrl={f.image_url}
                  style={{
                    position: 'absolute', left: g.left, right: g.right, top: g.top, bottom: g.bottom,
                    width: g.width, height: g.height, borderRadius: 26, overflow: 'hidden',
                    transform: `rotate(${g.rotate})`, background: g.grad,
                    border: '1px solid rgba(255,255,255,.75)',
                    boxShadow: '0 34px 66px -24px rgba(55,65,120,.62),inset 0 1px 0 rgba(255,255,255,.85)',
                  }}
                />
              );
            })}
            <div aria-live="polite" aria-busy={jumlahMurid.status === 'loading'} data-student-count-state={jumlahMurid.status} style={{ position: 'absolute', left: 0, bottom: 70, padding: '14px 18px', borderRadius: 18, background: 'rgba(255,255,255,.58)', backdropFilter: 'blur(24px) saturate(185%)', WebkitBackdropFilter: 'blur(24px) saturate(185%)', border: '1px solid rgba(255,255,255,.85)', boxShadow: '0 24px 50px -20px rgba(55,65,120,.6),inset 0 1px 0 rgba(255,255,255,.95)', animation: 'floaty 9s ease-in-out infinite' }}>
              <div style={{ fontFamily: HEADING_FONT, fontSize: 28, fontWeight: 800, letterSpacing: '-.03em', color: '#1d1f33' }}>
                {angkaHitung(badgeValue)}
              </div>
              <div style={{ fontSize: 11.5, color: '#6d7192' }}>{badgeLabel}</div>
              {jumlahMurid.error && (
                <div role="alert" style={{ marginTop: 6, maxWidth: 150, fontSize: 10.5, lineHeight: 1.35, color: '#9b435b' }}>
                  {jumlahMurid.error}
                  <button type="button" onClick={() => loadJumlahMurid()} style={{ display: 'block', marginTop: 3, padding: 0, border: 0, background: 'none', color: 'var(--sekolah-aksen-pekat)', font: 'inherit', fontWeight: 700, cursor: 'pointer' }}>Coba lagi</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mq-wrap" style={{ marginTop: 26, overflow: 'hidden', padding: '6px 0', WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 5%,#000 95%,transparent)', maskImage: 'linear-gradient(90deg,transparent,#000 5%,#000 95%,transparent)', borderTop: '1px solid rgba(255,255,255,.8)', borderBottom: '1px solid rgba(255,255,255,.8)' }}>
          <div className="mq-track" style={{ padding: '10px 7px' }}>
            {/* Digandakan supaya animasi berjalannya tampak tanpa jeda. */}
            {[...isi.ticker, ...isi.ticker].map((w, i) => (
              <span key={i} style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, color: '#4d5273', whiteSpace: 'nowrap' }}>
                <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: '50%', background: 'linear-gradient(135deg,var(--sekolah-aksen),var(--sekolah-aksen-ujung))' }} />
                {w}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── STAT BAR ─────────────────────────────────────────────────────── */}
      <section data-reveal="0" style={{ maxWidth: 1240, margin: '0 auto', padding: '44px 28px 0' }}>
        {/* Jumlah kolom mengikuti jumlah angka yang diisi pembeli, bukan tetap empat. */}
        <div className="sdnb-profil-stats" style={{ ...glass, position: 'relative', overflow: 'hidden', display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, isi.stats.length)},1fr)`, borderRadius: 26, boxShadow: '0 28px 60px -24px rgba(55,65,120,.55),inset 0 1px 0 rgba(255,255,255,.95)' }}>
          <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '52%', background: 'linear-gradient(168deg,rgba(255,255,255,.6),rgba(255,255,255,0))', pointerEvents: 'none' }} />
          {isi.stats.map((s, i) => (
            <div key={`${s.label}-${i}`} style={{ position: 'relative', padding: '26px 28px' }}>
              <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-.035em', color: '#1d1f33' }}>
                {angkaHitung(s.value, s.plain)}{s.suffix}
              </div>
              <div style={{ marginTop: 3, fontSize: 12.5, color: '#63678a' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── QUOTE ────────────────────────────────────────────────────────── */}
      <section data-reveal="0" style={{ maxWidth: 1080, margin: '0 auto', padding: '92px 28px 0' }}>
        <div className="sdnb-profil-quote" style={{ display: 'flex', alignItems: 'flex-start', gap: 24 }}>
          <div aria-hidden="true" style={{ flex: 'none', marginTop: -26, fontFamily: HEADING_FONT, fontSize: 150, lineHeight: .7, fontWeight: 800, background: 'linear-gradient(150deg,var(--sekolah-aksen-pekat),var(--sekolah-aksen-ujung))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent', userSelect: 'none' }}>&ldquo;</div>
          <div>
            <p style={{ margin: 0, fontFamily: HEADING_FONT, fontSize: 'clamp(24px,2.6vw,36px)', lineHeight: 1.36, letterSpacing: '-.028em', fontWeight: 700, color: '#22243c', textWrap: 'pretty' }}>
              {teksBeraksen(isi.quoteLead)}
            </p>
            {isi.quote.map((paragraf, i) => (
              <p key={i} style={{ margin: i === 0 ? '26px 0 0' : '16px 0 0', maxWidth: 760, fontSize: 16, lineHeight: 1.72, color: '#535878', textWrap: 'pretty' }}>{paragraf}</p>
            ))}
          </div>
          <div aria-hidden="true" style={{ flex: 'none', alignSelf: 'flex-end', fontFamily: HEADING_FONT, fontSize: 150, lineHeight: .7, fontWeight: 800, background: 'linear-gradient(150deg,var(--sekolah-aksen-ujung),var(--sekolah-aksen-pekat))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent', userSelect: 'none' }}>&rdquo;</div>
        </div>

        <div style={{ marginTop: 36, marginLeft: 64, display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ position: 'relative', flex: 'none', width: 96, height: 96, borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(140deg,#c6b6f6,#9fc4f8 60%,#a9eede)', boxShadow: '0 20px 40px -16px rgba(60,70,140,.55)' }}>
            <FotoDenganFallback
              src={kepalaAvatarUrl}
              alt={`Avatar ${kepalaSekolah ? kepalaSekolah.nama : sekolah.name}`}
              loading="eager"
              imageStyle={{ position: 'absolute', inset: 0, zIndex: 1, width: '100%', height: '100%', objectFit: 'cover' }}
            >
              <div style={{ position: 'absolute', inset: 0, zIndex: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}><PersonSvg size={66} /></div>
            </FotoDenganFallback>
          </div>
          {/* Penanda tangan kutipan diambil dari Data Guru: baris yang jabatannya
              memuat "Kepala Sekolah". Kalau sekolah belum mengisinya, yang tampil
              adalah nama sekolah — bukan nama orang karangan seperti versi lama. */}
          <div>
            <div style={{ fontFamily: HEADING_FONT, fontSize: 20, fontWeight: 800, letterSpacing: '-.02em', color: '#1b1c2c' }}>
              {kepalaSekolah ? kepalaSekolah.nama : sekolah.name}
            </div>
            <div style={{ marginTop: 3, fontSize: 13.5, color: '#6b7093' }}>
              {kepalaSekolah ? kepalaSekolah.peran : 'Kepala Sekolah'}
            </div>
            <div style={{ marginTop: 10, width: 120, height: 2, background: 'linear-gradient(90deg,var(--sekolah-aksen-pekat),var(--sekolah-aksen-ujung))' }} />
          </div>
        </div>
      </section>

      {/* ── VISI / MISI / TUJUAN ─────────────────────────────────────────── */}
      <section id="visi" data-reveal="0" style={{ maxWidth: 1240, margin: '0 auto', padding: '92px 28px 0' }}>
        <div style={kicker}>Arah sekolah</div>
        <h2 style={h2}>Visi, misi, dan <span style={GRAD_TEXT}>tujuan</span></h2>

        <div style={{ marginTop: 26, position: 'relative', display: 'inline-flex', padding: 5, borderRadius: 18, background: 'rgba(255,255,255,.55)', border: '1px solid rgba(255,255,255,.9)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.95),0 14px 30px -18px rgba(60,70,120,.6)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
          <div style={{ position: 'absolute', top: 5, bottom: 5, left: 5, width: PILL_W, borderRadius: 14, background: 'linear-gradient(135deg,var(--sekolah-aksen),var(--sekolah-aksen-tengah-2) 60%,var(--sekolah-aksen-ujung))', boxShadow: '0 14px 28px -12px rgba(95,105,235,.95),inset 0 1px 0 rgba(255,255,255,.5)', transform: `translateX(${tabIdx * PILL_W}px)`, transition: 'transform .42s cubic-bezier(.5,1.4,.4,1)' }} />
          {[['visi', 'Visi'], ['misi', 'Misi'], ['tujuan', 'Tujuan']].map(([k, label]) => (
            <button key={k} type="button" onClick={() => setTab(k)} style={{ position: 'relative', zIndex: 1, width: PILL_W, padding: '12px 0', border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, transition: 'color .3s ease', color: tab === k ? '#fff' : '#4a4f74' }}>{label}</button>
          ))}
        </div>

        <div style={{ ...glass, marginTop: 20, position: 'relative', overflow: 'hidden', padding: '36px 38px', borderRadius: 26, boxShadow: '0 28px 60px -24px rgba(55,65,120,.55),inset 0 1px 0 rgba(255,255,255,.95)' }}>
          <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', background: 'linear-gradient(168deg,rgba(255,255,255,.58),rgba(255,255,255,0))', pointerEvents: 'none' }} />
          {tab === 'visi' && (
            <p className="tabpane" style={{ position: 'relative', margin: 0, maxWidth: 900, fontFamily: HEADING_FONT, fontSize: 26, lineHeight: 1.42, letterSpacing: '-.02em', fontWeight: 700, color: '#22243c', textWrap: 'pretty' }}>{sekolah.vision}</p>
          )}
          {tab === 'misi' && (
            <div className="tabpane sdnb-profil-misi" style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              {sekolah.missions.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '16px 18px', borderRadius: 16, background: 'rgba(255,255,255,.55)', border: '1px solid rgba(255,255,255,.9)' }}>
                  <div style={{ flex: 'none', width: 28, height: 28, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 800, color: '#fff', background: 'linear-gradient(135deg,var(--sekolah-aksen),var(--sekolah-aksen-tengah-2))', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.5)' }}>{i + 1}</div>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#3f4468' }}>{t}</p>
                </div>
              ))}
            </div>
          )}
          {tab === 'tujuan' && (
            <div className="tabpane" style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {sekolah.goals.map((t2, i) => (
                <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ flex: 'none', marginTop: 6, width: 8, height: 8, borderRadius: '50%', background: 'linear-gradient(135deg,var(--sekolah-aksen),var(--sekolah-aksen-ujung))' }} />
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.62, color: '#3f4468' }}>{t2}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── RIWAYAT (timeline) ───────────────────────────────────────────── */}
      <section data-reveal="0" style={{ maxWidth: 1240, margin: '0 auto', padding: '92px 28px 0' }}>
        <div style={kicker}>Riwayat</div>
        <h2 style={h2}>Perjalanan sekolah</h2>

        <div style={{ position: 'relative', marginTop: 44 }}>
          <div className="tl-axis" aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 2, background: 'rgba(120,132,160,.18)', borderRadius: 2 }} />
          <div className="tl-axis" data-grow="1" aria-hidden="true" style={{ position: 'absolute', left: 0, top: '50%', height: 2, width: 0, background: 'linear-gradient(90deg,var(--sekolah-aksen-pekat),var(--sekolah-aksen-tengah-2) 55%,var(--sekolah-aksen-ujung))', borderRadius: 2, transition: 'width 1.6s cubic-bezier(.25,.8,.3,1)', boxShadow: '0 0 14px rgba(120,132,255,.55)' }} />
          <div className="tl-row">
            {isi.history.map(({ year: tahun, text: teks }, i) => {
              const grad = RIWAYAT_GRADASI[i % RIWAYAT_GRADASI.length];
              return (
              <div key={`${tahun}-${i}`} className={`tl-col ${i % 2 === 0 ? 'tl-up' : 'tl-dn'}`} style={{ display: 'flex', flexDirection: i % 2 === 0 ? 'column' : 'column-reverse', alignItems: 'center', position: 'relative', padding: '0 10px' }}>
                <div className="tl-card lift" style={{ position: 'relative', overflow: 'hidden', padding: 22, borderRadius: 22, background: 'rgba(255,255,255,.55)', backdropFilter: 'blur(26px) saturate(185%)', WebkitBackdropFilter: 'blur(26px) saturate(185%)', border: '1px solid rgba(255,255,255,.8)', boxShadow: '0 24px 52px -22px rgba(55,65,120,.55),inset 0 1px 0 rgba(255,255,255,.95)' }}>
                  <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%', background: 'linear-gradient(166deg,rgba(255,255,255,.6),rgba(255,255,255,0))', pointerEvents: 'none' }} />
                  <div style={{ position: 'relative', fontFamily: HEADING_FONT, fontSize: 30, fontWeight: 800, letterSpacing: '-.035em', background: `linear-gradient(115deg,${grad})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent' }}>{tahun}</div>
                  <p style={{ position: 'relative', margin: '10px 0 0', fontSize: 13.5, lineHeight: 1.62, color: '#4d5273' }}>{teks}</p>
                </div>
                <div aria-hidden="true" style={{ flex: 'none', width: 16, height: 16, borderRadius: '50%', margin: i % 2 === 0 ? '26px 0 0' : '0 0 26px', background: `linear-gradient(135deg,${grad})`, border: '3px solid rgba(255,255,255,.95)', boxShadow: '0 0 0 5px rgba(120,132,255,.14),0 8px 18px -6px rgba(80,90,190,.7)' }} />
              </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── GURU (carousel) ──────────────────────────────────────────────── */}
      <section id="guru" data-reveal="0" style={{ maxWidth: 1240, margin: '0 auto', padding: '92px 28px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={kicker}>Tim</div>
            <h2 style={h2}>Guru dan staf</h2>
            {/* Jumlahnya dihitung dari data guru, bukan angka tetap. Versi lama
                menuliskan "tiga puluh empat orang" walau datanya berapa pun. */}
            <p
              role={stafStatus === 'error' ? 'alert' : undefined}
              aria-live="polite"
              style={{ margin: '12px 0 0', maxWidth: 440, fontSize: 14, lineHeight: 1.6, color: '#5b6082' }}
            >
              {stafStatus === 'loading'
                ? 'Memuat daftar guru dan staf…'
                : stafStatus === 'error'
                  ? stafError
                  : tim.length > 0
                    ? `${tim.length} guru dan tenaga kependidikan. Klik kartu untuk melihat rinciannya.`
                    : 'Daftar guru dan staf belum diisi.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => slide(-1)} className="shine h-glass92" aria-label="Sebelumnya" style={{ position: 'relative', overflow: 'hidden', width: 48, height: 48, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid rgba(255,255,255,.9)', background: 'rgba(255,255,255,.62)', boxShadow: '0 14px 30px -14px rgba(60,70,120,.7),inset 0 1px 0 rgba(255,255,255,.95)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#404568" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <button type="button" onClick={() => slide(1)} className="shine" aria-label="Berikutnya" style={{ position: 'relative', overflow: 'hidden', width: 48, height: 48, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 0, background: 'linear-gradient(135deg,var(--sekolah-aksen),var(--sekolah-aksen-tengah) 55%,var(--sekolah-aksen-ujung))', boxShadow: '0 16px 34px -14px rgba(95,105,235,.95),inset 0 1px 0 rgba(255,255,255,.55)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </div>
        </div>

        <div
          id="guru-viewport"
          ref={vpRef}
          onMouseEnter={() => { pausedRef.current = true; }}
          onMouseLeave={() => { pausedRef.current = false; }}
          style={{ marginTop: 28, overflow: 'hidden', padding: '8px 2px 64px' }}
        >
          <div style={{ display: 'flex', gap: 20, transition: 'transform .62s cubic-bezier(.3,.9,.3,1)', transform: `translate3d(${-gIdx * 308}px,0,0)` }}>
            {tim.map((t, i) => (
              <div key={`${t.nama}-${i}`} onClick={() => setPerson(i)} className="lift" style={{ flex: 'none', width: 288, cursor: 'pointer', position: 'relative', overflow: 'hidden', borderRadius: 26, background: 'rgba(255,255,255,.52)', backdropFilter: 'blur(26px) saturate(185%)', WebkitBackdropFilter: 'blur(26px) saturate(185%)', border: '1px solid rgba(255,255,255,.8)', boxShadow: '0 26px 56px -22px rgba(55,65,120,.55),inset 0 1px 0 rgba(255,255,255,.95)' }}>
                <div style={{ position: 'relative', height: 210, overflow: 'hidden', background: t.gradasi }}>
                  <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(110% 70% at 25% 12%,rgba(255,255,255,.5),rgba(255,255,255,0) 60%)' }} />
                  {/* Foto asli berasal dari profil guru; fallback menjaga komposisi
                      kartu tetap utuh bila foto belum tersedia atau gagal dimuat. */}
                  <FotoDenganFallback
                    src={t.foto}
                    alt={t.nama}
                    imageStyle={{ position: 'absolute', inset: 0, zIndex: 1, width: '100%', height: '100%', objectFit: 'cover' }}
                  >
                    <PersonSvg size={120} style={{ position: 'absolute', zIndex: 0, left: '50%', bottom: -6, transform: 'translateX(-50%)' }} />
                  </FotoDenganFallback>
                  <div style={{ position: 'absolute', left: 14, top: 14, padding: '6px 11px', borderRadius: 10, fontSize: 11, fontWeight: 800, letterSpacing: '.04em', color: '#2c2f4d', background: 'rgba(255,255,255,.62)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,.85)' }}>{t.inisial}</div>
                </div>
                <div style={{ position: 'relative', padding: '20px 22px 22px' }}>
                  <div style={{ fontFamily: HEADING_FONT, fontSize: 16, fontWeight: 800, letterSpacing: '-.018em', color: '#1e2035' }}>{t.nama}</div>
                  <div style={{ marginTop: 4, fontSize: 12.5, fontWeight: 600, color: '#6b7093' }}>{t.peran}</div>
                  <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.85)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--sekolah-aksen-pekat)' }}>Lihat profil
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 7, marginTop: -38 }}>
          {Array.from({ length: dotCount }).map((_, i) => (
            <button key={i} type="button" onClick={() => setGIdx(i)} aria-label="Geser" style={{ width: i === gIdx ? 26 : 8, height: 8, borderRadius: 99, border: 0, cursor: 'pointer', padding: 0, transition: 'width .35s cubic-bezier(.4,1.3,.4,1),background .3s ease', background: i === gIdx ? 'linear-gradient(90deg,var(--sekolah-aksen),var(--sekolah-aksen-ujung))' : 'rgba(120,130,175,.3)' }} />
          ))}
        </div>
      </section>

      {/* ── FASILITAS ────────────────────────────────────────────────────── */}
      <section id="fasilitas" data-reveal="0" style={{ maxWidth: 1240, margin: '0 auto', padding: '92px 28px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={kicker}>Fasilitas</div>
            <h2 style={h2}>Keliling <span style={GRAD_TEXT}>sekolah</span></h2>
          </div>
          <p style={{ maxWidth: 330, margin: 0, fontSize: 14, lineHeight: 1.6, color: '#5b6082' }}>Klik salah satu foto untuk memperbesar dan membaca keterangannya.</p>
        </div>

        <div className="sdnb-profil-fasilitas" style={{ marginTop: 28, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gridAutoRows: 170, gap: 16 }}>
          {isi.facilities.map((f, i) => {
            const [grad, kolom, baris] = FASILITAS_GAYA[i % FASILITAS_GAYA.length];
            return (
            <div key={`${f.name}-${i}`} onClick={() => setLight(i)} className="gtile" style={{ gridColumn: kolom, gridRow: baris, position: 'relative', overflow: 'hidden', borderRadius: 22, cursor: 'pointer', border: '1px solid rgba(255,255,255,.72)', boxShadow: '0 26px 54px -22px rgba(55,65,120,.58),inset 0 1px 0 rgba(255,255,255,.8)' }}>
              <div className="gfill" style={{ position: 'absolute', inset: 0, background: grad }} />
              <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(110% 70% at 25% 12%,rgba(255,255,255,.5),rgba(255,255,255,0) 60%)' }} />
              <div style={{ position: 'absolute', left: 14, bottom: 14, padding: '7px 12px', borderRadius: 11, fontSize: 12, fontWeight: 700, color: '#2c2f4d', background: 'rgba(255,255,255,.6)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,.85)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.95)' }}>{f.name}</div>
              <div style={{ position: 'absolute', right: 12, top: 12, width: 30, height: 30, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.55)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,.85)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3c4166" strokeWidth="2.6" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /><path d="M11 8v6" /><path d="M8 11h6" /></svg>
              </div>
            </div>
            );
          })}
        </div>
      </section>

      {/* ── IDENTITAS + CTA ──────────────────────────────────────────────── */}
      <section data-reveal="0" className="sdnb-profil-bottom" style={{ maxWidth: 1240, margin: '0 auto', padding: '92px 28px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 26, alignItems: 'start' }}>
        <div style={{ ...glass, position: 'relative', overflow: 'hidden', padding: '30px 32px', borderRadius: 26, boxShadow: '0 28px 60px -24px rgba(55,65,120,.55),inset 0 1px 0 rgba(255,255,255,.95)' }}>
          <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', background: 'linear-gradient(168deg,rgba(255,255,255,.58),rgba(255,255,255,0))', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', ...kicker }}>Identitas</div>
          <h3 style={{ position: 'relative', margin: '10px 0 0', fontSize: 22, fontWeight: 800, letterSpacing: '-.022em', color: '#1b1c2c' }}>Data pokok sekolah</h3>
          <div style={{ position: 'relative', marginTop: 20, display: 'flex', flexDirection: 'column' }}>
            {dataPokok(sekolah, isi.registry).map(([label, nilai]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 20, padding: '13px 2px', borderBottom: '1px solid rgba(255,255,255,.75)' }}>
                <span style={{ flex: 'none', fontSize: 13, color: '#6b7093' }}>{label}</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#1e2035', textAlign: 'right' }}>{nilai}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative', overflow: 'hidden', padding: '34px 36px', borderRadius: 26, background: 'linear-gradient(135deg,rgba(120,132,255,.9),rgba(160,120,240,.85) 48%,rgba(240,150,196,.85))', border: '1px solid rgba(255,255,255,.55)', boxShadow: '0 30px 62px -24px rgba(80,90,190,.75),inset 0 1px 0 rgba(255,255,255,.6)' }}>
          <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '52%', background: 'linear-gradient(168deg,rgba(255,255,255,.4),rgba(255,255,255,0))', pointerEvents: 'none' }} />
          <h3 style={{ position: 'relative', margin: 0, fontFamily: HEADING_FONT, fontSize: 28, lineHeight: 1.18, letterSpacing: '-.028em', fontWeight: 800, color: '#fff' }}>Ingin melihat langsung?</h3>
          <p style={{ position: 'relative', margin: '14px 0 0', fontSize: 15, lineHeight: 1.62, color: 'rgba(255,255,255,.9)' }}>Kunjungan orang tua dibuka setiap Rabu pukul 09.00. Cukup kabari tata usaha sehari sebelumnya, dan seorang guru akan menemani berkeliling.</p>
          <div style={{ position: 'relative', marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link to="/pendaftaran" className="shine" style={{ position: 'relative', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 24px', borderRadius: 15, fontSize: 14, fontWeight: 700, color: '#3b3f7a', background: 'rgba(255,255,255,.92)', boxShadow: '0 16px 34px -14px rgba(40,45,110,.7),inset 0 1px 0 rgba(255,255,255,1)' }}>Daftar PPDB</Link>
            <a href="#kontak" className="shine" style={{ position: 'relative', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 24px', borderRadius: 15, fontSize: 14, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.5)' }}>Hubungi sekolah</a>
          </div>
        </div>
      </section>

      {/* ── MODAL: profil guru ───────────────────────────────────────────── */}
      {p && (
        <div onClick={closeAll} style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 28, background: 'rgba(40,46,80,.42)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', animation: 'fadeup .3s ease both' }}>
          <div onClick={(e) => e.stopPropagation()} className="sdnb-person-modal" style={{ position: 'relative', width: 'min(860px,100%)', maxHeight: '88vh', overflow: 'auto', display: 'grid', gridTemplateColumns: '300px 1fr', gap: 0, borderRadius: 30, background: 'rgba(255,255,255,.72)', backdropFilter: 'blur(30px) saturate(190%)', WebkitBackdropFilter: 'blur(30px) saturate(190%)', border: '1px solid rgba(255,255,255,.9)', boxShadow: '0 50px 100px -30px rgba(40,50,110,.7),inset 0 1px 0 rgba(255,255,255,1)' }}>
            <div style={{ position: 'relative', minHeight: 330, overflow: 'hidden', background: p.gradasi }}>
              <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(110% 70% at 25% 12%,rgba(255,255,255,.5),rgba(255,255,255,0) 60%)' }} />
              {p.foto
                ? <img src={p.foto} alt={p.nama} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                : <PersonSvg size={150} style={{ position: 'absolute', left: '50%', bottom: -8, transform: 'translateX(-50%)' }} />}
            </div>
            <div style={{ padding: '34px 36px 36px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--sekolah-aksen-pekat)' }}>{p.peran}</div>
                  <h3 style={{ margin: '10px 0 0', fontFamily: HEADING_FONT, fontSize: 28, lineHeight: 1.16, letterSpacing: '-.028em', fontWeight: 800, color: '#1b1c2c' }}>{p.nama}</h3>
                </div>
                <button type="button" onClick={closeAll} className="shine" aria-label="Tutup" style={{ position: 'relative', overflow: 'hidden', flex: 'none', width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid rgba(255,255,255,.9)', background: 'rgba(255,255,255,.7)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#404568" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6 6 18" /></svg>
                </button>
              </div>
              {/* Deskripsi sekolah, bukan biografi per orang: basis data guru
                  tidak menyimpan biografi, dan versi lama mengarangnya. */}
              <p style={{ margin: '18px 0 0', fontSize: 15, lineHeight: 1.68, color: '#4a4f74' }}>{sekolah.description}</p>
              <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {p.rincian.map(([k, v]) => (
                  <div key={k} style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,.62)', border: '1px solid rgba(255,255,255,.9)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8a8ea8' }}>{k}</div>
                    <div style={{ marginTop: 5, fontSize: 13.5, fontWeight: 700, color: '#1e2035' }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 22, display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => movePerson(-1)} className="shine" style={{ position: 'relative', overflow: 'hidden', padding: '12px 18px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: '#33375a', border: '1px solid rgba(255,255,255,.9)', background: 'rgba(255,255,255,.65)' }}>Sebelumnya</button>
                <button type="button" onClick={() => movePerson(1)} className="shine" style={{ position: 'relative', overflow: 'hidden', padding: '12px 18px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: '#fff', border: 0, background: 'linear-gradient(135deg,var(--sekolah-aksen),var(--sekolah-aksen-tengah) 55%,var(--sekolah-aksen-ujung))', boxShadow: '0 14px 30px -14px rgba(95,105,235,.9)' }}>Berikutnya</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: lightbox fasilitas ────────────────────────────────────── */}
      {l && (
        <div onClick={closeAll} style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, background: 'rgba(40,46,80,.46)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', animation: 'fadeup .3s ease both' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: 'min(920px,100%)' }}>
            <div style={{ position: 'relative', height: 'min(56vh,460px)', borderRadius: 26, overflow: 'hidden', background: FASILITAS_GAYA[light % FASILITAS_GAYA.length][0], border: '1px solid rgba(255,255,255,.8)', boxShadow: '0 50px 100px -30px rgba(40,50,110,.75),inset 0 1px 0 rgba(255,255,255,.85)' }}>
              <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(110% 70% at 25% 12%,rgba(255,255,255,.5),rgba(255,255,255,0) 60%)' }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, color: 'rgba(60,50,90,.45)', fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="8.5" cy="9.5" r="1.8" /><path d="m4 17 5-5 4.5 4.5L17 13l3 3" /></svg>
                Foto fasilitas
              </div>
            </div>
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, padding: '18px 22px', borderRadius: 20, background: 'rgba(255,255,255,.68)', backdropFilter: 'blur(26px) saturate(185%)', WebkitBackdropFilter: 'blur(26px) saturate(185%)', border: '1px solid rgba(255,255,255,.9)', boxShadow: '0 30px 60px -24px rgba(40,50,110,.6)' }}>
              <div>
                <div style={{ fontFamily: HEADING_FONT, fontSize: 20, fontWeight: 800, letterSpacing: '-.02em', color: '#1b1c2c' }}>{l.name}</div>
                <div style={{ marginTop: 5, fontSize: 13.5, lineHeight: 1.6, color: '#565b7d', maxWidth: 520 }}>{l.desc}</div>
              </div>
              <div style={{ display: 'flex', gap: 9, flex: 'none' }}>
                <button type="button" onClick={() => moveLight(-1)} className="shine" aria-label="Sebelumnya" style={{ position: 'relative', overflow: 'hidden', width: 42, height: 42, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid rgba(255,255,255,.9)', background: 'rgba(255,255,255,.7)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#404568" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                </button>
                <button type="button" onClick={() => moveLight(1)} className="shine" aria-label="Berikutnya" style={{ position: 'relative', overflow: 'hidden', width: 42, height: 42, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 0, background: 'linear-gradient(135deg,var(--sekolah-aksen),var(--sekolah-aksen-tengah) 55%,var(--sekolah-aksen-ujung))' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                </button>
                <button type="button" onClick={closeAll} className="shine" aria-label="Tutup" style={{ position: 'relative', overflow: 'hidden', width: 42, height: 42, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid rgba(255,255,255,.9)', background: 'rgba(255,255,255,.7)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#404568" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6 6 18" /></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
