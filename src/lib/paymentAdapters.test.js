import { describe, expect, it } from 'vitest';
import {
  normalizePaymentItemSettings,
  parsePaymentItemAmount,
  PAYMENT_ITEM_SETTING_KEYS,
} from '@/lib/paymentAdapters';

describe('payment item amount settings', () => {
  it('only accepts positive finite nominal values', () => {
    expect(parsePaymentItemAmount('75000')).toBe(75000);
    expect(parsePaymentItemAmount(12500.5)).toBe(12500.5);
    expect(parsePaymentItemAmount(9999999999.99)).toBe(9999999999.99);
    expect(parsePaymentItemAmount('')).toBeNull();
    expect(parsePaymentItemAmount(0)).toBeNull();
    expect(parsePaymentItemAmount(-1)).toBeNull();
    expect(parsePaymentItemAmount(10000000000)).toBeNull();
    expect(parsePaymentItemAmount('bukan angka')).toBeNull();
  });

  it('keeps each supported item independent and ignores SPP or unknown keys', () => {
    const settings = normalizePaymentItemSettings({
      data: [
        { item_key: 'sarpras', amount: '25000' },
        { item_key: 'seragam', amount: 135000 },
        { item_key: 'spp', amount: 100000 },
        { item_key: 'unknown', amount: 99999 },
        { item_key: 'lks', amount: 0 },
      ],
    });

    expect(settings).toEqual({ sarpras: 25000, seragam: 135000 });
    expect(PAYMENT_ITEM_SETTING_KEYS).not.toContain('spp');
    expect(settings).not.toHaveProperty('spp');
  });

  it('returns an empty map when no settings have been saved yet', () => {
    expect(normalizePaymentItemSettings([])).toEqual({});
    expect(normalizePaymentItemSettings({ data: null })).toEqual({});
  });
});
