import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { publicFetch } from '@/lib/apiClient';
import { fetchPublishedNews, fetchWebsiteContentMap } from '@/lib/publicContentAdapters';
import { DEFAULT_HOME_CONTENT, fetchHomeContent } from '@/lib/homeContent';
import useSchoolIdentity from '@/hooks/useSchoolIdentity';
import useSdnbMotion from '@/hooks/useSdnbMotion';
import '@/styles/sdnb.css';

/**
 * Ported VERBATIM from `Beranda SMAN Baturaja.dc.html` (sections `#beranda`,
 * stat bar, `#profil`, `#galeri`, `#berita`, testimoni, `#faq`, `#ppdb`).
 * Inline style values, copy, gradients and `data-reveal` delays are copied
 * exactly from the mockup. The nav, footer, background and announcement pill
 * live in PublicLayout (same DOM order as the mockup).
 *
 * Translations required by React:
 *  - `style-hover`  → `.h-*` classes in sdnb.css
 *  - `style-before` → real absolutely-positioned child divs (pixel-identical)
 *  - `sc-for` / `{{ }}` → arrays + `.map()`
 *  - the FAQ logic class (`state.open`, `toggle`, `iconStyle`, `bodyStyle`)
 *    → `useState` with the same computed style strings
 *
 * Backend fill-in (per project decision): the student/teacher counters and the
 * news cards use live data when the API returns it, otherwise the mockup's own
 * numbers and articles are shown.
 */

const GRAD_TEXT = {
  background: 'linear-gradient(115deg,var(--sekolah-aksen-pekat),var(--sekolah-aksen-tengah-2) 48%,var(--sekolah-aksen-ujung))',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  WebkitTextFillColor: 'transparent',
};

const HEADING_FONT = "'Plus Jakarta Sans','Archivo',system-ui,sans-serif";

const glassCard = {
  position: 'relative',
  overflow: 'hidden',
  background: 'rgba(255,255,255,.5)',
  backdropFilter: 'blur(26px) saturate(185%)',
  WebkitBackdropFilter: 'blur(26px) saturate(185%)',
  border: '1px solid rgba(255,255,255,.75)',
};

const Before = ({ height, deg = '166deg', alpha = '.62' }) => (
  <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height, background: `linear-gradient(${deg},rgba(255,255,255,${alpha}),rgba(255,255,255,0))`, pointerEvents: 'none' }} />
);

const kicker = { fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--sekolah-aksen-pekat)' };
const h2Style = { margin: '10px 0 0', fontFamily: HEADING_FONT, fontSize: 38, lineHeight: 1.1, letterSpacing: '-.03em', fontWeight: 800, color: '#171827' };
const pill = { padding: '6px 11px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, color: '#3f4570', background: 'rgba(255,255,255,.62)', border: '1px solid rgba(255,255,255,.85)' };

const ARROW_R = (size = 16, sw = 2.4) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
);

