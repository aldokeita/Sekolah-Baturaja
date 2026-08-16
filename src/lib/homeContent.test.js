import { describe, expect, it } from 'vitest';

import { DEFAULT_HOME_CONTENT, normalizeHomeContent } from '@/lib/homeContent';

/* Badge dan statistik punya aturan berbeda dari blok lain: KOSONG itu pilihan yang
 * sah, bukan kesalahan. Sekolah yang belum terakreditasi mengosongkan badge-nya, dan
 * memulihkannya ke bawaan akan memasang akreditasi sekolah CONTOH di halaman
 * sekolah pembeli. */
describe('klaim sekolah di halaman depan', () => {
  it('menghormati badge yang sengaja dikosongkan', () => {
    expect(normalizeHomeContent({ badge: '' }).badge).toBe('');
    expect(normalizeHomeContent({ badge: '   ' }).badge).toBe('');
  });

  // Bedakan dari kunci yang belum pernah disimpan — di situ bawaan yang benar.
  it('memakai bawaan bila kuncinya belum pernah ada', () => {
    expect(normalizeHomeContent({}).badge).toBe(DEFAULT_HOME_CONTENT.badge);
    expect(normalizeHomeContent({ badge: undefined }).badge).toBe(DEFAULT_HOME_CONTENT.badge);
    expect(normalizeHomeContent({}).stats).toEqual(DEFAULT_HOME_CONTENT.stats);
  });

  it('menghormati daftar statistik yang sengaja dikosongkan', () => {
    expect(normalizeHomeContent({ stats: [] }).stats).toEqual([]);
  });

  it('membuang statistik tanpa angka atau tanpa keterangan', () => {
    const hasil = normalizeHomeContent({
      stats: [
        { value: '98', suffix: '%', label: 'Lulusan diterima' },
        { value: '', label: 'Tanpa angka' },
        { value: '7', label: '' },
      ],
    });
    expect(hasil.stats).toEqual([{ value: '98', suffix: '%', label: 'Lulusan diterima' }]);
  });

  // Baris statistik di halaman depan memuat dua kartu dari sistem (murid dan guru);
  // lebih dari dua kartu tambahan membuat barisnya melimpah.
  it('membatasi statistik tambahan pada dua kartu', () => {
    const hasil = normalizeHomeContent({
      stats: [1, 2, 3, 4].map((n) => ({ value: String(n), label: `Klaim ${n}` })),
    });
    expect(hasil.stats).toHaveLength(2);
  });
});

describe('normalizeHomeContent testimonial avatars', () => {
  it('mempertahankan URL avatar setiap testimoni secara individual', () => {
    const result = normalizeHomeContent({
      testimonials: [
        { quote: 'Kutipan pertama', name: 'Murid A', role: 'Murid', avatar_url: 'http://localhost:8080/files/website-assets/homepage/testimonials/testimonial-1.webp' },
        { quote: 'Kutipan kedua', name: 'Murid B', role: 'Alumni', avatarUrl: 'http://localhost:8080/files/website-assets/homepage/testimonials/testimonial-2.webp' },
      ],
    });

    expect(result.testimonials).toEqual([
      {
        id: 'testimonial-1',
        quote: 'Kutipan pertama',
        name: 'Murid A',
        role: 'Murid',
        avatar_url: 'http://localhost:8080/files/website-assets/homepage/testimonials/testimonial-1.webp',
      },
      {
        id: 'testimonial-2',
        quote: 'Kutipan kedua',
        name: 'Murid B',
        role: 'Alumni',
        avatar_url: 'http://localhost:8080/files/website-assets/homepage/testimonials/testimonial-2.webp',
      },
    ]);
  });

  it('menggunakan fallback kosong ketika testimoni belum memiliki foto', () => {
    const result = normalizeHomeContent({
      testimonials: [{ quote: 'Tanpa foto', name: 'Murid', role: 'Murid kelas VI' }],
    });

    expect(result.testimonials[0].id).toBe('testimonial-1');
    expect(result.testimonials[0].avatar_url).toBe('');
    expect(DEFAULT_HOME_CONTENT.testimonials.every((item) => item.avatar_url === '')).toBe(true);
  });
});
