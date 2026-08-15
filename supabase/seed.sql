-- Data contoh untuk pengembangan dan staging saja. JANGAN dijalankan di produksi.
-- Semua identitas di bawah ini fiktif.
--
-- Akun auth harus dibuat lebih dulu oleh helper bootstrap pengembangan, karena
-- pengguna Supabase Auth tidak selalu terbentuk dari seed.sql.
--
-- Berkas ini adalah salah satu dari DUA sumber data contoh yang dijalankan
-- `backend/init/01_migrate.sh`. Satunya lagi `backend/init/03_dummy_accounts.sql`,
-- yang berisi akun login tiap peran. Yang di sini isinya murid, kelas, dan
-- catatan contoh.

-- JUMLAH MURID CONTOH DIBATASI. Pembeli menerima TIGA murid contoh saja: dua di
-- berkas ini, dan Naila Rahmadani di backend/init/03_dummy_accounts.sql yang
-- memegang akun login murid. Sebelumnya berkas ini menyemai delapan murid, jadi
-- pembeli mewarisi sembilan baris contoh yang harus dihapus satu per satu
-- sebelum data sekolahnya sendiri masuk.
--
-- Tiga sudah cukup untuk memperagakan setiap panel: satu kelas berisi murid,
-- satu kelas berisi murid lain, dan satu kelas kosong untuk menunjukkan tampilan
-- kelas yang belum terisi.
insert into public.user_profiles (id, role, display_name, email, status)
values
  ('a1fa7a10-0000-0000-0000-000000000001', 'admin', 'Admin Demo', 'admin-demo@example.invalid', 'active'),
  ('a1fa7a10-0000-0000-0000-000000000002', 'guru', 'Guru Demo A', 'guru-a-demo@example.invalid', 'active'),
  ('a1fa7a10-0000-0000-0000-000000000003', 'guru', 'Guru Demo B', 'guru-b-demo@example.invalid', 'active'),
  ('a1fa7a10-0000-0000-0000-000000000004', 'pentashih', 'Wakasek Demo', 'wakasek-demo@example.invalid', 'active'),
  ('a1fa7a10-0000-0000-0000-000000000101', 'santri', 'Murid Contoh Satu', null, 'active'),
  ('a1fa7a10-0000-0000-0000-000000000102', 'santri', 'Murid Contoh Dua', null, 'active')
on conflict (id) do nothing;

insert into public.guru (id, nama, email, jabatan, roles, is_notulen, status)
values
  ('a1fa7a10-0000-0000-0000-000000000002', 'Guru Demo A', 'guru-a-demo@example.invalid', 'Guru Kelas', '{}', true, 'active'),
  ('a1fa7a10-0000-0000-0000-000000000003', 'Guru Demo B', 'guru-b-demo@example.invalid', 'Guru Kelas', '{}', false, 'active'),
  -- Nilai peran 'Pentashih' SENGAJA dipertahankan di kolom roles: mengubahnya
  -- akan memutus data lama dan aturan aksesnya. Yang diterjemahkan hanya
  -- labelnya, lewat labelStafRole di src/lib/staf.js.
  ('a1fa7a10-0000-0000-0000-000000000004', 'Wakasek Demo', 'wakasek-demo@example.invalid', 'Wakil Kepala Sekolah', array['Pentashih'], false, 'active')
on conflict (id) do nothing;

-- Nomor induk memakai NISN dan NIS, dua nomor yang benar-benar dipakai sekolah
-- dasar. Kolom `nomor_induk` ikut diisi karena `auth.go` masih menerimanya
-- sebagai cadangan login bagi data lama.
insert into public.santri (id, nisn, nis, nomor_induk, nama_lengkap, kategori, status, avatar_path)
values
  ('a1fa7a10-0000-0000-0000-000000000101', '9100000101', '26101', '26101', 'Murid Contoh Satu', 'Anak', 'Aktif', null),
  ('a1fa7a10-0000-0000-0000-000000000102', '9100000102', '26102', '26102', 'Murid Contoh Dua', 'Anak', 'Aktif', null)
