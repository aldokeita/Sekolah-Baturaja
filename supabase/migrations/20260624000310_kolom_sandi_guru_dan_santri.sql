-- Kolom sandi pada `guru` dan `santri`.
--
-- KENAPA CAP WAKTUNYA MUNDUR, dan kenapa itu disengaja:
--
-- Kedua kolom ini sebelumnya dibuat oleh `backend/init/02_auth_columns.sql`.
-- Berkas init dijalankan entrypoint PostgreSQL menurut urutan namanya, sehingga
-- `02_` berjalan SESUDAH `01_migrate.sh` yang menerapkan seluruh migrasi. Selama
-- tidak ada migrasi yang menyentuh kolom sandi, urutan itu tidak menimbulkan
-- masalah.
--
-- Sejak 20260823000200 dan 20260823000300 ada, urutannya menjadi fatal: keduanya
-- menyetel `santri.password`, sementara kolomnya baru dibuat sesudah seluruh
-- migrasi selesai. Akibatnya SETIAP pemasangan baru gagal di tengah jalan —
-- `psql -v ON_ERROR_STOP=1` menghentikan `01_migrate.sh`, sehingga seed, akun
-- admin bootstrap, dan SELURUH migrasi sesudah 20260823000200 tidak pernah
-- dijalankan. Yang tersisa hanya skema separuh jadi tanpa satu pun akun yang
-- bisa masuk.
--
-- Basis data yang sudah hidup tidak terpengaruh: `docker-entrypoint-initdb.d`
-- hanya berjalan pada volume kosong, dan kolomnya di sana sudah ada. Karena
-- proyek ini tidak memakai tabel catatan migrasi — `01_migrate.sh` sekadar
-- menerapkan seluruh berkas menurut urutan nama — satu-satunya yang menentukan
-- adalah POSISI berkas ini dalam urutan itu. Ia harus berada sesudah tabelnya
-- dibuat (20260624000300) dan sebelum migrasi pertama yang memakainya.
--
-- `IF NOT EXISTS` menjaga migrasi ini aman dijalankan pada basis data yang
-- kolomnya sudah dibuat berkas init lama.

ALTER TABLE public.guru   ADD COLUMN IF NOT EXISTS password text;
ALTER TABLE public.santri ADD COLUMN IF NOT EXISTS password text;

COMMENT ON COLUMN public.guru.password IS
  'Hash bcrypt (cost 12). Supabase dulu menyimpan kredensial di auth.users; backend Go menerbitkan JWT-nya sendiri, jadi hash-nya tinggal di baris profil.';
COMMENT ON COLUMN public.santri.password IS
  'Hash bcrypt (cost 12). Sandi awal murid diturunkan dari nomor identitasnya — lihat insertSantriTx di backend/internal/handler/santri.go.';
