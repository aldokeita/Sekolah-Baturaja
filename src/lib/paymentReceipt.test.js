import { describe, expect, it } from 'vitest';

import {
  formatPaymentStatus,
  getPaymentReceiptReference,
  isPaymentPaid,
  normalizePaymentStatus,
  normalizeWhatsAppPhone,
} from '@/lib/paymentReceipt';

describe('payment receipt helpers', () => {
  it('normalizes and labels payment status without changing the stored value', () => {
    expect(normalizePaymentStatus(' PAID ')).toBe('paid');
    expect(formatPaymentStatus('paid')).toBe('LUNAS');
    expect(formatPaymentStatus('unpaid')).toBe('BELUM LUNAS');
    expect(formatPaymentStatus('void')).toBe('DIBATALKAN');
    expect(formatPaymentStatus('unknown')).toBe('-');
    expect(isPaymentPaid('paid')).toBe(true);
    expect(isPaymentPaid('unpaid')).toBe(false);
  });

  it.each([
    ['081234567890', '6281234567890'],
    ['+62 812-3456-7890', '6281234567890'],
    ['81234567890', '6281234567890'],
    ['6281234567890', '6281234567890'],
  ])('normalizes WhatsApp phone %s', (input, expected) => {
    expect(normalizeWhatsAppPhone(input)).toBe(expected);
  });

  it.each(['', null, '12345', 'nomor tidak valid'])('rejects invalid phone %s', (input) => {
    expect(normalizeWhatsAppPhone(input)).toBeNull();
  });

  it('prefers the persisted transaction reference over the record id', () => {
    expect(getPaymentReceiptReference({ transaction_id: 'tx-1', id: 'row-1' })).toBe('tx-1');
    expect(getPaymentReceiptReference({ id: 'row-1' })).toBe('row-1');
    expect(getPaymentReceiptReference(null)).toBe('-');
  });
});
