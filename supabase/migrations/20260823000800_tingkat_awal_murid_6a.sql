-- Tingkat mengaji awal murid Kelas 6A: Jilid 3.
--
-- Migrasi 20260823000600 membuat keempat murid tanpa tingkat, karena saat itu
-- tingkat yang tersimpan di data (Jilid 1, Jilid 2) belum terdaftar di metode
-- mengaji sekolah dan menyalinnya hanya memperbanyak nilai yang tidak sah.
-- Setelah 20260823000700 menyetel tangganya menjadi Jilid 1..Jilid 6 dan
-- Al-Qur'an, nilai ini sah, dan pemilik memilih Jilid 3.
--
-- Migrasi 20260823000600 SENGAJA tidak disunting. Ia sudah diterapkan; menyunting
-- migrasi yang sudah jalan membuat dua basis data dengan riwayat sama berakhir
-- berbeda isinya.
--
-- Mengikuti pola data yang ada: kelas 1 di Jilid 1, kelas 2 dan 3 di Jilid 2,
-- jadi kelas 6 di Jilid 3.
--
-- Hanya mengisi yang masih kosong. Sekolah yang sudah menetapkan tingkat
-- muridnya sendiri tidak akan tertimpa, dan migrasi ini aman dijalankan berulang.

UPDATE public.santri s
SET jilid = 'Jilid 3',
    updated_at = now()
FROM public.classes c
WHERE c.id = s.current_class_id
  AND c.nama_kelas = 'Kelas 6A'
  AND c.is_active
  AND c.deleted_at IS NULL
  AND s.deleted_at IS NULL
  AND (s.jilid IS NULL OR btrim(s.jilid) = '');
