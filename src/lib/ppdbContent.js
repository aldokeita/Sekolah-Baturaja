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

  // Jalur pendaftaran. `id` dipakai sebagai nilai tersimpan pada formulir, jadi
  // biarkan tetap bila jalurnya hanya berubah nama.
  jalur: Object.freeze([
    { id: 'zonasi', name: 'Zonasi', desc: 'Berdasarkan jarak tempat tinggal ke sekolah' },
    { id: 'afirmasi', name: 'Afirmasi', desc: 'Untuk keluarga tidak mampu dan penyandang disabilitas' },
    { id: 'prestasi', name: 'Prestasi', desc: 'Kejuaraan tingkat kecamatan ke atas yang dibuktikan sertifikat' },
    { id: 'pindah', name: 'Perpindahan tugas', desc: 'Anak dari orang tua yang dipindahtugaskan' },
  ]),

  // Program pendukung yang boleh dipilih calon murid. Bawaannya sengaja tidak
  // memuat program keagamaan: template ini untuk sekolah umum, dan sekolah yang
  // menjalankannya tinggal menambah sendiri.
  minat: Object.freeze(['Bahasa Inggris', 'Sains cilik', 'Seni tari', 'Olahraga']),

  berkas: Object.freeze([
    { id: 'kk', name: 'Kartu keluarga', hint: 'JPG atau PDF, maks 2 MB' },
    { id: 'akta', name: 'Akta kelahiran', hint: 'JPG atau PDF, maks 2 MB' },
    { id: 'rapor', name: 'Rapor semester 1–5', hint: 'PDF gabungan' },
    { id: 'foto', name: 'Pas foto 3×4', hint: 'Latar biru atau merah' },
  ]),

  timeline: Object.freeze([
    { when: '1 Juli – 20 Agustus', what: 'Pengisian formulir daring' },
    { when: '23 Agustus', what: 'Pengumuman hasil seleksi' },
    { when: '25 – 29 Agustus', what: 'Daftar ulang di ruang tata usaha' },
  ]),

  /* Daftar "yang perlu disiapkan". `{tahun}` diganti tahun pembuka dari tahun
   * ajaran di Identitas, supaya syarat usia tidak perlu disunting ulang setiap
   * tahun. Lihat isiPenanda. */
  requirements: Object.freeze([
    'Kartu keluarga dan akta kelahiran',
    'Anak berusia minimal 6 tahun pada 1 Juli {tahun}',
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

export const normalizePpdbContent = (stored) => {
  const source = stored && typeof stored === 'object' ? stored : {};
  const bawaan = DEFAULT_PPDB_CONTENT;

  return {
    waveLabel: teks(source.waveLabel) || bawaan.waveLabel,
    intro: teks(source.intro) || bawaan.intro,

    jalur: normalizeDaftar(source.jalur, bawaan.jalur, (row, i) => {
      const name = teks(row?.name);
      if (!name) return null;
      return { id: teks(row?.id) || jadikanId(name, i), name, desc: teks(row?.desc) };
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
