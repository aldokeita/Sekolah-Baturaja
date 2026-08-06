// CATATAN PENTING
//
// Identitas sekolah TIDAK tinggal di sini. Sumbernya adalah panel "Identitas
// Sekolah" di dashboard admin, dibaca lewat `src/lib/schoolIdentity.js`.
//
// Berkas ini hanya menyimpan **contoh isi halaman publik**: jadwal, kuota, slide
// pembuka, fasilitas, galeri, FAQ, dan keunggulan. Semuanya sekadar nilai awal
// sebelum admin mengisinya sendiri lewat panel Konten, dan seluruhnya tersimpan
// di `website_content` begitu disunting.
//
// Karena aplikasi ini template yang akan dijual, isi contoh harus netral untuk
// sekolah dasar umum — jangan mengembalikan nuansa TPQ/Qiroati.
export { DEFAULT_SCHOOL_IDENTITY } from '@/lib/schoolIdentity';

// Jam belajar per rombongan kelas. Nama sesi (Pagi/Siang/Sore) tetap dipakai
// modul absensi, jadi kuota di bawah masih memakai kunci itu.
export const OFFICIAL_SCHEDULES = Object.freeze([
  { id: 'kelas-1-2', title: 'Kelas 1–2', time: '07.30–11.00 WIB', type: 'Reguler' },
  { id: 'kelas-3-4', title: 'Kelas 3–4', time: '07.30–12.30 WIB', type: 'Reguler' },
  { id: 'kelas-5-6', title: 'Kelas 5–6', time: '07.30–13.00 WIB', type: 'Reguler' },
]);

// Daya tampung per sesi absensi. Kunci dewasa dihapus bersama pencabutan
// kategori murid dewasa.
export const OFFICIAL_QUOTAS = Object.freeze({
  pagi: 28,
  siang: 28,
  sore: 28,
});

// CATATAN: berkas gambarnya masih peninggalan sekolah Al-Qur'an
// (hero-al-alaq, hero-qiroati). Teksnya sudah netral, tetapi FOTONYA perlu
// diganti sebelum template dijual — lihat public/institution/.
export const OFFICIAL_HERO_SLIDES = Object.freeze([
  {
    id: 'official-hero-learning',
    url: '/institution/hero-learning.webp',
    text: 'Setiap anak berhak belajar dengan tenang dan tumbuh dengan percaya diri',
    author: 'Semangat sekolah kami',
  },
  {
    id: 'official-hero-classroom',
    url: '/institution/hero-al-alaq.webp',
    text: 'Kelas yang tertata, guru yang mengenal setiap murid',
    author: 'Pendampingan belajar',
  },
  {
    id: 'official-hero-character',
    url: '/institution/hero-qiroati.webp',
    text: 'Bukan hanya pandai, tetapi juga jujur, disiplin, dan peduli',
    author: 'Penguatan karakter',
  },
]);

export const OFFICIAL_FACILITIES = Object.freeze([
  {
    id: 'official-classroom',
    name: 'Ruang Kelas',
    description: 'Ruang kelas yang bersih, terang, dan nyaman sehingga murid dapat belajar dengan fokus.',
    image_url: '/institution/classroom.webp',
  },
]);

export const OFFICIAL_GALLERY = Object.freeze([
  {
    id: 'official-gallery-quiz',
    title: 'Kuis bersama murid',
    caption: 'Kuis tanya jawab di dalam kelas.',
    description: 'Kegiatan interaktif untuk menguatkan pemahaman dan kebersamaan murid.',
    url: '/institution/gallery-quiz.webp',
  },
]);

export const OFFICIAL_FAQS = Object.freeze([
  {
    id: 'age',
    question: 'Berapa usia minimal untuk masuk kelas 1?',
    answer: 'Calon murid berusia 6 tahun pada 1 Juli tahun pelajaran berjalan. Usia 5 tahun 6 bulan dapat dipertimbangkan bila daya tampung masih tersedia.',
  },
  {
    id: 'fee',
    question: 'Apakah ada biaya sekolah?',
    answer: 'Sebagai sekolah dasar negeri, tidak ada biaya SPP. Iuran hanya untuk kegiatan tertentu dan selalu disepakati bersama komite sekolah.',
  },
  {
    id: 'requirements',
    question: 'Apa saja syarat pendaftaran murid baru?',
    answer: 'Fotokopi akta kelahiran, Kartu Keluarga, kartu identitas orang tua, dan dua lembar pasfoto 3×4. Orang tua hadir saat pendaftaran untuk mengisi formulir.',
  },
  {
    id: 'hours',
    question: 'Jam berapa kegiatan belajar berlangsung?',
    answer: 'Kegiatan belajar dimulai pukul 07.30. Jam pulang menyesuaikan tingkat kelas, paling awal pukul 11.00 dan paling akhir pukul 13.00.',
  },
]);

export const INSTITUTION_PROOF_POINTS = Object.freeze([
  { id: 'small-class', title: 'Kelas yang tidak berlebih', text: 'Jumlah murid per kelas dijaga agar guru dapat mendampingi setiap anak.' },
  { id: 'character', title: 'Karakter sejalan akademik', text: 'Kejujuran, kedisiplinan, dan kepedulian dinilai bersama capaian belajar.' },
  { id: 'progress', title: 'Perkembangan tercatat', text: 'Rapor akademik dan karakter membantu guru serta orang tua memantau kemajuan murid.' },
]);

export const OFFICIAL_CTA_BACKGROUND = '/institution/cta-activity.webp';
export const ACADEMIC_YEAR = '2026–2027';
