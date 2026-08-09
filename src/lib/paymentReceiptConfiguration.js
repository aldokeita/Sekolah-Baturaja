import { fetchWebsiteContentMap, saveWebsiteContentItem } from '@/lib/publicContentAdapters';

/**
 * Pengaturan kuitansi disimpan sebagai website content karena halaman status
 * pembayaran dapat dibuka tanpa sesi admin. Isi objek ini hanya copy dan token
 * tampilan; nilai transaksi selalu berasal dari data pembayaran.
 */
export const PAYMENT_RECEIPT_CONFIG_KEY = 'payment_receipt_config';
export const PAYMENT_RECEIPT_CONFIG_VERSION = 1;

const COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const CACHE_KEY = 'payment_receipt_configuration_cache';

export const DEFAULT_PAYMENT_RECEIPT_CONFIG = Object.freeze({
  version: PAYMENT_RECEIPT_CONFIG_VERSION,
  identity: Object.freeze({
    source: 'website_content',
    brandKey: 'school_identity',
    infoKey: 'school_info',
    logoKey: 'logoUrl',
    showLogo: true,
    showName: true,
    showAddress: true,
    showContact: true,
  }),
  content: Object.freeze({
    receiptTitle: 'Bukti Pembayaran',
    officialReceiptTitle: 'Kwitansi Pembayaran Resmi',
    dateLabel: 'Tgl',
    timeLabel: 'Jam',
    methodLabel: 'Metode',
    statusLabel: 'Status',
    recipientLabel: 'Diterima Dari:',
    studentIdLabel: 'No. Induk:',
    itemLabel: 'Rincian',
    periodLabel: 'Periode',
    amountLabel: 'Nominal',
    totalLabel: 'TOTAL BAYAR',
    qrLabel: 'QR Code Status',
    footerText: 'Terima Kasih',
    paidStatusText: 'LUNAS',
    unpaidStatusText: 'BELUM LUNAS',
    transactionDateLabel: 'Tanggal Transaksi',
    transactionMethodLabel: 'Metode Pembayaran',
    descriptionLabel: 'Deskripsi Pembayaran',
    totalPaidLabel: 'TOTAL DIBAYARKAN',
    verificationLabel: 'Status Verifikasi',
  }),
  visibility: Object.freeze({
    logo: true,
    schoolName: true,
    address: true,
    contact: true,
    recipient: true,
    studentId: true,
    status: true,
    watermark: true,
    items: true,
    total: true,
    qr: true,
    footer: true,
    showTransactionReference: false,
  }),
  watermark: Object.freeze({
    visible: true,
    text: 'LUNAS',
    color: '#dc2626',
    opacity: 0.3,
    fontSize: 30,
    rotation: -12,
    borderWidth: 2,
    position: 'center',
  }),
  visual: Object.freeze({
    backgroundColor: '#ffffff',
    surfaceColor: '#f8fafc',
    borderColor: '#e2e8f0',
    textColor: '#172033',
    mutedTextColor: '#64748b',
    accentColor: '#166534',
    fontFamily: 'system',
    radius: 'md',
    density: 'comfortable',
  }),
  qr: Object.freeze({
    visible: true,
    size: 88,
    position: 'center',
  }),
});

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const clone = (value) => JSON.parse(JSON.stringify(value));

const mergeObjects = (base, override) => {
  if (!isPlainObject(base)) return override;
  const result = { ...base };
  if (!isPlainObject(override)) return result;
  Object.entries(override).forEach(([key, value]) => {
    result[key] = isPlainObject(value) && isPlainObject(base[key])
      ? mergeObjects(base[key], value)
      : value;
  });
  return result;
};

const parseStoredValue = (value) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

const textValue = (value, fallback, maxLength = 160) => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized ? normalized.slice(0, maxLength) : fallback;
};

const booleanValue = (value, fallback) => {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1) return true;
  if (value === 'false' || value === 0) return false;
  return fallback;
};

const numberValue = (value, fallback, min, max) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
};

const colorValue = (value, fallback) => {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (!COLOR_PATTERN.test(candidate)) return fallback;
  const hex = candidate.slice(1);
  return `#${hex.length === 3 ? hex.split('').map((part) => `${part}${part}`).join('') : hex}`.toLowerCase();
};

