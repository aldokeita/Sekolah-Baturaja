import React from 'react';
import { Separator } from '@/components/ui/separator';
import { DEFAULT_LOGO_PATH } from '@/lib/schoolAssets';
import { normalizePaymentReceiptConfiguration } from '@/lib/paymentReceiptConfiguration';

const FONT_FAMILIES = {
  system: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  serif: 'Georgia, Cambria, "Times New Roman", serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
};
const RADIUS_VALUES = { sm: '0.75rem', md: '1.25rem', lg: '1.75rem' };
const SAMPLE_TRANSACTION = Object.freeze({
  studentName: 'Naila Rahmadani',
  studentId: '2026-001',
  date: '9 Agustus 2026',
  time: '18.17',
  method: 'Tunai',
  item: 'Sarpras',
  amount: 100000,
  total: 100000,
  period: 'Agustus 2026',
});

const money = (value) => `Rp${Number(value || 0).toLocaleString('id-ID')}`;

const PaymentReceiptLivePreview = ({ config, identity, logoUrl, qrUrl }) => {
  const safeConfig = normalizePaymentReceiptConfiguration(config);
  const { content, visibility, watermark, visual, qr } = safeConfig;
  const rootStyle = {
    backgroundColor: visual.backgroundColor,
    color: visual.textColor,
    borderColor: visual.borderColor,
    borderRadius: RADIUS_VALUES[visual.radius],
    fontFamily: FONT_FAMILIES[visual.fontFamily],
  };
  const surfaceStyle = {
    backgroundColor: visual.surfaceColor,
    borderColor: visual.borderColor,
  };
  const mutedStyle = { color: visual.mutedTextColor };
  const accentStyle = { color: visual.accentColor };
  const stampPosition = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  }[watermark.position];
  const stampStyle = {
    color: watermark.color,
    borderColor: watermark.color,
    opacity: watermark.opacity,
    fontSize: `${watermark.fontSize}px`,
    borderWidth: `${watermark.borderWidth}px`,
    transform: `rotate(${watermark.rotation}deg)`,
  };
  const density = visual.density === 'compact' ? 'p-3' : 'p-4';
  const qrAlign = { left: 'items-start', center: 'items-center', right: 'items-end' }[qr.position] || 'items-center';

  return (
    <div className="mx-auto w-full max-w-[430px] space-y-3" data-testid="payment-receipt-live-preview">
      <div className="overflow-hidden border shadow-sm" style={rootStyle}>
        <div className="space-y-3 p-5 text-center">
          {visibility.logo && (
            <img src={logoUrl || DEFAULT_LOGO_PATH} alt="Logo sekolah" className="mx-auto h-14 w-14 rounded-xl object-contain" />
          )}
          {visibility.schoolName && <h5 className="text-lg font-black leading-tight">{identity.name}</h5>}
          {content.receiptTitle && <p className="text-xs font-bold uppercase tracking-[0.16em]" style={accentStyle}>{content.receiptTitle}</p>}
          {visibility.address && <p className="text-xs leading-relaxed" style={mutedStyle}>{identity.address}</p>}
          {visibility.contact && <p className="text-xs" style={mutedStyle}>{identity.phone}{identity.website ? ` · ${identity.website}` : ''}</p>}
        </div>

        <Separator style={{ backgroundColor: visual.borderColor }} />

        <div className={`mx-4 my-4 grid grid-cols-2 gap-2 rounded-2xl border text-xs ${density}`} style={surfaceStyle}>
          <div><span style={mutedStyle}>{content.dateLabel}: </span><strong>{SAMPLE_TRANSACTION.date}</strong></div>
          <div className="text-right"><span style={mutedStyle}>{content.methodLabel}: </span><strong>{SAMPLE_TRANSACTION.method}</strong></div>
          <div><span style={mutedStyle}>{content.timeLabel}: </span><strong>{SAMPLE_TRANSACTION.time}</strong></div>
          {visibility.status && <div className="text-right"><span style={mutedStyle}>{content.statusLabel}: </span><strong style={accentStyle}>{content.paidStatusText}</strong></div>}
        </div>

        {visibility.watermark && watermark.visible && (
          <div className={`relative flex h-16 items-center overflow-hidden border-y px-4 ${stampPosition}`} style={{ borderColor: visual.borderColor }} aria-hidden="true">
            <span className="whitespace-nowrap rounded-lg px-3 py-1 font-black tracking-[0.14em]" style={stampStyle}>{watermark.text}</span>
          </div>
        )}

        {visibility.recipient && (
          <div className="space-y-1 px-5 py-4">
            <p className="text-xs font-semibold" style={mutedStyle}>{content.recipientLabel}</p>
            <p className="font-bold">{SAMPLE_TRANSACTION.studentName}</p>
            {visibility.studentId && <p className="text-xs" style={mutedStyle}>{content.studentIdLabel} {SAMPLE_TRANSACTION.studentId}</p>}
          </div>
        )}

        {visibility.items && (
          <div className="mx-5 border-y py-3">
            <div className="flex items-center justify-between gap-3 text-xs" style={mutedStyle}>
              <span>{content.itemLabel}</span><span>{content.amountLabel}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-sm">
              <span>{SAMPLE_TRANSACTION.item}<small className="ml-1 text-xs" style={mutedStyle}>({SAMPLE_TRANSACTION.period})</small></span>
              <strong>{money(SAMPLE_TRANSACTION.amount)}</strong>
            </div>
          </div>
        )}

        {visibility.total && (
          <div className="mx-5 my-4 flex items-center justify-between gap-4 rounded-2xl border p-4" style={{ ...surfaceStyle, color: visual.accentColor }}>
            <strong className="text-sm">{content.totalLabel}</strong><strong className="text-xl">{money(SAMPLE_TRANSACTION.total)}</strong>
          </div>
        )}

        {visibility.qr && qr.visible && qrUrl && (
          <div className={`space-y-2 px-5 pb-4 text-center flex flex-col ${qrAlign}`}>
            <img src={qrUrl} alt={content.qrLabel} className="rounded-lg" style={{ width: `${qr.size}px`, height: `${qr.size}px` }} />
          </div>
        )}
        {visibility.footer && <p className="pb-5 text-center text-xs font-bold uppercase tracking-[0.16em]" style={mutedStyle}>{content.footerText}</p>}
      </div>
      <p className="text-center text-xs text-muted-foreground">Preview memakai data contoh. Nama murid, tanggal, nominal, metode, dan ID transaksi tetap dinamis dari sistem.</p>
    </div>
  );
};

export default PaymentReceiptLivePreview;
