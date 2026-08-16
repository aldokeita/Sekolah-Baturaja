import { describe, expect, it } from 'vitest';

import {
  AKSEN_SOLID,
  BRAND_FIELDS,
  DEFAULT_SCHOOL_IDENTITY,
  normalizeSchoolIdentity,
  pisahIdentitas,
  tahunAjaranAwal,
  turunkanPalet,
} from '@/lib/schoolIdentity';

const BAWAAN_AWAL = DEFAULT_SCHOOL_IDENTITY.accentColor;
const BAWAAN_AKHIR = DEFAULT_SCHOOL_IDENTITY.accentColor2;

/**
 * Yang diuji di sini adalah janji produk: sekolah memilih dua warna (atau satu
 * bila solid), dan seluruh palet halaman publik mengikutinya — TANPA memunculkan
 * warna ketiga yang tidak dipilih siapa pun.
 *
 * Uji pertama mengunci palet bawaan digit per digit. Kalau meleset, setiap
 * pemasangan baru berubah tampilannya tanpa ada yang memintanya. Satu nilai
 * memang sengaja berbeda dari desain aslinya: lihat catatannya di bawah.
 */
describe('turunkanPalet', () => {
  it('mengembalikan palet asli desain pada pilihan bawaan', () => {
    expect(turunkanPalet(BAWAAN_AWAL, BAWAAN_AKHIR)).toEqual({
      'aksen': '#6470ff',
      'aksen-pekat': '#5b6cff',
      'aksen-tengah': '#8a6cf0',
      'aksen-tengah-2': '#a06cf0',
      'aksen-ujung': '#e58fc4',
      /* Desain aslinya jingga (#f0a06c) — warna KETIGA, di luar dua warna yang
       * dipilih sekolah. Sekarang merah muda yang lebih dalam: rona yang sama
       * dengan `aksen-ujung`, hanya lebih pekat. Lihat `describe('dua warna
       * saja')` untuk alasan lengkapnya. */
      'aksen-hangat': '#f06cbd',
      'aksen-muda': '#a5b4fc',
      'aksen-samar': '#c7d2fe',
      'aksen-rgb': '100 112 255',
      /* Turunan khusus teks kecil: rona dan kejenuhan sama dengan `aksen-pekat`,
       * terangnya turun 5 poin sampai kontrasnya lolos WCAG AA di atas latar
       * terang. Nilai ini juga tertulis di :root src/index.css. */
      'aksen-teks': '#4255ff',
    });
  });

  /* Aksen apa pun yang dipilih sekolah harus tetap terbaca sebagai teks kecil.
   * Kuning adalah kasus terburuknya — ia harus turun jauh — dan itu memang
   * konsekuensi memilih warna terang, bukan tanda hitungannya salah. */
  describe('aksen-teks selalu lolos ambang keterbacaan', () => {
    const LATAR = [233, 237, 246];
    const luminansi = ([r, g, b]) => {
      const kanal = (v) => {
        const n = v / 255;
        return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
    };
    const keKanal = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const kontras = (hex) => {
      const la = luminansi(keKanal(hex));
      const lb = luminansi(LATAR);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    };

    it.each([
      ['biru bawaan', '#6470ff'],
      ['hijau', '#2f9e6b'],
      ['merah', '#e0455f'],
      ['kuning terang', '#f0b429'],
      ['abu terang', '#c8ccd8'],
      ['putih', '#ffffff'],
    ])('%s tetap mencapai 4.5:1', (_nama, warna) => {
      expect(kontras(turunkanPalet(warna, warna, 'solid')['aksen-teks'])).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('memakai kedua warna pilihan sebagai ujung gradasi', () => {
    const palet = turunkanPalet('#12a150', '#f59e0b');
    expect(palet.aksen).toBe('#12a150');
    expect(palet['aksen-ujung']).toBe('#f59e0b');
  });

  it('menerima bentuk singkat tiga digit', () => {
    expect(turunkanPalet('#66f', '#f9c')).toEqual(turunkanPalet('#6666ff', '#ff99cc'));
  });

  it('menggeser seluruh palet ketika warnanya diganti', () => {
    const hijau = turunkanPalet('#12a150', '#0ea5e9');
    const bawaan = turunkanPalet(BAWAAN_AWAL, BAWAAN_AKHIR);
    Object.entries(hijau).forEach(([nama, nilai]) => {
      if (nama === 'aksen-rgb') return;
      expect(nilai).not.toBe(bawaan[nama]);
    });
  });

  /* Rona berputar 0–360. Tanpa memilih arah terpendek, gradasi dari merah ke
   * ungu akan memutari seluruh roda warna dan melewati hijau serta biru — warna
   * yang tidak dipilih sekolah sama sekali. */
  it('mengambil jalur rona terpendek antara dua warna', () => {
    // Merah (H≈0) ke ungu (H≈280): jalur terpendek lewat magenta, bukan hijau.
    const palet = turunkanPalet('#ef4444', '#a855f7');
    expect(palet['aksen-tengah']).toMatch(/^#[0-9a-f]{6}$/);
    // Stop tengah tidak boleh menjadi hijau; pada RGB berarti G tidak dominan.
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(palet['aksen-tengah'].slice(i, i + 2), 16));
    expect(g).toBeLessThan(Math.max(r, b));
  });

  describe('mode solid', () => {
    it('memakai satu warna untuk seluruh sapuan', () => {
      const palet = turunkanPalet('#12a150', '#f59e0b', AKSEN_SOLID);
      expect(palet.aksen).toBe('#12a150');
      expect(palet['aksen-tengah']).toBe('#12a150');
      expect(palet['aksen-tengah-2']).toBe('#12a150');
      expect(palet['aksen-ujung']).toBe('#12a150');
      // Warna kedua yang diabaikan tidak boleh menyisakan jejak jingga sedikit pun.
      expect(palet['aksen-hangat']).not.toMatch(/^#f/);
    });

    it('tetap membedakan tint supaya perannya tidak hilang', () => {
      const palet = turunkanPalet('#12a150', undefined, AKSEN_SOLID);
      expect(palet['aksen-muda']).not.toBe(palet.aksen);
      expect(palet['aksen-samar']).not.toBe(palet['aksen-muda']);
    });

    it('mengabaikan warna kedua yang hilang tanpa melempar', () => {
      expect(() => turunkanPalet('#12a150')).not.toThrow();
      expect(turunkanPalet('#12a150')['aksen-ujung']).toBe('#12a150');
    });
  });

  /* Dua nilai tint dipakai sebagai LATAR LEMBUT — kartu guru di halaman Profil
   * dan mosaik fasilitas. Dulu keduanya dihitung dengan penambahan terang tetap
   * (+12,2), yang hanya memucat bila warna aksennya sudah terang; pada hijau tua
   * hasilnya hijau menyala di belakang teks gelap. */
  describe('tint', () => {
    const terang = (hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
    };

    it.each(['#12a150', '#7c2d12', '#1e1b4b', '#6470ff'])('memucat untuk aksen %s', (warna) => {
      const palet = turunkanPalet(warna, '#f59e0b');
      expect(terang(palet['aksen-muda'])).toBeGreaterThan(terang(palet.aksen));
      expect(terang(palet['aksen-samar'])).toBeGreaterThan(terang(palet['aksen-muda']));
      // Cukup pucat untuk dipakai sebagai latar: di atas separuh skala terang.
      expect(terang(palet['aksen-samar'])).toBeGreaterThan(0.55);
    });
  });

  /* Sekolah memilih DUA warna, jadi palet tidak boleh memunculkan warna ketiga.
   *
   * `aksen-hangat` dulu melanggar ini: ronanya melanjutkan arah sapuan melewati
   * warna akhir, sehingga gradasi hijau→jingga menghasilkan magenta di sembilan
   * titik dekoratif — warna yang tidak dipilih siapa pun. Sekarang ronanya sama
   * dengan warna akhir; yang berbeda hanya kedalamannya, supaya gradasi
   * `aksen-ujung → aksen-hangat` tidak tampak rata. */
  describe('dua warna saja', () => {
    const rona = (hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); const beda = mx - mn;
      if (beda === 0) return null;
      let h = mx === r ? ((g - b) / beda) % 6 : mx === g ? (b - r) / beda + 2 : (r - g) / beda + 4;
      h *= 60;
      return h < 0 ? h + 360 : h;
    };
    // Selisih rona terpendek pada roda 0–360.
    const jarakRona = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

    it.each([
      ['#6470ff', '#e58fc4'],
      ['#12a150', '#f59e0b'],
      ['#ef4444', '#a855f7'],
      ['#0ea5e9', '#14b8a6'],
    ])('menjaga rona aksen-hangat sama dengan warna akhir (%s → %s)', (awal, akhir) => {
      const palet = turunkanPalet(awal, akhir);
      // Toleransi 2° untuk pembulatan ke heks delapan-bit.
      expect(jarakRona(rona(palet['aksen-hangat']), rona(akhir))).toBeLessThanOrEqual(2);
    });

    it('menjaga warna hangat lebih dalam dari warna akhir supaya gradasinya tidak rata', () => {
      const terang = (hex) => {
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
        return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
      };
      const palet = turunkanPalet('#12a150', '#f59e0b');
      expect(palet['aksen-hangat']).not.toBe(palet['aksen-ujung']);
      expect(terang(palet['aksen-hangat'])).toBeLessThan(terang(palet['aksen-ujung']));
    });
  });

  it('menjaga bentuk keluaran tetap heks enam digit dan kanal rgb', () => {
    const palet = turunkanPalet('#e11d48', '#f59e0b');
    Object.entries(palet).forEach(([nama, nilai]) => {
      if (nama === 'aksen-rgb') {
        expect(nilai).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
        return;
      }
      expect(nilai).toMatch(/^#[0-9a-f]{6}$/);
    });
  });

  // Warna ekstrem menguji penjepitan: menambah rona pada abu-abu tidak boleh
  // menghasilkan kejenuhan negatif, dan warna nyaris putih tidak boleh melewati
  // terang 100%. Keduanya menghasilkan nilai CSS tidak sah bila lolos.
  it.each([
    ['kelabu', '#808080', '#909090'],
    ['nyaris putih', '#fefefe', '#ffffff'],
    ['hitam', '#000000', '#010101'],
  ])('tetap sah untuk warna %s', (_nama, awal, akhir) => {
    const palet = turunkanPalet(awal, akhir);
    Object.entries(palet).forEach(([nama, nilai]) => {
      if (nama !== 'aksen-rgb') expect(nilai).toMatch(/^#[0-9a-f]{6}$/);
    });
  });
});

/* Pemisahan izin: nama sekolah dan warna milik penjual, sisanya milik pembeli.
 * Kalau satu field bocor ke sisi yang salah, entah pembeli tidak bisa mengubah
 * data sekolahnya sendiri, atau ia bisa mengganti nama produk. */
describe('pisahIdentitas', () => {
  it('menaruh nama dan warna di bagian merek', () => {
    const { merek } = pisahIdentitas(DEFAULT_SCHOOL_IDENTITY);
    expect(Object.keys(merek).sort()).toEqual([...BRAND_FIELDS].sort());
  });

  it('menaruh kontak, visi, misi, dan tujuan di bagian info', () => {
    const { info } = pisahIdentitas(DEFAULT_SCHOOL_IDENTITY);
    ['phone', 'email', 'address', 'academicYear', 'vision', 'missions', 'goals'].forEach((field) => {
      expect(info).toHaveProperty(field);
    });
  });

  it('tidak menaruh satu field di kedua bagian', () => {
    const { merek, info } = pisahIdentitas(DEFAULT_SCHOOL_IDENTITY);
    Object.keys(merek).forEach((field) => expect(info).not.toHaveProperty(field));
  });

  it('mencakup seluruh field identitas tanpa ada yang hilang', () => {
    const { merek, info } = pisahIdentitas(DEFAULT_SCHOOL_IDENTITY);
    expect([...Object.keys(merek), ...Object.keys(info)].sort())
      .toEqual(Object.keys(DEFAULT_SCHOOL_IDENTITY).sort());
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
