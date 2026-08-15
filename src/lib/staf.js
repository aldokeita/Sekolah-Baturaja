/**
 * staf.js — cara menampilkan seorang guru atau staf di halaman publik.
 *
 * Empat halaman publik menampilkan orang dari Data Guru: Profil (kartu guru),
 * Kontak (direktori), Berita (penulis artikel contoh), dan Prestasi (pendamping).
 * Sebelumnya masing-masing menulis nama karangan sendiri, lalu penerjemahan
 * peran dan pembuatan inisial disalin ulang di setiap halaman yang dibereskan.
 *
 * Data yang tersedia dibatasi `GET /api/content/teachers`: id, nama, jabatan,
 * foto_url, roles, jenis_kelamin. Tidak ada surel pribadi, tidak ada biografi —
 * jadi jangan menampilkan hal yang bukan bagian dari daftar itu.
 */

// Peran internal diterjemahkan ke sebutan yang dipahami orang tua murid.
// 'Pentashih' tetap dipakai sebagai nilai tersimpan; hanya labelnya berubah.
export const SEBUTAN_PERAN = {
  'Kepala Sekolah': 'Kepala Sekolah',
  Pentashih: 'Wakil Kepala Sekolah',
  Pengajar: 'Guru',
  'Tata Usaha': 'Tata Usaha',
};

/**
 * Peran 'Kepala Sekolah' adalah SEBUTAN, bukan tingkat akses.
 *
 * Ia tidak dipetakan ke app_role mana pun: kepala sekolah memakai dashboard yang
 * mengikuti peran lain di akunnya (Admin, Tata Usaha, atau Pengajar), sama seperti
 * di sekolah sungguhan seorang kepala sekolah tetap seorang guru bersertifikat.
 * Yang ditentukan peran ini adalah sebutannya, penanda tangan pada dokumen, dan
 * kutipan di halaman Profil publik.
 *
 * Jangan menambahkannya ke pemetaan app_role tanpa memutuskan lebih dulu dashboard
 * mana yang ia terima — dashboard Wakil Kepala Sekolah yang ada sekarang masih
 * berisi materi program Qur'an (distribusi jilid, calon khotim) dan belum layak
 * untuk kepala sekolah dasar umum.
 */
export const PERAN_KEPALA_SEKOLAH = 'Kepala Sekolah';

/** True bila akun ini memegang sebutan kepala sekolah, lewat peran atau jabatan. */
export const isKepalaSekolah = (guru) => {
  const roles = Array.isArray(guru?.roles) ? guru.roles : [];
  if (roles.includes(PERAN_KEPALA_SEKOLAH)) return true;
  // Jabatan bebas teks tetap dihormati: halaman Profil publik sudah lama
  // mengenali kepala sekolah dari jabatannya, dan data sekolah yang sudah
  // terisi tidak boleh berhenti dikenali hanya karena ada peran baru.
  const jabatan = String(guru?.jabatan || '');
  return /kepala\s+sekolah/i.test(jabatan) && !/wakil/i.test(jabatan);
};

export const labelStafRole = (value) => String(value ?? '')
  .trim()
  .replace(/\bpentashih\b/gi, 'Wakil Kepala Sekolah');

/** Sebutan yang ditampilkan: jabatan bila ada, kalau tidak jatuh ke perannya. */
export const sebutanStaf = (guru) => {
  const jabatan = labelStafRole(guru?.jabatan);
  if (jabatan) return jabatan;
  const roles = Array.isArray(guru?.roles) ? guru.roles : [];
  // Kepala sekolah didahulukan atas peran lain di akun yang sama. Kepala sekolah
  // hampir selalu juga tercatat sebagai Pengajar, dan tanpa pengurutan ini
  // `find` mengambil peran mana pun yang lebih dulu tersimpan — sehingga kepala
  // sekolah bisa muncul sebagai "Guru" di direktori publik.
  const peran = roles.includes(PERAN_KEPALA_SEKOLAH) ? PERAN_KEPALA_SEKOLAH : roles.find(Boolean);
  return labelStafRole(SEBUTAN_PERAN[peran] || peran || 'Staf sekolah');
};

/**
 * Dua huruf awal untuk kotak inisial ketika guru belum mengunggah foto.
 *
 * Hanya kata berawal huruf kapital yang dipakai, supaya gelar dan kata sambung
 * ("Hj.", "bin", "S.Pd.") tidak ikut. Mengembalikan tanda pisah bila tidak ada
 * yang cocok, jadi kotaknya tidak pernah kosong.
 */
export const inisialNama = (nama) => String(nama || '')
  .split(/\s+/)
  .filter((kata) => /^[A-Z]/.test(kata))
  .slice(0, 2)
  .map((kata) => kata[0])
  .join('') || '—';

/**
 * Mengambil satu staf berdasarkan posisi, berputar bila daftarnya lebih pendek.
 *
 * Dipakai halaman yang menyandingkan isi contoh dengan orang sungguhan (penulis
 * berita, pendamping prestasi). Mengembalikan null bila daftar kosong, supaya
 * pemanggilnya bisa menahan diri alih-alih menampilkan nama kosong.
 */
export const stafKe = (daftar, indeks) => {
  if (!Array.isArray(daftar) || daftar.length === 0) return null;
  return daftar[indeks % daftar.length];
};
