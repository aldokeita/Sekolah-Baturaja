-- Antrean notifikasi WhatsApp keluar (outbox).
--
-- Semua pesan WA otomatis (absensi non-Hadir, kwitansi pembayaran, hasil PPDB,
-- broadcast admin, uji kirim) masuk ke sini lebih dulu sebagai baris `pending`,
-- lalu pekerja latar belakang di backend Go mengirimkannya lewat gateway
-- (kompatibel Fonnte) dan mencatat hasilnya. Dengan outbox, kegagalan gateway
-- tidak pernah menggagalkan aksi utama (absensi tetap tersimpan walau WA mati),
-- dan setiap pesan punya jejak yang bisa dilihat admin serta diulang kirimnya.
--
-- Deduplikasi: UNIQUE (purpose, ref_id). Tap RFID ganda tidak menghasilkan dua
-- pesan karena baris absensi duplikat memang ditolak di atasnya; status PPDB
-- yang dikirim ulang dengan nilai sama juga hanya menghasilkan satu pesan.
--
-- Penjagaan hak akses ada di Go (`handler/wanotify.go`), sesuai pola repositori
-- ini: pool terhubung sebagai superuser sehingga RLS tidak menggawangi permintaan
-- hidup; policy di bawah hanya menjaga jalur akses langsung lain.

CREATE TABLE IF NOT EXISTS wa_outbox (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose        text NOT NULL CHECK (purpose IN ('absensi','pembayaran','ppdb','test','broadcast')),
  ref_id         text NOT NULL,
  santri_id      uuid,
  target_phone   text NOT NULL,
  message        text NOT NULL,
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  attempts       integer NOT NULL DEFAULT 0,
  last_error     text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  sent_at        timestamptz,
  created_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT wa_outbox_purpose_ref_unique UNIQUE (purpose, ref_id),
  CONSTRAINT wa_outbox_message_not_blank CHECK (btrim(message) <> ''),
  CONSTRAINT wa_outbox_attempts_non_negative CHECK (attempts >= 0)
);

CREATE INDEX IF NOT EXISTS wa_outbox_worker_idx
  ON wa_outbox (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS wa_outbox_created_idx
  ON wa_outbox (created_at DESC);

ALTER TABLE wa_outbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wa_outbox_read_all ON wa_outbox;
CREATE POLICY wa_outbox_read_all ON wa_outbox FOR SELECT USING (true);
