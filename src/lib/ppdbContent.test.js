import { describe, expect, it } from 'vitest';

import { DEFAULT_PPDB_CONTENT, isiPenanda, normalizePpdbContent } from '@/lib/ppdbContent';

/* Bawaan jalur harus mengikuti Permendikdasmen No. 3 Tahun 2025 (SPMB), yang
 * mencabut aturan PPDB 2021. Kalau bawaannya melenceng, pembeli yang tidak tahu
 * akan memasang jalur yang tidak sah — dan yang paling berbahaya adalah jalur
 * prestasi, yang tegas TIDAK diberlakukan untuk murid kelas satu SD. */
describe('bawaan jalur mengikuti aturan SPMB untuk SD', () => {
  const jalur = DEFAULT_PPDB_CONTENT.jalur;

  it('memuat tepat tiga jalur: domisili, afirmasi, mutasi', () => {
    expect(jalur.map((j) => j.id)).toEqual(['domisili', 'afirmasi', 'mutasi']);
  });

  it('tidak memuat jalur prestasi maupun zonasi', () => {
    const semua = JSON.stringify(jalur).toLowerCase();
    expect(semua).not.toContain('prestasi');
    expect(semua).not.toContain('zonasi');
  });

  it('memakai kuota yang ditetapkan untuk SD', () => {
    expect(jalur.find((j) => j.id === 'domisili').kuota).toBe(70);
    expect(jalur.find((j) => j.id === 'afirmasi').kuota).toBe(15);
    expect(jalur.find((j) => j.id === 'mutasi').kuota).toBe(5);
  });

  // Ketiganya berjumlah 90%, menyisakan ruang gerak; totalnya tidak boleh melebihi
  // 100% karena kursi yang dibagikan akan lebih banyak daripada yang ada.
  it('total kuota bawaan tidak melebihi seratus persen', () => {
    expect(jalur.reduce((t, j) => t + j.kuota, 0)).toBeLessThanOrEqual(100);
  });

  it('menyebut usia 7 tahun sebagai prioritas, bukan hanya batas 6 tahun', () => {
    const syarat = DEFAULT_PPDB_CONTENT.requirements.join(' ');
    expect(syarat).toMatch(/7 tahun/);
    expect(syarat).toMatch(/6 tahun/);
  });
});

describe('kuota jalur', () => {
  const kuotaDari = (nilai) => normalizePpdbContent({
    jalur: [{ id: 'x', name: 'Uji', kuota: nilai }],
  }).jalur[0].kuota;

  it('menerima angka maupun teks berisi angka', () => {
    expect(kuotaDari(40)).toBe(40);
    expect(kuotaDari('40')).toBe(40);
  });

  /* Kotak isian menerima teks apa saja, dan angka di luar rentang membuat hitungan
   * kursi di panel jadi tidak masuk akal — kursi minus, atau lebih banyak daripada
   * daya tampung. */
  it('menjepit ke rentang nol sampai seratus', () => {
    expect(kuotaDari(-20)).toBe(0);
    expect(kuotaDari(250)).toBe(100);
  });

  it('membulatkan angka pecahan', () => {
    expect(kuotaDari(33.6)).toBe(34);
  });

  // Kosong berarti "jalur ini tidak diberi kuota" — sah, karena sekolah boleh
  // menutup satu jalur tanpa menghapusnya dari daftar.
  it('menganggap kosong dan tidak sah sebagai nol', () => {
    [undefined, null, '', '   ', 'abc', NaN].forEach((nilai) => {
      expect(kuotaDari(nilai)).toBe(0);
    });
  });

  it('mengisi nol bila field kuotanya tidak ada sama sekali', () => {
    const hasil = normalizePpdbContent({ jalur: [{ id: 'x', name: 'Uji' }] });
    expect(hasil.jalur[0].kuota).toBe(0);
  });
});

/* Daftar wilayah punya aturan berbeda dari daftar lain: KOSONG itu pilihan yang
 * sah, bukan kesalahan. Sekolah yang tidak memakai daftar wilayah mengosongkannya,
 * dan kolom pilihannya lalu hilang dari formulir. Memulihkannya ke bawaan akan
 * memaksa wilayah sekolah CONTOH muncul di formulir sekolah pembeli. */
