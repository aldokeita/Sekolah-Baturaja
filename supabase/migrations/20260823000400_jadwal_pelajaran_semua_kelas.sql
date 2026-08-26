-- Jadwal pelajaran untuk SELURUH kelas contoh, satu periode aktif.
--
-- Panel Jadwal Pelajaran sebelumnya kosong, sehingga dashboard guru selalu
-- menampilkan "Belum ada jadwal mengajar untuk periode ini" dan rekap kehadiran
-- per mata pelajaran tidak punya apa pun untuk dirujuk.
--
-- ── Bentuk hari sekolah ──────────────────────────────────────────────────────
-- Tiga blok per hari Senin–Jumat, satu blok pada Sabtu. Sabtu ikut dipakai
-- karena `academic_calendar_month_settings` menyetel saturday_is_holiday = false,
-- jadi rekap kehadiran memang menghitung Sabtu sebagai hari sekolah. Kalau
-- sekolah pindah ke lima hari, hapus baris hari ke-6 dan pindahkan bloknya.
--
--   blok 1  07.00–08.10      blok 2  08.10–09.20      blok 3  09.40–10.50
--
-- Jeda 09.20–09.40 tidak dicatat sebagai baris: tabel ini menyimpan jam
-- pelajaran, bukan istirahat.
--
-- ── Beban tiap kelas: 16 blok per pekan ──────────────────────────────────────
--   Bahasa Indonesia 3 · Matematika 3 · Pendidikan Agama 2 · Pendidikan
--   Pancasila 2 · IPAS 2 · Seni Budaya 1 · Bahasa Inggris 1 · Muatan Lokal 1 ·
--   PJOK 1
--
-- ── Siapa mengajar apa, dan mengapa ──────────────────────────────────────────
-- Wali kelas mengajar SEMUA mata pelajaran kelasnya kecuali Pendidikan Agama.
-- Itu pola guru kelas di SD, dan sekaligus satu-satunya susunan yang bebas
-- bentrok dengan jumlah guru yang ada di sekolah ini.
--
-- Pendidikan Agama dipegang satu guru mata pelajaran untuk keenam kelas: 2 blok
-- x 6 kelas = 12 blok, dan ke-12 blok itu ditaruh pada jam yang BERBEDA SEMUA.
-- Rumusnya slot ke-n dan ke-(n+9) untuk kelas ke-n, sehingga Rabu dan Sabtu
-- bersih dari Agama dan tidak ada dua kelas yang memanggil guru yang sama pada
-- jam yang sama.
--
-- PJOK dipegang wali kelas masing-masing, bukan guru olahraga terpisah. Sekolah
-- ini hanya punya satu guru mata pelajaran aktif; kalau ia memegang Agama (12
-- blok) sekaligus PJOK (6 blok), totalnya 18 blok padahal satu pekan cuma punya
-- 16 slot — mustahil, bukan sekadar padat.
--
-- Kelas yang belum punya wali kelas memakai guru kelas aktif yang belum
-- memegang kelas mana pun. Kalau tidak ada, guru_id dibiarkan NULL: jadwalnya
-- tetap terbentuk dan admin bisa menunjuk gurunya nanti, karena kolomnya memang
-- nullable. Yang tidak boleh terjadi adalah jadwalnya tidak ada sama sekali.
--
-- Aman dijalankan berulang: ON CONFLICT DO NOTHING bersandar pada
-- `jadwal_pelajaran_slot_unik`.

DO $$
DECLARE
    v_periode   uuid;
    v_pengganti uuid;
    v_guru_pai  uuid;
    v_kelas     record;
    v_n         int := 0;
    v_slot      int;
    v_isi       int;
    v_mapel     text;
    v_guru      uuid;

    -- 16 slot sepekan: Senin–Jumat tiga blok, Sabtu satu blok.
    v_hari    smallint[] := ARRAY[1,1,1, 2,2,2, 3,3,3, 4,4,4, 5,5,5, 6];
    v_mulai   time[]     := ARRAY['07:00','08:10','09:40','07:00','08:10','09:40','07:00','08:10','09:40','07:00','08:10','09:40','07:00','08:10','09:40','07:00'];
    v_selesai time[]     := ARRAY['08:10','09:20','10:50','08:10','09:20','10:50','08:10','09:20','10:50','08:10','09:20','10:50','08:10','09:20','10:50','08:10'];

    -- 14 blok non-Agama, diurutkan supaya mata pelajaran yang sama tidak
    -- berdempetan pada hari yang sama.
    v_urutan  text[] := ARRAY[
        'Bahasa Indonesia', 'Matematika', 'Pendidikan Pancasila',
        'Ilmu Pengetahuan Alam dan Sosial', 'Bahasa Indonesia', 'Matematika',
        'Seni Budaya dan Prakarya', 'Ilmu Pengetahuan Alam dan Sosial',
        'Bahasa Indonesia', 'Matematika', 'Pendidikan Pancasila',
        'Bahasa Inggris', 'Muatan Lokal',
        'Pendidikan Jasmani, Olahraga, dan Kesehatan'
    ];
