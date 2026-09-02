-- NIS didahulukan atas NISN untuk sandi awal murid.
--
-- Migrasi 20260823000200 menyetel sandi murid dari nomor induknya dengan urutan
-- nisn, nis, nomor_induk — mengikuti urutan yang saat itu ada di backend. Pemilik
-- kemudian memutuskan yang didahulukan adalah NIS: nomor internal sekolah yang
-- pendek itulah yang dihafal murid dan yang dibagikan sekolah, sementara NISN
-- sepuluh angka lebih sering hanya dipakai untuk urusan Dapodik.
--
-- Migrasi sebelumnya TIDAK disunting: ia sudah diterapkan, dan menyunting
-- migrasi yang sudah jalan berarti dua basis data dengan riwayat sama berakhir
-- berbeda isinya. Yang benar menambah migrasi baru seperti ini.
--
-- Akibatnya sandi murid yang punya NIS **berubah**. Untuk data contoh, sandi
-- Ahmad Fauzan berubah dari 9000000001 (NISN) menjadi 26001 (NIS). Sekolah yang
-- sudah membagikan sandi lama harus membagikannya ulang.
--
-- Urutan di sini harus tetap sama dengan `insertSantriTx` di
-- backend/internal/handler/santri.go dan dengan kedua jalur di
-- src/components/dashboard/admin/SantriManagement.jsx.
--
-- Cost 12 menyamai `bcryptCost` di backend/internal/auth/password.go.
--
-- Murid tanpa satu pun nomor identitas tidak disentuh: sandi kosong akan
-- mengunci akunnya, dan `tryVerify` di auth.go memang menolak akun tanpa sandi.

UPDATE public.santri s
SET password = extensions.crypt(
        COALESCE(
            NULLIF(TRIM(s.nis), ''),
            NULLIF(TRIM(s.nisn), ''),
            NULLIF(TRIM(s.nomor_induk), '')
        ),
        extensions.gen_salt('bf', 12)
    ),
    updated_at = now()
WHERE COALESCE(
        NULLIF(TRIM(s.nis), ''),
        NULLIF(TRIM(s.nisn), ''),
        NULLIF(TRIM(s.nomor_induk), '')
      ) IS NOT NULL;
