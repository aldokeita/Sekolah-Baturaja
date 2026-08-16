import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import JudulHalaman from '@/components/sdnb/JudulHalaman';
import '@/styles/sdnb.css';

/**
 * Halaman "tidak ditemukan" untuk seluruh alamat yang tidak dikenal.
 *
 * Sebelum ini tidak ada sama sekali. Rute penampung di App.jsx membungkus
 * halaman publik di dalam PublicLayout, dan alamat yang tidak cocok dengan satu
 * pun rute di dalamnya menghasilkan **badan halaman kosong** — navbar di atas,
 * footer di bawah, tidak ada apa-apa di antaranya. Pengunjung tidak diberi tahu
 * bahwa ia salah alamat, dan tidak diberi jalan keluar.
 *
 * Ditemukan lewat tombol "Play Quiz" di dashboard guru yang menuju rute yang
 * belum terdaftar, tapi penyebabnya jauh lebih luas daripada satu tombol itu:
 * setiap salah ketik, tautan lama yang sudah dihapus, dan pranala basi dari luar
 * mendarat di tempat yang sama.
 *
 * Alamat yang diminta ikut ditampilkan supaya pengunjung bisa mengenali salah
 * ketiknya sendiri, dan sekolah punya sesuatu untuk disebut saat dilapori.
 */
const NotFoundPage = () => {
  const { pathname } = useLocation();

  const tombol = {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: '12px 20px', borderRadius: '14px',
    fontSize: '14px', fontWeight: 700, textDecoration: 'none',
  };

  return (
    <>
      <JudulHalaman
        judul="Halaman tidak ditemukan"
        deskripsi="Alamat yang Anda buka tidak ada di situs {sekolah}."
      />

      <main className="sdnb" style={{ maxWidth: '760px', margin: '0 auto', padding: '64px 20px 88px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--sekolah-aksen-teks)' }}>
          Halaman tidak ditemukan
        </div>
        <h1 style={{ margin: '12px 0 0', fontSize: '34px', lineHeight: 1.12, letterSpacing: '-.03em', fontWeight: 800, color: '#171827' }}>
          Alamat ini tidak ada di situs kami.
        </h1>
        <p style={{ margin: '14px 0 0', maxWidth: '560px', fontSize: '15px', lineHeight: 1.65, color: '#535878' }}>
          Mungkin alamatnya salah ketik, atau halamannya sudah dipindahkan. Silakan kembali ke
          beranda, atau hubungi sekolah bila Anda merasa seharusnya ada sesuatu di sini.
        </p>

        <p
          style={{
            margin: '20px 0 0', padding: '12px 15px', borderRadius: '14px',
            fontSize: '13px', color: '#5f6389', wordBreak: 'break-all',
            background: 'rgba(255,255,255,.55)', border: '1px solid rgba(255,255,255,.8)',
          }}
        >
          Alamat yang diminta: <strong style={{ color: '#3d4166' }}>{pathname}</strong>
        </p>

        <div style={{ marginTop: '26px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <Link
            to="/"
            style={{
              ...tombol, color: '#fff',
              background: 'linear-gradient(135deg,var(--sekolah-aksen),var(--sekolah-aksen-tengah))',
              boxShadow: '0 14px 30px -14px rgba(95,105,235,.9),inset 0 1px 0 rgba(255,255,255,.5)',
            }}
          >
            Kembali ke beranda
          </Link>
          <Link
            to="/kontak"
            style={{
              ...tombol, color: '#33375a',
              background: 'rgba(255,255,255,.62)',
              border: '1px solid rgba(255,255,255,.9)',
              boxShadow: '0 12px 26px -14px rgba(60,70,120,.7),inset 0 1px 0 rgba(255,255,255,.95)',
            }}
          >
            Hubungi sekolah
          </Link>
        </div>
      </main>
    </>
  );
};

export default NotFoundPage;
