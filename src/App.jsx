import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import PublicLayout from '@/components/sdnb/PublicLayout';
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import ProfilePage from '@/pages/ProfilePage';
import ContactPage from '@/pages/ContactPage';
import PaymentStatusPage from '@/pages/PaymentStatusPage';
import ProtectedRoute from '@/components/ProtectedRoute';
import ScrollToTopButton from '@/components/ScrollToTopButton';
import NewsPage from '@/pages/NewsPage';
import FacilitiesPage from '@/pages/FacilitiesPage';
import ProgramPage from '@/pages/ProgramPage';
import PpdbPage from '@/pages/PpdbPage';
import PrestasiPage from '@/pages/PrestasiPage';
import EkstrakurikulerPage from '@/pages/EkstrakurikulerPage';
import DigitalAttendancePage from '@/pages/DigitalAttendancePage';
import TvDisplayPage from '@/pages/TvDisplayPage';
import QuizHafalanPage from '@/pages/QuizHafalanPage';
import GatchaGamePage from '@/pages/GatchaGamePage';
import GalleryPage from '@/pages/GalleryPage';
import RandomNamePage from '@/pages/RandomNamePage';
import TopScorePage from '@/pages/TopScorePage';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { publicFetch } from '@/lib/apiClient';
import { enableDeferredFeatures, enableGameFeatures } from '@/lib/featureFlags';

const RouteLogger = () => {
  const location = useLocation();
  useEffect(() => {
    console.log(`App Routing to: ${location.pathname}${location.search}`);
  }, [location]);
  return null;
};

/* ------------------------------------------------------------------ */
/* Dynamic logo crossfade helper                                      */
/* Shows the official local logo first, then crossfades to the remote logo. */
/* ------------------------------------------------------------------ */
const DynamicLogo = ({ className = '', width = 48, height = 48 }) => {
  const [dynamicUrl, setDynamicUrl] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchLogo = async () => {
      try {
        const data = await publicFetch('/api/content/website?keys=logoUrl');
        const url = data?.logoUrl;
        if (!cancelled && url && url !== '/logo-lpq-al-fath-maulana.webp') {
          const img = new Image();
          img.onload = () => { if (!cancelled) { setDynamicUrl(url); setReady(true); } };
          img.src = url;
        }
      } catch { /* keep local logo */ }
    };
    fetchLogo();
    return () => { cancelled = true; };
  }, []);

  return (
    <span className={`relative inline-block ${className}`} style={{ width, height }}>
      {/* Local logo — always present */}
      <img
        src="/logo-lpq-al-fath-maulana.webp"
        alt="Logo LPQ Al-Fath Maulana"
        width={width}
        height={height}
        className="absolute inset-0 w-full h-full object-contain"
        style={{ opacity: ready ? 0 : 1, transition: 'opacity 0.5s ease' }}
      />
      {/* Dynamic logo — crossfades in when loaded */}
      {dynamicUrl && (
        <img
          src={dynamicUrl}
          alt="Logo LPQ Al-Fath Maulana"
          width={width}
          height={height}
          className="absolute inset-0 w-full h-full object-contain"
          style={{ opacity: ready ? 1 : 0, transition: 'opacity 0.5s ease' }}
        />
      )}
    </span>
  );
};

const DeferredFeaturePage = () => (
  <div className="min-h-screen flex items-center justify-center bg-background px-4">
    <div className="max-w-md text-center space-y-3">
      <h1 className="text-2xl font-bold text-foreground">Fitur belum diaktifkan</h1>
      <p className="text-muted-foreground">
        Fitur ini belum tersedia.
      </p>
    </div>
  </div>
);

const allDashboardRoles = ['admin', 'guru', 'santri', 'pentashih', 'tata_usaha'];
const operationalDisplayRoles = ['admin', 'guru', 'pentashih', 'tata_usaha'];

