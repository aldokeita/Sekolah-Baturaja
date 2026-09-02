-- Data kepegawaian guru dan tenaga kependidikan.
--
-- Tabel `guru` sebelum ini hanya punya nama, kontak, jabatan, NUPTK, jenis
-- kelamin, dan tanggal lahir. Yang diminta pengawas saat berkunjung — nomor SK,
-- TMT, pangkat/golongan, status kepegawaian, sertifikasi, dan pendidikan
-- terakhir — tidak ada satu pun, sehingga sekolah menyimpannya di berkas Excel
-- terpisah yang tidak pernah sama dengan isi aplikasi.
--
-- Semua kolom `text` dan boleh NULL. Itu disengaja: sebuah SD bisa punya guru
-- PNS, PPPK, dan honorer sekaligus, dan yang wajib diisi berbeda untuk
-- masing-masing. Memaksa NOT NULL akan menghalangi sekolah menyimpan data guru
-- honorer yang memang belum punya SK maupun golongan.

ALTER TABLE public.guru
  ADD COLUMN IF NOT EXISTS nip                text,
  ADD COLUMN IF NOT EXISTS status_kepegawaian text,
  ADD COLUMN IF NOT EXISTS pangkat_golongan   text,
  ADD COLUMN IF NOT EXISTS tmt                date,
  ADD COLUMN IF NOT EXISTS nomor_sk           text,
  ADD COLUMN IF NOT EXISTS tanggal_sk         date,
  ADD COLUMN IF NOT EXISTS pendidikan_terakhir text,
  ADD COLUMN IF NOT EXISTS jurusan            text,
  ADD COLUMN IF NOT EXISTS sertifikasi         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tahun_sertifikasi   integer,
  ADD COLUMN IF NOT EXISTS bidang_sertifikasi  text;

-- NIP unik bila diisi. Honorer tidak punya NIP, jadi indeksnya parsial —
-- NOT NULL akan menolak mereka, dan indeks penuh akan menganggap semua NULL
-- sebagai bentrokan pada sebagian mesin basis data.
CREATE UNIQUE INDEX IF NOT EXISTS guru_nip_unik
  ON public.guru (nip) WHERE nip IS NOT NULL AND btrim(nip) <> '';

ALTER TABLE public.guru
  DROP CONSTRAINT IF EXISTS guru_tahun_sertifikasi_wajar;
ALTER TABLE public.guru
  ADD CONSTRAINT guru_tahun_sertifikasi_wajar
  CHECK (tahun_sertifikasi IS NULL OR tahun_sertifikasi BETWEEN 1950 AND 2200);

COMMENT ON COLUMN public.guru.status_kepegawaian IS
  'PNS, PPPK, GTT, PTT, atau sebutan lain yang dipakai sekolah. NULL berarti belum diisi.';
COMMENT ON COLUMN public.guru.tmt IS
  'Terhitung Mulai Tanggal — awal masa kerja. Masa kerja dihitung dari sini, tidak disimpan sebagai angka yang akan usang setiap tahun.';
