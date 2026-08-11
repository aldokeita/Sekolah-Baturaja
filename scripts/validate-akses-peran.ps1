$ErrorActionPreference = "Stop"

# Menjaga agar setiap peran pengelola benar-benar bisa membuka data yang menjadi
# pekerjaannya.
#
# Kenapa penjaga ini ada: `santri.go` List dan Update, serta `academic.go`,
# dulu menulis daftar peran satu per satu (`case "admin":`) dan tidak pernah
# diperbarui ketika `tata_usaha` lalu `superadmin` ditambahkan ke enum app_role.
# Akibatnya dua dari lima peran menerima 403 pada Data Murid — panel yang justru
# pekerjaan utama tata usaha — dan tidak ada satu pun uji yang menangkapnya,
# karena seluruh uji lain memakai akun admin.
#
# Menjalankan: pwsh scripts/validate-akses-peran.ps1
# Menuntut backend hidup di localhost:8080 dengan data contoh.

$base = "http://localhost:8080"
$gagal = 0

function Masuk($user, $pass) {
  $body = @{ username = $user; password = $pass } | ConvertTo-Json
  try {
    $r = Invoke-RestMethod -Uri "$base/api/auth/login" -Method Post -ContentType 'application/json' -Body $body
    return $r.access_token
  } catch {
    Write-Host ("  FAIL  login {0} gagal" -f $user) -ForegroundColor Red
    return $null
  }
}

function Periksa($nama, $token, $path, $harusLolos) {
  $H = @{ Authorization = "Bearer $token" }
  $kode = 0
  try {
    Invoke-RestMethod -Uri "$base$path" -Headers $H | Out-Null
    $kode = 200
  } catch {
    $kode = $_.Exception.Response.StatusCode.value__
  }
  $lolos = ($kode -eq 200)
  if ($lolos -eq $harusLolos) {
    Write-Host ("  PASS  {0} {1} -> {2}" -f $nama, $path, $kode)
    return $true
  }
  $ingin = if ($harusLolos) { "200" } else { "bukan 200" }
  Write-Host ("  FAIL  {0} {1} -> {2}, seharusnya {3}" -f $nama, $path, $kode, $ingin) -ForegroundColor Red
  return $false
}

Write-Host "Menguji akses tiap peran ke data intinya..."

$peran = @(
  @{ nama = 'admin';      user = 'admin@sdnbaturaja.sch.id';     pass = 'admin123' },
  @{ nama = 'tata_usaha'; user = 'tatausaha@sdnbaturaja.sch.id'; pass = 'tatausaha123' }
)

# Superadmin hanya diuji bila sandinya disediakan lewat environment — sandinya
# tidak boleh masuk repo.
if ($env:SEED_SUPERADMIN_PASS) {
  $peran += @{ nama = 'superadmin'; user = 'superadmin@sekolahbta.id'; pass = $env:SEED_SUPERADMIN_PASS }
} else {
  Write-Host '  SKIP  $env:SEED_SUPERADMIN_PASS tidak disetel; peran superadmin dilewati'
}

# Jalur yang WAJIB terbuka untuk setiap peran pengelola (CanManage).
$wajibLolos = @('/api/santri', '/api/guru', '/api/classes', '/api/academic/murojah', '/api/ppdb')

foreach ($p in $peran) {
  $tok = Masuk $p.user $p.pass
  if (-not $tok) { $gagal++; continue }
  foreach ($jalur in $wajibLolos) {
    if (-not (Periksa $p.nama $tok $jalur $true)) { $gagal++ }
  }
}

# Guru TIDAK boleh membuka daftar pendaftaran SPMB maupun data guru lain.
$tokGuru = Masuk 'guru@sdnbaturaja.sch.id' 'guru123'
if ($tokGuru) {
  # Daftar murid terbuka untuk guru tapi TERSARING ke kelasnya sendiri, jadi 200 benar.
  if (-not (Periksa 'guru' $tokGuru '/api/santri' $true)) { $gagal++ }
  if (-not (Periksa 'guru' $tokGuru '/api/ppdb' $false)) { $gagal++ }
} else {
  $gagal++
}

if ($gagal -gt 0) {
  Write-Error "$gagal pemeriksaan akses peran gagal."
  exit 1
}

Write-Host "Role access checks passed."
exit 0
