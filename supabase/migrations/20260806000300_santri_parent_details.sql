-- Logical migration: 0048_santri_parent_details
-- Purpose: record parent occupation and a separate parent address.
-- Dependencies: 20260624002100_santri_legacy_fields_and_media_player.sql.
-- Safety: nullable columns, no backfill, no data loss.
--
-- The public admission form already asks for the guardian's occupation
-- (see FIELD_KEYS in src/pages/PpdbPage.jsx), but there was nowhere to store
-- it, so the answer was flattened into a free-text feedback row and lost.
--
-- alamat_ortu is separate from santri.alamat: a student may live with a
-- relative or in a boarding arrangement while correspondence has to reach the
-- parents elsewhere. Null means "same as the student's address" and the UI
-- falls back accordingly, so existing rows need no backfill.

alter table public.santri
  add column if not exists pekerjaan_ayah text,
  add column if not exists pekerjaan_ibu text,
  add column if not exists alamat_ortu text;
