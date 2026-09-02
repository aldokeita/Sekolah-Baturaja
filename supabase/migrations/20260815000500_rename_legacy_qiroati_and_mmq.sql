-- Membuang dua nama warisan produk madrasah dari skema.
--
--   santri.nomor_induk_qiroati  ->  santri.nomor_induk
--   mmq_schedule                ->  rapat_guru_jadwal
--   mmq_attendance              ->  rapat_guru_absensi
--   mmq_notulensi               ->  rapat_guru_notulensi
--
-- Migrasi ini WAJIB berada paling akhir. Migrasi-migrasi terdahulu menyebut nama
-- lamanya dan tidak boleh disunting; pada basis data baru semuanya berjalan lebih
-- dulu, lalu berkas ini mengganti namanya di penghujung.
--
-- `ALTER TABLE ... RENAME` mempertahankan seluruh data, indeks, batasan, dan
-- foreign key — tidak ada baris yang disalin atau hilang.

-- ── 1. Nomor induk murid ─────────────────────────────────────────────────────
-- Dipakai sebagai salah satu identitas login murid di auth.go, jadi namanya ikut
-- disesuaikan di sana pada perubahan yang sama.
ALTER TABLE santri RENAME COLUMN nomor_induk_qiroati TO nomor_induk;

-- ── 2. Nomor induk guru yang selama ini tidak pernah ada ─────────────────────
-- Panel Data Guru punya field "NUPTK" yang menulis ke `nomor_induk_qiroati` pada
-- tabel `guru` — kolom yang TIDAK PERNAH ADA. Nilainya disaring habis oleh
-- allowlist `guruEditable`, jadi apa pun yang diketik admin hilang tanpa pesan
-- dan kolomnya selamanya tampil "-". Kolomnya dibuat sekarang, dengan nama yang
-- benar.
ALTER TABLE guru ADD COLUMN IF NOT EXISTS nuptk text;

COMMENT ON COLUMN guru.nuptk IS
  'Nomor Unik Pendidik dan Tenaga Kependidikan. Opsional; tidak semua guru memilikinya.';

-- ── 3. Tabel rapat guru ──────────────────────────────────────────────────────
-- Fitur ini sudah lama dialihfungsikan jadi rapat internal sekolah; hanya nama
-- tabelnya yang masih tertinggal. Lihat "Normalisasi Rapat Guru" di
-- docs/HANDOFF.md.
ALTER TABLE mmq_schedule   RENAME TO rapat_guru_jadwal;
ALTER TABLE mmq_attendance RENAME TO rapat_guru_absensi;
ALTER TABLE mmq_notulensi  RENAME TO rapat_guru_notulensi;

-- Nama batasan ikut dibawa apa adanya oleh RENAME, jadi masih berawalan `mmq_`.
-- Yang namanya disebut di kode diganti agar tidak menyesatkan pembaca berikutnya.
--
-- Catatan: batasannya bernama `..._status_not_blank`, BUKAN `..._status_check`.
-- `rapatGuruAdapters.js` selama ini mencocokkan `mmq_attendance_status_check`,
-- nama yang tidak pernah ada, sehingga penerjemahan pesan galatnya tidak pernah
-- aktif. Nama yang benar dipakai di perubahan yang sama.
ALTER TABLE rapat_guru_absensi
  RENAME CONSTRAINT mmq_attendance_status_not_blank TO rapat_guru_absensi_status_not_blank;
