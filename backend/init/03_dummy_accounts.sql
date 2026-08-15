-- 03_dummy_accounts.sql — demo login accounts, one per role.
-- Runs after 02_auth_columns.sql on a fresh database; safe to re-run by hand
-- against an existing one (every statement is idempotent).
--
-- Login rules enforced by the Go backend (internal/handler/auth.go):
--   staff  -> guru.email + guru.password, needs guru.status='active'
--             AND a matching user_profiles row with status='active'
--   santri -> santri.nomor_induk (or nama_panggilan) + santri.password,
--             needs santri.status='Aktif'
--
-- Passwords are hashed with pgcrypto bcrypt ($2a$, cost 12), which is what
-- golang.org/x/crypto/bcrypt verifies against.
--
-- NOTE ON ADMIN: migration 20260722000100 once added two constraints that
-- locked the admin down —
--   user_profiles_admin_email_check  (an admin's email had to match one value)
--   user_profiles_single_admin_idx   (only one admin row may exist)
-- but 20260723000200_enable_guru_admin_roles.sql DROPPED BOTH. Neither exists
-- today, so nothing constrains the admin email at the database level.
--
-- The bootstrap admin from 02_auth_columns.sql is still reused as-is rather than
-- creating a second one, simply to keep one well-known account. Its address moved
-- to admin@sdnbaturaja.sch.id in 20260806000600 so it matches the other staff.

-- ── Precondition ─────────────────────────────────────────────────────────────
-- 'tata_usaha' is added to app_role by migration 20260805000100. Fail with a
-- readable message instead of a bare enum error if that migration is missing.
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'app_role' and e.enumlabel = 'tata_usaha'
  ) then
    raise exception 'app_role is missing the tata_usaha value. Apply supabase/migrations/20260805000100_add_tata_usaha_role.sql first.';
  end if;
end $$;

-- ── Staff accounts (guru + user_profiles) ────────────────────────────────────
do $$
declare
  r record;
  hashed text;
begin
  for r in
    select * from (values
      -- id, email, password, display name, jabatan, roles[], app_role
      ('a1fa7a10-0000-0000-0000-000000000011'::uuid, 'tatausaha@sdnbaturaja.sch.id', 'tatausaha123',
       'Lestari Ningsih, A.Md.', 'Tata Usaha',           array['Tata Usaha'],  'tata_usaha'),
      ('a1fa7a10-0000-0000-0000-000000000012'::uuid, 'guru@sdnbaturaja.sch.id',      'guru123',
       'Siti Aminah, S.Pd.SD',   'Guru Kelas I',         array['Pengajar'],    'guru'),
      ('a1fa7a10-0000-0000-0000-000000000013'::uuid, 'pentashih@sdnbaturaja.sch.id', 'pentashih123',
       'Ratna Dewi, S.Pd.SD',    'Pentashih',            array['Pentashih'],   'pentashih')
    ) as t(id, email, pw, nama, jabatan, roles, app_role)
  loop
    hashed := extensions.crypt(r.pw, extensions.gen_salt('bf', 12));

    insert into auth.users (id, email)
    values (r.id, r.email)
    on conflict (id) do update set email = excluded.email;

    insert into public.guru (id, nama, email, jabatan, status, roles, password)
    values (r.id, r.nama, r.email, r.jabatan, 'active', r.roles, hashed)
    on conflict (id) do update set
      nama     = excluded.nama,
      email    = excluded.email,
      jabatan  = excluded.jabatan,
      status   = 'active',
      roles    = excluded.roles,
      password = excluded.password;

    insert into public.user_profiles (id, role, display_name, email, status)
    values (r.id, r.app_role::public.app_role, r.nama, r.email, 'active')
    on conflict (id) do update set
      role         = excluded.role,
      display_name = excluded.display_name,
      email        = excluded.email,
      status       = 'active';
  end loop;
end $$;

