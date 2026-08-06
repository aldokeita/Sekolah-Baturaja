import { describe, it, expect, beforeEach } from 'vitest';
import {
  TAHFIZH_METHODS,
  METHOD_OPTIONS,
  DEFAULT_TAHFIZH_CONFIG,
  getTahfizhConfig,
  applyTahfizhConfig,
  getTingkatLevels,
  getAdjacentTingkat,
} from '@/lib/tahfizhLevels';

// Modul ini menyimpan state di tingkat modul, jadi setiap test mengembalikannya
// ke bawaan lebih dulu supaya urutan test tidak saling mempengaruhi.
beforeEach(() => {
  applyTahfizhConfig(DEFAULT_TAHFIZH_CONFIG);
});

describe('registri metode', () => {
  it('menyediakan tujuh metode termasuk kustom', () => {
    expect(Object.keys(TAHFIZH_METHODS)).toEqual([
      'qiroati', 'iqro', 'ummi', 'wafa', 'tilawati', 'tahfizh', 'kustom',
    ]);
    expect(METHOD_OPTIONS).toHaveLength(7);
  });

  it('setiap metode selain kustom punya daftar tingkat yang terisi', () => {
    Object.entries(TAHFIZH_METHODS)
      .filter(([id]) => id !== 'kustom')
      .forEach(([id, metode]) => {
        expect(metode.levels.length, `metode ${id} kosong`).toBeGreaterThan(0);
      });
  });
});

describe('applyTahfizhConfig', () => {
  it('menolak metode yang tidak dikenal dan jatuh ke bawaan', () => {
    const hasil = applyTahfizhConfig({ method: 'metode-karangan', customLevels: [] });
    expect(hasil.method).toBe('qiroati');
  });

  it('bertahan terhadap masukan null tanpa melempar', () => {
    expect(() => applyTahfizhConfig(null)).not.toThrow();
    expect(getTahfizhConfig().method).toBe('qiroati');
  });

  it('membuang baris kosong dan memangkas spasi pada tingkat kustom', () => {
    const hasil = applyTahfizhConfig({
      method: 'kustom',
      customLevels: ['  Kelas 1  ', '', '   ', 'Kelas 2'],
    });
    expect(hasil.customLevels).toEqual(['Kelas 1', 'Kelas 2']);
  });
});

describe('getTingkatLevels', () => {
  it('memakai daftar bawaan metode saat tingkat kustom kosong', () => {
    applyTahfizhConfig({ method: 'iqro', customLevels: [] });
    expect(getTingkatLevels()).toEqual(TAHFIZH_METHODS.iqro.levels);
  });

  it('tingkat kustom menimpa daftar bawaan bila diisi', () => {
    applyTahfizhConfig({ method: 'iqro', customLevels: ['A', 'B'] });
    expect(getTingkatLevels()).toEqual(['A', 'B']);
  });

  it('metode kustom memakai daftar kustom apa adanya', () => {
    applyTahfizhConfig({ method: 'kustom', customLevels: ['Tahap 1'] });
    expect(getTingkatLevels()).toEqual(['Tahap 1']);
  });
});

describe('getAdjacentTingkat', () => {
  beforeEach(() => {
    applyTahfizhConfig({ method: 'iqro', customLevels: [] });
  });

  it('naik dan turun satu tingkat', () => {
    expect(getAdjacentTingkat('Iqro 2', 'up')).toBe('Iqro 3');
    expect(getAdjacentTingkat('Iqro 2', 'down')).toBe('Iqro 1');
  });

  it('mengembalikan null di kedua ujung, bukan melingkar', () => {
    const levels = TAHFIZH_METHODS.iqro.levels;
    expect(getAdjacentTingkat(levels[0], 'down')).toBeNull();
    expect(getAdjacentTingkat(levels[levels.length - 1], 'up')).toBeNull();
  });

  it('mengembalikan null untuk tingkat yang tidak ada dalam daftar', () => {
    expect(getAdjacentTingkat('Jilid 3A', 'up')).toBeNull();
  });
});