// Hanya gaya visual. Teksnya datang dari panel Konten (lihat lib/homeContent.js)
// dan dipasangkan berdasarkan posisi, berputar bila jumlah kartunya lebih banyak.
const PROGRAM_STYLE = [
  { grad: 'linear-gradient(140deg,#b9c4ff,#8b9bff)', shadow: '0 14px 28px -12px rgba(110,125,240,.9)', icon: <><path d="M9 3v4" /><path d="M15 3v4" /><path d="M9 7h6l3 8a6 6 0 1 1-12 0z" /></> },
  { grad: 'linear-gradient(140deg,#ffc0d8,#f79ac0)', shadow: '0 14px 28px -12px rgba(240,140,180,.9)', icon: <><path d="M3 5.5A18 18 0 0 1 12 7a18 18 0 0 1 9-1.5v12A18 18 0 0 0 12 19a18 18 0 0 0-9-1.5z" /><path d="M12 7v12" /></> },
  { grad: 'linear-gradient(140deg,#a9eede,#79cfe6)', shadow: '0 14px 28px -12px rgba(120,205,220,.9)', icon: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8" /><path d="M12 17v4" /></> },
];

const GALLERY = [
  { caption: 'Upacara bendera Senin', grad: 'linear-gradient(150deg,#c6b6f6,#9fc4f8 55%,#a9eede)', big: true, reveal: 0 },
  { caption: 'Ruang kelas satu', grad: 'linear-gradient(150deg,#ffc9dc,#f2a9c8)', reveal: 80 },
  { caption: 'Perpustakaan', grad: 'linear-gradient(150deg,#bcd6ff,#9fb6f8)', reveal: 160 },
  { caption: 'Pentas seni', grad: 'linear-gradient(150deg,#ffe0b3,#ffc39c)', reveal: 240 },
  { caption: 'Halaman bermain', grad: 'linear-gradient(150deg,#b6f0e0,#8fd8ec)', reveal: 320 },
];

const NEWS_FALLBACK = [
  { media: 'linear-gradient(150deg,#c4b7f7,#93b8f7)', cat: 'Prestasi', catColor: '#4a3ec9', catBg: 'rgba(120,130,255,.16)', date: '12 Juli 2026', title: 'Regu pramuka meraih juara dua lomba tingkat kabupaten', excerpt: 'Delapan murid kelas lima dan enam mengikuti perkemahan tiga hari di Bukit Batu dan pulang membawa piala.' },
  { media: 'linear-gradient(150deg,#ffc6da,#f6a8c6)', cat: 'Kegiatan', catColor: '#a83a70', catBg: 'rgba(246,168,198,.28)', date: '4 Juli 2026', title: 'Pekan literasi menghadirkan pendongeng anak', excerpt: 'Sesi mendongeng dan membaca bersama berlangsung enam hari di perpustakaan dan halaman sekolah.' },
  { media: 'linear-gradient(150deg,#b3eee0,#8ed4ea)', cat: 'Pengumuman', catColor: '#20707f', catBg: 'rgba(142,212,234,.3)', date: '28 Juni 2026', title: 'Jadwal daftar ulang murid baru gelombang pertama', excerpt: 'Daftar ulang dibuka 5 sampai 12 Agustus di ruang tata usaha, pukul 08.00 hingga 14.00.' },
];

// Sama seperti PROGRAM_STYLE: hanya gaya, teks dari panel Konten.
const TESTI_STYLE = [
  { avatar: 'linear-gradient(140deg,var(--sekolah-aksen-muda),var(--sekolah-aksen-samar))', roleColor: 'var(--sekolah-aksen-pekat)' },
  { avatar: 'linear-gradient(140deg,#fbcfe8,#f9a8d4)', roleColor: '#d9698f' },
  { avatar: 'linear-gradient(140deg,#a7f3d0,#99f6e4)', roleColor: '#2b9b96' },
  { avatar: 'linear-gradient(140deg,#bfdbfe,#93c5fd)', roleColor: '#4a7fd6' },
  { avatar: 'linear-gradient(140deg,#fde68a,#fed7aa)', roleColor: '#bd8433' },
  { avatar: 'linear-gradient(140deg,#ddd6fe,#c4b5fd)', roleColor: '#7c5fe0' },
];

const AvatarSvg = () => (
  <svg width="70" height="70" viewBox="0 0 24 24" fill="rgba(255,255,255,.88)"><circle cx="12" cy="8.4" r="4" /><path d="M3.6 22c.6-4.6 4.2-7.2 8.4-7.2s7.8 2.6 8.4 7.2z" /></svg>
);

const TestiCard = ({ t }) => (
  <div style={{ ...glassCard, flex: 'none', display: 'flex', alignItems: 'center', gap: 20, width: 520, padding: '22px 26px 22px 22px', borderRadius: 26, boxShadow: '0 26px 56px -22px rgba(55,65,120,.55),inset 0 1px 0 rgba(255,255,255,.95)' }}>
    <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '55%', background: 'linear-gradient(166deg,rgba(255,255,255,.6),rgba(255,255,255,0))', pointerEvents: 'none' }} />
    <div style={{ position: 'relative', flex: 'none', width: 104, height: 104, borderRadius: 32, background: t.avatar, boxShadow: '0 18px 36px -14px rgba(60,70,140,.55),inset 0 2px 0 rgba(255,255,255,.85)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
      <AvatarSvg />
    </div>
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <div style={{ position: 'relative', padding: '16px 18px', borderRadius: '18px 18px 18px 6px', background: 'rgba(255,255,255,.62)', border: '1px solid rgba(255,255,255,.9)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.95)' }}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.62, color: '#3d4160' }}>&ldquo;{t.quote}&rdquo;</p>
      </div>
      <div style={{ marginTop: 12, paddingLeft: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-.01em', color: '#1e2035' }}>{t.name}</div>
        <div style={{ fontSize: 11.5, color: t.roleColor, fontWeight: 600 }}>{t.role}</div>
      </div>
    </div>
  </div>
);

const HomePage = () => {
  const sekolah = useSchoolIdentity();
  const [counts, setCounts] = useState({ siswa: 624, guru: 34 });
  const [news, setNews] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [buildingPhoto, setBuildingPhoto] = useState('');
  const [open, setOpen] = useState(0);
  // Bawaan dipakai lebih dulu supaya halaman tidak kosong selagi menunggu server.
  const [isi, setIsi] = useState(DEFAULT_HOME_CONTENT);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [siswa, guru, newsResult, contentMap, homeContent] = await Promise.all([
        publicFetch('/api/santri/count').then((d) => d?.total || 0).catch(() => 0),
        publicFetch('/api/guru/count').then((d) => d?.total || 0).catch(() => 0),
        fetchPublishedNews({ limit: 3 }).catch(() => []),
        fetchWebsiteContentMap({ keys: ['galleryPhotos', 'schoolBuildingPhoto'], publicOnly: true }).catch(() => ({})),
        fetchHomeContent().catch(() => null),
      ]);
      if (!mounted) return;
      setCounts({ siswa: siswa || 624, guru: guru || 34 });
      if (Array.isArray(newsResult)) setNews(newsResult);
      if (Array.isArray(contentMap.galleryPhotos)) setPhotos(contentMap.galleryPhotos);
      if (typeof contentMap.schoolBuildingPhoto === 'string') setBuildingPhoto(contentMap.schoolBuildingPhoto);
      if (homeContent) setIsi(homeContent);
    })();
    return () => { mounted = false; };
  }, []);

  // Teks dari panel Konten dipasangkan dengan gaya visual berdasarkan posisi.
  const programCards = useMemo(
    () => isi.program.map((p, i) => ({ ...p, ...PROGRAM_STYLE[i % PROGRAM_STYLE.length] })),
    [isi.program],
  );
  const testiCards = useMemo(
    () => isi.testimonials.map((t, i) => ({ ...t, ...TESTI_STYLE[i % TESTI_STYLE.length] })),
    [isi.testimonials],
  );

  useSdnbMotion([counts.siswa, counts.guru, news.length, photos.length]);

  const newsCards = useMemo(() => {
    if (news.length === 0) return NEWS_FALLBACK;
    return news.slice(0, 3).map((item, i) => {
      const base = NEWS_FALLBACK[i % NEWS_FALLBACK.length];
      const d = item.date || item.published_at || item.created_at;
      return {
        ...base,
        cat: item.category || base.cat,
        date: d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : base.date,
        title: item.title || base.title,
        excerpt: item.excerpt || item.summary || base.excerpt,
        image: item.image_url || item.cover_image_url || '',
        // The Berita page has a built-in article reader, so every card links there.
        to: '/berita',
      };
    });
  }, [news]);

  const galleryTiles = useMemo(() => GALLERY.map((g, i) => ({ ...g, image: photos[i]?.url || '', caption: photos[i]?.caption || g.caption })), [photos]);

  const faqs = isi.faq.map(({ question, answer }, i) => {
    const isOpen = open === i;
    return {
      q: question,
      a: answer,
      toggle: () => setOpen((prev) => (prev === i ? -1 : i)),
      iconStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', width: 28, height: 28, borderRadius: 9, background: `rgba(255,255,255,${isOpen ? '.92' : '.6'})`, border: '1px solid rgba(255,255,255,.9)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.95)', transition: 'transform .25s ease', transform: `rotate(${isOpen ? '180deg' : '0deg'})` },
      bodyStyle: { position: 'relative', display: 'grid', gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows .28s ease', overflow: 'hidden' },
    };
  });

  return (
    <>
      <Helmet>
        <title>{sekolah.name}</title>
        <meta name="description" content={`${sekolah.name} — informasi program, berita, galeri, dan pendaftaran peserta didik baru.`} />
      </Helmet>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section id="beranda" data-reveal="0" className="sdnb-hero" style={{ maxWidth: 1240, margin: '0 auto', padding: '44px 28px 0', display: 'grid', gridTemplateColumns: '1.02fr 1fr', gap: 44, alignItems: 'center' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, color: '#4b4f78', background: 'rgba(255,255,255,.55)', border: '1px solid rgba(255,255,255,.8)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: '0 10px 24px -14px rgba(60,70,120,.6),inset 0 1px 0 rgba(255,255,255,.95)' }}>
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: 'linear-gradient(135deg,var(--sekolah-aksen),var(--sekolah-aksen-ujung))' }} />
            Terakreditasi A · Sekolah Adiwiyata Nasional
          </div>
          <h1 style={{ margin: '20px 0 0', fontFamily: HEADING_FONT, fontSize: 60, lineHeight: 1.04, letterSpacing: '-.038em', fontWeight: 800, color: '#171827', textWrap: 'balance' }}>
            Belajar dengan <span style={GRAD_TEXT}>tenang</span>,<br />tumbuh dengan<br /><span style={GRAD_TEXT}>percaya diri</span>.
          </h1>
          <p style={{ margin: '22px 0 0', maxWidth: 480, fontSize: 16, lineHeight: 1.65, color: '#535878', textWrap: 'pretty' }}>
            Sekolah Dasar Negeri Baturaja mendampingi anak sejak kelas satu lewat <strong style={{ color: '#3b3f6b', fontWeight: 700 }}>kelas kecil</strong>, guru wali yang mengenal setiap murid, dan halaman bermain yang aman. Enam ratus lebih anak belajar di sini setiap hari.
          </p>
          <div style={{ marginTop: 30, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <Link to="/pendaftaran" className="shine h-bright" style={{ position: 'relative', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', gap: 9, padding: '15px 26px', borderRadius: 16, fontSize: 14.5, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,var(--sekolah-aksen-pekat),var(--sekolah-aksen-tengah) 55%,var(--sekolah-aksen-ujung))', boxShadow: '0 22px 44px -16px rgba(90,100,235,.95),inset 0 1px 0 rgba(255,255,255,.6)' }}>
              <span aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '52%', background: 'linear-gradient(170deg,rgba(255,255,255,.45),rgba(255,255,255,0))', pointerEvents: 'none' }} />
              Mulai Pendaftaran
              {ARROW_R()}
            </Link>
            <Link to="/kontak" className="shine h-glass82" style={{ position: 'relative', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', gap: 9, padding: '15px 24px', borderRadius: 16, fontSize: 14.5, fontWeight: 700, color: '#33375a', background: 'rgba(255,255,255,.6)', border: '1px solid rgba(255,255,255,.85)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', boxShadow: '0 18px 38px -18px rgba(60,70,120,.7),inset 0 1px 0 rgba(255,255,255,.95)' }}>
              <span aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '55%', background: 'linear-gradient(170deg,rgba(255,255,255,.6),rgba(255,255,255,0))', pointerEvents: 'none' }} />
              Jadwal Kunjungan Sekolah
            </Link>
          </div>
          <div style={{ marginTop: 34, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex' }} aria-hidden="true">
              {['linear-gradient(140deg,var(--sekolah-aksen-muda),var(--sekolah-aksen-samar))', 'linear-gradient(140deg,#fbcfe8,#f9a8d4)', 'linear-gradient(140deg,#a7f3d0,#99f6e4)', 'linear-gradient(140deg,#fde68a,#fed7aa)'].map((g, i) => (
                <div key={i} style={{ width: 34, height: 34, borderRadius: '50%', background: g, border: '2px solid rgba(255,255,255,.9)', marginLeft: i === 0 ? 0 : -11 }} />
              ))}
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.45, color: '#5a5f80' }}>
              <strong style={{ ...GRAD_TEXT, fontWeight: 800 }}><span data-count={counts.siswa}>0</span> siswa</strong> aktif<br />98% lulusan diterima di SMP negeri pilihan
            </div>
          </div>
        </div>

        <div className="sdnb-photo-stage" style={{ position: 'relative' }}>
          <div className="sdnb-photo-frame" style={{ position: 'relative', overflow: 'hidden', borderRadius: 30, height: 470, background: 'linear-gradient(150deg,#ffc3d8 0%,#c7b4f5 34%,#9fc4f8 62%,#a7ecdf 100%)' }}>
            {buildingPhoto && <img className="sdnb-photo-frame__image" src={buildingPhoto} alt="Gedung sekolah" onError={() => setBuildingPhoto('')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 80% at 20% 10%,rgba(255,255,255,.6),rgba(255,255,255,0) 55%)' }} />
            {!buildingPhoto && <div style={{ position: 'absolute', inset: '0 0 130px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: 'rgba(60,50,90,.5)', fontSize: 12.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="8.5" cy="9.5" r="1.8" /><path d="m4 17 5-5 4.5 4.5L17 13l3 3" /></svg>
              Foto gedung sekolah
            </div>}
            <div className="sdnb-photo-frame__sheen" aria-hidden="true" />
            <div className="sdnb-photo-frame__edge" aria-hidden="true" />
          </div>

          <div className="sdnb-photo-glass-card sdnb-photo-glass-card--accreditation" style={{ position: 'absolute', left: -26, bottom: 52, width: 214, padding: '16px 18px', borderRadius: 20 }}>
            <div className="sdnb-photo-glass-card__content">
              <div className="sdnb-photo-glass-card__eyebrow">Akreditasi</div>
              <div className="sdnb-photo-glass-card__value">A <span className="sdnb-photo-glass-card__score">· 96,4</span></div>
              <div className="sdnb-photo-glass-card__meta">BAN-S/M, berlaku s.d. 2029</div>
            </div>
          </div>

          <div className="sdnb-photo-glass-card sdnb-photo-glass-card--extracurricular" style={{ position: 'absolute', right: -18, top: 44, padding: '14px 16px', borderRadius: 18, display: 'flex', alignItems: 'center', gap: 11 }}>
            <div className="sdnb-photo-glass-card__icon">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6.5 12 3l8 3.5-8 3.5z" /><path d="M6 11v4.5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V11" /></svg>
            </div>
            <div className="sdnb-photo-glass-card__content">
              <div className="sdnb-photo-glass-card__title">18 Ekstrakurikuler</div>
              <div className="sdnb-photo-glass-card__meta">Pramuka, seni, dan olahraga</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STAT BAR ─────────────────────────────────────────────────────── */}
      <section data-reveal="0" style={{ maxWidth: 1240, margin: '0 auto', padding: '52px 28px 0' }}>
        <div className="sdnb-stats" style={{ ...glassCard, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderRadius: 26, boxShadow: '0 28px 60px -24px rgba(55,65,120,.55),inset 0 1px 0 rgba(255,255,255,.95)' }}>
          <Before height="52%" deg="168deg" alpha=".6" />
          {[
            { count: counts.siswa, label: 'Siswa aktif' },
            { count: counts.guru, label: 'Guru & tenaga kependidikan' },
            { count: 98, suffix: '%', label: 'Lulusan diterima SMP negeri' },
            { count: 32, label: 'Prestasi tingkat kabupaten & provinsi' },
          ].map((s) => (
            <div key={s.label} style={{ position: 'relative', padding: '26px 28px' }}>
              <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-.035em', color: '#1d1f33' }}><span data-count={s.count}>0</span>{s.suffix}</div>
              <div style={{ marginTop: 3, fontSize: 12.5, color: '#63678a' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PROGRAM ──────────────────────────────────────────────────────── */}
      <section id="profil" data-reveal="0" style={{ maxWidth: 1240, margin: '0 auto', padding: '72px 28px 0' }}>
        <div className="sdnb-sechead" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <div style={kicker}>Program</div>
            <h2 style={h2Style}>Tiga tahap <span style={GRAD_TEXT}>pembelajaran</span></h2>
          </div>
          <p style={{ maxWidth: 340, margin: 0, fontSize: 14, lineHeight: 1.6, color: '#5b6082' }}>Setiap tahap punya cara mengajar, penilaian, dan pendampingan yang berbeda, menyesuaikan usia anak.</p>
        </div>

        <div className="sdnb-grid3" style={{ marginTop: 30, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 22 }}>
          {programCards.map((p) => (
            <div key={p.title} className="h-lift-shadow" style={{ ...glassCard, padding: 26, borderRadius: 24, boxShadow: '0 26px 56px -22px rgba(55,65,120,.55),inset 0 1px 0 rgba(255,255,255,.95)', transition: 'transform .25s ease,box-shadow .25s ease' }}>
              <Before height="55%" alpha=".62" />
              <div style={{ position: 'relative', width: 52, height: 52, borderRadius: 16, background: p.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `${p.shadow},inset 0 1px 0 rgba(255,255,255,.85)` }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{p.icon}</svg>
              </div>
              <h3 style={{ position: 'relative', margin: '18px 0 0', fontFamily: HEADING_FONT, fontSize: 20, fontWeight: 800, letterSpacing: '-.02em', color: '#1b1c2c' }}>{p.title}</h3>
              <p style={{ position: 'relative', margin: '9px 0 0', fontSize: 14, lineHeight: 1.6, color: '#5b6082' }}>{p.desc}</p>
              <div style={{ position: 'relative', marginTop: 18, display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {p.tags.map((t) => <span key={t} style={pill}>{t}</span>)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── GALERI ───────────────────────────────────────────────────────── */}
      <section id="galeri" data-reveal="0" style={{ maxWidth: 1240, margin: '0 auto', padding: '72px 28px 0' }}>
        <div className="sdnb-sechead" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <div style={kicker}>Galeri</div>
            <h2 style={h2Style}>Suasana <span style={GRAD_TEXT}>sekolah</span></h2>
          </div>
          <Link to="/profil/galeri" className="shine h-glass85" style={{ position: 'relative', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderRadius: 14, fontSize: 13.5, fontWeight: 700, color: '#33375a', background: 'rgba(255,255,255,.6)', border: '1px solid rgba(255,255,255,.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: '0 16px 34px -18px rgba(60,70,120,.7),inset 0 1px 0 rgba(255,255,255,.95)' }}>
            <span aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '55%', background: 'linear-gradient(170deg,rgba(255,255,255,.6),rgba(255,255,255,0))', pointerEvents: 'none' }} />
            Lihat semua foto
          </Link>
        </div>

        <div className="sdnb-bento" style={{ marginTop: 28, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gridTemplateRows: '200px 200px', gap: 18 }}>
          {galleryTiles.map((g) => (
            <Link
              key={g.caption}
              to="/profil/galeri"
              className="gtile"
              data-reveal={g.reveal}
              style={{ gridColumn: g.big ? 'span 2' : undefined, gridRow: g.big ? 'span 2' : undefined, position: 'relative', overflow: 'hidden', borderRadius: g.big ? 24 : 22, border: '1px solid rgba(255,255,255,.7)', boxShadow: '0 26px 54px -22px rgba(55,65,120,.58),inset 0 1px 0 rgba(255,255,255,.8)' }}
            >
              <div className="gfill" style={{ position: 'absolute', inset: 0, background: g.image ? undefined : g.grad }}>
                {g.image ? <img src={g.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
              </div>
              <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(110% 70% at 25% 12%,rgba(255,255,255,.5),rgba(255,255,255,0) 60%)' }} />
              <div style={{ position: 'absolute', left: g.big ? 18 : 14, bottom: g.big ? 18 : 14, padding: g.big ? '8px 14px' : '7px 12px', borderRadius: g.big ? 12 : 11, fontSize: g.big ? 12.5 : 11.5, fontWeight: 700, color: '#2c2f4d', background: 'rgba(255,255,255,.55)', backdropFilter: 'blur(18px) saturate(180%)', WebkitBackdropFilter: 'blur(18px) saturate(180%)', border: '1px solid rgba(255,255,255,.8)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.95)' }}>{g.caption}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── BERITA ───────────────────────────────────────────────────────── */}
      <section id="berita" data-reveal="0" style={{ maxWidth: 1240, margin: '0 auto', padding: '72px 28px 0' }}>
        <div className="sdnb-sechead" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <div style={kicker}>Berita</div>
            <h2 style={h2Style}>Kabar <span style={GRAD_TEXT}>terbaru</span></h2>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ padding: '8px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,var(--sekolah-aksen),var(--sekolah-aksen-tengah))', boxShadow: '0 12px 26px -12px rgba(95,105,235,.9),inset 0 1px 0 rgba(255,255,255,.5)' }}>Semua</span>
            <span style={{ padding: '8px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, color: '#4a4f74', background: 'rgba(255,255,255,.6)', border: '1px solid rgba(255,255,255,.85)' }}>Prestasi</span>
            <span style={{ padding: '8px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, color: '#4a4f74', background: 'rgba(255,255,255,.6)', border: '1px solid rgba(255,255,255,.85)' }}>Kegiatan</span>
          </div>
        </div>

        <div className="sdnb-grid3" style={{ marginTop: 28, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 22 }}>
          {newsCards.map((n) => (
            <div key={n.title} className="h-lift" style={{ ...glassCard, borderRadius: 24, boxShadow: '0 26px 56px -22px rgba(55,65,120,.55),inset 0 1px 0 rgba(255,255,255,.95)', transition: 'transform .25s ease' }}>
              <div style={{ height: 158, background: n.image ? undefined : n.media }}>
                {n.image ? <img src={n.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
              </div>
              <div style={{ padding: '20px 22px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 11.5, fontWeight: 600, color: '#6d7192' }}>
                  <span style={{ padding: '4px 9px', borderRadius: 8, color: n.catColor, background: n.catBg }}>{n.cat}</span>
                  {n.date}
                </div>
                <h3 style={{ margin: '12px 0 0', fontFamily: HEADING_FONT, fontSize: 17, lineHeight: 1.35, fontWeight: 800, letterSpacing: '-.015em', color: '#1b1c2c' }}>{n.title}</h3>
                <p style={{ margin: '9px 0 0', fontSize: 13.5, lineHeight: 1.6, color: '#5b6082' }}>{n.excerpt}</p>
                <Link to={n.to || '/berita'} className="shine h-read" style={{ marginTop: 16, position: 'relative', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 13, fontSize: 13, fontWeight: 700, color: '#33375a', background: 'rgba(255,255,255,.62)', border: '1px solid rgba(255,255,255,.9)', boxShadow: '0 12px 26px -14px rgba(60,70,120,.7),inset 0 1px 0 rgba(255,255,255,.95)' }}>
                  Baca selengkapnya
                  {ARROW_R(14, 2.6)}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONI ────────────────────────────────────────────────────── */}
      <section data-reveal="0" style={{ padding: '72px 0 0' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '0 28px' }}>
          <div style={kicker}>Testimoni</div>
          <h2 style={h2Style}>Kata <span style={GRAD_TEXT}>siswa, alumni,</span> dan orang tua</h2>
        </div>
        <div className="mq-wrap" style={{ marginTop: 28, overflow: 'hidden', padding: '10px 0 70px', WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)', maskImage: 'linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)' }}>
          <div className="mq-track" style={{ padding: '0 11px' }}>
            {[...testiCards, ...testiCards].map((t, i) => <TestiCard key={i} t={t} />)}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section id="faq" data-reveal="0" className="sdnb-faq" style={{ maxWidth: 1240, margin: '0 auto', padding: '32px 28px 0', display: 'grid', gridTemplateColumns: '.85fr 1.15fr', gap: 44, alignItems: 'start' }}>
        <div style={{ position: 'sticky', top: 110 }}>
          <div style={kicker}>FAQ</div>
          <h2 style={h2Style}>Pertanyaan yang <span style={GRAD_TEXT}>sering diajukan</span></h2>
          <p style={{ margin: '16px 0 0', fontSize: 14.5, lineHeight: 1.65, color: '#5b6082' }}>Belum menemukan jawabannya? Hubungi tata usaha di (0735) 320145 pada hari kerja pukul 07.30–15.00.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {faqs.map((f) => (
            <div key={f.q} style={{ ...glassCard, borderRadius: 20, boxShadow: '0 22px 48px -22px rgba(55,65,120,.55),inset 0 1px 0 rgba(255,255,255,.95)' }}>
              <Before height="60%" alpha=".6" />
              <button type="button" onClick={f.toggle} aria-expanded={f.bodyStyle.gridTemplateRows === '1fr'} style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, padding: '20px 22px', background: 'transparent', border: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontSize: 15.5, fontWeight: 700, letterSpacing: '-.012em', color: '#1c1e30' }}>
                {f.q}
                <span style={f.iconStyle}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4a4f78" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </span>
              </button>
              <div style={f.bodyStyle}>
                <div style={{ minHeight: 0, overflow: 'hidden' }}>
                  <p style={{ margin: 0, padding: '0 22px 22px', fontSize: 14, lineHeight: 1.68, color: '#565b7d' }}>{f.a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PPDB CTA ─────────────────────────────────────────────────────── */}
      <section id="ppdb" data-reveal="0" style={{ maxWidth: 1240, margin: '0 auto', padding: '76px 28px 0' }}>
        <div style={{ position: 'relative', overflow: 'hidden', padding: '52px 48px', borderRadius: 30, background: 'linear-gradient(135deg,rgba(120,132,255,.9),rgba(160,120,240,.85) 48%,rgba(240,150,196,.85))', border: '1px solid rgba(255,255,255,.55)', boxShadow: '0 40px 80px -28px rgba(80,90,190,.75),inset 0 1px 0 rgba(255,255,255,.6)' }}>
          <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '58%', background: 'linear-gradient(168deg,rgba(255,255,255,.42),rgba(255,255,255,0))', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 36, flexWrap: 'wrap' }}>
            <div style={{ maxWidth: 560 }}>
              <h2 style={{ margin: 0, fontFamily: HEADING_FONT, fontSize: 38, lineHeight: 1.12, letterSpacing: '-.03em', fontWeight: 800, color: '#fff' }}>
                Pendaftaran gelombang pertama ditutup <span style={{ background: 'linear-gradient(115deg,#fff5b0,#ffd9ec)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent' }}>20 Agustus 2026</span>
              </h2>
              <p style={{ margin: '14px 0 0', fontSize: 15, lineHeight: 1.65, color: 'rgba(255,255,255,.88)' }}>Anak berusia minimal enam tahun pada 1 Juli 2026. Siapkan kartu keluarga dan akta kelahiran, seluruh proses dilakukan daring.</p>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link to="/pendaftaran" className="shine h-white" style={{ position: 'relative', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '15px 26px', borderRadius: 16, fontSize: 14.5, fontWeight: 700, color: '#3b3f7a', background: 'rgba(255,255,255,.9)', boxShadow: '0 20px 40px -16px rgba(40,45,110,.7),inset 0 1px 0 rgba(255,255,255,1)' }}>Isi formulir</Link>
              <Link to="/pendaftaran" className="shine h-white30" style={{ position: 'relative', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '15px 26px', borderRadius: 16, fontSize: 14.5, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.5)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' }}>Unduh panduan</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default HomePage;
