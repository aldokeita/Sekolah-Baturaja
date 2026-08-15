
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import QRCode from 'qrcode';
import { Search, Printer, Book, Wallet, Shirt, WalletCards as IdCard, BookOpen, X, Trash2, Briefcase, MessageSquare, ScanLine, Edit, Users, Check, Banknote, Loader2, AlertTriangle, Building, RotateCcw, Plus, Minus, ShoppingCart, Download, FileText, Settings, Save } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toPng } from 'html-to-image';
import {
  MONTH_NAMES,
  createPaymentsBatch,
  deletePaymentsBulk,
  checkPaymentDuplicates,
  fetchAllPayments,
  fetchAllSantri,
  getPaymentErrorMessage,
  getSharedDefaultSppAmount,
  monthNameToNumber,
  monthNumberToName,
  deletePaymentItemSetting,
  fetchPaymentItemSettings,
  parsePaymentItemAmount,
  PAYMENT_ITEM_SETTING_KEYS,
  savePaymentItemSetting,
  selectedMonthToNumber,
  validatePaymentAmount,
  validatePaymentItemAmount,
} from '@/lib/paymentAdapters';
import { getLocalDateString } from '@/lib/financeAdapters';
import { fetchReceiptLogoDataUrl, waitForImagesToLoad } from '@/lib/publicContentAdapters';
import { DEFAULT_LOGO_PATH } from '@/lib/schoolAssets';
import { resolveAvatarUrl } from '@/lib/storageAdapters';
import PaymentProofModal from './PaymentProofModal';
import PaymentReceiptWatermark from './PaymentReceiptWatermark';
import { fetchWhatsAppTemplates, renderWhatsAppTemplate } from '@/lib/whatsappTemplateAdapters';
import { getSchoolIdentity } from '@/lib/schoolIdentity';
import useSchoolIdentity from '@/hooks/useSchoolIdentity';
import usePaymentReceiptConfiguration from '@/hooks/usePaymentReceiptConfiguration';
import { formatPaymentStatus, getPaymentReceiptReference, isPaymentPaid, normalizePaymentStatus, normalizeWhatsAppPhone } from '@/lib/paymentReceipt';

const paymentItems = [
  { key: 'spp', name: 'SPP Bulanan', amount: 0, monthly: true, icon: Wallet, custom: 'spp_dropdown' },
  { key: 'sarpras', name: 'Sarpras', amount: 0, monthly: false, icon: Building },
  { key: 'seragam', name: 'Seragam', amount: 0, monthly: false, icon: Shirt },
  { key: 'tas_murid', name: 'Tas Murid', amount: 0, monthly: false, icon: Briefcase },
  { key: 'id_card_murid', name: 'ID Card Murid', amount: 0, monthly: false, icon: IdCard },
  { key: 'buku_paket', name: 'Buku Paket', amount: 0, monthly: false, icon: Book },
  { key: 'lks', name: 'LKS', amount: 0, monthly: false, icon: BookOpen },
  { key: 'custom', name: 'Custom', amount: 0, monthly: false, icon: Edit, custom: 'item' },
];
const monthsList = MONTH_NAMES;
const sppOptions = [50000, 70000, 100000, 120000, 150000];

