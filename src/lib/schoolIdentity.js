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
  // Aksen warna sekolah. Dipasang sebagai CSS custom property --sekolah-aksen
  // pada elemen root oleh applySchoolIdentity, jadi CSS mana pun bisa
  // memakainya tanpa perlu menyentuh JavaScript.
  accentColor: '#6470ff',
  vision: 'Menjadi sekolah dasar yang menumbuhkan murid berkarakter, cakap berpikir, dan senang belajar.',
  missions: [
    'Menyelenggarakan pembelajaran yang berpusat pada murid dan menyenangkan.',
    'Menumbuhkan karakter, kedisiplinan, dan kepedulian sosial.',
    'Mendampingi setiap murid sesuai kebutuhan dan kecepatan belajarnya.',
    'Membangun kerja sama yang erat antara sekolah, orang tua, dan masyarakat.',
  ],
  description: 'Sekolah dasar negeri yang mendampingi anak belajar dengan tenang lewat kelas yang tertata, guru wali yang mengenal setiap murid, dan lingkungan yang aman.',
});

// Field bertipe daftar perlu penanganan terpisah saat normalisasi.
const LIST_FIELDS = ['missions'];

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

export const applySchoolIdentity = (identity) => {
  cached = normalizeSchoolIdentity(identity);
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Mode privasi ketat memblokir penyimpanan; singgahan memori tetap jalan.
  }
  try {
    const warna = WARNA_HEKS.test(cached.accentColor) ? cached.accentColor : DEFAULT_SCHOOL_IDENTITY.accentColor;
    document.documentElement.style.setProperty('--sekolah-aksen', warna);
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
