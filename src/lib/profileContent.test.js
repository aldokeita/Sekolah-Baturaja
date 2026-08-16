import { describe, expect, it } from 'vitest';

import { DEFAULT_PROFILE_CONTENT, normalizeProfileContent } from '@/lib/profileContent';

/**
 * Yang dijaga di sini: pembeli tidak bisa membuat halaman Profil tampil bolong,
 * DAN baris data pokok yang sengaja dihapus tidak muncul kembali. Dua sifat itu
 * saling bertolak belakang, jadi keduanya diuji berdampingan.
 */
describe('normalizeProfileContent', () => {
  it('mengembalikan bawaan untuk masukan kosong atau bukan objek', () => {
    [null, undefined, 'teks', 42].forEach((masukan) => {
      const hasil = normalizeProfileContent(masukan);
      expect(hasil.hero).toEqual(DEFAULT_PROFILE_CONTENT.hero);
      expect(hasil.history).toEqual(DEFAULT_PROFILE_CONTENT.history);
      expect(hasil.ticker).toEqual(DEFAULT_PROFILE_CONTENT.ticker);
    });
  });

  it('menerima isi sebagian tanpa menghapus blok lain', () => {
    const hasil = normalizeProfileContent({ ticker: ['Sekolah Ramah Anak'] });
    expect(hasil.ticker).toEqual(['Sekolah Ramah Anak']);
    expect(hasil.facilities).toEqual(DEFAULT_PROFILE_CONTENT.facilities);
  });

  // Blok naratif jatuh ke bawaan bila dikosongkan: halaman publik tidak boleh
  // menampilkan bagian tanpa isi.
  it('mengembalikan blok naratif ke bawaan bila dikosongkan', () => {
    const hasil = normalizeProfileContent({ history: [], facilities: [], quote: [] });
    expect(hasil.history).toEqual(DEFAULT_PROFILE_CONTENT.history);
    expect(hasil.facilities).toEqual(DEFAULT_PROFILE_CONTENT.facilities);
    expect(hasil.quote).toEqual(DEFAULT_PROFILE_CONTENT.quote);
  });

  /* Tiker dan angka ringkasan TIDAK ikut aturan di atas. Isinya klaim tentang
   * sekolah — "Terakreditasi A", "18 rombongan belajar", "1966" — dan bawaannya
   * milik sekolah contoh. Memulihkannya saat sekolah menghapusnya berarti
   * memaksa capaian sekolah lain terbit sebagai capaiannya sendiri. */
  it('menghormati tiker dan angka ringkasan yang sengaja dikosongkan', () => {
    const hasil = normalizeProfileContent({ ticker: [], stats: [] });
    expect(hasil.ticker).toEqual([]);
    expect(hasil.stats).toEqual([]);
  });

  it('membuang baris yang tidak punya isi wajib', () => {
    const hasil = normalizeProfileContent({
      facilities: [{ name: 'Perpustakaan', desc: 'Buka setiap hari.' }, { name: '', desc: 'tanpa nama' }],
      history: [{ year: '1990', text: 'Berdiri.' }, { year: '', text: '' }],
    });
    expect(hasil.facilities).toHaveLength(1);
    expect(hasil.history).toHaveLength(1);
  });

  it('merapikan spasi tepi', () => {
    const hasil = normalizeProfileContent({ ticker: ['  Terakreditasi A  ', '   ', 'Adiwiyata'] });
    expect(hasil.ticker).toEqual(['Terakreditasi A', 'Adiwiyata']);
  });

  it('mempertahankan foto setiap kartu pembuka secara individual', () => {
    const hasil = normalizeProfileContent({
      photos: [
        { id: 'profile-opening-1', label: 'Kelas pagi', image_url: 'https://cdn.example.test/kelas.webp' },
        { id: 'profile-opening-2', label: 'Kebun sekolah' },
        { id: 'profile-opening-3', label: 'Pentas seni', imageUrl: 'https://cdn.example.test/pentas.webp' },
      ],
    });

    expect(hasil.photos).toEqual([
      { id: 'profile-opening-1', label: 'Kelas pagi', image_url: 'https://cdn.example.test/kelas.webp' },
      { id: 'profile-opening-2', label: 'Kebun sekolah', image_url: '' },
      { id: 'profile-opening-3', label: 'Pentas seni', image_url: 'https://cdn.example.test/pentas.webp' },
    ]);
  });

  it('mengisi field hero yang kosong dari bawaannya masing-masing', () => {
    // Satu field diisi, sisanya tidak: yang lain tidak boleh ikut hilang.
    const hasil = normalizeProfileContent({ hero: { kicker: 'Sejak 1978' } });
    expect(hasil.hero.kicker).toBe('Sejak 1978');
    expect(hasil.hero.titleMain).toBe(DEFAULT_PROFILE_CONTENT.hero.titleMain);
    expect(hasil.hero.badgeLabel).toBe(DEFAULT_PROFILE_CONTENT.hero.badgeLabel);
  });

  describe('data pokok sekolah', () => {
    it('memakai bawaan bila belum pernah disimpan', () => {
      expect(normalizeProfileContent({}).registry).toEqual(DEFAULT_PROFILE_CONTENT.registry);
    });

    /* Berbeda dari blok lain: daftar kosong TETAP kosong. Pembeli yang menghapus
     * seluruh barisnya tidak ingin NPSN dan luas lahan muncul kembali setiap kali
     * halaman dimuat. */
    it('menghormati daftar yang sengaja dikosongkan', () => {
      expect(normalizeProfileContent({ registry: [] }).registry).toEqual([]);
    });

    it('membuang baris tanpa label tapi menyimpan yang nilainya kosong', () => {
      const hasil = normalizeProfileContent({
        registry: [
          { label: 'NPSN', value: '10645512' },
          { label: '', value: 'tanpa label' },
          { label: 'Akreditasi', value: '' },
        ],
      });
      // Baris tanpa nilai tetap tersimpan supaya pembeli bisa mengisinya nanti;
      // ProfilePage yang menyembunyikannya dari halaman.
      expect(hasil.registry).toEqual([
        { label: 'NPSN', value: '10645512' },
        { label: 'Akreditasi', value: '' },
      ]);
    });
  });

  describe('angka ringkasan', () => {
    it('menyimpan penanda tanpa pemisah ribuan sebagai boolean', () => {
      const hasil = normalizeProfileContent({
        stats: [{ value: '1966', label: 'Tahun berdiri', plain: 'ya' }],
      });
      expect(hasil.stats[0].plain).toBe(true);
      expect(normalizeProfileContent({ stats: [{ value: '18', label: 'Rombel' }] }).stats[0].plain).toBe(false);
    });

    it('membuang angka tanpa keterangan', () => {
      const hasil = normalizeProfileContent({
        stats: [{ value: '99', label: '' }, { value: '6', label: 'Rombongan belajar' }],
      });
      expect(hasil.stats).toEqual([{ value: '6', label: 'Rombongan belajar', suffix: '', plain: false }]);
    });

    // Kunci yang belum pernah disimpan berbeda dari daftar yang dikosongkan.
    it('memakai bawaan bila kuncinya belum pernah disimpan', () => {
      expect(normalizeProfileContent({}).stats).toEqual(DEFAULT_PROFILE_CONTENT.stats);
      expect(normalizeProfileContent({}).ticker).toEqual(DEFAULT_PROFILE_CONTENT.ticker);
    });
  });

  it('menjaga kalimat besar kutipan tetap ada', () => {
    expect(normalizeProfileContent({ quoteLead: '   ' }).quoteLead).toBe(DEFAULT_PROFILE_CONTENT.quoteLead);
    expect(normalizeProfileContent({ quoteLead: 'Kalimat *khas* kami.' }).quoteLead).toBe('Kalimat *khas* kami.');
  });

  it('menyimpan avatar kutipan dari aset website dan menerima nama field lama', () => {
    expect(normalizeProfileContent({ quoteAvatarUrl: ' https://cdn.example.test/kepala.webp ' }).quoteAvatarUrl)
      .toBe('https://cdn.example.test/kepala.webp');
    expect(normalizeProfileContent({ quote_avatar_url: 'https://cdn.example.test/lama.webp' }).quoteAvatarUrl)
      .toBe('https://cdn.example.test/lama.webp');
  });
});
