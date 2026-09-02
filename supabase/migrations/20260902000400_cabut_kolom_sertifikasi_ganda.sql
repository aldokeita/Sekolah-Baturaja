-- Mencabut kolom `guru.sertifikasi` yang baru dibuat migrasi 20260902000300.
--
-- Kolom itu keliru sejak awal: panel Data Guru SUDAH punya "Status Sertifikasi"
-- yang tersimpan di `guru.status_guru` ('Bersertifikat' / 'Belum Bersertifikat'),
-- dipakai penyaring daftar guru dan ikut pada ekspor Excel. Menambah boolean
-- kedua berarti dua kolom menyatakan hal yang sama, dan cepat atau lambat
-- keduanya akan berbeda — pertanyaannya lalu menjadi "yang mana yang benar?",
-- yang tidak bisa dijawab siapa pun.
--
-- `tahun_sertifikasi` dan `bidang_sertifikasi` TETAP: keduanya keterangan yang
-- memang belum bisa dibawa `status_guru`, bukan pengulangannya.

ALTER TABLE public.guru DROP COLUMN IF EXISTS sertifikasi;

COMMENT ON COLUMN public.guru.status_guru IS
  'Status sertifikasi guru: Bersertifikat atau Belum Bersertifikat. Satu-satunya sumber untuk itu — lihat migrasi 20260902000400.';