const SantriSelectorModal = ({ santriList, onSelect, open, onOpenChange, selectedSantriIds }) => {
  const [search, setSearch] = useState('');
  const sortedSantri = [...santriList].sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap));
  const filteredSantri = sortedSantri.filter(s => s.nama_lengkap.toLowerCase().includes(search.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader><DialogTitle>Pilih Murid</DialogTitle><DialogDescription>Cari dan klik pada murid untuk memilih. Anda bisa memilih lebih dari satu.</DialogDescription></DialogHeader>
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><Input placeholder="Cari nama murid..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" /></div>
        <div className="flex-grow overflow-y-auto p-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {filteredSantri.map(santri => (
              <div key={santri.id} onClick={() => onSelect(santri)} className={`relative flex flex-col items-center text-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer border-2 ${selectedSantriIds.has(santri.id) ? 'border-primary' : 'border-transparent'}`}>
                {selectedSantriIds.has(santri.id) && <div className="absolute top-1 right-1 bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center"><Check className="w-3 h-3"/></div>}
                <Avatar className="w-20 h-20 mb-2"><AvatarImage src={santri.foto_url} /><AvatarFallback>{santri.nama_lengkap.charAt(0)}</AvatarFallback></Avatar>
                {/* Badge kategori dicabut: SD negeri hanya punya satu jenis murid,
                    dan labelnya memetakan 'Anak' menjadi "TPQ". */}
                <p className="text-sm font-medium leading-tight">{santri.nama_lengkap}</p>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Selesai</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const MonthSelectorDialog = ({ open, onOpenChange, item, onConfirm, initialYear, initialMonths, resetKey, selectedSantri }) => {
    const [selectedYear, setSelectedYear] = useState(initialYear || new Date().getFullYear());
    const [selectedMonths, setSelectedMonths] = useState(initialMonths || []);
    const [customAmount, setCustomAmount] = useState(item?.amount || 0);
    const [selectedSppOption, setSelectedSppOption] = useState('50000');
    const [isProcessing, setIsProcessing] = useState(false);
    const availableYears = [2027, 2026, 2025, 2024, 2023];

    useEffect(() => {
        if(open) {
             setSelectedYear(initialYear || new Date().getFullYear());
             setSelectedMonths(initialMonths || []);
             setIsProcessing(false);
              if (item?.custom === 'spp_dropdown') {
                  const sharedDefaultAmount = getSharedDefaultSppAmount(selectedSantri);
                  const initialAmt = item.amount || sharedDefaultAmount || 0;
                  if (sppOptions.includes(initialAmt)) {
                     setSelectedSppOption(initialAmt.toString());
                     setCustomAmount(initialAmt);
                  } else if (initialAmt >= 10000) {
                      setSelectedSppOption('custom');
                      setCustomAmount(initialAmt);
                  } else {
                      setSelectedSppOption('');
                      setCustomAmount(0);
                 }
             } else {
                 setCustomAmount(item?.amount || 0);
             }
        }
    }, [open, initialYear, initialMonths, item, resetKey, selectedSantri]);

    const toggleMonth = (month) => {
        setSelectedMonths(prev =>
            prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month]
        );
    };

    const handleSppOptionChange = (val) => {
        setSelectedSppOption(val);
        if (val !== 'custom') {
            setCustomAmount(parseInt(val));
        } else {
            setCustomAmount(0);
        }
    };

    const handleConfirm = async () => {
        if(selectedMonths.length === 0) {
            toast({title: "Pilih Bulan", description: "Minimal pilih satu bulan tagihan.", variant: "destructive"});
            return;
        }
        let finalAmount = item.amount;
        if (item?.custom === 'spp' || (item?.custom === 'spp_dropdown')) {
             if (customAmount < 10000) {
                 toast({title: "Nominal Salah", description: "Masukkan nominal yang valid (min 10.000).", variant: "destructive"});
                 return;
             }
             finalAmount = customAmount;
        }
        setIsProcessing(true);
        await onConfirm({ year: selectedYear, months: selectedMonths, amount: finalAmount });
        setIsProcessing(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Pilih Periode Tagihan</DialogTitle><DialogDescription>Pilih Bulan dan Tahun Tagihan untuk {item?.name}</DialogDescription></DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="flex items-center justify-between"><label className="text-sm font-medium">Tahun Tagihan</label><Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(Number(val))}><SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger><SelectContent>{availableYears.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent></Select></div>
                    <div><label className="text-sm font-medium mb-2 block">Bulan Tagihan</label><div className="grid grid-cols-3 gap-2">{monthsList.map(month => (<Button key={month} variant={selectedMonths.includes(month) ? "default" : "outline"} size="sm" onClick={() => toggleMonth(month)} className={cn("w-full justify-start px-2", selectedMonths.includes(month) && "bg-primary text-white hover:bg-primary/90")}>{selectedMonths.includes(month) && <Check className="w-3 h-3 mr-1"/>}{month}</Button>))}</div></div>
                    {item?.custom === 'spp_dropdown' && (<div className="space-y-2"><label className="text-sm font-medium block">Nominal SPP</label><p className="text-xs text-muted-foreground">{getSharedDefaultSppAmount(selectedSantri) ? 'Nominal otomatis mengikuti default SPP murid. Admin tetap dapat menggantinya.' : 'Default SPP belum sama atau belum diatur. Pilih nominal untuk transaksi ini.'}</p><div className="grid grid-cols-3 gap-2">{sppOptions.map(opt => (<Button key={opt} variant={selectedSppOption === opt.toString() ? "default" : "outline"} size="sm" onClick={() => handleSppOptionChange(opt.toString())} className={cn(selectedSppOption === opt.toString() && "bg-primary hover:bg-primary/90 text-white")}>{(opt / 1000)}k</Button>))}<Button variant={selectedSppOption === 'custom' ? "default" : "outline"} size="sm" onClick={() => handleSppOptionChange('custom')} className={cn(selectedSppOption === 'custom' && "bg-primary hover:bg-primary/90 text-white")}>Custom</Button></div>{selectedSppOption === 'custom' && (<Input type="number" min="10000" step="1000" value={customAmount || ''} onChange={(e) => setCustomAmount(Number(e.target.value))} placeholder="Masukkan nominal..." className="mt-2"/>)}</div>)}
                    {item?.custom === 'spp' && (<div><label className="text-sm font-medium mb-1 block">Nominal per Bulan</label><Input type="number" value={customAmount} onChange={(e) => setCustomAmount(Number(e.target.value))} placeholder="Contoh: 120000" /></div>)}
                    <div className="pt-4 border-t flex justify-between items-center"><span className="text-sm text-muted-foreground">{selectedMonths.length} Bulan dipilih</span><span className="font-bold text-lg">Total: Rp {((item?.custom === 'spp' || item?.custom === 'spp_dropdown' ? customAmount : item?.amount || 0) * selectedMonths.length).toLocaleString('id-ID')}</span></div>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>Batal</Button><Button onClick={handleConfirm} disabled={isProcessing}>{isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : 'Simpan'}</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const PaymentItemAmountDialog = ({
    open,
    onOpenChange,
    items,
    amounts,
    focusKey,
    isLoading,
    savingKey,
    onSave,
    onReset,
}) => {
    const [drafts, setDrafts] = useState({});
    const wasOpenRef = useRef(false);
    const configurableItems = useMemo(
        () => items.filter((item) => PAYMENT_ITEM_SETTING_KEYS.includes(item.key)),
        [items],
    );

    useEffect(() => {
        if (open && !wasOpenRef.current) {
            setDrafts(configurableItems.reduce((result, item) => {
                result[item.key] = amounts[item.key] ?? '';
                return result;
            }, {}));
        }
        wasOpenRef.current = open;
    }, [open, amounts, configurableItems]);

    const handleDraftChange = (itemKey, value) => {
        setDrafts((current) => ({ ...current, [itemKey]: value }));
    };

    const handleReset = async (itemKey) => {
        const wasReset = await onReset(itemKey);
        if (wasReset) {
            setDrafts((current) => ({ ...current, [itemKey]: '' }));
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Atur Nominal Item Pembayaran</DialogTitle>
                    <DialogDescription>
                        Simpan nominal setiap item secara terpisah. Perubahan satu item tidak mengubah item lainnya.
                    </DialogDescription>
                </DialogHeader>

                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">
                    SPP Bulanan tidak diatur di sini. Nominal SPP tetap mengikuti pengaturan SPP khusus pada saat memilih periode tagihan, sedangkan item Custom tetap diisi langsung per transaksi.
                </div>

                {isLoading ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">Memuat nominal item...</div>
                ) : (
                    <div className="space-y-3 py-2">
                        {configurableItems.map((item) => {
                            const ItemIcon = item.icon;
                            const savedAmount = amounts[item.key];
                            const isSaving = savingKey === item.key;
                            return (
                                <div
                                    key={item.key}
                                    className={cn(
                                        'rounded-lg border p-3 transition-colors',
                                        focusKey === item.key && 'border-primary bg-primary/5 ring-1 ring-primary/30',
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <ItemIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                                            <div className="min-w-0">
                                                <p className="font-medium">{item.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {savedAmount ? `Tersimpan: Rp${savedAmount.toLocaleString('id-ID')}` : 'Belum diatur'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2">
                                            <Input
                                                type="number"
                                                min="1"
                                                step="1000"
                                                value={drafts[item.key] ?? ''}
                                                onChange={(event) => handleDraftChange(item.key, event.target.value)}
                                                placeholder="Nominal"
                                                className="h-9 w-32 text-right"
                                                aria-label={`Nominal ${item.name}`}
                                            />
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={() => onSave(item.key, drafts[item.key])}
                                                disabled={isSaving}
                                            >
                                                {isSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                                                Simpan
                                            </Button>
                                            {savedAmount && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleReset(item.key)}
                                                    disabled={isSaving}
                                                    className="text-muted-foreground"
                                                >
                                                    Reset
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const DeleteConfirmationDialog = ({ open, onOpenChange, onConfirm, count }) => (
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle className="w-5 h-5"/> Konfirmasi Hapus</DialogTitle><DialogDescription>Anda akan menghapus <strong>{count}</strong> riwayat pembayaran. Tindakan ini tidak dapat dibatalkan. Apakah Anda yakin?</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button><Button variant="destructive" onClick={() => { onConfirm(); onOpenChange(false); }}>Ya, Hapus Permanen</Button></DialogFooter></DialogContent></Dialog>
);

const DuplicatePaymentDialog = ({ open, onOpenChange, onResetMonth }) => (
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle className="flex items-center gap-2 text-yellow-600"><AlertTriangle className="w-5 h-5"/> Pembayaran Sudah Ada</DialogTitle><DialogDescription className="pt-2">Pembayaran untuk bulan ini sudah ada. Mohon periksa kembali.</DialogDescription></DialogHeader><DialogFooter className="flex gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button><Button onClick={() => { onOpenChange(false); onResetMonth(); }}>Ubah Bulan</Button></DialogFooter></DialogContent></Dialog>
);

const PaymentSystem = () => {
  const sekolah = useSchoolIdentity();
  const { config: receiptConfig } = usePaymentReceiptConfiguration();
  const receiptContent = receiptConfig.content;
  const receiptVisibility = receiptConfig.visibility;
  const receiptVisual = receiptConfig.visual;
  const receiptFontFamily = {
    system: 'inherit',
    sans: 'Archivo, ui-sans-serif, system-ui, sans-serif',
    serif: 'Georgia, Cambria, serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  }[receiptVisual.fontFamily] || 'inherit';
  const receiptRadius = { sm: '0.75rem', md: '1rem', lg: '1.5rem' }[receiptVisual.radius] || '1rem';
  const receiptDensityClass = receiptVisual.density === 'compact' ? 'p-3' : 'p-4';
  const [santriList, setSantriList] = useState([]);
  const [selectedSantri, setSelectedSantri] = useState([]);
  const [cart, setCart] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [isSantriSelectorOpen, setIsSantriSelectorOpen] = useState(false);
  const [rfidScan, setRfidScan] = useState('');
  const rfidInputRef = useRef(null);
  const receiptRef = useRef(null);
  const [qrCodeDataURL, setQrCodeDataURL] = useState('');
  const [historyFilter, setHistoryFilter] = useState({ year: 'all', month: 'all', status: 'all' });
  const [selectedHistory, setSelectedHistory] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('Tunai');
  const availableYears = [2027, 2026, 2025, 2024, 2023];
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [configItem, setConfigItem] = useState(null);
  const [editingCartId, setEditingCartId] = useState(null);
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isPaymentMarkedPaid, setIsPaymentMarkedPaid] = useState(true);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isSendingReceiptWhatsApp, setIsSendingReceiptWhatsApp] = useState(false);
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false);
  const [receiptLogoUrl, setReceiptLogoUrl] = useState(DEFAULT_LOGO_PATH);
  const [historyProofPayment, setHistoryProofPayment] = useState(null);
  const [paymentItemAmounts, setPaymentItemAmounts] = useState({});
  const [isAmountSettingsOpen, setIsAmountSettingsOpen] = useState(false);
  const [amountSettingsFocusKey, setAmountSettingsFocusKey] = useState(null);
  const [amountSettingsLoading, setAmountSettingsLoading] = useState(true);
  const [amountSettingsSavingKey, setAmountSettingsSavingKey] = useState(null);

  const paymentItemsWithAmounts = useMemo(() => paymentItems.map((item) => ({
    ...item,
    amount: item.key && !item.monthly && !item.custom
      ? paymentItemAmounts[item.key] ?? 0
      : item.amount,
  })), [paymentItemAmounts]);

  const location = useLocation();

  useEffect(() => {
    let active = true;

    const fetchSantri = async () => {
      try {
        // Every active santri is selectable here, so walk all pages.
        const data = await fetchAllSantri({ status: 'Aktif', order: 'nama_lengkap' });
        const santriWithAvatars = await Promise.all((data || []).map(async (santri) => ({
          ...santri,
          foto_url: await resolveAvatarUrl({
            ownerType: 'santri',
            ownerId: santri.id,
            avatarPath: santri.avatar_path,
            fallbackUrl: santri.foto_url,
          }),
        })));
        if (active) setSantriList(santriWithAvatars);
      } catch {
        toast({ title: "Error", description: "Gagal memuat data murid.", variant: "destructive" });
      }
    };
    fetchSantri();
    if (rfidInputRef.current) {
        rfidInputRef.current.focus();
    }
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setAmountSettingsLoading(true);
    fetchPaymentItemSettings()
      .then((settings) => {
        if (active) setPaymentItemAmounts(settings);
      })
      .catch(() => {
        if (active) {
          toast({ title: 'Nominal item belum dimuat', description: 'Pengaturan nominal dapat dicoba lagi setelah koneksi tersedia.', variant: 'destructive' });
        }
      })
      .finally(() => {
        if (active) setAmountSettingsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (santriList.length > 0 && location.state?.santriId) {
       const santriToSelect = santriList.find(s => s.id === location.state.santriId);
       if (santriToSelect && !selectedSantri.some(s => s.id === santriToSelect.id)) {
           setSelectedSantri([santriToSelect]);
           loadPaymentHistory(santriToSelect.id);
           setHistoryFilter({ year: 'all', month: 'all', status: 'all' });
       }
    }
  }, [santriList, location.state]);

  useEffect(() => {
    const filtered = paymentHistory.filter(p => {
        const billingYear = p.tahun || new Date(p.tanggal_pembayaran).getFullYear();
        const billingMonthIndex = p.bulan ? Number(p.bulan) - 1 : new Date(p.tanggal_pembayaran).getMonth();
        return (historyFilter.year === 'all' || billingYear === historyFilter.year)
          && (historyFilter.month === 'all' || billingMonthIndex === historyFilter.month)
          && (historyFilter.status === 'all' || normalizePaymentStatus(p.status) === historyFilter.status);
    });
    setFilteredHistory(filtered);
  }, [paymentHistory, historyFilter]);

  useEffect(() => {
    if (isReceiptOpen && receiptData?.qrCodeUrl) {
        QRCode.toDataURL(receiptData.qrCodeUrl, { width: 120, margin: 1 }, (err, url) => {
            if (!err) setQrCodeDataURL(url);
        });
    }
  }, [isReceiptOpen, receiptData]);

  useEffect(() => {
    let active = true;
    const loadReceiptLogo = async () => {
      if (!isReceiptOpen) return;
      const logoUrl = await fetchReceiptLogoDataUrl(DEFAULT_LOGO_PATH);
      if (active) setReceiptLogoUrl(logoUrl);
    };
    loadReceiptLogo();
    return () => {
      active = false;
    };
  }, [isReceiptOpen]);

  const handleRfidScan = (e) => {
    e.preventDefault();
    if(!rfidScan) return;
    const foundSantri = santriList.find(s => s.rfid_tag === rfidScan);
    if(foundSantri) {
        handleSantriSelect(foundSantri);
        toast({ title: "Murid Ditemukan!", description: `Murid ${foundSantri.nama_lengkap} (${foundSantri.kategori}) ditambahkan.`});
    } else {
        toast({ title: "RFID tidak ditemukan", description: "Pastikan kartu terdaftar.", variant: "destructive"});
    }
    setRfidScan('');
  }

  const handleSantriSelect = (santri) => {
    setSelectedSantri(prev => {
        const isSelected = prev.some(s => s.id === santri.id);
        if (isSelected) return prev.filter(s => s.id !== santri.id);
        return [...prev, santri];
    });
    if (selectedSantri.length === 0 || !selectedSantri.some(s => s.id === santri.id)) {
        loadPaymentHistory(santri.id);
        setHistoryFilter({ year: 'all', month: 'all', status: 'all' });
    }
  };

  const loadPaymentHistory = async (santriId) => {
    try {
      const data = await fetchAllPayments({ santri_id: santriId });
      // The endpoint orders by created_at; this panel shows newest payment date first.
      setPaymentHistory([...data].sort((a, b) => (
        new Date(b.tanggal_pembayaran || 0) - new Date(a.tanggal_pembayaran || 0)
      )));
    } catch {
      toast({ title: "Error", description: "Gagal memuat riwayat pembayaran.", variant: "destructive" });
    }
  };

  const openAmountSettings = (itemKey = null) => {
    setAmountSettingsFocusKey(itemKey);
    setIsAmountSettingsOpen(true);
  };

  const handleSavePaymentItemAmount = async (itemKey, value) => {
    if (!validatePaymentItemAmount(value)) {
      toast({ title: 'Nominal tidak valid', description: 'Masukkan nominal item yang lebih besar dari nol.', variant: 'destructive' });
      return;
    }

    setAmountSettingsSavingKey(itemKey);
    try {
      const saved = await savePaymentItemSetting(itemKey, parsePaymentItemAmount(value));
      setPaymentItemAmounts((current) => ({ ...current, [itemKey]: saved.amount }));
      toast({ title: 'Nominal tersimpan', description: 'Nominal item pembayaran berhasil disimpan.' });
    } catch (error) {
      toast({ title: 'Gagal menyimpan nominal', description: getPaymentErrorMessage(error), variant: 'destructive' });
    } finally {
      setAmountSettingsSavingKey(null);
    }
  };

  const handleResetPaymentItemAmount = async (itemKey) => {
    setAmountSettingsSavingKey(itemKey);
    try {
      await deletePaymentItemSetting(itemKey);
      setPaymentItemAmounts((current) => {
        const next = { ...current };
        delete next[itemKey];
        return next;
      });
      toast({ title: 'Nominal direset', description: 'Item perlu diberi nominal lagi sebelum dapat ditambahkan ke pembayaran.' });
      return true;
    } catch (error) {
      toast({ title: 'Gagal mereset nominal', description: getPaymentErrorMessage(error), variant: 'destructive' });
      return false;
    } finally {
      setAmountSettingsSavingKey(null);
    }
  };

  const initiateAddToCart = (item) => {
    if (item.monthly) {
      setConfigItem(item);
      setEditingCartId(null);
      setIsConfigOpen(true);
      return;
    }
    if (!item.custom && !validatePaymentItemAmount(item.amount)) {
      openAmountSettings(item.key);
      toast({ title: 'Nominal belum diatur', description: `Atur nominal ${item.name} terlebih dahulu.` });
      return;
    }
    addToCart(item);
  };

  const checkDuplicates = async (config) => {
      if (selectedSantri.length === 0) return false;
      const santriIds = selectedSantri.map(s => s.id);
      const monthNumbers = config.months.map(monthNameToNumber).filter(Boolean);
      try {
        return await checkPaymentDuplicates({
          santriIds,
          months: monthNumbers,
          year: config.year,
        });
      } catch {
        toast({ title: "Error", description: "Gagal memeriksa duplikasi pembayaran.", variant: "destructive" });
        return false;
      }
  };

  const addToCart = async (item, config = null) => {
    if (!config && !item.monthly && !item.custom && !validatePaymentItemAmount(item.amount)) {
      openAmountSettings(item.key);
      return;
    }
    if (config) {
        const isDuplicate = await checkDuplicates(config);
        if (isDuplicate) {
            toast({ title: "Duplikat Terdeteksi", description: "Pembayaran untuk bulan ini sudah ada.", variant: "destructive" });
            setIsConfigOpen(false); setIsDuplicateDialogOpen(true); return;
        }
        const cartItem = { ...item, cartId: editingCartId || Date.now(), amount: config.amount, months: config.months, year: config.year, quantity: 1 };
        if(editingCartId) { setCart(prev => prev.map(i => i.cartId === editingCartId ? cartItem : i)); setEditingCartId(null); } else { setCart(prev => [...prev, cartItem]); }
        setIsConfigOpen(false);
    } else {
        const existingItem = cart.find(cartItem => cartItem.name === item.name && !item.custom && !item.monthly && !item.hasSubtypes);
        if (existingItem) { updateCartItem(existingItem.cartId, { quantity: (existingItem.quantity || 1) + 1 }); } else { const cartItem = { ...item, cartId: Date.now(), amount: item.amount || 0, quantity: 1 }; setCart(prev => [...prev, cartItem]); }
    }
  };

  const editCartItem = (item) => {
      if(item.monthly) { setConfigItem(item); setEditingCartId(item.cartId); setIsConfigOpen(true); }
  };
  const removeFromCart = (cartId) => setCart(prev => prev.filter(item => item.cartId !== cartId));
  const updateCartItem = (cartId, updates) => setCart(prev => prev.map(item => item.cartId === cartId ? { ...item, ...updates } : item));

  const handlePayment = async () => {
    if (isProcessingPayment) return;
    if (selectedSantri.length === 0 || cart.length === 0) return toast({ title: "Error", description: "Pilih murid dan tambahkan item pembayaran.", variant: "destructive" });
    const paymentStatus = isPaymentMarkedPaid ? 'paid' : 'unpaid';
    setIsProcessingPayment(true);
    try {
        let newPayments = [];

        for (const santri of selectedSantri) {
            for (const item of cart) {
                if (item.monthly) {
                    if(!item.months || item.months.length === 0) throw new Error("Data bulan tagihan SPP tidak valid.");
                    for (const month of item.months) {
                         const monthNumber = monthNameToNumber(month);
                         if (!monthNumber) throw new Error("Bulan tagihan tidak valid.");
                         if (!validatePaymentAmount(item.amount)) throw new Error("Nominal pembayaran tidak valid.");
                         newPayments.push({
                            santri_id: santri.id,
                            transaction_id: crypto.randomUUID(),
                            bulan: monthNumber,
                            tahun: item.year,
                            jumlah: Number(item.amount),
                            tanggal_pembayaran: getLocalDateString(),
                            status: paymentStatus,
                            catatan: `${item.name} (${month} ${item.year})`,
                            metode_pembayaran: paymentMethod
                         });
                    }
                } else {
                    if (item.hasSubtypes && !item.subtype) throw new Error("Pilih volume buku jilid.");
                    if (item.custom === 'item' && (!item.name || !item.amount)) throw new Error("Untuk item Custom, nama dan jumlah harus diisi.");
                    if (!validatePaymentAmount(item.amount * item.quantity)) throw new Error("Nominal pembayaran tidak valid.");
                    const paymentType = item.custom === 'item' ? item.name : (item.hasSubtypes ? `${item.name} - ${item.subtype}` : item.name);
                    newPayments.push({
                      santri_id: santri.id,
                      transaction_id: crypto.randomUUID(),
                      bulan: null,
                      tahun: null,
                      jumlah: Number(item.amount * item.quantity),
                      tanggal_pembayaran: getLocalDateString(),
                      status: paymentStatus,
                      catatan: `${paymentType} (Qty: ${item.quantity})`,
                      metode_pembayaran: paymentMethod
                    });
                }
            }
        }
        if (newPayments.length === 0) throw new Error("Tidak ada pembayaran yang dapat diproses.");
        const data = await createPaymentsBatch(newPayments);
        if (!Array.isArray(data) || data.length !== newPayments.length || data.some((payment) => normalizePaymentStatus(payment?.status) !== paymentStatus)) {
          throw new Error("Konfirmasi pembayaran tidak lengkap. Tidak ada bukti yang dibuat.");
        }
        if (selectedSantri.length === 1) loadPaymentHistory(selectedSantri[0].id);

        let totalAmount = 0;
        for (const item of cart) { if (item.monthly) { totalAmount += (item.amount * item.months.length); } else { totalAmount += (item.amount * item.quantity); } }
        totalAmount = totalAmount * selectedSantri.length;
        const qrCodeLoginUrl = `${window.location.origin}/login`;
        const transactionIds = data.map((payment) => getPaymentReceiptReference(payment)).filter((reference) => reference !== '-');
        setReceiptData({
          items: cart,
          total: totalAmount,
          santri: selectedSantri,
          qrCodeUrl: qrCodeLoginUrl,
          timestamp: new Date(),
          method: paymentMethod,
          status: paymentStatus,
          transactionId: getPaymentReceiptReference(data[0]),
          transactionIds,
          paymentId: data[0]?.id,
        });
        toast({
          title: isPaymentMarkedPaid ? "Pembayaran Berhasil!" : "Transaksi Tersimpan",
          description: isPaymentMarkedPaid
            ? `Pembayaran untuk ${selectedSantri.length} murid telah dikonfirmasi dan bukti siap digunakan.`
            : `Transaksi untuk ${selectedSantri.length} murid tersimpan dengan status Belum Lunas.`,
        });
        setIsReceiptOpen(true);
        setCart([]);
    } catch (error) {
        toast({ title: "Pembayaran Gagal!", description: getPaymentErrorMessage(error), variant: "destructive" });
    } finally {
        setIsProcessingPayment(false);
    }
  };

  const handleDeleteHistory = async () => {
    try {
      await deletePaymentsBulk(selectedHistory);
      toast({ title: 'Riwayat Dihapus', description: `${selectedHistory.length} data pembayaran telah berhasil dihapus.` });
      if (selectedSantri.length === 1) loadPaymentHistory(selectedSantri[0].id);
      setSelectedHistory([]);
    } catch (err) {
      toast({ title: 'Gagal Menghapus', description: getPaymentErrorMessage(err), variant: 'destructive' });
    }
  };

  const confirmDelete = () => { if (selectedHistory.length === 0) return; setDeleteConfirmOpen(true); }
  const handleSelectHistory = (id) => { setSelectedHistory(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]); };
  const handlePrint = () => {
    if (!receiptData || !receiptRef.current) {
      toast({ title: 'Gagal Mencetak', description: 'Bukti pembayaran belum siap.', variant: 'destructive' });
      return;
    }
    setIsPrintingReceipt(true);
    window.setTimeout(() => {
      try {
        window.print();
        toast({ title: 'Dialog Cetak Dibuka', description: 'Pilih printer atau simpan sebagai PDF dari dialog cetak.' });
      } catch (error) {
        toast({ title: 'Gagal Mencetak', description: error?.message || 'Dialog cetak tidak dapat dibuka.', variant: 'destructive' });
      } finally {
        setIsPrintingReceipt(false);
      }
    }, 0);
  };

  const savePaymentProof = async () => {
    if (!receiptData || !receiptRef.current) return;
    setIsSaving(true);
    try {
      toast({ title: "Memproses...", description: "Sedang membuat gambar bukti pembayaran." });
      await waitForImagesToLoad(receiptRef.current);

      const dataUrl = await toPng(receiptRef.current, {
        cacheBust: true,
        backgroundColor: receiptVisual.backgroundColor,
        pixelRatio: 2,
        imagePlaceholder: DEFAULT_LOGO_PATH,
      });

      const link = document.createElement('a');
      const santriName = receiptData.santri && receiptData.santri.length > 0 ? receiptData.santri[0].nama_lengkap.replace(/\s+/g, '_') : 'Murid';
      const dateStr = new Date().toLocaleDateString('id-ID').replace(/\//g, '-');
      link.download = `Bukti_Pembayaran_${santriName}_${dateStr}.png`;
      link.href = dataUrl;
      link.click();

      toast({ title: "Berhasil!", description: "Bukti pembayaran berhasil disimpan." });
    } catch (err) {
      toast({ title: "Gagal", description: `Gagal membuat gambar bukti pembayaran: ${err?.message || 'gambar tidak dapat diproses.'}`, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!receiptData || !receiptData.santri?.length) return;
    const santriWithPhone = receiptData.santri.find(s => String(s.no_hp_ortu || '').trim());
    if (!santriWithPhone) { toast({ title: "Gagal", description: "Tidak ada nomor HP wali murid yang ditemukan.", variant: "destructive" }); return; }
    const phoneNumber = normalizeWhatsAppPhone(santriWithPhone.no_hp_ortu);
    if (!phoneNumber) { toast({ title: "Gagal", description: "Format nomor HP wali murid tidak valid.", variant: "destructive" }); return; }

    const popup = window.open('about:blank', '_blank');
    if (!popup) {
      toast({ title: 'WhatsApp Tidak Dapat Dibuka', description: 'Izinkan pop-up pada browser, lalu coba lagi.', variant: 'destructive' });
      return;
    }

    setIsSendingReceiptWhatsApp(true);
    try {
      const itemsText = receiptData.items.map(item => {
          let name = item.name;
          let subTotal = 0;
          if (item.monthly) { name += ` (${item.months.join(', ')} ${item.year})`; subTotal = item.amount * item.months.length; }
          else { if(item.custom === 'item') name = item.name; else if (item.hasSubtypes) name = `${item.name} ${item.subtype}`; subTotal = item.amount * item.quantity; }
          return `- ${name}: Rp${subTotal.toLocaleString('id-ID')}`;
      }).join('\n');

      const santriNames = receiptData.santri.map(s => s.nama_lengkap).join(', ');
      const totalAmount = receiptData.total;
      const templates = await fetchWhatsAppTemplates();
      const message = renderWhatsAppTemplate(templates.paymentReceipt, {
        nama_santri: santriNames,
        nomor_induk: santriWithPhone.nomor_induk || '-',
        rincian: itemsText,
        nominal: `Rp ${totalAmount.toLocaleString('id-ID')}`,
        tanggal: receiptData.timestamp.toLocaleDateString('id-ID'),
        periode: receiptData.items.filter((item) => item.monthly).flatMap((item) => item.months || []).join(', ') || '-',
        metode: receiptData.method,
        transaction_id: receiptData.transactionIds?.join(', ') || receiptData.transactionId || '-',
        status: isPaymentPaid(receiptData.status) ? receiptContent.paidStatusText : receiptContent.unpaidStatusText,
        label_tanggal: receiptContent.dateLabel,
        label_jam: receiptContent.timeLabel,
        label_metode: receiptContent.methodLabel,
        label_status: receiptContent.statusLabel,
        label_penerima: receiptContent.recipientLabel,
        label_item: receiptContent.itemLabel,
        label_nominal: receiptContent.amountLabel,
        label_periode: receiptContent.periodLabel,
        label_total: receiptContent.totalLabel,
        judul_bukti: receiptContent.receiptTitle,
        footer_text: receiptContent.footerText,
        nama_lembaga: getSchoolIdentity().name,
      });
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
      popup.location.href = whatsappUrl;
      toast({ title: 'WhatsApp Siap Digunakan', description: 'Pesan bukti pembayaran telah disiapkan untuk wali murid.' });
    } catch (error) {
      popup.close();
      toast({ title: 'Gagal Menyiapkan WhatsApp', description: error?.message || 'Pesan bukti pembayaran tidak dapat disiapkan.', variant: 'destructive' });
    } finally {
      setIsSendingReceiptWhatsApp(false);
    }
  };

  const totalCart = cart.reduce((sum, item) => { if(item.monthly) return sum + (item.amount * item.months.length); return sum + ((item.amount || 0) * item.quantity); }, 0);

  return (
    <>
      <style>{`@media print { body * { visibility: hidden; } #receipt-content, #receipt-content * { visibility: visible; } #receipt-content { position: absolute; left: 0; top: 0; width: 100%; } }`}</style>
      <div className="space-y-6">
        <div className="admin-panel-header">
            <div className="flex items-center gap-3">
                <div className="admin-panel-header-icon">
                    <Wallet />
                </div>
                <div className="admin-panel-header-text">
                    <h2>Sistem Pembayaran</h2>
                    <p>Proses pembayaran murid dengan scan RFID atau pilih manual.</p>
                </div>
            </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="w-full md:w-1/3 space-y-6">
                 <div className="space-y-4">
                    <form onSubmit={handleRfidScan} className="relative">
                        <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input ref={rfidInputRef} value={rfidScan} onChange={e => setRfidScan(e.target.value)} placeholder="Scan ID Card..." className="pl-10"/>
                    </form>
                    <Button onClick={() => setIsSantriSelectorOpen(true)} className="w-full justify-start" variant="outline"><Users className="mr-2 h-4 w-4"/> {selectedSantri.length > 0 ? `${selectedSantri.length} Murid Terpilih` : 'Pilih Murid Manual'}</Button>

                    {selectedSantri.length > 0 && (
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg max-h-56 overflow-y-auto">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold">Murid Terpilih:</h3>
                                <Button variant="ghost" size="sm" className="h-6 px-2 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setSelectedSantri([])}>
                                    <RotateCcw className="w-3 h-3 mr-1" /> Reset
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {selectedSantri.map(s => (
                                    <div key={s.id} className="flex items-center gap-2 bg-white dark:bg-gray-700 p-1 rounded-full text-xs">
                                        <Avatar className="w-5 h-5"><AvatarImage src={s.foto_url}/><AvatarFallback>{s.nama_lengkap.charAt(0)}</AvatarFallback></Avatar>
                                        <span>{s.nama_panggilan}</span>
                                        <button onClick={() => handleSantriSelect(s)}><X className="w-3 h-3"/></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div>
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <h3 className="font-bold">Item Pembayaran</h3>
                            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => openAmountSettings()}>
                                <Settings className="mr-1.5 h-3.5 w-3.5" /> Atur nominal
                            </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {paymentItemsWithAmounts.map((item) => {
                                const ItemIcon = item.icon;
                                const isConfiguredItem = !item.monthly && !item.custom;
                                return (
                                    <Button key={item.key} onClick={() => initiateAddToCart(item)} variant="outline" className="h-auto flex flex-col p-3 hover:border-primary hover:text-primary">
                                        <ItemIcon className="w-6 h-6 mb-1" />
                                        <span className="text-center text-xs">{item.name}</span>
                                        {item.monthly && <span className="mt-1 text-[10px] text-muted-foreground">Atur per periode</span>}
                                        {isConfiguredItem && <span className="mt-1 text-[10px] text-muted-foreground">{item.amount ? `Rp${item.amount.toLocaleString('id-ID')}` : 'Nominal belum diatur'}</span>}
                                    </Button>
                                );
                            })}
                        </div>
                    </div>
                 </div>
            </div>

            <div className="w-full md:w-2/3 md:-mt-1">
                <Card className="border-none shadow-md bg-slate-50 dark:bg-slate-900/50">
                    <CardHeader className="pb-2"><CardTitle className="text-lg flex justify-between items-center"><span>Items ({cart.length})</span><ShoppingCart className="w-5 h-5 text-muted-foreground"/></CardTitle></CardHeader>
                    <CardContent className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {cart.map((item, index) => (
                            <div key={item.cartId} className="group relative bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-200">
                                <div className="flex justify-between items-start mb-2"><div><h4 className="font-bold text-base text-slate-800 dark:text-slate-100">{item.name}</h4>{item.monthly && <p className="text-xs text-muted-foreground mt-0.5">Periode: {item.months.join(', ')} {item.year}</p>}{item.hasSubtypes && <p className="text-xs text-muted-foreground mt-0.5">{item.subtype}</p>}</div><Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeFromCart(item.cartId)}><X className="w-4 h-4" /></Button></div>
                                <Separator className="my-3"/>
                                <div className="flex items-center justify-between">{item.monthly ? (<div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"><Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{item.months.length} Bulan</Badge><span>x Rp{item.amount.toLocaleString('id-ID')}</span><Button variant="ghost" size="icon" className="h-6 w-6 ml-1 hover:text-primary" onClick={() => editCartItem(item)}><Edit className="w-3 h-3 text-slate-400"/></Button></div>) : (<div className="flex items-center gap-3"><div className="flex items-center border rounded-lg overflow-hidden h-8"><button className="px-2 hover:bg-slate-100 h-full flex items-center" onClick={() => updateCartItem(item.cartId, { quantity: Math.max(1, (item.quantity || 1) - 1) })}><Minus className="w-3 h-3"/></button><span className="w-8 text-center text-sm font-medium border-x h-full flex items-center justify-center bg-slate-50">{item.quantity}</span><button className="px-2 hover:bg-slate-100 h-full flex items-center" onClick={() => updateCartItem(item.cartId, { quantity: (item.quantity || 1) + 1 })}><Plus className="w-3 h-3"/></button></div><span className="text-xs text-muted-foreground">x Rp{item.amount.toLocaleString('id-ID')}</span></div>)}<div className="text-right"><p className="font-bold text-lg text-primary">Rp {(item.monthly ? item.amount * item.months.length : item.amount * item.quantity).toLocaleString('id-ID')}</p></div></div>
                                {!item.monthly && item.custom === 'item' && (<div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-dashed"><Input placeholder="Nama Item" value={item.name} onChange={e => updateCartItem(item.cartId, { name: e.target.value })} className="h-8 text-xs"/><Input type="number" placeholder="Harga" value={item.amount || ''} onChange={e => updateCartItem(item.cartId, { amount: parseInt(e.target.value) || 0 })} className="h-8 text-xs"/></div>)}
                            </div>
                        ))}
                        {cart.length === 0 && (<div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed border-slate-200 rounded-xl"><ShoppingCart className="w-12 h-12 mb-2 opacity-20"/><p>Keranjang kosong</p><p className="text-xs">Pilih item pembayaran di sebelah kiri</p></div>)}
                    </CardContent>
                    <CardFooter className="flex-col gap-4 pt-6 pb-6 bg-white dark:bg-slate-950 border-t rounded-b-xl">
                        <div className="w-full flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                            <label htmlFor="payment-status-toggle" className="min-w-0 cursor-pointer">
                                <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Tandai transaksi sebagai lunas</span>
                                <span className={`mt-0.5 block text-xs ${isPaymentMarkedPaid ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                                    {isPaymentMarkedPaid ? 'Bukti akan berstatus LUNAS.' : 'Bukti tidak menampilkan status LUNAS dan riwayat menandainya Belum Lunas.'}
                                </span>
                            </label>
                            <Switch
                              id="payment-status-toggle"
                              checked={isPaymentMarkedPaid}
                              onCheckedChange={setIsPaymentMarkedPaid}
                              aria-label="Tandai transaksi sebagai lunas"
                            />
                        </div>
                        <div className="w-full flex justify-between items-center px-4 py-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
                            <div className="flex items-center gap-3"><div className="p-2 bg-white dark:bg-slate-800 rounded-md shadow-sm"><Banknote className="w-5 h-5 text-green-600"/></div><div><p className="text-xs font-semibold text-muted-foreground uppercase">Total Tagihan</p><p className="text-xl font-black text-slate-800 dark:text-white">Rp {(totalCart * Math.max(1, selectedSantri.length)).toLocaleString('id-ID')}</p></div></div>
<Select value={paymentMethod} onValueChange={setPaymentMethod}><SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Tunai">Tunai</SelectItem><SelectItem value="Transfer">Transfer</SelectItem></SelectContent></Select>
                        </div>
                        <Button onClick={handlePayment} className="w-full h-12 text-lg font-bold shadow-lg hover:shadow-xl transition-all active:scale-[0.99]" size="lg" disabled={cart.length === 0 || selectedSantri.length === 0 || isProcessingPayment}>
                          {isProcessingPayment && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                          {isProcessingPayment ? 'Memproses...' : 'Proses Pembayaran'} {selectedSantri.length > 1 && `(${selectedSantri.length} Murid)`}
                        </Button>
                    </CardFooter>
                </Card>

                {selectedSantri.length === 1 && (
                <div className="mt-4">
                    <div className="flex flex-col gap-3 mb-2 lg:flex-row lg:items-center lg:justify-between">
                      <h3 className="font-bold text-xl">Riwayat Bayar Murid</h3>
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className="text-xs font-medium mr-1">Filter:</span>
                        <Select value={historyFilter.year.toString()} onValueChange={val => setHistoryFilter(f => ({...f, year: val === 'all' ? 'all' : Number(val)}))}>
                          <SelectTrigger className="w-[100px] h-8"><SelectValue placeholder="Tahun" /></SelectTrigger>
                          <SelectContent><SelectItem value="all">Semua Tahun</SelectItem>{availableYears.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={historyFilter.month.toString()} onValueChange={val => setHistoryFilter(f => ({...f, month: val === 'all' ? 'all' : Number(val)}))}>
                          <SelectTrigger className="w-[120px] h-8"><SelectValue placeholder="Bulan" /></SelectTrigger>
                          <SelectContent><SelectItem value="all">Semua Bulan</SelectItem>{monthsList.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={historyFilter.status} onValueChange={(status) => setHistoryFilter(f => ({ ...f, status }))}>
                          <SelectTrigger className="w-[140px] h-8"><SelectValue placeholder="Status" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Semua Status</SelectItem>
                            <SelectItem value="paid">Lunas</SelectItem>
                            <SelectItem value="unpaid">Belum Lunas</SelectItem>
                          </SelectContent>
                        </Select>
                        {selectedHistory.length > 0 && <Button onClick={confirmDelete} variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-2"/> Hapus ({selectedHistory.length})</Button>}
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-2">
                    {filteredHistory.length > 0 && (<div className="flex items-center px-2"><Checkbox id="selectAllHistory" checked={selectedHistory.length === filteredHistory.length && filteredHistory.length > 0} onCheckedChange={checked => checked ? setSelectedHistory(filteredHistory.map(p => p.id)) : setSelectedHistory([])} /><label htmlFor="selectAllHistory" className="ml-2 text-sm font-medium">Pilih Semua</label></div>)}
                    {filteredHistory.map(p => (<div key={p.id} className="flex items-center justify-between gap-2 p-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"><div className="flex items-center gap-3 min-w-0 flex-1"><Checkbox id={`history-${p.id}`} checked={selectedHistory.includes(p.id)} onCheckedChange={() => handleSelectHistory(p.id)} className="flex-shrink-0" /><div className="flex-grow min-w-0"><p className="font-semibold truncate text-sm">{p.catatan}</p><div className="flex flex-wrap items-center gap-2 text-xs text-gray-500"><span>{new Date(p.tanggal_pembayaran).toLocaleString('id-ID')}</span>{p.bulan && <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-[10px]">Tagihan: {monthNumberToName(p.bulan)} {p.tahun}</span>}<Badge variant={isPaymentPaid(p.status) ? 'secondary' : 'outline'} className={isPaymentPaid(p.status) ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]' : 'bg-amber-50 text-amber-700 border-amber-200 text-[10px]'}>{formatPaymentStatus(p.status)}</Badge></div></div><p className="font-bold whitespace-nowrap text-sm text-primary">Rp{Number(p.jumlah || 0).toLocaleString('id-ID')}</p></div><Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40" onClick={() => setHistoryProofPayment(p)} title="Buka bukti pembayaran" aria-label="Buka bukti pembayaran"><FileText className="h-4 w-4" /></Button></div>))}
                    {filteredHistory.length === 0 && <p className="text-center text-gray-500 py-4">Tidak ada riwayat untuk periode ini.</p>}</div>
                </div>
                )}
            </div>
        </div>

        <SantriSelectorModal santriList={santriList} open={isSantriSelectorOpen} onOpenChange={setIsSantriSelectorOpen} onSelect={handleSantriSelect} selectedSantriIds={new Set(selectedSantri.map(s => s.id))} />
        <MonthSelectorDialog open={isConfigOpen} onOpenChange={setIsConfigOpen} item={configItem} onConfirm={(config) => { addToCart(configItem, config); }} initialYear={configItem?.year} initialMonths={configItem?.months} resetKey={resetKey} selectedSantri={selectedSantri} />
        <PaymentItemAmountDialog
          open={isAmountSettingsOpen}
          onOpenChange={setIsAmountSettingsOpen}
          items={paymentItems}
          amounts={paymentItemAmounts}
          focusKey={amountSettingsFocusKey}
          isLoading={amountSettingsLoading}
          savingKey={amountSettingsSavingKey}
          onSave={handleSavePaymentItemAmount}
          onReset={handleResetPaymentItemAmount}
        />
        <DuplicatePaymentDialog open={isDuplicateDialogOpen} onOpenChange={setIsDuplicateDialogOpen} onResetMonth={() => { setResetKey(prev => prev + 1); setIsConfigOpen(true); }} />

        <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
          <DialogContent className="w-[calc(100%-1rem)] max-w-[400px] max-h-[90vh] overflow-y-auto">
            <DialogHeader className="pb-2 border-b" style={{ borderColor: receiptVisual.borderColor }}><DialogTitle className="text-center" style={{ color: receiptVisual.textColor }}>{receiptContent.receiptTitle}</DialogTitle></DialogHeader>
            {receiptData && (<>
              <div ref={receiptRef} className={`${receiptDensityClass} text-slate-800 rounded-xl shadow-lg border relative overflow-hidden`} id="receipt-content" style={{ backgroundColor: receiptVisual.backgroundColor, color: receiptVisual.textColor, borderColor: receiptVisual.borderColor, borderRadius: receiptRadius, fontFamily: receiptFontFamily }}>
                  <div className="text-center pb-2 mb-2 border-b border-dashed relative z-10" style={{ borderColor: receiptVisual.borderColor }}>
                       {receiptVisibility.logo !== false && <img src={receiptLogoUrl} alt={`Logo ${sekolah.name}`} className="w-12 h-12 mx-auto mb-2 object-contain"/>}
                       {receiptContent.receiptTitle && <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: receiptVisual.accentColor }}>{receiptContent.receiptTitle}</p>}
                       {receiptVisibility.schoolName !== false && <h3 className="font-bold text-lg tracking-tight font-poppins" style={{ color: receiptVisual.accentColor }}>{sekolah.name.toUpperCase()}</h3>}
                       {receiptVisibility.address !== false && <p className="text-[10px] mt-1" style={{ color: receiptVisual.mutedTextColor }}>{sekolah.address}</p>}
                       {receiptVisibility.contact !== false && <p className="text-[10px]" style={{ color: receiptVisual.mutedTextColor }}>{[sekolah.phone, sekolah.website?.replace(/^https?:\/\//, '')].filter(Boolean).join(' · ')}</p>}
                  </div>

                  <div className="flex justify-between text-[10px] mb-3 p-2 rounded-lg relative z-10" style={{ color: receiptVisual.mutedTextColor, backgroundColor: receiptVisual.surfaceColor, border: `1px solid ${receiptVisual.borderColor}` }}>
                      <div className="space-y-0.5">
                         <p>{receiptContent.dateLabel}: <span className="font-semibold" style={{ color: receiptVisual.textColor }}>{receiptData.timestamp.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
                         <p>{receiptContent.timeLabel}: <span className="font-semibold" style={{ color: receiptVisual.textColor }}>{receiptData.timestamp.toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</span></p>
                      </div>
                      <div className="space-y-0.5 text-right max-w-[58%]">
                         <p>{receiptContent.methodLabel}: <span className="font-semibold uppercase" style={{ color: receiptVisual.textColor }}>{receiptData.method}</span></p>
                         {receiptVisibility.status !== false && isPaymentPaid(receiptData.status) && <p>{receiptContent.statusLabel}: <span className="font-semibold" style={{ color: receiptVisual.accentColor }}>{receiptContent.paidStatusText}</span></p>}
                      </div>
                  </div>

                  <div className="mb-2 relative z-10" style={{ color: receiptVisual.textColor }}>
                    {receiptVisibility.recipient !== false && <>
                      <p className="text-[10px] font-semibold mb-0.5" style={{ color: receiptVisual.mutedTextColor }}>{receiptContent.recipientLabel}</p>
                      <p className="text-xs font-bold">{receiptData.santri.map(s => s.nama_lengkap).join(', ')}</p>
                    </>}
                    {receiptVisibility.studentId !== false && <p className="text-[10px] font-mono mt-1" style={{ color: receiptVisual.mutedTextColor }}>{receiptContent.studentIdLabel} {receiptData.santri.map(s => s.nomor_induk || s.nis || s.nisn).filter(Boolean).join(', ') || '-'}</p>}
                  </div>

                  {isPaymentPaid(receiptData.status) && receiptVisibility.watermark !== false && (
                    <div className="relative h-20 mb-2 overflow-hidden">
                      <PaymentReceiptWatermark config={receiptConfig.watermark} />
                    </div>
                  )}

                  {receiptVisibility.items !== false && <div className="space-y-2 mb-3 relative z-10" style={{ color: receiptVisual.textColor }}>
                    <div className="border-t pt-2" style={{ borderColor: receiptVisual.borderColor }}></div>
                    <div className="flex justify-between text-[9px] font-semibold uppercase tracking-wide" style={{ color: receiptVisual.mutedTextColor }}>
                      <span>{receiptContent.itemLabel}</span><span>{receiptContent.amountLabel}</span>
                    </div>
                      {receiptData.items.map(item => {
                          if (item.monthly) {
                             return item.months.map(m => (
                                <div key={`${item.cartId}-${m}`} className="flex justify-between text-xs py-0.5">
                                    <span className="flex-1">{item.name} <span className="text-[9px]" style={{ color: receiptVisual.mutedTextColor }}>({m} {item.year})</span></span>
                                    <span className="font-semibold">Rp{item.amount.toLocaleString('id-ID')}</span>
                                </div>
                             ));
                          } else {
                             return (
                                <div key={item.cartId} className="flex justify-between text-xs py-0.5">
                                    <span className="flex-1">
                                        {item.custom === 'item' ? item.name : (item.hasSubtypes ? `${item.name} ${item.subtype}` : item.name)}
                                        {item.quantity > 1 && <span className="text-[9px] ml-1" style={{ color: receiptVisual.mutedTextColor }}>x{item.quantity}</span>}
                                    </span>
                                    <span className="font-semibold">Rp{(item.amount * item.quantity).toLocaleString('id-ID')}</span>
                                </div>
                             );
                          }
                      })}
                     <div className="border-t pt-2" style={{ borderColor: receiptVisual.borderColor }}></div>
                  </div>}

                  {receiptVisibility.total !== false && <div className="flex justify-between items-center p-2 rounded-lg border mb-4 relative z-10" style={{ backgroundColor: `${receiptVisual.accentColor}14`, borderColor: `${receiptVisual.accentColor}35`, color: receiptVisual.accentColor }}>
                      <span className="text-xs font-bold">{receiptContent.totalLabel}</span>
                      <span className="text-base font-black">Rp{receiptData.total.toLocaleString('id-ID')}</span>
                  </div>}

                  {((receiptVisibility.qr !== false && receiptConfig.qr.visible !== false) || receiptVisibility.footer !== false) && <div className="relative z-10">
                      {receiptVisibility.qr !== false && receiptConfig.qr.visible !== false && <div className={`flex flex-col ${({ left: 'items-start', center: 'items-center', right: 'items-end' }[receiptConfig.qr.position] || 'items-center')}`}>
                        <div className="p-1 inline-block rounded-lg shadow-sm border mb-2" style={{ backgroundColor: receiptVisual.backgroundColor, borderColor: receiptVisual.borderColor }}>
                        {qrCodeDataURL && (
                          <img src={qrCodeDataURL} alt={receiptContent.qrLabel} style={{ width: `${receiptConfig.qr.size}px`, height: `${receiptConfig.qr.size}px` }}/>
                        )}
                        </div>
                      </div>}
                      {receiptVisibility.footer !== false && <p className="text-center text-[9px] font-bold tracking-widest uppercase" style={{ color: receiptVisual.mutedTextColor }}>{receiptContent.footerText}</p>}
                  </div>}
              </div>

              <div className="flex justify-center flex-wrap gap-2 p-2">
                <Button variant="outline" size="sm" onClick={handleSendWhatsApp} disabled={isSendingReceiptWhatsApp} className="bg-green-600 text-white hover:bg-green-700 border-0 shadow-sm text-xs h-8">
                  {isSendingReceiptWhatsApp ? <Loader2 className="mr-2 h-3 w-3 animate-spin"/> : <MessageSquare className="mr-2 h-3 w-3"/>}
                  {isSendingReceiptWhatsApp ? 'Menyiapkan...' : 'WhatsApp'}
                </Button>
                <Button variant="outline" size="sm" onClick={savePaymentProof} disabled={isSaving} className="shadow-sm text-xs h-8">
                  {isSaving ? <Loader2 className="mr-2 h-3 w-3 animate-spin"/> : <Download className="mr-2 h-3 w-3"/>}
                  {isSaving ? 'Menyimpan...' : 'Simpan Bukti'}
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint} disabled={isPrintingReceipt} className="shadow-sm text-xs h-8">
                  {isPrintingReceipt ? <Loader2 className="mr-2 h-3 w-3 animate-spin"/> : <Printer className="mr-2 h-3 w-3"/>}
                  {isPrintingReceipt ? 'Membuka...' : 'Cetak'}
                </Button>
              </div>
            </>)}
          </DialogContent>
        </Dialog>

        <DeleteConfirmationDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen} onConfirm={handleDeleteHistory} count={selectedHistory.length} />
        <PaymentProofModal
          isOpen={Boolean(historyProofPayment)}
          onClose={() => setHistoryProofPayment(null)}
          payment={historyProofPayment}
        />
      </div>
    </>
  );
};

export default PaymentSystem;
