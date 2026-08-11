import { fetchWebsiteContentMap, saveWebsiteContentItem } from '@/lib/publicContentAdapters';

/**
 * Konten blok halaman depan yang dapat disunting admin.
 *
 * Prinsipnya: **teks dan avatar testimoni disunting pembeli, tampilan tetap di
 * kode.** Gradasi warna, ikon, dan urutan animasi bukan urusan pembeli sekolah
 * — HomePage memasangkan data di bawah ini dengan gaya visualnya berdasarkan
 * posisi (indeks). Jadi jumlah item boleh berubah dan gayanya tetap berputar.
 *
 * Disimpan di `website_content` kunci `home_content` supaya halaman publik bisa
 * membacanya tanpa token, sama seperti identitas sekolah.
 *
 * Blok lain di halaman depan sengaja TIDAK di sini karena sudah tersambung
 * sendiri: foto galeri lewat kunci `galleryPhotos`, berita lewat endpoint berita,
 * jumlah murid dan guru lewat endpoint hitungan.
 */

export const HOME_CONTENT_KEY = 'home_content';

export const DEFAULT_HOME_CONTENT = Object.freeze({
  program: Object.freeze([
    {
      title: 'Kelas I–III',
      desc: 'Fokus membaca, menulis, dan berhitung lewat permainan. Satu guru wali mendampingi penuh sepanjang hari.',
      tags: ['9 rombel', 'Literasi dasar'],
    },
    {
      title: 'Kelas IV–V',
      desc: 'Belajar lewat proyek tematik: menanam di kebun sekolah, membuat majalah dinding, dan kunjungan ke pasar kota.',
      tags: ['6 rombel', 'Proyek tematik'],
    },
    {
      title: 'Kelas VI',
      desc: 'Pendalaman materi dan pendampingan memilih SMP, termasuk simulasi asesmen dan konsultasi bersama orang tua.',
      tags: ['3 rombel', 'Persiapan SMP'],
    },
  ]),
  testimonials: Object.freeze([
    { id: 'naila-rahmadani', quote: 'Bu guru hafal nama semua teman di kelas. Waktu saya belum bisa perkalian, saya diajari lagi sepulang sekolah.', name: 'Naila Rahmadani', role: 'Murid kelas VI A', avatar_url: '' },
    { id: 'bayu-prasetyo', quote: 'Kebiasaan membaca setiap pagi terbawa sampai SMP. Waktu masuk sekolah baru saya sudah tidak canggung bertanya.', name: 'Bayu Prasetyo', role: 'Alumni 2023, kini di SMP Negeri 1', avatar_url: '' },
    { id: 'ibu-sri-wahyuni', quote: 'Laporan perkembangan anak dikirim tiap bulan lewat grup wali murid. Sebagai orang tua saya tidak perlu menebak-nebak.', name: 'Ibu Sri Wahyuni', role: 'Orang tua murid kelas II', avatar_url: '' },
    { id: 'rangga-aditya', quote: 'Perpustakaan buka sampai sore. Saya dan teman regu pramuka sering latihan di halaman sebelum lomba.', name: 'Rangga Aditya', role: 'Murid kelas V B', avatar_url: '' },
    { id: 'ibu-marlina', quote: 'Kelas mendongeng membuat anak berani bicara. Yang dulu diam sekarang jadi pembawa acara pentas seni.', name: 'Ibu Marlina', role: 'Guru Bahasa Indonesia', avatar_url: '' },
    { id: 'dimas-saputra', quote: 'Kebun sekolah bikin saya suka pelajaran IPA. Sekarang saya ikut kelompok ilmiah remaja di SMP.', name: 'Dimas Saputra', role: 'Alumni 2021, kini di SMP Negeri 3', avatar_url: '' },
  ]),
  faq: Object.freeze([
    { question: 'Berapa usia minimal untuk masuk kelas satu?', answer: 'Anak berusia enam tahun pada 1 Juli tahun pelajaran berjalan. Usia lima tahun enam bulan dapat diterima bila ada rekomendasi tertulis dari psikolog atau dewan guru.' },
    { question: 'Kapan pendaftaran murid baru dibuka?', answer: 'Gelombang pertama dibuka 1 Juli dan ditutup 20 Agustus. Gelombang kedua menyusul pada September apabila kuota belum terpenuhi.' },
    { question: 'Berapa biaya masuk dan SPP bulanan?', answer: 'Sebagai sekolah negeri, tidak ada biaya masuk maupun SPP. Orang tua hanya menanggung seragam, buku penunjang, dan kegiatan tertentu yang disepakati komite.' },
    { question: 'Apa saja dokumen yang perlu disiapkan?', answer: 'Kartu keluarga, akta kelahiran, pas foto berwarna, dan surat keterangan dari TK atau RA bila anak pernah bersekolah sebelumnya.' },
    { question: 'Apakah anak harus sudah bisa membaca?', answer: 'Tidak. Calistung tidak diujikan saat pendaftaran. Kemampuan membaca, menulis, dan berhitung dibangun bertahap di kelas satu sampai tiga.' },
    { question: 'Sampai jam berapa anak berada di sekolah?', answer: 'Kelas satu dan dua pulang pukul 10.30, kelas tiga sampai enam pukul 12.30. Kegiatan ekstrakurikuler berlangsung sore hari pada Selasa dan Kamis.' },
  ]),
});

const teks = (value) => String(value ?? '').trim();

const testimonialId = (value, index) => {
  const normalized = teks(value)
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return normalized || `testimonial-${index + 1}`;
};

const bersihkanTags = (value) => {
  const list = Array.isArray(value) ? value : teks(value).split(',');
  return list.map(teks).filter(Boolean).slice(0, 4);
};

// Setiap blok jatuh ke bawaan bila tersimpan kosong atau bukan daftar, supaya
// halaman depan tidak pernah tampil bolong bila pembeli baru mengisi sebagian.
const normalizeBlok = (rows, fallback, mapper) => {
  if (!Array.isArray(rows)) return fallback;
  const hasil = rows.map(mapper).filter(Boolean);
  return hasil.length > 0 ? hasil : fallback;
};

export const normalizeHomeContent = (stored) => {
  const source = stored && typeof stored === 'object' ? stored : {};
  return {
    program: normalizeBlok(source.program, DEFAULT_HOME_CONTENT.program, (row) => {
      const title = teks(row?.title);
      if (!title) return null;
      return { title, desc: teks(row?.desc), tags: bersihkanTags(row?.tags) };
    }),
    testimonials: normalizeBlok(source.testimonials, DEFAULT_HOME_CONTENT.testimonials, (row, index) => {
      const quote = teks(row?.quote);
      if (!quote) return null;
      return {
        id: testimonialId(row?.id, index),
        quote,
        name: teks(row?.name),
        role: teks(row?.role),
        avatar_url: teks(row?.avatar_url || row?.avatarUrl),
      };
    }),
    faq: normalizeBlok(source.faq, DEFAULT_HOME_CONTENT.faq, (row) => {
      const question = teks(row?.question);
      if (!question) return null;
      return { question, answer: teks(row?.answer) };
    }),
  };
};

export const fetchHomeContent = async () => {
  const map = await fetchWebsiteContentMap({ keys: [HOME_CONTENT_KEY] });
  return normalizeHomeContent(map?.[HOME_CONTENT_KEY]);
};

export const saveHomeContent = async (content) => {
  const normalized = normalizeHomeContent(content);
  await saveWebsiteContentItem({ key: HOME_CONTENT_KEY, content: normalized, isPublic: true });
  return normalized;
};
