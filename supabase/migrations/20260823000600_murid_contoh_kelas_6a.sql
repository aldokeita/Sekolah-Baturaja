-- Empat murid contoh untuk Kelas 6A, satu-satunya rombel contoh yang kosong.
--
-- Kelas kosong membuat beberapa hal terlihat rusak padahal tidak: tabel murid di
-- dashboard wali kelas kosong, rekap tidak punya apa pun untuk dihitung, dan
-- jadwal pelajaran 6A yang dibuat migrasi 20260823000400 mengajar kelas tanpa
-- murid.
--
-- ── Pagar yang menahan migrasi ini di data contoh saja ───────────────────────
-- Hanya jalan bila Kelas 6A ADA dan BELUM punya murid seorang pun. Sekolah yang
-- sudah memasukkan murid sungguhan ke 6A tidak akan mendapat empat nama karangan
-- ini di tengah rombelnya. Aman dijalankan berulang: uuid-nya tetap, dan setiap
-- insert memakai on conflict do nothing.
--
-- ── Sandi ───────────────────────────────────────────────────────────────────
-- Sandi = NIS, mengikuti aturan yang sama dengan seluruh murid (lihat
-- `insertSantriTx` dan migrasi 20260823000300). Cost 12 menyamai `bcryptCost` di
-- backend/internal/auth/password.go. Nama penggunanya nama panggilan.
--
-- ── Yang ikut dibuat, dan mengapa ───────────────────────────────────────────
-- santri.id adalah FK ke auth.users(id), jadi baris identitasnya harus ada lebih
-- dulu; user_profiles menyimpan perannya. `class_memberships` WAJIB diisi, bukan
-- opsional: detail kelas membaca rosternya dari sana, dan rekap kehadiran
-- mengambil tanggal masuk dari sana. Mengisi `current_class_id` saja membuat
-- murid tampil di daftar utama tapi hilang dari roster kelasnya.
--
-- start_date 2026-08-14 disamakan dengan kohort lain, bukan tanggal migrasi
-- dijalankan. Rekap kehadiran menghitung sejak tanggal masuk kelas, jadi tanggal
-- yang lebih baru akan membuat jendela rekap keempat murid ini berbeda dari
-- teman-temannya tanpa alasan.
--
-- `auth_login_aliases` sengaja TIDAK diisi. Tabel itu tidak dirujuk satu baris
-- pun di backend Go — sisa era edge function Supabase — dan login murid dilayani
-- `resolveUser` yang membaca tabel santri langsung.

DO $$
DECLARE
    v_kelas uuid;
    v_murid record;
BEGIN
    SELECT id INTO v_kelas
    FROM public.classes
    WHERE nama_kelas = 'Kelas 6A' AND is_active AND deleted_at IS NULL
    LIMIT 1;

    IF v_kelas IS NULL THEN
        RAISE NOTICE 'Kelas 6A tidak ada; murid contoh dilewati.';
        RETURN;
    END IF;

    IF EXISTS (SELECT 1 FROM public.santri WHERE current_class_id = v_kelas AND deleted_at IS NULL) THEN
        RAISE NOTICE 'Kelas 6A sudah berisi murid; murid contoh dilewati.';
        RETURN;
    END IF;

    FOR v_murid IN
        SELECT * FROM (VALUES
            ('c3fa7a30-0000-0000-0000-000000000601'::uuid, 1, 'Galih Prasetyo', 'Galih', 'Laki-laki', DATE '2013-03-12', '26011', '9000000011', 'SBR2026011', 'Sutrisno Prasetyo', 'Wahyuni',        '081290001011', 'Jl. Kenanga No. 7, Baturaja'),
            ('c3fa7a30-0000-0000-0000-000000000602'::uuid, 2, 'Rani Oktaviani', 'Rani',  'Perempuan', DATE '2013-10-02', '26012', '9000000012', 'SBR2026012', 'Hendra Saputra',    'Lilis Suryani',  '081290001012', 'Jl. Melati No. 12, Baturaja'),
            ('c3fa7a30-0000-0000-0000-000000000603'::uuid, 3, 'Yusuf Maulana',  'Yusuf', 'Laki-laki', DATE '2013-05-28', '26013', '9000000013', 'SBR2026013', 'Ahmad Maulana',     'Siti Rohmah',    '081290001013', 'Jl. Cempaka No. 3, Baturaja'),
            ('c3fa7a30-0000-0000-0000-000000000604'::uuid, 4, 'Zahra Amelia',   'Zahra', 'Perempuan', DATE '2013-08-19', '26014', '9000000014', 'SBR2026014', 'Bambang Iskandar',  'Dewi Anggraini', '081290001014', 'Jl. Dahlia No. 9, Baturaja')
        ) AS t(id, urut, nama, panggilan, jk, lahir, nis, nisn, induk, ayah, ibu, hp, alamat)
    LOOP
        INSERT INTO auth.users (id, email)
        VALUES (v_murid.id, 'santri+' || v_murid.id || '@auth.sekolah.local')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.user_profiles (id, role, display_name, status)
        VALUES (v_murid.id, 'santri'::public.app_role, v_murid.nama, 'active')
        ON CONFLICT (id) DO NOTHING;

        -- `angkatan` dan `default_spp_amount` disamakan dengan sepuluh murid contoh
        -- lainnya. Tanpa keduanya, keempat murid ini terlihat lebih kosong daripada
        -- teman-temannya di tabel Data Murid (kolom Angkatan bertanda hubung) dan
        -- kasir tidak punya nominal SPP bawaan untuk mereka.
        --
        -- `jilid` SENGAJA dibiarkan NULL. Murid lain memakai 'Jilid 1'/'Jilid 2',
        -- label metode Qiroati, padahal `tahfizh_config` sekolah ini menyetel
        -- metode 'iqro' yang tingkatnya 'Iqro 1'..'Iqro 6'. Jadi nilai yang ada
        -- justru tidak terdaftar di metode sekolahnya sendiri, dan menyalinnya
        -- hanya memperbanyak data yang tidak cocok. Diisi setelah pemilik memutuskan
        -- metode mana yang benar.
        INSERT INTO public.santri (
            id, nama_lengkap, nama_panggilan, jenis_kelamin, tempat_lahir, tanggal_lahir,
            tanggal_pendaftaran, nis, nisn, nomor_induk, nama_ayah, nama_ibu, no_hp_ortu,
            alamat, kategori, status, password, current_class_id, order_in_class,
            angkatan, default_spp_amount
        )
        VALUES (
            v_murid.id, v_murid.nama, v_murid.panggilan, v_murid.jk, 'Baturaja', v_murid.lahir,
            DATE '2026-08-14', v_murid.nis, v_murid.nisn, v_murid.induk, v_murid.ayah, v_murid.ibu, v_murid.hp,
            v_murid.alamat, 'Anak', 'Aktif',
            extensions.crypt(v_murid.nis, extensions.gen_salt('bf', 12)),
            v_kelas, v_murid.urut,
            '2026/2027', 75000.00
        )
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.class_memberships (santri_id, class_id, start_date, status, order_in_class)
        VALUES (v_murid.id, v_kelas, DATE '2026-08-14', 'active', v_murid.urut)
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;
