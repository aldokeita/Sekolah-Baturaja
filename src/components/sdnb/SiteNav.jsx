import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import useSchoolIdentity from '@/hooks/useSchoolIdentity';
import '@/styles/sdnb.css';

/**
 * Ported VERBATIM from the sticky nav block that appears identically in all 8
 * content pages of the Claude Design mockups (see `Beranda SMAN Baturaja.dc.html`
 * lines 90–125). Inline style values are copied exactly.
 *
 * Necessary translations:
 *  - `href="./Xxx.dc.html"` → react-router `<Link to="/route">` (see LINKS below)
 *  - `style-hover="…"`      → `.h-*` classes in sdnb.css (React can't inline :hover)
 *  - `style-before="…"`     → a real absolutely-positioned child div, which is
 *                             pixel-identical to the ::before the mockup used
 *  - `data-theme-toggle`    → onClick wired to the app's ThemeContext
 *  - the Login button becomes Dashboard/Logout when a user is signed in, so the
 *    real auth flow keeps working (design of the button is unchanged)
 *
 * Menu ponsel DITAMBAHKAN, tidak ada di mockup. Di bawah 940px mockup
 * menyembunyikan seluruh baris tautan dan tidak menyediakan penggantinya, jadi
 * pengunjung ponsel tidak punya navigasi sama sekali — hanya logo dan tombol
 * Daftar SPMB. Untuk situs sekolah yang sebagian besar dibuka orang tua dari
 * ponsel, itu berarti halaman Profil, Berita, dan Kontak tidak dapat dijangkau.
 */

const ARROW = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
  </svg>
);

const PROFILE_LINKS = [
  { label: 'Tentang kami', to: '/profil' },
  { label: 'Galeri', to: '/profil/galeri' },
  { label: 'Prestasi', to: '/prestasi' },
  { label: 'Program', to: '/program' },
  { label: 'Ekstrakurikuler', to: '/ekstrakurikuler' },
  { label: 'Fasilitas', to: '/fasilitas' },
];

const linkBase = { padding: '9px 14px', borderRadius: 12, fontSize: 13.5 };
const activeLink = { ...linkBase, fontWeight: 700, color: '#4a4fd0', background: 'rgba(255,255,255,.72)' };
const passiveLink = { ...linkBase, fontWeight: 600, color: '#2c2f45' };

// Semua tautan navigasi dalam satu daftar rata untuk menu ponsel. Di layar lebar
// enam tautan Profil bersarang di dropdown; di ponsel dropdown melayang tidak
// bisa dipakai, jadi semuanya ditampilkan berurutan.
const MENU_PONSEL = [
  { label: 'Beranda', to: '/' },
  { label: 'Profil', to: '/profil' },
  ...PROFILE_LINKS.filter((l) => l.to !== '/profil'),
  { label: 'Berita', to: '/berita' },
  { label: 'Kontak', to: '/kontak' },
  // Tautan layanan publik tetap tersedia di menu ponsel saat tombol desktop
  // disederhanakan agar header tidak terpotong di layar sempit.
  { label: 'Daftar SPMB', to: '/pendaftaran' },
  { label: 'Cek pendaftaran', to: '/cek-pendaftaran' },
];

const SiteNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toggleTheme } = useTheme();
  const sekolah = useSchoolIdentity();
  const [menuTerbuka, setMenuTerbuka] = useState(false);

  const isHome = location.pathname === '/';
  const isLogin = location.pathname === '/login';
  const isProfileGroup = PROFILE_LINKS.some((l) => location.pathname.startsWith(l.to));
  const at = (p) => location.pathname.startsWith(p);

  const handleLogout = async () => { await signOut(); navigate('/'); };

  // Menu ditutup setiap kali halaman berganti, supaya panelnya tidak menutupi
  // halaman baru setelah pengunjung menekan salah satu tautan.
  useEffect(() => { setMenuTerbuka(false); }, [location.pathname]);

  // Escape menutup menu, sama seperti dialog lain di aplikasi ini.
  useEffect(() => {
    if (!menuTerbuka) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMenuTerbuka(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuTerbuka]);

  return (
    <div className="site-nav" style={{ position: 'sticky', top: 0, zIndex: 40, padding: '14px 28px' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', position: 'relative', display: 'flex', alignItems: 'center', gap: 28, padding: '12px 14px 12px 20px', borderRadius: 22, background: 'rgba(255,255,255,.55)', backdropFilter: 'blur(26px) saturate(185%)', WebkitBackdropFilter: 'blur(26px) saturate(185%)', border: '1px solid rgba(255,255,255,.75)', boxShadow: '0 20px 46px -20px rgba(55,65,120,.5),inset 0 1px 0 rgba(255,255,255,.95)' }}>
        {/* style-before */}
        <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '60%', background: 'linear-gradient(165deg,rgba(255,255,255,.6),rgba(255,255,255,0))', pointerEvents: 'none', borderRadius: '22px 22px 0 0' }} />

        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
          <div style={{ width: 40, height: 40, borderRadius: 13, background: 'linear-gradient(140deg,#7d8bff,#c8a4f0 45%,#ffb3d1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 13, letterSpacing: '.02em', boxShadow: '0 10px 22px -8px rgba(110,120,220,.8),inset 0 1px 0 rgba(255,255,255,.85)' }}>{sekolah.logoAbbr}</div>
          <div style={{ lineHeight: 1.15 }}>
            <div className="nav-brandtitle" style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.01em', color: '#1b1c28' }}>{sekolah.name}</div>
            <div className="nav-sub" style={{ fontSize: 11, fontWeight: 500, color: '#63678a' }}>{sekolah.city}</div>
          </div>
        </Link>

        <div className="nav-links" style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          <Link to="/" className={isHome ? undefined : 'h-navlink'} style={isHome ? activeLink : passiveLink}>Beranda</Link>

          <div className="navdd" style={{ position: 'relative' }}>
            <Link
              to="/profil"
              className={isProfileGroup ? undefined : 'h-navlink'}
              style={{ ...(isProfileGroup ? activeLink : passiveLink), display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              Profil
              <svg className="ddcaret" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
            </Link>
            <div className="ddmenu">
              <div className="ddpanel">
                {PROFILE_LINKS.map((l) => (
                  <Link key={l.to} to={l.to} className="ddlink">{l.label}{ARROW}</Link>
                ))}
              </div>
            </div>
          </div>

          <Link to="/berita" className={at('/berita') ? undefined : 'h-navlink'} style={at('/berita') ? activeLink : passiveLink}>Berita</Link>
          <Link to="/kontak" className={at('/kontak') ? undefined : 'h-navlink'} style={at('/kontak') ? activeLink : passiveLink}>Kontak</Link>
        </div>

        <div className="site-nav-actions" style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
          {/* Hanya tampil di bawah 940px, tepat ketika baris tautan disembunyikan. */}
          <button
            type="button"
            className="nav-burger th-toggle"
            onClick={() => setMenuTerbuka((v) => !v)}
            aria-label={menuTerbuka ? 'Tutup menu' : 'Buka menu'}
            aria-expanded={menuTerbuka}
            aria-controls="menu-ponsel"
            style={{ position: 'relative', flex: 'none', width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid rgba(255,255,255,.9)', background: 'rgba(255,255,255,.62)', boxShadow: '0 10px 24px -12px rgba(60,70,120,.6),inset 0 1px 0 rgba(255,255,255,.95)' }}
          >
            {menuTerbuka ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3d4166" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6 6 18" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3d4166" strokeWidth="2.6" strokeLinecap="round"><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></svg>
            )}
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="th-toggle"
            aria-label="Ganti tema terang atau gelap"
            style={{ position: 'relative', flex: 'none', width: 42, height: 42, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontFamily: 'inherit', border: '1px solid rgba(255,255,255,.9)', background: 'rgba(255,255,255,.62)', boxShadow: '0 10px 24px -12px rgba(60,70,120,.6),inset 0 1px 0 rgba(255,255,255,.95)' }}
          >
            <svg className="th-i-sun" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#3d4166" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="12" r="4.2" /><path d="M12 2v2.4" /><path d="M12 19.6V22" /><path d="M2 12h2.4" /><path d="M19.6 12H22" /><path d="m4.9 4.9 1.7 1.7" /><path d="m17.4 17.4 1.7 1.7" /><path d="m19.1 4.9-1.7 1.7" /><path d="m6.6 17.4-1.7 1.7" /></svg>
            <svg className="th-i-moon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#3d4166" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 14.2A8.4 8.4 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2Z" /></svg>
          </button>

          {user ? (
            <>
              <Link to="/dashboard" className="shine nav-loginbtn nav-login h-login" style={{ position: 'relative', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 17px', flex: 'none', borderRadius: 14, fontSize: 13.5, fontWeight: 700, color: '#33375a', background: 'rgba(255,255,255,.62)', border: '1px solid rgba(255,255,255,.9)', boxShadow: '0 10px 24px -12px rgba(60,70,120,.6),inset 0 1px 0 rgba(255,255,255,.95)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>
                Dashboard
              </Link>
              {/* `nav-login` ikut dipasang supaya tombol ini juga menyingkir di
                  bawah 940px, sama seperti tombol Dashboard di sebelahnya.
                  Keluar tetap ada di dalam menu hamburger. */}
              <button type="button" onClick={handleLogout} className="th-toggle nav-login" aria-label="Keluar" style={{ position: 'relative', flex: 'none', width: 42, height: 42, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid rgba(255,255,255,.9)', background: 'rgba(255,255,255,.62)', boxShadow: '0 10px 24px -12px rgba(60,70,120,.6),inset 0 1px 0 rgba(255,255,255,.95)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b04a5a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>
              </button>
            </>
          ) : (
            <Link to="/login" aria-current={isLogin ? 'page' : undefined} className={`shine nav-loginbtn nav-login ${isLogin ? '' : 'h-login'}`} style={{ position: 'relative', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 17px', flex: 'none', borderRadius: 14, fontSize: 13.5, fontWeight: 700, ...(isLogin ? activeLink : { color: '#33375a', background: 'rgba(255,255,255,.62)', border: '1px solid rgba(255,255,255,.9)', boxShadow: '0 10px 24px -12px rgba(60,70,120,.6),inset 0 1px 0 rgba(255,255,255,.95)' }) }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="m10 17 5-5-5-5" /><path d="M15 12H3" /></svg>
              Login
            </Link>
          )}

          <Link to="/pendaftaran" className="shine nav-cta h-bright" style={{ position: 'relative', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 20px', flex: 'none', borderRadius: 14, fontSize: 13.5, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,var(--sekolah-aksen),var(--sekolah-aksen-tengah) 55%,var(--sekolah-aksen-ujung))', boxShadow: '0 14px 30px -12px rgba(95,105,235,.95),inset 0 1px 0 rgba(255,255,255,.6)' }}>
            <span aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '52%', background: 'linear-gradient(170deg,rgba(255,255,255,.45),rgba(255,255,255,0))', pointerEvents: 'none' }} />
            Daftar SPMB
          </Link>
        </div>

        {menuTerbuka && (
          <div
            id="menu-ponsel"
            className="nav-sheet"
            style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 10px)', padding: 10, borderRadius: 20, background: 'rgba(255,255,255,.86)', backdropFilter: 'blur(26px) saturate(185%)', WebkitBackdropFilter: 'blur(26px) saturate(185%)', border: '1px solid rgba(255,255,255,.9)', boxShadow: '0 28px 60px -20px rgba(55,65,120,.6),inset 0 1px 0 rgba(255,255,255,.95)' }}
          >
            <nav aria-label="Menu utama" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {MENU_PONSEL.map((l) => {
                const aktif = l.to === '/' ? isHome : at(l.to);
                return (
                  <Link
                    key={l.to}
                    to={l.to}
                    style={{ padding: '12px 14px', borderRadius: 12, fontSize: 14.5, fontWeight: aktif ? 700 : 600, color: aktif ? '#4a4fd0' : '#2c2f45', background: aktif ? 'rgba(255,255,255,.9)' : 'transparent' }}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </nav>

            {/* Tombol Login dan Dashboard juga tersembunyi di bawah 940px
                (.nav-login), jadi keduanya perlu tempat di sini. */}
            <div style={{ marginTop: 8, paddingTop: 10, borderTop: '1px solid rgba(120,132,200,.2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {user ? (
                <>
                  <Link to="/dashboard" style={{ padding: '12px 14px', borderRadius: 12, fontSize: 14.5, fontWeight: 700, color: '#33375a', background: 'rgba(255,255,255,.72)', border: '1px solid rgba(255,255,255,.95)' }}>Dashboard</Link>
                  <button type="button" onClick={handleLogout} style={{ padding: '12px 14px', borderRadius: 12, fontFamily: 'inherit', fontSize: 14.5, fontWeight: 700, textAlign: 'left', cursor: 'pointer', color: '#b04a5a', background: 'rgba(255,255,255,.72)', border: '1px solid rgba(255,255,255,.95)' }}>Keluar</button>
                </>
              ) : (
                <Link to="/login" aria-current={isLogin ? 'page' : undefined} style={{ padding: '12px 14px', borderRadius: 12, fontSize: 14.5, fontWeight: isLogin ? 700 : 600, color: isLogin ? '#4a4fd0' : '#33375a', background: isLogin ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.72)', border: '1px solid rgba(255,255,255,.95)' }}>Login</Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SiteNav;