-- ── Superadmin (pemilik/penjual template) ────────────────────────────────────
-- Akun ini SENGAJA ikut terkirim ke pembeli: hanya peran `superadmin` yang boleh
-- mengubah identitas produk (nama sekolah, logo, aksen warna), jadi penjual harus
-- tetap punya jalan masuk pada setiap salinan yang terjual.
--
-- Bedanya dengan akun dummy di atas: yang tersimpan di sini HANYA hash bcrypt,
-- bukan sandi mentahnya. Tidak ada tempat di repo ini yang memuat sandi aslinya,
-- jadi pembeli yang membaca seluruh kode pun tidak bisa memakai akun ini.
-- Backend juga menyembunyikan baris superadmin dari pemakai non-superadmin
-- (lihat internal/handler/guru.go), sehingga akun ini tidak muncul di panel admin
-- maupun di direktori guru pada situs publik.
--
-- Mengganti sandinya (jalankan dari mesin penjual, jangan simpan hasilnya di git):
--   update public.guru set password = extensions.crypt('<sandi baru>', extensions.gen_salt('bf', 12))
--   where id = 'a1fa7a10-0000-0000-0000-000000000020';
--
-- Id memakai blok 0020, BUKAN 0014: id 0014 sudah dipakai akun murid Naila di
-- bawah, dan menabraknya menimpa profil murid tersebut.
do $$
declare
  sid    uuid := 'a1fa7a10-0000-0000-0000-000000000020';
  hashed text := '$2a$12$lO/l9bv7.aYjsBV/TXPALuv4WzCYxm.m.ElmrXA37K9PD4nsPuaba';
begin
  insert into auth.users (id, email)
  values (sid, 'superadmin@sekolahbta.id')
  on conflict (id) do update set email = excluded.email;

  insert into public.guru (id, nama, email, jabatan, status, roles, password)
  values (sid, 'Pemilik Template', 'superadmin@sekolahbta.id', 'Superadmin',
          'active', array['Admin'], hashed)
  on conflict (id) do update set
    nama     = excluded.nama,
    email    = excluded.email,
    jabatan  = excluded.jabatan,
    status   = 'active',
    roles    = excluded.roles,
    password = excluded.password;

  insert into public.user_profiles (id, role, display_name, email, status)
  values (sid, 'superadmin'::public.app_role, 'Pemilik Template',
          'superadmin@sekolahbta.id', 'active')
  on conflict (id) do update set
    role         = excluded.role,
    display_name = excluded.display_name,
    email        = excluded.email,
    status       = 'active';
end $$;

-- ── Student account (santri + user_profiles) ─────────────────────────────────
-- Logs in with the student number, matching the "Nomor induk murid" field on
-- the login screen.
do $$
declare
  sid uuid := 'a1fa7a10-0000-0000-0000-000000000014';
  hashed text := extensions.crypt('santri123', extensions.gen_salt('bf', 12));
begin
  insert into auth.users (id, email)
  values (sid, 'murid@sdnbaturaja.sch.id')
  on conflict (id) do update set email = excluded.email;

  insert into public.santri (id, nomor_induk, nama_lengkap, nama_panggilan,
                             kategori, jenis_kelamin, status, password)
  values (sid, '2026041', 'Naila Rahmadani', 'Naila', 'Anak', 'Perempuan', 'Aktif', hashed)
  on conflict (id) do update set
    nomor_induk = excluded.nomor_induk,
    nama_lengkap        = excluded.nama_lengkap,
    nama_panggilan      = excluded.nama_panggilan,
    status              = 'Aktif',
    password            = excluded.password;

  insert into public.user_profiles (id, role, display_name, email, status)
  values (sid, 'santri'::public.app_role, 'Naila Rahmadani', 'murid@sdnbaturaja.sch.id', 'active')
  on conflict (id) do update set
    role         = excluded.role,
    display_name = excluded.display_name,
    status       = 'active';
end $$;

-- ── Report ───────────────────────────────────────────────────────────────────
do $$
declare n int;
begin
  select count(*) into n from public.user_profiles where status = 'active';
  raise notice 'dummy accounts ready; active profiles: %', n;
end $$;
