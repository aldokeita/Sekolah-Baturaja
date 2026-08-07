-- Logical migration: 0054_pendaftaran_ppdb
-- Purpose: tempat khusus untuk pendaftaran murid baru (PPDB), menggantikan
--          penampungan sementara di tabel `feedbacks`.
-- Dependencies: 20260624001200_content_news_announcements_feedbacks.sql (feedbacks,
--               tempat pendaftaran lama menumpuk),
--               20260624001400_audit_triggers_and_updated_at.sql (set_updated_at).
-- Safety: hanya menambah dua tabel baru. Nol perubahan pada tabel yang sudah ada,
--         nol backfill, nol penghapusan data. Pendaftaran lama tetap utuh di
--         `feedbacks` dan tidak dipindahkan — memindahkannya berarti mengurai teks
--         bebas, yang bisa salah tanpa bisa dibatalkan. Tata usaha membacanya di
--         Pesan Masuk seperti sebelumnya sampai gelombang berikutnya dibuka.
--
-- Kenapa tabel sendiri dan bukan kolom tambahan pada `feedbacks`:
-- pendaftaran punya siklus hidup (baru → diverifikasi → diterima/ditolak),
-- nomor pendaftaran, dan dua puluh kolom data calon murid. Pesan pengunjung tidak
-- punya satu pun di antaranya. Menggabungkan keduanya membuat setiap kolom
-- pendaftaran wajib nullable dan setiap query harus menyaring jenis barisnya.

-- ── Nomor urut pendaftaran ───────────────────────────────────────────────────
--
-- Nomor pendaftaran ("PPDB-2026-0001") dibentuk per tahun ajaran, jadi urutannya
-- kembali ke 1 setiap tahun. Menghitung `max(urut) + 1` saat menyimpan akan
-- membagikan nomor yang sama kepada dua pendaftar yang menekan kirim bersamaan.
-- Tabel ini memindahkan penomorannya ke satu pernyataan UPSERT yang atomik:
--
--   insert into ppdb_nomor_urut (tahun_ajaran, urut) values ($1, 1)
--   on conflict (tahun_ajaran) do update set urut = ppdb_nomor_urut.urut + 1
--   returning urut;
--
-- Sequence biasa tidak dipakai karena ia tidak bisa dibuat ulang per tahun tanpa
-- DDL saat berjalan.
create table if not exists public.ppdb_nomor_urut (
  tahun_ajaran text primary key,
  urut integer not null default 0,
  updated_at timestamptz not null default now()
);

comment on table public.ppdb_nomor_urut is
  'Pencacah nomor pendaftaran per tahun ajaran. Dinaikkan lewat UPSERT atomik.';

