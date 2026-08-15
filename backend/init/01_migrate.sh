#!/bin/bash
# 01_migrate.sh — runs all Supabase migrations in order, then seed.
# Executed by postgres entrypoint (docker-entrypoint-initdb.d) after 00_bootstrap.sql.
# NOTE: during initdb, Postgres listens on Unix socket only — no TCP yet.
# Use psql without -h flag so it connects via socket.
set -e

export PGOPTIONS='-c client_min_messages=warning'
PG="psql -v ON_ERROR_STOP=1 -U ${POSTGRES_USER} -d ${POSTGRES_DB}"

echo "[migrate] applying migrations..."
for f in $(ls /migrations/*.sql | sort); do
    echo "[migrate] $f"
    $PG -f "$f"
done

# Seed needs auth.users stubs first (FK target from user_profiles, guru, santri)
echo "[seed] inserting demo auth.users stubs..."
$PG <<'SQL'
insert into auth.users (id, email) values
  ('a1fa7a10-0000-0000-0000-000000000001', 'admin-demo@example.invalid'),
  ('a1fa7a10-0000-0000-0000-000000000002', 'guru-a-demo@example.invalid'),
  ('a1fa7a10-0000-0000-0000-000000000003', 'guru-b-demo@example.invalid'),
  ('a1fa7a10-0000-0000-0000-000000000004', 'wakasek-demo@example.invalid'),
  ('a1fa7a10-0000-0000-0000-000000000101', null),
  ('a1fa7a10-0000-0000-0000-000000000102', null),
  ('a1fa7a10-0000-0000-0000-000000000103', null),
  ('a1fa7a10-0000-0000-0000-000000000201', null),
  ('a1fa7a10-0000-0000-0000-000000000202', null),
  ('a1fa7a10-0000-0000-0000-000000000301', null),
  ('a1fa7a10-0000-0000-0000-000000000302', null),
  ('a1fa7a10-0000-0000-0000-000000000303', null)
on conflict (id) do nothing;
SQL

echo "[seed] applying seed.sql..."
$PG -f /seed.sql

echo "[init] done."
