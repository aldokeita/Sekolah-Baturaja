import { describe, expect, it } from 'vitest';

import { DEFAULT_EKSKUL_CONTENT, normalizeEkskulContent } from '@/lib/ekskulContent';

describe('normalizeEkskulContent', () => {
  it('mempertahankan teks header dan foto individual setiap kegiatan', () => {
    const hasil = normalizeEkskulContent({
      hero: {
        kicker: '  Setelah kelas  ',
        title: 'klub pilihan',
        suffix: 'untuk semua.',
        description: '  Deskripsi kegiatan sekolah.  ',
      },
      records: [
        { nama: 'Klub A', imageUrl: ' https://cdn.example.test/a.webp ' },
        { nama: 'Klub B', foto_url: 'https://cdn.example.test/b.webp' },
      ],
    });

    expect(hasil.hero).toMatchObject({
      kicker: 'Setelah kelas',
      title: 'klub pilihan',
      suffix: 'untuk semua.',
      description: 'Deskripsi kegiatan sekolah.',
    });
    expect(hasil.records.map((record) => record.foto_url)).toEqual([
      'https://cdn.example.test/a.webp',
      'https://cdn.example.test/b.webp',
    ]);
  });

  it('menggunakan fallback header dan menghormati daftar kegiatan yang dikosongkan', () => {
    const bawaan = normalizeEkskulContent(undefined);
    expect(bawaan.hero).toEqual(DEFAULT_EKSKUL_CONTENT.hero);
    expect(normalizeEkskulContent({ records: [] }).records).toEqual([]);
  });
});
