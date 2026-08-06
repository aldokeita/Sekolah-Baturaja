import apiClient from '@/lib/apiClient';

// Backend menyimpan `hari` sebagai SMALLINT 1..6 (Senin..Sabtu). Minggu tidak
// dipakai, jadi daftar ini sekaligus menjadi sumber tunggal urutan kolom grid
// mingguan dan label bahasa Indonesia yang ditampilkan ke pengguna.
export const HARI_OPTIONS = [
    { value: 1, label: 'Senin', short: 'Sen' },
    { value: 2, label: 'Selasa', short: 'Sel' },
    { value: 3, label: 'Rabu', short: 'Rab' },
    { value: 4, label: 'Kamis', short: 'Kam' },
    { value: 5, label: 'Jumat', short: 'Jum' },
    { value: 6, label: 'Sabtu', short: 'Sab' },
];

export const SEMESTER_OPTIONS = ['Ganjil', 'Genap'];

export const TAHUN_AJARAN_PATTERN = /^\d{4}\/\d{4}$/;

export const getHariLabel = (hari) => (
    HARI_OPTIONS.find((item) => item.value === Number(hari))?.label || '-'
);

export const isValidTahunAjaran = (value) => TAHUN_AJARAN_PATTERN.test(String(value || '').trim());

// Kolom `time` Postgres bisa kembali sebagai "07:30:00" atau "07:30". UI dan
// <input type="time"> sama-sama hanya butuh HH:MM.
export const formatJam = (value) => String(value || '').trim().slice(0, 5);

export const formatJamRange = (jamMulai, jamSelesai) => (
    `${formatJam(jamMulai)}–${formatJam(jamSelesai)}`
);

export const isJamRangeValid = (jamMulai, jamSelesai) => {
    const mulai = formatJam(jamMulai);
    const selesai = formatJam(jamSelesai);
    if (!mulai || !selesai) return false;
    return selesai > mulai;
};

export const getPeriodeLabel = (periode) => {
    if (!periode) return '';
    const nama = String(periode.nama || '').trim();
    if (nama) return nama;
    return `${periode.tahun_ajaran || ''} ${periode.semester || ''}`.trim();
};

// Grid mingguan selalu menampilkan enam kolom, termasuk hari yang kosong, maka
// setiap hari selalu punya entri array meski tidak ada jadwal.
export const groupJadwalByHari = (rows = []) => {
    const grouped = Object.fromEntries(HARI_OPTIONS.map((day) => [day.value, []]));
    (rows || []).forEach((row) => {
        const hari = Number(row?.hari);
        if (grouped[hari]) grouped[hari].push(row);
    });
    Object.values(grouped).forEach((list) => {
        list.sort((a, b) => formatJam(a.jam_mulai).localeCompare(formatJam(b.jam_mulai)));
    });
    return grouped;
};

// Backend sudah menulis pesan kegagalan dalam bahasa Indonesia siap-tampil dan
// apiClient melempar Error dengan pesan itu apa adanya, jadi helper ini
// meneruskannya tanpa menerjemahkan ulang. Hanya kegagalan yang tidak berasal
// dari backend (jaringan putus) yang diberi kalimat sendiri.
export const getScheduleErrorMessage = (error) => {
    const message = String(error?.error || error?.message || error || '').trim();
    if (!message) return 'Operasi jadwal pelajaran gagal.';
    if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
        return 'Tidak dapat terhubung ke server. Periksa koneksi Anda lalu coba lagi.';
    }
    return message;
};

// --- Periode ajaran ---

export const fetchPeriodeList = async () => {
    const data = await apiClient.get('/api/schedule/periode');
    return data || [];
};

export const createPeriode = async ({ nama, tahunAjaran, semester, tanggalMulai, tanggalSelesai, isActive }) => {
    return apiClient.post('/api/schedule/periode', {
        nama: String(nama || '').trim(),
        tahun_ajaran: String(tahunAjaran || '').trim(),
        semester,
        tanggal_mulai: tanggalMulai || null,
        tanggal_selesai: tanggalSelesai || null,
        is_active: Boolean(isActive),
    });
};

export const updatePeriode = async (id, updates) => {
    return apiClient.put(`/api/schedule/periode/${id}`, updates);
};

export const activatePeriode = async (id) => {
    return apiClient.put(`/api/schedule/periode/${id}`, { is_active: true });
};

export const deletePeriode = async (id) => {
    await apiClient.delete(`/api/schedule/periode/${id}`);
};

// --- Mata pelajaran ---

export const fetchMataPelajaranList = async ({ activeOnly = true } = {}) => {
    const params = new URLSearchParams();
    if (activeOnly) params.set('is_active', 'true');
    const qs = params.toString() ? `?${params.toString()}` : '';
    const data = await apiClient.get(`/api/schedule/mapel${qs}`);
    return data || [];
};

export const createMataPelajaran = async ({ nama, kode, urutan, isActive = true }) => {
    return apiClient.post('/api/schedule/mapel', {
        nama: String(nama || '').trim(),
        kode: String(kode || '').trim() || null,
        urutan: Number.isFinite(Number(urutan)) ? Number(urutan) : null,
        is_active: Boolean(isActive),
    });
};

export const updateMataPelajaran = async (id, updates) => {
    return apiClient.put(`/api/schedule/mapel/${id}`, updates);
};

// DELETE pada mapel adalah soft delete di backend: baris tetap ada dengan
// is_active=false supaya jadwal lama tidak kehilangan referensinya.
export const deleteMataPelajaran = async (id) => {
    await apiClient.delete(`/api/schedule/mapel/${id}`);
};

// --- Jadwal ---

// Baris jadwal membawa kolom hasil join yang read-only: mata_pelajaran_nama,
// mata_pelajaran_kode, nama_kelas, dan guru_nama. Jangan kirim balik kolom itu
// saat update.
export const fetchJadwalList = async ({ periodeId, classId, guruId } = {}) => {
    const params = new URLSearchParams();
    if (periodeId) params.set('periode_id', periodeId);
    if (classId) params.set('class_id', classId);
    if (guruId) params.set('guru_id', guruId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const data = await apiClient.get(`/api/schedule/jadwal${qs}`);
    return data || [];
};

export const createJadwal = async ({ periodeId, classId, mataPelajaranId, guruId, hari, jamMulai, jamSelesai, ruang, catatan }) => {
    return apiClient.post('/api/schedule/jadwal', {
        periode_id: periodeId,
        class_id: classId,
        mata_pelajaran_id: mataPelajaranId,
        guru_id: guruId || null,
        hari: Number(hari),
        jam_mulai: formatJam(jamMulai),
        jam_selesai: formatJam(jamSelesai),
        ruang: String(ruang || '').trim() || null,
        catatan: String(catatan || '').trim() || null,
    });
};

export const updateJadwal = async (id, updates) => {
    return apiClient.put(`/api/schedule/jadwal/${id}`, {
        ...updates,
        ...(updates.hari !== undefined && { hari: Number(updates.hari) }),
        ...(updates.jam_mulai !== undefined && { jam_mulai: formatJam(updates.jam_mulai) }),
        ...(updates.jam_selesai !== undefined && { jam_selesai: formatJam(updates.jam_selesai) }),
    });
};

export const deleteJadwal = async (id) => {
    await apiClient.delete(`/api/schedule/jadwal/${id}`);
};
