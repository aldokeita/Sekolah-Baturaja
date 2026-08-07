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

/** Daftar pendaftaran untuk panel. Penyaring yang kosong tidak dikirim. */
export const fetchPendaftaran = async ({ tahun, status, q } = {}) => {
  const params = new URLSearchParams();
  if (tahun) params.set('tahun', tahun);
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  const query = params.toString();
  const data = await apiClient.get(query ? `${BASE}?${query}` : BASE);
  return data || [];
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
