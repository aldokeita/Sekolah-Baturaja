-- Bootstrap: Supabase compatibility stubs for plain Postgres.
-- Run this ONCE before applying migrations.
-- Provides auth schema, auth.users table, and auth.* function stubs so that
-- migration FK references and stored procs compile cleanly.
-- RLS policies are kept in migrations but never enforced — Go handles authz.

-- Extensions
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
-- make gen_random_uuid() available in public scope
create or replace function gen_random_uuid() returns uuid language sql as
  $$ select extensions.gen_random_uuid() $$;

-- Supabase role stubs (migrations GRANT/REVOKE these; plain Postgres doesn't have them)
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end $$;

-- Storage schema stub (Supabase Storage replacement — we use local disk)
-- Migrations reference storage.buckets and storage.objects; stub them so
-- migrations run cleanly. These tables are never used by the Go backend.
create schema if not exists storage;

create table if not exists storage.buckets (
    id                  text primary key,
    name                text not null,
    public              boolean default false,
    file_size_limit     bigint,
    allowed_mime_types  text[]
);

create table if not exists storage.objects (
    id                  uuid primary key default extensions.gen_random_uuid(),
    bucket_id           text references storage.buckets(id),
    name                text,
    owner               uuid,
    created_at          timestamptz default now(),
    updated_at          timestamptz default now(),
    last_accessed_at    timestamptz,
    metadata            jsonb
);

-- Auth schema stub
create schema if not exists auth;

create table if not exists auth.users (
    id          uuid primary key default extensions.gen_random_uuid(),
    email       text,
    created_at  timestamptz default now()
);

-- auth.uid() — returns null in Go-backend context (JWT user id comes from middleware)
create or replace function auth.uid() returns uuid language sql stable as
  $$ select null::uuid $$;

-- auth.jwt() — returns empty jsonb
create or replace function auth.jwt() returns jsonb language sql stable as
  $$ select '{}'::jsonb $$;

-- auth.role() — returns empty string (not 'service_role' or 'authenticated')
create or replace function auth.role() returns text language sql stable as
  $$ select ''::text $$;

-- get_user_role — used in RLS policies; stub returns null (policies inactive)
create or replace function public.get_user_role(user_id uuid) returns text language sql stable as
  $$ select null::text $$;

-- Disable RLS enforcement globally so Go middleware handles all authz.
-- Individual table RLS is still defined by migrations (for documentation),
-- but never enforced at DB level.
set row_security = off;
