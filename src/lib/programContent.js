import {
  announceWebsiteContentUpdate,
  fetchWebsiteContentMap,
  saveWebsiteContentItem,
} from '@/lib/publicContentAdapters';

/**
 * Isi halaman Program yang dapat disunting pembeli.
 *
 * Dulu tiga daftar ditanam di kode: enam program (dengan nama guru penanggung
 * jawab karangan), beban jam pelajaran sembilan mata pelajaran, dan ritme "satu
 * hari di sekolah". Semuanya berbeda tiap sekolah dan tidak bisa diubah pembeli.
 *
 * Kini disimpan di `website_content` kunci `program_content` dan disunting di
 * Konten → Program. Statistik "program berjalan" dan "jam pelajaran per pekan"
 * dihitung otomatis (jumlah program & total JP); hanya "tema projek" dan "murid
 * terlibat" yang disimpan. Warna kartu dipilih otomatis berdasarkan urutan.
 */

export const PROGRAM_CONTENT_KEY = 'program_content';

const PRG = (nama, jenis, kelas, waktu, ringkas, cerita, meta) => ({ nama, jenis, kelas, waktu, ringkas, cerita, meta });

export const DEFAULT_PROGRAM_CONTENT = Object.freeze({
  hero: Object.freeze({
    title: 'Program belajar yang\ndijalankan setiap hari,',
    accent: 'bukan hanya tertulis.',
    description: 'Program yang benar-benar dijalankan sepanjang tahun ajaran — sebagian menempel pada jam pelajaran, sebagian berupa kebiasaan harian yang dijaga seluruh kelas.',
    photo_url: '',
  }),
  stats: Object.freeze({ temaProjek: 2, muridTerlibat: 0 }),

  programs: Object.freeze([
    PRG('Membaca pagi', 'Kebiasaan', 'Kelas I–VI', '15 menit',
      'Lima belas menit membaca buku pilihan sendiri sebelum pelajaran pertama.',
      'Perpustakaan menyediakan kotak buku bergilir yang diganti setiap dua pekan. Guru tidak meminta ringkasan; catatan hanya daftar judul yang dipinjam.',
      [{ label: 'Waktu', value: '07.15–07.30' }, { label: 'Hari', value: 'Senin–Jumat' }, { label: 'Penanggung jawab', value: 'Wali kelas' }]),
    PRG('Projek Penguatan Profil Pelajar Pancasila', 'Kurikuler', 'Kelas IV–VI', '2 JP/pekan',
      'Satu tema besar per semester, dikerjakan berkelompok lintas mata pelajaran.',
      'Tema semester ganjil Gaya Hidup Berkelanjutan lewat kebun sekolah; semester genap Kearifan Lokal. Hasilnya dipamerkan pada pekan projek.',
      [{ label: 'Tema per tahun', value: '2 tema' }, { label: 'Bentuk', value: 'Kerja kelompok' }, { label: 'Pameran', value: 'Akhir semester' }]),
    PRG('Literasi digital', 'Kurikuler', 'Kelas IV–VI', '1 JP/pekan',
      'Mengetik, menyimpan berkas, dan mencari informasi dengan pendampingan guru.',
      'Setiap kelas memperoleh satu jam pemakaian ruang komputer per pekan. Materi bertahap: mengetik, menyusun dokumen, lalu mencari informasi secara aman.',
      [{ label: 'Ruang', value: 'Ruang komputer' }, { label: 'Rasio', value: '2 murid per unit' }]),
    PRG('Kebun kelas dan bank sampah', 'Kebiasaan', 'Kelas IV–VI', 'Harian',
      'Setiap kelas merawat satu petak sayur dan memilah sampahnya sendiri.',
      'Petak dibagi per kelas, dirawat murid bergilir tiap pekan. Catatan pemakaian air dan hasil panen direkap tiap akhir bulan.',
      [{ label: 'Panen', value: 'Dua kali setahun' }, { label: 'Catatan', value: 'Direkap bulanan' }]),
    PRG('Pendampingan belajar', 'Kebiasaan', 'Kelas I–III', '2 sore/pekan',
      'Kelas tambahan gratis untuk murid yang belum lancar membaca dan berhitung.',
      'Kelompok berisi paling banyak enam murid, bertemu dua sore setiap pekan sampai capaian dasarnya terpenuhi. Orang tua menerima catatan kemajuan bulanan.',
      [{ label: 'Ukuran kelompok', value: 'Maks. 6 murid' }, { label: 'Biaya', value: 'Tidak ada' }]),
  ]),

  // Beban jam pelajaran per pekan. Bawaan mengikuti struktur kurikulum SD.
  jam: Object.freeze([
    { mapel: 'Bahasa Indonesia', jp: 7 }, { mapel: 'Matematika', jp: 6 }, { mapel: 'IPAS', jp: 5 },
    { mapel: 'Pendidikan Pancasila', jp: 4 }, { mapel: 'Pendidikan Agama', jp: 4 },
    { mapel: 'Seni dan Budaya', jp: 3 }, { mapel: 'PJOK', jp: 3 },
    { mapel: 'Bahasa Inggris', jp: 2 }, { mapel: 'Muatan lokal', jp: 2 },
  ]),

  // Ritme "satu hari di sekolah".
  ritme: Object.freeze([
    { jam: '07.15', judul: 'Membaca pagi', teks: 'Murid masuk kelas, mengambil buku dari kotak bergilir, dan membaca sendiri selama lima belas menit.' },
    { jam: '07.30', judul: 'Pelajaran pertama', teks: 'Dua jam pelajaran pertama diisi mata pelajaran inti: Bahasa Indonesia atau Matematika.' },
    { jam: '09.30', judul: 'Istirahat pertama', teks: 'Dua puluh menit di halaman atau kantin.' },
    { jam: '09.50', judul: 'Pelajaran kedua', teks: 'IPAS, Pendidikan Pancasila, atau jam projek untuk kelas empat sampai enam.' },
    { jam: '12.00', judul: 'Istirahat kedua dan makan bekal', teks: 'Murid makan bekal, lalu merapikan meja sebelum jam terakhir.' },
    { jam: '12.30', judul: 'Jam terakhir dan piket', teks: 'Pelajaran terakhir ditutup dengan piket kelas, pulang pukul 13.00.' },
  ]),
});

