import { fetchWebsiteContentMap, saveWebsiteContentItem } from '@/lib/publicContentAdapters';

/**
 * Identitas sekolah — satu sumber untuk seluruh aplikasi.
 *
 * Aplikasi ini template yang akan dikustomisasi pembeli, jadi identitas TIDAK
 * boleh ditanam di kode. Nilai di bawah hanyalah bawaan contoh.
 *
 * ── Dua kunci, dua pemilik ────────────────────────────────────────────────────
 *
 * Isinya dipecah ke DUA kunci `website_content` karena pemiliknya berbeda:
 *
 *   `school_identity`  hanya superadmin (ada di `brandKeys` pada content.go).
 *                      Nama sekolah, nama singkat, inisial logo, dan warna.
 *   `school_info`      pembeli (peran admin). Kontak, alamat, jam layanan, tahun
 *                      ajaran, deskripsi, visi, misi, dan tujuan.
 *
 * Kenapa dipecah dan bukan sekadar menambah pengecualian di `brandKeys`:
 * penjagaan di Go bekerja per-KUNCI, sedangkan sebelumnya seluruh field berada di
 * dalam satu objek `school_identity` — jadi izinnya seluruhnya-atau-tidak, dan
 * pembeli tidak bisa mengubah nomor telepon maupun visi sekolahnya sendiri.
 *
 * `getSchoolIdentity()` mengembalikan GABUNGAN keduanya, jadi seluruh pembaca
 * (nav, footer, Kontak, Profil, kuitansi, dashboard) tidak perlu tahu soal
 * pemecahan ini. Yang berbeda hanya penulisannya.
 *
 * Disimpan di `website_content`, bukan `/api/config`, karena halaman publik harus
 * bisa membacanya TANPA token — `GET /api/content/website` terbuka, sedangkan
 * `/api/config` di balik RequireAuth.
 *
 * localStorage hanya singgahan supaya identitas tidak berkedip saat halaman
 * dimuat; sumber kebenaran tetap basis data.
 */

export const SCHOOL_IDENTITY_KEY = 'school_identity';
export const SCHOOL_INFO_KEY = 'school_info';
const CACHE_KEY = 'sekolah_identitas_cache';

/** Field yang hanya boleh diubah penjual. Sisanya milik pembeli. */
export const BRAND_FIELDS = Object.freeze([
  'name', 'shortName', 'logoAbbr', 'accentColor', 'accentColor2', 'accentMode',
]);

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
  /* Warna sekolah: dua warna untuk gradasi, atau satu bila memilih solid.
   * Seluruh palet halaman publik diturunkan dari sini oleh turunkanPalet, lalu
   * dipasang sebagai CSS custom property pada elemen root — jadi CSS mana pun
   * bisa memakainya tanpa menyentuh JavaScript. */
  accentColor: '#6470ff',
  accentColor2: '#e58fc4',
  accentMode: 'gradasi',
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

