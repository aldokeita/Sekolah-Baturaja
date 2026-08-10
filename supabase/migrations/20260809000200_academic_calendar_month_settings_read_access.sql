-- Allow every authenticated dashboard role to read the calendar policy.
-- Attendance recap and report views use this policy, while write policies
-- remain restricted to admin, superadmin, and tata_usaha.

drop policy if exists academic_calendar_month_settings_staff_select
  on public.academic_calendar_month_settings;

create policy academic_calendar_month_settings_authenticated_select
  on public.academic_calendar_month_settings
  for select to authenticated
  using (auth.uid() is not null);
