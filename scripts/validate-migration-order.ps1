$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$migrationDir = Join-Path $root "supabase/migrations"

if (!(Test-Path $migrationDir)) {
  Write-Error "Migration directory not found."
  exit 1
}

$files = Get-ChildItem $migrationDir -File -Filter "*.sql" | Sort-Object Name
# Migrasi PALING AWAL, yang urutannya memang menentukan: skema dasar dibangun di
# sini dan berkas sesudahnya bergantung padanya. Deretan ini dipatok.
#
# Sebelumnya berkas ini memaku SELURUH daftar migrasi, satu per satu. Akibatnya
# ia gagal setiap kali ada migrasi baru — dan sejak pertengahan Agustus 2026 ia
# memang selalu gagal, mengharapkan 61 berkas sementara repositori punya 85.
# Penjaga yang selalu merah bukan penjaga: tidak ada yang membacanya lagi.
#
# Yang diperiksa sekarang: fondasinya utuh dan berurutan, seluruh nama mengikuti
# pola cap waktu, tidak ada berkas seed, urutannya menaik, dan tidak ada cap
# waktu ganda — dua migrasi bercap sama diterapkan dalam urutan yang tidak bisa
# ditebak, dan itu justru kerusakan yang berkas ini ada untuk mencegah.
$fondasi = @(
  "20260624000100_extensions_and_types.sql",
  "20260624000200_user_profiles_and_roles.sql",
  "20260624000300_guru_santri_and_auth_aliases.sql",
  "20260624000400_classes_memberships_and_mutations.sql",
  "20260624000500_class_assignments.sql",
  "20260624000600_attendance.sql",
  "20260624000700_payments_expenses_and_payment_status.sql",
  "20260624000800_hafalan_and_murojaah.sql",
  "20260624000900_academic_calendar.sql",
  "20260624001000_mmq_core.sql"
)
$actualNames = $files | ForEach-Object { $_.Name }

if ($actualNames.Count -lt $fondasi.Count) {
  Write-Error "Expected at least $($fondasi.Count) foundation migrations, found $($actualNames.Count)."
  exit 1
}

for ($i = 0; $i -lt $fondasi.Count; $i++) {
  if ($actualNames[$i] -ne $fondasi[$i]) {
    Write-Error "Foundation migration order/name mismatch at index $i. Expected $($fondasi[$i]), got $($actualNames[$i])."
    exit 1
  }
}

# Urutan menaik dan cap waktu yang tidak kembar. Dua migrasi bercap waktu sama
# diterapkan dalam urutan yang tidak bisa ditebak — dan itu kerusakan yang
# berkas ini ada untuk mencegah.
$capTerlihat = @{}
$sebelumnya = ""
foreach ($nama in $actualNames) {
  $cap = $nama.Substring(0, 14)
  if ($capTerlihat.ContainsKey($cap)) {
    Write-Error "Duplicate migration timestamp ${cap}: $($capTerlihat[$cap]) and $nama."
    exit 1
  }
  $capTerlihat[$cap] = $nama
  if ($nama -lt $sebelumnya) {
    Write-Error "Migrations are not in ascending order: $nama comes after $sebelumnya."
    exit 1
  }
  $sebelumnya = $nama
}

foreach ($file in $files) {
  if ($file.Name -notmatch "^\d{14}_[a-z0-9_]+\.sql$") {
    Write-Error "Migration does not match Supabase timestamp pattern: $($file.Name)"
    exit 1
  }
  if ($file.Name -match "seed") {
    Write-Error "Seed-like migration is not allowed: $($file.Name)"
    exit 1
  }
}

$beforeMmq = $files | Where-Object { $_.Name -lt "20260624001000_mmq_core.sql" }
foreach ($file in $beforeMmq) {
  $content = Get-Content -Raw $file.FullName
  if ($content -match "mmq_schedule") {
    Write-Error "mmq_schedule referenced before MMQ core migration: $($file.Name)"
    exit 1
  }
}

Write-Host "Migration order and MMQ dependency checks passed."
exit 0
