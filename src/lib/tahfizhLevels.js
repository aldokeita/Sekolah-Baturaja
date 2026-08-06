// Metode mengaji sekolah — satu sumber kebenaran untuk tingkat murid.
//
// Setiap sekolah memakai metode berbeda: Qiroati, Iqro, Ummi, Wafa, Tilawati,
// atau menyusun tingkatnya sendiri. Sebelumnya daftar Qiroati disalin ke tujuh
// berkas, sehingga sekolah dengan metode lain tidak bisa memakai modul ini.
//
// Sumber kebenaran sesungguhnya adalah konfigurasi aplikasi di basis data
// (kunci tahfizh_config), supaya seluruh admin dan guru melihat daftar yang
// sama. localStorage hanya singgahan, karena beberapa pemanggil membaca daftar
// ini saat modul dimuat — sebelum permintaan jaringan sempat selesai.

const CACHE_KEY = 'lpq_tahfizh_config';

export const TAHFIZH_METHODS = {
  qiroati: {
    label: 'Qiroati',
    levels: [
      'Pra TK A', 'Pra TK B', 'Pra TK C',
      'Jilid 1A', 'Jilid 1B', 'Jilid 1C',
      'Jilid 2A', 'Jilid 2B',
      'Jilid 3A', 'Jilid 3B',
      'Jilid 4A', 'Jilid 4B',
      'Jilid 5A', 'Jilid 5B',
      'Jilid Juz 27',
      'Jilid 6A', 'Jilid 6B',
      "Al-Qur'an", 'Ghorib Tajwid', 'Finishing',
    ],
  },
  iqro: {
    label: 'Iqro',
    levels: ['Iqro 1', 'Iqro 2', 'Iqro 3', 'Iqro 4', 'Iqro 5', 'Iqro 6', "Al-Qur'an"],
  },
  ummi: {
    label: 'Ummi',
    levels: [
      'Ummi 1', 'Ummi 2', 'Ummi 3', 'Ummi 4', 'Ummi 5', 'Ummi 6',
      'Ghorib', 'Tajwid', "Al-Qur'an",
    ],
  },
  wafa: {
    label: 'Wafa',
    levels: ['Wafa 1', 'Wafa 2', 'Wafa 3', 'Wafa 4', 'Wafa 5', 'Tajwid', "Al-Qur'an"],
  },
  tilawati: {
    label: 'Tilawati',
    levels: [
      'Tilawati 1', 'Tilawati 2', 'Tilawati 3', 'Tilawati 4', 'Tilawati 5', 'Tilawati 6',
      'Ghorib', 'Tajwid', "Al-Qur'an",
    ],
  },
  tahfizh: {
    label: 'Tahfizh (Juz)',
    levels: [
      'Juz 30', 'Juz 29', 'Juz 28', 'Juz 27', 'Juz 26',
      '5 Juz', '10 Juz', '15 Juz', '20 Juz', '25 Juz', '30 Juz',
    ],
  },
  kustom: { label: 'Lainnya / Kustom', levels: [] },
};

export const METHOD_OPTIONS = Object.entries(TAHFIZH_METHODS).map(([id, m]) => ({
  id,
  label: m.label,
}));

export const DEFAULT_TAHFIZH_CONFIG = { method: 'qiroati', customLevels: [] };

const sanitizeLevels = (levels) =>
  (Array.isArray(levels) ? levels : []).map((item) => String(item).trim()).filter(Boolean);

const readCache = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return DEFAULT_TAHFIZH_CONFIG;
    return {
      method: TAHFIZH_METHODS[parsed.method] ? parsed.method : DEFAULT_TAHFIZH_CONFIG.method,
      customLevels: sanitizeLevels(parsed.customLevels),
    };
  } catch {
    return DEFAULT_TAHFIZH_CONFIG;
  }
};

let cached = readCache();

export const getTahfizhConfig = () => cached;

export const applyTahfizhConfig = (config) => {
  cached = {
    method: TAHFIZH_METHODS[config?.method] ? config.method : DEFAULT_TAHFIZH_CONFIG.method,
    customLevels: sanitizeLevels(config?.customLevels),
  };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Mode privasi ketat memblokir penyimpanan; singgahan memori tetap jalan.
  }
  return cached;
};

export const getTingkatLevels = () => {
  const { method, customLevels } = cached;
  if (method === 'kustom') return customLevels;
  const preset = TAHFIZH_METHODS[method]?.levels || [];
  return customLevels.length > 0 ? customLevels : preset;
};

// Mengembalikan null bila murid sudah di ujung daftar, sehingga pemanggil dapat
// membedakan "tidak bisa naik" dari "naik ke tingkat berikutnya".
export const getAdjacentTingkat = (current, direction) => {
  const levels = getTingkatLevels();
  const index = levels.indexOf(current);
  if (index === -1) return null;
  const target = direction === 'up' ? index + 1 : index - 1;
  if (target < 0 || target >= levels.length) return null;
  return levels[target];
};
