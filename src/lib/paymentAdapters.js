import apiClient from '@/lib/apiClient';
import { fetchSantriPage } from '@/lib/dataMasterAdapters';
import { notifyFinanceDataChanged } from '@/lib/financeAdapters';

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

// Nominal item pembayaran non-SPP disimpan dengan kunci stabil agar perubahan
// label tampilan tidak membuat nominal item lain ikut tertukar. SPP sengaja
// tidak masuk daftar ini karena nominalnya mengikuti mekanisme SPP bulanan.
export const PAYMENT_ITEM_SETTING_KEYS = Object.freeze([
    'sarpras',
    'seragam',
    'tas_murid',
    'id_card_murid',
    'buku_paket',
    'lks',
]);

// Keep configurable item nominal within the same range as payments.jumlah
// (numeric(12,2)), so a saved value remains insertable during checkout.
export const PAYMENT_ITEM_AMOUNT_MAX = 9999999999.99;

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
    santri:santri_id(id, nama_lengkap, nomor_induk, kategori, no_hp_ortu)
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

/* formatSantriCategory DICABUT. Fungsinya memetakan kategori murid ke label
   "TPQ" / "PTPT" / "Dewasa" — pembagian murid ala lembaga Al-Qur'an. Pada SD
   negeri hanya ada satu jenis murid, sehingga label itu bukan sekadar tidak
   berguna: kategori 'Anak' dipetakan menjadi "TPQ", jadi layar pembayaran
   menampilkan istilah lembaga Al-Qur'an kepada pembeli. Badge pemakainya di
   PaymentSystem ikut dicabut. */

export const validatePaymentAmount = (amount) => Number.isFinite(Number(amount)) && Number(amount) >= 0;

export const parsePaymentItemAmount = (value) => {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0 || amount > PAYMENT_ITEM_AMOUNT_MAX) return null;
    return Math.round(amount * 100) / 100;
};

export const validatePaymentItemAmount = (amount) => parsePaymentItemAmount(amount) !== null;

export const normalizePaymentItemSettings = (payload) => {
    const rows = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
            ? payload.data
            : [];

    return rows.reduce((settings, row) => {
        const itemKey = String(row?.item_key || row?.key || '').trim();
        if (!PAYMENT_ITEM_SETTING_KEYS.includes(itemKey)) return settings;
        const amount = parsePaymentItemAmount(row?.amount);
        if (amount !== null) settings[itemKey] = amount;
        return settings;
    }, {});
};

export const fetchPaymentItemSettings = async () => {
    const data = await apiClient.get('/api/payments/item-settings');
    return normalizePaymentItemSettings(data);
};

export const savePaymentItemSetting = async (itemKey, amount) => {
    const normalizedKey = String(itemKey || '').trim();
    if (!PAYMENT_ITEM_SETTING_KEYS.includes(normalizedKey)) {
        throw new Error('Item pembayaran tidak dapat dikonfigurasi.');
    }
    const normalizedAmount = parsePaymentItemAmount(amount);
    if (normalizedAmount === null) {
        throw new Error('Nominal item harus lebih besar dari nol.');
    }
    const data = await apiClient.put(
        `/api/payments/item-settings/${encodeURIComponent(normalizedKey)}`,
        { amount: normalizedAmount },
    );
    const savedAmount = parsePaymentItemAmount(data?.amount) ?? normalizedAmount;
    return { item_key: normalizedKey, amount: savedAmount };
};

export const deletePaymentItemSetting = async (itemKey) => {
    const normalizedKey = String(itemKey || '').trim();
    if (!PAYMENT_ITEM_SETTING_KEYS.includes(normalizedKey)) {
        throw new Error('Item pembayaran tidak dapat dikonfigurasi.');
    }
    await apiClient.delete(`/api/payments/item-settings/${encodeURIComponent(normalizedKey)}`);
};

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
    const data = await apiClient.put(`/api/payments/${id}`, payload);
    notifyFinanceDataChanged({ type: 'payment', action: 'updated', id });
    return data;
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
    const data = await apiClient.post('/api/payments', payload);
    notifyFinanceDataChanged({ type: 'payment', action: 'created' });
    return data;
};

export const createPaymentsBatch = async (payloads) => {
    const data = await apiClient.post('/api/payments/batch', payloads);
    notifyFinanceDataChanged({ type: 'payment', action: 'created' });
    return data || [];
};

export const deletePayment = async (id) => {
    await apiClient.delete(`/api/payments/${id}`);
    notifyFinanceDataChanged({ type: 'payment', action: 'deleted', id });
};

export const deletePaymentsBulk = async (ids) => {
    await apiClient.post('/api/payments/bulk-delete', { ids });
    notifyFinanceDataChanged({ type: 'payment', action: 'deleted', ids });
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

export const deleteExpense = async (id) => {
    await apiClient.delete(`${EXPENSES_PATH}/${id}`);
};
