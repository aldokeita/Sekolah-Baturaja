import { describe, expect, it } from 'vitest';
import {
  HARI_OPTIONS,
  formatJam,
  formatJamRange,
  getHariLabel,
  getPeriodeLabel,
  getScheduleErrorMessage,
  groupJadwalByHari,
  isJamRangeValid,
  isValidTahunAjaran,
} from '@/lib/scheduleAdapters';

describe('format jadwal', () => {
  it('menormalkan waktu PostgreSQL menjadi HH:MM', () => {
    expect(formatJam('07:30:00')).toBe('07:30');
    expect(formatJam(' 09:05 ')).toBe('09:05');
  });

  it('menghasilkan rentang waktu yang mudah dibaca', () => {
    expect(formatJamRange('07:30:00', '08:40:00')).toBe('07:30–08:40');
  });

  it('menghasilkan rentang kosong tanpa melempar untuk nilai yang belum diisi', () => {
    expect(formatJamRange(null, undefined)).toBe('–');
  });
});

describe('validasi periode dan jam', () => {
  it('menerima tahun ajaran dengan format empat digit', () => {
    expect(isValidTahunAjaran('2026/2027')).toBe(true);
    expect(isValidTahunAjaran(' 2026/2027 ')).toBe(true);
  });

  it('menolak tahun ajaran yang tidak lengkap', () => {
    expect(isValidTahunAjaran('2026-2027')).toBe(false);
    expect(isValidTahunAjaran('')).toBe(false);
  });

  it('menerima slot dengan waktu selesai setelah waktu mulai', () => {
    expect(isJamRangeValid('07:30', '08:40')).toBe(true);
  });

  it('menolak slot kosong, sama panjang, atau terbalik', () => {
    expect(isJamRangeValid('', '08:40')).toBe(false);
    expect(isJamRangeValid('08:40', '08:40')).toBe(false);
    expect(isJamRangeValid('09:00', '08:40')).toBe(false);
  });
});

describe('label jadwal', () => {
  it('memetakan nomor hari dan memberi tanda untuk nomor yang tidak dikenal', () => {
    expect(getHariLabel(1)).toBe('Senin');
    expect(getHariLabel('6')).toBe('Sabtu');
    expect(getHariLabel(7)).toBe('-');
  });

  it('mengutamakan nama periode lalu memakai tahun dan semester', () => {
    expect(getPeriodeLabel({ nama: 'Semester Ganjil 2026/2027', tahun_ajaran: '2026/2027' }))
      .toBe('Semester Ganjil 2026/2027');
    expect(getPeriodeLabel({ tahun_ajaran: '2026/2027', semester: 'Ganjil' }))
      .toBe('2026/2027 Ganjil');
    expect(getPeriodeLabel(null)).toBe('');
  });
});

describe('groupJadwalByHari', () => {
  it('menyediakan semua hari dan mengabaikan hari Minggu atau nilai rusak', () => {
    const hasil = groupJadwalByHari([
      { id: 'minggu', hari: 7 },
      { id: 'rusak', hari: 'x' },
    ]);
    expect(Object.keys(hasil).map(Number)).toEqual(HARI_OPTIONS.map((hari) => hari.value));
    expect(Object.values(hasil).flat()).toEqual([]);
  });

  it('mengelompokkan dan mengurutkan jadwal berdasarkan waktu mulai', () => {
    const hasil = groupJadwalByHari([
      { id: 'siang', hari: 1, jam_mulai: '10:00:00' },
      { id: 'pagi', hari: 1, jam_mulai: '07:30:00' },
      { id: 'selasa', hari: 2, jam_mulai: '08:00:00' },
    ]);
    expect(hasil[1].map((row) => row.id)).toEqual(['pagi', 'siang']);
    expect(hasil[2].map((row) => row.id)).toEqual(['selasa']);
  });
});

describe('getScheduleErrorMessage', () => {
  it('meneruskan pesan backend yang siap tampil', () => {
    expect(getScheduleErrorMessage(new Error('Jadwal bertabrakan.'))).toBe('Jadwal bertabrakan.');
    expect(getScheduleErrorMessage({ error: 'Periode tidak ditemukan.' })).toBe('Periode tidak ditemukan.');
  });

  it('mengubah error jaringan menjadi arahan yang bisa ditindaklanjuti', () => {
    expect(getScheduleErrorMessage(new Error('Failed to fetch')))
      .toBe('Tidak dapat terhubung ke server. Periksa koneksi Anda lalu coba lagi.');
  });

  it('memiliki pesan aman untuk error kosong', () => {
    expect(getScheduleErrorMessage(null)).toBe('Operasi jadwal pelajaran gagal.');
  });
});
