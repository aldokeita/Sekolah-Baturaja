-- Jurnal mengajar guru — catatan harian tiap pertemuan.
--
-- Setiap guru wajib mencatat apa yang diajarkan pada setiap pertemuan: materi,
-- jumlah murid yang hadir, dan kendala yang ditemui. Kepala sekolah memeriksanya
-- berkala, dan pengawas menanyakannya. Sebelum ini seluruhnya ditulis di buku
-- tulis, sehingga tidak pernah bisa direkap tanpa membuka dua puluh buku.
--
-- Bedanya dengan `kelas_konten` (Materi & Tugas, yang sekarang dimatikan):
-- kelas_konten ditujukan KEPADA MURID — papan pengumuman kelas. Jurnal ini
-- catatan guru untuk atasannya, dan murid tidak pernah melihatnya.

CREATE TABLE IF NOT EXISTS public.jurnal_mengajar (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  guru_id           uuid NOT NULL REFERENCES public.guru(id) ON DELETE CASCADE,
  class_id          uuid NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  mata_pelajaran_id uuid NOT NULL REFERENCES public.mata_pelajaran(id) ON DELETE RESTRICT,
  periode_id        uuid NOT NULL REFERENCES public.periode_ajaran(id) ON DELETE RESTRICT,

  tanggal           date NOT NULL DEFAULT CURRENT_DATE,
  -- Jam pelajaran keberapa, mis. "1-2". Teks, bukan angka: satu catatan sering
  -- mencakup dua jam pelajaran yang berurutan.
  jam_ke            text,

  materi            text NOT NULL CHECK (btrim(materi) <> ''),
  jumlah_hadir      integer CHECK (jumlah_hadir IS NULL OR jumlah_hadir >= 0),
  jumlah_murid      integer CHECK (jumlah_murid IS NULL OR jumlah_murid >= 0),
  kendala           text,
  tindak_lanjut     text,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid REFERENCES auth.users(id),
  updated_by        uuid REFERENCES auth.users(id)
);

-- Satu pertemuan satu catatan. Tanpa penjagaan ini, guru yang menekan simpan dua
-- kali — atau mengisi ulang jurnal yang sudah diisi kemarin — menghasilkan dua
-- baris untuk jam yang sama, dan rekap kepala sekolah menghitungnya dua kali.
-- COALESCE dipakai karena jam_ke boleh kosong, dan NULL tidak pernah bentrok
-- dengan NULL pada indeks unik biasa.
CREATE UNIQUE INDEX IF NOT EXISTS jurnal_mengajar_pertemuan_unik
  ON public.jurnal_mengajar (guru_id, class_id, mata_pelajaran_id, tanggal, COALESCE(jam_ke, ''));

CREATE INDEX IF NOT EXISTS jurnal_mengajar_guru_tanggal_idx
  ON public.jurnal_mengajar (guru_id, tanggal DESC);
CREATE INDEX IF NOT EXISTS jurnal_mengajar_kelas_periode_idx
  ON public.jurnal_mengajar (class_id, periode_id, tanggal DESC);

DROP TRIGGER IF EXISTS set_jurnal_mengajar_updated_at ON public.jurnal_mengajar;
CREATE TRIGGER set_jurnal_mengajar_updated_at
  BEFORE UPDATE ON public.jurnal_mengajar
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE public.jurnal_mengajar IS
  'Jurnal mengajar guru: satu baris per pertemuan. Catatan guru untuk kepala sekolah — murid tidak pernah melihatnya (bandingkan kelas_konten, yang ditujukan kepada murid).';
