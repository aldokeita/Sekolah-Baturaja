import { describe, expect, it } from 'vitest';

import { buildGlobalContentSaveItems } from '@/lib/contentManagementSave';

describe('buildGlobalContentSaveItems', () => {
  it('hanya mengirim key yang memang dikelola tombol global', () => {
    const dedicatedKeys = [
      'news',
      'announcements',
      'school_identity',
      'school_info',
      'logoUrl',
      'schoolBuildingPhoto',
      'home_content',
      'profile_content',
      'ppdb_content',
      'program_content',
      'ekskul_content',
      'prestasi_content',
    ];
    const parentManagedKeys = [
      'galleryPhotos',
      'galleryAlbums',
      'galleryHeroMosaic',
      'facilities',
      'brochures',
      'pustaka',
    ];
    const content = Object.fromEntries(
      [...dedicatedKeys, ...parentManagedKeys].map((key) => [key, {}]),
    );

    const items = buildGlobalContentSaveItems(content);

    expect(items.map((item) => item.key)).toEqual(parentManagedKeys);
    expect(items.every((item) => item.is_public === true)).toBe(true);
  });
});
