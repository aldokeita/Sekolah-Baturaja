import { describe, expect, it } from 'vitest';

import { URUTAN_STATUS, labelStatus, susunCsvPendaftaran } from '@/lib/ppdbAdapters';

/* Ekspor CSV adalah satu-satunya jalan keluar data pendaftaran: tata usaha
 * memakainya untuk memindahkan calon murid ke Dapodik dan mencetak daftar hadir
 * daftar ulang. Kalau bentuknya salah, alternatifnya menyalin dua puluh kolom per
 * anak dengan tangan. */
describe('susunCsvPendaftaran', () => {
  const baris = (csv) => csv.replace(/^﻿/, '').split('\r\n');

  it('menulis judul kolom walau tidak ada pendaftaran', () => {
    const isi = baris(susunCsvPendaftaran([]));
    expect(isi).toHaveLength(1);
    expect(isi[0]).toContain('"Nomor pendaftaran"');
    expect(isi[0]).toContain('"Nama lengkap"');
  });

  it('menerima daftar kosong maupun tidak sah tanpa melempar', () => {
    expect(() => susunCsvPendaftaran(null)).not.toThrow();
    expect(() => susunCsvPendaftaran(undefined)).not.toThrow();
  });

  it('menulis satu baris per pendaftaran mengikuti urutan kolom judul', () => {
    const isi = baris(susunCsvPendaftaran([
      { nomor_pendaftaran: 'PPDB-2026-0001', nama_lengkap: 'Naila Rahmadani', status: 'baru' },
      { nomor_pendaftaran: 'PPDB-2026-0002', nama_lengkap: 'Budi Santoso', status: 'diterima' },
    ]));
    expect(isi).toHaveLength(3);
    expect(isi[1]).toContain('"PPDB-2026-0001"');
    expect(isi[1]).toContain('"Naila Rahmadani"');
    expect(isi[2]).toContain('"Budi Santoso"');
  });

  it('mengubah field yang kosong menjadi sel kosong, bukan "null"', () => {
    const isi = baris(susunCsvPendaftaran([{ nama_lengkap: 'Tanpa NISN', nisn: null, nik: undefined }]));
    expect(isi[1]).not.toContain('null');
    expect(isi[1]).not.toContain('undefined');
  });

  /* Tanda kutip di dalam sel harus digandakan, kalau tidak seluruh kolom
   * setelahnya bergeser saat dibuka di Excel. */
  it('menggandakan tanda kutip di dalam isi sel', () => {
    const isi = baris(susunCsvPendaftaran([{ nama_lengkap: 'Nama "Panggilan" Anak' }]));
    expect(isi[1]).toContain('"Nama ""Panggilan"" Anak"');
  });

  it('menjaga baris baru pada catatan tetap di dalam satu sel', () => {
    // Sel berkutip boleh memuat baris baru; jumlah barisnya tidak boleh bertambah
    // saat dipisah dengan CRLF.
    const csv = susunCsvPendaftaran([{ nama_lengkap: 'Anak', catatan: 'Baris satu\nBaris dua' }]);
    expect(baris(csv)).toHaveLength(2);
  });

  /* Sel yang diawali =, +, -, atau @ dibaca Excel sebagai FORMULA. Catatan yang
   * diawali tanda hubung cukup untuk memicunya, dan pada berkas yang dibuka orang
   * lain itu masalah keamanan — bukan sekadar tampilan. */
  describe('suntikan formula Excel', () => {
    it.each([
      ['=', '=1+1'],
      ['+', '+62812345678'],
      ['-', '-lihat catatan'],
      ['@', '@nama'],
    ])('melumpuhkan sel yang diawali %s', (_tanda, nilai) => {
      const isi = baris(susunCsvPendaftaran([{ nama_lengkap: nilai }]));
      expect(isi[1]).toContain(`"'${nilai}"`);
    });

    it('tidak menyentuh isi biasa', () => {
      const isi = baris(susunCsvPendaftaran([{ nama_lengkap: 'Naila' }]));
      expect(isi[1]).toContain('"Naila"');
      expect(isi[1]).not.toContain("\"'Naila\"");
    });
  });

  // Tanpa BOM, Excel di Windows membaca huruf beraksen sebagai karakter rusak.
  it('menyertakan BOM di awal berkas', () => {
    expect(susunCsvPendaftaran([])).toMatch(/^﻿/);
  });
});

describe('labelStatus', () => {
  it('memberi label berbahasa Indonesia untuk tiap status', () => {
    expect(labelStatus('baru')).toBe('Baru masuk');
    expect(labelStatus('diverifikasi')).toBe('Sudah diperiksa');
    expect(labelStatus('diterima')).toBe('Diterima');
    expect(labelStatus('ditolak')).toBe('Tidak diterima');
  });

  // Status tak dikenal dari data lama tidak boleh membuat panel menampilkan
  // "undefined" di tempat lencana.
  it('mengembalikan tanda pisah bila status tidak ada', () => {
    expect(labelStatus('')).toBe('—');
    expect(labelStatus(null)).toBe('—');
    expect(labelStatus('entah')).toBe('entah');
  });

  it('memberi label untuk setiap status pada URUTAN_STATUS', () => {
    URUTAN_STATUS.forEach((s) => expect(labelStatus(s)).not.toBe(s));
  });
});
