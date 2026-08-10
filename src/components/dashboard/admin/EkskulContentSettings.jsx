import React, { useEffect, useState } from 'react';
import { Check, ChevronsUpDown, Loader2, Plus, RotateCcw, Save, Sparkles, Trash2, Upload, Users, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { DEFAULT_EKSKUL_CONTENT, HARI_OPTIONS, fetchEkskulContent, saveEkskulContent } from '@/lib/ekskulContent';
import { fetchAllSantri, fetchGuruList } from '@/lib/dataMasterAdapters';
import { getPublicContentErrorMessage } from '@/lib/publicContentAdapters';
import { getStorageErrorMessage, uploadWebsiteAsset } from '@/lib/storageAdapters';

const salinBawaan = () => JSON.parse(JSON.stringify({ hero: DEFAULT_EKSKUL_CONTENT.hero, records: DEFAULT_EKSKUL_CONTENT.records }));

const RECORD_KOSONG = {
  nama: '', bidang: '', hari: 'Senin', jam: '', pembina: '', pembina_id: '', tempat: '', terisi: 0, participant_source: 'master', santri_ids: [], kuota: 0, kelas: '', cerita: '', foto_url: '',
};

const MasterStudentPicker = ({ selectedIds = [], students = [], onChange, disabled = false, isLoading = false, error = '' }) => {
  const [open, setOpen] = useState(false);
  const ids = selectedIds.map((id) => String(id));
  const selectedSet = new Set(ids);
  const visibleSelected = students.filter((student) => selectedSet.has(String(student.id)));
  const summary = ids.length === 0
    ? 'Pilih murid dari data master'
    : `${ids.length} murid dipilih${visibleSelected.length < ids.length ? ` (${ids.length - visibleSelected.length} tidak aktif/tidak ditemukan)` : ''}`;

  const toggleStudent = (id) => {
    const key = String(id);
    const next = selectedSet.has(key)
      ? ids.filter((selectedId) => selectedId !== key)
      : [...ids, key];
    onChange(Array.from(new Set(next)));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className="w-full justify-between font-normal"
        >
          <span className="flex min-w-0 items-center gap-2 truncate text-left">
            <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{isLoading ? 'Memuat data murid…' : summary}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(420px,calc(100vw-2rem))] p-0">
        <Command>
          <CommandInput placeholder="Cari nama atau NIS…" />
          <CommandList>
            {error ? (
              <div className="p-4 text-xs text-destructive" role="alert">{error}</div>
            ) : (
              <>
                <CommandEmpty>{students.length ? 'Murid tidak ditemukan.' : 'Belum ada murid aktif.'}</CommandEmpty>
                <CommandGroup heading={`${ids.length} murid terpilih`}>
                  {students.map((student) => {
                    const key = String(student.id);
                    const selected = selectedSet.has(key);
                    const name = student.nama_lengkap || 'Murid tanpa nama';
                    const identifier = student.nis || student.nisn || '';
                    return (
                      <CommandItem
                        key={key}
                        value={[name, identifier, key].filter(Boolean).join(' ')}
                        onSelect={() => toggleStudent(key)}
                        className="items-start py-2"
                      >
                        <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-input'}`}>
                          {selected && <Check className="h-3.5 w-3.5" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{name}</span>
                          {identifier && <span className="block truncate text-xs text-muted-foreground">{identifier}</span>}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const EkskulContentSettings = () => {
  const [isi, setIsi] = useState(salinBawaan);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [uploadingRecord, setUploadingRecord] = useState(null);
  const [masterData, setMasterData] = useState({
    students: [],
    teachers: [],
    status: 'loading',
    error: '',
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await fetchEkskulContent({ publicOnly: false });
        if (active) setIsi(stored);
      } catch (error) {
        if (active) setLoadError(getPublicContentErrorMessage(error));
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      fetchAllSantri({ status: 'Aktif', notDeleted: true, order: 'nama_lengkap' }),
      fetchGuruList(),
    ]).then(([studentsResult, teachersResult]) => {
      if (!active) return;
      const students = studentsResult.status === 'fulfilled' ? (studentsResult.value || []) : [];
      const teachers = teachersResult.status === 'fulfilled' ? (teachersResult.value || []) : [];
      const errors = [
        studentsResult.status === 'rejected' ? `Murid: ${getPublicContentErrorMessage(studentsResult.reason)}` : '',
        teachersResult.status === 'rejected' ? `Guru: ${getPublicContentErrorMessage(teachersResult.reason)}` : '',
      ].filter(Boolean);
      setMasterData({
        students: [...students].sort((a, b) => (a.nama_lengkap || '').localeCompare(b.nama_lengkap || '', 'id')),
        teachers: [...teachers].sort((a, b) => (a.nama || '').localeCompare(b.nama || '', 'id')),
        status: errors.length ? 'error' : 'ready',
        error: errors.join(' '),
      });
    });
    return () => { active = false; };
  }, []);

  const ubahHero = (field, value) => setIsi((prev) => ({ ...prev, hero: { ...prev.hero, [field]: value } }));
  const ubahHeroStat = (field, value) => setIsi((prev) => ({
    ...prev,
    hero: { ...prev.hero, stats: { ...prev.hero?.stats, [field]: value } },
  }));
  const ubah = (index, field, value) => setIsi((prev) => ({
    ...prev,
    records: prev.records.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
  }));
  const ubahMurid = (index, nextIds) => {
    const santriIds = Array.from(new Set((nextIds || []).map((id) => String(id || '').trim()).filter(Boolean)));
    setIsi((prev) => ({
      ...prev,
      records: prev.records.map((r, i) => (i === index ? {
        ...r,
        santri_ids: santriIds,
        participant_source: 'master',
        terisi: santriIds.length,
      } : r)),
    }));
  };
  const ubahGuru = (index, value) => {
    const pembinaId = value === 'none' ? '' : value;
    const guru = masterData.teachers.find((item) => String(item.id) === String(pembinaId));
    setIsi((prev) => ({
      ...prev,
      records: prev.records.map((r, i) => (i === index ? { ...r, pembina_id: pembinaId, pembina: guru?.nama || '' } : r)),
    }));
  };
  const tambah = () => setIsi((prev) => ({ ...prev, records: [...prev.records, { ...RECORD_KOSONG }] }));
  const hapus = (index) => setIsi((prev) => ({ ...prev, records: prev.records.filter((_, i) => i !== index) }));

  const handleFotoUpload = async (index, event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setUploadingRecord(index);
    try {
      const { publicUrl } = await uploadWebsiteAsset({ folder: 'ekskul-images', file });
      if (!publicUrl) throw new Error('URL foto ekstrakurikuler tidak tersedia setelah upload.');
      ubah(index, 'foto_url', publicUrl);
      toast({
        title: 'Foto siap disimpan',
        description: 'Foto sudah diunggah. Tekan Simpan Ekstrakurikuler untuk menerapkannya pada kegiatan terkait.',
      });
    } catch (error) {
      toast({ title: 'Gagal mengunggah foto', description: getStorageErrorMessage(error), variant: 'destructive' });
    } finally {
      setUploadingRecord(null);
      input.value = '';
    }
  };

  const handleSave = async () => {
    if (isSaving || uploadingRecord !== null) return;
    setIsSaving(true);
    try {
      const tersimpan = await saveEkskulContent(isi);
      setIsi(tersimpan);
      toast({ title: 'Tersimpan', description: 'Halaman Ekstrakurikuler diperbarui.' });
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
    <section className="space-y-6 rounded-lg border bg-muted/20 p-4 sm:p-6" aria-labelledby="isi-ekskul">
      <div className="flex flex-col gap-4 border-b pb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="admin-panel-header-icon"><Sparkles /></div>
          <div>
            <h4 id="isi-ekskul" className="text-xl font-black text-foreground sm:text-2xl">Ekstrakurikuler</h4>
            <p className="mt-1 text-sm text-muted-foreground">Kegiatan yang tampil di halaman Ekstrakurikuler. Jumlah kegiatan, murid, dan pembina dihitung otomatis. Warna kartu dipilih otomatis.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={handleReset} disabled={isSaving || uploadingRecord !== null}><RotateCcw className="mr-2 h-4 w-4" /> Kembalikan bawaan</Button>
          <Button type="button" onClick={handleSave} disabled={isSaving || uploadingRecord !== null}><Save className="mr-2 h-4 w-4" /> {uploadingRecord !== null ? 'Menunggu upload…' : isSaving ? 'Menyimpan…' : 'Simpan Ekstrakurikuler'}</Button>
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
          <h5 className="font-bold text-foreground">Header halaman Ekstrakurikuler</h5>
          <p className="mt-1 text-xs text-muted-foreground">Semua teks pembuka dapat disunting di sini. Angka jumlah kegiatan tetap dihitung otomatis dari daftar di bawah.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="admin-edit-field">
            <label htmlFor="ekskul-hero-kicker">Label kecil</label>
            <Input id="ekskul-hero-kicker" value={isi.hero?.kicker || ''} placeholder="Sepulang sekolah" onChange={(e) => ubahHero('kicker', e.target.value)} />
          </div>
          <div className="admin-edit-field">
            <label htmlFor="ekskul-hero-year">Teks tahun ajaran</label>
            <Input id="ekskul-hero-year" value={isi.hero?.yearLabel || ''} placeholder="Tahun ajaran 2025/2026" onChange={(e) => ubahHero('yearLabel', e.target.value)} />
          </div>
          <div className="admin-edit-field">
            <label htmlFor="ekskul-hero-title">Judul utama</label>
            <Input id="ekskul-hero-title" value={isi.hero?.title || ''} placeholder="kegiatan" onChange={(e) => ubahHero('title', e.target.value)} />
          </div>
          <div className="admin-edit-field">
            <label htmlFor="ekskul-hero-suffix">Kalimat penutup judul</label>
            <Input id="ekskul-hero-suffix" value={isi.hero?.suffix || ''} placeholder="satu halaman." onChange={(e) => ubahHero('suffix', e.target.value)} />
          </div>
        </div>
        <div className="admin-edit-field max-w-3xl">
          <label htmlFor="ekskul-hero-description">Deskripsi pendukung</label>
          <Textarea id="ekskul-hero-description" rows={3} value={isi.hero?.description || ''} placeholder="Ringkasan kegiatan ekstrakurikuler sekolah." onChange={(e) => ubahHero('description', e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="admin-edit-field">
            <label htmlFor="ekskul-stat-activities">Label statistik kegiatan</label>
            <Input id="ekskul-stat-activities" value={isi.hero?.stats?.activities || ''} placeholder="kegiatan aktif" onChange={(e) => ubahHeroStat('activities', e.target.value)} />
          </div>
          <div className="admin-edit-field">
            <label htmlFor="ekskul-stat-students">Label statistik murid</label>
            <Input id="ekskul-stat-students" value={isi.hero?.stats?.students || ''} placeholder="murid terdaftar" onChange={(e) => ubahHeroStat('students', e.target.value)} />
          </div>
          <div className="admin-edit-field">
            <label htmlFor="ekskul-stat-mentors">Label statistik pembina</label>
            <Input id="ekskul-stat-mentors" value={isi.hero?.stats?.mentors || ''} placeholder="guru pembina" onChange={(e) => ubahHeroStat('mentors', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/20 p-3 text-xs" role={masterData.status === 'error' ? 'alert' : 'status'} aria-live="polite">
        {masterData.status === 'loading' && <p className="text-muted-foreground">Memuat data master murid dan guru…</p>}
        {masterData.status === 'error' && (
          <>
            <p className="font-semibold text-destructive">Data master belum seluruhnya dapat dimuat.</p>
            <p className="mt-1 text-muted-foreground">{masterData.error}</p>
            <p className="mt-1 text-muted-foreground">Data lama tetap dipertahankan. Coba buka ulang tab ini sebelum memilih data baru.</p>
          </>
        )}
        {masterData.status === 'ready' && <p className="text-muted-foreground">Data master siap: {masterData.students.length} murid aktif dan {masterData.teachers.length} guru tersedia. Statistik peserta dihitung dari murid yang dipilih.</p>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 className="font-bold text-foreground">Daftar Kegiatan ({isi.records.length})</h5>
        <Button type="button" size="sm" variant="outline" onClick={tambah}><Plus className="mr-1 h-4 w-4" /> Tambah kegiatan</Button>
      </div>

      {isi.records.length === 0 && <p className="text-xs text-muted-foreground">Daftar kosong. Halaman Ekstrakurikuler akan menampilkan keadaan kosong.</p>}

      {isi.records.map((r, i) => (
        <div key={i} className="admin-card space-y-3 bg-background p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">#{i + 1}</span>
            <Button type="button" variant="destructive" size="icon" className="h-7 w-7" onClick={() => hapus(i)} aria-label={`Hapus kegiatan ${i + 1}`}><Trash2 className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="admin-edit-field">
              <label htmlFor={`e-nama-${i}`}>Nama kegiatan</label>
              <Input id={`e-nama-${i}`} value={r.nama} placeholder="Pramuka" onChange={(e) => ubah(i, 'nama', e.target.value)} />
            </div>
            <div className="admin-edit-field">
              <label htmlFor={`e-bidang-${i}`}>Bidang</label>
              <Input id={`e-bidang-${i}`} value={r.bidang} placeholder="Kepramukaan" onChange={(e) => ubah(i, 'bidang', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="admin-edit-field">
              <label>Hari</label>
              <Select value={r.hari} onValueChange={(val) => ubah(i, 'hari', val)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{HARI_OPTIONS.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="admin-edit-field">
              <label htmlFor={`e-jam-${i}`}>Jam</label>
              <Input id={`e-jam-${i}`} value={r.jam} placeholder="15.00–16.30" onChange={(e) => ubah(i, 'jam', e.target.value)} />
            </div>
            <div className="admin-edit-field lg:col-span-2">
              <label htmlFor={`e-terisi-${i}`}>Murid terdaftar (data master)</label>
              {r.participant_source === 'legacy' ? (
                <div className="space-y-2">
                  <Input id={`e-terisi-${i}`} type="number" min="0" value={r.terisi} onChange={(e) => ubah(i, 'terisi', e.target.value)} />
                  <Button type="button" size="sm" variant="outline" onClick={() => ubahMurid(i, [])}>Mulai pilih dari master</Button>
                  <p className="text-xs text-muted-foreground">Jumlah lama dipertahankan sementara. Pilih murid master agar angka mengikuti daftar aktual.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <MasterStudentPicker
                    selectedIds={r.santri_ids || []}
                    students={masterData.students}
                    onChange={(ids) => ubahMurid(i, ids)}
                    isLoading={masterData.status === 'loading'}
                    error={masterData.status === 'error' ? masterData.error : ''}
                  />
                  <p className="text-xs text-muted-foreground">{(r.santri_ids || []).length} murid terdaftar dari data master.</p>
                </div>
              )}
            </div>
            <div className="admin-edit-field">
              <label htmlFor={`e-kuota-${i}`}>Kuota</label>
              <Input id={`e-kuota-${i}`} type="number" min="0" value={r.kuota} onChange={(e) => ubah(i, 'kuota', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="admin-edit-field">
              <label htmlFor={`e-pembina-${i}`}>Guru pembina (data master)</label>
              <Select
                value={r.pembina_id || (r.pembina ? '__legacy__' : 'none')}
                onValueChange={(value) => ubahGuru(i, value)}
                disabled={masterData.status === 'loading' || masterData.teachers.length === 0}
              >
                <SelectTrigger id={`e-pembina-${i}`}><SelectValue placeholder="Pilih guru pembina" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Belum ditentukan</SelectItem>
                  {r.pembina && !r.pembina_id && <SelectItem value="__legacy__" disabled>{r.pembina} (data lama)</SelectItem>}
                  {r.pembina_id && !masterData.teachers.some((guru) => String(guru.id) === String(r.pembina_id)) && <SelectItem value={String(r.pembina_id)} disabled>{r.pembina || 'Guru tersimpan'} (data tersimpan)</SelectItem>}
                  {masterData.teachers.map((guru) => <SelectItem key={guru.id} value={String(guru.id)}>{guru.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="admin-edit-field">
              <label htmlFor={`e-tempat-${i}`}>Tempat</label>
              <Input id={`e-tempat-${i}`} value={r.tempat} placeholder="Lapangan sekolah" onChange={(e) => ubah(i, 'tempat', e.target.value)} />
            </div>
            <div className="admin-edit-field">
              <label htmlFor={`e-kelas-${i}`}>Kelas</label>
              <Input id={`e-kelas-${i}`} value={r.kelas} placeholder="Kelas IV–VI" onChange={(e) => ubah(i, 'kelas', e.target.value)} />
            </div>
          </div>
          <div className="admin-edit-field">
            <label htmlFor={`e-cerita-${i}`}>Keterangan</label>
            <Textarea id={`e-cerita-${i}`} rows={2} value={r.cerita} onChange={(e) => ubah(i, 'cerita', e.target.value)} />
          </div>
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <label htmlFor={`e-foto-${i}`} className="text-sm font-semibold text-foreground">Foto kegiatan (opsional)</label>
                <p className="mt-1 text-xs text-muted-foreground">Foto ini tampil pada indeks dan panel kegiatan yang sedang diedit.</p>
              </div>
              <label htmlFor={`e-foto-${i}`} className="inline-flex cursor-pointer items-center rounded-md border bg-background px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-accent has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-60">
                {uploadingRecord === i ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {uploadingRecord === i ? 'Mengunggah…' : r.foto_url ? 'Ganti foto' : 'Unggah foto'}
                <input id={`e-foto-${i}`} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploadingRecord !== null} onChange={(event) => handleFotoUpload(i, event)} />
              </label>
            </div>
            {r.foto_url ? (
              <div className="relative overflow-hidden rounded-lg border bg-background">
                <img src={r.foto_url} alt={`Pratinjau foto ${r.nama || `kegiatan ${i + 1}`}`} className="h-40 w-full object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                <Button type="button" variant="secondary" size="sm" className="absolute right-2 top-2 bg-background/90" onClick={() => ubah(i, 'foto_url', '')}>
                  <X className="mr-1 h-3.5 w-3.5" /> Lepas foto
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Belum ada foto. Tampilan publik akan menggunakan latar warna bawaan.</p>
            )}
          </div>
        </div>
      ))}
    </section>
  );
};

export default EkskulContentSettings;
