-- Membersihkan shift murid yang tertinggal di kosakata lama.
--
-- Migrasi shift terdahulu (20260815000400) hanya menata `classes.sesi` dan
-- MELEWATKAN `santri.sesi_mengaji`. Akibatnya sepuluh murid tetap bernilai
-- 'Sore' padahal kelasnya sudah 'Pagi'.
--
-- Itu bukan sekadar label yang jelek. `getSantriSession` mendahulukan
-- `sesi_mengaji` sebelum jatuh ke shift kelas, dan 'Sore' kini dipetakan ke
-- 'Siang' oleh LEGACY_SESSION_ALIASES — sehingga jendela absensi mereka menjadi
-- 11.30–17.00. Murid kelas pagi yang datang pukul 07.00 akan ditolak karena
-- dianggap di luar jam absensi.
--
-- Nilai yang bukan shift sah dikosongkan, bukan ditebak: dengan NULL,
-- `getSantriSession` jatuh ke `class.sesi`, dan shift kelas memang satu-satunya
-- sumber yang benar. Menyimpan shift terpisah di baris murid justru yang
-- mengundang selisih ini sejak awal.

UPDATE santri
SET sesi_mengaji = NULL
WHERE sesi_mengaji IS NOT NULL
  AND btrim(sesi_mengaji) <> ''
  AND sesi_mengaji NOT IN ('Pagi', 'Siang');
