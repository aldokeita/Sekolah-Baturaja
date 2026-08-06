import React from 'react';
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
 * Note: per DESIGN.md §11 the mockup intentionally hides the link row and the
 * secondary button below 940px and defines no hamburger menu. That behaviour is
 * kept as-is rather than inventing a mobile menu.
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

const SiteNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toggleTheme } = useTheme();
  const sekolah = useSchoolIdentity();

  const isHome = location.pathname === '/';
  const isProfileGroup = PROFILE_LINKS.some((l) => location.pathname.startsWith(l.to));
  const at = (p) => location.pathname.startsWith(p);

  const handleLogout = async () => { await signOut(); navigate('/'); };

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 40, padding: '14px 28px' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', position: 'relative', display: 'flex', alignItems: 'center', gap: 28, padding: '12px 14px 12px 20px', borderRadius: 22, background: 'rgba(255,255,255,.55)', backdropFilter: 'blur(26px) saturate(185%)', WebkitBackdropFilter: 'blur(26px) saturate(185%)', border: '1px solid rgba(255,255,255,.75)', boxShadow: '0 20px 46px -20px rgba(55,65,120,.5),inset 0 1px 0 rgba(255,255,255,.95)' }}>
        {/* style-before */}
        <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '60%', background: 'linear-gradient(165deg,rgba(255,255,255,.6),rgba(255,255,255,0))', pointerEvents: 'none', borderRadius: '22px 22px 0 0' }} />

        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
          <div style={{ width: 40, height: 40, borderRadius: 13, background: 'linear-gradient(140deg,#7d8bff,#c8a4f0 45%,#ffb3d1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 13, letterSpacing: '.02em', boxShadow: '0 10px 22px -8px rgba(110,120,220,.8),inset 0 1px 0 rgba(255,255,255,.85)' }}>{sekolah.logoAbbr}</div>
          <div style={{ lineHeight: 1.15 }}>
            <div className="nav-brandtitle" style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.01em', color: '#1b1c28' }}>{sekolah.name}</div>
            <div className="nav-sub" style={{ fontSize: 11, fontWeight: 500, color: '#6c718f' }}>{sekolah.city}</div>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
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
              <button type="button" onClick={handleLogout} className="th-toggle" aria-label="Keluar" style={{ position: 'relative', flex: 'none', width: 42, height: 42, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid rgba(255,255,255,.9)', background: 'rgba(255,255,255,.62)', boxShadow: '0 10px 24px -12px rgba(60,70,120,.6),inset 0 1px 0 rgba(255,255,255,.95)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b04a5a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>
              </button>
            </>
          ) : (
            <Link to="/login" className="shine nav-loginbtn nav-login h-login" style={{ position: 'relative', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 17px', flex: 'none', borderRadius: 14, fontSize: 13.5, fontWeight: 700, color: '#33375a', background: 'rgba(255,255,255,.62)', border: '1px solid rgba(255,255,255,.9)', boxShadow: '0 10px 24px -12px rgba(60,70,120,.6),inset 0 1px 0 rgba(255,255,255,.95)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="m10 17 5-5-5-5" /><path d="M15 12H3" /></svg>
              Login
            </Link>
          )}

          <Link to="/pendaftaran" className="shine nav-cta h-bright" style={{ position: 'relative', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 20px', flex: 'none', borderRadius: 14, fontSize: 13.5, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#6470ff,#8a6cf0 55%,#e58fc4)', boxShadow: '0 14px 30px -12px rgba(95,105,235,.95),inset 0 1px 0 rgba(255,255,255,.6)' }}>
            <span aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '52%', background: 'linear-gradient(170deg,rgba(255,255,255,.45),rgba(255,255,255,0))', pointerEvents: 'none' }} />
            Daftar PPDB
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SiteNav;
