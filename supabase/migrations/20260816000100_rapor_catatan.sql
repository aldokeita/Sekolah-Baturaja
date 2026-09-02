-- Catatan wali kelas pada rapor.
--
-- Satu baris = satu catatan untuk seorang murid pada satu periode ajaran.
-- Sebelumnya catatan ini hanya hidup di dalam form cetak: menutup dialognya
-- menghilangkannya. Wali kelas yang menulis catatan untuk dua puluh delapan
-- murid kehilangan seluruh pekerjaannya karena satu klik salah.
--
-- Yang disimpan HANYA catatannya. Nilai dan kehadiran tetap dibaca dari sumber
-- masing-masing saat rapor disusun (lihat src/lib/raporAdapters.js); menyalinnya
-- ke sini akan membuat rapor yang dicetak ulang berbeda dari data sekolah yang
-- sebenarnya.
--
-- Penjagaan hak akses ada di Go (`rapor.go`), sesuai pola repositori ini: pool
-- terhubung sebagai superuser, jadi RLS tidak menggawangi permintaan hidup.

CREATE TABLE IF NOT EXISTS rapor_catatan (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  santri_id  uuid NOT NULL REFERENCES santri(id) ON DELETE CASCADE,
  periode_id uuid NOT NULL REFERENCES periode_ajaran(id) ON DELETE CASCADE,

  catatan    text NOT NULL,

  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,

  -- Satu catatan per murid per periode. Tanpa batasan ini, menyimpan dua kali
  -- menghasilkan dua baris dan rapor mencetak salah satunya tanpa aturan.
  CONSTRAINT rapor_catatan_unik UNIQUE (santri_id, periode_id),
  CONSTRAINT rapor_catatan_tidak_kosong CHECK (btrim(catatan) <> '')
);

CREATE INDEX IF NOT EXISTS rapor_catatan_periode_idx
  ON rapor_catatan (periode_id);

DROP TRIGGER IF EXISTS set_rapor_catatan_updated_at ON rapor_catatan;
CREATE TRIGGER set_rapor_catatan_updated_at
  BEFORE UPDATE ON rapor_catatan
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE rapor_catatan ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rapor_catatan_read_all ON rapor_catatan;
CREATE POLICY rapor_catatan_read_all ON rapor_catatan FOR SELECT USING (true);
