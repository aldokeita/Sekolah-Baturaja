-- Shift masuk sekolah: hanya Pagi dan Siang.
--
-- Nilai `classes.sesi` warisan produk madrasah sebelumnya memuat 'Pagi 2',
-- 'Sore', dan 'Malam'. Sekolah dasar tidak mengenal ketiganya: sekolah satu
-- shift masuk pagi, sekolah yang kekurangan ruang kelas membagi rombelnya jadi
-- shift pagi dan siang, dan berhenti di situ.
--
-- Penempatan shift ditentukan dari JADWAL PELAJARAN kelas itu sendiri, bukan
-- ditebak dari nama lamanya. Kelas yang jam pelajaran paling awalnya sebelum
-- pukul 12.00 masuk shift pagi; selebihnya siang. Kelas yang belum punya jadwal
-- jatuh ke pagi, bawaan yang paling lazim di SD.

-- Perhatikan cabang IS NULL: `min()` atas nol baris mengembalikan NULL, dan
-- `NULL < TIME '12:00'` bukan TRUE, sehingga tanpa cabang ini kelas yang belum
-- punya jadwal akan jatuh ke ELSE dan salah ditandai 'Siang'. COALESCE di luar
-- pun tidak akan menolong, karena agregat selalu mengembalikan satu baris.
UPDATE classes c
SET sesi = COALESCE(
  (
    SELECT CASE
             WHEN min(j.jam_mulai) IS NULL THEN NULL
             WHEN min(j.jam_mulai) < TIME '12:00' THEN 'Pagi'
             ELSE 'Siang'
           END
    FROM jadwal_pelajaran j
    WHERE j.class_id = c.id
  ),
  'Pagi'
)
WHERE c.sesi IS NULL
   OR btrim(c.sesi) = ''
   OR c.sesi NOT IN ('Pagi', 'Siang');

-- CATATAN SENGAJA: baris `attendance` TIDAK ikut diubah.
--
-- Absensi adalah catatan atas peristiwa yang sudah terjadi. Menulis ulang label
-- sesinya berarti memalsukan arsip kehadiran — rekap bulan lalu akan berubah
-- angkanya tanpa ada yang benar-benar hadir atau absen. Nama sesi lama pada
-- baris lama tetap tersimpan apa adanya, dan dipetakan ke shift terdekat saat
-- dibaca lewat LEGACY_SESSION_ALIASES di `src/utils/AttendanceStatusLogic.js`.
