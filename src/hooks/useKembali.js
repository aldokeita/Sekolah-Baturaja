import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Tombol kembali yang mengembalikan penekan ke tempat asalnya.
 *
 * Halaman alat bantu — kuis, gatcha, acak nama, papan skor, mode TV — bisa
 * dibuka dari lebih dari satu tempat: dashboard guru, layar absensi digital,
 * atau URL langsung. Selama tujuan tombol kembalinya ditulis mati, salah satu
 * jalan masuk pasti dirugikan: guru yang menekan "Play Quiz" dari dashboard
 * dulu terlempar ke layar absensi, bukan kembali ke tempat ia tadi.
 *
 * `useLocation().key` bernilai 'default' hanya untuk entri PERTAMA di riwayat
 * peramban — halaman dibuka lewat URL langsung, tab baru, atau muat ulang. Di
 * situ tidak ada tempat untuk kembali, dan `navigate(-1)` akan membuang penekan
 * keluar dari aplikasi. Untuk kasus itu tujuan cadangan yang dipakai.
 *
 * @param {string} cadangan - tujuan bila tidak ada riwayat untuk dimundurkan
 * @returns {() => void} penangan siap pasang ke onClick
 */
export default function useKembali(cadangan = '/dashboard') {
  const navigate = useNavigate();
  const { key } = useLocation();

  return useCallback(() => {
    if (key !== 'default') {
      navigate(-1);
      return;
    }
    navigate(cadangan);
  }, [navigate, key, cadangan]);
}
