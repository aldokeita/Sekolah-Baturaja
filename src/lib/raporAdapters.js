import apiClient from '@/lib/apiClient';
import { APP_CONFIG_KEYS, fetchAppConfigs } from '@/lib/appConfigAdapters';
import { fetchAttendanceRecap } from '@/lib/attendanceAdapters';
import {
  fetchClassList,
  fetchGuruList,
  fetchSantriDetail,
  fetchSantriList,
} from '@/lib/dataMasterAdapters';
import { fetchNilaiSummary } from '@/lib/nilaiAdapters';
import { fetchPeriodeList } from '@/lib/scheduleAdapters';

/**
 * Menyusun bahan rapor untuk SATU murid pada SATU periode.
 *
 * Tidak ada endpoint rapor di backend, dan sengaja tidak dibuat: seluruh angkanya
 * sudah tersedia dari sumber yang menjadi acuan masing-masing — `nilai/summary`
 * untuk nilai per mata pelajaran, `attendance/recap` untuk ketidakhadiran. Menyalin
 * hitungannya ke tabel rapor tersendiri berarti dua angka yang bisa berselisih, dan
 * yang tercetak di rapor adalah yang paling tidak boleh salah.
 *
 * Hak akses tetap milik backend. `attendance/recap` membatasi guru pada murid yang
 * diajarnya, dan `nilai/summary` menyaring lewat `jadwal_pelajaran`, jadi guru yang
 * membuka rapor murid di luar kelasnya akan menerima data kosong atau 403 — bukan
 * data orang lain.
 */

/* Predikat nilai. Rentang di bawah adalah kebiasaan yang paling umum dipakai SD di
 * Indonesia, TETAPI setiap sekolah menetapkan KKM-nya sendiri — jadi ini bawaan,
 * bukan aturan. Sekolah menggantinya di Konfigurasi → Predikat Rapor, tersimpan
 * pada kunci app-config `rapor_predikat`. */
export const PREDIKAT_BAWAAN = Object.freeze([
  { min: 90, huruf: 'A', label: 'Sangat Baik' },
  { min: 80, huruf: 'B', label: 'Baik' },
  { min: 70, huruf: 'C', label: 'Cukup' },
  { min: 0, huruf: 'D', label: 'Perlu Bimbingan' },
]);

/**
 * Merapikan daftar predikat tersimpan.
 *
 * Diurutkan MENURUN menurut `min`, dan itu bukan kosmetik: `predikatDari` memakai
 * `find` pertama yang ambangnya terlampaui, jadi daftar yang tersimpan menaik akan
 * memberi predikat terendah kepada setiap nilai. Ambang terkecil dipaksa 0 supaya
 * tidak ada skor yang jatuh tanpa predikat.
 */
export const normalisasiPredikat = (stored) => {
  const rows = Array.isArray(stored) ? stored : [];
  const bersih = rows
    .map((row) => {
      const huruf = String(row?.huruf ?? '').trim();
      const label = String(row?.label ?? '').trim();
      const min = Number(row?.min);
      if (!huruf || !Number.isFinite(min)) return null;
      return { min: Math.min(100, Math.max(0, Math.round(min))), huruf, label: label || huruf };
    })
    .filter(Boolean)
    .sort((a, b) => b.min - a.min);

  if (bersih.length === 0) return PREDIKAT_BAWAAN.map((p) => ({ ...p }));
  bersih[bersih.length - 1] = { ...bersih[bersih.length - 1], min: 0 };
  return bersih;
};

export const buatPredikatDari = (daftar) => {
  const skala = normalisasiPredikat(daftar);
  return (skor) => {
    const angka = Number(skor);
    if (!Number.isFinite(angka)) return { huruf: '-', label: 'Belum dinilai' };
    return skala.find((p) => angka >= p.min) || skala[skala.length - 1];
  };
};

/** Pemakai yang tidak punya konfigurasi sekolah tetap mendapat skala bawaan. */
export const predikatDari = buatPredikatDari(PREDIKAT_BAWAAN);

