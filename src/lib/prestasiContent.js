import {
  announceWebsiteContentUpdate,
  fetchWebsiteContentMap,
  saveWebsiteContentItem,
} from '@/lib/publicContentAdapters';

/**
 * Isi halaman Prestasi yang dapat disunting pembeli.
 *
 * Kenapa berkas ini ada: halaman Prestasi dulu menanam 12 catatan prestasi di
 * kode, LENGKAP dengan nama juara murid karangan ("Rafi Alfarizi, kelas VI A",
 * "Nayla Syakira, kelas VI B", dan seterusnya). Di situs sekolah pembeli, orang
 * yang tidak ada itu tampil seolah juara sungguhan. Pembeli tidak bisa
 * menggantinya tanpa menyentuh kode.
 *
 * Sekarang catatan prestasi + dua angka statistik disimpan di `website_content`
 * kunci `prestasi_content` dan disunting dari Konten → Prestasi. Bawaan di bawah
 * sengaja NETRAL (tanpa nama yang terlihat asli) dan WAJIB diganti pembeli —
 * sama seperti wilayah dan nama guru contoh.
 *
 * Dua statistik lain ("Tingkat nasional", "Tingkat provinsi") tidak disimpan:
 * keduanya dihitung otomatis dari daftar catatan di halaman, supaya angkanya
 * tidak pernah berbeda dari isi daftar.
 */

export const PRESTASI_CONTENT_KEY = 'prestasi_content';

export const TINGKAT_OPTIONS = ['Nasional', 'Provinsi', 'Kabupaten', 'Kecamatan'];
export const BIDANG_OPTIONS = ['Akademik', 'Seni', 'Olahraga', 'Keagamaan', 'Lingkungan', 'Kepramukaan'];

export const DEFAULT_PRESTASI_CONTENT = Object.freeze({
  // Dua angka yang tidak bisa dihitung dari daftar. Nasional & Provinsi dihitung
  // otomatis dari catatan, jadi tidak disimpan di sini.
  stats: Object.freeze({ muridTerlibat: 0, tahunBerturut: 0 }),

  // Catatan prestasi contoh — NETRAL, wajib diganti pembeli. Tidak memakai nama
  // lengkap yang terlihat asli; "Nama Murid, kelas V" jelas placeholder.
  records: Object.freeze([
    {
      tahun: '2026', judul: 'Lomba Kebersihan Sekolah', tingkat: 'Kecamatan', peringkat: 'Juara 1',
      oleh: 'Seluruh warga sekolah', bidang: 'Lingkungan',
      cerita: 'Contoh catatan prestasi. Ganti dengan prestasi sekolah Anda dari menu Konten → Prestasi.',
      foto_url: '',
      meta: [{ label: 'Penyelenggara', value: 'UPTD Kecamatan' }, { label: 'Lokasi', value: 'Kecamatan' }],
    },
    {
      tahun: '2026', judul: 'Olimpiade Sains tingkat Kabupaten', tingkat: 'Kabupaten', peringkat: 'Juara 2',
      oleh: 'Nama Murid, kelas V', bidang: 'Akademik',
      cerita: 'Contoh catatan prestasi. Ganti dengan prestasi sekolah Anda.',
      foto_url: '',
      meta: [{ label: 'Penyelenggara', value: 'Dinas Pendidikan' }, { label: 'Lokasi', value: 'Kabupaten' }],
    },
    {
      tahun: '2025', judul: 'Festival Seni Tari', tingkat: 'Kabupaten', peringkat: 'Juara 1',
      oleh: 'Sanggar tari sekolah', bidang: 'Seni',
      cerita: 'Contoh catatan prestasi. Ganti dengan prestasi sekolah Anda.',
      foto_url: '',
      meta: [{ label: 'Penyelenggara', value: 'Disdikbud' }, { label: 'Lokasi', value: 'Kabupaten' }],
    },
    {
      tahun: '2025', judul: 'O2SN cabang atletik', tingkat: 'Provinsi', peringkat: 'Juara 3',
      oleh: 'Nama Murid, kelas VI', bidang: 'Olahraga',
      cerita: 'Contoh catatan prestasi. Ganti dengan prestasi sekolah Anda.',
      foto_url: '',
      meta: [{ label: 'Penyelenggara', value: 'Dinas Pendidikan' }, { label: 'Lokasi', value: 'Provinsi' }],
    },
    {
      tahun: '2024', judul: 'Lomba Cerdas Cermat', tingkat: 'Kecamatan', peringkat: 'Juara 1',
      oleh: 'Tim sekolah', bidang: 'Akademik',
      cerita: 'Contoh catatan prestasi. Ganti dengan prestasi sekolah Anda.',
      foto_url: '',
      meta: [{ label: 'Penyelenggara', value: 'UPTD Kecamatan' }, { label: 'Lokasi', value: 'Kecamatan' }],
    },
    {
      tahun: '2023', judul: 'Akreditasi Sekolah', tingkat: 'Nasional', peringkat: 'Nilai A',
      oleh: 'Seluruh warga sekolah', bidang: 'Akademik',
      cerita: 'Contoh catatan prestasi. Ganti dengan hasil akreditasi sekolah Anda.',
      foto_url: '',
      meta: [{ label: 'Penyelenggara', value: 'BAN-S/M' }, { label: 'Aspek dinilai', value: '8 standar' }],
    },
  ]),
});

