import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ArrowRight, LayoutDashboard, LogIn, LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { SCHOOL } from '@/lib/schoolProfile';
import '@/styles/school-home.css';

// Only routes that actually exist in this app are linked. The Claude Design
// reference lists Prestasi/Program/Ekstrakurikuler too; those pages don't exist
// yet, so they're omitted rather than pointing at dead links.
const navGroups = [
  { label: 'Beranda', to: '/' },
  {
    label: 'Profil',
    items: [
      { label: 'Tentang Sekolah', to: '/profil' },
      { label: 'Galeri', to: '/profil/galeri' },
      { label: 'Prestasi', to: '/prestasi' },
      { label: 'Program', to: '/program' },
      { label: 'Ekstrakurikuler', to: '/ekstrakurikuler' },
      { label: 'Fasilitas', to: '/fasilitas' },
    ],
  },
  {
    label: 'Berita',
    items: [
      { label: 'Berita Sekolah', to: '/berita' },
      { label: 'Pengumuman', to: '/pengumuman' },
    ],
  },
  { label: 'Kontak', to: '/kontak' },
];

const isActivePath = (pathname, target) => (target === '/' ? pathname === '/' : pathname.startsWith(target));

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [mobileDropdown, setMobileDropdown] = useState('');
  const { user, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    const onKeyDown = (e) => { if (e.key === 'Escape') setIsOpen(false); };
    if (isOpen) window.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKeyDown); };
  }, [isOpen]);

  useEffect(() => { setIsOpen(false); setMobileDropdown(''); }, [location.pathname]);

  const handleLogout = async () => { await signOut(); navigate('/'); };

  const ThemeButton = () => (
    <button type="button" onClick={toggleTheme} className="sh-nav__iconbtn" aria-label="Ubah tema terang atau gelap">
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );

  return (
    <nav className="sh-nav" aria-label="Navigasi utama">
      <div className="sh-nav__inner sh-glass">
        <Link to="/" className="sh-nav__brand" aria-label={`${SCHOOL.name} beranda`}>
          <span className="sh-nav__logo">{SCHOOL.logoAbbr}</span>
          <span>
            <span className="sh-nav__title">{SCHOOL.name}</span>
            <span className="sh-nav__sub">{SCHOOL.location}</span>
          </span>
        </Link>

        <div className="sh-nav__links">
          {navGroups.map((group) => (group.to ? (
            <Link key={group.label} to={group.to} className={`sh-nav__link${isActivePath(location.pathname, group.to) ? ' is-active' : ''}`}>
              {group.label}
            </Link>
          ) : (
            <div key={group.label} className="sh-navdd">
              <button type="button" className="sh-nav__link sh-navdd__trigger" aria-haspopup="true">
                {group.label}
                <ChevronDown className="sh-navdd__caret h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <div className="sh-navdd__menu">
                <div className="sh-navdd__panel">
                  {group.items.map((item) => (
                    <Link key={item.to} to={item.to} className="sh-navdd__link">
                      {item.label}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )))}
        </div>

        <div className="sh-nav__actions">
          <ThemeButton />
          <div className="sh-nav__login-wrap" style={{ display: 'contents' }}>
            {user ? (
              <>
                <Link to="/dashboard" className="sh-nav__login" aria-label="Dashboard">
                  <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> Dashboard
                </Link>
                <button type="button" onClick={handleLogout} className="sh-nav__iconbtn" aria-label="Logout"><LogOut className="h-5 w-5" /></button>
              </>
            ) : (
              <Link to="/login" className="sh-nav__login sh-shine" aria-label="Login">
                <LogIn className="h-4 w-4" aria-hidden="true" /> Login
              </Link>
            )}
            <Link to="/pendaftaran/informasi" className="sh-nav__cta sh-shine">Daftar PPDB</Link>
          </div>
          <button type="button" className="sh-nav__iconbtn sh-nav__burger" onClick={() => setIsOpen((v) => !v)} aria-label="Buka menu" aria-expanded={isOpen}>
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="sh-wrap"
            style={{ paddingTop: 12 }}
          >
            <div className="sh-glass" style={{ borderRadius: 22, padding: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {navGroups.map((group) => (group.to ? (
                <Link key={group.label} to={group.to} className={`sh-nav__link${isActivePath(location.pathname, group.to) ? ' is-active' : ''}`}>{group.label}</Link>
              ) : (
                <div key={group.label}>
                  <button type="button" className="sh-nav__link sh-navdd__trigger" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => setMobileDropdown(mobileDropdown === group.label ? '' : group.label)}>
                    {group.label}
                    <ChevronDown className={`h-4 w-4 ${mobileDropdown === group.label ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>
                  {mobileDropdown === group.label && (
                    <div style={{ paddingLeft: 10, display: 'flex', flexDirection: 'column' }}>
                      {group.items.map((item) => <Link key={item.to} to={item.to} className="sh-nav__link">{item.label}</Link>)}
                    </div>
                  )}
                </div>
              )))}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {user ? (
                  <>
                    <Link to="/dashboard" className="sh-btn sh-btn--ghost sh-btn--sm" style={{ flex: 1, justifyContent: 'center' }}>Dashboard</Link>
                    <button type="button" onClick={handleLogout} className="sh-btn sh-btn--ghost sh-btn--sm" style={{ flex: 1, justifyContent: 'center' }}>Logout</button>
                  </>
                ) : (
                  <Link to="/login" className="sh-btn sh-btn--ghost sh-btn--sm" style={{ flex: 1, justifyContent: 'center' }}>Login</Link>
                )}
                <Link to="/pendaftaran/informasi" className="sh-btn sh-btn--primary sh-btn--sm" style={{ flex: 1, justifyContent: 'center' }}>Daftar PPDB</Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
