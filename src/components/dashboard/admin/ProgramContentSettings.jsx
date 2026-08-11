import React, { useEffect, useState } from 'react';
import { GraduationCap, Loader2, Plus, RotateCcw, Save, Trash2, Upload, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { DEFAULT_PROGRAM_CONTENT, fetchProgramContent, saveProgramContent } from '@/lib/programContent';
import { getPublicContentErrorMessage } from '@/lib/publicContentAdapters';
import { getStorageErrorMessage, uploadWebsiteAsset } from '@/lib/storageAdapters';

const salinBawaan = () => JSON.parse(JSON.stringify({
  hero: DEFAULT_PROGRAM_CONTENT.hero,
  stats: DEFAULT_PROGRAM_CONTENT.stats,
  programs: DEFAULT_PROGRAM_CONTENT.programs,
  jam: DEFAULT_PROGRAM_CONTENT.jam,
  ritme: DEFAULT_PROGRAM_CONTENT.ritme,
}));

const PROGRAM_KOSONG = { nama: '', jenis: '', kelas: '', waktu: '', ringkas: '', cerita: '', foto_url: '', meta: [] };

const ProgramContentSettings = () => {
  const [isi, setIsi] = useState(salinBawaan);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [uploadingProgram, setUploadingProgram] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await fetchProgramContent();
        if (active) setIsi(stored);
      } catch (error) {
        if (active) setLoadError(getPublicContentErrorMessage(error));
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const ubahHero = (field, value) => setIsi((prev) => ({ ...prev, hero: { ...prev.hero, [field]: value } }));
  const ubahStat = (f, v) => setIsi((p) => ({ ...p, stats: { ...p.stats, [f]: v } }));
  const ubahList = (blok, i, f, v) => setIsi((p) => ({ ...p, [blok]: p[blok].map((row, j) => (j === i ? { ...row, [f]: v } : row)) }));
  const tambahList = (blok, kosong) => setIsi((p) => ({ ...p, [blok]: [...p[blok], kosong] }));
  const hapusList = (blok, i) => setIsi((p) => ({ ...p, [blok]: p[blok].filter((_, j) => j !== i) }));

  const ubahMeta = (pi, mi, f, v) => setIsi((p) => ({
    ...p, programs: p.programs.map((r, i) => (i === pi ? { ...r, meta: r.meta.map((m, j) => (j === mi ? { ...m, [f]: v } : m)) } : r)),
  }));
  const tambahMeta = (pi) => setIsi((p) => ({
    ...p, programs: p.programs.map((r, i) => (i === pi ? { ...r, meta: [...(r.meta || []), { label: '', value: '' }] } : r)),
  }));
  const hapusMeta = (pi, mi) => setIsi((p) => ({
    ...p, programs: p.programs.map((r, i) => (i === pi ? { ...r, meta: r.meta.filter((_, j) => j !== mi) } : r)),
  }));

  const handleProgramPhotoUpload = async (index, event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setUploadingProgram(index);
    try {
      const { publicUrl } = await uploadWebsiteAsset({ folder: 'program-images', file });
      if (!publicUrl) throw new Error('URL foto program tidak tersedia setelah upload.');
      ubahList('programs', index, 'foto_url', publicUrl);
      toast({
        title: 'Foto siap disimpan',
        description: 'Foto sudah diunggah. Tekan Simpan Program untuk menerapkannya pada item terkait.',
      });
    } catch (error) {
      toast({ title: 'Gagal mengunggah foto', description: getStorageErrorMessage(error), variant: 'destructive' });
    } finally {
      setUploadingProgram(null);
      input.value = '';
    }
  };

  const handleSave = async () => {
    if (isSaving || uploadingProgram !== null) return;
    setIsSaving(true);
    try {
      const tersimpan = await saveProgramContent(isi);
      setIsi(tersimpan);
      toast({ title: 'Tersimpan', description: 'Halaman Program diperbarui.' });
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

  const totalJp = (isi.jam || []).reduce((t, j) => t + (Number(j.jp) || 0), 0);

  return (
    <section className="space-y-6 rounded-lg border bg-muted/20 p-4 sm:p-6" aria-labelledby="isi-program">
      <div className="flex flex-col gap-4 border-b pb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="admin-panel-header-icon"><GraduationCap /></div>
          <div>
            <h4 id="isi-program" className="text-xl font-black text-foreground sm:text-2xl">Program</h4>
            <p className="mt-1 text-sm text-muted-foreground">Program pembelajaran, beban jam pelajaran, dan ritme harian di halaman Program. Jumlah program &amp; total JP dihitung otomatis.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={handleReset} disabled={isSaving || uploadingProgram !== null}><RotateCcw className="mr-2 h-4 w-4" /> Kembalikan bawaan</Button>
          <Button type="button" onClick={handleSave} disabled={isSaving || uploadingProgram !== null}><Save className="mr-2 h-4 w-4" /> {uploadingProgram !== null ? 'Menunggu upload…' : isSaving ? 'Menyimpan…' : 'Simpan Program'}</Button>
        </div>
      </div>

      {loadError && (
        <div className="admin-error-state" role="alert">
          <p className="text-sm font-medium">Gagal memuat isi tersimpan: {loadError}</p>
          <p className="text-xs">Yang tampil adalah bawaan. Menyimpan akan menimpanya.</p>
        </div>
      )}

      <div className="space-y-4 border-t pt-6">
        <div>
          <h5 className="font-bold text-foreground">Header halaman Program</h5>
          <p className="mt-1 text-xs text-muted-foreground">Judul dan teks pendukung ini tampil pada panel pembuka halaman Program publik.</p>
        </div>
        <div className="max-w-3xl space-y-4">
          <div className="admin-edit-field">
            <label htmlFor="program-hero-title">Judul utama</label>
            <Textarea id="program-hero-title" rows={2} value={isi.hero?.title || ''} placeholder={'Program belajar yang\ndijalankan setiap hari,'} onChange={(e) => ubahHero('title', e.target.value)} />
            <p className="text-xs text-muted-foreground">Gunakan baris baru bila judul ingin dibuat menjadi dua baris.</p>
          </div>
          <div className="admin-edit-field">
            <label htmlFor="program-hero-accent">Aksen judul</label>
            <Input id="program-hero-accent" value={isi.hero?.accent || ''} placeholder="bukan hanya tertulis." onChange={(e) => ubahHero('accent', e.target.value)} />
          </div>
          <div className="admin-edit-field">
            <label htmlFor="program-hero-description">Teks pendukung</label>
            <Textarea id="program-hero-description" rows={4} value={isi.hero?.description || ''} placeholder="Ringkasan singkat tentang program sekolah." onChange={(e) => ubahHero('description', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="admin-edit-field">
          <label htmlFor="prog-tema">Statistik: Tema projek per tahun</label>
          <Input id="prog-tema" type="number" min="0" value={isi.stats?.temaProjek ?? 0} onChange={(e) => ubahStat('temaProjek', e.target.value)} />
        </div>
        <div className="admin-edit-field">
          <label htmlFor="prog-murid">Statistik: Murid terlibat</label>
          <Input id="prog-murid" type="number" min="0" value={isi.stats?.muridTerlibat ?? 0} onChange={(e) => ubahStat('muridTerlibat', e.target.value)} />
        </div>
      </div>

      {/* Program utama */}
      <div className="space-y-4 border-t pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h5 className="font-bold text-foreground">Program Utama ({isi.programs.length})</h5>
          <Button type="button" size="sm" variant="outline" onClick={() => tambahList('programs', { ...PROGRAM_KOSONG })}><Plus className="mr-1 h-4 w-4" /> Tambah program</Button>
        </div>
        {isi.programs.map((r, i) => (
          <div key={i} className="admin-card space-y-3 bg-background p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">#{i + 1}</span>
              <Button type="button" variant="destructive" size="icon" className="h-7 w-7" onClick={() => hapusList('programs', i)} aria-label={`Hapus program ${i + 1}`}><Trash2 className="h-4 w-4" /></Button>
            </div>
            <div className="admin-edit-field">
              <label htmlFor={`pg-nama-${i}`}>Nama program</label>
              <Input id={`pg-nama-${i}`} value={r.nama} placeholder="Membaca pagi" onChange={(e) => ubahList('programs', i, 'nama', e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="admin-edit-field"><label htmlFor={`pg-jenis-${i}`}>Jenis</label><Input id={`pg-jenis-${i}`} value={r.jenis} placeholder="Kebiasaan" onChange={(e) => ubahList('programs', i, 'jenis', e.target.value)} /></div>
              <div className="admin-edit-field"><label htmlFor={`pg-kelas-${i}`}>Kelas</label><Input id={`pg-kelas-${i}`} value={r.kelas} placeholder="Kelas I–VI" onChange={(e) => ubahList('programs', i, 'kelas', e.target.value)} /></div>
              <div className="admin-edit-field"><label htmlFor={`pg-waktu-${i}`}>Waktu</label><Input id={`pg-waktu-${i}`} value={r.waktu} placeholder="15 menit" onChange={(e) => ubahList('programs', i, 'waktu', e.target.value)} /></div>
            </div>
            <div className="admin-edit-field"><label htmlFor={`pg-ringkas-${i}`}>Ringkasan (di kartu)</label><Textarea id={`pg-ringkas-${i}`} rows={2} value={r.ringkas} onChange={(e) => ubahList('programs', i, 'ringkas', e.target.value)} /></div>
            <div className="admin-edit-field"><label htmlFor={`pg-cerita-${i}`}>Cerita lengkap (di rincian)</label><Textarea id={`pg-cerita-${i}`} rows={3} value={r.cerita} onChange={(e) => ubahList('programs', i, 'cerita', e.target.value)} /></div>
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <label htmlFor={`pg-foto-${i}`} className="text-sm font-semibold text-foreground">Foto program (opsional)</label>
                  <p className="mt-1 text-xs text-muted-foreground">Foto ini hanya tampil pada kartu dan rincian program yang sedang diedit.</p>
                </div>
                <label htmlFor={`pg-foto-${i}`} className="inline-flex cursor-pointer items-center rounded-md border bg-background px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-accent has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-60">
                  {uploadingProgram === i ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {uploadingProgram === i ? 'Mengunggah…' : r.foto_url ? 'Ganti foto' : 'Unggah foto'}
                  <input id={`pg-foto-${i}`} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploadingProgram !== null} onChange={(event) => handleProgramPhotoUpload(i, event)} />
                </label>
              </div>
              {r.foto_url ? (
                <div className="relative overflow-hidden rounded-lg border bg-background">
                  <img src={r.foto_url} alt={`Pratinjau foto ${r.nama || `program ${i + 1}`}`} className="h-40 w-full object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                  <Button type="button" variant="secondary" size="sm" className="absolute right-2 top-2 bg-background/90" onClick={() => ubahList('programs', i, 'foto_url', '')}>
                    <X className="mr-1 h-3.5 w-3.5" /> Lepas foto
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Belum ada foto. Kartu publik akan menggunakan latar warna bawaan.</p>
              )}
            </div>
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rincian (opsional)</span>
                <Button type="button" size="sm" variant="ghost" onClick={() => tambahMeta(i)}><Plus className="mr-1 h-3 w-3" /> Tambah rincian</Button>
              </div>
              {(r.meta || []).map((m, j) => (
                <div key={j} className="flex items-center gap-2">
                  <Input value={m.label} placeholder="Waktu" aria-label={`Label rincian ${j + 1}`} onChange={(e) => ubahMeta(i, j, 'label', e.target.value)} />
                  <Input value={m.value} placeholder="07.15–07.30" aria-label={`Isi rincian ${j + 1}`} onChange={(e) => ubahMeta(i, j, 'value', e.target.value)} />
                  <Button type="button" variant="destructive" size="icon" className="h-9 w-9 flex-none" onClick={() => hapusMeta(i, j)} aria-label={`Hapus rincian ${j + 1}`}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Beban jam pelajaran */}
      <div className="space-y-4 border-t pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h5 className="font-bold text-foreground">Beban Jam Pelajaran</h5>
            <p className="mt-1 text-xs text-muted-foreground">Total saat ini <strong>{totalJp} JP</strong> per pekan.</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => tambahList('jam', { mapel: '', jp: 1 })}><Plus className="mr-1 h-4 w-4" /> Tambah mapel</Button>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {isi.jam.map((j, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={j.mapel} placeholder="Matematika" aria-label={`Mata pelajaran ${i + 1}`} onChange={(e) => ubahList('jam', i, 'mapel', e.target.value)} />
              <Input type="number" min="1" className="w-20" value={j.jp} aria-label={`JP ${i + 1}`} onChange={(e) => ubahList('jam', i, 'jp', e.target.value)} />
              <Button type="button" variant="destructive" size="icon" className="h-9 w-9 flex-none" onClick={() => hapusList('jam', i)} aria-label={`Hapus mapel ${i + 1}`}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </div>

      {/* Ritme harian */}
      <div className="space-y-4 border-t pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h5 className="font-bold text-foreground">Ritme Satu Hari</h5>
          <Button type="button" size="sm" variant="outline" onClick={() => tambahList('ritme', { jam: '', judul: '', teks: '' })}><Plus className="mr-1 h-4 w-4" /> Tambah tahap</Button>
        </div>
        {isi.ritme.map((r, i) => (
          <div key={i} className="admin-card space-y-3 bg-background p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">#{i + 1}</span>
              <Button type="button" variant="destructive" size="icon" className="h-7 w-7" onClick={() => hapusList('ritme', i)} aria-label={`Hapus tahap ${i + 1}`}><Trash2 className="h-4 w-4" /></Button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[8rem_1fr]">
              <div className="admin-edit-field"><label htmlFor={`rt-jam-${i}`}>Jam</label><Input id={`rt-jam-${i}`} value={r.jam} placeholder="07.15" onChange={(e) => ubahList('ritme', i, 'jam', e.target.value)} /></div>
              <div className="admin-edit-field"><label htmlFor={`rt-judul-${i}`}>Judul</label><Input id={`rt-judul-${i}`} value={r.judul} placeholder="Membaca pagi" onChange={(e) => ubahList('ritme', i, 'judul', e.target.value)} /></div>
            </div>
            <div className="admin-edit-field"><label htmlFor={`rt-teks-${i}`}>Keterangan</label><Textarea id={`rt-teks-${i}`} rows={2} value={r.teks} onChange={(e) => ubahList('ritme', i, 'teks', e.target.value)} /></div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default ProgramContentSettings;
