// Adapter notifikasi WhatsApp untuk admin. Semua panggilan ke /api/wa
// melewati apiClient sesuai konvensi repositori — komponen tidak boleh
// memanggil fetch langsung.
//
// Endpoint yang dilayani backend (handler/wanotify.go):
//   GET  /api/wa                 — daftar outbox (?status=&search=&page=&limit=)
//   POST /api/wa/:id/retry       — jadwalkan ulang pesan gagal
//   POST /api/wa/test            — kirim pesan uji ke satu nomor
//   POST /api/wa/broadcast       — antre pesan ke banyak nomor sekaligus

import apiClient from './apiClient';

/**
 * Ambil daftar pesan outbox terbaru. Respons berupa array biasa; panel
 * menentukan "masih ada lagi" dari panjang halaman yang kembali.
 */
export const fetchWaOutbox = async ({ page = 0, pageSize = 15, status = '', search = '' } = {}) => {
  const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  return apiClient.get(`/api/wa?${params.toString()}`);
};

/** Jadwalkan ulang pesan gagal — attempts di-nol-kan di sisi backend. */
export const retryWaMessage = (id) => apiClient.post(`/api/wa/${id}/retry`);

/** Kirim pesan uji ke satu nomor (mis. nomor admin sendiri). */
export const sendWaTest = (target, message) =>
  apiClient.post('/api/wa/test', { target, message });

/**
 * Antre pesan broadcast. recipients: [{ nama, no_hp }] — nama hanya untuk
 * jejak/log, pengiriman memakai no_hp yang sudah dinormalisasi backend.
 */
export const sendWaBroadcast = (recipients, message) =>
  apiClient.post('/api/wa/broadcast', { recipients, message });
