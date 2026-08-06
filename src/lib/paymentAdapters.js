import apiClient from '@/lib/apiClient';
import { fetchSantriPage } from '@/lib/dataMasterAdapters';

export const MONTH_NAMES = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
];

export const PAYMENT_DETAIL_SELECT = `
    id,
    santri_id,
    bulan,
    tahun,
    jumlah,
    tanggal_pembayaran,
    metode_pembayaran,
    status,
    catatan,
    transaction_id,
    created_at,
    santri:santri_id(id, nama_lengkap, nomor_induk_qiroati, kategori, no_hp_ortu)
`;

export const PAYMENT_HISTORY_SELECT = `
    id,
    santri_id,
    bulan,
    tahun,
    jumlah,
    tanggal_pembayaran,
    metode_pembayaran,
    status,
    catatan,
    transaction_id,
    created_at
`;

export const monthNameToNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return value >= 1 && value <= 12 ? value : null;
    const numeric = Number(value);
    if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) return numeric;
    const index = MONTH_NAMES.findIndex(month => month.toLowerCase() === String(value).toLowerCase());
    return index >= 0 ? index + 1 : null;
};

export const monthNumberToName = (value) => {
    const monthNumber = monthNameToNumber(value);
    return monthNumber ? MONTH_NAMES[monthNumber - 1] : '-';
};

export const selectedMonthToNumber = (value) => {
    if (value === 'all') return 'all';
    const numeric = Number(value);
    if (!Number.isInteger(numeric)) return null;
    return numeric >= 0 && numeric <= 11 ? numeric + 1 : numeric;
};

export const formatPaymentPeriod = (bulan, tahun) => {
    if (!bulan && !tahun) return '-';
    return `${bulan ? monthNumberToName(bulan) : '-'} ${tahun || ''}`.trim();
};

export const formatSantriCategory = (value) => {
    const category = String(value || '').trim();
    if (!category) return 'TPQ';
    if (category.toUpperCase() === 'PTPT') return 'PTPT';
    if (category.toLowerCase() === 'dewasa') return 'Dewasa';
    if (category.toLowerCase() === 'anak' || category.toUpperCase() === 'TPQ') return 'TPQ';
    return category;
};

export const validatePaymentAmount = (amount) => Number.isFinite(Number(amount)) && Number(amount) >= 0;

export const getSharedDefaultSppAmount = (santriList = []) => {
    if (!Array.isArray(santriList) || santriList.length === 0) return null;
    const amounts = santriList.map((santri) => Number(santri?.default_spp_amount));
    if (amounts.some((amount) => !Number.isFinite(amount) || amount < 10000)) return null;
    return amounts.every((amount) => amount === amounts[0]) ? amounts[0] : null;
};

export const getPaymentErrorMessage = (error) => {
    const message = String(error?.message || '');
    if (message.includes('payments_active_santri_bulan_tahun_unique')) {
        return 'Pembayaran murid untuk bulan dan tahun tersebut sudah tercatat.';
    }
    if (error?.code === '23505' || message.includes('payments_transaction_id_unique')) {
        return 'Pembayaran duplikat terdeteksi. Silakan ulangi proses pembayaran.';
    }
    if (message.toLowerCase().includes('row-level security') || error?.code === '42501') {
        return 'Anda tidak memiliki akses untuk melakukan aksi pembayaran ini.';
    }
    if (message.includes('payments_status_check')) {
        return 'Status pembayaran tidak valid.';
    }
    if (message.includes('jumlah')) {
        return 'Nominal pembayaran tidak valid.';
    }
    return message || 'Operasi pembayaran gagal.';
};

// --- Query functions ---

const buildPaymentParams = (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.santri_id) params.set('santri_id', filters.santri_id);
    if (filters.status) params.set('status', filters.status);
    if (filters.bulan) params.set('bulan', String(filters.bulan));
    if (filters.tahun) params.set('tahun', String(filters.tahun));
    if (filters.transaction_id) params.set('transaction_id', filters.transaction_id);
    if (filters.search) params.set('search', filters.search);
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));
    return params.toString() ? `?${params.toString()}` : '';
};

