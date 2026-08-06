-- Logical migration: add 'tata_usaha' to app_role enum
-- Purpose: introduce the Tata Usaha (administrative staff) dashboard role.
--   Tata Usaha mirrors admin for operational modules (data santri, kelas,
--   rekap absensi, MMQ, kalender, pembayaran/pengeluaran, konten, TV/media)
--   but NOT the admin-only areas (account/role provisioning, login logs,
--   backup & restore, bisyaroh/salary). Enforcement lives in the Go backend
--   (see internal/middleware/auth.go CanManage + per-handler role checks).
-- Dependencies: 0001_extensions_and_types (defines public.app_role).
-- Safety: additive enum value only; no data changes, no destructive ops.

-- ADD VALUE runs in autocommit here (applied file-by-file via psql), so the new
-- label is committed and usable by subsequent migrations/inserts.
alter type public.app_role add value if not exists 'tata_usaha';
