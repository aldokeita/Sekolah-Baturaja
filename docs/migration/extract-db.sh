#!/usr/bin/env bash
# Ekstrak skema + data dari Supabase untuk migrasi ke Postgres mandiri.
# Jalankan dari root repo: bash docs/migration/extract-db.sh
#
# Cara dapat DB_URL:
#   Supabase Dashboard → Settings → Database → Connection string → URI
#   Format: postgresql://postgres:[DB_PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
#
# Atau pakai Direct connection (port 5432, bukan pooler 6543) untuk pg_dump.

set -euo pipefail

DB_URL="${SUPABASE_DB_URL:-}"
OUT_DIR="docs/migration/db-export"

if [[ -z "$DB_URL" ]]; then
  echo "ERROR: Set SUPABASE_DB_URL terlebih dahulu."
  echo "  export SUPABASE_DB_URL='postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres'"
  exit 1
fi

mkdir -p "$OUT_DIR"

echo "→ Ekstrak skema..."
pg_dump "$DB_URL" \
  --schema-only \
  --no-owner \
  --no-acl \
  --schema=public \
  -f "$OUT_DIR/schema.sql"

echo "→ Ekstrak data (tanpa tabel auth Supabase)..."
pg_dump "$DB_URL" \
  --data-only \
  --no-owner \
  --no-acl \
  --schema=public \
  --exclude-table=schema_migrations \
  -f "$OUT_DIR/data.sql"

echo "→ Selesai. File tersimpan di $OUT_DIR/"
echo "   schema.sql — DDL semua tabel public"
echo "   data.sql   — INSERT semua data"
echo ""
echo "Langkah berikutnya:"
echo "  1. Review schema.sql — hapus Supabase-specific extensions jika ada (pg_graphql, supabase_vault, dll)"
echo "  2. Hapus RLS policies dari schema.sql (sudah terdokumentasi di authz-spec.md)"
echo "  3. psql ke Postgres baru: psql \$NEW_DB_URL -f schema.sql && psql \$NEW_DB_URL -f data.sql"
