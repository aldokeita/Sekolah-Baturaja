import apiClient from '@/lib/apiClient';

export const expenseCategories = [
    'Operasional',
    'Konsumsi',
    'Acara',
    'Perawatan',
    'Transportasi',
    'Administrasi',
    'Promosi/Marketing',
    'Donasi/Sosial',
    'Inventaris',
    'Teknologi',
    'Lainnya'
];

export const monthNames = [
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
    'Desember'
];

const toDateString = (date) => date.toISOString().slice(0, 10);

export const getMonthOptions = () => monthNames.map((label, index) => ({
    label,
    value: index + 1
}));

export const getPeriodDateRange = ({ year, month = 'all' }) => {
    const selectedYear = Number(year);
    if (!Number.isInteger(selectedYear)) {
        throw new Error('Tahun tidak valid.');
    }

    if (month === 'all') {
        return {
            startDate: `${selectedYear}-01-01`,
            endDate: `${selectedYear}-12-31`
        };
    }

    const selectedMonth = Number(month);
    if (!Number.isInteger(selectedMonth) || selectedMonth < 1 || selectedMonth > 12) {
        throw new Error('Bulan tidak valid.');
    }

    const start = new Date(Date.UTC(selectedYear, selectedMonth - 1, 1));
    const end = new Date(Date.UTC(selectedYear, selectedMonth, 0));
    return {
        startDate: toDateString(start),
        endDate: toDateString(end)
    };
};

export const parseCurrencyAmount = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Nominal wajib lebih besar dari nol.');
    }
    return Math.round(amount * 100) / 100;
};

export const formatRupiah = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export const normalizeExpensePayload = (formData, userId) => {
    if (!formData?.tanggal_pengeluaran || Number.isNaN(Date.parse(formData.tanggal_pengeluaran))) {
        throw new Error('Tanggal pengeluaran wajib valid.');
    }

    const jumlah = parseCurrencyAmount(formData.jumlah);
    const kategori = String(formData.kategori || '').trim();
    const deskripsi = String(formData.deskripsi || '').trim();

    if (!kategori) {
        throw new Error('Kategori pengeluaran wajib diisi.');
    }

    if (!deskripsi) {
        throw new Error('Keterangan pengeluaran wajib diisi.');
    }

    return {
        tanggal_pengeluaran: formData.tanggal_pengeluaran,
        kategori,
        deskripsi,
        jumlah,
        updated_by: userId || null
    };
};

// Expenses live under /api/payments/expenses — that is where the Go handler
// mounts them, there is no top-level /api/expenses route.
export const fetchExpensesByPeriod = async ({ year, month = 'all' }) => {
    const { startDate, endDate } = getPeriodDateRange({ year, month });
    const params = new URLSearchParams({ date_from: startDate, date_to: endDate });
    const data = await apiClient.get(`/api/payments/expenses?${params.toString()}`);
    return data || [];
};

export const createExpense = async (formData, userId) => {
    // created_by/updated_by are stamped server-side from the JWT.
    const { updated_by: _ignored, ...payload } = normalizeExpensePayload(formData, userId);
    return apiClient.post('/api/payments/expenses', payload);
};

export const updateExpense = async (id, formData, userId) => {
    const { updated_by: _ignored, ...payload } = normalizeExpensePayload(formData, userId);
    return apiClient.put(`/api/payments/expenses/${id}`, payload);
};

// The endpoint soft-deletes (sets deleted_at), matching the previous behaviour.
export const softDeleteExpense = async (id) => {
    await apiClient.delete(`/api/payments/expenses/${id}`);
};

// Totals are summed in Postgres now, so the client no longer pages through
// every payment row. Returns the same shape the dashboards already read.
export const fetchCashflowSummary = async ({ year, month = 'all' }) => {
    const selectedYear = Number(year);
    const params = new URLSearchParams({ year: String(selectedYear) });
    params.set('month', month === 'all' ? 'all' : String(Number(month)));

    const summary = await apiClient.get(`/api/payments/cashflow?${params.toString()}`);

    return {
        totalPemasukan: Number(summary?.totalPemasukan || 0),
        totalPengeluaran: Number(summary?.totalPengeluaran || 0),
        saldoBersih: Number(summary?.saldoBersih || 0),
        paymentCount: Number(summary?.paymentCount || 0),
        expenseCount: Number(summary?.expenseCount || 0)
    };
};

export const getFinanceErrorMessage = (error) => {
    const message = String(error?.message || error || '');
    if (message.includes('row-level security') || error?.code === '42501') {
        return 'Anda tidak memiliki akses untuk mengelola data keuangan ini.';
    }
    if (message.includes('jumlah') || message.includes('Nominal')) {
        return 'Nominal wajib lebih besar dari nol.';
    }
    return message || 'Operasi keuangan gagal.';
};
