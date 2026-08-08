import { fetchWebsiteContentMap, saveWebsiteContentItem } from '@/lib/publicContentAdapters';

/**
 * Isi halaman Ekstrakurikuler yang dapat disunting pembeli.
 *
 * Dulu sepuluh kegiatan ditanam di kode, lengkap dengan nama pembina karangan
 * ("Hendra Wijaya, S.Pd." dsb.) — orang yang tidak ada tampil sebagai pembina di
 * situs sekolah pembeli. Sekarang seluruh daftar disimpan di `website_content`
 * kunci `ekskul_content` dan disunting di Konten → Ekstrakurikuler.
 *
 * Statistik halaman (kegiatan aktif, murid terdaftar, guru pembina) TIDAK
 * disimpan: ketiganya dihitung otomatis dari daftar, jadi tidak pernah berbeda
 * dari isinya. Warna kartu juga tidak disunting pembeli — dipilih otomatis di
 * halaman berdasarkan urutan (lihat GRADIEN di EkstrakurikulerPage).
 *
 * Bawaan di bawah sengaja mengosongkan nama pembina: kegiatannya jadi contoh yang
 * bagus, tapi nama pembina wajib diisi pembeli.
 */

export const EKSKUL_CONTENT_KEY = 'ekskul_content';

export const HARI_OPTIONS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

const R = (nama, bidang, hari, jam, tempat, terisi, kuota, kelas, cerita) => ({
  nama, bidang, hari, jam, pembina: '', tempat, terisi, kuota, kelas, cerita,
});

export const DEFAULT_EKSKUL_CONTENT = Object.freeze({
  records: Object.freeze([
    R('Pramuka Siaga & Penggalang', 'Kepramukaan', 'Jumat', '15.00–16.30', 'Halaman belakang', 68, 80, 'Kelas III–VI', 'Regu berlatih tali-temali, sandi morse, dan pertolongan pertama. Setiap semester diadakan perkemahan satu malam di halaman sekolah.'),
    R('Atletik', 'Olahraga', 'Selasa', '15.30–16.30', 'Lapangan sekolah', 24, 30, 'Kelas IV–VI', 'Latihan lari jarak pendek, lompat jauh, dan lempar bola. Murid menonjol disiapkan untuk seleksi O2SN tingkat kecamatan.'),
    R('Sanggar Tari', 'Seni', 'Rabu', '15.00–16.30', 'Aula sekolah', 22, 24, 'Kelas II–VI', 'Tari daerah, kostum dijahit bersama orang tua murid, tampil pada pentas seni akhir tahun.'),
    R('Klub Mendongeng', 'Literasi', 'Kamis', '13.30–14.30', 'Perpustakaan', 18, 20, 'Kelas I–IV', 'Murid berlatih membaca nyaring lalu bercerita tanpa teks. Cerita diambil dari koleksi perpustakaan.'),
    R('Klub Sains', 'Akademik', 'Rabu', '13.30–14.30', 'Ruang kelas', 20, 24, 'Kelas IV–VI', 'Percobaan sederhana memakai bahan sekitar sekolah. Hasil percobaan dipamerkan pada pekan sains.'),
    R('Seni Musik & Paduan Suara', 'Seni', 'Kamis', '15.00–16.30', 'Aula sekolah', 30, 36, 'Kelas III–VI', 'Latihan pianika, angklung, dan paduan suara. Mengisi upacara bendera setiap awal bulan.'),
    R('Dokter Kecil', 'Kesehatan', 'Senin', '13.30–14.30', 'Ruang UKS', 16, 18, 'Kelas IV–VI', 'Belajar pertolongan pertama dan menjaga kebersihan kelas. Bertugas bergilir saat upacara.'),
    R('Kebun & Bank Sampah', 'Lingkungan', 'Senin', '15.00–16.00', 'Kebun sekolah', 40, 48, 'Kelas IV–VI', 'Merawat petak sayur, memilah sampah, dan mencatat hasil panen.'),
    R('Klub Komputer', 'Akademik', 'Jumat', '13.30–14.30', 'Ruang komputer', 26, 32, 'Kelas V–VI', 'Mengetik sepuluh jari, menyusun dokumen sederhana, dan mencari informasi dengan pendampingan guru.'),
  ]),
});

const teks = (value) => String(value ?? '').trim();

const angka = (nilai) => {
  const n = Number(String(nilai ?? '').trim());
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
};

const salinBawaan = () => JSON.parse(JSON.stringify(DEFAULT_EKSKUL_CONTENT.records));

const normalizeRecords = (rows) => {
  if (!Array.isArray(rows)) return salinBawaan();
  return rows.map((row) => {
    const nama = teks(row?.nama);
    if (!nama) return null;
    return {
      nama,
      bidang: teks(row?.bidang) || 'Umum',
      hari: HARI_OPTIONS.includes(teks(row?.hari)) ? teks(row.hari) : 'Senin',
      jam: teks(row?.jam),
      pembina: teks(row?.pembina),
      tempat: teks(row?.tempat),
      terisi: angka(row?.terisi),
      kuota: Math.max(angka(row?.kuota), angka(row?.terisi)),
      kelas: teks(row?.kelas),
      cerita: teks(row?.cerita),
    };
  }).filter(Boolean);
};

export const normalizeEkskulContent = (stored) => {
  const source = stored && typeof stored === 'object' ? stored : {};
  const records = source.records === undefined ? salinBawaan() : normalizeRecords(source.records);
  return { records };
};

export const fetchEkskulContent = async () => {
  const map = await fetchWebsiteContentMap({ keys: [EKSKUL_CONTENT_KEY] });
  return normalizeEkskulContent(map?.[EKSKUL_CONTENT_KEY]);
};

export const saveEkskulContent = async (content) => {
  const normalized = normalizeEkskulContent(content);
  await saveWebsiteContentItem({ key: EKSKUL_CONTENT_KEY, content: normalized, isPublic: true });
  return normalized;
};
