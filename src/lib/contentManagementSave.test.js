import { describe, expect, it } from 'vitest';

import { buildGlobalContentSaveItems } from '@/lib/contentManagementSave';

describe('buildGlobalContentSaveItems', () => {
  it('tidak mengirim snapshot lama prestasi dari tombol simpan global', () => {
    const items = buildGlobalContentSaveItems({
      news: [],
      announcements: [],
      prestasi_content: { records: [{ judul: 'Snapshot lama' }] },
      galleryPhotos: [],
    });

    expect(items.map((item) => item.key)).toEqual(['galleryPhotos']);
  });
});
