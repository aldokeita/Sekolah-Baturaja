// Tingkat tahfizh — satu sumber kebenaran untuk seluruh aplikasi.
//
// Sebelumnya daftar ini disalin ke tujuh berkas, semuanya memakai nama tingkat
// Qiroati. Akibatnya sekolah yang memakai metode lain (Ummi, Iqro, Tilawati,
// atau berbasis juz) tidak bisa memakai modul tahfizh sama sekali.
//
// Daftar bawaan tetap memakai penamaan Qiroati agar data lama tidak rusak,
// tetapi sekolah dapat menggantinya lewat setTingkatLevels(). Urutan penting:
// tombol naik/turun tingkat memakai posisi indeks pada larik ini.

const STORAGE_KEY = 'lpq_tingkat_levels';

export const DEFAULT_TINGKAT_LEVELS = [
  'Pra TK A', 'Pra TK B', 'Pra TK C',
  'Jilid 1A', 'Jilid 1B', 'Jilid 1C',
  'Jilid 2A', 'Jilid 2B',
  'Jilid 3A', 'Jilid 3B',
  'Jilid 4A', 'Jilid 4B',
  'Jilid 5A', 'Jilid 5B',
  'Jilid Juz 27',
  'Jilid 6A', 'Jilid 6B',
  "Al-Qur'an", 'Ghorib Tajwid', 'Finishing',
];

export const getTingkatLevels = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TINGKAT_LEVELS;
    const parsed = JSON.parse(raw);
    const cleaned = Array.isArray(parsed)
      ? parsed.map((item) => String(item).trim()).filter(Boolean)
      : [];
    return cleaned.length > 0 ? cleaned : DEFAULT_TINGKAT_LEVELS;
  } catch {
    return DEFAULT_TINGKAT_LEVELS;
  }
};

export const setTingkatLevels = (levels) => {
  const cleaned = (levels || []).map((item) => String(item).trim()).filter(Boolean);
  if (cleaned.length === 0) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
};

// Mengembalikan null bila murid sudah berada di ujung daftar, sehingga pemanggil
// dapat membedakan "tidak bisa naik" dari "naik ke tingkat berikutnya".
export const getAdjacentTingkat = (current, direction) => {
  const levels = getTingkatLevels();
  const index = levels.indexOf(current);
  if (index === -1) return null;
  const target = direction === 'up' ? index + 1 : index - 1;
  if (target < 0 || target >= levels.length) return null;
  return levels[target];
};
