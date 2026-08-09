
import React, { useRef, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Download, Printer, MessageSquare } from 'lucide-react';
import { toPng } from 'html-to-image';
import { toast } from '@/components/ui/use-toast';
import QRCode from 'qrcode';
import { fetchPaymentDetail, formatPaymentPeriod } from '@/lib/paymentAdapters';
import { fetchReceiptLogoDataUrl, waitForImagesToLoad } from '@/lib/publicContentAdapters';
import { DEFAULT_WHATSAPP_TEMPLATES, fetchWhatsAppTemplates, renderWhatsAppTemplate } from '@/lib/whatsappTemplateAdapters';
import useSchoolIdentity from '@/hooks/useSchoolIdentity';
import { DEFAULT_LOGO_PATH } from '@/lib/schoolAssets';
import { formatPaymentStatus, getPaymentReceiptReference, isPaymentPaid, normalizeWhatsAppPhone } from '@/lib/paymentReceipt';
import PaymentReceiptWatermark from './PaymentReceiptWatermark';

const PaymentProofModal = ({ isOpen, onClose, payment }) => {
    const sekolah = useSchoolIdentity();
    const receiptRef = useRef(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isLoadingPayment, setIsLoadingPayment] = useState(false);
    const [paymentLoadError, setPaymentLoadError] = useState('');
    const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const [completePayment, setCompletePayment] = useState(null);
    const [qrCodeDataURL, setQrCodeDataURL] = useState('');
    const [receiptLogoUrl, setReceiptLogoUrl] = useState(DEFAULT_LOGO_PATH);
    const [paymentMessageTemplate, setPaymentMessageTemplate] = useState(DEFAULT_WHATSAPP_TEMPLATES.paymentReceipt);

    useEffect(() => {
        let active = true;

        const fetchCompletePayment = async () => {
            if (!isOpen || !payment?.id) {
                if (active) {
                    setCompletePayment(null);
                    setPaymentLoadError('');
                    setIsLoadingPayment(false);
                }
                return;
            }

            setIsLoadingPayment(true);
            setPaymentLoadError('');
            setCompletePayment(null);
            try {
                const data = await fetchPaymentDetail(payment.id);
                if (!data) throw new Error('Record pembayaran tidak ditemukan.');
                if (active) setCompletePayment(data);
            } catch (error) {
                if (active) {
                    const description = error?.message || 'Data lengkap tidak dapat dimuat. Bukti sementara dari riwayat tetap ditampilkan.';
                    setCompletePayment(null);
                    setPaymentLoadError(description);
                    toast({ title: 'Gagal Memuat Bukti', description, variant: 'destructive' });
                }
            } finally {
                if (active) setIsLoadingPayment(false);
            }
        };

        fetchCompletePayment();
        return () => {
            active = false;
        };
    }, [isOpen, payment?.id]);

    useEffect(() => {
        let active = true;
        const loadReceiptLogo = async () => {
            if (!isOpen) return;
            const logoUrl = await fetchReceiptLogoDataUrl(DEFAULT_LOGO_PATH);
            if (active) setReceiptLogoUrl(logoUrl);
        };
        loadReceiptLogo();
        return () => {
            active = false;
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        fetchWhatsAppTemplates().then((templates) => setPaymentMessageTemplate(templates.paymentReceipt));
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && completePayment) {
            const qrCodeLoginUrl = `${window.location.origin}/login`;
            QRCode.toDataURL(qrCodeLoginUrl, { width: 120, margin: 1 }, (err, url) => {
                if (!err) setQrCodeDataURL(url);
            });
        }
    }, [isOpen, completePayment]);

    const receiptPayment = completePayment || payment;
    const amount = Number(receiptPayment?.jumlah || 0);
    const paymentDate = receiptPayment?.created_at || receiptPayment?.tanggal_pembayaran || new Date().toISOString();
    const paymentMethod = receiptPayment?.metode_pembayaran || '-';
    const transactionRef = getPaymentReceiptReference(receiptPayment);
    const paymentStatusLabel = formatPaymentStatus(receiptPayment?.status);
    const isPaid = isPaymentPaid(receiptPayment?.status);
    const studentName = receiptPayment?.santri?.nama_lengkap || 'Murid';
    const studentId = receiptPayment?.santri?.nomor_induk_qiroati || '-';
    const period = formatPaymentPeriod(receiptPayment?.bulan, receiptPayment?.tahun);
    const notes = receiptPayment?.catatan || 'Pembayaran Administrasi';

    const handleDownload = async () => {
        if (!receiptRef.current || !receiptPayment?.id) {
            toast({ title: 'Gagal', description: 'Data pembayaran belum lengkap.', variant: 'destructive' });
            return;
        }
        setIsGenerating(true);
        try {
            await waitForImagesToLoad(receiptRef.current);
            const dataUrl = await toPng(receiptRef.current, {
                cacheBust: true,
                backgroundColor: '#ffffff',
                pixelRatio: 2,
                imagePlaceholder: DEFAULT_LOGO_PATH,
            });
            const link = document.createElement('a');
            const santriName = studentName.replace(/\s+/g, '_') || 'Murid';
            const dateStr = new Date(paymentDate).toLocaleDateString('id-ID').replace(/\//g, '-');
            link.download = `Bukti-Pembayaran-${santriName}-${dateStr}.png`;
            link.href = dataUrl;
            link.click();
            toast({ title: "Berhasil", description: "Bukti pembayaran berhasil diunduh." });
        } catch (err) {
            toast({ title: "Gagal", description: `Gagal membuat gambar bukti pembayaran: ${err?.message || 'gambar tidak dapat diproses.'}`, variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSendWhatsApp = async () => {
        if (!receiptPayment || !receiptPayment.santri?.no_hp_ortu) {
            toast({ title: "Gagal", description: "Nomor HP Wali Murid tidak ditemukan.", variant: "destructive" });
            return;
        }

        const phoneNumber = normalizeWhatsAppPhone(receiptPayment.santri.no_hp_ortu);
        if (!phoneNumber) {
            toast({ title: "Gagal", description: "Format nomor HP tidak valid.", variant: "destructive" });
            return;
        }

        const popup = window.open('about:blank', '_blank');
        if (!popup) {
            toast({ title: 'WhatsApp Tidak Dapat Dibuka', description: 'Izinkan pop-up pada browser, lalu coba lagi.', variant: 'destructive' });
            return;
        }

        setIsSendingWhatsApp(true);
        try {
            const formattedAmount = `Rp ${amount.toLocaleString('id-ID')}`;
            const date = new Date(paymentDate).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
            const templates = await fetchWhatsAppTemplates();
            const message = renderWhatsAppTemplate(templates.paymentReceipt || paymentMessageTemplate, {
                nama_santri: studentName,
                nomor_induk: studentId,
                rincian: notes,
                nominal: formattedAmount,
                tanggal: date,
                periode: period,
                metode: paymentMethod,
                transaction_id: transactionRef,
                status: paymentStatusLabel,
                nama_lembaga: sekolah.name,
            });

            const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
            popup.location.href = whatsappUrl;
            toast({ title: "WhatsApp Siap Digunakan", description: "Pesan bukti pembayaran telah disiapkan." });
        } catch (error) {
            popup.close();
            toast({ title: 'Gagal Menyiapkan WhatsApp', description: error?.message || 'Pesan bukti pembayaran tidak dapat disiapkan.', variant: 'destructive' });
        } finally {
            setIsSendingWhatsApp(false);
        }
    };

    const handlePrint = () => {
        if (!receiptPayment?.id || !receiptRef.current) {
            toast({ title: 'Gagal Mencetak', description: 'Bukti pembayaran belum siap.', variant: 'destructive' });
            return;
        }
        setIsPrinting(true);
        window.setTimeout(() => {
            try {
                window.print();
                toast({ title: 'Dialog Cetak Dibuka', description: 'Pilih printer atau simpan sebagai PDF dari dialog cetak.' });
            } catch (error) {
                toast({ title: 'Gagal Mencetak', description: error?.message || 'Dialog cetak tidak dapat dibuka.', variant: 'destructive' });
            } finally {
                setIsPrinting(false);
            }
        }, 0);
    };

    if (!payment) return null;

    return (
        <>
        <style>{`@media print {
          body * { visibility: hidden !important; }
          #payment-proof-content, #payment-proof-content * { visibility: visible !important; }
          #payment-proof-content { position: absolute; left: 0; top: 0; width: 100%; max-width: 480px; box-shadow: none; }
        }`}</style>
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[calc(100%-1rem)] max-w-[480px] max-h-[90vh] overflow-y-auto p-0 bg-transparent border-none shadow-none">
                <DialogTitle className="sr-only">Bukti Pembayaran</DialogTitle>
                {paymentLoadError && (
                    <div role="alert" className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        {paymentLoadError}
                    </div>
                )}
                <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
                    <div ref={receiptRef} id="payment-proof-content" className="p-4 sm:p-6 bg-white text-slate-800 relative font-sans">
                        {/* Header */}
                        <div className="text-center pb-4 mb-4 border-b border-dashed border-slate-300 relative z-10">
                            <img src={receiptLogoUrl} alt="Logo" className="w-16 h-16 mx-auto mb-2 object-contain"/>
                            <h3 className="font-bold text-xl text-primary tracking-tight font-poppins">{sekolah.name.toUpperCase()}</h3>
                            <p className="text-xs text-slate-500 mt-1">{sekolah.address}</p>
                            <p className="text-xs text-slate-500">{[sekolah.phone, sekolah.website?.replace(/^https?:\/\//, '')].filter(Boolean).join(' · ')}</p>
                        </div>

                        {/* Meta Info */}
                        <div className="flex justify-between gap-4 text-xs mb-4 text-slate-600 bg-slate-50 p-3 rounded-lg relative z-10">
                            <div className="space-y-1">
                                <p>Tgl: <span className="font-semibold text-slate-900">{new Date(paymentDate).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
                                <p>Jam: <span className="font-semibold text-slate-900">{new Date(paymentDate).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</span></p>
                            </div>
                            <div className="space-y-1 text-right min-w-0">
                                <p>Metode: <span className="font-semibold text-slate-900 uppercase">{paymentMethod}</span></p>
                                {isPaid && <p>Status: <span className="font-semibold text-green-700">LUNAS</span></p>}
                            </div>
                        </div>

                        {/* Student Info */}
                        <div className="relative mb-4 min-h-[72px] overflow-hidden">
                            {isPaid && <PaymentReceiptWatermark />}
                            <div className="relative z-10">
                                <p className="text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">Diterima Dari:</p>
                                <p className="text-sm font-bold text-slate-900">{studentName}</p>
                                <p className="text-xs text-slate-500 font-mono">No. Induk: {studentId}</p>
                            </div>
                        </div>

                        {/* Items */}
                        <div className="space-y-3 mb-6 relative z-10">
                            <div className="border-t border-slate-200 pt-3"></div>
                            <div className="flex justify-between text-sm py-1">
                                <span className="text-slate-700 flex-1 font-medium">{notes}</span>
                                <span className="font-bold text-slate-900">Rp {amount.toLocaleString('id-ID')}</span>
                            </div>
                            {period !== '-' && (
                                <div className="text-xs text-slate-500 pl-2">
                                    Tagihan: {period}
                                </div>
                            )}
                            <div className="border-t border-slate-200 pt-3"></div>
                        </div>

                        {/* Total */}
                        <div className="flex justify-between items-center bg-green-50 p-3 rounded-lg border border-green-100 mb-6 relative z-10">
                            <span className="text-sm font-bold text-green-800">TOTAL BAYAR</span>
                            <span className="text-xl font-black text-green-900">Rp {amount.toLocaleString('id-ID')}</span>
                        </div>

                        {/* Footer */}
                        <div className="text-center relative z-10 flex flex-col items-center">
                             <div className="bg-white p-1 inline-block rounded-lg shadow-sm border border-slate-100 mb-2">
                                {qrCodeDataURL && <img src={qrCodeDataURL} alt="QR Code" className="w-20 h-20"/>}
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Terima Kasih</p>
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-800/90 flex justify-center gap-2 border-t dark:border-slate-700 flex-wrap">
                        <Button variant="outline" size="sm" onClick={onClose}>Tutup</Button>
                        <Button variant="outline" size="sm" className="text-green-600 dark:text-green-400 border-green-200 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-900/20" onClick={handleSendWhatsApp} disabled={isLoadingPayment || isSendingWhatsApp}>
                            {isSendingWhatsApp ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <MessageSquare className="mr-2 h-4 w-4"/>} {isSendingWhatsApp ? 'Menyiapkan...' : 'Kirim WA'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={handlePrint} disabled={isPrinting || isLoadingPayment}>
                            {isPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Printer className="mr-2 h-4 w-4"/>} {isPrinting ? 'Membuka...' : 'Cetak'}
                        </Button>
                        <Button size="sm" onClick={handleDownload} disabled={isGenerating || isLoadingPayment || !receiptPayment?.id}>
                            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>}
                            {isLoadingPayment ? 'Memuat...' : 'Simpan Bukti'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
        </>
    );
};

export default PaymentProofModal;