-- ── Pendaftaran ──────────────────────────────────────────────────────────────
create table if not exists public.pendaftaran_ppdb (
  id uuid primary key default gen_random_uuid(),

  -- Nomor pendaftaran yang dibacakan ke orang tua. Unik seumur hidup basis data.
  nomor_pendaftaran text not null,
  tahun_ajaran text not null,

  -- Data calon murid
  nama_lengkap text not null,
  nisn text,
  nik text,
  tempat_lahir text,
  tanggal_lahir date,
  jenis_kelamin text,
  alamat text,
  no_hp text not null,
  email text,

  -- Asal sekolah
  sekolah_asal text,
  npsn_asal text,
  usia_keterangan text,

  /* Jalur disimpan DUA KALI dengan sengaja: `jalur` adalah id yang dipilih, dan
   * `jalur_label` nama yang dibaca pendaftar saat itu. Daftar jalur disunting
   * pembeli kapan saja di Konten → Informasi Pendaftaran; tanpa label tersimpan,
   * pendaftaran tahun lalu akan berubah artinya ketika jalurnya diganti nama atau
   * dihapus. */
  jalur text,
  jalur_label text,
  minat text,

  -- Orang tua atau wali
  nama_ayah text,
  nama_ibu text,
  pekerjaan_orang_tua text,
  no_hp_wali text,

  /* Kesiapan berkas yang DINYATAKAN pendaftar, bukan berkas terunggah. Halaman
   * publik tidak menerima unggahan: endpoint unggah ada di balik RequireAuth, dan
   * membukanya untuk siapa saja berarti menerima berkas dari pengunjung yang tidak
   * dikenal. Berkas aslinya dibawa saat daftar ulang. Bentuknya {"kk":true,...}
   * mengikuti id pada `ppdb_content.berkas`, yang boleh diubah pembeli — jadi
   * jsonb, bukan kolom tetap. */
  berkas_siap jsonb not null default '{}'::jsonb,

  -- Siklus hidup
  status text not null default 'baru',
  catatan text,
  diproses_oleh uuid,
  diproses_pada timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.pendaftaran_ppdb is
  'Pendaftaran murid baru dari halaman publik. Diverifikasi tata usaha atau admin.';
comment on column public.pendaftaran_ppdb.berkas_siap is
  'Pernyataan kesiapan berkas dari pendaftar, bukan berkas terunggah.';

-- Constraint ditambah terpisah dan idempoten supaya migrasi aman dijalankan ulang.
alter table public.pendaftaran_ppdb
  drop constraint if exists pendaftaran_ppdb_status_chk;
alter table public.pendaftaran_ppdb
  add constraint pendaftaran_ppdb_status_chk
  check (status in ('baru', 'diverifikasi', 'diterima', 'ditolak'));

alter table public.pendaftaran_ppdb
  drop constraint if exists pendaftaran_ppdb_jenis_kelamin_chk;
alter table public.pendaftaran_ppdb
  add constraint pendaftaran_ppdb_jenis_kelamin_chk
  check (jenis_kelamin is null or jenis_kelamin in ('L', 'P'));

create unique index if not exists pendaftaran_ppdb_nomor_unik
  on public.pendaftaran_ppdb (nomor_pendaftaran);

/* Satu NISN hanya boleh mendaftar sekali per tahun ajaran. Sebagian pendaftar
 * kelas satu belum punya NISN, jadi indeksnya PARSIAL — baris tanpa NISN tidak
 * saling menghalangi. */
create unique index if not exists pendaftaran_ppdb_nisn_unik
  on public.pendaftaran_ppdb (tahun_ajaran, nisn)
  where nisn is not null and nisn <> '';

-- Panel tata usaha menyaring per tahun ajaran dan status, diurutkan terbaru dulu.
create index if not exists pendaftaran_ppdb_tahun_status_idx
  on public.pendaftaran_ppdb (tahun_ajaran, status, created_at desc);

create index if not exists pendaftaran_ppdb_created_idx
  on public.pendaftaran_ppdb (created_at desc);

drop trigger if exists set_pendaftaran_ppdb_updated_at on public.pendaftaran_ppdb;
create trigger set_pendaftaran_ppdb_updated_at
  before update on public.pendaftaran_ppdb
  for each row execute function public.set_updated_at();

drop trigger if exists set_ppdb_nomor_urut_updated_at on public.ppdb_nomor_urut;
create trigger set_ppdb_nomor_urut_updated_at
  before update on public.ppdb_nomor_urut
  for each row execute function public.set_updated_at();

-- RLS dinyalakan mengikuti konvensi repo. Perlu diingat: gerbang yang benar-benar
-- menjaga request hidup ada di middleware Go (RequireAuth/RequireRole dan
-- CanManage), karena pool tersambung sebagai superuser. Policy di sini jaring
-- pengaman, bukan pertahanan utama.
alter table public.pendaftaran_ppdb enable row level security;
alter table public.ppdb_nomor_urut enable row level security;

/* Tidak ada policy SELECT terbuka untuk pendaftaran, berbeda dari tabel konten.
 * Isinya data pribadi anak: NIK, alamat, tanggal lahir, nomor orang tua. Yang
 * boleh membacanya hanya staf pengelola — peran yang sama dengan CanManage di Go. */
drop policy if exists pendaftaran_ppdb_staf_read on public.pendaftaran_ppdb;
create policy pendaftaran_ppdb_staf_read on public.pendaftaran_ppdb
  for select using (
    public.current_user_role() in ('admin', 'superadmin', 'tata_usaha')
  );

-- `ppdb_nomor_urut` sengaja tanpa policy sama sekali: ia pencacah internal, dan
-- tidak ada peran yang perlu membacanya langsung.

