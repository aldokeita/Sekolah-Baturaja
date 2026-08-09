import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, LayoutTemplate, Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { DEFAULT_HOME_CONTENT, fetchHomeContent, saveHomeContent } from '@/lib/homeContent';
import { getPublicContentErrorMessage } from '@/lib/publicContentAdapters';
import { getStorageErrorMessage, uploadWebsiteAsset } from '@/lib/storageAdapters';

/**
 * Penyunting blok halaman depan: kartu program, testimoni, dan FAQ.
 *
 * Teks dan foto avatar testimoni disunting pembeli. Gradasi warna, ikon, dan
 * urutan animasi tetap di kode dan dipasangkan HomePage berdasarkan posisi —
 * pembeli sekolah tidak perlu memilih warna, dan tampilannya tetap konsisten.
 *
 * Blok lain di halaman depan tidak di sini karena sudah punya tempatnya sendiri:
 * foto galeri di tab Media & Galeri, berita di panel Berita.
 */

const salinBawaan = () => JSON.parse(JSON.stringify(DEFAULT_HOME_CONTENT));
const buatIdTestimoni = () => `testimonial-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const Baris = ({ nomor, onHapus, bolehHapus, children }) => (
  <div className="admin-card space-y-3 bg-background p-4">
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">#{nomor}</span>
      <Button type="button" variant="destructive" size="icon" className="h-7 w-7" onClick={onHapus} disabled={!bolehHapus} aria-label={`Hapus item ${nomor}`}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
    {children}
  </div>
);

const TestimonialAvatarPreview = ({ src, alt }) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => setHasError(false), [src]);

  if (!src || hasError) {
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted text-muted-foreground" aria-label="Belum ada foto avatar">
        <ImageIcon className="h-7 w-7" aria-hidden="true" />
      </div>
    );
  }

  return <img src={src} alt={alt} className="h-20 w-20 rounded-2xl object-cover" onError={() => setHasError(true)} />;
};

const HomeContentSettings = () => {
  const [isi, setIsi] = useState(salinBawaan);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [uploadingTestimonialIndex, setUploadingTestimonialIndex] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await fetchHomeContent();
        if (active) setIsi(stored);
      } catch (error) {
        if (active) setLoadError(getPublicContentErrorMessage(error));
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const ubahBaris = (blok, index, field, value) => setIsi((prev) => ({
    ...prev,
    [blok]: prev[blok].map((row, i) => (i === index ? { ...row, [field]: value } : row)),
  }));

  const tambahBaris = (blok, kosong) => setIsi((prev) => ({ ...prev, [blok]: [...prev[blok], kosong] }));

  const hapusBaris = (blok, index) => setIsi((prev) => ({
    ...prev,
    [blok]: prev[blok].filter((_, i) => i !== index),
  }));

  const handleTestimonialAvatarUpload = async (event, index) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingTestimonialIndex(index);
    try {
      const testimonial = isi.testimonials[index];
      const result = await uploadWebsiteAsset({
        folder: 'homepage/testimonials',
        key: testimonial?.id || `testimonial-${index + 1}`,
        file,
      });
      const avatarUrl = String(result?.publicUrl || '').trim();
      if (!avatarUrl) throw new Error('Upload berhasil, tetapi URL foto tidak tersedia.');

      ubahBaris('testimonials', index, 'avatar_url', avatarUrl);
      toast({
        title: 'Foto testimoni siap disimpan',
        description: `Foto untuk testimoni #${index + 1} sudah diunggah. Tekan “Simpan Halaman Depan” untuk menerapkannya.`,
      });
    } catch (error) {
      toast({ title: 'Upload foto gagal', description: getStorageErrorMessage(error), variant: 'destructive' });
    } finally {
      setUploadingTestimonialIndex(null);
      event.target.value = '';
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const tersimpan = await saveHomeContent(isi);
      setIsi(tersimpan);
      toast({ title: 'Tersimpan', description: 'Halaman depan diperbarui. Muat ulang halaman publik untuk melihatnya.' });
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
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl admin-skeleton-shimmer" />)}
      </section>
    );
  }

  return (
    <section className="space-y-6 rounded-lg border bg-muted/20 p-4 sm:p-6" aria-labelledby="isi-beranda">
      <div className="flex flex-col gap-4 border-b pb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="admin-panel-header-icon"><LayoutTemplate /></div>
          <div>
            <h4 id="isi-beranda" className="text-xl font-black text-foreground sm:text-2xl">Isi Halaman Depan</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Kartu program, testimoni, dan tanya jawab yang tampil di beranda. Warna dan ikonnya
              mengikuti desain secara otomatis.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={handleReset} disabled={isSaving}>
            <RotateCcw className="mr-2 h-4 w-4" /> Kembalikan bawaan
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" /> {isSaving ? 'Menyimpan…' : 'Simpan Halaman Depan'}
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="admin-error-state" role="alert">
          <p className="text-sm font-medium">Gagal memuat isi tersimpan: {loadError}</p>
          <p className="text-xs">Yang tampil adalah bawaan. Menyimpan akan menimpanya.</p>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h5 className="font-bold text-foreground">Kartu Program</h5>
          <Button type="button" size="sm" variant="outline" onClick={() => tambahBaris('program', { title: '', desc: '', tags: [] })}>
            <Plus className="mr-1 h-4 w-4" /> Tambah kartu
          </Button>
        </div>
        {isi.program.length === 0 && <p className="text-sm text-muted-foreground">Belum ada kartu. Bila dibiarkan kosong, beranda memakai kartu bawaan.</p>}
        {isi.program.map((p, i) => (
          <Baris key={i} nomor={i + 1} bolehHapus onHapus={() => hapusBaris('program', i)}>
            <div className="admin-edit-field">
              <label htmlFor={`program-judul-${i}`}>Judul</label>
              <Input id={`program-judul-${i}`} value={p.title} placeholder="Kelas I–III" onChange={(e) => ubahBaris('program', i, 'title', e.target.value)} />
            </div>
            <div className="admin-edit-field">
              <label htmlFor={`program-desc-${i}`}>Keterangan</label>
              <Textarea id={`program-desc-${i}`} rows={2} value={p.desc} onChange={(e) => ubahBaris('program', i, 'desc', e.target.value)} />
            </div>
            <div className="admin-edit-field">
              <label htmlFor={`program-tags-${i}`}>Label kecil</label>
              <Input
                id={`program-tags-${i}`}
                value={Array.isArray(p.tags) ? p.tags.join(', ') : p.tags}
                placeholder="9 rombel, Literasi dasar"
                onChange={(e) => ubahBaris('program', i, 'tags', e.target.value.split(','))}
              />
              <p className="mt-1 text-xs text-muted-foreground">Pisahkan dengan koma, maksimal empat.</p>
            </div>
          </Baris>
        ))}
      </div>

      <div className="space-y-4 border-t pt-6">
        <div className="flex items-center justify-between">
          <h5 className="font-bold text-foreground">Testimoni</h5>
          <Button type="button" size="sm" variant="outline" onClick={() => tambahBaris('testimonials', { id: buatIdTestimoni(), quote: '', name: '', role: '', avatar_url: '' })}>
            <Plus className="mr-1 h-4 w-4" /> Tambah testimoni
          </Button>
        </div>
        {isi.testimonials.map((t, i) => (
          <Baris key={i} nomor={i + 1} bolehHapus onHapus={() => hapusBaris('testimonials', i)}>
            <div className="admin-edit-field">
              <label htmlFor={`testi-kutipan-${i}`}>Kutipan</label>
              <Textarea id={`testi-kutipan-${i}`} rows={2} value={t.quote} onChange={(e) => ubahBaris('testimonials', i, 'quote', e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="admin-edit-field">
                <label htmlFor={`testi-nama-${i}`}>Nama</label>
                <Input id={`testi-nama-${i}`} value={t.name} onChange={(e) => ubahBaris('testimonials', i, 'name', e.target.value)} />
              </div>
              <div className="admin-edit-field">
                <label htmlFor={`testi-peran-${i}`}>Keterangan orang</label>
                <Input id={`testi-peran-${i}`} value={t.role} placeholder="Murid kelas VI A" onChange={(e) => ubahBaris('testimonials', i, 'role', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 items-center gap-4 border-t pt-3 sm:grid-cols-[auto_minmax(0,1fr)]">
              <TestimonialAvatarPreview src={t.avatar_url} alt={`Pratinjau foto ${t.name || `testimoni ${i + 1}`}`} />
              <div className="space-y-2">
                <label className="block text-sm font-semibold" htmlFor={`testi-avatar-${i}`}>Avatar / foto testimoni</label>
                <Input
                  id={`testi-avatar-${i}`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => handleTestimonialAvatarUpload(event, i)}
                  disabled={uploadingTestimonialIndex === i}
                />
                <p className="text-xs text-muted-foreground">JPG, PNG, atau WebP. Foto ini hanya terkait dengan testimoni #{i + 1}.</p>
                {uploadingTestimonialIndex === i && (
                  <p className="flex items-center gap-2 text-sm font-medium text-primary" role="status">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Mengunggah foto…
                  </p>
                )}
              </div>
            </div>
          </Baris>
        ))}
      </div>

      <div className="space-y-4 border-t pt-6">
        <div className="flex items-center justify-between">
          <h5 className="font-bold text-foreground">Tanya Jawab</h5>
          <Button type="button" size="sm" variant="outline" onClick={() => tambahBaris('faq', { question: '', answer: '' })}>
            <Plus className="mr-1 h-4 w-4" /> Tambah pertanyaan
          </Button>
        </div>
        {isi.faq.map((f, i) => (
          <Baris key={i} nomor={i + 1} bolehHapus onHapus={() => hapusBaris('faq', i)}>
            <div className="admin-edit-field">
              <label htmlFor={`faq-tanya-${i}`}>Pertanyaan</label>
              <Input id={`faq-tanya-${i}`} value={f.question} onChange={(e) => ubahBaris('faq', i, 'question', e.target.value)} />
            </div>
            <div className="admin-edit-field">
              <label htmlFor={`faq-jawab-${i}`}>Jawaban</label>
              <Textarea id={`faq-jawab-${i}`} rows={3} value={f.answer} onChange={(e) => ubahBaris('faq', i, 'answer', e.target.value)} />
            </div>
          </Baris>
        ))}
      </div>
    </section>
  );
};

export default HomeContentSettings;
