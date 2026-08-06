$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$paths = @("supabase", "scripts", "docs") | ForEach-Object { Join-Path $root $_ } | Where-Object { Test-Path $_ }

$secretPatterns = @(
  "eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}",
  "sb_secret_[a-zA-Z0-9_=-]+",
  "supabase_service_role_key\s*=\s*['""][^'""]+['""]",
  "SUPABASE_SERVICE_ROLE_KEY\s*=\s*['""][^'""]+['""]",
  "postgres(ql)?://[^`"'\s]+:[^`"'\s]+@"
)

$violations = @()
foreach ($path in $paths) {
  $files = Get-ChildItem $path -Recurse -File -ErrorAction SilentlyContinue
  foreach ($pattern in $secretPatterns) {
    $hits = $files | Select-String -Pattern $pattern -ErrorAction SilentlyContinue
    # Dokumentasi memuat contoh connection string berisi placeholder dalam kurung
    # siku, misal postgresql://postgres:[DB_PASSWORD]@db.[PROJECT_REF].supabase.co
    # Itu petunjuk pemakaian, bukan kredensial, jadi bukan pelanggaran.
    $hits = $hits | Where-Object { $_.Line -notmatch '\[[A-Za-z_]+\]' }
    if ($hits) { $violations += $hits }
  }
}

if ($violations.Count -gt 0) {
  $violations | ForEach-Object { Write-Error "Potential secret: $($_.Path):$($_.LineNumber)" }
  exit 1
}

Write-Host "No obvious committed secrets found."
exit 0
