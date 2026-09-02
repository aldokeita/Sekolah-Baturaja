export const enableEdgeFunctions = import.meta.env.VITE_ENABLE_EDGE_FUNCTIONS === 'true';
export const enableDeferredFeatures = import.meta.env.VITE_ENABLE_DEFERRED_FEATURES === 'true';

// Backup & Restore is available by default for admins and has its own emergency kill switch.
export const enableBackupRestore = import.meta.env.VITE_ENABLE_BACKUP_RESTORE !== 'false';

// Game modules are production-ready and enabled by default.
// Set VITE_ENABLE_GAME_FEATURES=false as an emergency kill switch.
export const enableGameFeatures = import.meta.env.VITE_ENABLE_GAME_FEATURES !== 'false';

export const edgeFunctionDisabledMessage =
  'Fitur ini belum tersedia.';


// Program tahfizh bersifat opsional bagi sekolah umum. Saat mati, kolom Tingkat
// dan riwayatnya disembunyikan; datanya tetap utuh di basis data.
export const enableTahfizh = import.meta.env.VITE_ENABLE_TAHFIZH === 'true';

/* Materi, Tugas & Pengumuman kelas — MATI secara bawaan.
 *
 * Dicabut atas keputusan pemilik: di SD, guru mengabari orang tua lewat grup
 * WhatsApp, jadi papan materi di aplikasi tidak dipakai. Modulnya utuh — tabel
 * `kelas_konten`, handler Go beserta jalur baca muridnya, dan panel gurunya —
 * dan disimpan untuk jenjang SMP/SMA yang mungkin memerlukannya.
 *
 * Nyalakan dengan VITE_ENABLE_KELAS_KONTEN=true. */
export const enableKelasKonten = import.meta.env.VITE_ENABLE_KELAS_KONTEN === 'true';

/* Notifikasi WhatsApp otomatis — MATI secara bawaan.
 *
 * Pengirimannya menuntut layanan gerbang WhatsApp berbayar yang harus
 * didaftarkan sendiri oleh sekolah, dan tabel antreannya (`wa_outbox`) belum
 * diterapkan ke basis data. Selama keduanya belum ada, menunya disembunyikan
 * daripada menampilkan panel yang menjawab galat setiap dibuka.
 *
 * Nyalakan dengan VITE_ENABLE_WA_NOTIFICATIONS=true — dan terapkan dulu migrasi
 * supabase/migrations/20260823000100_wa_outbox.sql. */
export const enableWaNotifications = import.meta.env.VITE_ENABLE_WA_NOTIFICATIONS === 'true';