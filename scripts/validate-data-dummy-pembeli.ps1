# validate-data-dummy-pembeli.ps1
#
# Menguji dua janji produk yang saling berkaitan, lewat API yang hidup:
#
#   1. Pembeli (peran `admin`) dapat mengganti seluruh data dummy tanpa kendala —
#      mengubah nama guru, murid, dan kelas contoh, lalu menonaktifkan dan
#      mengaktifkannya kembali.
#   2. Akun `superadmin` milik penjual tidak terlihat dan tidak tersentuh oleh
#      pembeli, sementara penjual sendiri tetap punya akses penuh.
#
# Kenapa lewat API dan bukan unit test: yang diuji adalah gabungan penjagaan di
# middleware Go, penyaringan di query SQL, dan bentuk respons. Menguji fungsinya
# satu per satu tanpa basis data tidak akan menangkap kombinasi itu.
#
# Prasyarat: backend dan DB hidup (docker compose -f backend/docker-compose.yml up -d)
# serta akun dummy lokal tersemai. Skrip ini MENGUBAH lalu MEMULIHKAN data
# contoh, jadi jangan dijalankan terhadap data sungguhan.
#
# SANDI SUPERADMIN TIDAK DITULIS DI SINI. Ia hanya ada di pengelola sandi
# penjual; setel lewat $env:SEED_SUPERADMIN_PASS sebelum menjalankan. Tanpa itu
# bagian pemeriksaan superadmin dilewati, bukan gagal — supaya skrip ini tetap
# berguna di mesin siapa pun.

$ErrorActionPreference = 'Stop'

$baseUrl  = if ($env:API_URL)         { $env:API_URL }         else { 'http://localhost:8080' }
$admUser  = if ($env:SEED_ADMIN_USER) { $env:SEED_ADMIN_USER } else { 'admin@sdnbaturaja.sch.id' }
$admPass  = if ($env:SEED_ADMIN_PASS) { $env:SEED_ADMIN_PASS } else { 'admin123' }
$saUser   = if ($env:SEED_SUPERADMIN_USER) { $env:SEED_SUPERADMIN_USER } else { 'superadmin@sekolahbta.id' }
$saPass   = $env:SEED_SUPERADMIN_PASS

# Id akun superadmin dari backend/init/03_dummy_accounts.sql. Id-nya bukan rahasia
# (ada di repo); yang rahasia hanya sandinya.
$superadminId = 'a1fa7a10-0000-0000-0000-000000000020'

$gagal = 0
function Cek($nama, $aktual, $harus) {
  if ("$aktual" -eq "$harus") { Write-Host "  PASS  $nama" }
  else { Write-Host "  FAIL  $nama (dapat '$aktual', harus '$harus')"; $script:gagal++ }
}

# Status HTTP dari panggilan yang diharapkan gagal; 'OK' bila justru berhasil.
function Status($blok) {
  try { & $blok | Out-Null; return 'OK' } catch { return [int]$_.Exception.Response.StatusCode }
}

function Login($u, $p) {
  $body = @{ username = $u; password = $p } | ConvertTo-Json
  (Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body $body -ContentType 'application/json').access_token
}

Write-Host 'Menguji kesiapan data dummy untuk pembeli...'

$admToken = Login $admUser $admPass
if (-not $admToken) { Write-Error 'Gagal login sebagai admin.'; exit 1 }
$hAdmin = @{ Authorization = "Bearer $admToken"; 'Content-Type' = 'application/json' }

# ── 1. Pembeli dapat mengganti data contoh ───────────────────────────────────
# Setiap kasus: ubah nama -> pastikan tersimpan -> nonaktifkan -> aktifkan lagi
# -> pulihkan nama asli. Penanda waktu tidak dipakai supaya hasilnya bisa dilacak.
$penanda = 'Uji Ganti Dummy'

