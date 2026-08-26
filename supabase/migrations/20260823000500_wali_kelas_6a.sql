-- Kelas 6A belum punya wali kelas, dan itu satu-satunya kelas contoh yang begitu.
--
-- Akibatnya di beberapa tempat sekaligus: tabel murid di dashboard guru tidak
-- punya siapa pun yang berhak membukanya, tombol pindah kelas mati karena hanya
-- wali kelas yang boleh memindahkan murid, dan jadwal pelajaran 6A harus
-- bersandar pada guru pengganti.
--
-- Yang ditunjuk: guru kelas aktif yang belum memegang kelas mana pun. Di data
-- contoh hanya ada satu, dan dia memang guru kelas — bukan tata usaha, bukan
-- kepala sekolah, bukan akun sistem. Pagar `jabatan LIKE 'Guru Kelas%'` itu yang
-- menahan akun Administrator (jabatannya NULL, dan ia juga tidak memegang kelas)
-- ikut terpilih; kekeliruan itu sudah pernah terjadi saat menyusun jadwal.
--
-- Kalau tidak ada kandidat, atau 6A sudah punya wali, migrasi ini tidak
-- mengubah apa pun — termasuk kalau pembeli sudah menunjuk walinya sendiri.
-- Aman dijalankan berulang.

UPDATE public.classes c
SET id_guru = (
        SELECT g.id
        FROM public.guru g
        WHERE g.status = 'active'
          AND g.jabatan LIKE 'Guru Kelas%'
          AND NOT EXISTS (
                SELECT 1 FROM public.classes x
                WHERE x.is_active AND x.deleted_at IS NULL AND x.id_guru = g.id
              )
        ORDER BY g.nama
        LIMIT 1
    ),
    updated_at = now()
WHERE c.nama_kelas = 'Kelas 6A'
  AND c.is_active
  AND c.deleted_at IS NULL
  AND c.id_guru IS NULL
  AND EXISTS (
        SELECT 1
        FROM public.guru g
        WHERE g.status = 'active'
          AND g.jabatan LIKE 'Guru Kelas%'
          AND NOT EXISTS (
                SELECT 1 FROM public.classes x
                WHERE x.is_active AND x.deleted_at IS NULL AND x.id_guru = g.id
              )
      );
