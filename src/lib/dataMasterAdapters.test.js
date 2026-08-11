import { describe, it, expect } from 'vitest';
import {
  normalizeDefaultSppAmount,
  normalizeNomorIndukQiroati,
  pickSantriProfileFields,
  validateDefaultSppAmount,
} from '@/lib/dataMasterAdapters';

// normalizeDefaultSppAmount SUDAH benar bahkan sebelum perbaikan: Number(undefined)
// = NaN dan Number.isFinite(NaN) = false, jadi undefined pun berakhir null. Test di
// sini mengunci perilaku itu agar tidak ada yang "menyederhanakannya" jadi rusak.
//
// Bug "Default SPP minimal Rp10.000" yang sesungguhnya ada di penjagaan form,
// bukan di fungsi ini — lihat blok validateDefaultSppAmount di bawah.
describe('normalizeDefaultSppAmount', () => {
  it('mengembalikan null untuk undefined — inilah yang dulu jadi NaN', () => {
    expect(normalizeDefaultSppAmount(undefined)).toBeNull();
  });

  it('mengembalikan null untuk string kosong dan null', () => {
    expect(normalizeDefaultSppAmount('')).toBeNull();
    expect(normalizeDefaultSppAmount(null)).toBeNull();
  });

  it('mengembalikan null untuk nilai yang bukan angka, bukan NaN', () => {
    expect(normalizeDefaultSppAmount('abc')).toBeNull();
    expect(normalizeDefaultSppAmount({})).toBeNull();
  });

  it('meneruskan angka yang sah, termasuk bentuk string', () => {
    expect(normalizeDefaultSppAmount(15000)).toBe(15000);
    expect(normalizeDefaultSppAmount('15000')).toBe(15000);
    expect(normalizeDefaultSppAmount(0)).toBe(0);
  });
});

describe('normalizeNomorIndukQiroati', () => {
  it('memangkas spasi dan mengubah nilai kosong jadi string kosong', () => {
    expect(normalizeNomorIndukQiroati('  2026041  ')).toBe('2026041');
    expect(normalizeNomorIndukQiroati(null)).toBe('');
    expect(normalizeNomorIndukQiroati(undefined)).toBe('');
  });
});

describe('pickSantriProfileFields', () => {
  it('memangkas NISN/NIS/Angkatan dan menjadikan yang kosong sebagai null', () => {
    const hasil = pickSantriProfileFields({
      nama_lengkap: 'Naila',
      nisn: '  1234567890  ',
      nis: '',
      angkatan: ' 2026/2027 ',
    });

    expect(hasil.nisn).toBe('1234567890');
    expect(hasil.nis).toBeNull();
    expect(hasil.angkatan).toBe('2026/2027');
  });

  it('menormalkan default_spp_amount yang tidak diisi sama sekali', () => {
    // Persis kondisi resetForm: kunci default_spp_amount tidak ada.
    const hasil = pickSantriProfileFields({ nama_lengkap: 'Naila' });
    expect(hasil.default_spp_amount).toBeNull();
  });

  it('memakai Anak sebagai kategori bawaan dan Aktif sebagai status bawaan', () => {
    const hasil = pickSantriProfileFields({ nama_lengkap: 'Naila' });
    expect(hasil.kategori).toBe('Anak');
    expect(hasil.status).toBe('Aktif');
  });

  it('menerima id_kelas sebagai sinonim current_class_id', () => {
    expect(pickSantriProfileFields({ id_kelas: 'k-1' }).current_class_id).toBe('k-1');
    expect(pickSantriProfileFields({ current_class_id: 'k-2', id_kelas: 'k-9' }).current_class_id).toBe('k-2');
  });
});


describe('validateDefaultSppAmount', () => {
  // INI bug yang sesungguhnya. resetForm tidak menyertakan default_spp_amount,
  // jadi nilainya undefined. Penjagaan lama hanya melewati '' dan null, sehingga
  // undefined lolos ke Number(undefined) = NaN, lalu !Number.isFinite(NaN) = true
  // memunculkan galat "minimal Rp10.000" pada field yang jelas-jelas kosong.
  // Pengguna tidak punya cara apa pun untuk melewatinya.
  it('menganggap undefined sebagai kosong, bukan tidak sah', () => {
    expect(validateDefaultSppAmount(undefined)).toEqual({ ok: true, amount: null });
  });

  it('menganggap null, string kosong, dan spasi sebagai kosong', () => {
    expect(validateDefaultSppAmount(null)).toEqual({ ok: true, amount: null });
    expect(validateDefaultSppAmount('')).toEqual({ ok: true, amount: null });
    expect(validateDefaultSppAmount('   ')).toEqual({ ok: true, amount: null });
  });

  it('menolak nominal di bawah Rp10.000', () => {
    expect(validateDefaultSppAmount(9999).ok).toBe(false);
    expect(validateDefaultSppAmount('5000').ok).toBe(false);
  });

  it('menolak nilai yang bukan angka', () => {
    expect(validateDefaultSppAmount('abc').ok).toBe(false);
  });

  it('menerima nominal yang sah dan mengubahnya jadi angka', () => {
    expect(validateDefaultSppAmount('70000')).toEqual({ ok: true, amount: 70000 });
    expect(validateDefaultSppAmount(10000)).toEqual({ ok: true, amount: 10000 });
  });
});