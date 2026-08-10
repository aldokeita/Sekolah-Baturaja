import React, { useEffect, useState } from 'react';
import { Award, Loader2, Plus, RotateCcw, Save, Trash2, Upload, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import {
  BIDANG_OPTIONS, DEFAULT_PRESTASI_CONTENT, TINGKAT_OPTIONS,
  fetchPrestasiContent, savePrestasiContent,
} from '@/lib/prestasiContent';
import { getPublicContentErrorMessage } from '@/lib/publicContentAdapters';
import { getStorageErrorMessage, uploadWebsiteAsset } from '@/lib/storageAdapters';

const salinBawaan = () => JSON.parse(JSON.stringify({
  stats: DEFAULT_PRESTASI_CONTENT.stats,
  records: DEFAULT_PRESTASI_CONTENT.records,
}));

const RECORD_KOSONG = {
  tahun: '', judul: '', tingkat: 'Kecamatan', peringkat: 'Juara 1',
  oleh: '', bidang: 'Akademik', cerita: '', foto_url: '', meta: [],
};

const PrestasiContentSettings = () => {
  const [isi, setIsi] = useState(salinBawaan);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [uploadingRecord, setUploadingRecord] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await fetchPrestasiContent();
        if (active) setIsi(stored);
      } catch (error) {
        if (active) setLoadError(getPublicContentErrorMessage(error));
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const ubahStat = (field, value) => setIsi((prev) => ({ ...prev, stats: { ...prev.stats, [field]: value } }));
  const ubahRecord = (index, field, value) => setIsi((prev) => ({
    ...prev,
    records: prev.records.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
  }));
  const tambahRecord = () => setIsi((prev) => ({ ...prev, records: [...prev.records, { ...RECORD_KOSONG }] }));
  const hapusRecord = (index) => setIsi((prev) => ({ ...prev, records: prev.records.filter((_, i) => i !== index) }));

  const handleFotoUpload = async (index, event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setUploadingRecord(index);
    try {
      const { publicUrl } = await uploadWebsiteAsset({ folder: 'prestasi-images', file });
      if (!publicUrl) throw new Error('URL foto perlombaan tidak tersedia setelah upload.');
      ubahRecord(index, 'foto_url', publicUrl);
      toast({
        title: 'Foto siap disimpan',
        description: 'Foto sudah diunggah. Tekan Simpan Prestasi untuk menerapkannya pada halaman publik.',
      });
    } catch (error) {
      toast({ title: 'Gagal mengunggah foto', description: getStorageErrorMessage(error), variant: 'destructive' });
    } finally {
      setUploadingRecord(null);
      input.value = '';
    }
  };

  const ubahMeta = (ri, mi, field, value) => setIsi((prev) => ({
    ...prev,
    records: prev.records.map((r, i) => (i === ri
      ? { ...r, meta: r.meta.map((m, j) => (j === mi ? { ...m, [field]: value } : m)) }
      : r)),
  }));
  const tambahMeta = (ri) => setIsi((prev) => ({
    ...prev,
    records: prev.records.map((r, i) => (i === ri ? { ...r, meta: [...(r.meta || []), { label: '', value: '' }] } : r)),
  }));
  const hapusMeta = (ri, mi) => setIsi((prev) => ({
    ...prev,
    records: prev.records.map((r, i) => (i === ri ? { ...r, meta: r.meta.filter((_, j) => j !== mi) } : r)),
  }));

  const handleSave = async () => {
    if (isSaving || uploadingRecord !== null) return;
    setIsSaving(true);
    try {
      const tersimpan = await savePrestasiContent(isi);
      setIsi(tersimpan);
      toast({ title: 'Tersimpan', description: 'Halaman Prestasi diperbarui. Muat ulang halaman publik untuk melihatnya.' });
    } catch (error) {
      toast({ title: 'Gagal menyimpan', description: getPublicContentErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setIsi(salinBawaan());
    toast({ title: 'Kembali ke bawaan', description: 'Belum tersimpan — tekan Simpan bila memang diinginkan.' });
  };

  if (isLoading) {
    return (
      <section className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-72 admin-skeleton-shimmer" />
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl admin-skeleton-shimmer" />)}
      </section>
    );
  }

  return (
    <section className="space-y-6 rounded-lg border bg-muted/20 p-4 sm:p-6" aria-labelledby="isi-prestasi">
      <div className="flex flex-col gap-4 border-b pb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="admin-panel-header-icon"><Award /></div>
          <div>
            <h4 id="isi-prestasi" className="text-xl font-black text-foreground sm:text-2xl">Prestasi</h4>
            <p className="mt-1 text-sm text-muted-foreground">Catatan prestasi yang tampil di halaman Prestasi publik. Tingkat nasional &amp; provinsi dihitung otomatis dari daftar.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={handleReset} disabled={isSaving || uploadingRecord !== null}><RotateCcw className="mr-2 h-4 w-4" /> Kembalikan bawaan</Button>
          <Button type="button" onClick={handleSave} disabled={isSaving || uploadingRecord !== null}><Save className="mr-2 h-4 w-4" /> {uploadingRecord !== null ? 'Menunggu upload…' : isSaving ? 'Menyimpan…' : 'Simpan Prestasi'}</Button>
        </div>
      </div>

      {loadError && (
        <div className="admin-error-state" role="alert">
          <p className="text-sm font-medium">Gagal memuat isi tersimpan: {loadError}</p>
          <p className="text-xs">Yang tampil adalah bawaan. Menyimpan akan menimpanya.</p>
        </div>
      )}

      <div className="admin-error-state" role="note">
        <p className="text-sm font-medium">Catatan contoh di bawah adalah placeholder — ganti dengan prestasi sekolah Anda.</p>
        <p className="text-xs">Kosongkan seluruh daftar bila belum ada prestasi untuk ditampilkan; halaman akan menampilkan keadaan kosong yang wajar.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="admin-edit-field">
          <label htmlFor="prestasi-murid">Statistik: Murid terlibat</label>
          <Input id="prestasi-murid" type="number" min="0" value={isi.stats?.muridTerlibat ?? 0} onChange={(e) => ubahStat('muridTerlibat', e.target.value)} />
        </div>
        <div className="admin-edit-field">
          <label htmlFor="prestasi-tahun">Statistik: Tahun berturut</label>
          <Input id="prestasi-tahun" type="number" min="0" value={isi.stats?.tahunBerturut ?? 0} onChange={(e) => ubahStat('tahunBerturut', e.target.value)} />
        </div>
      </div>

      <div className="space-y-4 border-t pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h5 className="font-bold text-foreground">Catatan Prestasi ({isi.records.length})</h5>
          <Button type="button" size="sm" variant="outline" onClick={tambahRecord}><Plus className="mr-1 h-4 w-4" /> Tambah prestasi</Button>
        </div>

        {isi.records.length === 0 && <p className="text-xs text-muted-foreground">Daftar kosong. Halaman Prestasi akan menampilkan keadaan kosong.</p>}

        {isi.records.map((r, i) => (
          <div key={i} className="admin-card space-y-3 bg-background p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">#{i + 1}</span>
              <Button type="button" variant="destructive" size="icon" className="h-7 w-7" onClick={() => hapusRecord(i)} aria-label={`Hapus prestasi ${i + 1}`}><Trash2 className="h-4 w-4" /></Button>
            </div>
            <div className="admin-edit-field">
              <label htmlFor={`p-judul-${i}`}>Judul prestasi</label>
              <Input id={`p-judul-${i}`} value={r.judul} placeholder="Juara 1 Lomba Cerdas Cermat" onChange={(e) => ubahRecord(i, 'judul', e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="admin-edit-field">
                <label htmlFor={`p-tahun-${i}`}>Tahun</label>
                <Input id={`p-tahun-${i}`} value={r.tahun} placeholder="2026" onChange={(e) => ubahRecord(i, 'tahun', e.target.value)} />
              </div>
              <div className="admin-edit-field">
                <label htmlFor={`p-peringkat-${i}`}>Peringkat</label>
                <Input id={`p-peringkat-${i}`} value={r.peringkat} placeholder="Juara 1" onChange={(e) => ubahRecord(i, 'peringkat', e.target.value)} />
              </div>
              <div className="admin-edit-field">
                <label>Tingkat</label>
                <Select value={r.tingkat} onValueChange={(val) => ubahRecord(i, 'tingkat', val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TINGKAT_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="admin-edit-field">
                <label>Bidang</label>
                <Select value={r.bidang} onValueChange={(val) => ubahRecord(i, 'bidang', val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{BIDANG_OPTIONS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="admin-edit-field">
              <label htmlFor={`p-oleh-${i}`}>Diraih oleh</label>
              <Input id={`p-oleh-${i}`} value={r.oleh} placeholder="Nama murid & kelas, atau tim/sekolah" onChange={(e) => ubahRecord(i, 'oleh', e.target.value)} />
            </div>
            <div className="admin-edit-field">
              <label htmlFor={`p-cerita-${i}`}>Cerita / keterangan</label>
              <Textarea id={`p-cerita-${i}`} rows={2} value={r.cerita} onChange={(e) => ubahRecord(i, 'cerita', e.target.value)} />
            </div>
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <label htmlFor={`p-foto-${i}`} className="text-sm font-semibold text-foreground">Foto perlombaan (opsional)</label>
                  <p className="mt-1 text-xs text-muted-foreground">Foto yang sama akan dipakai pada modal Prestasi dan cover Capaian Teratas di Profil.</p>
                </div>
                <label htmlFor={`p-foto-${i}`} className="inline-flex cursor-pointer items-center rounded-md border bg-background px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-accent has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-60">
                  {uploadingRecord === i ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {uploadingRecord === i ? 'Mengunggah…' : r.foto_url ? 'Ganti foto' : 'Unggah foto'}
                  <input
                    id={`p-foto-${i}`}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={uploadingRecord !== null}
                    onChange={(event) => handleFotoUpload(i, event)}
                  />
                </label>
              </div>
              {r.foto_url ? (
                <div className="relative overflow-hidden rounded-lg border bg-background">
                  <img
                    src={r.foto_url}
                    alt={`Pratinjau foto ${r.judul || `prestasi ${i + 1}`}`}
                    className="h-40 w-full object-cover"
                    onError={(event) => { event.currentTarget.style.display = 'none'; }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="absolute right-2 top-2 bg-background/90"
                    onClick={() => ubahRecord(i, 'foto_url', '')}
                  >
                    <X className="mr-1 h-3.5 w-3.5" /> Lepas foto
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Belum ada foto. Tampilan publik akan menggunakan latar fallback.</p>
              )}
            </div>
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rincian (opsional)</span>
                <Button type="button" size="sm" variant="ghost" onClick={() => tambahMeta(i)}><Plus className="mr-1 h-3 w-3" /> Tambah rincian</Button>
              </div>
              {(r.meta || []).map((m, j) => (
                <div key={j} className="flex items-center gap-2">
                  <Input value={m.label} placeholder="Penyelenggara" aria-label={`Label rincian ${j + 1}`} onChange={(e) => ubahMeta(i, j, 'label', e.target.value)} />
                  <Input value={m.value} placeholder="Dinas Pendidikan" aria-label={`Isi rincian ${j + 1}`} onChange={(e) => ubahMeta(i, j, 'value', e.target.value)} />
                  <Button type="button" variant="destructive" size="icon" className="h-9 w-9 flex-none" onClick={() => hapusMeta(i, j)} aria-label={`Hapus rincian ${j + 1}`}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default PrestasiContentSettings;
