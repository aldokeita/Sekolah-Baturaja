import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_PAYMENT_RECEIPT_CONFIG,
  PAYMENT_RECEIPT_CONFIG_KEY,
  applyPaymentReceiptConfiguration,
  fetchPaymentReceiptConfiguration,
  getPaymentReceiptConfiguration,
  normalizePaymentReceiptConfiguration,
  savePaymentReceiptConfiguration,
} from '@/lib/paymentReceiptConfiguration';
import { fetchWebsiteContentMap, saveWebsiteContentItem } from '@/lib/publicContentAdapters';

vi.mock('@/lib/publicContentAdapters', () => ({
  fetchWebsiteContentMap: vi.fn(),
  saveWebsiteContentItem: vi.fn(),
}));

describe('payment receipt configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    applyPaymentReceiptConfiguration(DEFAULT_PAYMENT_RECEIPT_CONFIG);
  });

  it('menyediakan kontrak bawaan untuk copy, identity source, visibility, watermark, visual, dan QR', () => {
    const config = normalizePaymentReceiptConfiguration(DEFAULT_PAYMENT_RECEIPT_CONFIG);

    expect(config.content.receiptTitle).toBe('Bukti Pembayaran');
    expect(config.content.paidStatusText).toBe('LUNAS');
    expect(config.identity).toMatchObject({
      source: 'website_content',
      brandKey: 'school_identity',
      infoKey: 'school_info',
      logoKey: 'logoUrl',
    });
    expect(Object.keys(config.visibility)).toEqual([
      'logo', 'schoolName', 'address', 'contact', 'recipient', 'studentId',
      'status', 'watermark', 'items', 'total', 'qr', 'footer', 'showTransactionReference',
    ]);
    expect(config.watermark.position).toBe('center');
    expect(config.visual.fontFamily).toBe('system');
    expect(config.qr.size).toBe(88);
  });

  it('menormalkan warna, enum, angka, copy kosong, dan alias visibility dengan aman', () => {
    const config = normalizePaymentReceiptConfiguration({
      content: { receiptTitle: '  Judul Baru  ', footerText: '   ' },
      visibility: {
        logo: false,
        address: false,
        qr: false,
        showTransactionReference: true,
      },
      watermark: {
        color: 'url(javascript:alert(1))',
        opacity: 99,
        fontSize: 999,
        rotation: -999,
        borderWidth: 0,
        position: 'middle',
      },
      visual: {
        backgroundColor: '#abc',
        accentColor: '#ABC',
        fontFamily: 'comic-sans',
        radius: 'round',
        density: 'loose',
      },
      qr: { size: 9999, position: 'diagonal' },
    });

    expect(config.content.receiptTitle).toBe('Judul Baru');
    expect(config.content.footerText).toBe(DEFAULT_PAYMENT_RECEIPT_CONFIG.content.footerText);
    expect(config.visibility.logo).toBe(false);
    expect(config.visibility.address).toBe(false);
    expect(config.visibility.qr).toBe(false);
    expect(config.visibility.showTransactionReference).toBe(false);
    expect(config.identity.showLogo).toBe(false);
    expect(config.identity.showAddress).toBe(false);
    expect(config.watermark).toMatchObject({
      color: DEFAULT_PAYMENT_RECEIPT_CONFIG.watermark.color,
      opacity: 0.6,
      fontSize: 64,
      rotation: -30,
      borderWidth: 1,
      position: 'center',
    });
    expect(config.visual).toMatchObject({
      backgroundColor: '#aabbcc',
      accentColor: '#aabbcc',
      fontFamily: 'system',
      radius: 'md',
      density: 'comfortable',
    });
    expect(config.qr).toMatchObject({ size: 180, position: 'center', visible: false });
  });

  it('menganggap visibility yang tidak ada sebagai terlihat dan tidak menyimpan data dinamis', () => {
    const config = normalizePaymentReceiptConfiguration({ content: { receiptTitle: 'A' } });

    expect(config.visibility.logo).toBe(true);
    expect(config.visibility.items).toBe(true);
    expect(config.visibility.footer).toBe(true);
    expect(config.visibility.showTransactionReference).toBe(false);
    expect(JSON.stringify(DEFAULT_PAYMENT_RECEIPT_CONFIG)).not.toContain('Naila Rahmadani');
    expect(JSON.stringify(DEFAULT_PAYMENT_RECEIPT_CONFIG)).not.toContain('transactionId');
    expect(JSON.stringify(config)).not.toContain('transactionId');
  });

  it('membaca dari website content publik', async () => {
    fetchWebsiteContentMap.mockResolvedValue({
      [PAYMENT_RECEIPT_CONFIG_KEY]: { content: { receiptTitle: 'Kuitansi Sekolah' } },
    });

    const config = await fetchPaymentReceiptConfiguration();

    expect(fetchWebsiteContentMap).toHaveBeenCalledWith({
      keys: [PAYMENT_RECEIPT_CONFIG_KEY],
      publicOnly: true,
    });
    expect(config.content.receiptTitle).toBe('Kuitansi Sekolah');
    expect(getPaymentReceiptConfiguration().content.receiptTitle).toBe('Kuitansi Sekolah');
  });

  it('menyimpan konfigurasi normalized sebagai website content publik', async () => {
    saveWebsiteContentItem.mockImplementation(async ({ content }) => ({ content }));

    const config = await savePaymentReceiptConfiguration({ content: { receiptTitle: '  Disimpan  ' } });

    expect(saveWebsiteContentItem).toHaveBeenCalledWith(expect.objectContaining({
      key: PAYMENT_RECEIPT_CONFIG_KEY,
      isPublic: true,
      content: expect.objectContaining({
        content: expect.objectContaining({ receiptTitle: 'Disimpan' }),
        visibility: expect.objectContaining({ showTransactionReference: false }),
      }),
    }));
    expect(config.content.receiptTitle).toBe('Disimpan');
  });
});