const teks = (value) => String(value ?? '').trim();
const angka = (nilai) => {
  const n = Number(String(nilai ?? '').trim());
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
};

const clone = (v) => JSON.parse(JSON.stringify(v));

const normPrograms = (rows) => {
  if (!Array.isArray(rows)) return clone(DEFAULT_PROGRAM_CONTENT.programs);
  return rows.map((r) => {
    const nama = teks(r?.nama);
    if (!nama) return null;
    const meta = Array.isArray(r?.meta)
      ? r.meta.map((m) => ({ label: teks(m?.label), value: teks(m?.value) })).filter((m) => m.label || m.value)
      : [];
    return {
      nama, jenis: teks(r?.jenis) || 'Program', kelas: teks(r?.kelas), waktu: teks(r?.waktu),
      ringkas: teks(r?.ringkas), cerita: teks(r?.cerita), meta,
    };
  }).filter(Boolean);
};

const normJam = (rows) => {
  if (!Array.isArray(rows)) return clone(DEFAULT_PROGRAM_CONTENT.jam);
  return rows.map((r) => {
    const mapel = teks(r?.mapel);
    if (!mapel) return null;
    return { mapel, jp: Math.max(1, angka(r?.jp)) };
  }).filter(Boolean);
};

const normRitme = (rows) => {
  if (!Array.isArray(rows)) return clone(DEFAULT_PROGRAM_CONTENT.ritme);
  return rows.map((r) => {
    const judul = teks(r?.judul);
    if (!judul) return null;
    return { jam: teks(r?.jam), judul, teks: teks(r?.teks) };
  }).filter(Boolean);
};

const normHero = (stored, legacy = {}) => {
  const source = stored && typeof stored === 'object' ? stored : {};
  return {
    title: teks(source.title) || DEFAULT_PROGRAM_CONTENT.hero.title,
    accent: teks(source.accent) || DEFAULT_PROGRAM_CONTENT.hero.accent,
    description: teks(source.description) || DEFAULT_PROGRAM_CONTENT.hero.description,
    photo_url: teks(
      source.photo_url
      || source.foto_url
      || source.photoUrl
      || legacy.photo_url
      || legacy.foto_url
    ),
  };
};

export const normalizeProgramContent = (stored) => {
  const source = stored && typeof stored === 'object' ? stored : {};
  const stats = source.stats && typeof source.stats === 'object' ? source.stats : {};
  return {
    hero: normHero(source.hero, source),
    stats: { temaProjek: angka(stats.temaProjek), muridTerlibat: angka(stats.muridTerlibat) },
    programs: source.programs === undefined ? clone(DEFAULT_PROGRAM_CONTENT.programs) : normPrograms(source.programs),
    jam: source.jam === undefined ? clone(DEFAULT_PROGRAM_CONTENT.jam) : normJam(source.jam),
    ritme: source.ritme === undefined ? clone(DEFAULT_PROGRAM_CONTENT.ritme) : normRitme(source.ritme),
  };
};

export const fetchProgramContent = async () => {
  const map = await fetchWebsiteContentMap({ keys: [PROGRAM_CONTENT_KEY] });
  return normalizeProgramContent(map?.[PROGRAM_CONTENT_KEY]);
};

export const saveProgramContent = async (content) => {
  const normalized = normalizeProgramContent(content);
  await saveWebsiteContentItem({ key: PROGRAM_CONTENT_KEY, content: normalized, isPublic: true });
  announceWebsiteContentUpdate([PROGRAM_CONTENT_KEY]);
  return normalized;
};
