import { describe, expect, it } from 'vitest';

import { DEFAULT_SCHOOL_IDENTITY, normalizeSchoolIdentity, tahunAjaranAwal, turunkanPalet } from '@/lib/schoolIdentity';

/**
 * Yang diuji di sini adalah janji produk: pembeli memilih satu warna, dan
 * seluruh palet halaman publik mengikutinya.
 *
 * Uji terpenting adalah yang pertama — pada aksen bawaan, palet turunan harus
 * kembali PERSIS ke warna asli desain. Kalau meleset satu digit pun, setiap
 * pemasangan baru berubah tampilannya tanpa ada yang memintanya.
 */
describe('turunkanPalet', () => {
  it('mengembalikan palet asli desain pada aksen bawaan', () => {
    expect(turunkanPalet('#6470ff')).toEqual({
      'aksen': '#6470ff',
      'aksen-pekat': '#5b6cff',
      'aksen-tengah': '#8a6cf0',
      'aksen-tengah-2': '#a06cf0',
      'aksen-ujung': '#e58fc4',
      'aksen-hangat': '#f0a06c',
      'aksen-muda': '#a5b4fc',
      'aksen-samar': '#c7d2fe',
      'aksen-rgb': '100 112 255',
    });
  });

  it('menerima bentuk singkat tiga digit', () => {
    expect(turunkanPalet('#66f')).toEqual(turunkanPalet('#6666ff'));
  });

  it('menggeser seluruh palet ketika aksen diganti', () => {
    const hijau = turunkanPalet('#12a150');
    expect(hijau.aksen).toBe('#12a150');
    // Tidak ada satu pun warna turunan yang tertinggal di rona lama.
    Object.entries(hijau).forEach(([nama, nilai]) => {
      if (nama === 'aksen-rgb') return;
      expect(nilai).not.toBe(turunkanPalet('#6470ff')[nama]);
    });
  });

  it('menjaga bentuk keluaran tetap heks enam digit dan kanal rgb', () => {
    const palet = turunkanPalet('#e11d48');
    Object.entries(palet).forEach(([nama, nilai]) => {
      if (nama === 'aksen-rgb') {
        expect(nilai).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
        return;
      }
      expect(nilai).toMatch(/^#[0-9a-f]{6}$/);
    });
  });

  // Aksen ekstrem menguji penjepitan: menambah rona pada abu-abu tidak boleh
  // menghasilkan kejenuhan negatif, dan warna nyaris putih tidak boleh melewati
  // terang 100%. Keduanya menghasilkan nilai CSS tidak sah bila lolos.
  it('tetap sah untuk aksen kelabu', () => {
    const palet = turunkanPalet('#808080');
    Object.entries(palet).forEach(([nama, nilai]) => {
      if (nama !== 'aksen-rgb') expect(nilai).toMatch(/^#[0-9a-f]{6}$/);
    });
  });

  it('tetap sah untuk aksen nyaris putih', () => {
    const palet = turunkanPalet('#fefefe');
    Object.entries(palet).forEach(([nama, nilai]) => {
      if (nama !== 'aksen-rgb') expect(nilai).toMatch(/^#[0-9a-f]{6}$/);
    });
  });

  it('tetap sah untuk aksen hitam', () => {
    expect(turunkanPalet('#000000').aksen).toBe('#000000');
    expect(turunkanPalet('#000000')['aksen-samar']).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('tahunAjaranAwal', () => {
  it('mengambil tahun pembuka dari berbagai bentuk penulisan', () => {
    expect(tahunAjaranAwal('2026/2027')).toBe('2026');
    expect(tahunAjaranAwal('2026-2027')).toBe('2026');
    expect(tahunAjaranAwal('2026 / 2027')).toBe('2026');
    expect(tahunAjaranAwal('TA 2030/2031')).toBe('2030');
    expect(tahunAjaranAwal('2026')).toBe('2026');
  });

  // Label seperti "PPDB 2026" dibentuk dari nilai ini. Mengembalikan string kosong
  // membuat labelnya jatuh ke "PPDB" saja, bukan "PPDB undefined".
  it('mengembalikan string kosong bila tidak ada tahun', () => {
    expect(tahunAjaranAwal('')).toBe('');
    expect(tahunAjaranAwal(null)).toBe('');
    expect(tahunAjaranAwal(undefined)).toBe('');
    expect(tahunAjaranAwal('tahun ini')).toBe('');
  });
});

describe('normalizeSchoolIdentity', () => {
  it('mengisi field yang tidak dikirim dengan bawaan', () => {
    const hasil = normalizeSchoolIdentity({ name: 'SD Contoh' });
    expect(hasil.name).toBe('SD Contoh');
    expect(hasil.email).toBe(DEFAULT_SCHOOL_IDENTITY.email);
    expect(hasil.missions).toEqual(DEFAULT_SCHOOL_IDENTITY.missions);
  });

  it('menerima visi, misi, dan tujuan sebagai teks multi-baris dari panel admin', () => {
    const hasil = normalizeSchoolIdentity({
      missions: 'Satu\n\n  Dua  \nTiga',
      goals: 'Target A\nTarget B',
    });
    // Baris kosong dibuang dan spasi tepi dirapikan.
    expect(hasil.missions).toEqual(['Satu', 'Dua', 'Tiga']);
    expect(hasil.goals).toEqual(['Target A', 'Target B']);
  });

  it('tidak membiarkan daftar kosong menghapus bawaan', () => {
    // Kalau pembeli mengosongkan kotak misi, halaman Profil akan bolong. Lebih
    // baik jatuh ke bawaan daripada menampilkan bagian tanpa isi.
    expect(normalizeSchoolIdentity({ missions: '   \n  ' }).missions)
      .toEqual(DEFAULT_SCHOOL_IDENTITY.missions);
    expect(normalizeSchoolIdentity({ goals: [] }).goals)
      .toEqual(DEFAULT_SCHOOL_IDENTITY.goals);
  });

  it('menghormati field yang memang boleh kosong', () => {
    const hasil = normalizeSchoolIdentity({ whatsapp: '', mapUrl: '' });
    expect(hasil.whatsapp).toBe('');
    expect(hasil.mapUrl).toBe('');
  });

  it('mengabaikan field yang tidak dikenal', () => {
    const hasil = normalizeSchoolIdentity({ namaAneh: 'buang saya' });
    expect(hasil.namaAneh).toBeUndefined();
  });

  it('menerima masukan bukan objek tanpa melempar', () => {
    expect(normalizeSchoolIdentity(null)).toEqual(DEFAULT_SCHOOL_IDENTITY);
    expect(normalizeSchoolIdentity('bukan objek')).toEqual(DEFAULT_SCHOOL_IDENTITY);
  });
});
