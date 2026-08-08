/**
 * Asset bawaan yang netral untuk salinan template.
 *
 * Logo yang disimpan pembeli di website_content tetap menjadi sumber utama.
 * Asset ini hanya dipakai sebelum logo sekolah tersedia atau ketika jaringan
 * tidak dapat memuat logo tersimpan.
 */
export const DEFAULT_LOGO_PATH = '/logo-sekolah.svg';
export const LEGACY_LOGO_PATH = '/logo-lpq-al-fath-maulana.webp';

export const isLegacyLogoPath = (value) => {
  const normalized = String(value || '').trim();
  return normalized === LEGACY_LOGO_PATH || normalized.endsWith(LEGACY_LOGO_PATH);
};
