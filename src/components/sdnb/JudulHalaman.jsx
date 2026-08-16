import React from 'react';
import { Helmet } from 'react-helmet';
import useSchoolIdentity from '@/hooks/useSchoolIdentity';

/**
 * Judul dan deskripsi halaman publik, memakai nama sekolah pembeli.
 *
 * Kenapa ini ada: sembilan halaman publik dulu menulis judulnya sebagai teks
 * mati — `<title>Prestasi — Sekolah Dasar Negeri Baturaja</title>`. Pembeli yang
 * sudah mengganti nama sekolahnya di panel Identitas tetap mengirimkan nama
 * sekolah CONTOH ke tab peramban, penanda buku, hasil pencarian, dan pratinjau
 * tautan saat dibagikan. Header halamannya benar, judulnya tidak — dan justru
 * judul itu yang ikut tersebar ke luar situs.
 *
 * Dibuat sebagai komponen, bukan sekadar memasang hook di tiap halaman, supaya
 * susunan judulnya ada di SATU tempat. Halaman baru cukup memakai komponen ini
 * dan otomatis benar; menyalin pola `useSchoolIdentity` ke sembilan berkas justru
 * mengundang salinan kesepuluh yang lupa.
 *
 * @param {string} [judul] bagian depan judul, mis. "Prestasi". Kosongkan untuk
 *   halaman yang cukup memakai nama sekolah saja.
 * @param {string} [deskripsi] meta description. `{sekolah}` diganti nama sekolah.
 */
const JudulHalaman = ({ judul, deskripsi }) => {
  const sekolah = useSchoolIdentity();
  const nama = sekolah.name;
  const teksJudul = judul ? `${judul} — ${nama}` : nama;
  const teksDeskripsi = deskripsi ? deskripsi.replace(/\{sekolah\}/g, nama) : null;

  return (
    <Helmet>
      <title>{teksJudul}</title>
      {teksDeskripsi ? <meta name="description" content={teksDeskripsi} /> : null}
    </Helmet>
  );
};

export default JudulHalaman;
