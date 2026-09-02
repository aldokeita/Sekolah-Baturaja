-- Kolom agama pada data murid.
--
-- Sekolah negeri memilah kelas Pendidikan Agama menurut agama muridnya, dan buku
-- induk selalu memintanya. Tanpa kolom ini keduanya dikerjakan di luar aplikasi.
--
-- Sengaja `text` bebas, BUKAN enum: daftar agama yang diakui bisa berubah, dan
-- sebuah enum di PostgreSQL menuntut migrasi lagi setiap kali daftarnya bergeser.
-- Penyaringan pilihannya dikerjakan di form, tempat perubahan tidak memerlukan
-- perubahan skema. Dibiarkan NULL untuk seluruh baris yang sudah ada — data
-- murid lama tidak boleh tiba-tiba mengaku beragama tertentu.

ALTER TABLE public.santri
  ADD COLUMN IF NOT EXISTS agama text;

COMMENT ON COLUMN public.santri.agama IS
  'Agama murid. Teks bebas; pilihannya dibatasi di form (Islam, Kristen, Katolik, Hindu, Buddha, Konghucu, Kepercayaan). NULL berarti belum diisi.';
