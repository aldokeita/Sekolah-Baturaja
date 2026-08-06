-- Logical migration: 0047_classes_kapasitas
-- Purpose: store per-class seat capacity instead of hardcoding it in the UI.
-- Dependencies: 20260624000400_classes_memberships_and_mutations.sql.
-- Safety: nullable column, no backfill, no data loss.
--
-- The TV display previously rendered a fixed "/15" quota for every class.
-- Capacity is a property of the room and the teacher, not a global constant,
-- so it belongs on the row. Left nullable on purpose: an unset capacity means
-- "no limit declared" and the UI falls back to showing the headcount alone
-- rather than inventing a denominator.

alter table public.classes
  add column if not exists kapasitas integer;

alter table public.classes
  drop constraint if exists classes_kapasitas_positive;

alter table public.classes
  add constraint classes_kapasitas_positive
  check (kapasitas is null or kapasitas > 0);
