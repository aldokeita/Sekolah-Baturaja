import { describe, expect, it } from 'vitest';

import { DEFAULT_PROGRAM_CONTENT, normalizeProgramContent } from '@/lib/programContent';

describe('normalizeProgramContent', () => {
  it('menyediakan field header dan fallback foto tanpa menghilangkan blok lama', () => {
    const hasil = normalizeProgramContent({
      hero: {
        title: '  Program pilihan sekolah  ',
      },
      programs: [{ nama: 'Klub Sains', jenis: 'Kurikuler', fotoUrl: ' https://cdn.example.test/program.webp ' }],
    });

    expect(hasil.hero).toEqual({
      title: 'Program pilihan sekolah',
      accent: DEFAULT_PROGRAM_CONTENT.hero.accent,
      description: DEFAULT_PROGRAM_CONTENT.hero.description,
    });
    expect(hasil.programs).toEqual([
      expect.objectContaining({ nama: 'Klub Sains', jenis: 'Kurikuler', foto_url: 'https://cdn.example.test/program.webp' }),
    ]);
    expect(hasil.jam).toEqual(DEFAULT_PROGRAM_CONTENT.jam);
    expect(hasil.ritme).toEqual(DEFAULT_PROGRAM_CONTENT.ritme);
  });

  it('menghormati daftar Program yang sengaja dikosongkan dan menerima nama foto lama', () => {
    const hasil = normalizeProgramContent({
      programs: [{ nama: 'Program Lama', image_url: 'https://cdn.example.test/legacy.webp' }],
      jam: [],
      ritme: [],
    });

    expect(hasil.programs[0].foto_url).toBe('https://cdn.example.test/legacy.webp');
    expect(normalizeProgramContent({ programs: [] }).programs).toEqual([]);
    expect(hasil.jam).toEqual([]);
    expect(hasil.ritme).toEqual([]);
  });
});