BEGIN
    SELECT id INTO v_periode FROM public.periode_ajaran WHERE is_active ORDER BY created_at DESC LIMIT 1;
    IF v_periode IS NULL THEN
        RAISE NOTICE 'Tidak ada periode ajaran aktif; jadwal dilewati.';
        RETURN;
    END IF;

    -- Hanya jabatan yang benar-benar mengajar. Tanpa pagar `jabatan LIKE 'Guru%'`
    -- ini, kandidatnya termasuk akun Administrator — jabatannya NULL dan ia tidak
    -- memegang kelas, jadi ia lolos semua syarat lain. Pada percobaan pertama
    -- seluruh jam Pendidikan Agama keenam kelas memang jatuh ke Administrator.
    --
    -- Penyebabnya halus: `ORDER BY (jabatan = 'Guru Mata Pelajaran') DESC`
    -- membandingkan NULL sehingga hasilnya NULL, dan Postgres menaruh NULL
    -- PALING AWAL pada DESC. Karena itu urutannya sekarang memakai NULLS LAST
    -- di samping pagar jabatan.

    -- Guru kelas aktif yang belum memegang kelas mana pun, untuk kelas yang
    -- walinya belum ditunjuk.
    SELECT g.id INTO v_pengganti
    FROM public.guru g
    WHERE g.status = 'active'
      AND g.jabatan LIKE 'Guru Kelas%'
      AND NOT EXISTS (SELECT 1 FROM public.classes c WHERE c.is_active AND c.id_guru = g.id)
    ORDER BY g.nama
    LIMIT 1;

    -- Pengajar Pendidikan Agama: guru yang tidak memegang kelas, supaya ia tidak
    -- pernah bentrok dengan kelasnya sendiri. Guru mata pelajaran didahulukan.
    SELECT g.id INTO v_guru_pai
    FROM public.guru g
    WHERE g.status = 'active'
      AND g.jabatan LIKE 'Guru%'
      AND NOT EXISTS (SELECT 1 FROM public.classes c WHERE c.is_active AND c.id_guru = g.id)
      AND g.id IS DISTINCT FROM v_pengganti
    ORDER BY (g.jabatan = 'Guru Mata Pelajaran') DESC NULLS LAST, g.nama
    LIMIT 1;

    FOR v_kelas IN
        SELECT c.id, c.nama_kelas, c.id_guru
        FROM public.classes c
        WHERE c.is_active
        ORDER BY c.nama_kelas
    LOOP
        v_n := v_n + 1;
        v_isi := 0;

        FOR v_slot IN 1..16 LOOP
            -- Slot ke-n dan ke-(n+9) milik Pendidikan Agama untuk kelas ke-n.
            IF v_slot = v_n OR v_slot = v_n + 9 THEN
                v_mapel := 'Pendidikan Agama dan Budi Pekerti';
                v_guru  := v_guru_pai;
            ELSE
                v_isi := v_isi + 1;
                EXIT WHEN v_isi > array_length(v_urutan, 1);
                v_mapel := v_urutan[v_isi];
                v_guru  := COALESCE(v_kelas.id_guru, v_pengganti);
            END IF;

            -- `ruang` dibiarkan NULL. Sempat diisi nama kelas, dan kartu jadwal di
            -- dashboard guru langsung menampilkan "Kelas 4A Kelas 4A" karena ia
            -- memang menampilkan kelas DAN ruang. Nama ruang hanya diketahui
            -- sekolah; mengarangnya bukan tugas migrasi ini.
            INSERT INTO public.jadwal_pelajaran
                (periode_id, class_id, mata_pelajaran_id, guru_id, hari, jam_mulai, jam_selesai)
            SELECT v_periode, v_kelas.id, m.id, v_guru,
                   v_hari[v_slot], v_mulai[v_slot], v_selesai[v_slot]
            FROM public.mata_pelajaran m
            WHERE m.is_active AND lower(btrim(m.nama)) = lower(btrim(v_mapel))
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;
END $$;
