import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Eye,
  Loader2,
  Palette,
  QrCode,
  Receipt,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Type,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DEFAULT_PAYMENT_RECEIPT_CONFIG,
  normalizePaymentReceiptConfiguration,
  savePaymentReceiptConfiguration,
} from '@/lib/paymentReceiptConfiguration';
import usePaymentReceiptConfiguration from '@/hooks/usePaymentReceiptConfiguration';
import {
  DEFAULT_SCHOOL_IDENTITY,
  SCHOOL_IDENTITY_KEY,
  SCHOOL_INFO_KEY,
  applySchoolIdentity,
  getSchoolIdentity,
  saveSchoolBrand,
  saveSchoolInfo,
} from '@/lib/schoolIdentity';
import {
  fetchWebsiteContentMap,
  getEmbeddableImageUrl,
  getPublicContentErrorMessage,
  saveWebsiteContentItem,
} from '@/lib/publicContentAdapters';
import { DEFAULT_LOGO_PATH } from '@/lib/schoolAssets';
import PaymentReceiptLivePreview from './PaymentReceiptLivePreview';

const COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const VISIBILITY_LABELS = [
  ['logo', 'Logo sekolah'],
  ['schoolName', 'Nama sekolah'],
  ['address', 'Alamat'],
  ['contact', 'Kontak'],
  ['recipient', 'Identitas penerima'],
  ['studentId', 'Nomor induk'],
  ['status', 'Status pembayaran'],
  ['watermark', 'Watermark LUNAS'],
  ['items', 'Daftar item'],
  ['total', 'Total pembayaran'],
  ['qr', 'QR code'],
  ['footer', 'Ucapan penutup'],
];
const CONTENT_FIELDS = [
  ['receiptTitle', 'Judul bukti pembayaran'],
  ['officialReceiptTitle', 'Judul bukti resmi'],
  ['dateLabel', 'Label tanggal'],
  ['timeLabel', 'Label waktu'],
  ['methodLabel', 'Label metode'],
  ['statusLabel', 'Label status'],
  ['recipientLabel', 'Label penerima'],
  ['studentIdLabel', 'Label nomor induk'],
  ['itemLabel', 'Label rincian item'],
  ['periodLabel', 'Label periode item'],
  ['amountLabel', 'Label nominal'],
  ['totalLabel', 'Label total'],
  ['qrLabel', 'Teks alternatif QR code'],
  ['footerText', 'Ucapan penutup'],
  ['paidStatusText', 'Teks status lunas'],
  ['unpaidStatusText', 'Teks status belum lunas'],
  ['transactionDateLabel', 'Label tanggal transaksi'],
  ['transactionMethodLabel', 'Label metode pembayaran'],
  ['descriptionLabel', 'Label deskripsi pembayaran'],
  ['totalPaidLabel', 'Label total dibayarkan'],
  ['verificationLabel', 'Label verifikasi'],
];
const COLOR_FIELDS = [
  ['backgroundColor', 'Latar bukti'],
  ['surfaceColor', 'Permukaan informasi'],
  ['accentColor', 'Aksen total/status'],
  ['borderColor', 'Border dan divider'],
  ['textColor', 'Teks utama'],
  ['mutedTextColor', 'Teks sekunder'],
];

const cloneIdentity = (identity, logoUrl = '') => ({
  ...DEFAULT_SCHOOL_IDENTITY,
  ...(identity || {}),
  logoUrl: logoUrl || identity?.logoUrl || '',
});

const setNestedValue = (current, section, key, value) => ({
  ...current,
  [section]: {
    ...current[section],
    [key]: value,
  },
});

const TextField = ({ id, label, value, onChange, hint, multiline = false, ...props }) => (
  <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    {multiline ? (
      <Textarea id={id} value={value ?? ''} onChange={(event) => onChange(event.target.value)} {...props} />
    ) : (
      <Input id={id} value={value ?? ''} onChange={(event) => onChange(event.target.value)} {...props} />
    )}
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);

