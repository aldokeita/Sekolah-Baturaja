import apiClient from '@/lib/apiClient';

/* Jurnal mengajar guru — catatan harian tiap pertemuan.
 *
 * Bedanya dengan Materi & Tugas (`kelasKontenAdapters.js`, kini dimatikan):
 * jurnal ini catatan guru untuk kepala sekolah, dan murid tidak pernah
 * melihatnya. Materi & Tugas justru sebaliknya — papan untuk murid.
 */

export const getJurnalErrorMessage = (error) => {
  const message = String(error?.error || error?.message || error || '').trim();
  if (!message) return 'Operasi jurnal gagal.';
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.';
  }
  return message;
};

export const fetchJurnalList = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.guruId) params.set('guru_id', filters.guruId);
  if (filters.classId) params.set('class_id', filters.classId);
  if (filters.periodeId) params.set('periode_id', filters.periodeId);
  if (filters.dari) params.set('dari', filters.dari);
  if (filters.sampai) params.set('sampai', filters.sampai);
  if (filters.search) params.set('search', filters.search);
  params.set('limit', String(filters.limit || 100));
  const data = await apiClient.get(`/api/jurnal-mengajar?${params.toString()}`);
  return data || [];
};

export const createJurnal = async ({
  guruId, classId, mataPelajaranId, periodeId, tanggal, jamKe,
  materi, jumlahHadir, jumlahMurid, kendala, tindakLanjut,
}) => apiClient.post('/api/jurnal-mengajar', {
  guru_id: guruId || null,
  class_id: classId,
  mata_pelajaran_id: mataPelajaranId,
  periode_id: periodeId,
  tanggal: tanggal || null,
  jam_ke: jamKe || null,
  materi,
  // Angka dikirim sebagai null saat kosong; string kosong akan ditolak kolom
  // integer-nya dengan galat yang tidak menjelaskan apa pun kepada guru.
  jumlah_hadir: String(jumlahHadir ?? '').trim() === '' ? null : Number(jumlahHadir),
  jumlah_murid: String(jumlahMurid ?? '').trim() === '' ? null : Number(jumlahMurid),
  kendala: kendala || null,
  tindak_lanjut: tindakLanjut || null,
});

/* Kelas, mata pelajaran, periode, dan tanggal TIDAK ikut di sini — backend pun
 * menolaknya. Mengubahnya sama dengan memindahkan catatan satu pertemuan menjadi
 * pertemuan lain; yang salah dihapus lalu dicatat ulang. */
export const updateJurnal = async (id, { jamKe, materi, jumlahHadir, jumlahMurid, kendala, tindakLanjut }) => (
  apiClient.put(`/api/jurnal-mengajar/${id}`, {
    jam_ke: jamKe ?? null,
    materi: materi ?? null,
    jumlah_hadir: String(jumlahHadir ?? '').trim() === '' ? null : Number(jumlahHadir),
    jumlah_murid: String(jumlahMurid ?? '').trim() === '' ? null : Number(jumlahMurid),
    kendala: kendala ?? null,
    tindak_lanjut: tindakLanjut ?? null,
  })
);

export const deleteJurnal = async (id) => apiClient.delete(`/api/jurnal-mengajar/${id}`);
