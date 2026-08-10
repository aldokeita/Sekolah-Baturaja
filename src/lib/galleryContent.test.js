import { describe, expect, it } from 'vitest';
import {
  deriveGalleryAlbums,
  DEFAULT_GALLERY_HERO_MOSAIC,
  getGalleryHeroAspectRatio,
  normalizeGalleryHeroMosaic,
  selectGalleryHeroPhotos,
  normalizeGalleryAlbums,
  normalizeGalleryPhotos,
  resolveGalleryAlbumPhotos,
  resolveGalleryHeroPhotos,
} from './galleryContent';

describe('gallery content model', () => {
  it('normalizes photo IDs and keeps the existing media fields', () => {
    const photos = normalizeGalleryPhotos([
      { id: 12, caption: 'Pentas', image_url: '/pentas.jpg', kategori: 'Acara' },
      { name: 'Kelas pagi' },
    ]);

    expect(photos).toEqual([
      expect.objectContaining({ id: '12', caption: 'Pentas', url: '/pentas.jpg' }),
      expect.objectContaining({ id: 'gallery-2', caption: 'Kelas pagi', url: '' }),
    ]);
  });

  it('normalizes album selections and removes duplicate IDs', () => {
    const albums = normalizeGalleryAlbums([{ id: 8, name: 'Acara', photoIds: [1, '1', 2] }]);

    expect(albums[0]).toEqual(expect.objectContaining({
      id: '8',
      title: 'Acara',
      photo_ids: ['1', '2'],
    }));
  });

  it('resolves an album only to photos that still exist', () => {
    const photos = normalizeGalleryPhotos([{ id: 'a', caption: 'A' }, { id: 'b', caption: 'B' }]);
    const selected = resolveGalleryAlbumPhotos({ photo_ids: ['b', 'missing', 'a'] }, photos);

    expect(selected.map((photo) => photo.id)).toEqual(['b', 'a']);
  });

  it('derives fallback albums from actual gallery categories', () => {
    const albums = deriveGalleryAlbums([
      { id: 'a', caption: 'A', kategori: 'Belajar' },
      { id: 'b', caption: 'B', kategori: 'Belajar' },
      { id: 'c', caption: 'C', kategori: 'Prestasi' },
    ]);

    expect(albums).toEqual([
      expect.objectContaining({ title: 'Belajar', photo_ids: ['a', 'b'] }),
      expect.objectContaining({ title: 'Prestasi', photo_ids: ['c'] }),
    ]);
  });

  it('keeps a bounded pool of valid photos and prioritizes WebP', () => {
    const photos = selectGalleryHeroPhotos([
      { id: 'jpg-1', url: '/gallery/one.jpg' },
      { id: 'invalid', url: 'javascript:alert(1)' },
      { id: 'webp-1', url: '/gallery/one.webp' },
      ...Array.from({ length: 10 }, (_, index) => ({
        id: `jpg-${index + 2}`,
        url: `/gallery/${index + 2}.jpg`,
      })),
    ]);

    expect(photos).toHaveLength(10);
    expect(photos[0]).toEqual(expect.objectContaining({ id: 'webp-1' }));
    expect(photos.some((photo) => photo.id === 'invalid')).toBe(false);
  });

  it('derives responsive tile ratios from natural image dimensions', () => {
    expect(getGalleryHeroAspectRatio({ naturalWidth: 1600, naturalHeight: 800 })).toBe(1.75);
    expect(getGalleryHeroAspectRatio({ naturalWidth: 800, naturalHeight: 1600 }, 1.2)).toBe(0.62);
    expect(getGalleryHeroAspectRatio({ naturalWidth: 1200, naturalHeight: 800 }, 1.2)).toBe(1.25);
  });

  it('normalizes mosaic settings without breaking the default behaviour', () => {
    expect(normalizeGalleryHeroMosaic(null)).toEqual(DEFAULT_GALLERY_HERO_MOSAIC);
    expect(normalizeGalleryHeroMosaic({
      enabled: false,
      selectedPhotoIds: [3, '3', '4'],
      offsetX: 99,
      offsetY: -999,
      scale: 0.1,
    })).toEqual({
      enabled: false,
      photo_ids: ['3', '4'],
      offset_x: 24,
      offset_y: -120,
      scale: 0.82,
    });
  });

  it('keeps the configured photo order and falls back when a selection disappears', () => {
    const photos = [
      { id: 'a', url: '/gallery/a.jpg' },
      { id: 'b', url: '/gallery/b.webp' },
      { id: 'c', url: '/gallery/c.jpg' },
    ];

    expect(resolveGalleryHeroPhotos({ photo_ids: ['c', 'a'] }, photos).map((photo) => photo.id))
      .toEqual(['c', 'a']);
    expect(resolveGalleryHeroPhotos({ photo_ids: ['missing'] }, photos).map((photo) => photo.id))
      .toEqual(['b', 'a', 'c']);
  });
});
