import apiClient from '@/lib/apiClient';

/**
 * Pendaftaran murid baru (PPDB) — akses data.
 *
 * Sebelum ada berkas ini, formulir PPDB meratakan seluruh isinya menjadi satu
 * paragraf lalu mengirimkannya ke endpoint pesan pengunjung. Pendaftaran jadi
 * bercampur dengan pesan biasa, tanpa status dan tanpa kolom — tata usaha
 * membacanya seperti membaca surat.
 *
 * `kirimPendaftaran` memakai fetch mentah, bukan apiClient, karena endpointnya
 * terbuka untuk umum: orang tua calon murid tidak punya akun. Pola yang sama
 * dipakai submitPublicFeedback. Sisanya lewat apiClient supaya tokennya ikut.
 */

const BASE = '/api/ppdb';

export const STATUS_PPDB = Object.freeze({
  baru: { label: 'Baru masuk', warna: 'biru' },
  diverifikasi: { label: 'Sudah diperiksa', warna: 'kuning' },
  diterima: { label: 'Diterima', warna: 'hijau' },
  ditolak: { label: 'Tidak diterima', warna: 'merah' },
});

/** Urutan tetap untuk kartu ringkasan dan pemilih status. */
export const URUTAN_STATUS = Object.freeze(['baru', 'diverifikasi', 'diterima', 'ditolak']);

export const labelStatus = (status) => STATUS_PPDB[status]?.label || status || '—';

export const getPpdbErrorMessage = (error) => {
  if (!error) return 'Terjadi kesalahan tidak diketahui.';
  return error.message || String(error);
};

/**
 * Mengirim pendaftaran dari halaman publik.
 *
 * Server memeriksa ulang seluruh isian, jadi kegagalan di sini adalah pesan
 * berbahasa Indonesia yang layak ditampilkan apa adanya di formulir.
 *
 * Bila orang tua menekan kirim dua kali, server mengembalikan pendaftaran yang
 * sudah ada beserta nomor aslinya dan menandainya `duplikat` — bukan galat, dan
 * bukan baris kedua yang harus dibereskan tata usaha.
 */
