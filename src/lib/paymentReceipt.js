export const PAYMENT_STATUS_LABELS = Object.freeze({
  paid: 'LUNAS',
  unpaid: 'BELUM LUNAS',
  void: 'DIBATALKAN',
  refunded: 'DIKEMBALIKAN',
});

export const normalizePaymentStatus = (value) => String(value || '').trim().toLowerCase();

export const formatPaymentStatus = (value) => {
  const normalized = normalizePaymentStatus(value);
  return PAYMENT_STATUS_LABELS[normalized] || '-';
};

export const isPaymentPaid = (value) => normalizePaymentStatus(value) === 'paid';

export const normalizeWhatsAppPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;

  const normalized = digits.startsWith('0')
    ? `62${digits.slice(1)}`
    : digits.startsWith('62')
      ? digits
      : `62${digits}`;

  return normalized.length >= 10 ? normalized : null;
};

export const getPaymentReceiptReference = (payment) =>
  payment?.transaction_id || payment?.id || '-';