on conflict (id) do nothing;

insert into public.auth_login_aliases (auth_user_id, alias_value, normalized_alias, internal_email)
values
  ('a1fa7a10-0000-0000-0000-000000000101', '26101', '26101', 'santri+a1fa7a10-0000-0000-0000-000000000101@auth.sekolah.local'),
  ('a1fa7a10-0000-0000-0000-000000000102', '26102', '26102', 'santri+a1fa7a10-0000-0000-0000-000000000102@auth.sekolah.local')
-- `on conflict do nothing` tanpa target, bukan `(alias_type, normalized_alias)`:
-- ada pula batasan unik satu alias aktif per pengguna, dan menjalankan ulang
-- seed setelah nilai aliasnya berubah akan menabrak batasan itu, bukan yang
-- disebutkan targetnya.
on conflict do nothing;

-- Rombel sekolah dasar: angka tingkat + huruf rombel, pola yang lazim dipakai
-- SD negeri dan langsung siap bila sekolah punya kelas paralel (1A dan 1B).
--
-- Shift 'Pagi', bukan 'Sore'. Sekolah dasar tidak mengenal shift sore; nilai itu
-- warisan produk madrasah sebelumnya.
insert into public.classes (id, nama_kelas, id_guru, sesi, kategori, sort_order)
values
  ('b2fa7a20-0000-0000-0000-000000000001', 'Kelas 1A', 'a1fa7a10-0000-0000-0000-000000000002', 'Pagi', 'Anak', 1),
  ('b2fa7a20-0000-0000-0000-000000000002', 'Kelas 2A', 'a1fa7a10-0000-0000-0000-000000000003', 'Pagi', 'Anak', 2),
  ('b2fa7a20-0000-0000-0000-000000000003', 'Kelas 3A', 'a1fa7a10-0000-0000-0000-000000000002', 'Pagi', 'Anak', 3)
on conflict (id) do nothing;

-- Kolom `jilid` dan `sesi_mengaji` hanya terisi bila sekolah menjalankan program
-- tahfizh opsional (VITE_ENABLE_TAHFIZH). Demo SD tidak memakainya, jadi kedua
-- murid ini cukup ditempatkan ke kelasnya. Kelas 3A dibiarkan kosong dengan
-- sengaja, supaya pembeli melihat tampilan kelas yang belum terisi.
update public.santri
set current_class_id = 'b2fa7a20-0000-0000-0000-000000000001'::uuid
where id in (
  'a1fa7a10-0000-0000-0000-000000000101',
  'a1fa7a10-0000-0000-0000-000000000102'
);

insert into public.class_memberships (santri_id, class_id, start_date, status, order_in_class)
values
  ('a1fa7a10-0000-0000-0000-000000000101', 'b2fa7a20-0000-0000-0000-000000000001', current_date, 'active', 1),
  ('a1fa7a10-0000-0000-0000-000000000102', 'b2fa7a20-0000-0000-0000-000000000001', current_date, 'active', 2)
on conflict do nothing;

insert into public.pentashih_class_assignments (pentashih_id, class_id, scope, is_active)
values ('a1fa7a10-0000-0000-0000-000000000004', 'b2fa7a20-0000-0000-0000-000000000001', 'class', true)
on conflict do nothing;

-- Satu baris kehadiran dan satu baris pembayaran: cukup untuk memperagakan
-- rekap dan riwayat tanpa menitipkan angka keuangan palsu ke laporan pembeli.
insert into public.attendance (user_id, role, attendance_date, class_id, sesi, status, source)
values
  ('a1fa7a10-0000-0000-0000-000000000101', 'santri', current_date, 'b2fa7a20-0000-0000-0000-000000000001', 'Pagi', 'Hadir', 'manual')
on conflict do nothing;

