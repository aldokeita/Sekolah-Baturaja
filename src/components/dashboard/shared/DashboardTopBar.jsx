import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

const tombol = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  flex: 'none',
  height: 38,
  padding: '0 13px',
  borderRadius: 12,
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  border: '1px solid rgba(255,255,255,.55)',
  background: 'rgba(255,255,255,.62)',
  color: '#33375a',
  backdropFilter: 'blur(18px) saturate(180%)',
  WebkitBackdropFilter: 'blur(18px) saturate(180%)',
  boxShadow: '0 10px 22px -12px rgba(60,70,120,.55),inset 0 1px 0 rgba(255,255,255,.9)',
};

const DashboardTopBar = () => {
  const { role, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const sekolah = useSchoolIdentity();
  const navigate = useNavigate();

  const topbarButtonStyle = {
    ...tombol,
    ...(isDark ? {
      background: '#202732',
      border: '1px solid #364152',
      color: '#dbe4ef',
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
      boxShadow: '0 2px 6px rgba(0,0,0,.34)',
    } : {}),
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 45, padding: '12px 16px 0' }}>
      <div
        style={{
          maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 12px 10px 14px', borderRadius: 18,
          background: isDark ? '#151b24' : 'rgba(255,255,255,.55)',
          backdropFilter: isDark ? 'none' : 'blur(26px) saturate(185%)',
          WebkitBackdropFilter: isDark ? 'none' : 'blur(26px) saturate(185%)',
          border: isDark ? '1px solid #2e3744' : '1px solid rgba(255,255,255,.7)',
          boxShadow: isDark ? '0 8px 20px rgba(0,0,0,.3)' : '0 18px 40px -20px rgba(55,65,120,.5),inset 0 1px 0 rgba(255,255,255,.95)',
        }}
      >
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, color: 'inherit' }}>
          <div style={{ flex: 'none', width: 36, height: 36, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', background: isDark ? '#138a6a' : 'linear-gradient(140deg,var(--sekolah-aksen),var(--sekolah-aksen-tengah-2) 45%,var(--sekolah-aksen-ujung))', boxShadow: isDark ? '0 6px 14px rgba(0,0,0,.3)' : '0 10px 20px -8px rgba(110,120,220,.75),inset 0 1px 0 rgba(255,255,255,.8)' }}>
            {sekolah.logoAbbr}
          </div>
          <div style={{ minWidth: 0, lineHeight: 1.2 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: '-.01em', color: isDark ? '#f1f5f9' : '#1b1c28', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sekolah.shortName}
            </div>
            <div style={{ fontSize: 11, fontWeight: 500, color: isDark ? '#9aa6b5' : '#6c718f' }}>
              {LABEL_PERAN[role] || 'Portal sekolah'}
            </div>
          </div>
        </Link>

        <div style={{ flex: 1 }} />

        <button type="button" onClick={toggleTheme} aria-label="Ganti tema terang atau gelap" style={{ ...topbarButtonStyle, width: 38, padding: 0, justifyContent: 'center' }}>
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Label disembunyikan di layar sempit lewat kelas di admin-dashboard.css,
            ikonnya tetap tampil supaya tombolnya tidak pernah hilang. aria-label
            selalu ada, karena di ponsel teksnya tidak terbaca sama sekali. */}
        <Link to="/" aria-label="Lihat situs sekolah" style={topbarButtonStyle}>
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          <span className="dash-topbar__label">Lihat situs</span>
        </Link>

        <button type="button" onClick={handleLogout} aria-label="Keluar dari akun" style={{ ...topbarButtonStyle, color: isDark ? '#fda4af' : '#b04a5a' }}>
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span className="dash-topbar__label">Keluar</span>
        </button>
      </div>
    </div>
  );
};

export default DashboardTopBar;
