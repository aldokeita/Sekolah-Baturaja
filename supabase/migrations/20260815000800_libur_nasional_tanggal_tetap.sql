-- Mengisi hari libur nasional bertanggal tetap ke kalender akademik.
--
-- Sebelum ini `academic_calendar` kosong sama sekali, sehingga 17 Agustus
-- tampil sebagai Hari Efektif di panel Kalender. Dampaknya bukan hanya
-- tampilan: GuruAttendanceRecap menghitung kewajiban sesi dari hari efektif,
-- jadi setiap hari libur yang tidak tercatat menaikkan penyebut dan menurunkan
-- persentase kehadiran seluruh guru secara keliru.
--
-- YANG DIISI DI SINI HANYA LIBUR BERTANGGAL TETAP MENURUT KALENDER MASEHI.
-- Lima hari ini tidak pernah bergeser, jadi aman disemai sampai beberapa tahun
-- ke depan.
--
-- YANG SENGAJA TIDAK DIISI: libur yang tanggalnya ditetapkan SKB 3 Menteri tiap
-- tahun — Idul Fitri, Idul Adha, Tahun Baru Islam, Maulid Nabi, Isra Mikraj,
-- Tahun Baru Imlek, Nyepi, Waisak, Wafat Isa Almasih, Kenaikan Isa Almasih,
-- serta seluruh cuti bersama. Tanggalnya mengikuti kalender lunar/lunisolar dan
-- baru pasti setelah SKB terbit. Menebaknya di migrasi justru menanam tanggal
-- salah yang sulit ditemukan; sekolah memasukkannya lewat panel Kalender.
--
-- Idempoten: dijalankan ulang tidak menggandakan baris, dan judul yang sudah
-- disunting sekolah tidak ditimpa.

INSERT INTO academic_calendar (date, title, description, is_holiday, is_public, event_type)
SELECT
  make_date(tahun, bulan, hari),
  judul,
  'Libur nasional bertanggal tetap.',
  true,
  true,
  'holiday'
FROM generate_series(2026, 2030) AS tahun
CROSS JOIN (VALUES
  (1,  1,  'Tahun Baru Masehi'),
  (5,  1,  'Hari Buruh Internasional'),
  (6,  1,  'Hari Lahir Pancasila'),
  (8,  17, 'Hari Kemerdekaan Republik Indonesia'),
  (12, 25, 'Hari Raya Natal')
) AS libur(bulan, hari, judul)
WHERE NOT EXISTS (
  SELECT 1 FROM academic_calendar ac
  WHERE ac.date = make_date(tahun, bulan, hari)
    AND ac.is_holiday
);
