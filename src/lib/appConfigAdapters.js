import apiClient from '@/lib/apiClient';

export const APP_CONFIG_KEYS = {
  ADULT_SESSION: 'adultSessionConfig',
  LEVEL_CONFIG: 'level_config',
  GATCHA_CONFIG: 'gatcha_config',
  QUIZ_HAFALAN_CONFIG: 'quiz_hafalan_config',
  TV_CONFIG: 'tv_config',
  GURU_SESSION_OVERRIDES: 'guru_session_overrides',
  HAFALAN_VIDEOS: 'hafalanVideos',
};

export const getAppConfigErrorMessage = (error) => {
  const message = String(error?.message || '');
  if (error?.code === '42501' || message.toLowerCase().includes('row-level security')) {
    return 'Akses konfigurasi ditolak.';
  }
  return message || 'Operasi konfigurasi gagal.';
};

// GET /api/config returns a {key: content} map and simply omits keys that have
// no row, so a missing config reads as null instead of a 404. The single-key
// route would 404 and force every caller into a try/catch, so both the single
// and multi getters go through the map endpoint.
export const fetchAppConfigs = async (keys) => {
  const list = (Array.isArray(keys) ? keys : [keys]).filter(Boolean);
  if (list.length === 0) return {};
  const params = new URLSearchParams({ keys: list.join(',') });
  const data = await apiClient.get(`/api/config?${params}`);
  return data || {};
};

// Resolves to the stored content object (not the website_content row) because
// that is what every caller reads.
export const fetchAppConfig = async (key) => {
  const configs = await fetchAppConfigs([key]);
  return configs?.[key] ?? null;
};

export const upsertAppConfig = async (key, content) => {
  await apiClient.put(`/api/config/${encodeURIComponent(key)}`, { content });
  return content;
};
