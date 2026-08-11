import { describe, expect, it } from 'vitest';
import {
  FINANCE_DATA_CHANGED_EVENT,
  getLocalDateString,
  getPeriodDateRange,
  notifyFinanceDataChanged,
  normalizeExpensePayload,
} from '@/lib/financeAdapters';

describe('finance date and expense contracts', () => {
  it('formats the local calendar date without a UTC shift', () => {
    expect(getLocalDateString(new Date(2026, 7, 9, 0, 15))).toBe('2026-08-09');
  });

  it('builds an inclusive month filter in the local calendar', () => {
    expect(getPeriodDateRange({ year: 2028, month: 2 })).toEqual({
      startDate: '2028-02-01',
      endDate: '2028-02-29',
    });
  });

  it('normalizes a valid expense payload and rejects missing details', () => {
    expect(normalizeExpensePayload({
      tanggal_pengeluaran: '2026-08-09',
      kategori: ' Operasional ',
      deskripsi: ' Listrik ',
      jumlah: '125000',
    })).toMatchObject({
      tanggal_pengeluaran: '2026-08-09',
      kategori: 'Operasional',
      deskripsi: 'Listrik',
      jumlah: 125000,
    });

    expect(() => normalizeExpensePayload({
      tanggal_pengeluaran: '2026-08-09',
      kategori: 'Operasional',
      deskripsi: '',
      jumlah: 100,
    })).toThrow('Keterangan pengeluaran wajib diisi.');
  });

  it('notifies mounted dashboard consumers after a finance mutation', () => {
    let received = null;
    const listener = (event) => { received = event.detail; };
    window.addEventListener(FINANCE_DATA_CHANGED_EVENT, listener);
    notifyFinanceDataChanged({ type: 'payment', action: 'created' });
    window.removeEventListener(FINANCE_DATA_CHANGED_EVENT, listener);

    expect(received).toEqual({ type: 'payment', action: 'created' });
  });
});
