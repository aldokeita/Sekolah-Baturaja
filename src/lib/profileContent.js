import { fetchWebsiteContentMap, saveWebsiteContentItem } from '@/lib/publicContentAdapters';

/**
 * Isi halaman Profil yang dapat disunting pembeli.
 *
 * Prinsipnya sama seperti `homeContent.js`: **teks disunting pembeli, tampilan
 * tetap di kode.** Gradasi, ukuran kotak fasilitas, dan urutan animasi bukan
 * urusan pembeli sekolah — ProfilePage memasangkan teks di bawah ini dengan gaya
 * visualnya berdasarkan posisi.
 *
 * Kenapa berkas ini ada: halaman Profil dulu menanam seluruh naratifnya di kode —
 * riwayat 1966·1994·2015·2023, "tiga ruang kelas kayu, 624 anak", delapan
 * fasilitas beserta keterangannya, dan data pokok seperti NPSN 10645512. Semuanya
 * fakta per-sekolah, jadi setiap salinan yang terjual menampilkan sejarah sekolah
 * lain sebagai sejarahnya sendiri.
 *
 * Disimpan di `website_content` kunci `profile_content`. Kunci ini **bukan** bagian
 * dari `brandKeys` di content.go: ini konten administrasi sekolah, jadi pembeli
 * yang berperan `admin` boleh mengubahnya sendiri tanpa penjual.
 */

export const PROFILE_CONTENT_KEY = 'profile_content';

export const DEFAULT_PROFILE_CONTENT = Object.freeze({
  hero: Object.freeze({
    kicker: 'Sejak 1966',
    titleTop: 'Enam puluh tahun',
    titleMain: 'mengajar anak',
    titleAccent: 'Baturaja.',
    story: 'Tiga ruang kelas kayu, empat guru, delapan puluh tujuh murid. Begitu sekolah ini dimulai. Hari ini 624 anak belajar di halaman yang sama, di bawah pohon yang ditanam angkatan pertama.',
    // Nilai kartu murid diambil dari data master; field ini dipertahankan untuk
    // kompatibilitas dengan konten lama, tetapi tidak menjadi sumber angka publik.
    badgeValue: '',
    badgeLabel: 'murid hari ini',
  }),
  // Tiga kartu foto miring di hero. Gradasi dan sudut putarnya di kode;
  // gambar dapat diganti pembeli tanpa mengubah label atau komposisinya.
  photos: Object.freeze([
    { id: 'profile-opening-1', label: 'Kelas pagi', image_url: '' },
    { id: 'profile-opening-2', label: 'Kebun sekolah', image_url: '' },
    { id: 'profile-opening-3', label: 'Pentas seni', image_url: '' },
  ]),
  ticker: Object.freeze([
    'Terakreditasi A', 'Adiwiyata Nasional', 'Kurikulum Merdeka', '18 rombongan belajar',
    'Perpustakaan buka setiap hari', 'Kebun sekolah', 'Kelas kecil', 'Guru bersertifikat pendidik',
  ]),
  stats: Object.freeze([
    { value: '1966', label: 'Tahun berdiri', suffix: '', plain: true },
    { value: '18', label: 'Rombongan belajar', suffix: '', plain: false },
    { value: '34', label: 'Guru & tenaga kependidikan', suffix: '', plain: false },
    { value: '24', label: 'Rasio murid per guru kelas', suffix: ' : 1', plain: false },
  ]),
  /* Kalimat besar pembuka kutipan. Bagian di antara tanda bintang tampil dengan
   * warna aksen sekolah — cara pembeli menyorot satu frasa tanpa perlu menyentuh
   * kode. Lihat teksBeraksen di ProfilePage. */
  quoteLead: 'Setiap anak yang masuk ke halaman sekolah ini membawa *kecepatan belajarnya sendiri*. Tugas kami bukan menyamakan mereka, melainkan memastikan tidak ada yang tertinggal di belakang.',
  quoteAvatarUrl: '',
  quote: Object.freeze([
    'Kami menjaga jumlah murid per kelas tetap kecil supaya guru wali dapat mengenal karakter setiap anak. Orang tua kami libatkan lewat pertemuan bulanan dan laporan perkembangan yang tidak hanya berisi angka, tetapi juga catatan tentang keberanian, kemandirian, dan cara anak bergaul.',
    'Pintu ruang kepala sekolah selalu terbuka bagi siapa pun yang ingin berbicara.',
  ]),
  history: Object.freeze([
    { year: '1966', text: 'Sekolah dibuka dengan tiga ruang kelas kayu dan empat guru, menampung 87 murid dari kampung sekitar.' },
    { year: '1994', text: 'Gedung permanen dua lantai diresmikan. Perpustakaan pertama dibuka di ruang bekas kantor guru.' },
    { year: '2015', text: 'Kebun sekolah dan bank sampah dimulai, mengantar sekolah meraih predikat Adiwiyata tingkat kabupaten.' },
    { year: '2023', text: 'Akreditasi A diperoleh kembali dengan nilai 96,4 dan seluruh kelas menerapkan Kurikulum Merdeka.' },
  ]),
  // Mosaik fasilitas di halaman Profil. Berbeda dari kunci `facilities` di
  // website_content, yang mengisi halaman Fasilitas beserta fotonya.
  facilities: Object.freeze([
    { name: 'Ruang kelas', desc: 'Delapan belas ruang kelas dengan jendela besar dan ventilasi silang, masing-masing berisi paling banyak dua puluh delapan murid.' },
    { name: 'Perpustakaan', desc: 'Lebih dari empat ribu judul buku anak, dibuka setiap hari sekolah pukul 07.00 sampai 14.00.' },
    { name: 'Ruang UKS', desc: 'Dua tempat tidur, lemari obat, dan seorang guru pendamping bersertifikat pertolongan pertama.' },
    { name: 'Musala', desc: 'Tempat salat berkapasitas enam puluh orang dengan tempat wudu terpisah untuk murid putra dan putri.' },
    { name: 'Kebun sekolah', desc: 'Petak sayur yang dirawat murid kelas empat sampai enam, hasil panennya dimasak bersama di kantin.' },
    { name: 'Halaman bermain', desc: 'Lapangan serbaguna, ayunan, dan area pasir yang dipakai bergantian saat jam istirahat.' },
    { name: 'Kantin sehat', desc: 'Menu diperiksa guru setiap pekan, tanpa minuman berpemanis dan tanpa makanan kemasan berpewarna.' },
    { name: 'Ruang komputer', desc: 'Enam belas unit komputer untuk kelas literasi digital kelas empat sampai enam.' },
  ]),
  /* Data pokok sekolah — pasangan label dan nilai yang bebas ditentukan pembeli.
   *
   * Sengaja BUKAN daftar field tetap. Aplikasi ini dijual ke banyak sekolah, dan
   * apa yang perlu dicantumkan berbeda-beda: SD negeri menyebut NPSN dan
   * akreditasi, sekolah swasta menambah nama yayasan, sebagian mencantumkan luas
   * lahan. Field tetap akan selalu salah untuk sebagian pembeli. */
  registry: Object.freeze([
    { label: 'NPSN', value: '' },
    { label: 'Jenjang', value: 'Sekolah Dasar' },
    { label: 'Status', value: 'Negeri' },
    { label: 'Akreditasi', value: '' },
    { label: 'Kurikulum', value: 'Kurikulum Merdeka' },
    { label: 'Kepala sekolah', value: '' },
    { label: 'Waktu belajar', value: 'Pagi' },
    { label: 'Luas lahan', value: '' },
  ]),
});

