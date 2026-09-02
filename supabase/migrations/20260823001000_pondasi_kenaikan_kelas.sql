-- Pondasi kenaikan kelas: tingkat pada rombel, dan catatan kenaikan per tahun.
--
-- Sampai sekarang belum ada kenaikan kelas. Yang ada hanya pindah kelas SATU
-- murid (`POST /api/santri/move-class`), jadi menaikkan enam rombel berarti
-- ratusan kali buka-ubah-simpan setiap awal tahun ajaran.
--
-- ── Mengapa perlu kolom `tingkat` ───────────────────────────────────────────
-- `classes` hanya punya `nama_kelas` berupa teks bebas. Bagi aplikasi "Kelas 2B"
-- adalah satu untai teks — ia tidak tahu mana angka tingkatnya dan mana huruf
-- rombelnya. Menyusun peta kenaikan dengan membaca nama kelas akan pecah begitu
-- sekolah menamainya lain: "Kelas II-B", "2 Melati", atau "2B" tanpa kata Kelas.
--
-- Karena itu tingkatnya disimpan sebagai angka. Diisi dari `sort_order`, yang di
-- data ini sudah berisi 1..6 sesuai tingkatnya. Dibiarkan NULL berarti "rombel
-- ini tidak ikut kenaikan kelas otomatis" — misalnya kelas khusus atau kelompok
-- yang bukan rombel tingkat.
--
-- `tingkat` TIDAK menggantikan `sort_order`. sort_order mengatur urutan tampilan
-- dan boleh dipakai sekolah untuk apa saja; tingkat punya arti tunggal, yaitu
-- kelas berapa.
--
-- ── Mengapa perlu catatan kenaikan ─────────────────────────────────────────
-- Tanpa catatan, tidak ada cara mengetahui kenaikan tahun ini sudah dijalankan
-- atau belum. Menjalankannya dua kali akan menaikkan murid dua tingkat, dan
-- tidak ada satu pun pesan galat yang mencegahnya. Batasan unik pada
-- `tahun_ajaran_asal` itulah pencegahnya, bukan kehati-hatian admin.
--
-- Status murid TIDAK perlu migrasi: kolomnya teks tanpa batasan nilai, jadi
-- 'Lulus' langsung sah. Sudah diperiksa bahwa nilai baru itu aman —
-- `active_only` di santri.go hanya mencocokkan 'aktif'/'active', login murid di
-- auth.go mensyaratkan status 'Aktif', dan papan peringkat pun begitu. Jadi
-- murid berstatus Lulus otomatis tidak bisa masuk dan tidak muncul di daftar
-- aktif, tanpa perubahan kode apa pun.

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS tingkat smallint;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.classes'::regclass AND conname = 'classes_tingkat_check'
    ) THEN
        ALTER TABLE public.classes
          ADD CONSTRAINT classes_tingkat_check
          CHECK (tingkat IS NULL OR tingkat BETWEEN 1 AND 12);
    END IF;
END $$;

COMMENT ON COLUMN public.classes.tingkat IS
  'Angka tingkat rombel (1..12). NULL berarti rombel tidak ikut kenaikan kelas otomatis.';

-- Diisi dari sort_order hanya bila nilainya masuk akal sebagai tingkat, dan
-- hanya untuk rombel yang belum punya tingkat.
UPDATE public.classes
SET tingkat = sort_order
WHERE tingkat IS NULL
  AND sort_order BETWEEN 1 AND 12;

CREATE INDEX IF NOT EXISTS classes_tingkat_idx ON public.classes(tingkat);

CREATE TABLE IF NOT EXISTS public.class_promotion_runs (
  id                    uuid primary key default gen_random_uuid(),
  tahun_ajaran_asal     text not null,
  tahun_ajaran_tujuan   text not null,
  jumlah_naik           integer not null default 0,
  jumlah_tinggal        integer not null default 0,
  jumlah_lulus          integer not null default 0,
  catatan               text,
  dijalankan_pada       timestamptz not null default now(),
  dijalankan_oleh       uuid references auth.users(id),
  constraint class_promotion_runs_tahun_format_asal
    check (tahun_ajaran_asal ~ '^[0-9]{4}/[0-9]{4}$'),
  constraint class_promotion_runs_tahun_format_tujuan
    check (tahun_ajaran_tujuan ~ '^[0-9]{4}/[0-9]{4}$'),
  -- Pencegah kenaikan ganda. Satu tahun ajaran hanya boleh dinaikkan sekali.
  constraint class_promotion_runs_asal_unik unique (tahun_ajaran_asal)
);

COMMENT ON TABLE public.class_promotion_runs IS
  'Catatan kenaikan kelas yang sudah dijalankan, satu baris per tahun ajaran asal.';
