-- Melengkapi rapor ke komponen minimal Panduan BSKAP.
--
-- Panduan Pembelajaran dan Asesmen BSKAP (Edisi Revisi Ke-3, Juli 2025, hlm. 66)
-- menyebut dua belas komponen minimal rapor. Lembar cetak kita sudah memuat
-- sepuluh; yang kurang adalah narasi:
--
--   7.  Deskripsi Capaian Kompetensi  -> per mata pelajaran (tabel baru di bawah)
--   8.  Deskripsi Capaian Kokurikuler -> per murid per periode (kolom baru)
--   9.  Kegiatan ekstrakurikuler      -> per murid per periode (kolom baru)
--   12. Tanggapan Orang Tua/Wali      -> TIDAK disimpan; dicetak sebagai kolom
--       kosong untuk ditulis tangan wali, sebagaimana lazimnya rapor kertas.
--
-- Rujukan lengkap beserta sumber primernya ada di
-- docs/51-riset-rapor-resmi-kemendikdasmen.md.
--
-- Nama tabel `rapor_catatan` DIPERTAHANKAN meski isinya kini lebih dari sekadar
-- catatan wali kelas. Menggantinya berarti memutus data yang sudah tersimpan demi
-- nama yang lebih rapi — pertukaran yang tidak sepadan.

ALTER TABLE rapor_catatan
  ADD COLUMN IF NOT EXISTS deskripsi_kokurikuler text,
  ADD COLUMN IF NOT EXISTS ekstrakurikuler       text;

-- `catatan` tidak lagi boleh menjadi satu-satunya alasan sebuah baris ada: murid
-- bisa saja hanya punya catatan ekstrakurikuler tanpa catatan wali kelas. Batasan
-- lama menolak baris semacam itu, jadi diganti dengan "setidaknya satu terisi".
ALTER TABLE rapor_catatan ALTER COLUMN catatan DROP NOT NULL;
ALTER TABLE rapor_catatan DROP CONSTRAINT IF EXISTS rapor_catatan_tidak_kosong;
ALTER TABLE rapor_catatan ADD CONSTRAINT rapor_catatan_ada_isinya CHECK (
  btrim(coalesce(catatan, '')) <> ''
  OR btrim(coalesce(deskripsi_kokurikuler, '')) <> ''
  OR btrim(coalesce(ekstrakurikuler, '')) <> ''
);

-- Deskripsi capaian kompetensi: satu baris = satu mata pelajaran seorang murid
-- pada satu periode. Tabel terpisah, bukan kolom JSON pada rapor_catatan, karena
-- isinya diambil per mata pelajaran saat rapor disusun dan mata pelajaran bisa
-- dihapus — relasi yang sebenarnya layak ditegakkan basis data.
CREATE TABLE IF NOT EXISTS rapor_deskripsi_mapel (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  santri_id         uuid NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
  periode_id        uuid NOT NULL REFERENCES periode_ajaran(id) ON DELETE CASCADE,
  mata_pelajaran_id uuid NOT NULL REFERENCES mata_pelajaran(id) ON DELETE CASCADE,

  deskripsi         text NOT NULL,

  created_at        timestamp with time zone NOT NULL DEFAULT now(),
  updated_at        timestamp with time zone NOT NULL DEFAULT now(),
  created_by        uuid,
  updated_by        uuid,

  CONSTRAINT rapor_deskripsi_mapel_unik UNIQUE (santri_id, periode_id, mata_pelajaran_id),
  CONSTRAINT rapor_deskripsi_mapel_tidak_kosong CHECK (btrim(deskripsi) <> '')
);

CREATE INDEX IF NOT EXISTS rapor_deskripsi_mapel_rapor_idx
  ON rapor_deskripsi_mapel (santri_id, periode_id);

DROP TRIGGER IF EXISTS set_rapor_deskripsi_mapel_updated_at ON rapor_deskripsi_mapel;
CREATE TRIGGER set_rapor_deskripsi_mapel_updated_at
  BEFORE UPDATE ON rapor_deskripsi_mapel
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE rapor_deskripsi_mapel ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rapor_deskripsi_mapel_read_all ON rapor_deskripsi_mapel;
CREATE POLICY rapor_deskripsi_mapel_read_all ON rapor_deskripsi_mapel FOR SELECT USING (true);