insert into public.payments (id, santri_id, bulan, tahun, jumlah, tanggal_pembayaran, metode_pembayaran, status)
values
  ('d4fa7a40-0000-0000-0000-000000000001', 'a1fa7a10-0000-0000-0000-000000000101', 1, 2026, 10000, current_date, 'Tunai', 'paid')
on conflict (id) do nothing;

insert into public.expenses (id, tanggal_pengeluaran, kategori, deskripsi, jumlah)
values ('d4fa7a40-0000-0000-0000-000000000101', current_date, 'Operasional', 'Pengeluaran contoh untuk pengujian lokal', 5000)
on conflict (id) do nothing;

-- Hafalan hanya tampil bila program tahfizh opsional dinyalakan
-- (VITE_ENABLE_TAHFIZH). Dua baris ini sekadar contoh isian.
insert into public.hafalan_items (id, category, jilid, item_name, item_order)
values
  ('e5fa7a50-0000-0000-0000-000000000001', 'Doa Harian', 'Tingkat 1', 'Doa Sebelum Belajar', 1),
  ('e5fa7a50-0000-0000-0000-000000000002', 'Surat Pendek', 'Tingkat 1', 'Surat Al-Fatihah', 2)
on conflict (id) do nothing;

insert into public.hafalan_progress (id, santri_id, item_id, category, item_name, status)
values ('e5fa7a50-0000-0000-0000-000000000101', 'a1fa7a10-0000-0000-0000-000000000101', 'e5fa7a50-0000-0000-0000-000000000001', 'Doa Harian', 'Doa Sebelum Belajar', 'proses')
on conflict (id) do nothing;

-- Tabel `mmq_*` menyimpan rapat guru. Namanya warisan produk terdahulu dan
-- sengaja TIDAK diganti agar data rapat yang sudah tersimpan tetap terbaca;
-- lihat catatan normalisasi Rapat Guru di docs/HANDOFF.md.
insert into public.rapat_guru_jadwal (id, day_of_week, start_time, end_time, location)
values ('c3fa7a30-0000-0000-0000-000000000001', 5, '13:00', '14:30', 'Ruang Guru')
on conflict (id) do nothing;

insert into public.rapat_guru_absensi (id, schedule_id, guru_id, attendance_date, status)
values ('c3fa7a30-0000-0000-0000-000000000101', 'c3fa7a30-0000-0000-0000-000000000001', 'a1fa7a10-0000-0000-0000-000000000002', current_date, 'Hadir')
on conflict (id) do nothing;

insert into public.rapat_guru_notulensi (id, schedule_id, tanggal, judul, isi, notulen_id)
values ('c3fa7a30-0000-0000-0000-000000000201', 'c3fa7a30-0000-0000-0000-000000000001', current_date, 'Notulensi Rapat Guru', 'Isi notulensi contoh.', 'a1fa7a10-0000-0000-0000-000000000002')
on conflict (id) do nothing;

-- Kunci 'site_name' DIHAPUS dari seed, bukan sekadar diganti isinya. Tidak ada
-- satu pun kode yang membacanya — nama sekolah datang dari kunci
-- `school_identity` (lihat src/lib/schoolIdentity.js), yang bawaannya sudah
-- "Sekolah Dasar Negeri Baturaja" dan disunting pembeli lewat dashboard.
-- Baris lamanya hanya menitipkan nama lembaga produk terdahulu ke basis data
-- setiap pemasangan baru.
insert into public.website_content (key, content, is_public)
values
  ('profile', '{"summary":"Konten profil contoh untuk pengembangan dan staging."}', true)
on conflict (key) do nothing;

insert into public.news (title, slug, excerpt, content, status, published_at)
values ('Berita Demo', 'berita-demo', 'Excerpt berita dummy.', '{"body":"Konten berita dummy."}', 'published', now())
on conflict (slug) do nothing;

insert into public.announcements (title, slug, excerpt, content, status, priority, published_at)
values ('Pengumuman Demo', 'pengumuman-demo', 'Excerpt pengumuman dummy.', '{"body":"Konten pengumuman dummy."}', 'published', 'normal', now())
on conflict (slug) do nothing;