const enumValue = (value, allowed, fallback) => allowed.includes(value) ? value : fallback;

/**
 * Menghasilkan bentuk konfigurasi yang aman dipakai renderer. Normalisasi ini
 * sengaja membuang CSS bebas dan angka ekstrem dari content yang tersimpan.
 */
export const normalizePaymentReceiptConfiguration = (stored) => {
  const source = parseStoredValue(stored);
  const merged = mergeObjects(DEFAULT_PAYMENT_RECEIPT_CONFIG, isPlainObject(source) ? source : {});
  const identityDefaults = DEFAULT_PAYMENT_RECEIPT_CONFIG.identity;
  const contentDefaults = DEFAULT_PAYMENT_RECEIPT_CONFIG.content;
  const visibilityDefaults = DEFAULT_PAYMENT_RECEIPT_CONFIG.visibility;
  const watermarkDefaults = DEFAULT_PAYMENT_RECEIPT_CONFIG.watermark;
  const visualDefaults = DEFAULT_PAYMENT_RECEIPT_CONFIG.visual;
  const qrDefaults = DEFAULT_PAYMENT_RECEIPT_CONFIG.qr;

  const identitySource = isPlainObject(source?.identity) ? source.identity : {};
  const visibilitySource = isPlainObject(source?.visibility) ? source.visibility : {};
  const identity = {
    // These markers document the existing Website Content source. They are not
    // school names, transaction values, or a second identity database.
    source: 'website_content',
    brandKey: identityDefaults.brandKey,
    infoKey: identityDefaults.infoKey,
    logoKey: identityDefaults.logoKey,
    showLogo: booleanValue(visibilitySource.logo ?? identitySource.showLogo, identityDefaults.showLogo),
    showName: booleanValue(visibilitySource.schoolName ?? identitySource.showName, identityDefaults.showName),
    showAddress: booleanValue(visibilitySource.address ?? visibilitySource.schoolAddress ?? identitySource.showAddress, identityDefaults.showAddress),
    showContact: booleanValue(visibilitySource.contact ?? visibilitySource.schoolContact ?? identitySource.showContact, identityDefaults.showContact),
  };

  const content = Object.fromEntries(Object.keys(contentDefaults).map((key) => [
    key,
    textValue(merged.content?.[key], contentDefaults[key]),
  ]));
  const visibility = Object.fromEntries(Object.keys(visibilityDefaults).map((key) => [
    key,
    booleanValue(visibilitySource[key] ?? (
      key === 'items' ? visibilitySource.itemList
        : key === 'qr' ? visibilitySource.qrCode
          : undefined
    ), visibilityDefaults[key]),
  ]));
  // Keep the older, flatter visibility aliases in sync so renderer integration
  // can use either `config.identity` or `config.visibility` without divergence.
  visibility.logo = identity.showLogo;
  visibility.schoolName = identity.showName;
  visibility.address = identity.showAddress;
  visibility.contact = identity.showContact;
  // Nomor transaksi/Ref tetap menjadi data internal untuk log dan pelacakan,
  // tetapi tidak boleh muncul sebagai elemen visual yang bisa dikonfigurasi.
  visibility.showTransactionReference = false;

  const watermark = {
    visible: booleanValue(visibilitySource.watermark ?? merged.watermark?.visible, watermarkDefaults.visible),
    text: textValue(merged.watermark?.text, watermarkDefaults.text, 32),
    color: colorValue(merged.watermark?.color, watermarkDefaults.color),
    opacity: numberValue(merged.watermark?.opacity, watermarkDefaults.opacity, 0.05, 0.6),
    fontSize: numberValue(merged.watermark?.fontSize, watermarkDefaults.fontSize, 12, 64),
    rotation: numberValue(merged.watermark?.rotation, watermarkDefaults.rotation, -30, 30),
    borderWidth: numberValue(merged.watermark?.borderWidth, watermarkDefaults.borderWidth, 1, 8),
    position: enumValue(merged.watermark?.position, ['left', 'center', 'right'], watermarkDefaults.position),
  };

  const visual = {
    backgroundColor: colorValue(merged.visual?.backgroundColor, visualDefaults.backgroundColor),
    surfaceColor: colorValue(merged.visual?.surfaceColor, visualDefaults.surfaceColor),
    borderColor: colorValue(merged.visual?.borderColor, visualDefaults.borderColor),
    textColor: colorValue(merged.visual?.textColor, visualDefaults.textColor),
    mutedTextColor: colorValue(merged.visual?.mutedTextColor, visualDefaults.mutedTextColor),
    accentColor: colorValue(merged.visual?.accentColor, visualDefaults.accentColor),
    fontFamily: enumValue(merged.visual?.fontFamily, ['system', 'serif', 'mono'], visualDefaults.fontFamily),
    radius: enumValue(merged.visual?.radius, ['sm', 'md', 'lg'], visualDefaults.radius),
    density: enumValue(merged.visual?.density, ['compact', 'comfortable'], visualDefaults.density),
  };

  const qr = {
    visible: booleanValue(visibilitySource.qr ?? merged.qr?.visible, qrDefaults.visible),
    size: numberValue(merged.qr?.size, qrDefaults.size, 48, 180),
    position: enumValue(merged.qr?.position, ['left', 'center', 'right'], qrDefaults.position),
  };
  visibility.watermark = watermark.visible;
  visibility.qr = qr.visible;

  return {
    version: PAYMENT_RECEIPT_CONFIG_VERSION,
    identity,
    content,
    visibility,
    watermark,
    visual,
    qr,
  };
};

