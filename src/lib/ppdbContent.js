import { fetchWebsiteContentMap, saveWebsiteContentItem } from '@/lib/publicContentAdapters';

/**
 * Isi halaman pendaftaran murid baru (PPDB) yang dapat disunting pembeli.
 *
 * Kenapa berkas ini ada: halaman PPDB menanam seluruh ketentuan sekolah di kode —
 * empat jalur pendaftaran, empat berkas yang diminta, jadwal "1 Juli – 20
 * Agustus", batas usia, dan program pendukung yang salah satunya "Tahfiz". Semua
 * itu berbeda di tiap sekolah, dan sebagian bahkan tidak berlaku untuk sekolah
 * umum. Pembeli tidak bisa mengubahnya tanpa menyentuh kode.
 *
 * Menggantikan panel "Informasi Pendaftaran" yang lama, yang mengelola kunci
 * `enrollmentInfo` berisi kategori "Murid TPQ (Anak)" dan "Murid Dewasa" beserta
 * rincian biaya sekolah Al-Qur'an — dan **tidak dirender halaman mana pun**.
 *
 * Tahun ajaran TIDAK di sini: ia bagian dari Identitas Sekolah karena dipakai di
 * banyak tempat. Halaman PPDB menyusun labelnya dari sana.
 */

export const PPDB_CONTENT_KEY = 'ppdb_content';

export const DEFAULT_PPDB_CONTENT = Object.freeze({
  waveLabel: 'Gelombang 1 · tutup 20 Agustus',
  intro: 'Diisi oleh orang tua atau wali calon murid kelas satu. Data tersimpan otomatis di perangkat ini, jadi Anda bisa melanjutkan kapan saja sebelum tenggat.',

  /* Jalur pendaftaran. `id` dipakai sebagai nilai tersimpan pada formulir, jadi
   * biarkan tetap bila jalurnya hanya berubah nama.
   *
   * ── Mengikuti Permendikdasmen No. 3 Tahun 2025 ──────────────────────────────
   *
   * Aturan itu mencabut Permendikbud No. 1 Tahun 2021, mengganti PPDB menjadi
   * SPMB, dan mengubah jalurnya. Bawaan di sini dulu memakai aturan lama:
   *
   *   "Zonasi"            → sekarang "Domisili". Bukan hanya berganti nama:
   *                         zonasi menghitung jarak garis lurus, domisili memakai
   *                         wilayah administratif yang ditetapkan pemerintah
   *                         daerah (kelurahan, kecamatan, atau radius).
   *   "Perpindahan tugas" → sekarang "Mutasi".
   *   "Prestasi"          → DIBUANG. Aturannya tegas: jalur prestasi tidak
   *                         diberlakukan untuk penerimaan murid kelas I SD.
   *                         Template ini untuk SD, jadi memasangnya sebagai
   *                         bawaan berarti menyarankan jalur yang tidak sah.
   *
   * `kuota` adalah persentase daya tampung sekolah. Angka bawaannya persis yang
   * ditetapkan untuk SD: domisili paling sedikit 70%, afirmasi paling sedikit 15%,
   * mutasi paling BANYAK 5% (batas atas, bukan batas bawah). Sekolah tetap bisa
   * mengubahnya — aturan daerah bisa berbeda, dan sistem tidak menegur. */
  jalur: Object.freeze([
    { id: 'domisili', name: 'Domisili', desc: 'Berdasarkan wilayah tempat tinggal yang ditetapkan pemerintah daerah', kuota: 70 },
    { id: 'afirmasi', name: 'Afirmasi', desc: 'Untuk keluarga tidak mampu dan penyandang disabilitas', kuota: 15 },
    { id: 'mutasi', name: 'Mutasi', desc: 'Anak dari orang tua yang dipindahtugaskan', kuota: 5 },
  ]),

  // Program pendukung yang boleh dipilih calon murid. Bawaannya sengaja tidak
  // memuat program keagamaan: template ini untuk sekolah umum, dan sekolah yang
  // menjalankannya tinggal menambah sendiri.
  minat: Object.freeze(['Bahasa Inggris', 'Sains cilik', 'Seni tari', 'Olahraga']),

  /* Daftar CENTANG kesiapan berkas, bukan unggahan. Halaman publik tidak menerima
   * unggahan berkas: endpoint unggah ada di balik login, dan membukanya untuk
   * pengunjung yang tidak dikenal berarti menerima berkas dari siapa saja. Berkas
   * aslinya diperiksa saat daftar ulang, jadi petunjuknya menyebut bentuk fisiknya
   * — bukan "maks 2 MB" yang dulu tertulis di sini untuk unggahan yang tidak ada. */
  berkas: Object.freeze([
    { id: 'kk', name: 'Kartu keluarga', hint: 'Fotokopi, dibawa saat daftar ulang' },
    { id: 'akta', name: 'Akta kelahiran', hint: 'Fotokopi, dibawa saat daftar ulang' },
    { id: 'rapor', name: 'Surat keterangan TK atau RA', hint: 'Bila anak pernah bersekolah' },
    { id: 'foto', name: 'Pas foto 3×4', hint: 'Latar biru atau merah, 2 lembar' },
  ]),

  timeline: Object.freeze([
    { when: '1 Juli – 20 Agustus', what: 'Pengisian formulir daring' },
    { when: '23 Agustus', what: 'Pengumuman hasil seleksi' },
    { when: '25 – 29 Agustus', what: 'Daftar ulang di ruang tata usaha' },
  ]),

  /* Daftar "yang perlu disiapkan". `{tahun}` diganti tahun pembuka dari tahun
   * ajaran di Identitas, supaya syarat usia tidak perlu disunting ulang setiap
   * tahun. Lihat isiPenanda. */
  /* Syarat usia mengikuti Permendikdasmen No. 3 Tahun 2025: yang diprioritaskan
   * berusia 7 tahun, dan 6 tahun adalah batas paling rendah. Bawaan lama hanya
   * menulis "minimal 6 tahun", yang membuat orang tua anak berusia 7 mengira
   * dirinya tidak diutamakan. */
  requirements: Object.freeze([
    'Kartu keluarga dan akta kelahiran',
    'Diprioritaskan berusia 7 tahun, paling rendah 6 tahun pada 1 Juli {tahun}',
    'Pas foto berwarna 3×4',
    'Surat keterangan dari TK atau RA bila ada',
  ]),
});

