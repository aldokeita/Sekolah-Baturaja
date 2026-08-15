-- Melengkapi daftar peran yang boleh tersimpan di login_logs.
--
-- Constraint lama hanya mengizinkan admin, guru, santri, dan pentashih. Dua
-- peran yang benar-benar dipakai tertinggal: `tata_usaha` (dashboard staf
-- administrasi) dan `superadmin` (pemilik template). Akibatnya handler
-- RecordAttempt membuang role mereka menjadi NULL, dan panel Log Aktivitas
-- Login menampilkan "Peran: N/A" untuk sesi yang justru paling perlu diaudit.
--
-- Baris lama tidak diubah: yang sudah terlanjur NULL memang tidak punya
-- informasi peran untuk dipulihkan.

ALTER TABLE login_logs DROP CONSTRAINT IF EXISTS login_logs_role_check;

ALTER TABLE login_logs ADD CONSTRAINT login_logs_role_check
  CHECK (role IS NULL OR role IN (
    'admin', 'superadmin', 'tata_usaha', 'guru', 'santri', 'pentashih'
  ));
