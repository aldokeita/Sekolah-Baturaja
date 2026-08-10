// Editor Prestasi memiliki state dan tombol Simpan sendiri. Mengirim snapshot
// parent dari tombol global setelah editor menyimpan dapat mengembalikan record
// terakhir (#5/#6) ke data lama.
const GLOBAL_SAVE_EXCLUDED_KEYS = new Set(['news', 'announcements', 'prestasi_content']);

export const buildGlobalContentSaveItems = (content) => Object.keys(content || {})
  .filter((key) => !GLOBAL_SAVE_EXCLUDED_KEYS.has(key))
  .map((key) => ({ key, content: content[key], is_public: true }));