function App() {
  /* ----------------------------------------------------------------
   * Dismiss the inline loading shell that lives in index.html.
   * The shell is pure HTML+CSS and appears instantly before React.
   * We remove it on mount so there is zero additional delay.
   * ---------------------------------------------------------------- */
  useEffect(() => {
    const shell = document.getElementById('lpq-loading');
    if (shell) {
      shell.classList.add('lpq-loading-hide');
      // Remove from DOM after transition completes
      const onEnd = () => shell.remove();
      shell.addEventListener('transitionend', onEnd, { once: true });
      // Fallback removal if transitionend doesn't fire
      setTimeout(() => shell.remove(), 600);
    }
    try {
      sessionStorage.setItem('lpq_initial_load_done', 'true');
    } catch {
      // sessionStorage can be unavailable in restricted browser modes.
    }
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <DndProvider backend={HTML5Backend}>
          <Router>
            <RouteLogger />
            <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
              <Routes>
                <Route path="/absensi-digital" element={<ProtectedRoute allowedRoles={operationalDisplayRoles}><DigitalAttendancePage /></ProtectedRoute>} />
                <Route path="/tv-display-mode" element={<ProtectedRoute allowedRoles={operationalDisplayRoles}><TvDisplayPage /></ProtectedRoute>} />
                {enableGameFeatures ? (
                  <>
                    <Route path="/quiz-hafalan" element={<ProtectedRoute><QuizHafalanPage /></ProtectedRoute>} />
                    <Route path="/gatcha-game" element={<ProtectedRoute><GatchaGamePage /></ProtectedRoute>} />
                    <Route path="/random-name" element={<ProtectedRoute><RandomNamePage /></ProtectedRoute>} />
                    <Route path="/top-score" element={<ProtectedRoute><TopScorePage /></ProtectedRoute>} />
                  </>
                ) : (
                  <>
                    <Route path="/quiz-hafalan" element={<ProtectedRoute><DeferredFeaturePage /></ProtectedRoute>} />
                    <Route path="/gatcha-game" element={<ProtectedRoute><DeferredFeaturePage /></ProtectedRoute>} />
                    <Route path="/random-name" element={<ProtectedRoute><DeferredFeaturePage /></ProtectedRoute>} />
                    <Route path="/top-score" element={<ProtectedRoute><DeferredFeaturePage /></ProtectedRoute>} />
                  </>
                )}

                {/* Login and the dashboard sit outside the public shell: the
                    mockup's Login page is a standalone full-screen design with no
                    nav/footer, and the dashboard has its own chrome (the public
                    wrapper's font + overflow rules would bleed into it). */}
                {/* Standalone full-screen mockups: no shared nav/footer. */}
                <Route path="/pendaftaran" element={<PpdbPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/dashboard" element={<ProtectedRoute allowedRoles={allDashboardRoles}><DashboardPage /></ProtectedRoute>} />

                <Route path="*" element={
                  <PublicLayout>
                    <main className="flex-grow">
                      <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/profil" element={<ProfilePage />} />
                        <Route path="/profil/galeri" element={<GalleryPage />} />
                        {/* LPQ-only public pages (Parenting, Metode Qiroati, Forum,
                            Brosur, Sistem Mengaji, Pengumuman, detail Berita) were
                            removed with the switch to the SDN Baturaja template.
                            Announcements are a Berita category now, and Berita has a
                            built-in article reader, so no detail route is needed. */}
                        <Route path="/kontak" element={<ContactPage />} />
                        <Route path="/status-pembayaran/:paymentId" element={<PaymentStatusPage />} />
                        <Route path="/berita" element={<NewsPage />} />
                        <Route path="/fasilitas" element={<FacilitiesPage />} />
                        <Route path="/program" element={<ProgramPage />} />
                        <Route path="/prestasi" element={<PrestasiPage />} />
                        <Route path="/ekstrakurikuler" element={<EkstrakurikulerPage />} />
                      </Routes>
                    </main>
                  </PublicLayout>
                } />
              </Routes>
              <Toaster />
              <ScrollToTopButton />
            </div>
          </Router>
        </DndProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
