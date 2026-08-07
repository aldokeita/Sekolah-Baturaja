import { fetchWebsiteContentMap, saveWebsiteContentItem } from '@/lib/publicContentAdapters';

/**
 * Identitas sekolah — satu sumber untuk seluruh aplikasi.
 *
 * Aplikasi ini template yang akan dikustomisasi pembeli, jadi identitas TIDAK
 * boleh ditanam di kode. Nilai di bawah hanyalah bawaan contoh; yang berlaku
 * adalah isi yang disunting admin lewat panel "Identitas Sekolah".
 *
 * Disimpan di tabel `website_content` dengan kunci `school_identity`, bukan di
 * `/api/config`, karena halaman publik harus bisa membacanya TANPA token —
 * `GET /api/content/website` terbuka, sedangkan `/api/config` di balik
 * RequireAuth. Penulisannya tetap dijaga `CanManage` di sisi Go.
 *
 * localStorage hanya singgahan supaya identitas tidak berkedip saat halaman
 * dimuat; sumber kebenaran tetap basis data.
 */

export const SCHOOL_IDENTITY_KEY = 'school_identity';
const CACHE_KEY = 'sekolah_identitas_cache';

export const DEFAULT_SCHOOL_IDENTITY = Object.freeze({
  name: 'Sekolah Dasar Negeri Baturaja',
  shortName: 'SDN Baturaja',
  logoAbbr: 'SDN',
  tagline: 'Belajar dengan tenang, tumbuh dengan percaya diri.',
  address: 'Jalan Dr. Moh. Hatta No. 14, Baturaja Timur, Kabupaten Ogan Komering Ulu, Sumatera Selatan 32111',
  city: 'Baturaja',
  phone: '(0735) 320145',
  whatsapp: '',
  email: 'info@sekolahbta.id',
  website: 'https://sekolahbta.id',
  mapUrl: '',
  officeHours: 'Senin–Jumat, 07.30–15.00',
  academicYear: '2026/2027',
  // Aksen warna sekolah. Seluruh palet halaman publik diturunkan dari satu nilai
  // ini oleh turunkanPalet, lalu dipasang sebagai CSS custom property pada elemen
  // root, jadi CSS mana pun bisa memakainya tanpa menyentuh JavaScript.
  accentColor: '#6470ff',
  vision: 'Menjadi sekolah dasar yang menumbuhkan murid berkarakter, cakap berpikir, dan senang belajar.',
  missions: [
    'Menyelenggarakan pembelajaran yang berpusat pada murid dan menyenangkan.',
    'Menumbuhkan karakter, kedisiplinan, dan kepedulian sosial.',
    'Mendampingi setiap murid sesuai kebutuhan dan kecepatan belajarnya.',
    'Membangun kerja sama yang erat antara sekolah, orang tua, dan masyarakat.',
  ],
  goals: [
    'Seluruh murid tuntas membaca, menulis, dan berhitung sesuai jenjangnya.',
    'Setiap murid mengikuti sedikitnya satu kegiatan ekstrakurikuler tiap tahun ajaran.',
    'Kehadiran murid dan guru terjaga di atas sembilan puluh lima persen.',
    'Sekolah mempertahankan nilai akreditasi pada penilaian berikutnya.',
  ],
  description: 'Sekolah dasar negeri yang mendampingi anak belajar dengan tenang lewat kelas yang tertata, guru wali yang mengenal setiap murid, dan lingkungan yang aman.',
});

// Field bertipe daftar perlu penanganan terpisah saat normalisasi.
const LIST_FIELDS = ['missions', 'goals'];

const sanitizeList = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  // Panel admin menyunting misi sebagai teks multi-baris.
  return String(value || '').split('\n').map((line) => line.trim()).filter(Boolean);
};

/**
 * Menggabungkan isi tersimpan dengan bawaan. Field yang kosong atau tidak dikenal
 * jatuh ke bawaan, sehingga identitas tidak pernah tampil bolong walau pembeli
 * baru mengisi sebagiannya.
 */