const teks = (value) => String(value ?? '').trim();

const angkaTakNegatif = (nilai) => {
  const n = Number(String(nilai ?? '').trim());
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
};

const salinBawaanRecords = () => JSON.parse(JSON.stringify(DEFAULT_PRESTASI_CONTENT.records));

const normalizeRecords = (rows) => {
  if (!Array.isArray(rows)) return salinBawaanRecords();
  const hasil = rows.map((row) => {
    const judul = teks(row?.judul);
    if (!judul) return null;
    const meta = Array.isArray(row?.meta)
      ? row.meta
          .map((m) => ({ label: teks(m?.label), value: teks(m?.value) }))
          .filter((m) => m.label || m.value)
      : [];
    return {
      tahun: teks(row?.tahun) || '—',
      judul,
      tingkat: TINGKAT_OPTIONS.includes(teks(row?.tingkat)) ? teks(row.tingkat) : 'Kecamatan',
      peringkat: teks(row?.peringkat) || 'Juara',
      oleh: teks(row?.oleh),
      bidang: BIDANG_OPTIONS.includes(teks(row?.bidang)) ? teks(row.bidang) : 'Akademik',
      cerita: teks(row?.cerita),
      // URL aset disimpan bersama catatan yang sama agar halaman Prestasi dan
      // Profil selalu memakai foto yang identik. Terima beberapa nama lama
      // supaya konten yang sudah pernah disimpan tetap kompatibel.
      foto_url: teks(row?.foto_url || row?.fotoUrl || row?.image_url || row?.photo_url),
      meta,
    };
  }).filter(Boolean);
  // Daftar kosong dibiarkan kosong (arti: sekolah belum mengisi), BUKAN
  // dipulihkan ke bawaan — halaman menampilkan keadaan kosong yang wajar.
  return hasil;
};

export const normalizePrestasiContent = (stored) => {
  const source = stored && typeof stored === 'object' ? stored : {};
  // `undefined` berarti kunci belum pernah disimpan (pemasangan baru) → pakai
  // bawaan. Objek tersimpan yang records-nya sengaja dikosongkan tetap kosong.
  const records = source.records === undefined ? salinBawaanRecords() : normalizeRecords(source.records);
  const stats = source.stats && typeof source.stats === 'object' ? source.stats : {};
  return {
    stats: {
      muridTerlibat: angkaTakNegatif(stats.muridTerlibat),
      tahunBerturut: angkaTakNegatif(stats.tahunBerturut),
    },
    records,
  };
};

export const fetchPrestasiContent = async () => {
  const map = await fetchWebsiteContentMap({ keys: [PRESTASI_CONTENT_KEY] });
  return normalizePrestasiContent(map?.[PRESTASI_CONTENT_KEY]);
};

export const savePrestasiContent = async (content) => {
  const normalized = normalizePrestasiContent(content);
  await saveWebsiteContentItem({ key: PRESTASI_CONTENT_KEY, content: normalized, isPublic: true });
  announceWebsiteContentUpdate([PRESTASI_CONTENT_KEY]);
  return normalized;
};
