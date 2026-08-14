import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ExternalLink, LogOut, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import useSchoolIdentity from '@/hooks/useSchoolIdentity';

/**
 * Bilah atas dashboard: satu-satunya jalan keluar dari portal.
 *
 * Kenapa ini ada: `/dashboard` dirender di luar `PublicLayout`, jadi `SiteNav`
 * tidak ikut. Akibatnya **tidak ada satu pun dashboard yang punya tombol keluar
 * atau tautan kembali ke situs** — pengguna yang masuk terjebak, dan satu-satunya
 * cara keluar adalah mengetik alamat sendiri di bilah browser. Diperiksa untuk
 * kelima peran: tidak ada `signOut` di komponen dashboard mana pun.
 *
 * Sengaja dipasang di `DashboardPage`, bukan di masing-masing dashboard, supaya
 * kelima peran mendapatkannya sekaligus dan tidak ada yang terlewat lagi.
 */

const LABEL_PERAN = {
  superadmin: 'Pemilik Template',
  admin: 'Administrator',
  tata_usaha: 'Tata Usaha',
  guru: 'Guru',
  pentashih: 'Wakil Kepala Sekolah',
  santri: 'Murid',
};

const PUBLIC_NAV_ITEMS = [
  { label: 'Beranda', to: '/' },
  { label: 'Profil', to: '/profil' },
  { label: 'Berita', to: '/berita' },
  { label: 'Kontak', to: '/kontak' },
];

const isPublicNavActive = (pathname, to) => (
  to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(to + '/')
);

const DashboardTopBar = () => {
  const { role, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const sekolah = useSchoolIdentity();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="site-nav dashboard-topbar" aria-label="Navigasi portal admin">
      <div className="dashboard-topbar__shell">
        <Link to="/" className="dashboard-topbar__brand">
          <span className="dashboard-topbar__mark" aria-hidden="true">{sekolah.logoAbbr}</span>
          <span className="dashboard-topbar__identity">
            <span className="dashboard-topbar__name">{sekolah.shortName}</span>
            <span className="dashboard-topbar__role">{LABEL_PERAN[role] || 'Portal sekolah'}</span>
          </span>
        </Link>

        <span className="dashboard-topbar__context" aria-current="page">
          <span className="dashboard-topbar__context-dot" aria-hidden="true" />
          Dashboard
        </span>

        <nav className="dashboard-public-nav" aria-label="Navigasi halaman publik">
          {PUBLIC_NAV_ITEMS.map(({ label, to }) => {
            const isActive = isPublicNavActive(location.pathname, to);
            return (
              <Link
                key={to}
                to={to}
                className={isActive ? 'dashboard-public-nav__link is-active' : 'dashboard-public-nav__link'}
                aria-current={isActive ? 'page' : undefined}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="dashboard-topbar__spacer" />

        <div className="dashboard-topbar__actions">
          <button type="button" onClick={toggleTheme} aria-label="Ganti tema terang atau gelap" className="dashboard-nav-icon-button th-toggle">
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <Link to="/" aria-label="Lihat situs sekolah" className="dashboard-nav-button">
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            <span className="dashboard-nav-button__label">Lihat situs</span>
          </Link>

          <button type="button" onClick={handleLogout} aria-label="Keluar dari akun" className="dashboard-nav-button dashboard-nav-button--danger">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="dashboard-nav-button__label">Keluar</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default DashboardTopBar;
