# Arsitektur PaaS Sekolah Baturaja

> Dokumen ini merangkum keputusan arsitektur untuk platform PaaS (Platform as a Service) template website sekolah, hasil diskusi antara Aldo (template website) dan Novem (aplikasi PaaS). Dokumen ini adalah acuan jangka panjang — perbarui bila ada keputusan arsitektur baru yang material, jangan hapus riwayat keputusan lama tanpa alasan.

## 1. Latar belakang dan tujuan

Aldo dan Novem membangun sebuah PaaS untuk sekolah/lembaga pendidikan. Novem membangun aplikasi kontrol PaaS (provisioning, manajemen tenant, billing/paket). Aldo membangun template website yang akan ditawarkan ke sekolah-sekolah, diturunkan dari arsitektur sistem **LPQ Al-Fath Maulana** (dashboard admin/guru/pentashih/santri, absensi, pembayaran, hafalan, MMQ, kalender akademik, konten publik, gamifikasi) yang sebelumnya berjalan di atas React + Vite + Supabase.

Rencana bisnis: menawarkan 3 kategori template ke sekolah calon pelanggan, masing-masing dengan 3 tingkatan paket (Basic, Pro, Max) yang membedakan fitur/modul yang aktif.

### 1.1 Tiga kategori template

1. Sekolah tunggal (umum / islam terpadu)
2. Yayasan dengan banyak sekolah (umum / islam terpadu)
3. Pondok pesantren

Setiap kategori memiliki karakter visual, copywriting, dan struktur navigasi publik yang berbeda, meski kebutuhan dashboard operasionalnya (admin, guru, santri/siswa) banyak yang serupa.

### 1.2 Tiga tingkatan paket

Basic, Pro, Max — perbedaan di antara paket adalah fitur/modul apa yang aktif pada website sekolah tersebut (misal modul gamifikasi, modul MMQ, modul multi-sekolah untuk yayasan, dsb).

## 2. Keputusan arsitektur inti

### 2.1 Model deployment: build & deploy terpisah per sekolah

Setiap sekolah yang mendaftar mendapatkan **deployment sendiri** — instance backend sendiri dan database sendiri — bukan satu aplikasi multi-tenant yang dibagi lewat `tenant_id`. Pilihan ini memberi isolasi data paling kuat antar-lembaga dan menyederhanakan backup/restore/decommission per sekolah (cukup urus satu database per sekolah).

Konsekuensi: provisioning sekolah baru harus otomatis (build image, migrasi database baru, deploy container, atur domain) karena tidak scalable bila dilakukan manual seiring bertambahnya jumlah sekolah.

### 2.2 Build service: dikelola oleh Novem

Proses build & deploy tidak memakai CI/CD pihak ketiga (misalnya GitHub Actions publik) melainkan **build service internal milik Novem** di sisi aplikasi PaaS. Build service ini yang memicu build & deploy saat:

- sekolah baru diprovisioning (pilih template + paket awal);
- template/struktur besar berubah (bukan sekadar toggle fitur — lihat 2.4).

Kontrak antara template website (Aldo) dan build service (Novem) — input yang dibutuhkan build service dari tiap template (env var, secret, parameter build) dan output yang harus disediakan tiap template (health check, versi, status build) — **perlu didefinisikan lebih lanjut** saat backend Go tiap template mulai dibangun. Ini belum final di dokumen ini.

### 2.3 Backend: satu instance Go + Postgres per sekolah

Setiap sekolah punya backend Go dan database Postgres miliknya sendiri (bukan backend terpusat yang dibagi banyak sekolah). Auth (JWT) diterbitkan oleh backend masing-masing sekolah, bukan oleh layanan auth terpusat dari PaaS.

Referensi implementasi backend Go yang sudah berjalan untuk sistem LPQ Al-Fath Maulana ada di repo `https://github.com/npdkdev/sekolah-baturaja.git` (Go + [chi](https://github.com/go-chi/chi) + Postgres 16 + Docker Compose), dan repo ini akan menjadi **main project website** Aldo ke depan (menggantikan versi Supabase). Struktur backend-nya (`backend/internal/handler`, `backend/internal/auth`, `backend/internal/middleware`, `backend/internal/storage`) menjadi baseline pola untuk kategori template lain.

### 2.4 Feature flag: runtime config, bukan rebuild

Setelah provisioning awal selesai, perubahan paket (Basic → Pro → Max, atau toggle fitur individual) **tidak memicu rebuild/redeploy**. Perubahan ini dibaca sebagai config runtime dari database sekolah tersebut (tabel `feature_flags` atau sejenis), dan backend Go mengecek config ini sebelum meng-expose endpoint/modul terkait pada setiap request.

> Detail konkret daftar fitur per paket (apa yang termasuk Basic vs Pro vs Max, per kategori template) **sengaja belum dibahas** — akan didefinisikan setelah seluruh fitur pada website (tiap template) rampung dan matang. Skema tabel `feature_flags`, kontrak API untuk membaca/menulisnya, dan mekanisme pengecekannya di backend baru dirancang saat itu.

### 2.5 Struktur repo: 3 codebase independen

Tiga kategori template (sekolah tunggal, yayasan, pondok pesantren) masing-masing punya **codebase/repo yang sepenuhnya independen** — tidak ada monorepo atau package bersama di antara ketiganya. Setiap template bebas berevolusi sendiri (termasuk dashboard admin/guru/santri) tanpa dependensi ke template lain. Trade-off yang disadari: bug fix atau fitur baru pada logika dashboard yang serupa di ketiga template harus dikerjakan berulang di masing-masing repo — ini keputusan sadar demi fleksibilitas dan independensi penuh per template, bukan oversight.

## 3. Ringkasan keputusan

| Aspek | Keputusan |
|---|---|
| Model deployment | Build & deploy terpisah per sekolah (bukan multi-tenant shared) |
| Build service | Dikelola sendiri oleh Novem (bukan CI/CD pihak ketiga) |
| Backend & database | Satu instance Go + Postgres per sekolah, auth diterbitkan backend masing-masing |
| Feature flag paket | Runtime config setelah provisioning awal, bukan rebuild per toggle |
| Detail fitur per paket | Ditunda — dibahas setelah semua fitur website rampung |
| Struktur repo template | 3 repo sepenuhnya independen, tidak ada shared package |
| Repo main project website | `https://github.com/npdkdev/sekolah-baturaja.git` (Go + chi + Postgres 16, migrasi dari Supabase) |

## 4. Yang masih terbuka / perlu dibahas lanjutan

- Kontrak provisioning antara build service Novem dan tiap template backend (parameter input, health check, status build).
- Daftar konkret fitur per paket Basic/Pro/Max, per kategori template — ditunda sampai fitur website rampung.
- Desain skema `feature_flags` dan mekanisme pengecekannya di backend Go.
- Apakah kategori template kedua (yayasan) dan ketiga (pondok pesantren) mulai dari nol atau memfork baseline `sekolah-baturaja` sebagai titik awal.
- Strategi domain/DNS per sekolah (subdomain platform vs domain sendiri).

## 5. Riwayat keputusan

- **2026-08-04** — Keputusan awal arsitektur PaaS: deployment terpisah per sekolah, build service internal Novem, backend+DB per sekolah, feature flag runtime, 3 repo template independen. Repo `sekolah-baturaja` (Go + Postgres) ditetapkan sebagai main project website menggantikan versi Supabase.
