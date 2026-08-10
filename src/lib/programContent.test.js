import { describe, expect, it } from 'vitest';

import { DEFAULT_PROGRAM_CONTENT, normalizeProgramContent } from '@/lib/programContent';

describe('normalizeProgramContent', () => {
  it('menyediakan field header dan fallback foto tanpa menghilangkan blok lama', () => {
    const hasil = normalizeProgramContent({
      hero: {
        title: '  Program pilihan sekolah  ',
        photoUrl: ' https://cdn.example.test/program.webp ',
      },
      programs: [{ nama: 'Klub Sains', jenis: 'Kurikuler' }],
    });

    expect(hasil.hero).toEqual({
      title: 'Program pilihan sekolah',
      accent: DEFAULT_PROGRAM_CONTENT.hero.accent,
      description: DEFAULT_PROGRAM_CONTENT.hero.description,
      photo_url: 'https://cdn.example.test/program.webp',
    });
    expect(hasil.programs).toEqual([
      expect.objectContaining({ nama: 'Klub Sains', jenis: 'Kurikuler' }),
    ]);
    expect(hasil.jam).toEqual(DEFAULT_PROGRAM_CONTENT.jam);
    expect(hasil.ritme).toEqual(DEFAULT_PROGRAM_CONTENT.ritme);
  });

  it('menghormati daftar Program yang sengaja dikosongkan dan menerima nama foto lama', () => {
    const hasil = normalizeProgramContent({
      hero: { foto_url: 'https://cdn.example.test/legacy.webp' },
      programs: [],
      jam: [],
      ritme: [],
    });

    expect(hasil.hero.photo_url).toBe('https://cdn.example.test/legacy.webp');
    expect(hasil.programs).toEqual([]);
    expect(hasil.jam).toEqual([]);
    expect(hasil.ritme).toEqual([]);
  });
});
