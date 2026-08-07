import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import useSchoolIdentity from '@/hooks/useSchoolIdentity';
import { cekStatusPendaftaran } from '@/lib/ppdbAdapters';
import '@/styles/sdnb.css';

/**
 * Cek status pendaftaran PPDB — halaman publik, tanpa login.
 *
 * Sebelum halaman ini ada, orang tua hanya melihat nomor pendaftarannya sekali di
 * layar terakhir formulir, lalu tidak punya cara apa pun mengetahui hasilnya
 * selain menelepon sekolah.
 *
 * Tanggal lahir diminta bersama nomornya, dan itu bukan formalitas: nomor
 * pendaftaran berurutan dan mudah diterka, jadi tanpa pasangan kedua siapa pun bisa
 * menyisir PPDB-2026-0001 sampai 9999 dan memanen nama seluruh pendaftar. Server
 * juga membatasi lajunya dan memberi pesan yang sama untuk "nomor tidak ada" dan
 * "tanggal tidak cocok" — lihat CekStatus di backend/internal/handler/ppdb.go.
 */

const NADA = {
  baru: { judul: 'Pendaftaran sudah kami terima', warna: '#0ea5e9', kabar: 'Berkas Anda menunggu diperiksa petugas. Belum ada yang perlu Anda lakukan.' },
  diverifikasi: { judul: 'Berkas sudah diperiksa', warna: '#f59e0b', kabar: 'Berkas Anda lengkap dan sudah diperiksa. Hasil seleksi akan diumumkan sesuai jadwal.' },
  diterima: { judul: 'Selamat, ananda diterima', warna: '#10b981', kabar: 'Langkah berikutnya adalah daftar ulang di ruang tata usaha. Mohon membawa berkas asli beserta fotokopinya.' },
  ditolak: { judul: 'Belum dapat diterima', warna: '#f43f5e', kabar: 'Mohon maaf, ananda belum dapat kami terima pada tahun ajaran ini karena keterbatasan daya tampung.' },
};

const kotak = {
  width: '100%', padding: '13px 15px', borderRadius: '14px', fontFamily: 'inherit',
  fontSize: '14px', color: '#22243c', background: 'rgba(255,255,255,.72)',
  border: '1px solid rgba(255,255,255,.95)', outline: 'none',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.95)',
};

const label = {
  display: 'block', marginBottom: '7px', fontSize: '12px', fontWeight: 700, color: '#4a4f74',
};

