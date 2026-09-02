import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookText, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import ConfirmationDialog from '@/components/ui/confirmation-dialog';
import { fetchJadwalList, fetchPeriodeList, getPeriodeLabel } from '@/lib/scheduleAdapters';
import {
  createJurnal, deleteJurnal, fetchJurnalList, getJurnalErrorMessage, updateJurnal,
} from '@/lib/jurnalAdapters';

/**
 * Jurnal mengajar untuk guru — satu catatan per pertemuan.
 *
 * Kelas dan mata pelajaran yang bisa dipilih diturunkan dari `jadwal_pelajaran`
 * milik guru yang sedang masuk, sumber yang sama yang dipakai backend untuk
 * menolak permintaan. Menyaring pilihan di sini hanya soal kenyamanan; kalau
 * dilewati, `jurnal.go` tetap menjawab 403.
 *
 * Kelas, mata pelajaran, periode, dan tanggal tidak bisa disunting setelah
 * tersimpan — mengubahnya sama dengan memindahkan catatan satu pertemuan menjadi
 * pertemuan lain. Yang salah dihapus lalu dicatat ulang.
 */

const hariIni = () => new Date().toLocaleDateString('en-CA');

const FORM_KOSONG = {
  id: null,
  tanggal: hariIni(),
  jamKe: '',
  materi: '',
  jumlahHadir: '',
  jumlahMurid: '',
  kendala: '',
  tindakLanjut: '',
};

const tanggalPendek = (iso) => {
  if (!iso) return '-';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short' });
};

