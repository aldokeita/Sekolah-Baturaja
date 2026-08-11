-- Logical migration: 0046_academic_calendar_multi_event
-- Purpose: allow more than one agenda entry per calendar date.
-- Dependencies: 20260624000900_academic_calendar.sql.
-- Safety: no credentials, no seed data, no data loss (constraint drop only).
--
-- The original table declared `date date not null unique`, which limited the
-- calendar to a single event per day. That is fine for a holiday flag but too
-- narrow for an internal agenda (a school routinely runs two or three
-- activities on the same date). Dropping the unique constraint keeps every
-- existing row untouched; the replacement index preserves lookup speed for the
-- date-range queries in attendance.go.

alter table public.academic_calendar
  drop constraint if exists academic_calendar_date_key;

create index if not exists academic_calendar_date_idx
  on public.academic_calendar(date);
