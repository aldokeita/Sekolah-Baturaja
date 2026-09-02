import apiClient from '@/lib/apiClient';

/* Agenda surat keluar sekolah.
 *
 * Nomor surat TIDAK pernah dikirim dari sini — server yang menentukannya. Itu
 * bukan kerapian belaka: nomor surat adalah nomor agenda resmi, dan membiarkan
 * peramban mengusulkannya berarti dua petugas bisa menghasilkan nomor yang sama.
 */

export const JENIS_SURAT = [
  {
    value: 'keterangan_aktif',
    label: 'Keterangan Aktif Sekolah',
    perihal: 'Surat Keterangan Aktif Sekolah',
    butuhMurid: true,
    penerimaLabel: 'Ditujukan kepada',
    penerimaContoh: 'Bank Sumsel Babel / Dinas Sosial',
    keperluan: true,
  },
  {
    value: 'pindah',
    label: 'Keterangan Pindah Sekolah',
    perihal: 'Surat Keterangan Pindah Sekolah',
    butuhMurid: true,
    penerimaLabel: 'Sekolah tujuan',
    penerimaContoh: 'SD Negeri 5 Baturaja',
  },
  {
    value: 'tidak_mampu',
    label: 'Keterangan Murid Tidak Mampu',
    perihal: 'Surat Keterangan Murid Tidak Mampu',
    butuhMurid: true,
    penerimaLabel: 'Ditujukan kepada',
    penerimaContoh: 'Panitia beasiswa',
    keperluan: true,
  },
  {
    value: 'umum',
    label: 'Keterangan Umum',
    perihal: 'Surat Keterangan',
    butuhMurid: false,
    penerimaLabel: 'Ditujukan kepada',
    penerimaContoh: 'Pihak yang berkepentingan',
  },
];

export const labelJenisSurat = (value) => (
  JENIS_SURAT.find((j) => j.value === value)?.label || value || '-'
);

export const getSuratErrorMessage = (error) => {
  const message = String(error?.error || error?.message || error || '').trim();
  if (!message) return 'Operasi surat gagal.';
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.';
  }
  return message;
};

export const fetchSuratList = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.jenis) params.set('jenis', filters.jenis);
  if (filters.tahun) params.set('tahun', String(filters.tahun));
  if (filters.santriId) params.set('santri_id', filters.santriId);
  if (filters.hanyaBerlaku) params.set('hanya_berlaku', 'true');
  if (filters.search) params.set('search', filters.search);
  if (filters.page) params.set('page', String(filters.page));
  params.set('limit', String(filters.limit || 50));
  const qs = params.toString();
  const data = await apiClient.get(`/api/surat${qs ? `?${qs}` : ''}`);
  return data || [];
};

export const fetchSurat = async (id) => apiClient.get(`/api/surat/${id}`);

export const createSurat = async ({ jenis, santriId, perihal, penerima, isi, tanggalSurat, data }) => (
  apiClient.post('/api/surat', {
    jenis,
    santri_id: santriId || null,
    perihal: perihal || null,
    penerima: penerima || null,
    isi: isi || null,
    tanggal_surat: tanggalSurat || null,
    data: data || {},
  })
);

export const updateSurat = async (id, updates) => apiClient.put(`/api/surat/${id}`, updates);

/* Surat yang salah DIBATALKAN, tidak dihapus, dan nomornya tidak dipakai ulang.
 * Buku agenda surat tidak boleh punya nomor yang hilang — nomor yang lompat
 * adalah pertanyaan pertama pengawas. */
export const batalkanSurat = async (id, alasan) => (
  apiClient.post(`/api/surat/${id}/batal`, { alasan: alasan || '' })
);

/* Mencatat murid keluar: tanggal, alasan, sekolah tujuan, penonaktifan akunnya,
 * dan surat pindahnya sekaligus. Satu panggilan, karena keempatnya memang satu
 * peristiwa — dan karena surat harus terbit SEBELUM muridnya dinonaktifkan agar
 * kelas terakhirnya masih terbaca. */
export const mutasiKeluarSantri = async (santriId, {
  tanggalKeluar, alasanKeluar, sekolahTujuan, keterangan, buatSurat = true,
}) => (
  apiClient.post(`/api/santri/${santriId}/mutasi-keluar`, {
    tanggal_keluar: tanggalKeluar || null,
    alasan_keluar: alasanKeluar,
    sekolah_tujuan: sekolahTujuan || '',
    keterangan: keterangan || '',
    buat_surat: Boolean(buatSurat),
  })
);