/** Memecah satu objek identitas menjadi dua muatan sesuai pemiliknya. */
export const pisahIdentitas = (identity) => {
  const penuh = normalizeSchoolIdentity(identity);
  const merek = {};
  const info = {};
  Object.keys(DEFAULT_SCHOOL_IDENTITY).forEach((field) => {
    if (BRAND_FIELDS.includes(field)) merek[field] = penuh[field];
    else info[field] = penuh[field];
  });
  return { merek, info };
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
 * Halaman publik memakai sapuan warna, bukan satu warna tunggal: tombol dan
 * judulnya bergradasi dari warna awal menuju warna akhir. Dulu keduabelas
 * warnanya ditulis langsung di 30 berkas (328 kemunculan), jadi pemilih "Aksen
 * warna" di panel Identitas tersimpan tanpa mengubah apa pun.
 *
 * Sekolah memilih DUA warna — awal dan akhir gradasi — atau satu warna saja bila
 * memilih tampilan solid. Delapan properti CSS diturunkan dari pilihan itu.
 *
 * Dua sifat yang wajib dijaga:
 *
 * 1. Pada pilihan bawaan (#6470ff → #e58fc4) hasilnya sama dengan palet asli
 *    desain. Dua stop di tengah punya `bentuk` — selisih kecil dari interpolasi
 *    lurus, diukur dari palet aslinya — supaya kecocokan itu tercapai tanpa
 *    mengorbankan keluwesan untuk pasangan warna lain.
 * 2. HANYA dua rona yang muncul. Tidak ada stop yang memutar rona ke luar rentang
 *    kedua warna pilihan; yang membedakan stop satu dari lainnya adalah posisi,
 *    kejenuhan, dan terang. Dulu `aksen-hangat` melanggarnya dan menghasilkan
 *    magenta pada gradasi hijau→jingga.
 *
 * Satu nilai memang berbeda dari desain aslinya karena sifat kedua itu:
 * `aksen-hangat` yang dulu jingga (#f0a06c) kini merah muda lebih dalam
 * (#f06cbd). Itu satu-satunya pergeseran tampilan bawaan.
 */

export const AKSEN_GRADASI = 'gradasi';
export const AKSEN_SOLID = 'solid';

/* Stop di sepanjang sapuan.
 *
 * `posisi`  — letak di antara warna awal (0) dan warna akhir (1).
 * `bentuk`  — [kejenuhan, terang] yang ditambahkan setelah interpolasi, menjaga
 *             lengkung sapuan aslinya alih-alih garis lurus.
 * `dariAwal` — [rona, kejenuhan, terang] relatif terhadap warna awal.
 * `dariAkhir` — [rona, kejenuhan, terang] relatif terhadap warna akhir.
 * `tint`     — [rona, faktorKejenuhan, porsiKeputih]: dicampur menuju putih
 *             sebanyak `porsiKeputih` dari jarak terang ke 100%.
 */
const STOP_PALET = [
  { nama: 'aksen', posisi: 0, bentuk: [0, 0] },
  // Awal gradasi, sedikit lebih dalam dari warna utama.
  { nama: 'aksen-pekat', dariAwal: [-1.6, 0, -1.8] },
  { nama: 'aksen-tengah', posisi: 0.2085, bentuk: [-10.66, -2.07] },
  { nama: 'aksen-tengah-2', posisi: 0.3226, bentuk: [-6.36, -2.45] },
  { nama: 'aksen-ujung', posisi: 1, bentuk: [0, 0] },
  /* Ujung terdalam. RONANYA SAMA dengan warna akhir — hanya lebih pekat dan
   * sedikit lebih dalam, seperti hubungan `aksen-pekat` dengan `aksen`.
   *
   * Sekolah memilih DUA warna, jadi palet tidak boleh memunculkan warna ketiga.
   * Dua cara sebelumnya melakukannya dan keduanya salah: memutar rona +60° tetap
   * membuat gradasi hijau→jingga mendarat di hijau limau menyala, dan
   * melanjutkan arah sapuan melewati warna akhir membuat hijau→jingga mendarat
   * di magenta. Keduanya warna yang tidak dipilih siapa pun.
   *
   * Nilai ini selalu dipasangkan dengan `aksen-ujung` sebagai gradasi (sembilan
   * tempat di halaman publik), jadi ia tetap perlu berbeda supaya gradasinya
   * tidak rata — cukup dibedakan kedalamannya, bukan ronanya. */
  { nama: 'aksen-hangat', dariAkhir: [0, 19.2, -4.7] },
  /* Tint dihitung sebagai campuran menuju PUTIH, bukan penambahan terang tetap.
   * Penambahan tetap (+12,2) hanya memucat bila warna aksennya sudah terang;
   * pada hijau tua ia menghasilkan hijau menyala, padahal kedua nilai ini dipakai
   * sebagai latar lembut kartu guru dan mosaik fasilitas. */
  { nama: 'aksen-muda', tint: [-5.7, 0.935, 0.400] },
  { nama: 'aksen-samar', tint: [-7.4, 0.965, 0.632] },
];

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
 * Rona (hue) warna akhir yang "dibuka lipatannya" relatif terhadap warna awal.
 *
 * Rona berputar 0–360, jadi selisih mentah bisa melompat: biru 235 ke merah 350
 * terbaca +115, sedangkan merah 350 ke biru 235 terbaca −115 padahal keduanya
 * jalur yang sama. Arah terpendek dipilih supaya gradasi tidak memutari seluruh
 * roda warna dan melewati warna yang tidak dipilih sekolah.
 */
const bukaRona = (awal, akhir) => {
  let beda = akhir - awal;
  while (beda > 180) beda -= 360;
  while (beda < -180) beda += 360;
  return awal + beda;
};

/**
 * Menurunkan seluruh palet halaman publik dari warna pilihan sekolah.
 *
 * @param {string} hexAwal warna awal gradasi; heks yang sudah lolos WARNA_HEKS
 * @param {string} [hexAkhir] warna akhir gradasi. Diabaikan pada mode solid.
 * @param {'gradasi'|'solid'} [mode] solid memakai satu warna untuk seluruh sapuan
 * @returns {Record<string, string>} nama properti CSS (tanpa `--sekolah-`) ke nilainya
 */
export const turunkanPalet = (hexAwal, hexAkhir, mode = AKSEN_GRADASI) => {
  const awal = keHsl(hexAwal);
  const solid = mode === AKSEN_SOLID || !hexAkhir;
  // Pada mode solid seluruh sapuan memakai satu warna, jadi warna akhir sama
  // dengan warna awal dan interpolasi apa pun menghasilkan warna itu juga.
  const akhir = solid ? awal : keHsl(hexAkhir);
  const ronaAkhir = solid ? awal.h : bukaRona(awal.h, akhir.h);

  const palet = {};
  STOP_PALET.forEach(({ nama, posisi, bentuk, dariAwal, dariAkhir, tint }) => {
    let hsl;

    if (dariAwal) {
      const [dh, ds, dl] = dariAwal;
      hsl = { h: awal.h + dh, s: awal.s + ds, l: awal.l + dl };
    } else if (dariAkhir) {
      // Rona diambil dari `ronaAkhir` yang sudah dibuka lipatannya, bukan dari
      // `akhir.h` mentah — supaya penambahan rona apa pun bergerak searah sapuan.
      const [dh, ds, dl] = dariAkhir;
      hsl = { h: ronaAkhir + dh, s: akhir.s + ds, l: akhir.l + dl };
    } else if (tint) {
      const [dh, faktorS, porsi] = tint;
      hsl = {
        h: awal.h + dh,
        s: awal.s * faktorS,
        l: awal.l + porsi * (100 - awal.l),
      };
    } else {
      // `bentuk` hanya berlaku pada gradasi: ia menjaga lengkung sapuan aslinya.
      // Pada mode solid ia justru menggeser warna sedikit dari yang dipilih
      // sekolah, jadi seluruh stop harus benar-benar sama.
      const [ds, dl] = solid ? [0, 0] : bentuk;
      hsl = {
        h: awal.h + posisi * (ronaAkhir - awal.h),
        s: awal.s + posisi * (akhir.s - awal.s) + ds,
        l: awal.l + posisi * (akhir.l - awal.l) + dl,
      };
    }

    palet[nama] = keHeks({
      h: hsl.h,
      // Dijepit supaya warna yang nyaris kelabu atau nyaris putih tidak
      // menghasilkan nilai di luar rentang HSL yang sah.
      s: jepit(hsl.s, 0, 100),
      l: jepit(hsl.l, 0, 100),
    });
  });

  // Kanal terpisah untuk bayangan: `rgb(var(--sekolah-aksen-rgb) / .95)`.
  // Bayangan di halaman publik memakai rgba dengan alfa, dan alfa tidak bisa
  // ditempelkan pada nilai heks di dalam var().
  palet['aksen-rgb'] = keRgb(awal).join(' ');

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
    const sah = (warna, bawaan) => (WARNA_HEKS.test(warna) ? warna : bawaan);
    const awal = sah(cached.accentColor, DEFAULT_SCHOOL_IDENTITY.accentColor);
    const akhir = sah(cached.accentColor2, DEFAULT_SCHOOL_IDENTITY.accentColor2);
    const akar = document.documentElement.style;
    Object.entries(turunkanPalet(awal, akhir, cached.accentMode)).forEach(([nama, nilai]) => {
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

/**
 * Dipanggil sekali saat aplikasi dimuat. Aman dipakai tanpa login.
 *
 * Kedua kunci dibaca sekaligus lalu digabung. `school_info` ditumpuk DI ATAS
 * `school_identity` supaya pemasangan lama — yang masih menyimpan semua field di
 * dalam `school_identity` — tetap tampil benar sampai penjual atau pembeli
 * menyimpan sekali lewat panelnya.
 */
export const hydrateSchoolIdentity = async () => {
  const map = await fetchWebsiteContentMap({ keys: [SCHOOL_IDENTITY_KEY, SCHOOL_INFO_KEY] });
  const merek = map?.[SCHOOL_IDENTITY_KEY];
  const info = map?.[SCHOOL_INFO_KEY];
  if (merek || info) applySchoolIdentity({ ...(merek || {}), ...(info || {}) });
  return cached;
};

/**
 * Menyimpan bagian merek — hanya superadmin yang diizinkan server.
 *
 * Menerima objek identitas utuh dan mengirim bagian mereknya saja, supaya panel
 * tidak perlu memilah field sendiri.
 */
export const saveSchoolBrand = async (identity) => {
  const { merek } = pisahIdentitas(identity);
  await saveWebsiteContentItem({ key: SCHOOL_IDENTITY_KEY, content: merek, isPublic: true });
  return applySchoolIdentity({ ...cached, ...merek });
};

/** Menyimpan bagian info sekolah — boleh dilakukan pembeli. */
export const saveSchoolInfo = async (identity) => {
  const { info } = pisahIdentitas(identity);
  await saveWebsiteContentItem({ key: SCHOOL_INFO_KEY, content: info, isPublic: true });
  return applySchoolIdentity({ ...cached, ...info });
};

// Palet dipasang dari singgahan begitu modul dimuat, sebelum hydrateSchoolIdentity
// selesai memanggil server. Tanpa ini pengunjung yang kembali akan melihat warna
// bawaan sekejap lalu berkedip ke warna sekolahnya.
applySchoolIdentity(cached);
