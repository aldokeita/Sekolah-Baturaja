-- Metode mengaji disamakan dengan tingkat yang benar-benar tersimpan di data.
--
-- Sebelumnya `tahfizh_config` menyetel metode 'iqro', yang tingkatnya
-- 'Iqro 1'..'Iqro 6' dan "Al-Qur'an". Padahal seluruh murid contoh menyimpan
-- 'Jilid 1' atau 'Jilid 2'. Jadi tingkat setiap murid TIDAK ADA di daftar tingkat
-- sekolahnya sendiri, dengan dua akibat yang terlihat:
--   - kolom Tingkat menampilkan nilai yang bukan pilihan sah;
--   - tombol Naik/Turun Tingkat mencari posisi nilai itu di daftar dan tidak
--     menemukannya, sehingga tidak tahu tingkat berikutnya.
--
-- Yang dipilih pemilik: samakan konfigurasinya, jangan ubah data muridnya.
--
-- Metodenya 'kustom', BUKAN 'qiroati'. Daftar Qiroati resmi berisi 'Jilid 1A',
-- 'Jilid 1B', 'Jilid 2A' dan seterusnya — 'Jilid 1' polos tidak ada di dalamnya,
-- jadi memilih 'qiroati' tidak akan membuat data yang ada menjadi sah. Tangga
-- 'Jilid 1'..'Jilid 6' ini memang tangga milik sekolah sendiri, dan 'kustom'
-- adalah nama yang jujur untuk itu.
--
-- `getTingkatLevels()` di src/lib/tahfizhLevels.js mengembalikan customLevels
-- apa adanya begitu metodenya 'kustom', jadi daftar di bawah inilah yang dipakai
-- seluruh dasbor.
--
-- Ditutup dengan "Al-Qur'an" supaya murid di jilid terakhir masih punya tingkat
-- berikutnya dan tombol Naik Tingkat tidak mentok tanpa sebab.

INSERT INTO public.website_content (key, content, is_public)
VALUES (
    'tahfizh_config',
    jsonb_build_object(
        'method', 'kustom',
        'customLevels', jsonb_build_array(
            'Jilid 1', 'Jilid 2', 'Jilid 3', 'Jilid 4', 'Jilid 5', 'Jilid 6', 'Al-Qur''an'
        )
    ),
    false
)
ON CONFLICT (key) DO UPDATE
SET content = EXCLUDED.content,
    updated_at = now();