/* Status kehadiran yang dicetak di rapor.
 *
 * Rapor ini dulu mencetak tiga baris — Sakit, Izin, dan Tanpa Keterangan — meniru
 * rapor Indonesia pada umumnya. Masalahnya, TIDAK ADA satu layar pun di aplikasi
 * ini yang bisa menyimpan status Sakit atau Izin: status absensi hanya lahir dari
 * pemindai RFID (Hadir/Terlambat) dan dari tombol admin "tandai tidak hadir".
 * Jadi dua baris pertama selalu tercetak 0 hari, dan murid yang benar-benar sakit
 * tercetak pada baris Tanpa Keterangan — tuduhan bolos di dokumen resmi.
 *
 * Atas keputusan pemilik, keduanya dicabut dan rapor menyisakan SATU baris:
 * jumlah hari murid tidak hadir. Angka itu nyata karena berasal dari catatan
 * pemindai. Kalau kelak ada layar untuk mengisi sakit dan izin, pemisahannya bisa
 * dikembalikan — lihat docs/HANDOFF.md.
 *
 * Status yang tersimpan tetap dipetakan longgar supaya data lama (termasuk baris
 * 'Sakit' atau 'Izin' yang mungkin pernah masuk lewat impor) tetap terhitung
 * sebagai tidak hadir, bukan hilang begitu saja. */
const STATUS_TIDAK_HADIR = Object.freeze([
  'tidak hadir', 'alpha', 'alpa', 'ghaib', 'absen', 'sakit', 'izin', 'dispensasi',
]);

export const ringkasKehadiran = (summary = {}) => {
  const hasil = { hadir: 0, tidakHadir: 0 };
  Object.entries(summary).forEach(([status, jumlah]) => {
    const kunci = String(status || '').trim().toLowerCase();
    const n = Number(jumlah) || 0;
    if (STATUS_TIDAK_HADIR.includes(kunci)) hasil.tidakHadir += n;
    else hasil.hadir += n;
  });
  return hasil;
};

/**
 * Rentang tanggal satu periode ajaran.
 *
 * `periode_ajaran.tanggal_mulai` dan `tanggal_selesai` boleh kosong — pada
 * pemasangan baru keduanya memang NULL. Tanpa cadangan, blok ketidakhadiran pada
 * rapor akan selalu kosong pada sekolah yang belum mengisinya, jadi rentangnya
 * diturunkan dari tahun ajaran dan semesternya: Ganjil = Juli–Desember tahun
 * pertama, Genap = Januari–Juni tahun kedua. Itu kalender sekolah Indonesia yang
 * baku, bukan tebakan.
 */
export const rentangPeriode = (periode) => {
  const mulai = String(periode?.tanggal_mulai || '').slice(0, 10);
  const selesai = String(periode?.tanggal_selesai || '').slice(0, 10);
  if (mulai && selesai) return { dari: mulai, sampai: selesai, diturunkan: false };

  const tahunAjaran = String(periode?.tahun_ajaran || '').trim();
  const cocok = tahunAjaran.match(/(\d{4})\s*\/\s*(\d{4})/);
  if (!cocok) return { dari: '', sampai: '', diturunkan: false };

  const [, awal, akhir] = cocok;
  const ganjil = !/genap/i.test(String(periode?.semester || ''));
  return ganjil
    ? { dari: `${awal}-07-01`, sampai: `${awal}-12-31`, diturunkan: true }
    : { dari: `${akhir}-01-01`, sampai: `${akhir}-06-30`, diturunkan: true };
};

/**
 * Fase kurikulum dari nama kelas.
 *
 * Format rapor rujukan BSKAP (hlm. 62) memuat field Fase di kepala rapor. Fase
 * ditentukan tingkat kelas, bukan jenjang sekolah: A untuk kelas 1–2, B untuk 3–4,
 * C untuk 5–6, D untuk 7–9, E untuk 10, F untuk 11–12. Template ini bawaannya SD
 * tetapi bisa dipakai SMP/SMA, jadi pemetaannya dibuat lengkap.
 *
 * Angka diambil dari nama kelas ("Kelas 4A" → 4). Nama yang tidak memuat angka
 * mengembalikan null, dan pemanggilnya MENYEMBUNYIKAN barisnya — menebak fase
 * lebih buruk daripada tidak menampilkannya.
 */
