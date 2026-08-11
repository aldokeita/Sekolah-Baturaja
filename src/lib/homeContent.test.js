import { describe, expect, it } from 'vitest';

import { DEFAULT_HOME_CONTENT, normalizeHomeContent } from '@/lib/homeContent';

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
