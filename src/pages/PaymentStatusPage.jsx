
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useSchoolIdentity from '@/hooks/useSchoolIdentity';
import usePaymentReceiptConfiguration from '@/hooks/usePaymentReceiptConfiguration';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import {
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Calendar,
  CreditCard,
  User,
  FileText,
  Hash,
  Download,
  Check,
  X,
  ShieldCheck,
  BookOpen
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { toPng } from 'html-to-image';
import QRCode from 'qrcode';
import { calculateAttendanceData, getHafalanProgressData, getPointsData } from '@/utils/reportUtils';
import { fetchAllPayments, fetchPaymentDetail } from '@/lib/paymentAdapters';
import { fetchReceiptLogoDataUrl } from '@/lib/publicContentAdapters';
import { DEFAULT_LOGO_PATH } from '@/lib/schoolAssets';
import { isPaymentPaid } from '@/lib/paymentReceipt';
import PaymentReceiptWatermark from '@/components/dashboard/admin/PaymentReceiptWatermark';

const PaymentStatusPage = () => {
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
  const receiptQrAlign = { left: 'items-start', center: 'items-center', right: 'items-end' }[receiptConfig.qr.position] || 'items-center';
  const receiptReportPadding = receiptVisual.density === 'compact' ? 'p-6 sm:p-8' : 'p-10';
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [paymentData, setPaymentData] = useState(null);
  const [relatedPayments, setRelatedPayments] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const receiptRef = useRef(null);
  const [qrCodeDataURL, setQrCodeDataURL] = useState('');

  // Report Card Data States
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [hafalanData, setHafalanData] = useState(null);
  const [santriPoints, setSantriPoints] = useState(0);
  const [receiptLogoUrl, setReceiptLogoUrl] = useState(DEFAULT_LOGO_PATH);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        // The detail endpoint returns the nested santri (with class and guru)
        // that the receipt below reads.
        const payment = await fetchPaymentDetail(paymentId);
        if (!payment) throw new Error('Pembayaran tidak ditemukan.');
        setPaymentData(payment);

        // A cart checkout writes one row per item under a shared transaction_id;
        // the receipt lists all of them.
        if (payment.transaction_id) {
          try {
            const siblings = await fetchAllPayments({ transaction_id: payment.transaction_id });
            setRelatedPayments(siblings.length > 0 ? siblings : [payment]);
          } catch {
            setRelatedPayments([payment]);
          }
        } else {
            setRelatedPayments([payment]);
        }

        if (payment.santri_id) {
            // Fetch comprehensive report data
            const date = new Date();
            const start = new Date(date.getFullYear(), 0, 1).toISOString().split('T')[0]; // Year start
            const end = new Date(date.getFullYear(), 11, 31).toISOString().split('T')[0]; // Year end

            const attendance = await calculateAttendanceData(payment.santri_id, start, end);
            setAttendanceSummary(attendance);

            const hafalan = await getHafalanProgressData(payment.santri_id);
            setHafalanData(hafalan);

            const points = await getPointsData(payment.santri_id, start, end);
            setSantriPoints(points.totalPoints);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        toast({ title: 'Gagal memuat data', description: 'Data tidak ditemukan atau terjadi kesalahan.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    if (paymentId) fetchAllData();
  }, [paymentId]);

  useEffect(() => {
    if (paymentData) {
        const qrCodeVerificationUrl = `${window.location.origin}/verify/${paymentData.id}`;
        QRCode.toDataURL(qrCodeVerificationUrl, { width: 120, margin: 1 }, (err, url) => {
            if (!err) setQrCodeDataURL(url);
        });
    }
  }, [paymentData]);

  useEffect(() => {
    let active = true;
    fetchReceiptLogoDataUrl(DEFAULT_LOGO_PATH).then((logoUrl) => {
      if (active) setReceiptLogoUrl(logoUrl);
    });
    return () => {
      active = false;
    };
  }, []);

  const saveReportCard = async () => {
    if (!paymentData || !receiptRef.current) return;
    setIsSaving(true);

    try {
      toast({ title: "Memproses...", description: "Sedang membuat dokumen resmi." });

      const dataUrl = await toPng(receiptRef.current, { cacheBust: true, backgroundColor: receiptVisual.backgroundColor, pixelRatio: 2 });

      const link = document.createElement('a');
      const santriName = paymentData.santri ? paymentData.santri.nama_lengkap.replace(/\s+/g, '_') : 'Murid';
      const dateStr = new Date().toLocaleDateString('id-ID').replace(/\//g, '-');
      link.download = `Rapor_BuktiBayar_${santriName}_${dateStr}.png`;
      link.href = dataUrl;
      link.click();

      toast({ title: "Berhasil!", description: "Dokumen resmi berhasil diunduh." });

    } catch (err) {
      console.error("Error generating image:", err);
      toast({ title: "Gagal Menyimpan", description: "Terjadi kesalahan saat menyimpan dokumen.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground animate-pulse">Memuat data murid dan pembayaran...</p>
        </div>
      </div>
    );
  }

  if (!paymentData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-900">
        <Card className="w-full max-w-md text-center p-6">
            <div className="flex justify-center mb-4"><FileText className="h-16 w-16 text-gray-300" /></div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Data Tidak Ditemukan</h2>
            <p className="text-gray-500 mb-6">Maaf, data yang Anda cari tidak ditemukan atau Anda tidak memiliki akses.</p>
            <Button onClick={() => navigate(-1)} variant="outline"><ArrowLeft className="mr-2 h-4 w-4"/> Kembali</Button>
        </Card>
      </div>
    );
  }

  const totalAmount = relatedPayments.reduce((sum, p) => sum + p.jumlah, 0);
  const teacherName = paymentData.santri?.class?.guru?.nama || 'Guru Pengampu';
  const paymentIsPaid = isPaymentPaid(paymentData.status);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 flex justify-center relative overflow-hidden">

      <div className="w-full max-w-4xl space-y-6">
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border">
             <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-2"/> Kembali</Button>
             <Button onClick={saveReportCard} disabled={isSaving} className="bg-primary shadow-md">
                 {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Download className="w-4 h-4 mr-2"/>} Unduh Rapor & Kwitansi
             </Button>
          </div>

          <div className="rounded-2xl shadow-xl overflow-hidden border print-break-inside-avoid relative" ref={receiptRef} style={{ width: '100%', maxWidth: '210mm', margin: '0 auto', backgroundColor: receiptVisual.backgroundColor, color: receiptVisual.textColor, borderColor: receiptVisual.borderColor, borderRadius: receiptRadius, fontFamily: receiptFontFamily }}>
              {/* HEADER SECTION (Dual Logos) */}
              <div className="px-10 pt-10 pb-6 border-b-4 border-primary/20 relative">
                  <div className="flex justify-between items-center">
                      {receiptVisibility.logo !== false && <img src={receiptLogoUrl} alt={`Logo ${sekolah.name}`} className="w-20 h-20 object-contain"/>}
                      <div className="text-center flex-1 px-4">
                          {receiptVisibility.schoolName !== false && <h1 className="text-2xl font-black font-serif uppercase tracking-widest" style={{ color: receiptVisual.textColor }}>{sekolah.name}</h1>}
                          <h2 className="text-lg font-bold text-primary tracking-wide">{sekolah.tagline}</h2>
                          {receiptVisibility.address !== false && <p className="text-xs mt-1 max-w-sm mx-auto leading-relaxed" style={{ color: receiptVisual.mutedTextColor }}>
                              {sekolah.address}<br/>
                              {receiptVisibility.contact !== false && [sekolah.phone, sekolah.website?.replace(/^https?:\/\//, '')].filter(Boolean).join(' · ')}
                          </p>}
                      </div>
                      <div className="w-20 h-20 flex items-center justify-center border-2 border-slate-200 rounded-full bg-slate-50 text-[10px] font-bold text-center text-slate-400">
                          <span className="font-serif">{sekolah.logoAbbr || sekolah.shortName}</span>
                      </div>
                  </div>
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 bg-white px-4">
                      <span className="text-sm font-bold bg-primary text-white px-4 py-1 rounded-full shadow-sm tracking-widest uppercase">
                          Laporan Akademik & Administrasi
                      </span>
                  </div>
              </div>

              <div className={`${receiptReportPadding} space-y-8`}>
                  {/* SANTRI INFO */}
                  <div className="grid grid-cols-2 gap-4 text-sm p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                          <table className="w-full">
                              <tbody>
                                  <tr><td className="w-32 text-slate-500 font-medium pb-1">Nama Lengkap</td><td className="font-bold text-slate-900 pb-1">: {paymentData.santri?.nama_lengkap}</td></tr>
                                  <tr><td className="w-32 text-slate-500 font-medium pb-1">Tingkat Saat Ini</td><td className="font-bold text-slate-900 pb-1">: {paymentData.santri?.jilid || '-'}</td></tr>
                                  <tr><td className="w-32 text-slate-500 font-medium">Kelas / Sesi</td><td className="font-bold text-slate-900">: {paymentData.santri?.class?.nama_kelas || '-'} / {paymentData.santri?.sesi_mengaji || '-'}</td></tr>
                              </tbody>
                          </table>
                      </div>
                      <div>
                          <table className="w-full">
                              <tbody>
                                  <tr><td className="w-32 text-slate-500 font-medium pb-1">Guru Pengampu</td><td className="font-bold text-slate-900 pb-1">: {teacherName}</td></tr>
                                  <tr><td className="w-32 text-slate-500 font-medium pb-1">Wali Murid</td><td className="font-bold text-slate-900 pb-1">: {paymentData.santri?.nama_ayah || paymentData.santri?.nama_ibu || '-'}</td></tr>
                                  <tr><td className="w-32 text-slate-500 font-medium">Dicetak Tanggal</td><td className="font-bold text-slate-900">: {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>
                              </tbody>
                          </table>
                      </div>
                  </div>

                  {/* ACADEMIC SECTION */}
                  <div className="space-y-4">
                      <div className="flex items-center gap-2 border-b-2 border-slate-200 pb-2">
                          <BookOpen className="w-5 h-5 text-primary" />
                          <h3 className="text-lg font-bold text-slate-800">Progres Akademik (Tahun Ini)</h3>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                          {/* Attendance */}
                          <div>
                              <h4 className="text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-slate-400" /> Ringkasan Kehadiran
                              </h4>
                              {attendanceSummary ? (
                                  <div className="bg-white border rounded-lg overflow-hidden">
                                      <table className="w-full text-sm">
                                          <tbody className="divide-y divide-slate-100">
                                              <tr className="bg-slate-50"><td className="px-3 py-2 font-medium">Total Hadir</td><td className="px-3 py-2 text-right font-bold text-emerald-600">{attendanceSummary.totalPresent} Hari</td></tr>
                                              <tr><td className="px-3 py-2 font-medium">Terlambat</td><td className="px-3 py-2 text-right font-bold text-amber-600">{attendanceSummary.totalLate} Hari</td></tr>
                                              <tr className="bg-slate-50"><td className="px-3 py-2 font-medium">Izin / Sakit</td><td className="px-3 py-2 text-right font-bold text-blue-600">{attendanceSummary.totalPermit} Hari</td></tr>
                                              <tr><td className="px-3 py-2 font-medium">Alpha</td><td className="px-3 py-2 text-right font-bold text-red-600">{attendanceSummary.totalAbsent} Hari</td></tr>
                                              <tr className="bg-primary/5"><td className="px-3 py-2 font-bold text-primary">Persentase</td><td className="px-3 py-2 text-right font-black text-primary text-lg">{attendanceSummary.attendancePercentage}%</td></tr>
                                          </tbody>
                                      </table>
                                  </div>
                              ) : <div className="text-sm text-slate-500 italic">Data kehadiran tidak tersedia.</div>}
                          </div>

                          {/* Hafalan Progress */}
                          <div>
                              <h4 className="text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide flex items-center gap-2">
                                  <Star className="w-4 h-4 text-slate-400" /> Status Hafalan
                              </h4>
                              {hafalanData ? (
                                  <div className="bg-white border rounded-lg overflow-hidden">
                                      <table className="w-full text-sm">
                                          <thead className="bg-slate-50 text-slate-500">
                                              <tr><th className="px-3 py-2 text-left font-semibold">Kategori</th><th className="px-3 py-2 text-right font-semibold">Progres</th></tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100">
                                              <tr><td className="px-3 py-2 font-medium">Surat Pendek</td><td className="px-3 py-2 text-right font-bold">{hafalanData.surat.completed} / {hafalanData.surat.total}</td></tr>
                                              <tr className="bg-slate-50"><td className="px-3 py-2 font-medium">Doa Harian</td><td className="px-3 py-2 text-right font-bold">{hafalanData.doa.completed} / {hafalanData.doa.total}</td></tr>
                                              <tr><td className="px-3 py-2 font-medium">Bacaan Sholat</td><td className="px-3 py-2 text-right font-bold">{hafalanData.sholat.completed} / {hafalanData.sholat.total}</td></tr>
                                              <tr className="bg-emerald-50"><td className="px-3 py-2 font-bold text-emerald-700">Pencapaian</td><td className="px-3 py-2 text-right font-black text-emerald-700 text-lg">{hafalanData.overallProgress}%</td></tr>
                                          </tbody>
                                      </table>
                                  </div>
                              ) : <div className="text-sm text-slate-500 italic">Data hafalan tidak tersedia.</div>}
                          </div>
                      </div>
                  </div>

                  {/* FINANCIAL SECTION */}
                  <div className="space-y-4">
                      <div className="flex items-center gap-2 border-b-2 border-slate-200 pb-2">
                          <CreditCard className="w-5 h-5 text-primary" />
                          <h3 className="text-lg font-bold" style={{ color: receiptVisual.textColor }}>{receiptContent.officialReceiptTitle}</h3>
                      </div>

                      <div className="border-2 rounded-xl overflow-hidden relative" style={{ backgroundColor: receiptVisual.backgroundColor, borderColor: receiptVisual.borderColor }}>
                          <div className="flex justify-between items-center p-4 border-b relative z-10" style={{ backgroundColor: receiptVisual.surfaceColor, borderColor: receiptVisual.borderColor }}>
                              <div>
                                  <p className="text-xs font-medium" style={{ color: receiptVisual.mutedTextColor }}>{receiptContent.transactionDateLabel || receiptContent.dateLabel}</p>
                                  <p className="font-bold" style={{ color: receiptVisual.textColor }}>{new Date(paymentData.tanggal_pembayaran).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                              </div>
                              <div className="text-right flex flex-col items-end gap-1">
                                  {receiptVisibility.status !== false && paymentIsPaid && <p className="text-xs font-semibold" style={{ color: receiptVisual.accentColor }}>{receiptContent.statusLabel}: {receiptContent.paidStatusText}</p>}
                                  <p className="text-xs font-medium" style={{ color: receiptVisual.mutedTextColor }}>{receiptContent.transactionMethodLabel || receiptContent.methodLabel}</p>
                                  <p className="font-mono text-sm font-bold" style={{ color: receiptVisual.textColor }}>{paymentData.metode_pembayaran?.toUpperCase() || 'MANUAL'}</p>
                              </div>
                          </div>

                          {paymentIsPaid && receiptVisibility.watermark !== false && (
                              <div className="relative h-20 overflow-hidden border-b" style={{ borderColor: receiptVisual.borderColor }}>
                                  <PaymentReceiptWatermark config={receiptConfig.watermark} />
                              </div>
                          )}

                          <div className="p-4 relative z-10" style={{ color: receiptVisual.textColor }}>
                              <table className="w-full text-sm">
                                  {receiptVisibility.items !== false && <thead className="border-b-2" style={{ borderColor: receiptVisual.borderColor, color: receiptVisual.mutedTextColor }}>
                                      <tr><th className="py-2 text-left">{receiptContent.descriptionLabel || receiptContent.itemLabel}</th><th className="py-2 text-right">{receiptContent.amountLabel}</th></tr>
                                  </thead>}
                                  <tbody className="divide-y" style={{ borderColor: receiptVisual.borderColor }}>
                                      {receiptVisibility.items !== false && relatedPayments.map((item, idx) => (
                                          <tr key={idx}>
                                              <td className="py-3 font-medium">
                                                  {item.catatan || 'Pembayaran Administrasi'}
                                                  {item.bulan && item.tahun && <span className="block text-xs font-normal" style={{ color: receiptVisual.mutedTextColor }}>Periode: {item.bulan} {item.tahun}</span>}
                                              </td>
                                              <td className="py-3 text-right font-bold">Rp {item.jumlah.toLocaleString('id-ID')}</td>
                                          </tr>
                                      ))}
                                  </tbody>
                                  {receiptVisibility.total !== false && <tfoot>
                                      <tr style={{ backgroundColor: `${receiptVisual.accentColor}14`, color: receiptVisual.accentColor }}>
                                          <td className="py-4 px-3 font-bold text-base">{receiptContent.totalPaidLabel || receiptContent.totalLabel}</td>
                                          <td className="py-4 px-3 text-right font-black text-xl">Rp {totalAmount.toLocaleString('id-ID')}</td>
                                      </tr>
                                  </tfoot>}
                              </table>
                          </div>
                      </div>
                  </div>

                  {/* SIGNATURE SECTION */}
                  <div className="pt-8 flex justify-between items-end">
                      <div className={`flex flex-col ${receiptQrAlign}`}>
                          {receiptVisibility.qr !== false && receiptConfig.qr.visible !== false && qrCodeDataURL && <img src={qrCodeDataURL} alt={receiptContent.qrLabel} className="border p-1 rounded-lg shadow-sm" style={{ width: `${receiptConfig.qr.size}px`, height: `${receiptConfig.qr.size}px`, borderColor: receiptVisual.borderColor }} />}
                          <p className="text-[10px] mt-2 font-mono flex items-center gap-1" style={{ color: receiptVisual.mutedTextColor }}><ShieldCheck className="w-3 h-3"/> {receiptContent.verificationLabel || receiptContent.qrLabel}</p>
                      </div>

                      <div className="text-center">
                          <p className="text-sm text-slate-800 mb-16">{sekolah.city}, {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                          <p className="font-bold text-slate-900 border-b border-slate-900 pb-1 px-4">{teacherName}</p>
                          <p className="text-xs text-slate-500 mt-1">Guru Kelas / Administrasi</p>
                      </div>
                  </div>
                  {receiptVisibility.footer !== false && <p className="pt-6 text-center text-xs font-bold uppercase tracking-[0.16em]" style={{ color: receiptVisual.mutedTextColor }}>{receiptContent.footerText}</p>}
              </div>
          </div>
      </div>
    </div>
  );
};

function Star(props) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
}

export default PaymentStatusPage;
