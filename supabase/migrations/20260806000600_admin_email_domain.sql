-- Logical migration: 0052_admin_email_domain
-- Purpose: pindahkan email login admin dari domain lembaga lama ke domain sekolah.
-- Dependencies: 20260723000200_enable_guru_admin_roles.sql.
-- Safety: hanya memperbarui satu baris admin di tiga tabel. Idempoten, dan
--         tidak melakukan apa pun bila email tujuan sudah dipakai.
--
-- admin@lpqalfathmaulana.id adalah sisa identitas lembaga sumber. Tiga akun staf
-- lain sudah memakai @sdnbaturaja.sch.id, jadi admin dibuat konsisten.
--
-- CATATAN: constraint user_profiles_admin_email_check dan index
-- user_profiles_single_admin_idx yang dulu mengunci domain ini SUDAH DIHAPUS
-- oleh 20260723000200_enable_guru_admin_roles.sql. Tidak ada constraint yang
-- perlu diubah di sini - murni perpindahan data.

do $$
declare
  lama  constant text := 'admin@lpqalfathmaulana.id';
  baru  constant text := 'admin@sdnbaturaja.sch.id';
  admin_id uuid;
begin
  -- Berhenti diam-diam bila email tujuan sudah terpakai akun lain: menimpanya
  -- akan mengunci dua orang keluar sekaligus.
  if exists (select 1 from auth.users where lower(email) = baru) then
    raise notice 'Email % sudah dipakai, migrasi dilewati.', baru;
    return;
  end if;

  select id into admin_id from auth.users where lower(email) = lama;
  if admin_id is null then
    raise notice 'Akun % tidak ditemukan, migrasi dilewati.', lama;
    return;
  end if;

  update auth.users     set email = baru where id = admin_id;
  update user_profiles  set email = baru where id = admin_id;
  update guru           set email = baru where id = admin_id;

  raise notice 'Email admin dipindahkan dari % ke %.', lama, baru;
end $$;
