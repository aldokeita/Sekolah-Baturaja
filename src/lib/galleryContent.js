const asText = (value) => String(value ?? '').trim();

const uniqueIds = (values) => [...new Set(
  (Array.isArray(values) ? values : [])
    .map((value) => asText(value))
    .filter(Boolean),
)];

/**
 * Normalizes the two website-content collections shared by the public Gallery
 * and the Media & Galeri editor. IDs are kept as strings so selections survive
 * JSON serialization and remain stable when old content used numeric IDs.
 */
export const normalizeGalleryPhotos = (rows) => (
  (Array.isArray(rows) ? rows : [])
    .filter((row) => row && typeof row === 'object')
    .map((row, index) => {
      const caption = asText(row.caption || row.name || row.title) || `Foto ${index + 1}`;
      const url = asText(row.url || row.image_url);
      return {
        ...row,
        id: asText(row.id) || `gallery-${index + 1}`,
        caption,
        url,
      };
    })
);

export const GALLERY_HERO_POOL_LIMIT = 10;

const isUsableImageUrl = (value) => {
  const url = asText(value);
  if (!url || typeof globalThis.URL !== 'function') return false;
  try {
    const parsed = new globalThis.URL(url, 'https://gallery.invalid');
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const isWebpPhoto = (photo) => {
  const declaredType = asText(
    photo?.mime_type || photo?.mimeType || photo?.contentType || photo?.format,
  ).toLowerCase().split(';')[0];
  if (declaredType === 'image/webp' || declaredType === 'webp') return true;
  try {
    return new globalThis.URL(photo.url, 'https://gallery.invalid').pathname.toLowerCase().endsWith('.webp');
  } catch {
    return false;
  }
};

/**
 * Selects a small, stable set of valid CMS photos for the decorative Gallery
 * header. WebP is preferred when the stored MIME type or URL identifies it;
 * the original order remains stable within each format group.
 */
export const selectGalleryHeroPhotos = (rows, limit = GALLERY_HERO_POOL_LIMIT) => {
  const max = Math.min(
    GALLERY_HERO_POOL_LIMIT,
    Number.isInteger(limit) && limit > 0 ? limit : GALLERY_HERO_POOL_LIMIT,
  );
  const seenUrls = new Set();
  const photos = normalizeGalleryPhotos(rows).filter((photo) => {
    if (!isUsableImageUrl(photo.url) || seenUrls.has(photo.url)) return false;
    seenUrls.add(photo.url);
    return true;
  });
  const webp = photos.filter(isWebpPhoto);
  const other = photos.filter((photo) => !isWebpPhoto(photo));
  return [...webp, ...other].slice(0, max);
};

export const normalizeGalleryAlbums = (rows) => (
  (Array.isArray(rows) ? rows : [])
    .filter((row) => row && typeof row === 'object')
    .map((row, index) => {
      const title = asText(row.title || row.name) || `Album ${index + 1}`;
      const photoIds = uniqueIds(row.photo_ids || row.photoIds);
      return {
        ...row,
        id: asText(row.id) || `album-${index + 1}`,
        title,
        description: asText(row.description),
        photo_ids: photoIds,
      };
    })
);

/**
 * Provides a useful public fallback when no named albums have been configured:
 * each category becomes an album, still backed by the existing gallery photos.
 */
export const deriveGalleryAlbums = (photos) => {
  const groups = new Map();
  normalizeGalleryPhotos(photos).forEach((photo) => {
    const category = asText(photo.kategori) || 'Lainnya';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(photo.id);
  });

  return [...groups.entries()].map(([category, photoIds]) => ({
    id: `derived-${category.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'lainnya'}`,
    title: category,
    description: `Kumpulan foto kegiatan ${category.toLowerCase()}.`,
    photo_ids: uniqueIds(photoIds),
  }));
};

export const resolveGalleryAlbumPhotos = (album, photos) => {
  const photoMap = new Map(normalizeGalleryPhotos(photos).map((photo) => [String(photo.id), photo]));
  return uniqueIds(album?.photo_ids || album?.photoIds)
    .map((id) => photoMap.get(id))
    .filter(Boolean);
};
