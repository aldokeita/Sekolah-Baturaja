import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, FileText, Printer, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import useSchoolIdentity from '@/hooks/useSchoolIdentity';
import { getPeriodeLabel } from '@/lib/scheduleAdapters';
import { fetchRaporKelas, getRaporErrorMessage } from '@/lib/raporAdapters';
import { LembarRapor, useAkarCetak } from '@/components/dashboard/shared/RaporCetak';
import '@/styles/rapor-cetak.css';

/**
 * Cetak rapor seluruh murid satu kelas dalam satu perintah cetak.
 *
 * Wali kelas dengan dua puluh delapan murid tidak seharusnya membuka dan menutup
 * dialog dua puluh delapan kali. Semua lembar dirender berurutan, satu murid satu
 * halaman, dan diserahkan ke printer sekaligus.
 *
 * Narasi TIDAK bisa disunting di sini — hanya dibaca dan dicetak. Menyunting dua
 * puluh delapan rapor dalam satu layar mengundang salah tulis pada murid yang
 * salah; pengisian tetap lewat dialog per murid, yang punya navigasi antarmurid.
 */
const RaporKelasCetak = ({ classId, namaKelas, open, onOpenChange }) => {
  const sekolah = useSchoolIdentity();
  const akarCetak = useAkarCetak(open);

  const [periodeList, setPeriodeList] = useState([]);
  const [periodeId, setPeriodeId] = useState('');
  const [hasil, setHasil] = useState(null);
  const [progres, setProgres] = useState({ sudah: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const muat = useCallback(async () => {
    if (!open || !classId) return;
    setIsLoading(true);
    setError(null);
    setProgres({ sudah: 0, total: 0 });
    try {
      const data = await fetchRaporKelas(classId, periodeId, (sudah, total) => {
        setProgres({ sudah, total });
      });
      setHasil(data);
      setPeriodeList(data.daftarPeriode || []);
      // Pilihan periode hanya diisi pada pemuatan pertama; kalau ditimpa setiap
      // kali, mengganti periode akan langsung dikembalikan ke periode aktif.
      setPeriodeId((sebelumnya) => sebelumnya || data.periode?.id || '');
    } catch (err) {
      setError(getRaporErrorMessage(err));
      setHasil(null);
    } finally {
      setIsLoading(false);
    }
  }, [open, classId, periodeId]);

  useEffect(() => { muat(); }, [muat]);

  const berhasil = (hasil?.rapor || []).filter((r) => !r.gagal);
  const gagal = (hasil?.rapor || []).filter((r) => r.gagal);

  const lembarSemua = (
    <>
      {berhasil.map((r, i) => (
        <div key={r.murid.id} className={i > 0 ? 'rapor-halaman-baru' : undefined}>
          <LembarRapor
            data={r}
            sekolah={sekolah}
            narasi={{
              catatan: r.catatan,
              kokurikuler: r.kokurikuler,
              ekstrakurikuler: r.ekstrakurikuler,
            }}
          />
        </div>
      ))}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="border-b p-5 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Rapor Sekelas — {namaKelas || 'Kelas'}
          </DialogTitle>
          <DialogDescription>
            Semua murid kelas ini dicetak sekaligus, satu murid satu halaman. Catatan dan deskripsi
            capaian diisi lewat tombol rapor pada masing-masing murid di panel Data Murid.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3 border-b px-5 py-3">
          <div className="min-w-48 flex-1">
            <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground" htmlFor="rapor-kelas-periode">
              Periode
            </label>
            <Select value={periodeId} onValueChange={setPeriodeId} disabled={periodeList.length === 0 || isLoading}>
              <SelectTrigger id="rapor-kelas-periode">
                <SelectValue placeholder={periodeList.length === 0 ? 'Belum ada periode' : 'Pilih periode'} />
              </SelectTrigger>
              <SelectContent>
                {periodeList.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {getPeriodeLabel(p)}{p.is_active ? ' • Aktif' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={muat} disabled={isLoading}>
            <RefreshCw className="mr-2 h-4 w-4" /> Muat ulang
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => window.print()}
            disabled={isLoading || berhasil.length === 0}
          >
            <Printer className="mr-2 h-4 w-4" /> Cetak {berhasil.length > 0 ? `${berhasil.length} rapor` : ''}
          </Button>
        </div>

        <div className="max-h-[58vh] overflow-y-auto px-5 py-3">
          {isLoading && (
            <div className="space-y-2 py-6">
              <p className="text-sm text-muted-foreground">
                Menyusun rapor {progres.sudah} dari {progres.total || '…'} murid.
              </p>
              <Progress value={progres.total ? (progres.sudah / progres.total) * 100 : 0} className="h-2" />
            </div>
          )}

          {!isLoading && error && (
            <div className="admin-error-state" role="alert">
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Kegagalan sebagian ditampilkan terang-terangan. Mencetak 26 dari 28
              rapor tanpa memberi tahu dua yang hilang adalah kegagalan senyap. */}
          {!isLoading && gagal.length > 0 && (
            <div className="admin-error-state mb-3" role="alert">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <p className="text-sm">
                {gagal.length} rapor gagal disusun dan tidak ikut tercetak:{' '}
                <strong>{gagal.map((g) => g.nama).join(', ')}</strong>.
              </p>
            </div>
          )}

          {!isLoading && !error && berhasil.length === 0 && (
            <p className="admin-table-empty py-8 text-center text-sm text-muted-foreground">
              Tidak ada murid aktif di kelas ini.
            </p>
          )}

          {!isLoading && berhasil.length > 0 && (
            <div className="rapor-pratinjau rounded-lg">{lembarSemua}</div>
          )}
        </div>

        {akarCetak && !isLoading && berhasil.length > 0
          ? createPortal(
            <div className="rapor-hanya-cetak">
              <div className="rapor-pratinjau">{lembarSemua}</div>
            </div>,
            akarCetak,
          )
          : null}
      </DialogContent>
    </Dialog>
  );
};

export default RaporKelasCetak;
