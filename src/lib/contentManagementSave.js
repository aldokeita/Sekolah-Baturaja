// Konten yang memiliki editor dan tombol Simpan sendiri tidak boleh ikut
// dikirim oleh tombol global. State parent dapat lebih lama daripada state
// editor tersebut, sehingga pengiriman ulang snapshot-nya berisiko menimpa
// perubahan yang baru saja disimpan.
//
// `logoUrl` dan `schoolBuildingPhoto` juga dikecualikan karena upload pada
// ContentManagement langsung menyimpan keduanya setelah URL aset tersedia.
const GLOBAL_SAVE_EXCLUDED_KEYS = new Set([
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
]);

export const buildGlobalContentSaveItems = (content) => Object.keys(content || {})
  .filter((key) => !GLOBAL_SAVE_EXCLUDED_KEYS.has(key))
  .map((key) => ({ key, content: content[key], is_public: true }));
