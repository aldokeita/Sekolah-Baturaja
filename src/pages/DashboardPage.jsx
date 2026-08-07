
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import useAdminBodyClass from '@/hooks/useAdminBodyClass';
import useSchoolIdentity from '@/hooks/useSchoolIdentity';
import ErrorBoundary from '@/components/ErrorBoundary';
import AdminDashboard from '@/components/dashboard/AdminDashboard';
import TataUsahaDashboard from '@/components/dashboard/TataUsahaDashboard';
import GuruDashboard from '@/components/dashboard/GuruDashboard';
import SantriDashboard from '@/components/dashboard/SantriDashboard';
import PentashihDashboard from '@/components/dashboard/PentashihDashboard';
import SideRays from '@/components/reactbits/SideRays/SideRays';
import { fetchSantriDetail } from '@/lib/dataMasterAdapters';
import '@/styles/admin-dashboard.css';

const DashboardPage = () => {
  const { role, user } = useAuth();
  const { isDark } = useTheme();
  const sekolah = useSchoolIdentity();
  const [santriProfile, setSantriProfile] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // Keep every authenticated dashboard on the neutral portal surface. Without
  // this class the santri dashboard inherits the legacy forest-green body.
  useAdminBodyClass(Boolean(role));

  useEffect(() => {
      console.log('DashboardPage mounted, Context State:', { role, userId: user?.id });

      const fetchProfile = async () => {
          setIsLoadingProfile(true);
          try {
            if (role === 'santri' && user) {
                const data = await fetchSantriDetail(user.id);
                setSantriProfile(data);
            } else {
                setSantriProfile(null);
            }
          } catch (err) {
            console.error('Error fetching dashboard profile info:', err);
          } finally {
            setIsLoadingProfile(false);
          }
      };

      if (user && role === 'santri') {
        fetchProfile();
      } else {
        setSantriProfile(null);
        setIsLoadingProfile(false);
      }
  }, [role, user]);

  // Admin and Tata Usaha render through DashboardWorkspace, which already
  // brings the SDN Aurora Glass shell (background wash + orbs).
  const usesSdnbTheme = role === 'admin' || role === 'superadmin' || role === 'tata_usaha';

  const renderDashboard = () => {
    console.log('Rendering dashboard based on role:', role);

    if (isLoadingProfile) {
        return (
          <div className="admin-loading-container">
            <div className="admin-loading-spinner">
              <div className="admin-loading-spinner-ring" />
              <div className="admin-loading-spinner-ring admin-loading-spinner-ring--delay" />
            </div>
            <h2 className="admin-loading-title">Memuat Profil…</h2>
            <p className="admin-loading-subtitle">Mengambil data akun Anda</p>
            <div className="admin-loading-bar-track">
              <div className="admin-loading-bar-fill" />
            </div>
          </div>
        );
    }

    // superadmin memakai dashboard admin; bedanya hanya tab Identitas Sekolah
    // yang tampil untuknya (lihat ContentManagement).
    if (role === 'admin' || role === 'superadmin') {
      return <AdminDashboard />;
    } else if (role === 'tata_usaha') {
      return <TataUsahaDashboard />;
    } else if (role === 'guru') {
      return <GuruDashboard />;
    } else if (role === 'santri') {
      return <SantriDashboard isAdult={santriProfile?.kategori === 'Dewasa'} />;
    } else if (role === 'pentashih') {
      return <PentashihDashboard />;
    } else if (user && !role) {
      return (
        <div className="flex justify-center items-center h-[60vh] flex-col max-w-md mx-auto text-center">
           <div className="bg-destructive/10 text-destructive p-6 rounded-xl border border-destructive/20 mb-4">
              <h2 className="text-xl font-bold mb-2">Role Tidak Terdeteksi</h2>
              <p>Gagal mengidentifikasi role pengguna Anda. Silakan coba login ulang atau hubungi administrator.</p>
           </div>
           <button
             onClick={() => window.location.href = '/login'}
             className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
           >
             Kembali ke Login
           </button>
        </div>
      );
    }

    return (
      <div className="admin-loading-container">
        <div className="admin-loading-spinner">
          <div className="admin-loading-spinner-ring" />
          <div className="admin-loading-spinner-ring admin-loading-spinner-ring--delay" />
        </div>
        <h2 className="admin-loading-title">Menyiapkan Dashboard…</h2>
        <p className="admin-loading-subtitle">Mendeteksi hak akses Anda</p>
        <div className="admin-loading-bar-track">
          <div className="admin-loading-bar-fill" />
        </div>
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>{`Dashboard - ${sekolah.shortName}`}</title>
        <meta name="description" content={`Dashboard sistem manajemen ${sekolah.name}`} />
      </Helmet>

      <div className={`min-h-screen relative ${usesSdnbTheme ? '' : 'lpq-admin-surface py-8'}`}>
        {/* SideRays — dark mode only, behind content. Surface is transparent
            so rays show through the gaps between cards and panels. Skipped for
            the dashboards already re-skinned to the SDN Aurora Glass theme,
            which paint their own fixed background and floating orbs. */}
        {isDark && !usesSdnbTheme && (
          <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
            <SideRays
              speed={1.2}
              rayColor1="#06b6d4"
              rayColor2="#8b5cf6"
              intensity={2.0}
              spread={2.5}
              origin="top-right"
              tilt={5}
              saturation={1.5}
              blend={0.6}
              falloff={1.4}
              opacity={0.5}
            />
          </div>
        )}
        <div className="relative" style={{ zIndex: 1 }}>
          {/* Tanpa boundary, satu error saat render memutihkan seluruh aplikasi
              tanpa pesan apa pun. key={role} mereset boundary ketika peran
              berubah, supaya error lama tidak menempel setelah login ulang. */}
          <ErrorBoundary key={role} title="Dashboard Gagal Dimuat">
            {renderDashboard()}
          </ErrorBoundary>
        </div>
      </div>
    </>
  );
};

export default DashboardPage;
