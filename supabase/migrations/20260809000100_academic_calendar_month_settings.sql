-- Logical migration: academic calendar month settings
-- Purpose: store the per-month Saturday school-day policy.
-- Dependencies: 20260624000200_user_profiles_and_roles.sql,
--               20260624001400_audit_triggers_and_updated_at.sql,
--               20260624001500_rls_helper_functions.sql.
-- Safety: additive table only; no existing academic-calendar rows are changed.

create table if not exists public.academic_calendar_month_settings (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  month smallint not null,
  saturday_is_holiday boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint academic_calendar_month_settings_year_check
    check (year between 1 and 9999),
  constraint academic_calendar_month_settings_month_check
    check (month between 1 and 12),
  constraint academic_calendar_month_settings_year_month_key
    unique (year, month)
);

drop trigger if exists set_academic_calendar_month_settings_updated_at
  on public.academic_calendar_month_settings;
create trigger set_academic_calendar_month_settings_updated_at
  before update on public.academic_calendar_month_settings
  for each row execute function public.set_updated_at();

alter table public.academic_calendar_month_settings enable row level security;

grant select, insert, update, delete
  on public.academic_calendar_month_settings
  to authenticated;
grant select, insert, update, delete
  on public.academic_calendar_month_settings
  to service_role;

create policy academic_calendar_month_settings_staff_select
  on public.academic_calendar_month_settings
  for select to authenticated
  using (
    public.current_user_role() in (
      'admin'::public.app_role,
      'superadmin'::public.app_role,
      'tata_usaha'::public.app_role
    )
  );

create policy academic_calendar_month_settings_staff_insert
  on public.academic_calendar_month_settings
  for insert to authenticated
  with check (
    public.current_user_role() in (
      'admin'::public.app_role,
      'superadmin'::public.app_role,
      'tata_usaha'::public.app_role
    )
  );

create policy academic_calendar_month_settings_staff_update
  on public.academic_calendar_month_settings
  for update to authenticated
  using (
    public.current_user_role() in (
      'admin'::public.app_role,
      'superadmin'::public.app_role,
      'tata_usaha'::public.app_role
    )
  )
  with check (
    public.current_user_role() in (
      'admin'::public.app_role,
      'superadmin'::public.app_role,
      'tata_usaha'::public.app_role
    )
  );

create policy academic_calendar_month_settings_staff_delete
  on public.academic_calendar_month_settings
  for delete to authenticated
  using (
    public.current_user_role() in (
      'admin'::public.app_role,
      'superadmin'::public.app_role,
      'tata_usaha'::public.app_role
    )
  );
