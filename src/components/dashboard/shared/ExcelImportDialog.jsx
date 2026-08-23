import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, Download, FileSpreadsheet, Loader2, XCircle } from 'lucide-react';

/**
 * Dialog impor massal dari Excel — dipakai bersama panel Data Murid dan
 * Data Guru. Alur: unduh template → isi → pilih berkas → pratinjau jumlah
 * baris → kirim ke endpoint bulk → lihat laporan per baris.
 *
 * Parsing terjadi di sisi browser (pustaka xlsx sudah ada untuk fitur export),
 * backend hanya menerima array JSON sehingga tidak butuh dependensi Go baru.
 *
 * Props:
 *  - open/onClose        : kendali dialog
 *  - title               : judul dialog, mis. "Impor Murid"
 *  - description         : satu kalimat penjelasan di bawah judul
 *  - columns             : [{ header: 'Nomor Induk*', key: 'nomor_induk', required: true, example: '2026001' }]
 *  - submitBulk(payloads): async ({inserted, failed}) => void — adapter bulk terkait
 *  - onImported()        : dipanggil bila ada baris berhasil, agar panel memuat ulang data
 */
const ExcelImportDialog = ({ open, onClose, title, description, columns, submitBulk, onImported }) => {
  const fileRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { insertedCount, failed }

  const headers = columns.map(c => c.header);
  const slug = (title || 'data').toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const downloadTemplate = () => {
    const example = columns.map(c => c.example ?? '');
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, `template-impor-${slug}.xlsx`);
  };

  const reset = () => {
    setRows([]);
    setFileName('');
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      // defval '' menjaga kolom kosong tetap hadir sebagai kunci.
      const parsed = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      // Buang baris yang seluruh selnya kosong (sisa format di Excel).
      const filled = parsed.filter(r => Object.values(r).some(v => String(v).trim() !== ''));
      if (filled.length === 0) {
        toast({ title: 'Berkas kosong', description: 'Tidak ada baris data yang bisa dibaca.', variant: 'destructive' });
        setRows([]);
        setFileName('');
        return;
      }
      setRows(filled);
      setFileName(file.name);
    } catch (err) {
      toast({ title: 'Gagal membaca berkas', description: err.message, variant: 'destructive' });
      setRows([]);
      setFileName('');
    }
  };

  const buildPayloads = () => {
    const missing = [];
    const payloads = rows.map((row, idx) => {
      const payload = {};
      for (const col of columns) {
        payload[col.key] = String(row[col.header] ?? '').trim();
      }
      for (const col of columns) {
        if (col.required && !payload[col.key]) {
          missing.push({ index: idx, error: `${col.header} wajib diisi` });
          break;
        }
      }
      return payload;
    });
    return { payloads, missing };
  };

  const handleSubmit = async () => {
    const { payloads, missing } = buildPayloads();
    if (missing.length > 0) {
      toast({
        title: 'Ada kolom wajib yang kosong',
        description: `${missing.length} baris dilewati karena kolom bertanda * kosong.`,
        variant: 'destructive',
      });
    }
    const valid = payloads.filter((_, i) => !missing.some(m => m.index === i));
    if (valid.length === 0) return;

    setSubmitting(true);
    try {
      const res = await submitBulk(valid);
      const failed = (res?.failed || []).map(f => ({
        index: f.index,
        error: f.error || f.email && `email ${f.email}: ${f.error}` || 'gagal',
      }));
      const insertedCount = res?.inserted?.length ?? 0;
      setResult({ insertedCount, failed, skippedMissing: missing.length });
      if (insertedCount > 0) onImported?.();
    } catch (err) {
      toast({ title: 'Impor gagal', description: err.message, variant: 'destructive' });
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <Button variant="outline" className="w-full" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" /> Unduh Template Excel
            </Button>

            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFile}
                className="hidden"
                id={`excel-import-file-${slug}`}
              />
              <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Pilih Berkas Excel
              </Button>
              {fileName && (
                <p className="mt-2 text-sm text-center" style={{ color: 'hsl(var(--admin-text-secondary))' }}>
                  {fileName} — {rows.length} baris siap diimpor
                </p>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={handleClose}>Batal</Button>
              <Button onClick={handleSubmit} disabled={submitting || rows.length === 0}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengimpor...
                  </>
                ) : (
                  <>Impor {rows.length > 0 ? `${rows.length} Baris` : 'Data'}</>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span className="font-medium">{result.insertedCount} baris berhasil diimpor</span>
            </div>
            {result.skippedMissing > 0 && (
              <p className="text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                {result.skippedMissing} baris dilewati karena kolom wajib kosong.
              </p>
            )}
            {result.failed.length > 0 && (
              <div className="space-y-1 max-h-48 overflow-y-auto rounded-md border p-2">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <XCircle className="h-4 w-4" /> {result.failed.length} baris gagal:
                </div>
                {result.failed.map((f, i) => (
                  <p key={i} className="text-xs text-destructive">
                    Baris {(f.index ?? 0) + 2}: {f.error}
                  </p>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={handleClose}>Selesai</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ExcelImportDialog;