const CekPendaftaranPage = () => {
  const sekolah = useSchoolIdentity();
  const [nomor, setNomor] = useState('');
  const [tanggalLahir, setTanggalLahir] = useState('');
  const [hasil, setHasil] = useState(null);
  const [galat, setGalat] = useState('');
  const [memeriksa, setMemeriksa] = useState(false);

  const periksa = async (e) => {
    e.preventDefault();
    if (memeriksa) return;
    setGalat('');
    setHasil(null);
    if (!nomor.trim() || !tanggalLahir) {
      setGalat('Nomor pendaftaran dan tanggal lahir wajib diisi.');
      return;
    }
    setMemeriksa(true);
    try {
      setHasil(await cekStatusPendaftaran({ nomor: nomor.trim(), tanggalLahir }));
    } catch (error) {
      setGalat(error.message || 'Gagal memeriksa pendaftaran.');
    } finally {
      setMemeriksa(false);
    }
  };

  const nada = hasil ? (NADA[hasil.status] || NADA.baru) : null;

  // PublicLayout dipasang oleh App.jsx untuk seluruh rute di blok publik, jadi
  // halaman ini hanya merender isinya.
  return (
    <>
      <Helmet>
        <title>{`Cek Status Pendaftaran — ${sekolah.name}`}</title>
        <meta name="description" content={`Periksa status pendaftaran murid baru ${sekolah.name} dengan nomor pendaftaran.`} />
      </Helmet>

      <main className="sdnb" style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 20px 72px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--sekolah-aksen-pekat)' }}>
          SPMB {sekolah.academicYear}
        </div>
        <h1 style={{ margin: '12px 0 0', fontSize: '34px', lineHeight: 1.12, letterSpacing: '-.03em', fontWeight: 800, color: '#171827' }}>
          Cek status pendaftaran
        </h1>
        <p style={{ margin: '14px 0 0', maxWidth: '560px', fontSize: '15px', lineHeight: 1.65, color: '#535878' }}>
          Masukkan nomor pendaftaran yang Anda terima setelah mengirim formulir, beserta tanggal lahir
          calon murid. Keduanya harus cocok.
        </p>

        <form
          onSubmit={periksa}
          style={{
            marginTop: '28px', padding: '24px', borderRadius: '22px',
            background: 'rgba(255,255,255,.55)', border: '1px solid rgba(255,255,255,.8)',
            boxShadow: '0 24px 52px -24px rgba(55,65,120,.5),inset 0 1px 0 rgba(255,255,255,.95)',
          }}
        >
          <div style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label htmlFor="cek-nomor" style={label}>Nomor pendaftaran</label>
              <input
                id="cek-nomor"
                value={nomor}
                onChange={(e) => setNomor(e.target.value)}
                placeholder="SPMB-2026-0001"
                autoComplete="off"
                style={kotak}
              />
            </div>
            <div>
              <label htmlFor="cek-lahir" style={label}>Tanggal lahir calon murid</label>
              <input
                id="cek-lahir"
                type="date"
                value={tanggalLahir}
                onChange={(e) => setTanggalLahir(e.target.value)}
                style={kotak}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={memeriksa}
            style={{
              marginTop: '20px', padding: '14px 26px', borderRadius: '15px', border: 0,
              fontFamily: 'inherit', fontSize: '14px', fontWeight: 700, color: '#fff',
              cursor: memeriksa ? 'not-allowed' : 'pointer', opacity: memeriksa ? 0.5 : 1,
              background: 'linear-gradient(135deg,var(--sekolah-aksen-pekat),var(--sekolah-aksen-tengah) 55%,var(--sekolah-aksen-ujung))',
              boxShadow: '0 18px 36px -16px rgba(90,100,235,.9),inset 0 1px 0 rgba(255,255,255,.6)',
            }}
          >
            {memeriksa ? 'Memeriksa…' : 'Periksa status'}
          </button>

          {galat && (
            <div
              role="alert"
              style={{
                marginTop: '18px', padding: '14px 16px', borderRadius: '14px',
                background: 'rgba(254,226,226,.85)', border: '1px solid rgba(248,113,113,.55)',
                fontSize: '13.5px', lineHeight: 1.55, color: '#b91c1c',
              }}
            >
              {galat}
            </div>
          )}
        </form>

        {hasil && (
          <div
            className="bukti-cetak"
            style={{
              marginTop: '22px', padding: '26px', borderRadius: '22px',
              background: 'rgba(255,255,255,.62)', border: '1px solid rgba(255,255,255,.85)',
              boxShadow: '0 24px 52px -24px rgba(55,65,120,.45),inset 0 1px 0 rgba(255,255,255,.95)',
            }}
          >
            {/* Kepala surat hanya muncul di hasil cetak. Di layar, nama sekolah sudah
                ada di bilah navigasi; di kertas tidak ada apa pun yang menyebutnya,
                dan lembar bukti tanpa nama sekolah tidak berguna. */}
            <div className="bukti-kepala" style={{ display: 'none' }}>
              <strong style={{ fontSize: '15px' }}>{sekolah.name}</strong>
              <div style={{ fontSize: '12px' }}>{sekolah.address}</div>
              <div style={{ fontSize: '12px' }}>{sekolah.phone} · {sekolah.email}</div>
              <div style={{ marginTop: '10px', fontSize: '14px', fontWeight: 700 }}>
                Bukti Pendaftaran SPMB {hasil.tahun_ajaran}
              </div>
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '7px 14px', borderRadius: '99px', fontSize: '12.5px', fontWeight: 700, color: '#fff', background: nada.warna }}>
              {nada.judul}
            </div>
            <h2 style={{ margin: '18px 0 0', fontSize: '22px', fontWeight: 800, letterSpacing: '-.02em', color: '#1b1c2c' }}>
              {hasil.nama_lengkap}
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#6b7093' }}>
              {hasil.nomor_pendaftaran} · SPMB {hasil.tahun_ajaran}
              {hasil.jalur_label ? ` · jalur ${hasil.jalur_label}` : ''}
            </p>
            <p style={{ margin: '16px 0 0', fontSize: '14.5px', lineHeight: 1.65, color: '#4a4f6e' }}>
              {nada.kabar}
            </p>
            {hasil.sudah_jadi_murid && (
              <p style={{ margin: '12px 0 0', fontSize: '13.5px', lineHeight: 1.6, color: '#0f766e', fontWeight: 600 }}>
                Ananda sudah tercatat sebagai murid. Akun untuk masuk ke portal sudah dibuat — tanyakan
                ke tata usaha bila belum menerimanya.
              </p>
            )}
            <p style={{ margin: '18px 0 0', fontSize: '13px', lineHeight: 1.6, color: '#6b7093' }}>
              Ada yang ingin ditanyakan? Hubungi kami di <strong>{sekolah.phone}</strong> pada{' '}
              {sekolah.officeHours}.
            </p>

            {/* Cetak memakai window.print(), bukan pustaka tambahan. Aturan @media
                print di sdnb.css menyembunyikan seluruh halaman kecuali blok bukti
                ini, jadi yang keluar selembar bukti — bukan tangkapan layar situs. */}
            <button
              type="button"
              onClick={() => window.print()}
              className="bukti-sembunyi-cetak"
              style={{
                marginTop: '22px', padding: '12px 22px', borderRadius: '14px',
                border: '1px solid rgba(255,255,255,.95)', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '13.5px', fontWeight: 700, color: '#33375a',
                background: 'rgba(255,255,255,.72)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,.95)',
              }}
            >
              Cetak bukti pendaftaran
            </button>
          </div>
        )}

        <p style={{ marginTop: '26px', fontSize: '13.5px', color: '#6b7093' }}>
          Belum mendaftar? <Link to="/pendaftaran" style={{ color: 'var(--sekolah-aksen-pekat)', fontWeight: 700 }}>Isi formulir pendaftaran</Link>.
        </p>
      </main>
    </>
  );
};

export default CekPendaftaranPage;