export const faseDariKelas = (namaKelas) => {
  const cocok = String(namaKelas || '').match(/\d+/);
  if (!cocok) return null;
  const tingkat = Number(cocok[0]);
  if (tingkat >= 1 && tingkat <= 2) return 'A';
  if (tingkat >= 3 && tingkat <= 4) return 'B';
  if (tingkat >= 5 && tingkat <= 6) return 'C';
  if (tingkat >= 7 && tingkat <= 9) return 'D';
  if (tingkat === 10) return 'E';
  if (tingkat >= 11 && tingkat <= 12) return 'F';
  return null;
};

export const getRaporErrorMessage = (error) => {
  const message = String(error?.error || error?.message || error || '').trim();
  if (!message) return 'Rapor gagal disusun.';
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.';
  }
  return message;
};

/* Kepala sekolah yang menandatangani dokumen sekolah — rapor maupun kartu
 * pelajar. Namanya diambil dari Data Guru, bukan ditulis di komponen cetak,
 * supaya dokumen pembeli tidak ditandatangani atas nama sekolah contoh.
 *
 * Dua jalur pengenalan, karena sekolah mengisinya dengan dua cara: lewat peran
 * "Kepala Sekolah" pada akunnya, atau lewat kolom jabatan. Jabatan yang memuat
 * "wakil" sengaja ditolak — yang menandatangani kepala sekolahnya sendiri.
 *
 * Dipakai bersama oleh fetchKonteksRapor dan KartuPelajarCetak, jadi aturannya
 * tinggal di satu tempat. */
export const cariKepalaSekolah = (daftarGuru) => (daftarGuru || []).find((g) => {
  const roles = Array.isArray(g?.roles) ? g.roles : [];
  if (roles.includes('Kepala Sekolah')) return true;
  const jabatan = String(g?.jabatan || '');
  return /kepala\s+sekolah/i.test(jabatan) && !/wakil/i.test(jabatan);
}) || null;

/**
 * Bahan rapor yang SAMA untuk setiap murid: daftar periode, daftar kelas, daftar
 * guru, dan skala predikat sekolah.
 *
 * Dipisahkan supaya cetak sekelas tidak mengambilnya berulang kali. Untuk 28 murid,
 * memanggil `fetchRapor` satu per satu berarti 28× daftar kelas dan 28× daftar guru
 * — ratusan permintaan yang seluruhnya mengembalikan jawaban yang sama.
 */
export const fetchKonteksRapor = async () => {
  const [daftarPeriode, daftarKelas, daftarGuru, konfigurasi] = await Promise.all([
    fetchPeriodeList(),
    fetchClassList({ includeGuru: true, limit: 200 }),
    // Kepala sekolah menandatangani rapor. Namanya diambil dari Data Guru, bukan
    // ditulis di komponen cetak, supaya rapor pembeli tidak menandatangani atas
    // nama sekolah contoh.
    fetchGuruList().catch(() => []),
    fetchAppConfigs([APP_CONFIG_KEYS.RAPOR_PREDIKAT]).catch(() => ({})),
  ]);

  const skalaPredikat = normalisasiPredikat(konfigurasi?.[APP_CONFIG_KEYS.RAPOR_PREDIKAT]);
  const kepalaSekolah = cariKepalaSekolah(daftarGuru);

  return {
    daftarPeriode: daftarPeriode || [],
    daftarKelas: daftarKelas || [],
    skalaPredikat,
    beriPredikat: buatPredikatDari(skalaPredikat),
    kepalaSekolah: kepalaSekolah?.nama || null,
  };
};

