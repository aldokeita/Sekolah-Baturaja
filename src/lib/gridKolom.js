/**
 * Jumlah kolom grid yang mengikuti isinya.
 *
 * Markup halaman publik diturunkan dari mockup, dan mockup selalu digambar
 * dengan barisnya penuh — biasanya empat kartu. Begitu datanya milik sekolah
 * sungguhan, jumlahnya bebas: satu ruang fasilitas, dua album, tiga chip kontak
 * karena WhatsApp dikosongkan. Kolom yang dipaku empat menyisakan lubang di
 * kanan, lengkap dengan garis pemisah yang menggantung.
 *
 * Keduanya di sini dipakai sebagai nilai `grid-template-columns` langsung.
 */

/** Batasi ke rentang [1, maks] — grid tanpa kolom tidak sah. */
const batasi = (n, maks) => Math.max(1, Math.min(maks, Math.floor(n) || 0));

/**
 * Grid biasa: satu kartu satu kolom.
 *
 * @param {number} jumlah - banyak kartu yang akan dirender
 * @param {number} maks - kolom terbanyak yang masih enak dilihat
 * @returns {string} nilai grid-template-columns
 */
export const kolomUntuk = (jumlah, maks = 4) => `repeat(${batasi(jumlah, maks)},1fr)`;

/**
 * Grid mozaik: kartu boleh melebar lebih dari satu kolom, jadi yang dihitung
 * kapasitasnya, bukan cacahnya. Kembaliannya berupa angka supaya pemanggil bisa
 * memangkas lebar tiap kartu agar tidak melampaui jumlah kolom.
 *
 * @param {number[]} lebar - lebar tiap kartu dalam satuan kolom
 * @param {number} maks - kolom terbanyak
 * @returns {number} jumlah kolom
 */
export const kapasitasKolom = (lebar, maks = 4) =>
  batasi(lebar.reduce((jml, l) => jml + (Number(l) || 1), 0), maks);