const teks = (value) => String(value ?? '').trim();

const normalizeDaftar = (rows, fallback, mapper) => {
  if (!Array.isArray(rows)) return fallback;
  const hasil = rows.map(mapper).filter(Boolean);
  return hasil.length > 0 ? hasil : fallback;
};

/**
 * Membuat `id` yang aman dari sebuah nama, untuk baris baru yang ditambah pembeli.
 * Formulir menyimpan `id` jalur dan berkas, jadi ia tidak boleh kosong atau
 * mengandung spasi.
 */
const jadikanId = (nama, urutan) => teks(nama)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '') || `item-${urutan + 1}`;

/**
 * Kuota jalur sebagai persentase daya tampung.
 *
 * Dijepit 0–100 dan dibulatkan: kotak isian menerima teks apa saja, dan angka
 * seperti −20 atau 250 akan membuat hitungan kursi di panel jadi tidak masuk akal.
 * Kosong berarti nol, yang berarti "jalur ini tidak diberi kuota" — sah, karena
 * sekolah boleh menutup satu jalur tanpa menghapusnya dari daftar.
 */
const angkaKuota = (nilai) => {
  const n = Number(String(nilai ?? '').trim());
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(100, Math.round(n));
};

export const normalizePpdbContent = (stored) => {
  const source = stored && typeof stored === 'object' ? stored : {};
  const bawaan = DEFAULT_PPDB_CONTENT;

  return {
    waveLabel: teks(source.waveLabel) || bawaan.waveLabel,
    intro: teks(source.intro) || bawaan.intro,

    jalur: normalizeDaftar(source.jalur, bawaan.jalur, (row, i) => {
      const name = teks(row?.name);
      if (!name) return null;
      return {
        id: teks(row?.id) || jadikanId(name, i),
        name,
        desc: teks(row?.desc),
        kuota: angkaKuota(row?.kuota),
      };
    }),

    minat: normalizeDaftar(source.minat, bawaan.minat, (row) => teks(row) || null),

    berkas: normalizeDaftar(source.berkas, bawaan.berkas, (row, i) => {
      const name = teks(row?.name);
      if (!name) return null;
      return { id: teks(row?.id) || jadikanId(name, i), name, hint: teks(row?.hint) };
    }),

    timeline: normalizeDaftar(source.timeline, bawaan.timeline, (row) => {
      const when = teks(row?.when);
      if (!when) return null;
      return { when, what: teks(row?.what) };
    }),

    requirements: normalizeDaftar(source.requirements, bawaan.requirements, (row) => teks(row) || null),
  };
};

/**
 * Mengganti `{tahun}` pada teks dengan tahun pembuka tahun ajaran.
 *
 * Dipakai pada daftar syarat, supaya "berusia minimal 6 tahun pada 1 Juli {tahun}"
 * ikut berubah saat tahun ajaran diperbarui — pembeli tidak perlu menyuntingnya
 * lagi setiap tahun.
 */
export const isiPenanda = (kalimat, tahun) => String(kalimat ?? '').replace(/\{tahun\}/g, tahun || '');

export const fetchPpdbContent = async () => {
  const map = await fetchWebsiteContentMap({ keys: [PPDB_CONTENT_KEY] });
  return normalizePpdbContent(map?.[PPDB_CONTENT_KEY]);
};

export const savePpdbContent = async (content) => {
  const normalized = normalizePpdbContent(content);
  await saveWebsiteContentItem({ key: PPDB_CONTENT_KEY, content: normalized, isPublic: true });
  return normalized;
};
