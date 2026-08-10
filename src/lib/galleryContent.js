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
export const GALLERY_HERO_MOSAIC_KEY = 'galleryHeroMosaic';
export const DEFAULT_GALLERY_HERO_MOSAIC = Object.freeze({
  enabled: true,
  photo_ids: [],
  offset_x: 10,
  offset_y: 0,
  scale: 1,
});
const GALLERY_HERO_ASPECT_MIN = 0.62;
const GALLERY_HERO_ASPECT_MAX = 1.75;
const GALLERY_HERO_OFFSET_X_MIN = -24;
const GALLERY_HERO_OFFSET_X_MAX = 24;
const GALLERY_HERO_OFFSET_Y_MIN = -120;
const GALLERY_HERO_OFFSET_Y_MAX = 120;
const GALLERY_HERO_SCALE_MIN = 0.82;
const GALLERY_HERO_SCALE_MAX = 1.2;

const clampNumber = (value, min, max, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
};

const getMosaicPhotoIds = (value) => (
  value?.photo_ids
  || value?.photoIds
  || value?.selected_photo_ids
  || value?.selectedPhotoIds
  || []
);

/**
 * Normalizes the optional public Gallery header configuration. The empty
 * `photo_ids` value deliberately means "use the current automatic pool" so
 * older website content keeps the same behaviour after this feature ships.
 */
export const normalizeGalleryHeroMosaic = (value) => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    enabled: source.enabled !== false,
    photo_ids: uniqueIds(getMosaicPhotoIds(source)).slice(0, GALLERY_HERO_POOL_LIMIT),
    offset_x: Number(clampNumber(
      source.offset_x ?? source.offsetX,
      GALLERY_HERO_OFFSET_X_MIN,
      GALLERY_HERO_OFFSET_X_MAX,
      DEFAULT_GALLERY_HERO_MOSAIC.offset_x,
    ).toFixed(2)),
    offset_y: Number(clampNumber(
      source.offset_y ?? source.offsetY,
      GALLERY_HERO_OFFSET_Y_MIN,
      GALLERY_HERO_OFFSET_Y_MAX,
      DEFAULT_GALLERY_HERO_MOSAIC.offset_y,
    ).toFixed(2)),
    scale: Number(clampNumber(
      source.scale,
      GALLERY_HERO_SCALE_MIN,
      GALLERY_HERO_SCALE_MAX,
      DEFAULT_GALLERY_HERO_MOSAIC.scale,
    ).toFixed(2)),
  };
};

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

const getValidGalleryPhotos = (rows) => {
  const seenUrls = new Set();
  return normalizeGalleryPhotos(rows).filter((photo) => {
    if (!isUsableImageUrl(photo.url) || seenUrls.has(photo.url)) return false;
    seenUrls.add(photo.url);
    return true;
  });
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
  const photos = getValidGalleryPhotos(rows);
  const webp = photos.filter(isWebpPhoto);
  const other = photos.filter((photo) => !isWebpPhoto(photo));
  return [...webp, ...other].slice(0, max);
};

/**
 * Resolves an editor-selected pool while preserving the saved order. When a
 * selected asset was removed or no selection was saved, it falls back to the
 * existing bounded WebP-first pool instead of leaving the header empty.
 */
export const resolveGalleryHeroPhotos = (config, rows) => {
  const mosaic = normalizeGalleryHeroMosaic(config);
  const validPhotos = getValidGalleryPhotos(rows);
  if (mosaic.photo_ids.length > 0) {
    const photoMap = new Map(validPhotos.map((photo) => [String(photo.id), photo]));
    const selected = mosaic.photo_ids
      .map((id) => photoMap.get(String(id)))
      .filter(Boolean);
    if (selected.length > 0) return selected.slice(0, GALLERY_HERO_POOL_LIMIT);
  }
  return selectGalleryHeroPhotos(validPhotos);
};

/**
 * Converts the natural image ratio into a responsive tile ratio. The natural
 * ratio remains the source of truth, while the bounds keep unusually narrow
 * or panoramic uploads from creating an unstable scrolling column.
 */
export const getGalleryHeroAspectRatio = (photo, heightScale = 1) => {
  const naturalWidth = Number(photo?.naturalWidth);
  const naturalHeight = Number(photo?.naturalHeight);
  const nativeRatio = naturalWidth > 0 && naturalHeight > 0
    ? naturalWidth / naturalHeight
    : 1.12;
  const safeScale = Number.isFinite(heightScale) && heightScale > 0 ? heightScale : 1;
  const ratio = Math.min(
    GALLERY_HERO_ASPECT_MAX,
    Math.max(GALLERY_HERO_ASPECT_MIN, nativeRatio / safeScale),
  );
  return Number(ratio.toFixed(3));
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
