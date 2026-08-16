import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import SiteNav from './SiteNav';
import SiteFooter, { SiteFooterRingkas } from './SiteFooter';
import '@/styles/sdnb.css';

/**
 * Ported VERBATIM from the page shell every mockup page shares
 * (`Beranda SMAN Baturaja.dc.html` lines 73–90 and 634–635): the fixed
 * background wash, the three floating light orbs, and the `.th-content`
 * wrapper that dark mode inverts.
 *
 * The announcement pill above the nav exists only on Beranda in the mockups, so
 * it renders only on `/` — keeping it here preserves its exact DOM position
 * (above the sticky nav), which a page-level component could not do.
 */
const PublicLayout = ({ children }) => {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <div className="sdnb" style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>
      <div className="th-bg" aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 0, background: 'linear-gradient(160deg,#eef1f8 0%,#e7edf7 40%,#f4eef4 100%)' }} />
      <div className="th-orb" aria-hidden="true" style={{ position: 'fixed', top: -160, left: -120, width: 620, height: 620, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%,rgba(150,170,255,.75),rgba(150,170,255,0) 68%)', filter: 'blur(20px)', zIndex: 0, animation: 'floaty 14s ease-in-out infinite' }} />
      <div className="th-orb" aria-hidden="true" style={{ position: 'fixed', top: 120, right: -180, width: 640, height: 640, borderRadius: '50%', background: 'radial-gradient(circle at 50% 50%,rgba(255,178,214,.7),rgba(255,178,214,0) 68%)', filter: 'blur(20px)', zIndex: 0, animation: 'floaty 18s ease-in-out infinite reverse' }} />
      <div className="th-orb" aria-hidden="true" style={{ position: 'fixed', bottom: -220, left: '30%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle at 50% 50%,rgba(160,240,225,.6),rgba(160,240,225,0) 66%)', filter: 'blur(24px)', zIndex: 0, animation: 'floaty 22s ease-in-out infinite' }} />

      <div className="th-content" style={{ position: 'relative', zIndex: 1 }}>
        {isHome && (
          <div style={{ maxWidth: 1240, margin: '0 auto', padding: '18px 28px 0', display: 'flex', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 500, color: '#3d4166', background: 'rgba(255,255,255,.45)', backdropFilter: 'blur(18px) saturate(180%)', WebkitBackdropFilter: 'blur(18px) saturate(180%)', border: '1px solid rgba(255,255,255,.72)', boxShadow: '0 10px 28px -14px rgba(60,70,120,.5),inset 0 1px 0 rgba(255,255,255,.95)' }}>
              <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 0 4px rgba(34,197,94,.18)' }} />
              Pendaftaran Peserta Didik Baru 2026/2027 telah dibuka — kuota terbatas
              <Link to="/pendaftaran" style={{ color: 'var(--sekolah-aksen-teks)', fontWeight: 700 }}>Daftar</Link>
            </div>
          </div>
        )}

        <SiteNav />
        {children}
        {/* Beranda ships the four-column footer with the newsletter box; every
            other content page uses the three-column variant. */}
        {isHome ? <SiteFooter /> : <SiteFooterRingkas />}
      </div>
    </div>
  );
};

export default PublicLayout;
