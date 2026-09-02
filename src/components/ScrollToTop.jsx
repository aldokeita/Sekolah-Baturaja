import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Mengembalikan gulungan ke atas setiap kali rute berganti.
 *
 * Peramban melakukannya sendiri pada situs biasa, tapi aplikasi satu halaman
 * tidak pernah memuat ulang dokumennya, jadi posisi gulungan halaman sebelumnya
 * ikut terbawa. Pengunjung yang menggulir ke tengah Beranda lalu menekan menu
 * "Program" mendarat di tengah halaman Program, melewati judul dan pembukanya.
 *
 * Komponen ini sudah lama ada di repositori tapi TIDAK PERNAH DIPASANG — App
 * hanya mengimpor ScrollToTopButton yang namanya mirip.
 *
 * Tautan berjangkar tidak dipaksa ke atas — `/#faq` memang bermaksud mendarat
 * di bagian tertentu — melainkan diantar ke bagiannya. Peramban hanya melakukan
 * itu sendiri pada pemuatan dokumen; pada perpindahan di dalam aplikasi tidak
 * ada yang menanganinya, jadi menu "Pertanyaan umum" sebelumnya tidak bergerak
 * ke mana-mana. Bagiannya dicari beberapa kali karena isinya bisa datang
 * belakangan.
 *
 * `useLayoutEffect` dipakai supaya perpindahan terjadi sebelum cat pertama —
 * dengan `useEffect` halaman baru sempat terlihat sekejap di posisi lama.
 */
const COBA_JANGKAR = 12;
const JEDA_JANGKAR = 120;

const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useLayoutEffect(() => {
    if (hash) {
      let sisa = COBA_JANGKAR;
      let timer = null;
      const cari = () => {
        const sasaran = document.getElementById(decodeURIComponent(hash.slice(1)));
        if (sasaran) {
          sasaran.scrollIntoView({ block: 'start', behavior: 'instant' });
          return;
        }
        sisa -= 1;
        if (sisa > 0) timer = setTimeout(cari, JEDA_JANGKAR);
      };
      cari();
      return () => { if (timer) clearTimeout(timer); };
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    /* Sekali lagi pada bingkai berikutnya. Halaman publik memasang animasi
     * "muncul saat digulir" yang mengubah tinggi bagian-bagiannya sesaat setelah
     * cat pertama, dan penjangkaran gulungan bawaan peramban kadang menggeser
     * posisi kembali ke bawah. Sekali ulang setelah tata letak tenang cukup
     * untuk menahannya, dan tidak terlihat karena terjadi sebelum bingkai itu
     * digambar. */
    const bingkai = requestAnimationFrame(() => {
      if (window.scrollY !== 0) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    });
    return () => cancelAnimationFrame(bingkai);
  }, [pathname, hash]);

  return null;
};

export default ScrollToTop;