describe('daftar wilayah', () => {
  it('menghormati daftar yang sengaja dikosongkan', () => {
    expect(normalizePpdbContent({ wilayah: [] }).wilayah).toEqual([]);
  });

  // Bedakan dari kunci yang belum pernah disimpan — di situ bawaan yang benar.
  it('memakai bawaan bila kuncinya belum pernah ada', () => {
    expect(normalizePpdbContent({}).wilayah).toEqual(DEFAULT_PPDB_CONTENT.wilayah);
    expect(normalizePpdbContent({ wilayah: undefined }).wilayah).toEqual(DEFAULT_PPDB_CONTENT.wilayah);
  });

  it('membuang baris kosong dan merapikan spasi', () => {
    expect(normalizePpdbContent({ wilayah: ['  Kelurahan A  ', '', '   ', 'Kelurahan B'] }).wilayah)
      .toEqual(['Kelurahan A', 'Kelurahan B']);
  });

  it('memakai bawaan bila isinya bukan daftar', () => {
    ['teks', 42, { a: 1 }, null].forEach((nilai) => {
      expect(normalizePpdbContent({ wilayah: nilai }).wilayah).toEqual(DEFAULT_PPDB_CONTENT.wilayah);
    });
  });

  // Bawaannya wilayah sekolah contoh, dan pembeli WAJIB menggantinya — panel
  // memperingatkannya. Yang diuji di sini: bawaannya tidak kosong, supaya fiturnya
  // ketemu sendiri oleh pembeli alih-alih tersembunyi.
  it('mengirim contoh yang tidak kosong supaya fiturnya terlihat', () => {
    expect(DEFAULT_PPDB_CONTENT.wilayah.length).toBeGreaterThan(1);
  });
});

describe('normalizePpdbContent', () => {
  it('mengembalikan bawaan untuk masukan kosong atau bukan objek', () => {
    [null, undefined, 'teks', 7].forEach((masukan) => {
      expect(normalizePpdbContent(masukan)).toEqual(DEFAULT_PPDB_CONTENT);
    });
  });

  it('menerima isi sebagian tanpa menghapus blok lain', () => {
    const hasil = normalizePpdbContent({ waveLabel: 'Gelombang 2 · tutup 30 September' });
    expect(hasil.waveLabel).toBe('Gelombang 2 · tutup 30 September');
    expect(hasil.jalur).toEqual(DEFAULT_PPDB_CONTENT.jalur);
    expect(hasil.berkas).toEqual(DEFAULT_PPDB_CONTENT.berkas);
  });

  it('mengembalikan blok ke bawaan bila dikosongkan', () => {
    const hasil = normalizePpdbContent({ jalur: [], minat: [], berkas: [], timeline: [], requirements: [] });
    expect(hasil.jalur).toEqual(DEFAULT_PPDB_CONTENT.jalur);
    expect(hasil.timeline).toEqual(DEFAULT_PPDB_CONTENT.timeline);
  });

  /* Formulir menyimpan `id` jalur dan berkas ke draf di perangkat pengunjung,
   * jadi baris baru yang ditambah pembeli tidak boleh berakhir tanpa id — draf
   * lama akan cocok ke jalur yang salah, atau centang berkas tidak tersimpan. */
  describe('id baris baru', () => {
    it('dibuat dari namanya bila belum ada', () => {
      const hasil = normalizePpdbContent({
        jalur: [{ name: 'Anak Guru' }, { name: 'Inklusi & Disabilitas' }],
      });
      expect(hasil.jalur.map((j) => j.id)).toEqual(['anak-guru', 'inklusi-disabilitas']);
    });

    it('tidak pernah kosong walau namanya tanpa huruf', () => {
      const hasil = normalizePpdbContent({ berkas: [{ name: '???' }] });
      expect(hasil.berkas[0].id).toBe('item-1');
    });

    it('mempertahankan id yang sudah ada supaya draf lama tetap cocok', () => {
      const hasil = normalizePpdbContent({ jalur: [{ id: 'zonasi', name: 'Jalur Zonasi Baru' }] });
      expect(hasil.jalur[0].id).toBe('zonasi');
    });
  });

  it('membuang baris tanpa nama atau tanggal', () => {
    const hasil = normalizePpdbContent({
      jalur: [{ name: 'Zonasi' }, { name: '' }],
      timeline: [{ when: '1 Juli', what: 'Mulai' }, { when: '', what: 'tanpa tanggal' }],
    });
    expect(hasil.jalur).toHaveLength(1);
    expect(hasil.timeline).toHaveLength(1);
  });

  it('merapikan spasi tepi dan membuang baris kosong', () => {
    const hasil = normalizePpdbContent({ minat: ['  Pramuka  ', '  ', 'Futsal'] });
    expect(hasil.minat).toEqual(['Pramuka', 'Futsal']);
  });

  // Bawaan tidak boleh memuat program keagamaan: template ini untuk sekolah umum.
  it('bawaan program pendukung tidak memuat program keagamaan', () => {
    expect(DEFAULT_PPDB_CONTENT.minat.join(' ')).not.toMatch(/tahfiz|qur/i);
  });
});

describe('isiPenanda', () => {
  it('mengganti {tahun} dengan tahun yang diberikan', () => {
    expect(isiPenanda('minimal 6 tahun pada 1 Juli {tahun}', '2026'))
      .toBe('minimal 6 tahun pada 1 Juli 2026');
  });

  it('mengganti semua kemunculan', () => {
    expect(isiPenanda('{tahun} sampai {tahun}', '2030')).toBe('2030 sampai 2030');
  });

  it('tidak melempar untuk teks atau tahun yang kosong', () => {
    expect(isiPenanda(null, '2026')).toBe('');
    expect(isiPenanda('pada 1 Juli {tahun}', '')).toBe('pada 1 Juli ');
    expect(isiPenanda('tanpa penanda', '2026')).toBe('tanpa penanda');
  });
});
