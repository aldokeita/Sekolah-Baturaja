-- Menyalakan satu periode ajaran ketika belum ada yang aktif.
--
-- Sekolah berangkat dengan seluruh baris `periode_ajaran` bernilai
-- is_active = false. Panel Jadwal Pelajaran menutupi keadaan itu karena punya
-- fallback ke periode pertama, jadi pengelola tidak pernah sadar ada yang
-- kurang — sementara konsumen yang menyaring ketat justru diam-diam kosong:
--
--   * TVDisplayPage panel "Jadwal Hari Ini" mensyaratkan `p.is_active` tanpa
--     fallback, sehingga layar lobi selalu menampilkan "Tidak ada jadwal".
--   * ModulNilai, ModulKontenKelas, dan JadwalSaya memilih periode aktif lebih
--     dulu; tanpa penanda itu ketiganya bergantung pada urutan baris.
--
-- Yang dipilih: periode dengan tanggal mulai paling akhir, lalu tahun ajaran
-- paling akhir sebagai pemutus ketika tanggalnya kosong. Migrasi ini tidak
-- menyentuh basis data yang sudah punya periode aktif.

UPDATE periode_ajaran
SET is_active = true
WHERE id = (
  SELECT id FROM periode_ajaran
  ORDER BY tanggal_mulai DESC NULLS LAST, tahun_ajaran DESC, created_at DESC
  LIMIT 1
)
AND NOT EXISTS (SELECT 1 FROM periode_ajaran WHERE is_active);