function UjiGanti($label, $rute, $kolomNama, $item, $kolomAktif, $nilaiAktif, $nilaiNonaktif) {
  $id    = $item.id
  $asli  = $item.$kolomNama
  $baru  = "$penanda $label"

  $r = Invoke-RestMethod -Uri "$baseUrl/api/$rute/$id" -Method Put -Headers $hAdmin `
        -Body (@{ $kolomNama = $baru } | ConvertTo-Json)
  Cek "$label - nama contoh bisa diganti" $r.data.$kolomNama $baru

  Invoke-RestMethod -Uri "$baseUrl/api/$rute/$id" -Method Delete -Headers $hAdmin | Out-Null
  $r = Invoke-RestMethod -Uri "$baseUrl/api/$rute/$id" -Headers $hAdmin
  Cek "$label - bisa dinonaktifkan tanpa galat" $r.data.$kolomAktif $nilaiNonaktif

  $r = Invoke-RestMethod -Uri "$baseUrl/api/$rute/$id" -Method Put -Headers $hAdmin `
        -Body (@{ $kolomAktif = $nilaiAktif; $kolomNama = $asli } | ConvertTo-Json)
  Cek "$label - bisa diaktifkan lagi dan namanya pulih" "$($r.data.$kolomAktif)|$($r.data.$kolomNama)" "$nilaiAktif|$asli"
}

$guruContoh  = (Invoke-RestMethod -Uri "$baseUrl/api/guru?limit=200" -Headers $hAdmin).data |
                 Where-Object { $_.nama -like 'Guru Demo*' } | Select-Object -First 1
$muridContoh = (Invoke-RestMethod -Uri "$baseUrl/api/santri?limit=200" -Headers $hAdmin).data |
                 Where-Object { $_.nama_lengkap -like 'Santri Demo*' } | Select-Object -First 1
$kelasContoh = (Invoke-RestMethod -Uri "$baseUrl/api/classes" -Headers $hAdmin).data |
                 Where-Object { $_.nama_kelas -like 'Kelas Demo*' } | Select-Object -First 1

if ($guruContoh)  { UjiGanti 'guru'  'guru'    'nama'         $guruContoh  'status'   'active' 'inactive' }
                  else { Write-Host '  SKIP  tidak ada guru contoh di data';  $gagal++ }
if ($muridContoh) { UjiGanti 'murid' 'santri'  'nama_lengkap' $muridContoh 'status'   'Aktif'  'Nonaktif' }
                  else { Write-Host '  SKIP  tidak ada murid contoh di data'; $gagal++ }
if ($kelasContoh) { UjiGanti 'kelas' 'classes' 'nama_kelas'   $kelasContoh 'is_active' $true   $false }
                  else { Write-Host '  SKIP  tidak ada kelas contoh di data'; $gagal++ }