export const normalizeSchoolIdentity = (stored) => {
  const source = stored && typeof stored === 'object' ? stored : {};
  const result = { ...DEFAULT_SCHOOL_IDENTITY };

  Object.keys(DEFAULT_SCHOOL_IDENTITY).forEach((field) => {
    const incoming = source[field];
    if (incoming === undefined || incoming === null) return;

    if (LIST_FIELDS.includes(field)) {
      const list = sanitizeList(incoming);
      if (list.length > 0) result[field] = list;
      return;
    }

    const text = String(incoming).trim();
    // Sebagian field memang boleh kosong (whatsapp, mapUrl), jadi string kosong
    // dihormati bila bawaannya juga kosong.
    if (text || DEFAULT_SCHOOL_IDENTITY[field] === '') result[field] = text;
  });

  return result;
};

/**
 * Tahun pembuka dari sebuah tahun ajaran: '2026/2027' menjadi '2026'.
 *
 * Dipakai di tempat yang hanya menyebut satu tahun, seperti tautan "PPDB 2026".
 * Menerima pemisah garis miring maupun tanda hubung, dan mengembalikan string
 * kosong bila isinya tidak memuat tahun — supaya labelnya jadi "PPDB" saja alih-alih
 * "PPDB undefined".
 */
export const tahunAjaranAwal = (tahunAjaran) => {
  const cocok = String(tahunAjaran || '').match(/\d{4}/);
  return cocok ? cocok[0] : '';
};

const readCache = () => {
  try {
    return normalizeSchoolIdentity(JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'));
  } catch {
    return { ...DEFAULT_SCHOOL_IDENTITY };
  }
};

let cached = readCache();
const subscribers = new Set();

export const getSchoolIdentity = () => cached;

/** Berlangganan perubahan identitas; mengembalikan fungsi berhenti berlangganan. */
export const subscribeSchoolIdentity = (listener) => {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
};

// Warna hanya diterima bila berbentuk heks yang sah, supaya isi tersimpan tidak
// bisa menyuntikkan nilai CSS sembarangan ke elemen root.
const WARNA_HEKS = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/* ─── Palet turunan ────────────────────────────────────────────────────────
 *
 * Halaman publik memakai satu sapuan warna, bukan satu warna tunggal: tombol
 * dan judulnya bergradasi dari aksen menuju ungu lalu merona. Dulu keduabelas
 * warnanya ditulis langsung di 19 berkas (151 kemunculan), jadi pemilih "Aksen
 * warna" di panel Identitas tersimpan tanpa mengubah apa pun.
 *
 * Ternyata sapuan itu sangat teratur: seluruh warna adalah aksen yang digeser
 * rona (hue) sambil menurun kejenuhannya, pada terang yang hampir sama. Jadi
 * palet lengkapnya dapat DITURUNKAN dari satu heks pilihan pembeli memakai
 * selisih tetap di bawah — yang diukur dari palet asli desain, sehingga pada
 * aksen bawaan #6470ff hasilnya kembali ke warna aslinya.
 */

// Selisih dari aksen dalam HSL: [rona, kejenuhan, terang].
// Nilai acuan pada #6470ff (H 235,4 · S 100 · L 69,6) tercantum di komentar.
const SELISIH_PALET = {
  'aksen': [0, 0, 0],                       // #6470ff — warna utama
  'aksen-pekat': [-1.6, 0, -1.8],           // #5b6cff — awal gradasi, sedikit lebih dalam
  'aksen-tengah': [18.3, -18.5, -1.4],      // #8a6cf0 — ungu
  'aksen-tengah-2': [28.3, -18.5, -1.4],    // #a06cf0 — ungu terang
  'aksen-ujung': [87.7, -37.7, 3.3],        // #e58fc4 — merona, ujung gradasi
  'aksen-hangat': [148.2, -18.5, -1.4],     // #f0a06c — jingga, dipakai pasangan gradasi terakhir
  'aksen-muda': [-5.7, -6.5, 12.2],         // #a5b4fc — tint
  'aksen-samar': [-7.4, -3.5, 19.2],        // #c7d2fe — tint paling pucat
};

const jepit = (n, min, max) => Math.min(max, Math.max(min, n));

/** '#abc' atau '#aabbcc' menjadi {h, s, l} dengan s dan l dalam persen. */
const keHsl = (hex) => {
  const bersih = hex.slice(1);
  const penuh = bersih.length === 3 ? bersih.split('').map((c) => c + c).join('') : bersih;
  const r = parseInt(penuh.slice(0, 2), 16) / 255;
  const g = parseInt(penuh.slice(2, 4), 16) / 255;
  const b = parseInt(penuh.slice(4, 6), 16) / 255;

  const maks = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (maks + min) / 2;
  const beda = maks - min;
  if (beda === 0) return { h: 0, s: 0, l: l * 100 };

  const s = l > 0.5 ? beda / (2 - maks - min) : beda / (maks + min);
  let h;
  if (maks === r) h = ((g - b) / beda) % 6;
  else if (maks === g) h = (b - r) / beda + 2;
  else h = (r - g) / beda + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s: s * 100, l: l * 100 };
};

