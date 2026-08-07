import { describe, expect, it } from 'vitest';

import { DEFAULT_PPDB_CONTENT, isiPenanda, normalizePpdbContent } from '@/lib/ppdbContent';

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