const ModulJurnalMengajar = ({ guruId, title = 'Jurnal Mengajar' }) => {
  const { toast } = useToast();

  const [periodeList, setPeriodeList] = useState([]);
  const [periodeId, setPeriodeId] = useState('');
  const [jadwal, setJadwal] = useState([]);
  const [classId, setClassId] = useState('');
  const [mapelId, setMapelId] = useState('');

  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState(FORM_KOSONG);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [hapusTarget, setHapusTarget] = useState(null);

  const muatDasar = useCallback(async () => {
    if (!guruId) { setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);
    try {
      const daftarPeriode = await fetchPeriodeList();
      setPeriodeList(daftarPeriode || []);
      const aktif = (daftarPeriode || []).find((p) => p.is_active) || (daftarPeriode || [])[0] || null;
      setPeriodeId((sebelumnya) => sebelumnya || aktif?.id || '');
    } catch (err) {
      setError(getJurnalErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [guruId]);

  useEffect(() => { muatDasar(); }, [muatDasar]);

  useEffect(() => {
    let hidup = true;
    if (!guruId || !periodeId) return undefined;
    fetchJadwalList({ periodeId, guruId })
      .then((data) => { if (hidup) setJadwal(data || []); })
      .catch((err) => { if (hidup) setError(getJurnalErrorMessage(err)); });
    return () => { hidup = false; };
  }, [guruId, periodeId]);

  const kelasDiampu = useMemo(() => {
    const peta = new Map();
    (jadwal || []).forEach((row) => {
      if (row?.class_id && !peta.has(row.class_id)) {
        peta.set(row.class_id, { id: row.class_id, nama: row.nama_kelas || 'Kelas' });
      }
    });
    return [...peta.values()].sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  }, [jadwal]);

  const mapelDiampu = useMemo(() => {
    const peta = new Map();
    (jadwal || [])
      .filter((row) => !classId || row.class_id === classId)
      .forEach((row) => {
        if (row?.mata_pelajaran_id && !peta.has(row.mata_pelajaran_id)) {
          peta.set(row.mata_pelajaran_id, {
            id: row.mata_pelajaran_id,
            nama: row.mata_pelajaran_nama || 'Mata pelajaran',
          });
        }
      });
    return [...peta.values()].sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  }, [jadwal, classId]);

  useEffect(() => {
    if (!classId && kelasDiampu.length > 0) setClassId(kelasDiampu[0].id);
  }, [kelasDiampu, classId]);

  useEffect(() => {
    if (mapelDiampu.length === 0) { setMapelId(''); return; }
    if (!mapelDiampu.some((m) => m.id === mapelId)) setMapelId(mapelDiampu[0].id);
  }, [mapelDiampu, mapelId]);

  const muatJurnal = useCallback(async () => {
    if (!guruId || !periodeId) { setRows([]); return; }
    setError(null);
    try {
      // Disaring per periode saja, bukan per kelas: guru ingin melihat seluruh
      // jurnalnya berurutan tanggal, bukan satu kelas dalam satu waktu.
      setRows(await fetchJurnalList({ periodeId, limit: 100 }));
    } catch (err) {
      setError(getJurnalErrorMessage(err));
      setRows([]);
    }
  }, [guruId, periodeId]);

  useEffect(() => { muatJurnal(); }, [muatJurnal]);

  const bukaTambah = () => { setForm(FORM_KOSONG); setIsFormOpen(true); };

  const bukaEdit = (row) => {
    setForm({
      id: row.id,
      tanggal: String(row.tanggal || '').slice(0, 10),
      jamKe: row.jam_ke || '',
      materi: row.materi || '',
      jumlahHadir: row.jumlah_hadir ?? '',
      jumlahMurid: row.jumlah_murid ?? '',
      kendala: row.kendala || '',
      tindakLanjut: row.tindak_lanjut || '',
    });
    setIsFormOpen(true);
  };

  const simpan = async () => {
    if (!String(form.materi || '').trim()) {
      toast({ title: 'Belum lengkap', description: 'Materi yang diajarkan wajib diisi.', variant: 'destructive' });
      return;
    }
    if (!form.id && (!classId || !mapelId || !periodeId)) {
      toast({ title: 'Belum lengkap', description: 'Pilih kelas dan mata pelajaran terlebih dahulu.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      if (form.id) {
        await updateJurnal(form.id, form);
        toast({ title: 'Jurnal diperbarui' });
      } else {
        await createJurnal({ ...form, classId, mataPelajaranId: mapelId, periodeId });
        toast({ title: 'Jurnal tersimpan' });
      }
      setIsFormOpen(false);
      setForm(FORM_KOSONG);
      await muatJurnal();
    } catch (err) {
      toast({ title: 'Gagal', description: getJurnalErrorMessage(err), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const hapus = async () => {
    if (!hapusTarget) return;
    try {
      await deleteJurnal(hapusTarget.id);
      toast({ title: 'Jurnal dihapus' });
      await muatJurnal();
    } catch (err) {
      toast({ title: 'Gagal', description: getJurnalErrorMessage(err), variant: 'destructive' });
    } finally {
      setHapusTarget(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-2 text-base font-bold">
          <BookText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> {title}
        </h3>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {periodeList.length > 0 && (
            <Select value={periodeId} onValueChange={setPeriodeId}>
              <SelectTrigger className="h-9 w-48"><SelectValue placeholder="Periode" /></SelectTrigger>
              <SelectContent>
                {periodeList.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {getPeriodeLabel(p)}{p.is_active ? ' • Aktif' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button type="button" size="sm" variant="outline" onClick={muatJurnal}>
            <RefreshCw className="mr-2 h-4 w-4" /> Muat ulang
          </Button>
          <Button type="button" size="sm" onClick={bukaTambah} disabled={kelasDiampu.length === 0}>
            <Plus className="mr-2 h-4 w-4" /> Tulis jurnal
          </Button>
        </div>
      </div>

      {error && (
        <div className="admin-error-state mb-3" role="alert">
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Guru tanpa jadwal tidak bisa menulis jurnal, dan itu bukan kegagalan
          yang bisa ia perbaiki sendiri — jadwal disusun admin. Sebutkan sebabnya
          alih-alih menampilkan tombol yang selalu ditolak. */}
      {kelasDiampu.length === 0 && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          Belum ada jadwal mengajar untuk periode ini, jadi jurnal belum bisa ditulis. Jadwal disusun
          admin di panel Jadwal Pelajaran.
        </p>
      )}

      {kelasDiampu.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Kelas" /></SelectTrigger>
            <SelectContent>
              {kelasDiampu.map((k) => <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={mapelId} onValueChange={setMapelId}>
            <SelectTrigger className="h-9 w-56"><SelectValue placeholder="Mata pelajaran" /></SelectTrigger>
            <SelectContent>
              {mapelDiampu.map((m) => <SelectItem key={m.id} value={m.id}>{m.nama}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="self-center text-xs text-muted-foreground">
            Pilihan ini dipakai saat menulis jurnal baru.
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <tr>
              <th className="px-3 py-2 font-semibold">Tanggal</th>
              <th className="px-3 py-2 font-semibold">Kelas · Mapel</th>
              <th className="px-3 py-2 font-semibold">Materi</th>
              <th className="px-3 py-2 font-semibold">Hadir</th>
              <th className="px-3 py-2 text-right font-semibold">Tindakan</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  Belum ada jurnal pada periode ini.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-t align-top">
                <td className="whitespace-nowrap px-3 py-2">
                  {tanggalPendek(row.tanggal)}
                  {row.jam_ke ? <span className="text-muted-foreground"> · jam {row.jam_ke}</span> : null}
                </td>
                <td className="px-3 py-2">
                  {row.nama_kelas}
                  <span className="text-muted-foreground"> · {row.mata_pelajaran_nama}</span>
                </td>
                <td className="px-3 py-2">
                  {row.materi}
                  {row.kendala ? (
                    <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">Kendala: {row.kendala}</p>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {row.jumlah_hadir ?? '-'}
                  {row.jumlah_murid ? <span className="text-muted-foreground">/{row.jumlah_murid}</span> : null}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <Button type="button" size="sm" variant="ghost" onClick={() => bukaEdit(row)} title="Ubah jurnal">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setHapusTarget(row)} title="Hapus jurnal">
                      <Trash2 className="h-3.5 w-3.5 text-red-600" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Ubah jurnal' : 'Tulis jurnal'}</DialogTitle>
            <DialogDescription>
              {form.id
                ? 'Kelas, mata pelajaran, dan tanggal tidak bisa diubah. Jurnal yang salah pertemuannya dihapus lalu dicatat ulang.'
                : 'Satu catatan untuk satu pertemuan. Kelas dan mata pelajaran mengikuti pilihan di atas.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Tanggal</label>
                <Input
                  type="date"
                  value={form.tanggal}
                  disabled={Boolean(form.id)}
                  onChange={(e) => setForm((f) => ({ ...f, tanggal: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Jam ke</label>
                <Input
                  placeholder="1-2"
                  value={form.jamKe}
                  onChange={(e) => setForm((f) => ({ ...f, jamKe: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Materi yang diajarkan</label>
              <Textarea
                rows={2}
                value={form.materi}
                onChange={(e) => setForm((f) => ({ ...f, materi: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Murid hadir</label>
                <Input
                  type="number" min="0"
                  value={form.jumlahHadir}
                  onChange={(e) => setForm((f) => ({ ...f, jumlahHadir: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Jumlah murid</label>
                <Input
                  type="number" min="0"
                  value={form.jumlahMurid}
                  onChange={(e) => setForm((f) => ({ ...f, jumlahMurid: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Kendala</label>
              <Textarea
                rows={2}
                placeholder="Boleh dikosongkan."
                value={form.kendala}
                onChange={(e) => setForm((f) => ({ ...f, kendala: e.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Tindak lanjut</label>
              <Textarea
                rows={2}
                placeholder="Boleh dikosongkan."
                value={form.tindakLanjut}
                onChange={(e) => setForm((f) => ({ ...f, tindakLanjut: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Batal</Button>
            <Button type="button" onClick={simpan} disabled={isSaving}>
              {isSaving ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        isOpen={Boolean(hapusTarget)}
        onClose={() => setHapusTarget(null)}
        onConfirm={hapus}
        title="Hapus jurnal ini?"
        description={hapusTarget
          ? `Jurnal ${hapusTarget.nama_kelas} · ${hapusTarget.mata_pelajaran_nama} tanggal ${tanggalPendek(hapusTarget.tanggal)} akan dihapus.`
          : ''}
      />
    </div>
  );
};

export default ModulJurnalMengajar;