export const kirimPendaftaran = async (isian) => {
  const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:8080'}${BASE}`;
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(isian),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Gagal mengirim pendaftaran (${res.status}).`);
  return body.data || {};
};

export const PPDB_PAGE_LIMIT = 200;

export const hitungJumlahHalamanPendaftaran = (total, limit = PPDB_PAGE_LIMIT) => {
  const jumlah = Number(total);
  const ukuran = Number(limit);
  if (!Number.isFinite(jumlah) || jumlah <= 0 || !Number.isFinite(ukuran) || ukuran <= 0) return 0;
  return Math.ceil(jumlah / Math.min(Math.trunc(ukuran), PPDB_PAGE_LIMIT));
};

/** Menyusun query daftar. Diekspor agar filter dan pagination bisa diuji tanpa server. */
export const susunQueryPendaftaran = ({ tahun, status, q, wilayah, page, limit } = {}) => {
  const params = new URLSearchParams();
  if (tahun) params.set('tahun', tahun);
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  if (wilayah) params.set('wilayah', wilayah);
  if (Number.isInteger(page) && page >= 0) params.set('page', String(page));
  if (Number.isFinite(limit) && limit > 0) {
    params.set('limit', String(Math.min(Math.trunc(limit), PPDB_PAGE_LIMIT)));
  }
  return params.toString();
};

/** Satu halaman pendaftaran beserta total setelah filter. page bersifat 0-based. */
export const fetchPendaftaranPage = async (filters = {}) => {
  const query = susunQueryPendaftaran(filters);
  const { data, total } = await apiClient.get(
    query ? `${BASE}?${query}` : BASE,
    { withMeta: true },
  );
  return { data: data || [], total: Number(total) || 0 };
};

/** Mengambil seluruh hasil cocok secara bertahap, terutama untuk ekspor CSV. */
export const fetchAllPendaftaran = async (filters = {}) => {
  const first = await fetchPendaftaranPage({ ...filters, page: 0, limit: PPDB_PAGE_LIMIT });
  const rows = [...first.data];
  if (rows.length >= first.total || rows.length < PPDB_PAGE_LIMIT) return rows;
  const pageCount = hitungJumlahHalamanPendaftaran(first.total);
  for (let page = 1; page < pageCount; page += 1) {
    const next = await fetchPendaftaranPage({ ...filters, page, limit: PPDB_PAGE_LIMIT });
    if (next.data.length === 0) break;
    rows.push(...next.data);
    if (rows.length >= first.total || next.data.length < PPDB_PAGE_LIMIT) break;
  }
  return rows;
};

/** Kontrak lama tetap berupa array; kini tidak terpotong pada satu halaman. */
export const fetchPendaftaran = async (filters = {}) => {
  return fetchAllPendaftaran(filters);
};

/**
 * Angka ringkasan untuk lembar rekap yang dicetak.
 *
 * Dihitung di server, bukan dari daftar halaman aktif. Lembar rekap yang salah
 * dikirim ke dinas lebih buruk daripada tidak ada lembar rekap.
 */
export const fetchRekapPpdb = async (tahun) => {
  const query = tahun ? `?tahun=${encodeURIComponent(tahun)}` : '';
  return apiClient.get(`${BASE}/rekap${query}`);
};

export const fetchStatistikPpdb = async (tahun) => {
  const query = tahun ? `?tahun=${encodeURIComponent(tahun)}` : '';
  const data = await apiClient.get(`${BASE}/statistik${query}`);
  return data || { cacah: {}, total: 0, tahun_ajaran: [] };
};

/**
 * Memperbarui status atau catatan. Muatannya SEBAGIAN: field yang tidak dikirim
 * tidak tersentuh, jadi menyunting catatan tidak ikut mengubah status.
 *
 * PUT dan bukan PATCH karena corsMiddleware hanya mengizinkan GET/POST/PUT/DELETE.
 */
export const ubahPendaftaran = async (id, perubahan) => {
  const payload = {};
  if (perubahan.status !== undefined) payload.status = perubahan.status;
  if (perubahan.catatan !== undefined) payload.catatan = String(perubahan.catatan ?? '');
  return apiClient.put(`${BASE}/${id}`, payload);
};

export const hapusPendaftaran = async (id) => {
  await apiClient.delete(`${BASE}/${id}`);
};

/**
 * Mengimpor pendaftaran lama yang dulu menumpuk di Pesan Masuk.
 *
 * `simulasi: true` hanya melaporkan apa yang akan terjadi tanpa menyimpan. Pesan
 * aslinya tidak pernah dihapus, dan menjalankannya berulang tidak menggandakan
 * data — pendaftaran yang sudah ada dikenali dari nama dan tanggal lahir.
 */
export const imporPendaftaranLama = async ({ simulasi = false } = {}) => apiClient.post(
  `${BASE}/impor-pesan`,
  { simulasi },
);

/**
 * Memeriksa status pendaftaran dari halaman publik, tanpa login.
 *
 * Tanggal lahir wajib bersama nomornya: nomor pendaftaran berurutan dan mudah
 * diterka, jadi tanpa pasangan kedua siapa pun bisa menyisir nomor dan memanen
 * nama seluruh pendaftar.
 */
export const cekStatusPendaftaran = async ({ nomor, tanggalLahir }) => {
  const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:8080'}${BASE}/cek`;
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nomor_pendaftaran: nomor, tanggal_lahir: tanggalLahir }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Gagal memeriksa pendaftaran (${res.status}).`);
  return body.data || null;
};

/** Nomor induk berikutnya yang belum terpakai. Usulan, bukan jaminan. */
export const usulanNomorInduk = async (tahunAjaran) => {
  const data = await apiClient.get(`${BASE}/usulan-nomor?tahun=${encodeURIComponent(tahunAjaran || '')}`);
  return data?.nomor_induk || '';
};

/**
 * Mencatat pendaftaran yang sudah diterima sebagai murid.
 *
 * Server mengerjakan pembuatan akun, penempatan kelas, dan penautannya dalam satu
 * transaksi — jadi kegagalan di tengah tidak meninggalkan murid tanpa kelas yang
 * pendaftarannya masih tampak belum tercatat.
 */
export const jadikanMurid = async (id, { nomorInduk, classId, angkatan } = {}) => apiClient.post(
  `${BASE}/${id}/murid`,
  { nomor_induk: nomorInduk, class_id: classId || '', angkatan: angkatan || '' },
);

/* ─── Ekspor ke berkas ────────────────────────────────────────────────────────
 *
 * Tata usaha tetap perlu memindahkan data ke Dapodik dan mencetak daftar hadir
 * daftar ulang. Tanpa ekspor, satu-satunya jalan adalah menyalin ulang dua puluh
 * kolom per anak dengan tangan.
 */

const KOLOM_EKSPOR = [
  ['nomor_pendaftaran', 'Nomor pendaftaran'],
  ['nama_lengkap', 'Nama lengkap'],
  ['nisn', 'NISN'],
  ['nik', 'NIK'],
  ['tempat_lahir', 'Tempat lahir'],
  ['tanggal_lahir', 'Tanggal lahir'],
  ['jenis_kelamin', 'Jenis kelamin'],
  ['alamat', 'Alamat'],
  ['no_hp', 'No HP'],
  ['email', 'Email'],
  ['sekolah_asal', 'Sekolah asal'],
  ['npsn_asal', 'NPSN asal'],
  ['usia_keterangan', 'Usia'],
  ['jalur_label', 'Jalur'],
  ['wilayah', 'Wilayah domisili'],
  ['minat', 'Program pendukung'],
  ['nama_ayah', 'Nama ayah'],
  ['nama_ibu', 'Nama ibu'],
  ['pekerjaan_orang_tua', 'Pekerjaan orang tua'],
  ['no_hp_wali', 'No HP wali'],
  ['status', 'Status'],
  ['catatan', 'Catatan'],
];

/* Sel CSV yang diawali =, +, -, atau @ dibaca Excel sebagai FORMULA. Nama atau
 * catatan yang diawali tanda hubung cukup untuk memicunya, dan pada berkas yang
 * dibuka orang lain itu masalah keamanan, bukan sekadar tampilan. Awalan kutip
 * tunggal memaksa Excel membacanya sebagai teks. */
const amankanSel = (nilai) => {
  const teks = nilai === null || nilai === undefined ? '' : String(nilai);
  const aman = /^[=+\-@\t\r]/.test(teks) ? `'${teks}` : teks;
  return `"${aman.replace(/"/g, '""')}"`;
};

/** Menyusun isi CSV dari daftar pendaftaran. Dipisah supaya bisa diuji. */
export const susunCsvPendaftaran = (rows) => {
  const baris = [KOLOM_EKSPOR.map(([, judul]) => amankanSel(judul)).join(',')];
  (rows || []).forEach((row) => {
    baris.push(KOLOM_EKSPOR.map(([field]) => amankanSel(row?.[field])).join(','));
  });
  // BOM supaya Excel di Windows membaca huruf beraksen dengan benar.
  return `﻿${baris.join('\r\n')}`;
};

export const unduhCsvPendaftaran = (rows, namaBerkas = 'pendaftaran-ppdb.csv') => {
  const blob = new Blob([susunCsvPendaftaran(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = namaBerkas;
  a.click();
  URL.revokeObjectURL(url);
};
