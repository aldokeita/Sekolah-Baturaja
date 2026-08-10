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
        { nama: 'Klub A', imageUrl: ' https://cdn.example.test/a.webp ', santri_ids: ['student-1', 'student-1', 'student-2'], pembina_id: 'teacher-1', pembina: 'Guru Lama' },
        { nama: 'Klub B', foto_url: 'https://cdn.example.test/b.webp', santriIds: ['student-3'] },
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
    expect(hasil.records[0]).toMatchObject({ santri_ids: ['student-1', 'student-2'], terisi: 2, pembina_id: 'teacher-1', participant_source: 'master' });
    expect(hasil.records[1]).toMatchObject({ santri_ids: ['student-3'], terisi: 1, participant_source: 'master' });
  });

  it('menggunakan fallback header dan menghormati daftar kegiatan yang dikosongkan', () => {
    const bawaan = normalizeEkskulContent(undefined);
    expect(bawaan.hero).toEqual(DEFAULT_EKSKUL_CONTENT.hero);
    expect(bawaan.records[0]).toMatchObject({ santri_ids: [], terisi: 0, participant_source: 'master' });
    expect(normalizeEkskulContent({ records: [] }).records).toEqual([]);
  });

  it('mempertahankan jumlah lama sampai kegiatan ditautkan ke daftar master', () => {
    const hasil = normalizeEkskulContent({ records: [{ nama: 'Data Lama', terisi: 7, kuota: 10, pembina: 'Guru Lama' }] });
    expect(hasil.records[0]).toMatchObject({ terisi: 7, participant_source: 'legacy', santri_ids: [] });
  });
});
