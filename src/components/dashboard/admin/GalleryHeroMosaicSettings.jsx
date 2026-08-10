import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Eye, EyeOff, Image as ImageIcon, Move, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_GALLERY_HERO_MOSAIC,
  GALLERY_HERO_POOL_LIMIT,
  normalizeGalleryHeroMosaic,
  normalizeGalleryPhotos,
  resolveGalleryHeroPhotos,
} from '@/lib/galleryContent';
import '@/styles/gallery-hero-mosaic-editor.css';

const PREVIEW_GRADIENTS = [
  'linear-gradient(150deg,#c6b6f6,#9fc4f8)',
  'linear-gradient(150deg,#ffc9dc,#f2a9c8)',
  'linear-gradient(150deg,#a9eede,#8fd8ec)',
  'linear-gradient(150deg,#ffe0b3,#ffc39c)',
  'linear-gradient(150deg,#d7d2ff,#b4b8f8)',
  'linear-gradient(150deg,#bbf7d0,#86efac)',
];

const GalleryHeroMosaicSettings = ({ photos, value, onChange, saveState = 'idle' }) => {
  const normalizedPhotos = useMemo(() => normalizeGalleryPhotos(photos), [photos]);
  const normalizedValue = useMemo(() => normalizeGalleryHeroMosaic(value), [value]);
  const [draft, setDraft] = useState(normalizedValue);

  useEffect(() => {
    setDraft(normalizedValue);
  }, [normalizedValue]);

  const updateDraft = (changes) => {
    const next = normalizeGalleryHeroMosaic({ ...draft, ...changes });
    setDraft(next);
    onChange(next);
  };

  const selectedPhotos = useMemo(() => {
    const photoMap = new Map(normalizedPhotos.map((photo) => [String(photo.id), photo]));
    return draft.photo_ids.map((id) => photoMap.get(String(id))).filter(Boolean);
  }, [draft.photo_ids, normalizedPhotos]);

  const availablePhotos = useMemo(() => {
    const selected = new Set(draft.photo_ids);
    return normalizedPhotos.filter((photo) => !selected.has(String(photo.id)));
  }, [draft.photo_ids, normalizedPhotos]);

  const previewPhotos = useMemo(
    () => resolveGalleryHeroPhotos(draft, normalizedPhotos),
    [draft, normalizedPhotos],
  );

  const togglePhoto = (photoId, checked) => {
    const id = String(photoId);
    if (checked) {
      if (draft.photo_ids.length >= GALLERY_HERO_POOL_LIMIT || draft.photo_ids.includes(id)) return;
      updateDraft({ photo_ids: [...draft.photo_ids, id] });
      return;
    }
    updateDraft({ photo_ids: draft.photo_ids.filter((selectedId) => selectedId !== id) });
  };

  const movePhoto = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= draft.photo_ids.length) return;
    const nextIds = [...draft.photo_ids];
    [nextIds[index], nextIds[targetIndex]] = [nextIds[targetIndex], nextIds[index]];
    updateDraft({ photo_ids: nextIds });
  };

  const resetSettings = () => updateDraft({ ...DEFAULT_GALLERY_HERO_MOSAIC });
  const saveStateLabel = saveState === 'saving'
    ? 'Menyimpan…'
    : saveState === 'success'
      ? 'Tersimpan'
      : saveState === 'error'
        ? 'Gagal menyimpan'
        : 'Belum disimpan';
  const saveStateClass = saveState === 'success'
    ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
    : saveState === 'error'
      ? 'border-destructive/30 bg-destructive/10 text-destructive'
      : saveState === 'saving'
        ? 'border-primary/30 bg-primary/10 text-primary'
        : 'border-slate-200/80 text-muted-foreground dark:border-white/10';

  return (
    <div className="admin-card space-y-5 p-4 md:col-span-2" data-testid="gallery-hero-mosaic-settings">
      <div className="flex flex-col gap-3 border-b border-slate-200/70 pb-4 dark:border-white/10 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-xl font-bold">
            <SlidersHorizontal className="h-5 w-5 text-primary" aria-hidden="true" />
            Animated Vertical Image Mosaic
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Atur foto yang mengisi animasi header Galeri tanpa mengunggah media baru. Perubahan terlihat di pratinjau ini dan disimpan bersama tombol utama.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={resetSettings}>
          <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
          Kembalikan default
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200/80 bg-background/70 p-4 dark:border-white/10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-foreground">Tampilkan mosaic pada header</p>
                <p className="mt-1 text-xs text-muted-foreground">Jika dinonaktifkan, animasi foto tidak ditampilkan pada header Galeri.</p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold" htmlFor="gallery-mosaic-enabled">
                <input
                  id="gallery-mosaic-enabled"
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(event) => updateDraft({ enabled: event.target.checked })}
                  className="h-4 w-4 accent-primary"
                />
                {draft.enabled ? <Eye className="h-4 w-4 text-primary" aria-hidden="true" /> : <EyeOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                <span>{draft.enabled ? 'Aktif' : 'Nonaktif'}</span>
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-background/70 p-4 dark:border-white/10">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-foreground">Foto yang dipakai</p>
                <p className="mt-1 text-xs text-muted-foreground">Urutan di daftar terpilih menjadi urutan dasar susunan kolom. Maksimal {GALLERY_HERO_POOL_LIMIT} foto.</p>
              </div>
              <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary" role="status">
                {draft.photo_ids.length || 'Otomatis'} / {GALLERY_HERO_POOL_LIMIT}
              </span>
            </div>

            {selectedPhotos.length > 0 ? (
              <div className="space-y-2" aria-label="Urutan foto terpilih">
                {selectedPhotos.map((photo, index) => {
                  const id = String(photo.id);
                  const photoUrl = photo.url || photo.image_url || '';
                  return (
                    <div key={id} className="flex items-center gap-3 rounded-lg border border-slate-200/80 bg-white/60 p-2 dark:border-white/10 dark:bg-white/5">
                      <span className="w-5 text-center text-xs font-bold text-muted-foreground">{index + 1}</span>
                      {photoUrl ? <img src={photoUrl} alt="" loading="lazy" className="h-12 w-16 shrink-0 rounded-md object-cover" /> : <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><ImageIcon className="h-4 w-4" aria-hidden="true" /></div>}
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{photo.caption || photo.name || `Foto ${index + 1}`}</span>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => movePhoto(index, -1)} disabled={index === 0} aria-label={`Naikkan ${photo.caption || `foto ${index + 1}`}`}>
                          <ChevronUp className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => movePhoto(index, 1)} disabled={index === selectedPhotos.length - 1} aria-label={`Turunkan ${photo.caption || `foto ${index + 1}`}`}>
                          <ChevronDown className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => togglePhoto(id, false)} aria-label={`Hapus ${photo.caption || `foto ${index + 1}`}`}>
                          <X className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-muted-foreground dark:border-white/15">
                Belum ada pilihan khusus. Header akan memakai pool foto Galeri yang valid secara otomatis.
              </div>
            )}

            {availablePhotos.length > 0 ? (
              <div className="mt-4 grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {availablePhotos.map((photo) => {
                  const id = String(photo.id);
                  const photoUrl = photo.url || photo.image_url || '';
                  const disabled = draft.photo_ids.length >= GALLERY_HERO_POOL_LIMIT;
                  return (
                    <label key={id} className={`flex items-center gap-2 rounded-lg border border-slate-200/80 p-2 transition-colors dark:border-white/10 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-muted/60'}`}>
                      <input type="checkbox" checked={false} disabled={disabled} onChange={(event) => togglePhoto(id, event.target.checked)} className="h-4 w-4 accent-primary" />
                      {photoUrl ? <img src={photoUrl} alt="" loading="lazy" className="h-10 w-14 shrink-0 rounded object-cover" /> : <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground"><ImageIcon className="h-4 w-4" aria-hidden="true" /></div>}
                      <span className="min-w-0 truncate text-xs font-medium">{photo.caption || photo.name || 'Foto tanpa judul'}</span>
                    </label>
                  );
                })}
              </div>
            ) : normalizedPhotos.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">Belum ada foto pada Galeri Kegiatan. Pratinjau akan memakai fallback warna.</p>
            ) : null}
          </div>

          <div className="grid gap-4 rounded-xl border border-slate-200/80 bg-background/70 p-4 dark:border-white/10 sm:grid-cols-3">
            <label className="space-y-2" htmlFor="gallery-mosaic-offset-x">
              <span className="flex items-center gap-2 text-sm font-semibold"><Move className="h-4 w-4 text-primary" aria-hidden="true" />Offset horizontal <output>{draft.offset_x}%</output></span>
              <input id="gallery-mosaic-offset-x" type="range" min="-24" max="24" step="1" value={draft.offset_x} onChange={(event) => updateDraft({ offset_x: event.target.value })} className="w-full accent-primary" />
              <span className="block text-[11px] text-muted-foreground">Geser seluruh kolom ke kiri atau kanan.</span>
            </label>
            <label className="space-y-2" htmlFor="gallery-mosaic-offset-y">
              <span className="flex items-center gap-2 text-sm font-semibold"><Move className="h-4 w-4 text-primary" aria-hidden="true" />Offset vertikal <output>{draft.offset_y}px</output></span>
              <input id="gallery-mosaic-offset-y" type="range" min="-120" max="120" step="4" value={draft.offset_y} onChange={(event) => updateDraft({ offset_y: event.target.value })} className="w-full accent-primary" />
              <span className="block text-[11px] text-muted-foreground">Atur titik awal keseluruhan animasi.</span>
            </label>
            <label className="space-y-2" htmlFor="gallery-mosaic-scale">
              <span className="flex items-center gap-2 text-sm font-semibold"><SlidersHorizontal className="h-4 w-4 text-primary" aria-hidden="true" />Skala <output>{draft.scale.toFixed(2)}×</output></span>
              <input id="gallery-mosaic-scale" type="range" min="0.82" max="1.2" step="0.01" value={draft.scale} onChange={(event) => updateDraft({ scale: event.target.value })} className="w-full accent-primary" />
              <span className="block text-[11px] text-muted-foreground">Perbesar atau perkecil seluruh susunan foto.</span>
            </label>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-foreground">Pratinjau langsung</p>
              <p className="text-xs text-muted-foreground">Simulasi lima kolom dan gerakan vertikal header Galeri.</p>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${saveStateClass}`} role="status">{saveStateLabel}</span>
          </div>
          <div className={`gallery-hero-mosaic-preview ${draft.enabled ? '' : 'is-disabled'}`} aria-label="Pratinjau animated vertical image mosaic">
            <div className="gallery-hero-mosaic-preview-grid" style={{ transform: `translateX(${draft.offset_x}%) translateY(${draft.offset_y}px) rotateX(14deg) rotateZ(-4deg) scale(${(1.04 * draft.scale).toFixed(3)})` }}>
              {Array.from({ length: 5 }).map((_, columnIndex) => (
                <div key={columnIndex} className={`gallery-hero-mosaic-preview-column ${columnIndex % 2 ? 'is-reverse' : ''}`} style={{ animationDuration: `${14 + columnIndex * 2}s` }}>
                  {Array.from({ length: 8 }).map((__, tileIndex) => {
                    const photo = previewPhotos.length > 0 ? previewPhotos[(columnIndex * 3 + tileIndex * 2) % previewPhotos.length] : null;
                    const photoUrl = photo?.url || photo?.image_url || '';
                    return <div key={tileIndex} className="gallery-hero-mosaic-preview-tile" style={{ backgroundImage: photoUrl ? `url("${String(photoUrl).replace(/[\\"]/g, '\\$&')}"),${PREVIEW_GRADIENTS[(columnIndex + tileIndex) % PREVIEW_GRADIENTS.length]}` : PREVIEW_GRADIENTS[(columnIndex + tileIndex) % PREVIEW_GRADIENTS.length] }} />;
                  })}
                </div>
              ))}
            </div>
            {!draft.enabled && <div className="gallery-hero-mosaic-preview-disabled"><EyeOff className="h-5 w-5" aria-hidden="true" />Mosaic nonaktif</div>}
          </div>
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />Foto gagal dimuat atau belum tersedia akan digantikan fallback warna pada halaman publik.</p>
        </div>
      </div>
    </div>
  );
};

export default GalleryHeroMosaicSettings;
