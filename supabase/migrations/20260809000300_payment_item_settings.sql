-- Logical migration: fixed non-SPP payment item nominal settings.
-- Purpose: store one independent nominal for each supported fixed payment item.
-- Safety: additive table only; existing payments and their jumlah are untouched.

create table public.payment_item_settings (
  item_key text primary key,
  nominal numeric(12,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint payment_item_settings_key_check check (
    item_key in (
      'sarpras',
      'seragam',
      'tas_murid',
      'id_card_murid',
      'buku_paket',
      'lks'
    )
  ),
  constraint payment_item_settings_nominal_check check (nominal > 0)
);

create trigger set_payment_item_settings_updated_at
  before update on public.payment_item_settings
  for each row execute function public.set_updated_at();

alter table public.payment_item_settings enable row level security;

revoke all on public.payment_item_settings from anon;
grant select, insert, update, delete on public.payment_item_settings to authenticated;
grant select, insert, update, delete on public.payment_item_settings to service_role;

create policy payment_item_settings_staff_select
  on public.payment_item_settings
  for select to authenticated
  using (
    public.current_user_role() in (
      'admin'::public.app_role,
      'superadmin'::public.app_role,
      'tata_usaha'::public.app_role
    )
  );

create policy payment_item_settings_staff_insert
  on public.payment_item_settings
  for insert to authenticated
  with check (
    public.current_user_role() in (
      'admin'::public.app_role,
      'superadmin'::public.app_role,
      'tata_usaha'::public.app_role
    )
  );

create policy payment_item_settings_staff_update
  on public.payment_item_settings
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

create policy payment_item_settings_staff_delete
  on public.payment_item_settings
  for delete to authenticated
  using (
    public.current_user_role() in (
      'admin'::public.app_role,
      'superadmin'::public.app_role,
      'tata_usaha'::public.app_role
    )
  );