const readCache = () => {
  try {
    if (typeof localStorage === 'undefined') return clone(DEFAULT_PAYMENT_RECEIPT_CONFIG);
    return normalizePaymentReceiptConfiguration(localStorage.getItem(CACHE_KEY));
  } catch {
    return clone(DEFAULT_PAYMENT_RECEIPT_CONFIG);
  }
};

let cachedConfiguration = readCache();
const subscribers = new Set();

export const getPaymentReceiptConfiguration = () => cachedConfiguration;

export const subscribePaymentReceiptConfiguration = (listener) => {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
};

/** Terapkan cache dan beri tahu semua bukti pembayaran yang sedang terbuka. */
export const applyPaymentReceiptConfiguration = (configuration) => {
  cachedConfiguration = normalizePaymentReceiptConfiguration(configuration);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cachedConfiguration));
    }
  } catch {
    // Cache hanya akselerator; aplikasi tetap memakai nilai di memori.
  }
  subscribers.forEach((listener) => {
    try { listener(cachedConfiguration); } catch { /* listener lain tetap berjalan */ }
  });
  return cachedConfiguration;
};

/** Baca konfigurasi publik dari website_content. Error sengaja diteruskan. */
export const fetchPaymentReceiptConfiguration = async () => {
  const contentMap = await fetchWebsiteContentMap({
    keys: [PAYMENT_RECEIPT_CONFIG_KEY],
    publicOnly: true,
  });
  return applyPaymentReceiptConfiguration(contentMap?.[PAYMENT_RECEIPT_CONFIG_KEY]);
};

/** Simpan hanya copy/token tampilan yang sudah dinormalisasi ke website_content. */
export const savePaymentReceiptConfiguration = async (configuration) => {
  const normalized = normalizePaymentReceiptConfiguration(configuration);
  const saved = await saveWebsiteContentItem({
    key: PAYMENT_RECEIPT_CONFIG_KEY,
    content: normalized,
    isPublic: true,
  });
  // Endpoint dapat mengembalikan baris website_content atau data kosong. Bila
  // kosong, nilai yang dikirim tetap menjadi sumber kebenaran lokal.
  const savedValue = saved?.content ?? normalized;
  return applyPaymentReceiptConfiguration(savedValue);
};

/** Ambil dari server sekali; fallback bawaan tetap usable saat server gagal. */
export const hydratePaymentReceiptConfiguration = async () => {
  try {
    return await fetchPaymentReceiptConfiguration();
  } catch {
    return applyPaymentReceiptConfiguration(DEFAULT_PAYMENT_RECEIPT_CONFIG);
  }
};
