-- Logical migration: 0056_ppdb_wilayah_domisili
-- Purpose: menyimpan wilayah domisili pendaftar, dasar seleksi jalur Domisili
--          menurut Permendikdasmen No. 3 Tahun 2025.
-- Dependencies: 20260807000100_pendaftaran_ppdb.sql (pendaftaran_ppdb).
-- Safety: hanya menambah satu kolom nullable beserta indeksnya. Nol perubahan
--         pada data yang sudah ada, nol backfill. Pendaftaran lama tetap sah
--         dengan wilayah kosong.
--
-- Kenapa teks bebas dan bukan tabel wilayah tersendiri:
--
-- Daftar wilayah penerimaan ditetapkan pemerintah DAERAH, berbeda di tiap
-- kabupaten, dan bisa berubah tiap tahun ajaran. Pembeli mengisinya sendiri di
-- Konten → Informasi Pendaftaran (`ppdb_content.wilayah`), sama seperti daftar
-- jalur dan berkas. Tabel referensi dengan kunci asing akan memaksa pembeli
-- mengelola data master untuk sesuatu yang mereka ubah sekali setahun, dan akan
-- menolak pendaftaran lama ketika wilayahnya dihapus dari daftar.
--
-- Nama wilayahnya disimpan APA ADANYA seperti saat pendaftar memilihnya. Sama
-- alasannya dengan `jalur_label`: bila pembeli mengganti nama atau menghapus
-- wilayah, pendaftaran tahun lalu tidak boleh berubah artinya.

alter table public.pendaftaran_ppdb
  add column if not exists wilayah text;

comment on column public.pendaftaran_ppdb.wilayah is
  'Wilayah domisili yang dipilih pendaftar, disimpan sebagai teks apa adanya. NULL bila sekolah tidak memakai daftar wilayah.';

-- Panel menyaring pendaftar per wilayah untuk memverifikasi jalur Domisili.
-- Parsial: mayoritas baris pada sekolah yang tidak memakainya tetap NULL.
create index if not exists pendaftaran_ppdb_wilayah_idx
  on public.pendaftaran_ppdb (tahun_ajaran, wilayah)
  where wilayah is not null;