const ColorField = ({ id, label, value, onChange }) => {
  const safeValue = COLOR_PATTERN.test(value || '') ? value : '#ffffff';
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="color"
          aria-label={`${label} — pemilih warna`}
          value={safeValue}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-12 cursor-pointer p-1"
        />
        <Input id={id} value={value ?? ''} onChange={(event) => onChange(event.target.value)} placeholder="#ffffff" />
      </div>
    </div>
  );
};

const ToggleRow = ({ id, label, description, checked, onCheckedChange, disabled = false }) => (
  <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/45 p-3">
    <div className="min-w-0">
      <Label htmlFor={id} className="cursor-pointer text-sm font-semibold">{label}</Label>
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
    </div>
    <Switch id={id} checked={Boolean(checked)} onCheckedChange={onCheckedChange} disabled={disabled} aria-label={label} />
  </div>
);

const SectionHeading = ({ icon: Icon, title, description }) => (
  <div className="flex items-start gap-3">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
      <Icon className="h-4 w-4" aria-hidden="true" />
    </div>
    <div>
      <h4 className="font-bold text-foreground">{title}</h4>
      {description && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>}
    </div>
  </div>
);

const PaymentReceiptEditor = () => {
  const { config: remoteConfig, isLoading: configLoading, error: configError } = usePaymentReceiptConfiguration();
  const [draft, setDraft] = useState(() => normalizePaymentReceiptConfiguration(DEFAULT_PAYMENT_RECEIPT_CONFIG));
  const [identity, setIdentity] = useState(() => cloneIdentity(getSchoolIdentity()));
  const [identityLoading, setIdentityLoading] = useState(true);
  const [identityError, setIdentityError] = useState(null);
  const [logoPreview, setLogoPreview] = useState(DEFAULT_LOGO_PATH);
  const [qrPreview, setQrPreview] = useState('');
  const [saveState, setSaveState] = useState('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [identitySaveState, setIdentitySaveState] = useState('idle');
  const [identitySaveMessage, setIdentitySaveMessage] = useState('');

  useEffect(() => {
    if (!configLoading) setDraft(normalizePaymentReceiptConfiguration(remoteConfig));
  }, [configLoading, remoteConfig]);

  useEffect(() => {
    let active = true;
    fetchWebsiteContentMap({ keys: [SCHOOL_IDENTITY_KEY, SCHOOL_INFO_KEY, 'logoUrl'], publicOnly: false })
      .then((map) => {
        if (!active) return;
        const applied = applySchoolIdentity({
          ...(map?.[SCHOOL_IDENTITY_KEY] || {}),
          ...(map?.[SCHOOL_INFO_KEY] || {}),
        });
        setIdentity(cloneIdentity(applied, map?.logoUrl));
      })
      .catch((error) => {
        if (active) {
          setIdentityError(error);
          setIdentity(cloneIdentity(getSchoolIdentity()));
        }
      })
      .finally(() => {
        if (active) setIdentityLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    getEmbeddableImageUrl(identity.logoUrl, DEFAULT_LOGO_PATH).then((url) => {
      if (active) setLogoPreview(url);
    });
    return () => { active = false; };
  }, [identity.logoUrl]);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL('https://sekolahbta.id/status-pembayaran/editor-preview', { width: 240, margin: 1 }, (error, url) => {
      if (active && !error) setQrPreview(url);
    });
    return () => { active = false; };
  }, []);

  const previewConfig = useMemo(() => normalizePaymentReceiptConfiguration(draft), [draft]);

  const updateSection = (section, key, value) => {
    setDraft((current) => setNestedValue(current, section, key, value));
    setSaveState('idle');
    setSaveMessage('');
  };

  const updateVisibility = (key, checked) => {
    updateSection('visibility', key, checked);
    if (key === 'watermark') updateSection('watermark', 'visible', checked);
    if (key === 'qr') updateSection('qr', 'visible', checked);
    if (key === 'logo') updateSection('identity', 'showLogo', checked);
    if (key === 'schoolName') updateSection('identity', 'showName', checked);
    if (key === 'address') updateSection('identity', 'showAddress', checked);
    if (key === 'contact') updateSection('identity', 'showContact', checked);
  };

  const handleSave = async () => {
    setSaveState('saving');
    setSaveMessage('Menyimpan konfigurasi…');
    try {
      const saved = await savePaymentReceiptConfiguration(draft);
      setDraft(saved);
      setSaveState('success');
      setSaveMessage('Konfigurasi bukti pembayaran tersimpan dan siap dipakai renderer publik maupun admin.');
    } catch (error) {
      setSaveState('error');
      setSaveMessage(getPublicContentErrorMessage(error));
    }
  };

  const handleSaveIdentity = async () => {
    const name = String(identity.name || '').trim();
    if (!name) {
      setIdentitySaveState('error');
      setIdentitySaveMessage('Nama sekolah wajib diisi.');
      return;
    }
    setIdentitySaveState('saving');
    setIdentitySaveMessage('Menyimpan identitas ke Manajemen Konten Website…');
    const nextIdentity = { ...identity, name, logoUrl: String(identity.logoUrl || '').trim() };
    try {
      await Promise.all([
        saveSchoolBrand(nextIdentity),
        saveSchoolInfo(nextIdentity),
        saveWebsiteContentItem({ key: 'logoUrl', content: nextIdentity.logoUrl, isPublic: true }),
      ]);
      const applied = applySchoolIdentity(nextIdentity);
      setIdentity(cloneIdentity(applied, nextIdentity.logoUrl));
      setIdentitySaveState('success');
      setIdentitySaveMessage('Identitas tersimpan di sumber Manajemen Konten Website.');
    } catch (error) {
      setIdentitySaveState('error');
      setIdentitySaveMessage(getPublicContentErrorMessage(error));
    }
  };

  const handleReset = () => {
    setDraft(normalizePaymentReceiptConfiguration(DEFAULT_PAYMENT_RECEIPT_CONFIG));
    setSaveState('idle');
    setSaveMessage('Kembali ke bawaan, belum tersimpan. Tekan Simpan untuk menerapkannya.');
  };

  const isLoading = configLoading || identityLoading;
  if (isLoading) {
    return (
      <section className="space-y-4" aria-busy="true" aria-label="Memuat editor bukti pembayaran">
        <Skeleton className="h-12 w-72 admin-skeleton-shimmer" />
        <div className="grid gap-6 xl:grid-cols-2">
          <Skeleton className="h-[520px] rounded-2xl admin-skeleton-shimmer" />
          <Skeleton className="h-[620px] rounded-2xl admin-skeleton-shimmer" />
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6" aria-labelledby="payment-receipt-editor-title">
      <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="admin-panel-header-icon"><Receipt /></div>
          <div>
            <h3 id="payment-receipt-editor-title" className="text-xl font-black tracking-tight text-foreground sm:text-2xl">Live Editor Pembayaran</h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Atur copy dan tampilan bukti pembayaran dengan preview langsung. Nilai transaksi tetap berasal dari sistem pembayaran.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={handleReset} disabled={saveState === 'saving'}>
            <RotateCcw className="mr-2 h-4 w-4" /> Kembalikan bawaan
          </Button>
          <Button type="button" onClick={handleSave} disabled={saveState === 'saving'}>
            {saveState === 'saving' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {saveState === 'saving' ? 'Menyimpan…' : 'Simpan konfigurasi'}
          </Button>
        </div>
      </div>

      {(configError || saveState === 'error') && (
        <div className="admin-error-state" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{saveState === 'error' ? saveMessage : `Konfigurasi tersimpan belum dapat dimuat: ${getPublicContentErrorMessage(configError)}`}</span>
        </div>
      )}
      {saveState === 'success' && <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300" role="status"><CheckCircle2 className="h-4 w-4" />{saveMessage}</p>}
      {saveState === 'idle' && saveMessage && <p className="text-sm text-muted-foreground" role="status">{saveMessage}</p>}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader><SectionHeading icon={Type} title="Konten statis" description="Label dan ucapan di sini dapat diubah. Nama murid, tanggal, nominal, metode, dan nomor transaksi tidak disimpan dalam konfigurasi." /></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {CONTENT_FIELDS.map(([key, label]) => (
                <TextField key={key} id={`receipt-content-${key}`} label={label} value={draft.content[key]} onChange={(value) => updateSection('content', key, value)} multiline={['receiptTitle', 'officialReceiptTitle', 'footerText'].includes(key)} rows={2} />
              ))}
              <div className="sm:col-span-2 rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
                Ref/nomor transaksi tetap dicatat untuk log dan pelacakan internal, tetapi tidak tersedia sebagai elemen yang dapat ditampilkan di bukti pembayaran.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><SectionHeading icon={Eye} title="Komponen yang terlihat" description="Matikan komponen yang tidak ingin ditampilkan pada bukti. Nilai dinamis tetap dipertahankan di transaksi." /></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {VISIBILITY_LABELS.map(([key, label]) => (
                <ToggleRow key={key} id={`receipt-visibility-${key}`} label={label} checked={draft.visibility[key]} onCheckedChange={(checked) => updateVisibility(key, checked)} />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><SectionHeading icon={Building2} title="Identitas sekolah" description="Nilai ini disimpan kembali ke sumber Manajemen Konten Website agar dipakai konsisten oleh halaman publik, bukti, cetak, simpan, dan pengiriman." /></CardHeader>
            <CardContent className="space-y-4">
              {identityError && <div className="admin-error-state" role="alert"><AlertCircle className="h-4 w-4" /><span>{getPublicContentErrorMessage(identityError)}. Nilai cache/bawaan tetap dapat diedit.</span></div>}
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField id="receipt-identity-name" label="Nama sekolah" value={identity.name} onChange={(value) => setIdentity((current) => ({ ...current, name: value }))} />
                <TextField id="receipt-identity-short-name" label="Nama singkat" value={identity.shortName} onChange={(value) => setIdentity((current) => ({ ...current, shortName: value }))} />
                <TextField id="receipt-identity-phone" label="Kontak utama" value={identity.phone} onChange={(value) => setIdentity((current) => ({ ...current, phone: value }))} />
                <TextField id="receipt-identity-website" label="Situs web" value={identity.website} onChange={(value) => setIdentity((current) => ({ ...current, website: value }))} />
                <TextField id="receipt-identity-address" label="Alamat" value={identity.address} onChange={(value) => setIdentity((current) => ({ ...current, address: value }))} multiline rows={2} />
                <TextField id="receipt-identity-logo" label="URL logo" value={identity.logoUrl} onChange={(value) => setIdentity((current) => ({ ...current, logoUrl: value }))} hint="Kosongkan untuk memakai logo bawaan." />
              </div>
              <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3"><img src={logoPreview} alt="Preview logo sekolah" className="h-12 w-12 rounded-xl border object-contain" /><p className="text-xs text-muted-foreground">Sumber logo: <code>website_content.logoUrl</code></p></div>
                <Button type="button" variant="outline" onClick={handleSaveIdentity} disabled={identitySaveState === 'saving'}>
                  {identitySaveState === 'saving' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {identitySaveState === 'saving' ? 'Menyimpan…' : 'Simpan identitas'}
                </Button>
              </div>
              {identitySaveState === 'error' && <p className="text-sm text-destructive" role="alert">{identitySaveMessage}</p>}
              {identitySaveState === 'success' && <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300" role="status"><CheckCircle2 className="h-4 w-4" />{identitySaveMessage}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><SectionHeading icon={Receipt} title="Watermark LUNAS" description="Watermark ditempatkan pada rail sendiri di tengah bukti agar tidak menutup tanggal, penerima, nominal, divider, atau QR code." /></CardHeader>
            <CardContent className="space-y-4">
              <ToggleRow id="receipt-watermark-visible" label="Tampilkan watermark" checked={draft.watermark.visible && draft.visibility.watermark} onCheckedChange={(checked) => updateVisibility('watermark', checked)} />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField id="receipt-watermark-text" label="Teks watermark" value={draft.watermark.text} onChange={(value) => updateSection('watermark', 'text', value)} />
                <ColorField id="receipt-watermark-color" label="Warna watermark" value={draft.watermark.color} onChange={(value) => updateSection('watermark', 'color', value)} />
                <TextField id="receipt-watermark-opacity" label="Opacity (0,05–0,60)" type="number" min="0.05" max="0.6" step="0.05" value={draft.watermark.opacity} onChange={(value) => updateSection('watermark', 'opacity', value)} />
                <TextField id="receipt-watermark-font-size" label="Ukuran teks (px)" type="number" min="12" max="64" value={draft.watermark.fontSize} onChange={(value) => updateSection('watermark', 'fontSize', value)} />
                <TextField id="receipt-watermark-rotation" label="Rotasi (derajat)" type="number" min="-30" max="30" value={draft.watermark.rotation} onChange={(value) => updateSection('watermark', 'rotation', value)} />
                <TextField id="receipt-watermark-border" label="Ketebalan border (px)" type="number" min="1" max="8" value={draft.watermark.borderWidth} onChange={(value) => updateSection('watermark', 'borderWidth', value)} />
                <div className="space-y-2 sm:col-span-2"><Label>Posisi watermark</Label><Select value={draft.watermark.position} onValueChange={(value) => updateSection('watermark', 'position', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="left">Kiri</SelectItem><SelectItem value="center">Tengah</SelectItem><SelectItem value="right">Kanan</SelectItem></SelectContent></Select></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><SectionHeading icon={Palette} title="Gaya visual" description="Token dibatasi ke warna, font, radius, dan kepadatan yang aman agar konsisten di layar serta hasil cetak." /></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {COLOR_FIELDS.map(([key, label]) => <ColorField key={key} id={`receipt-visual-${key}`} label={label} value={draft.visual[key]} onChange={(value) => updateSection('visual', key, value)} />)}
                <div className="space-y-2"><Label>Tipografi</Label><Select value={draft.visual.fontFamily} onValueChange={(value) => updateSection('visual', 'fontFamily', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="system">Sans modern</SelectItem><SelectItem value="serif">Serif formal</SelectItem><SelectItem value="mono">Mono teknis</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Sudut permukaan</Label><Select value={draft.visual.radius} onValueChange={(value) => updateSection('visual', 'radius', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sm">Ringkas</SelectItem><SelectItem value="md">Sedang</SelectItem><SelectItem value="lg">Lembut</SelectItem></SelectContent></Select></div>
                <div className="space-y-2 sm:col-span-2"><Label>Kepadatan konten</Label><Select value={draft.visual.density} onValueChange={(value) => updateSection('visual', 'density', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="compact">Ringkas</SelectItem><SelectItem value="comfortable">Nyaman dibaca</SelectItem></SelectContent></Select></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><SectionHeading icon={QrCode} title="QR code" description="Ukuran QR mengubah tampilan saja. Isi QR tetap dibuat dari URL verifikasi transaksi dinamis oleh sistem." /></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <TextField id="receipt-qr-size" label="Ukuran QR (px)" type="number" min="48" max="180" value={draft.qr.size} onChange={(value) => updateSection('qr', 'size', value)} />
              <div className="space-y-2"><Label>Posisi QR</Label><Select value={draft.qr.position} onValueChange={(value) => updateSection('qr', 'position', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="left">Kiri</SelectItem><SelectItem value="center">Tengah</SelectItem><SelectItem value="right">Kanan</SelectItem></SelectContent></Select></div>
              <div className="sm:col-span-2"><ToggleRow id="receipt-qr-visible" label="Tampilkan QR code" checked={draft.visibility.qr && draft.qr.visible} onCheckedChange={(checked) => updateVisibility('qr', checked)} /></div>
            </CardContent>
          </Card>
        </div>

        <Card className="xl:sticky xl:top-4">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div><CardTitle className="flex items-center gap-2 text-xl"><SlidersHorizontal className="h-5 w-5 text-primary" /> Preview langsung</CardTitle><CardDescription className="mt-2">Perubahan draft langsung terlihat di sini sebelum disimpan.</CardDescription></div>
              <div className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">LIVE</div>
            </div>
          </CardHeader>
          <CardContent><PaymentReceiptLivePreview config={previewConfig} identity={identity} logoUrl={logoPreview} qrUrl={qrPreview} /></CardContent>
        </Card>
      </div>
    </section>
  );
};

export default PaymentReceiptEditor;