/** {h, s, l} menjadi tiga kanal 0–255. */
const keRgb = ({ h, s, l }) => {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = ln - c / 2;
  const urut = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]];
  const [r, g, b] = urut[Math.floor(hp) % 6];
  return [r, g, b].map((v) => Math.round((v + m) * 255));
};

const keHeks = (hsl) => `#${keRgb(hsl).map((v) => v.toString(16).padStart(2, '0')).join('')}`;

/**
 * Menurunkan seluruh palet halaman publik dari satu warna aksen.
 *
 * @param {string} hexAksen heks yang sudah lolos WARNA_HEKS
 * @returns {Record<string, string>} nama properti CSS (tanpa `--sekolah-`) ke nilainya
 */
export const turunkanPalet = (hexAksen) => {
  const dasar = keHsl(hexAksen);
  const palet = {};

  Object.entries(SELISIH_PALET).forEach(([nama, [dh, ds, dl]]) => {
    palet[nama] = keHeks({
      h: dasar.h + dh,
      // Dijepit supaya aksen yang nyaris kelabu atau nyaris putih tidak
      // menghasilkan nilai di luar rentang HSL yang sah.
      s: jepit(dasar.s + ds, 0, 100),
      l: jepit(dasar.l + dl, 0, 100),
    });
  });

  // Kanal terpisah untuk bayangan: `rgb(var(--sekolah-aksen-rgb) / .95)`.
  // Bayangan di halaman publik memakai rgba dengan alfa, dan alfa tidak bisa
  // ditempelkan pada nilai heks di dalam var().
  palet['aksen-rgb'] = keRgb(dasar).join(' ');

  return palet;
};

export const applySchoolIdentity = (identity) => {
  cached = normalizeSchoolIdentity(identity);
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Mode privasi ketat memblokir penyimpanan; singgahan memori tetap jalan.
  }
  try {
    const warna = WARNA_HEKS.test(cached.accentColor) ? cached.accentColor : DEFAULT_SCHOOL_IDENTITY.accentColor;
    const akar = document.documentElement.style;
    Object.entries(turunkanPalet(warna)).forEach(([nama, nilai]) => {
      akar.setProperty(`--sekolah-${nama}`, nilai);
    });
  } catch {
    // Lingkungan tanpa DOM (test) tidak perlu properti CSS.
  }
  subscribers.forEach((listener) => {
    try { listener(cached); } catch { /* satu pelanggan gagal tidak menjatuhkan yang lain */ }
  });
  return cached;
};

/** Dipanggil sekali saat aplikasi dimuat. Aman dipakai tanpa login. */
export const hydrateSchoolIdentity = async () => {
  const map = await fetchWebsiteContentMap({ keys: [SCHOOL_IDENTITY_KEY] });
  const stored = map?.[SCHOOL_IDENTITY_KEY];
  if (stored) applySchoolIdentity(stored);
  return cached;
};

export const saveSchoolIdentity = async (identity) => {
  const normalized = normalizeSchoolIdentity(identity);
  await saveWebsiteContentItem({ key: SCHOOL_IDENTITY_KEY, content: normalized, isPublic: true });
  return applySchoolIdentity(normalized);
};

// Palet dipasang dari singgahan begitu modul dimuat, sebelum hydrateSchoolIdentity
// selesai memanggil server. Tanpa ini pengunjung yang kembali akan melihat warna
// bawaan sekejap lalu berkedip ke warna sekolahnya.
applySchoolIdentity(cached);
