import { describe, expect, it } from 'vitest';

import { DEFAULT_PRESTASI_CONTENT, normalizePrestasiContent } from '@/lib/prestasiContent';

describe('normalizePrestasiContent', () => {
  it('menambahkan URL foto perlombaan pada setiap catatan tanpa menghilangkan field lama', () => {
    const hasil = normalizePrestasiContent({
      records: [
        { judul: 'Lomba A', foto_url: ' https://cdn.example.test/a.webp ', cerita: 'Cerita A' },
        { judul: 'Lomba B', fotoUrl: 'https://cdn.example.test/b.webp' },
        { judul: 'Lomba C', image_url: 'https://cdn.example.test/c.webp' },
        { judul: 'Lomba D' },
      ],
    });

    expect(hasil.records.map((record) => record.foto_url)).toEqual([
      'https://cdn.example.test/a.webp',
      'https://cdn.example.test/b.webp',
      'https://cdn.example.test/c.webp',
      '',
    ]);
    expect(hasil.records[0]).toMatchObject({ judul: 'Lomba A', cerita: 'Cerita A' });
  });

  it('menyediakan fallback foto kosong pada bawaan dan daftar kosong tetap dihormati', () => {
    const bawaan = normalizePrestasiContent(undefined);
    expect(bawaan.records).toEqual(expect.arrayContaining([
      expect.objectContaining({ foto_url: '' }),
    ]));
    expect(normalizePrestasiContent({ records: [] }).records).toEqual([]);
  });
});