export const fetchPayments = async (filters = {}) => {
    const data = await apiClient.get(`/api/payments${buildPaymentParams(filters)}`);
    return data || [];
};

// Same filters as fetchPayments, but also returns the unpaginated total for
// server-side pagination (read from the X-Total-Count header).
export const fetchPaymentsPage = async (filters = {}) => {
    const { data, total } = await apiClient.get(
        `/api/payments${buildPaymentParams(filters)}`,
        { withMeta: true }
    );
    return { data: data || [], total };
};

// The list endpoint caps limit at 200, so walk pages until exhausted. Used by
// the backup export and by screens that aggregate the full history client-side.
export const fetchAllPayments = async (filters = {}) => {
    const PAGE_LIMIT = 200;
    const all = [];
    for (let page = 1; ; page += 1) {
        const batch = await fetchPayments({ ...filters, page, limit: PAGE_LIMIT });
        all.push(...batch);
        if (batch.length < PAGE_LIMIT) break;
    }
    return all;
};

// The santri list endpoint caps limit at 200, so the finance screens that
// aggregate every santri client-side must walk pages or they silently truncate
// at 200. Note santri pages are 0-based (payments pages are 1-based).
export const fetchAllSantri = async (filters = {}) => {
    const PAGE_LIMIT = 200;
    const all = [];
    for (let page = 0; ; page += 1) {
        const { data, total } = await fetchSantriPage({ ...filters, page, limit: PAGE_LIMIT });
        all.push(...data);
        if (data.length < PAGE_LIMIT || all.length >= total) break;
    }
    return all;
};

export const fetchPaymentDetail = async (id) => {
    return apiClient.get(`/api/payments/${id}`);
};

export const updatePayment = async (id, payload) => {
    return apiClient.put(`/api/payments/${id}`, payload);
};

// Returns [{ santri_id, status: 'Lunas' | 'Belum Lunas' }] for one period.
export const fetchPaymentStatusSummary = async (bulan, tahun) => {
    const params = new URLSearchParams();
    if (bulan) params.set('bulan', String(bulan));
    if (tahun) params.set('tahun', String(tahun));
    const data = await apiClient.get(`/api/payments/status-summary?${params.toString()}`);
    return data || [];
};

// True when any active paid payment already covers one of the given periods.
export const checkPaymentDuplicates = async ({ santriIds = [], months = [], year }) => {
    if (santriIds.length === 0 || months.length === 0 || !year) return false;
    const results = await Promise.all(
        santriIds.map((santriId) => fetchPayments({
            santri_id: santriId,
            tahun: year,
            status: 'paid',
            limit: 200,
        }))
    );
    const wanted = new Set(months.map(Number));
    return results.flat().some((payment) => wanted.has(Number(payment.bulan)));
};

export const createPayment = async (payload) => {
    return apiClient.post('/api/payments', payload);
};

export const createPaymentsBatch = async (payloads) => {
    const data = await apiClient.post('/api/payments/batch', payloads);
    return data || [];
};

export const deletePayment = async (id) => {
    await apiClient.delete(`/api/payments/${id}`);
};

export const deletePaymentsBulk = async (ids) => {
    await apiClient.post('/api/payments/bulk-delete', { ids });
};

// Expenses are mounted under the payments router, not at /api/expenses.
const EXPENSES_PATH = '/api/payments/expenses';

export const fetchPaymentRecap = async (year, month) => {
    const params = new URLSearchParams();
    if (year) params.set('year', String(year));
    if (month) params.set('month', String(month));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get(`/api/payments/recap${qs}`);
};

export const fetchExpenses = async (dateFrom, dateTo) => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const data = await apiClient.get(`${EXPENSES_PATH}${qs}`);
    return data || [];
};

export const createExpense = async (payload) => {
    return apiClient.post(EXPENSES_PATH, payload);
};

export const deleteExpense = async (id) => {
    await apiClient.delete(`${EXPENSES_PATH}/${id}`);
};
