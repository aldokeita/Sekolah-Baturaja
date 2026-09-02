-- Kalender akademik tahun ajaran 2026/2027, Juli 2026 sampai Juni 2027.
--
-- ── Masalah yang diperbaiki ─────────────────────────────────────────────────
-- Hanya Agustus 2026 yang punya baris di `academic_calendar_month_settings`,
-- dengan saturday_is_holiday = false (Sabtu MASUK). Untuk bulan tanpa baris,
-- `DEFAULT_SATURDAY_IS_HOLIDAY` di src/lib/calendarUtils.js bernilai true —
-- Sabtu dianggap LIBUR.
--
-- Jadi sejak September, rekap kehadiran tidak menghitung Sabtu sebagai hari
-- efektif, padahal jadwal pelajaran (migrasi 20260823000400) menaruh satu blok
-- PJOK setiap Sabtu untuk keenam kelas. Dua bagian aplikasi mengatakan hal yang
-- berbeda tentang hari yang sama, dan angka "total hari efektif" itu ikut
-- tercetak di rapor.
--
-- Kedua belas bulan disetel mengikuti Agustus: Sabtu masuk. Itu satu-satunya
-- bukti kebijakan yang ada di data ini. Kalau sekolah ternyata memakai lima
-- hari, ubah lewat panel Kalender, atau sekali jalan:
--
--   update public.academic_calendar_month_settings
--   set saturday_is_holiday = true where year in (2026, 2027);
--
-- ── Hari libur TIDAK diisi di sini, dan itu bukan kelalaian ────────────────
-- Libur nasional bertanggal tetap SUDAH ditanam migrasi
-- 20260815000800_libur_nasional_tanggal_tetap.sql — Tahun Baru, Hari Buruh,
-- Hari Lahir Pancasila, Hari Kemerdekaan, dan Natal, untuk 2026 sampai 2030.
-- Menambahkannya lagi di sini hanya menyalin data yang sudah ada.
--
-- Libur yang BERGERAK sengaja tidak ditanam siapa pun: Idul Fitri, Idul Adha,
-- Tahun Baru Islam, Maulid, Isra Mikraj, Nyepi, Waisak, Kenaikan Isa Almasih,
-- dan Imlek tanggalnya ditetapkan SKB tiga menteri setiap tahun dan bergantung
-- kalender lunar. Menebaknya berarti menaruh tanggal salah ke dalam perhitungan
-- hari efektif sekolah.
--
-- Libur semester, jeda tengah semester, dan hari efektif fakultatif juga
-- keputusan sekolah dan dinas. Semuanya dimasukkan lewat panel Kalender.
--
-- Aman dijalankan berulang. Baris Agustus 2026 yang sudah ada tidak tersentuh.

INSERT INTO public.academic_calendar_month_settings (year, month, saturday_is_holiday)
SELECT y, m, false
FROM (VALUES (2026, 7), (2026, 8), (2026, 9), (2026, 10), (2026, 11), (2026, 12),
             (2027, 1), (2027, 2), (2027, 3), (2027, 4), (2027, 5), (2027, 6)
     ) AS t(y, m)
ON CONFLICT (year, month) DO NOTHING;

-- Catatan untuk yang membaca nanti: kalau suatu saat perlu menambah tanggal ke
-- `academic_calendar`, JANGAN memakai `ON CONFLICT (date)`. Kolom itu dulu unik,
-- lalu migrasi 20260806000100 mencabut batasannya supaya satu tanggal bisa
-- memuat beberapa agenda. Sekarang `ON CONFLICT (date)` menggagalkan seluruh
-- pernyataan dengan "no unique or exclusion constraint matching". Pakai
-- `WHERE NOT EXISTS` pada pasangan tanggal dan judul.
