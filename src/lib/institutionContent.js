// CATATAN PENTING
//
// Identitas sekolah TIDAK lagi tinggal di sini. Sumbernya adalah panel
// "Identitas Sekolah" di dashboard admin, dibaca lewat `src/lib/schoolIdentity.js`.
// Aplikasi ini template yang dikustomisasi pembeli, jadi nama, kontak, visi, dan
// misi harus bisa diubah tanpa menyentuh kode.
//
// Yang tersisa di berkas ini hanyalah contoh isi halaman publik (jadwal, kuota,
// slide, fasilitas, galeri, FAQ) yang memang baru dipakai sebagai nilai awal
// sebelum admin mengisinya sendiri lewat panel Konten.
export { DEFAULT_SCHOOL_IDENTITY } from '@/lib/schoolIdentity';

export const OFFICIAL_SCHEDULES = Object.freeze([
  { id: 'pagi', title: 'Sesi Pagi', time: '08.00–09.15 WIB', type: 'TPQ' },
  { id: 'siang', title: 'Sesi Siang', time: '14.00–15.15 WIB', type: 'TPQ' },
  { id: 'sore', title: 'Sesi Sore', time: '16.00–17.15 WIB', type: 'TPQ' },
]);

export const OFFICIAL_QUOTAS = Object.freeze({
  pagi: 15,
  siang: 15,
  sore: 15,
  dewasaPagi: 9,
  dewasaSiang: 7,
  dewasaMalam: 8,
});

export const OFFICIAL_HERO_SLIDES = Object.freeze([
  {
    id: 'official-hero-learning',
    url: '/institution/hero-learning.webp',
    text: "Sebaik-baik kalian adalah orang yang mempelajari Al-Qur'an dan mengajarkannya",
    author: 'HR. Bukhari',
  },
  {
    id: 'official-hero-al-alaq',
    url: '/institution/hero-al-alaq.webp',
    text: 'Bacalah dengan menyebut nama Tuhanmu yang menciptakan',
    author: 'QS. Al-Alaq: 1',
  },
  {
    id: 'official-hero-qiroati',
    url: '/institution/hero-qiroati.webp',
    text: "Jangan wariskan bacaan Qur'an yang salah, karena yang benar itu mudah",
    author: 'KH. Dachlan Salim Zarkasyi',
  },
]);

export const OFFICIAL_FACILITIES = Object.freeze([
  {
    id: 'official-classroom',
    name: 'Ruang Kelas',
    description: 'Ruang kelas yang bersih dan nyaman mendukung murid belajar Al-Qur’an dengan lebih fokus.',
    image_url: '/institution/classroom.webp',
  },
]);

export const OFFICIAL_GALLERY = Object.freeze([
  {
    id: 'official-gallery-quiz',
    title: 'Quiz bersama murid',
    caption: 'Quiz tanya jawab bersama murid LPQ Al-Fath Maulana.',
    description: 'Kegiatan interaktif untuk menguatkan pemahaman dan kebersamaan murid.',
    url: '/institution/gallery-quiz.webp',
  },
]);

export const OFFICIAL_FAQS = Object.freeze([
  {
    id: 'fee',
    question: 'Berapa biaya pendaftaran TPQ?',
    answer: 'Total biaya pendaftaran TPQ adalah Rp450.000 dan dapat dicicil selama satu bulan.',
  },
  {
    id: 'adult',
    question: 'Apakah tersedia kelas untuk orang dewasa?',
    answer: 'Ya. Kelas dewasa tersedia untuk usia minimal 17 tahun dengan pilihan waktu pagi, siang, atau malam sesuai kesepakatan.',
  },
  {
    id: 'requirements',
    question: 'Apa saja syarat pendaftaran TPQ?',
    answer: 'Wali dan calon murid hadir saat pendaftaran, mengisi formulir, serta membawa fotokopi akta kelahiran, Kartu Keluarga, dua pasfoto 3×4, dan materai Rp10.000.',
  },
]);

export const INSTITUTION_PROOF_POINTS = Object.freeze([
  { id: 'qiroati', title: 'Metode Qiroati terstruktur', text: 'Pembelajaran bacaan berlangsung bertahap, tartil, dan sesuai kaidah tajwid.' },
  { id: 'small-class', title: 'Kelas maksimal 15 murid', text: 'Kelas kecil memberi ruang bagi guru untuk mendampingi perkembangan setiap murid.' },
  { id: 'progress', title: 'Progres tercatat', text: 'Buku prestasi membantu guru dan wali memantau bacaan serta tindak lanjut belajar.' },
]);

export const OFFICIAL_CTA_BACKGROUND = '/institution/cta-activity.webp';
export const ACADEMIC_YEAR = '2026–2027';
