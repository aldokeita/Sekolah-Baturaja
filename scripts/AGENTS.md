# AGENTS.md — scripts/

29 script operasional untuk deployment, testing, validasi, dan migrasi data. Campuran PowerShell (`.ps1`) dan Node.js (`.mjs`).

## Kategori

### Migrasi & Deployment Production
| Script | Bahasa | Fungsi |
|--------|--------|--------|
| `prepare-production-migration.mjs` | Node | Siapkan paket migrasi data dari staging |
| `promote-staging-production-data.mjs` | Node | Import data ke production Supabase |
| `apply-production-login-policy.mjs` | Node | Set password awal per role di production |
| `upload-migrated-assets-local.mjs` | Node | Upload asset migrasi ke Storage lokal |
| `import-production-migration-local.mjs` | Node | Import data migrasi ke Supabase lokal |
| `run-production-data-promotion.ps1` | PS | Runner untuk promote-staging |
| `run-production-login-policy.ps1` | PS | Runner untuk login policy |
| `run-production-migration-rehearsal.ps1` | PS | Rehearsal migrasi production |
| `run-migrated-assets-local.ps1` | PS | Runner upload asset lokal |
| `check-production-guard.ps1` | PS | Guard: cegah aksi production tanpa konfirmasi |

### Staging & Cleanup
| Script | Bahasa | Fungsi |
|--------|--------|--------|
| `clear-staging-application-data.mjs` | Node | Hapus semua data staging (tabel + auth + storage) |
| `run-staging-cleanup.ps1` | PS | Runner untuk staging cleanup |
| `bootstrap-dummy-auth-users.ps1` | PS | Seed dummy users untuk testing |
| `bootstrap-staging-test-data.ps1` | PS | Seed test data ke staging |

### Testing
| Script | Bahasa | Fungsi |
|--------|--------|--------|
| `test-admin-role-boundary.mjs` | Node | Test batas akses role admin |
| `test-atomic-guru-account-update.mjs` | Node | Test atomic update akun guru |
| `test-attendance-first-record.mjs` | Node | Test record absensi pertama |
| `test-payment-history-pagination.mjs` | Node | Test paginasi riwayat pembayaran |
| `test-random-name-points.mjs` | Node | Test fitur random name + poin |
| `test-default-spp-hafalan.ps1` | PS | Test default SPP hafalan |
| `test-frontend-staging-bugfixes.ps1` | PS | Test bugfix frontend di staging |
| `run-local-backend-tests.ps1` | PS | Jalankan test backend lokal |
| `run-local-runtime-smoke-tests.ps1` | PS | Smoke test runtime lokal |
| `run-staging-e2e-tests.ps1` | PS | E2E test di staging |

### Validasi
| Script | Bahasa | Fungsi |
|--------|--------|--------|
| `validate-migration-order.ps1` | PS | Verifikasi urutan migration SQL |
| `validate-no-legacy-class-column.ps1` | PS | Cek tidak ada kolom class lama |
| `validate-no-secrets.ps1` | PS | Scan secret/credential di codebase |
| `validate-production-migration-local.ps1` | PS | Validasi migrasi production lokal |
| `validate-seed-dummy-only.ps1` | PS | Pastikan seed hanya dummy data |

## Konvensi

- Script `.mjs` (Node): operasi data kompleks, API calls, migrasi
- Script `.ps1` (PowerShell): runner/wrapper, validasi, CI checks
- Semua script baca env vars — tidak ada credential hardcoded
- Script production memerlukan konfirmasi eksplisit (env var `*_CONFIRMATION`)
- Dry-run default: script tidak mengubah data kecuali `*_EXECUTE=true`

## Anti-pattern

- JANGAN jalankan script production tanpa konfirmasi dan guard check
- JANGAN commit credential atau secret ke script
- JANGAN edit script migrasi yang sudah berhasil dijalankan di production
- JANGAN jalankan `clear-staging-*` terhadap production