export const pilihPeriode = (konteks, periodeId = '') => (
  konteks.daftarPeriode.find((p) => p.id === periodeId)
  || konteks.daftarPeriode.find((p) => p.is_active)
  || konteks.daftarPeriode[0]
  || null
);

/**
 * @param {string} santriId murid yang rapornya dicetak
 * @param {string} [periodeId] biarkan kosong untuk memakai periode aktif
 */
export const fetchRapor = async (santriId, periodeId = '', konteksSiap = null) => {
  if (!santriId) throw new Error('Murid belum dipilih.');

  const konteks = konteksSiap || await fetchKonteksRapor();
  const { skalaPredikat, beriPredikat } = konteks;

  const murid = await fetchSantriDetail(santriId);
  if (!murid) throw new Error('Data murid tidak ditemukan.');

  const periode = pilihPeriode(konteks, periodeId);

  const classId = murid.current_class_id || murid.id_kelas || null;
  const kelas = classId ? konteks.daftarKelas.find((c) => c.id === classId) || null : null;

  const rentang = rentangPeriode(periode);

  // Ketidakhadiran dan nilai diambil berbarengan; keduanya berdiri sendiri dan
  // rapor tetap bisa dicetak walau salah satunya kosong.
  const [ringkasanNilai, rekapAbsensi, catatanTersimpan, deskripsiMapel] = await Promise.all([
    periode
      ? fetchNilaiSummary({ santriId, periodeId: periode.id }).catch(() => [])
      : Promise.resolve([]),
    rentang.dari
      ? fetchAttendanceRecap(santriId, rentang.dari, rentang.sampai).catch(() => null)
      : Promise.resolve(null),
    periode ? fetchCatatanRapor(santriId, periode.id).catch(() => null) : Promise.resolve(null),
    periode ? fetchDeskripsiMapel(santriId, periode.id).catch(() => ({})) : Promise.resolve({}),
  ]);

  const kehadiran = ringkasKehadiran(rekapAbsensi?.summary || {});

  const mapel = (ringkasanNilai || [])
    .map((row) => {
      const rata = Number(row.rata_rata);
      return {
        id: row.mata_pelajaran_id,
        nama: row.mata_pelajaran_nama || 'Mata pelajaran',
        jumlah: Number(row.jumlah) || 0,
        rataRata: Number.isFinite(rata) ? rata : null,
        terendah: Number(row.terendah),
        tertinggi: Number(row.tertinggi),
        predikat: beriPredikat(row.rata_rata),
        // Komponen minimal BSKAP nomor 7. Kosong berarti guru belum menulisnya;
        // lembar cetak jatuh ke label predikat supaya kolomnya tidak melompong.
        deskripsi: (deskripsiMapel || {})[row.mata_pelajaran_id] || '',
      };
    })
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));

  const nilaiAda = mapel.filter((m) => m.rataRata !== null);
  const rataKeseluruhan = nilaiAda.length > 0
    ? Math.round((nilaiAda.reduce((t, m) => t + m.rataRata, 0) / nilaiAda.length) * 100) / 100
    : null;

  return {
    murid,
    kelas,
    fase: faseDariKelas(kelas?.nama_kelas),
    periode,
    rentang,
    mapel,
    skalaPredikat,
    rataKeseluruhan,
    predikatKeseluruhan: rataKeseluruhan === null ? null : beriPredikat(rataKeseluruhan),
    kehadiran,
    waliKelas: kelas?.guru?.nama || null,
    kepalaSekolah: konteks.kepalaSekolah,
    catatan: catatanTersimpan?.catatan || '',
    kokurikuler: catatanTersimpan?.deskripsi_kokurikuler || '',
    ekstrakurikuler: catatanTersimpan?.ekstrakurikuler || '',
    catatanDiperbaruiPada: catatanTersimpan?.updated_at || null,
  };
};

