-- Logical migration: 0049_santri_school_identity
-- Purpose: add the identity and cohort fields a state school actually needs.
-- Dependencies: 20260806000300_santri_parent_details.sql.
-- Safety: nullable columns, no backfill, no data loss, no column drops.
--
-- The student record still identifies pupils by nomor_induk_qiroati, which is a
-- TPQ artifact. A state school is required to carry NISN (the national student
-- number used by Dapodik) and a locally issued NIS. Both are needed for
-- transfers, exam registration, and district reporting; neither had a home.
--
-- angkatan replaces tanggal_pendaftaran for day-to-day administration. The
-- exact enrolment date is rarely used, but the intake year ("2024/2025") drives
-- cohort recaps, graduation projections, and alumni records. tanggal_pendaftaran
-- is deliberately left in place so historical rows keep their data.
--
-- NISN is unique when present: two pupils may not share a national number, but
-- rows without one must stay insertable, so the constraint is a partial index
-- rather than a plain unique constraint.

alter table public.santri
  add column if not exists nisn text,
  add column if not exists nis text,
  add column if not exists angkatan text;

create unique index if not exists santri_nisn_unique_idx
  on public.santri (nisn)
  where nisn is not null and btrim(nisn) <> '';

create unique index if not exists santri_nis_unique_idx
  on public.santri (nis)
  where nis is not null and btrim(nis) <> '';

alter table public.santri
  drop constraint if exists santri_nisn_format_chk;

alter table public.santri
  add constraint santri_nisn_format_chk
  check (nisn is null or nisn ~ '^[0-9]{10}$');

alter table public.santri
  drop constraint if exists santri_angkatan_format_chk;

alter table public.santri
  add constraint santri_angkatan_format_chk
  check (angkatan is null or angkatan ~ '^[0-9]{4}/[0-9]{4}$');
