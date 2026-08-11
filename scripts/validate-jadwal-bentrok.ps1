# validate-jadwal-bentrok.ps1
#
# Menguji logika bentrok jam pada jadwal pelajaran lewat API yang hidup.
#
# Kenapa lewat API dan bukan unit test Go: irisan jamnya dihitung di SQL
# (`jam_mulai < $selesai AND jam_selesai > $mulai`), bukan di Go. Menguji fungsi
# `periksaBentrok` tanpa basis data hanya akan menguji pembacaan parameter, bukan
# logika yang sebenarnya menentukan hasil.
#
# Prasyarat: backend dan DB hidup (docker compose -f backend/docker-compose.yml up -d),
# serta akun dummy lokal sudah tersemai. Skrip ini MENULIS lalu MENGHAPUS jadwal
# uji, jadi jangan dijalankan terhadap data sungguhan.
#
# Kredensial dummy lokal; ganti lewat variabel lingkungan bila berbeda.

$ErrorActionPreference = 'Stop'

$baseUrl  = if ($env:API_URL) { $env:API_URL } else { 'http://localhost:8080' }
$username = if ($env:SEED_ADMIN_USER) { $env:SEED_ADMIN_USER } else { 'admin@sdnbaturaja.sch.id' }
$password = if ($env:SEED_ADMIN_PASS) { $env:SEED_ADMIN_PASS } else { 'admin123' }

$gagal = 0
function Cek($nama, $aktual, $harus) {
  if ($aktual -eq $harus) { Write-Host "  PASS  $nama" }
  else { Write-Host "  FAIL  $nama (dapat '$aktual', harus '$harus')"; $script:gagal++ }
}

Write-Host 'Menguji logika bentrok jadwal pelajaran...'

$body  = @{ username = $username; password = $password } | ConvertTo-Json
$token = (Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body $body -ContentType 'application/json').access_token
if (-not $token) { Write-Error 'Gagal login dengan akun dummy.'; exit 1 }
$headers = @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' }

$semuaPeriode = @((Invoke-RestMethod -Uri "$baseUrl/api/schedule/periode" -Headers $headers).data)
$periode = $semuaPeriode | Where-Object { $_.is_active } | Select-Object -First 1
$periodeDibuat = $null

function BersihkanPeriodeUji {
  if ($script:periodeDibuat -and $script:periodeDibuat.id) {
    try {
      Invoke-RestMethod -Uri "$baseUrl/api/schedule/periode/$($script:periodeDibuat.id)" -Method Delete -Headers $headers | Out-Null
      Write-Host "  (bersih: periode uji $($script:periodeDibuat.tahun_ajaran) dihapus)"
    } catch {
      Write-Warning "Periode uji $($script:periodeDibuat.id) tidak dapat dihapus otomatis: $($_.Exception.Message)"
    }
    $script:periodeDibuat = $null
  }
}

if (-not $periode) {
  # Fixture lokal yang baru di-bootstrap belum tentu punya periode aktif. Buat
  # satu periode sementara agar guard bentrok tetap bisa diuji, lalu hapus lagi
  # pada cleanup. Tahun ajaran dipilih dari slot yang belum ada supaya skrip
  # dapat diulang tanpa menabrak data periode yang sudah tersimpan.
  $tahunUjiDasar = (Get-Date).Year + 10
  do {
    $tahunUji = '{0}/{1}' -f $tahunUjiDasar, ($tahunUjiDasar + 1)
    $sudahAda = $semuaPeriode | Where-Object {
      $_.tahun_ajaran -eq $tahunUji -and $_.semester -eq 'Ganjil'
    }
    $tahunUjiDasar++
  } while ($sudahAda)

  $namaPeriodeUji = "Uji bentrok jadwal $([guid]::NewGuid().ToString('N').Substring(0, 8))"
  $periodePayload = @{
    nama            = $namaPeriodeUji
    tahun_ajaran   = $tahunUji
    semester       = 'Ganjil'
    tanggal_mulai  = $null
    tanggal_selesai = $null
    is_active      = $true
  } | ConvertTo-Json
  $periodeDibuat = (Invoke-RestMethod -Uri "$baseUrl/api/schedule/periode" -Method Post -Body $periodePayload -Headers $headers).data
  if (-not $periodeDibuat) {
    Write-Error 'Periode uji tidak berhasil dibuat.'
    exit 1
  }
  $periode = $periodeDibuat
  Write-Host "  (fixture: periode uji $($periode.tahun_ajaran) dibuat karena belum ada periode aktif)"
}

