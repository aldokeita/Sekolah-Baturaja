-- Logical migration: 0055_ppdb_terima_jadi_murid
-- Purpose: menautkan pendaftaran PPDB yang diterima ke baris murid yang dibuat
--          darinya, supaya penerimaan tidak perlu disalin ulang dengan tangan dan
--          tidak bisa dikerjakan dua kali.
-- Dependencies: 20260807000100_pendaftaran_ppdb.sql (pendaftaran_ppdb),
--               20260624000300_guru_santri_and_auth_aliases.sql (santri).
-- Safety: hanya menambah satu kolom nullable beserta indeksnya. Nol perubahan
--         pada data yang sudah ada, nol backfill.

-- Tautan ke murid yang dibuat dari pendaftaran ini.
--
-- Kenapa kolom dan bukan disimpulkan dari kesamaan nama: nama boleh sama antar
-- anak, dan tata usaha boleh memperbaiki ejaan nama murid setelah dicatat. Tautan
-- eksplisit adalah satu-satunya cara mengetahui "pendaftaran ini sudah jadi murid"
-- dengan pasti — dan itu yang mencegah satu anak tercatat dua kali.
--
-- `on delete set null`, bukan cascade: menonaktifkan atau menghapus baris murid
-- tidak boleh menghapus riwayat pendaftarannya.
alter table public.pendaftaran_ppdb
  add column if not exists santri_id uuid references public.santri (id) on delete set null;

comment on column public.pendaftaran_ppdb.santri_id is
  'Murid yang dibuat dari pendaftaran ini. NULL berarti belum dicatat sebagai murid.';

-- Satu pendaftaran hanya boleh menghasilkan satu murid, dan satu murid hanya boleh
-- berasal dari satu pendaftaran. Parsial karena mayoritas baris masih NULL.
create unique index if not exists pendaftaran_ppdb_santri_unik
  on public.pendaftaran_ppdb (santri_id)
  where santri_id is not null;

-- Panel menyaring "diterima tapi belum jadi murid" — daftar kerja tata usaha.
create index if not exists pendaftaran_ppdb_belum_murid_idx
  on public.pendaftaran_ppdb (tahun_ajaran, status)
  where santri_id is null;
