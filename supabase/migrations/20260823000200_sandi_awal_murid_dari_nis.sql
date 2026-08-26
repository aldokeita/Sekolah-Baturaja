-- Sandi awal setiap murid disetel ke nomor induknya.
--
-- Untuk murid BARU hal ini sudah berjalan sejak lama di `insertSantriTx`
-- (backend/internal/handler/santri.go): kalau payload tidak membawa password, ia
-- mengambil nisn, lalu nis, lalu nomor_induk, dan menyimpannya sebagai hash.
-- Jalur itu dipakai baik oleh tambah-satu-murid maupun impor massal.
--
-- Yang belum mengikuti aturan itu adalah murid yang SUDAH ada sebelumnya. Data
-- contoh memakai satu sandi seragam untuk semuanya, dan sekolah tidak punya cara
-- menerapkan aturan ini ke seluruh murid selain satu per satu. Migrasi ini
-- menyamakan keduanya.
--
-- Urutan pengambilan identitas SENGAJA sama dengan `insertSantriTx` — nisn, nis,
-- nomor_induk — supaya murid lama dan murid baru tidak berakhir dengan aturan
-- yang berbeda.
--
-- Cost 12 menyamai `bcryptCost` di backend/internal/auth/password.go. Jangan
-- diturunkan hanya supaya migrasinya cepat: hash yang dihasilkan di sini dan
-- yang dihasilkan Go harus setara.
--
-- Murid tanpa satu pun nomor identitas TIDAK disentuh. Menyetel sandi kosong
-- akan mengunci akunnya, dan `tryVerify` di auth.go memang menolak akun tanpa
-- sandi. Biarkan admin yang mengisi nomornya lebih dulu.
--
-- Baris yang sudah diarsipkan ikut disetel, supaya murid yang dipulihkan tidak
-- kembali dengan akun terkunci.

UPDATE public.santri s
SET password = extensions.crypt(
        COALESCE(
            NULLIF(TRIM(s.nisn), ''),
            NULLIF(TRIM(s.nis), ''),
            NULLIF(TRIM(s.nomor_induk), '')
        ),
        extensions.gen_salt('bf', 12)
    ),
    updated_at = now()
WHERE COALESCE(
        NULLIF(TRIM(s.nisn), ''),
        NULLIF(TRIM(s.nis), ''),
        NULLIF(TRIM(s.nomor_induk), '')
      ) IS NOT NULL;