const teks = (value) => String(value ?? '').trim();

/** Blok daftar jatuh ke bawaan bila tersimpan kosong, supaya halaman tak bolong. */
const normalizeDaftar = (rows, fallback, mapper) => {
  if (!Array.isArray(rows)) return fallback;
  const hasil = rows.map(mapper).filter(Boolean);
  return hasil.length > 0 ? hasil : fallback;
};

/** Blok objek: field kosong jatuh ke bawaannya masing-masing, bukan seluruh blok. */
const normalizeObjek = (source, fallback) => {
  const isi = source && typeof source === 'object' ? source : {};
  const hasil = {};
  Object.keys(fallback).forEach((field) => {
    hasil[field] = teks(isi[field]) || fallback[field];
  });
  return hasil;
};

export const normalizeProfileContent = (stored) => {
  const source = stored && typeof stored === 'object' ? stored : {};
  const bawaan = DEFAULT_PROFILE_CONTENT;

  return {
    hero: normalizeObjek(source.hero, bawaan.hero),

    photos: normalizeDaftar(source.photos, bawaan.photos, (row, index) => {
      const label = teks(row?.label);
      if (!label) return null;
      return {
        id: teks(row?.id) || `profile-opening-${index + 1}`,
        label,
        image_url: teks(row?.image_url || row?.imageUrl),
      };
    }),

    // Tiker berupa daftar teks biasa, bukan objek.
    ticker: normalizeDaftar(source.ticker, bawaan.ticker, (row) => teks(row) || null),

    stats: normalizeDaftar(source.stats, bawaan.stats, (row) => {
      const label = teks(row?.label);
      if (!label) return null;
      return {
        value: teks(row?.value),
        label,
        suffix: teks(row?.suffix),
        plain: Boolean(row?.plain),
      };
    }),

    quoteLead: teks(source.quoteLead) || bawaan.quoteLead,

    // Avatar kutipan adalah aset website publik, bukan URL avatar akun privat.
    quoteAvatarUrl: teks(source.quoteAvatarUrl || source.quote_avatar_url),

    quote: normalizeDaftar(source.quote, bawaan.quote, (row) => teks(row) || null),

    history: normalizeDaftar(source.history, bawaan.history, (row) => {
      const year = teks(row?.year);
      const text = teks(row?.text);
      if (!year && !text) return null;
      return { year, text };
    }),

    facilities: normalizeDaftar(source.facilities, bawaan.facilities, (row) => {
      const name = teks(row?.name);
      if (!name) return null;
      return { name, desc: teks(row?.desc) };
    }),

    /* Data pokok BOLEH kosong seluruhnya — pembeli yang tidak ingin mencantumkan
     * NPSN atau luas lahan tinggal menghapus barisnya, dan blok itu hilang dari
     * halaman. Karena itu blok ini TIDAK jatuh ke bawaan seperti blok lain: kalau
     * jatuh, baris yang sengaja dihapus akan muncul kembali. */
    registry: Array.isArray(source.registry)
      ? source.registry
        .map((row) => ({ label: teks(row?.label), value: teks(row?.value) }))
        .filter((row) => row.label)
      : bawaan.registry.map((row) => ({ ...row })),
  };
};

export const fetchProfileContent = async () => {
  const map = await fetchWebsiteContentMap({ keys: [PROFILE_CONTENT_KEY] });
  return normalizeProfileContent(map?.[PROFILE_CONTENT_KEY]);
};

export const saveProfileContent = async (content) => {
  const normalized = normalizeProfileContent(content);
  await saveWebsiteContentItem({ key: PROFILE_CONTENT_KEY, content: normalized, isPublic: true });
  return normalized;
};