# ── 2. Akun penjual tersembunyi dari pembeli ─────────────────────────────────
$daftarAdmin = (Invoke-RestMethod -Uri "$baseUrl/api/guru?limit=200" -Headers $hAdmin).data
Cek 'superadmin tidak muncul di daftar guru milik admin' `
  (($daftarAdmin | Where-Object { $_.id -eq $superadminId }).Count) 0

# 404, bukan 403: 403 mengakui bahwa barisnya ada.
Cek 'admin buka detail superadmin ditolak 404' (Status { Invoke-RestMethod -Uri "$baseUrl/api/guru/$superadminId" -Headers $hAdmin }) 404
Cek 'admin ubah superadmin ditolak 404'        (Status { Invoke-RestMethod -Uri "$baseUrl/api/guru/$superadminId" -Method Put -Headers $hAdmin -Body '{"jabatan":"Dibajak"}' }) 404
Cek 'admin nonaktifkan superadmin ditolak 404' (Status { Invoke-RestMethod -Uri "$baseUrl/api/guru/$superadminId" -Method Delete -Headers $hAdmin }) 404
Cek 'admin tidak bisa membuat akun superadmin baru' `
  (Status { Invoke-RestMethod -Uri "$baseUrl/api/guru" -Method Post -Headers $hAdmin `
     -Body '{"role":"superadmin","password":"x","profile":{"nama":"Uji","email":"uji-superadmin@example.invalid"}}' }) 400

# Sandi lama yang pernah tercantum di dokumen harus mati untuk selamanya.
Cek 'sandi lama superadmin123 tidak berlaku' (Status { Login 'superadmin@sdnbaturaja.sch.id' 'superadmin123' }) 401

# Hitungan guru publik harus sama dengan jumlah kartu guru; kalau akun sistem
# ikut terhitung, angka di halaman depan lebih besar daripada yang tampil.
$jumlahPublik = (Invoke-RestMethod -Uri "$baseUrl/api/guru/count").data.total
$kartuPublik  = (Invoke-RestMethod -Uri "$baseUrl/api/content/teachers").data.Count
Cek 'hitungan guru publik sama dengan jumlah kartu guru' $jumlahPublik $kartuPublik

# ── 3. Penjual tetap punya akses penuh ───────────────────────────────────────
# Identitas yang tersimpan dibaca lebih dulu lalu DITULIS ULANG APA ADANYA. Uji
# ini soal siapa yang boleh menulis, bukan soal isinya — menimpanya dengan objek
# kosong akan menghapus nama sekolah dan logo yang sudah disetel.
$identitasAsli = (Invoke-RestMethod -Uri "$baseUrl/api/content/website?keys=school_identity&public_only=false").data.school_identity
if ($null -eq $identitasAsli) { $identitasAsli = @{} }
$badanIdentitas = @{ content = $identitasAsli } | ConvertTo-Json -Depth 12

if ($saPass) {
  $saToken = Login $saUser $saPass
  if (-not $saToken) { Write-Host '  FAIL  superadmin gagal login dengan sandi yang diberikan'; $gagal++ }
  else {
    $hSuper = @{ Authorization = "Bearer $saToken"; 'Content-Type' = 'application/json' }
    $daftarSuper = (Invoke-RestMethod -Uri "$baseUrl/api/guru?limit=200" -Headers $hSuper).data
    Cek 'superadmin melihat barisnya sendiri' (($daftarSuper | Where-Object { $_.id -eq $superadminId }).Count) 1
    Cek 'superadmin bisa membuka detailnya sendiri' `
      (Status { Invoke-RestMethod -Uri "$baseUrl/api/guru/$superadminId" -Headers $hSuper }) 'OK'
    Cek 'superadmin boleh menulis identitas website' `
      (Status { Invoke-RestMethod -Uri "$baseUrl/api/content/website/school_identity" -Method Put `
         -Headers $hSuper -Body $badanIdentitas }) 'OK'
  }
} else {
  Write-Host '  SKIP  $env:SEED_SUPERADMIN_PASS tidak disetel; pemeriksaan akses penjual dilewati'
}

# Pembeli tetap ditolak pada identitas, dan itu tidak bergantung pada sandi penjual.
Cek 'admin ditolak menulis identitas website' `
  (Status { Invoke-RestMethod -Uri "$baseUrl/api/content/website/school_identity" -Method Put `
     -Headers $hAdmin -Body $badanIdentitas }) 403
Cek 'admin ditolak menulis logo website' `
  (Status { Invoke-RestMethod -Uri "$baseUrl/api/content/website/logoUrl" -Method Put `
     -Headers $hAdmin -Body '{"content":"/logo.webp"}' }) 403
# Tapi konten administrasi sekolah tetap miliknya sepenuhnya.
Cek 'admin tetap boleh menulis isi halaman depan' `
  (Status { Invoke-RestMethod -Uri "$baseUrl/api/content/website/home_content" -Method Put `
     -Headers $hAdmin -Body (@{ content = (Invoke-RestMethod -Uri "$baseUrl/api/content/website?keys=home_content&public_only=false").data.home_content } | ConvertTo-Json -Depth 12) }) 'OK'

if ($gagal -gt 0) { Write-Error "$gagal pemeriksaan data dummy pembeli gagal."; exit 1 }
Write-Host 'Buyer dummy-data checks passed.'