$mapel  = (Invoke-RestMethod -Uri "$baseUrl/api/schedule/mapel" -Headers $headers).data
$kelas  = @((Invoke-RestMethod -Uri "$baseUrl/api/classes" -Headers $headers).data | Where-Object { $_.is_active })
if (@($mapel).Count -lt 6 -or $kelas.Count -lt 2) {
  BersihkanPeriodeUji
  Write-Error 'Butuh minimal 6 mata pelajaran dan 2 kelas aktif.'
  exit 1
}

$kelasA = $kelas[0].id
$kelasB = $kelas[1].id
$guru   = ($kelas | Where-Object { $_.id_guru } | Select-Object -First 1).id_guru
if (-not $guru) {
  BersihkanPeriodeUji
  Write-Error 'Tidak ada kelas dengan guru pengampu.'
  exit 1
}
$guruLain = ($kelas | Where-Object { $_.id_guru -and $_.id_guru -ne $guru } | Select-Object -First 1).id_guru

# Hari 6 (Sabtu) dipakai supaya tidak menabrak jadwal sungguhan pada hari kerja.
$hariUji = 6
$dibuat = @()

function Kirim($kelasId, $guruId, $mulai, $selesai, $idx) {
  $payload = @{
    periode_id = $periode.id; class_id = $kelasId; mata_pelajaran_id = $mapel[$idx].id
    guru_id = $guruId; hari = $hariUji; jam_mulai = $mulai; jam_selesai = $selesai
  } | ConvertTo-Json
  try {
    $r = Invoke-RestMethod -Uri "$baseUrl/api/schedule/jadwal" -Method Post -Body $payload -Headers $headers
    $script:dibuat += $r.data.id
    return 'DITERIMA'
  } catch {
    return 'DITOLAK'
  }
}

try {
  Cek 'slot dasar diterima'                      (Kirim $kelasA $guru '07:30' '08:40' 0) 'DITERIMA'
  Cek 'batas bersentuhan tepat diterima'          (Kirim $kelasA $guru '08:40' '09:50' 1) 'DITERIMA'
  Cek 'beririsan satu menit ditolak'              (Kirim $kelasA $guru '09:49' '11:00' 2) 'DITOLAK'
  Cek 'membungkus penuh ditolak'                  (Kirim $kelasA $guru '07:00' '10:00' 3) 'DITOLAK'
  Cek 'guru sama di kelas lain, beririsan, ditolak' (Kirim $kelasB $guru '08:00' '09:00' 4) 'DITOLAK'
  if ($guruLain) {
    Cek 'guru lain di kelas lain, beririsan, diterima' (Kirim $kelasB $guruLain '08:00' '09:00' 5) 'DITERIMA'
  } else {
    Write-Host '  SKIP  guru lain tidak tersedia di data'
  }
}
finally {
  foreach ($id in $dibuat) {
    try { Invoke-RestMethod -Uri "$baseUrl/api/schedule/jadwal/$id" -Method Delete -Headers $headers | Out-Null } catch { }
  }
  Write-Host "  (bersih: $($dibuat.Count) jadwal uji dihapus)"
  BersihkanPeriodeUji
}

if ($gagal -gt 0) { Write-Error "$gagal pemeriksaan bentrok jadwal gagal."; exit 1 }
Write-Host 'Jadwal conflict checks passed.'