/**
 * Rapor seluruh murid satu kelas, untuk dicetak sekaligus.
 *
 * Konteks bersama diambil SEKALI, lalu tiap murid hanya menambah empat permintaan
 * miliknya sendiri. Tanpa itu satu kelas berisi 28 murid akan menembak daftar
 * kelas dan daftar guru 28 kali masing-masing.
 *
 * Diambil berkelompok, bukan sekaligus: `Promise.all` atas 28 murid melepas lebih
 * dari seratus permintaan serentak dan membuat peramban mengantre sendiri, yang
 * justru memperlambat sekaligus menyulitkan membaca kegagalan.
 *
 * Murid yang gagal dimuat TIDAK menggagalkan seluruh kelas — ia dikembalikan
 * dengan `error` terisi, supaya pemanggilnya bisa mencetak sisanya dan menyebut
 * mana yang bermasalah.
 *
 * @param {string} classId
 * @param {string} [periodeId]
 * @param {(sudah:number, total:number) => void} [onProgress]
 */
export const fetchRaporKelas = async (classId, periodeId = '', onProgress) => {
  if (!classId) throw new Error('Kelas belum dipilih.');

  const konteks = await fetchKonteksRapor();
  const daftarMurid = await fetchSantriList({
    classId,
    activeOnly: true,
    notDeleted: true,
    order: 'nama_lengkap',
    limit: 200,
  });

  const murid = (daftarMurid || []).filter((s) => s?.id);
  const hasil = [];
  const UKURAN_KELOMPOK = 5;

  for (let i = 0; i < murid.length; i += UKURAN_KELOMPOK) {
    const kelompok = murid.slice(i, i + UKURAN_KELOMPOK);
    const rapor = await Promise.all(kelompok.map((s) => (
      fetchRapor(s.id, periodeId, konteks).catch((err) => ({
        gagal: true,
        nama: s.nama_lengkap || 'Murid',
        error: getRaporErrorMessage(err),
      }))
    )));
    hasil.push(...rapor);
    if (onProgress) onProgress(hasil.length, murid.length);
  }

  return {
    kelas: konteks.daftarKelas.find((c) => c.id === classId) || null,
    periode: pilihPeriode(konteks, periodeId),
    daftarPeriode: konteks.daftarPeriode,
    rapor: hasil,
  };
};

/* ── Catatan wali kelas ────────────────────────────────────────────────────────
 *
 * Hanya catatannya yang disimpan; nilai dan kehadiran tetap dibaca dari sumber
 * masing-masing setiap kali rapor disusun. Backend (`rapor.go`) menjaga haknya:
 * menulis hanya boleh oleh wali kelas murid itu dan back-office — guru mata
 * pelajaran yang kebetulan mengajar di kelas yang sama tidak bisa menimpanya.
 */

export const fetchCatatanRapor = async (santriId, periodeId) => {
  if (!santriId || !periodeId) return null;
  const params = new URLSearchParams({ santri_id: santriId, periode_id: periodeId });
  return apiClient.get(`/api/rapor/catatan?${params.toString()}`);
};

export const saveCatatanRapor = async (santriId, periodeId, narasi = {}) =>
  apiClient.put('/api/rapor/catatan', {
    santri_id: santriId,
    periode_id: periodeId,
    catatan: narasi.catatan || '',
    deskripsi_kokurikuler: narasi.kokurikuler || '',
    ekstrakurikuler: narasi.ekstrakurikuler || '',
  });

export const fetchDeskripsiMapel = async (santriId, periodeId) => {
  if (!santriId || !periodeId) return {};
  const params = new URLSearchParams({ santri_id: santriId, periode_id: periodeId });
  return (await apiClient.get(`/api/rapor/deskripsi-mapel?${params.toString()}`)) || {};
};

export const saveDeskripsiMapel = async (santriId, periodeId, deskripsi = {}) =>
  apiClient.put('/api/rapor/deskripsi-mapel', {
    santri_id: santriId,
    periode_id: periodeId,
    deskripsi,
  });

export const deleteCatatanRapor = async (santriId, periodeId) => {
  const params = new URLSearchParams({ santri_id: santriId, periode_id: periodeId });
  await apiClient.delete(`/api/rapor/catatan?${params.toString()}`);
};
