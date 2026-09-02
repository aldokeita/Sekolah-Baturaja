-- Surat keterangan sekolah beserta penomorannya, dan mutasi keluar murid.
--
-- Dua hal ini satu migrasi karena saling terkait: surat pindah adalah salah satu
-- jenis surat, dan mutasi keluar murid-lah yang menerbitkannya.
--
-- Yang dikerjakan tata usaha setiap pekan sebelum ini: menulis ulang surat
-- keterangan aktif sekolah di Word, menomorinya dari buku agenda, lalu
-- menyimpannya di folder yang tidak pernah dicari lagi. Tidak ada satu pun
-- bagian itu yang ada di aplikasi.

-- ── Surat ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.surat (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Nomor lengkap yang tercetak, mis. "421.2/012/SDN-BTR/IX/2026". Disusun
  -- server dari nomor_urut, kode klasifikasi, kode sekolah, bulan romawi, dan
  -- tahun. Disimpan JADI, bukan dihitung ulang saat dibaca: sekolah boleh
  -- mengganti kode klasifikasinya kapan saja, dan surat yang sudah keluar tidak
  -- boleh berubah nomornya gara-gara itu.
  nomor         text NOT NULL,

  -- Nomor urut agenda surat keluar, berulang dari 1 setiap tahun. Itu cara buku
  -- agenda surat sekolah bekerja: satu deret per tahun untuk SEMUA jenis surat,
  -- bukan satu deret per jenis.
  nomor_urut    integer NOT NULL CHECK (nomor_urut > 0),
  tahun         integer NOT NULL CHECK (tahun BETWEEN 2000 AND 2200),

  jenis         text NOT NULL CHECK (jenis IN (
                  'keterangan_aktif', 'pindah', 'tidak_mampu', 'umum')),

  -- Murid yang menjadi pokok surat. NULL untuk surat umum yang tidak menyebut
  -- murid mana pun. ON DELETE SET NULL, BUKAN CASCADE: surat yang sudah keluar
  -- adalah catatan resmi sekolah dan tidak boleh hilang karena baris muridnya
  -- dihapus — nama serta nomor induknya sudah tersimpan di kolom di bawah.
  santri_id     uuid REFERENCES public.santri(id) ON DELETE SET NULL,

  -- Salinan identitas murid pada saat surat dibuat. Ini bukan pengulangan yang
  -- sia-sia: surat menyatakan keadaan pada tanggal tertentu, dan murid yang
  -- kelasnya naik atau namanya diperbaiki tidak boleh mengubah isi surat yang
  -- sudah ditandatangani kepala sekolah.
  santri_nama   text,
  santri_nomor  text,
  santri_kelas  text,

  perihal       text NOT NULL,
  penerima      text,              -- tujuan surat: sekolah, bank, dinas, dll.
  isi           text,              -- tambahan/keterangan yang diketik petugas
  tanggal_surat date NOT NULL DEFAULT CURRENT_DATE,

  -- Isian khusus per jenis (sekolah tujuan, alasan pindah, keperluan). Disimpan
  -- jsonb supaya jenis surat baru tidak menuntut kolom baru.
  data          jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Surat yang salah DIBATALKAN, tidak dihapus, dan nomornya tidak pernah
  -- dipakai ulang. Buku agenda surat tidak boleh punya nomor yang hilang —
  -- nomor yang lompat adalah pertanyaan pertama pengawas.
  dibatalkan       boolean NOT NULL DEFAULT false,
  alasan_batal     text,
  dibatalkan_pada  timestamptz,
  dibatalkan_oleh  uuid REFERENCES auth.users(id),

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES auth.users(id),
  updated_by    uuid REFERENCES auth.users(id)
);

-- Satu nomor urut per tahun, dijaga basis data. Dua petugas yang menekan simpan
-- pada saat yang sama tidak boleh menghasilkan dua surat bernomor sama; handler
-- Go mengandalkan bentrokan di sini untuk mengulang dengan nomor berikutnya.
CREATE UNIQUE INDEX IF NOT EXISTS surat_nomor_urut_tahun_unik
  ON public.surat (tahun, nomor_urut);

CREATE UNIQUE INDEX IF NOT EXISTS surat_nomor_unik ON public.surat (nomor);
CREATE INDEX IF NOT EXISTS surat_santri_idx ON public.surat (santri_id);
CREATE INDEX IF NOT EXISTS surat_jenis_tahun_idx ON public.surat (jenis, tahun);
CREATE INDEX IF NOT EXISTS surat_tanggal_idx ON public.surat (tanggal_surat DESC);

DROP TRIGGER IF EXISTS set_surat_updated_at ON public.surat;
CREATE TRIGGER set_surat_updated_at
  BEFORE UPDATE ON public.surat
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE public.surat IS
  'Agenda surat keluar sekolah. Nomor urut berulang per tahun untuk semua jenis; surat yang salah dibatalkan, tidak dihapus, agar tidak ada nomor yang lompat.';

-- ── Mutasi keluar murid ──────────────────────────────────────────────────────
--
-- Sebelum ini, murid yang pindah sekolah hanya "diarsipkan" dengan satu kolom
-- alasan berupa teks bebas. Tidak ada tanggal keluar, tidak ada tujuan, dan
-- tidak ada nomor surat — padahal ketiganya yang ditanyakan saat sekolah tujuan
-- meminta berkas atau saat dinas memeriksa buku mutasi.

ALTER TABLE public.santri
  ADD COLUMN IF NOT EXISTS tanggal_keluar  date,
  ADD COLUMN IF NOT EXISTS alasan_keluar   text,
  ADD COLUMN IF NOT EXISTS sekolah_tujuan  text,
  ADD COLUMN IF NOT EXISTS surat_pindah_id uuid REFERENCES public.surat(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.santri.alasan_keluar IS
  'Pindah, Lulus, Berhenti, atau alasan lain yang ditulis petugas. NULL berarti murid masih aktif.';

CREATE INDEX IF NOT EXISTS santri_tanggal_keluar_idx
  ON public.santri (tanggal_keluar DESC) WHERE tanggal_keluar IS NOT NULL;
