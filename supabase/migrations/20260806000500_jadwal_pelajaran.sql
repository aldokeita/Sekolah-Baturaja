-- Logical migration: 0051_jadwal_pelajaran
-- Purpose: jadwal pelajaran tetap per periode untuk sekolah dasar umum.
-- Dependencies: 20260624000400_classes_memberships_and_mutations.sql (classes),
--               20260805000100_add_tata_usaha_role.sql (app_role).
-- Safety: hanya menambah tabel baru. Nol perubahan pada tabel yang sudah ada,
--         nol backfill, nol penghapusan data.
--
-- Tiga tabel baru:
--   periode_ajaran    - tahun ajaran + semester, wadah bagi jadwal
--   mata_pelajaran    - daftar mapel yang dikelola admin
--   jadwal_pelajaran  - satu baris = satu slot (kelas x hari x jam)
--
-- CATATAN tentang absensi: absensi murid TIDAK diubah migrasi ini. Tabel
-- attendance sudah harian - index attendance_santri_first_daily_unique
-- (user_id, attendance_date) sudah menjamin satu catatan per murid per hari.
-- Jadwal pelajaran di sini untuk perencanaan dan tampilan, bukan untuk absen
-- per mata pelajaran. Kolom sesi lama sengaja dibiarkan utuh supaya data
-- historis di staging/produksi tidak hilang.
--
-- CATATAN tentang bentrok jadwal: pencegahan tumpang tindih jam dilakukan di
-- handler Go, bukan lewat exclusion constraint. Postgres tidak punya range type
-- bawaan untuk `time`, jadi constraint-nya menuntut type kustom. Untuk jadwal
-- sekolah yang disunting satu admin, pemeriksaan di Go sudah memadai. Yang
-- dijaga database hanya keabsahan baris dan duplikat persis.

create table if not exists public.periode_ajaran (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  tahun_ajaran text not null,
  semester text not null,
  tanggal_mulai date,
  tanggal_selesai date,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

alter table public.periode_ajaran
  drop constraint if exists periode_ajaran_semester_chk;
alter table public.periode_ajaran
  add constraint periode_ajaran_semester_chk
  check (semester in ('Ganjil', 'Genap'));

alter table public.periode_ajaran
  drop constraint if exists periode_ajaran_tahun_format_chk;
alter table public.periode_ajaran
  add constraint periode_ajaran_tahun_format_chk
  check (tahun_ajaran ~ '^\d{4}/\d{4}$');

alter table public.periode_ajaran
  drop constraint if exists periode_ajaran_rentang_chk;
alter table public.periode_ajaran
  add constraint periode_ajaran_rentang_chk
  check (tanggal_mulai is null or tanggal_selesai is null or tanggal_selesai >= tanggal_mulai);

create unique index if not exists periode_ajaran_unik
  on public.periode_ajaran (tahun_ajaran, semester);

-- Hanya satu periode yang boleh aktif, supaya UI tidak perlu menebak.
create unique index if not exists periode_ajaran_satu_aktif
  on public.periode_ajaran ((is_active)) where is_active;

create table if not exists public.mata_pelajaran (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  kode text,
  urutan integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

alter table public.mata_pelajaran
  drop constraint if exists mata_pelajaran_nama_not_blank;
alter table public.mata_pelajaran
  add constraint mata_pelajaran_nama_not_blank
  check (btrim(nama) <> '');

create unique index if not exists mata_pelajaran_nama_unik
  on public.mata_pelajaran (lower(btrim(nama)));

create table if not exists public.jadwal_pelajaran (
  id uuid primary key default gen_random_uuid(),
  periode_id uuid not null references public.periode_ajaran (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  mata_pelajaran_id uuid not null references public.mata_pelajaran (id) on delete restrict,
  guru_id uuid references public.guru (id) on delete set null,
  hari smallint not null,
  jam_mulai time not null,
  jam_selesai time not null,
  ruang text,
  catatan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

-- 1 = Senin sampai 6 = Sabtu. Minggu sengaja tidak diizinkan.
alter table public.jadwal_pelajaran
  drop constraint if exists jadwal_pelajaran_hari_chk;
alter table public.jadwal_pelajaran
  add constraint jadwal_pelajaran_hari_chk
  check (hari between 1 and 6);

alter table public.jadwal_pelajaran
  drop constraint if exists jadwal_pelajaran_jam_chk;
alter table public.jadwal_pelajaran
  add constraint jadwal_pelajaran_jam_chk
  check (jam_selesai > jam_mulai);

-- Duplikat persis ditolak database; tumpang tindih sebagian diperiksa di Go.
create unique index if not exists jadwal_pelajaran_slot_unik
  on public.jadwal_pelajaran (periode_id, class_id, hari, jam_mulai, jam_selesai, mata_pelajaran_id);

create index if not exists jadwal_pelajaran_periode_kelas_idx
  on public.jadwal_pelajaran (periode_id, class_id, hari);
create index if not exists jadwal_pelajaran_guru_idx
  on public.jadwal_pelajaran (guru_id, periode_id);

drop trigger if exists set_periode_ajaran_updated_at on public.periode_ajaran;
create trigger set_periode_ajaran_updated_at
  before update on public.periode_ajaran
  for each row execute function public.set_updated_at();

drop trigger if exists set_mata_pelajaran_updated_at on public.mata_pelajaran;
create trigger set_mata_pelajaran_updated_at
  before update on public.mata_pelajaran
  for each row execute function public.set_updated_at();

drop trigger if exists set_jadwal_pelajaran_updated_at on public.jadwal_pelajaran;
create trigger set_jadwal_pelajaran_updated_at
  before update on public.jadwal_pelajaran
  for each row execute function public.set_updated_at();

-- RLS dinyalakan mengikuti konvensi repo. Perlu diingat: gerbang yang benar-benar
-- menjaga request hidup ada di middleware Go (RequireAuth/RequireRole), karena
-- pool tersambung sebagai superuser. Policy di sini jaring pengaman, bukan
-- pertahanan utama.
alter table public.periode_ajaran enable row level security;
alter table public.mata_pelajaran enable row level security;
alter table public.jadwal_pelajaran enable row level security;

drop policy if exists periode_ajaran_read_all on public.periode_ajaran;
create policy periode_ajaran_read_all on public.periode_ajaran for select using (true);

drop policy if exists mata_pelajaran_read_all on public.mata_pelajaran;
create policy mata_pelajaran_read_all on public.mata_pelajaran for select using (true);

drop policy if exists jadwal_pelajaran_read_all on public.jadwal_pelajaran;
create policy jadwal_pelajaran_read_all on public.jadwal_pelajaran for select using (true);

-- Mata pelajaran bawaan kurikulum SD. Dipasang hanya bila tabel masih kosong,
-- supaya migrasi ulang tidak menimpa daftar yang sudah disunting sekolah.
insert into public.mata_pelajaran (nama, kode, urutan)
select * from (values
  ('Pendidikan Agama dan Budi Pekerti', 'PABP', 1),
  ('Pendidikan Pancasila', 'PPKN', 2),
  ('Bahasa Indonesia', 'BIND', 3),
  ('Matematika', 'MTK', 4),
  ('Ilmu Pengetahuan Alam dan Sosial', 'IPAS', 5),
  ('Seni Budaya dan Prakarya', 'SBDP', 6),
  ('Pendidikan Jasmani, Olahraga, dan Kesehatan', 'PJOK', 7),
  ('Bahasa Inggris', 'BING', 8),
  ('Muatan Lokal', 'MULOK', 9)
) as bawaan(nama, kode, urutan)
where not exists (select 1 from public.mata_pelajaran);
