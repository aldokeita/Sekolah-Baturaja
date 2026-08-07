import React, { useEffect, useState } from 'react';
import { Building2, RotateCcw, Save } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AKSEN_GRADASI,
  AKSEN_SOLID,
  DEFAULT_SCHOOL_IDENTITY,
  SCHOOL_IDENTITY_KEY,
  SCHOOL_INFO_KEY,
  applySchoolIdentity,
  getSchoolIdentity,
  saveSchoolBrand,
  turunkanPalet,
} from '@/lib/schoolIdentity';
import { fetchWebsiteContentMap, getPublicContentErrorMessage } from '@/lib/publicContentAdapters';

/**
 * Panel merek — HANYA superadmin (penjual template).
 *
 * Isinya sengaja sempit: nama sekolah, nama singkat, inisial logo, dan warna.
 * Kontak, alamat, jam layanan, tahun ajaran, visi, misi, dan tujuan pindah ke
 * panel "Info Sekolah" yang boleh disunting pembeli — semuanya data sekolah,
 * bukan ciri produk. Lihat BRAND_FIELDS di src/lib/schoolIdentity.js.
 */

const HEKS = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const TEXT_FIELDS = [
  { key: 'name', label: 'Nama sekolah', placeholder: 'Sekolah Dasar Negeri Baturaja', hint: 'Nama resmi lengkap. Dipakai di footer, kuitansi, dan judul halaman.' },
  { key: 'shortName', label: 'Nama singkat', placeholder: 'SDN Baturaja', hint: 'Dipakai di tempat sempit seperti bilah dashboard.' },
  { key: 'logoAbbr', label: 'Inisial logo', placeholder: 'SDN', hint: 'Dua sampai empat huruf, tampil di kotak logo bila belum ada gambar.' },
];

const PemilihWarna = ({ id, label, nilai, bawaan, hint, onChange }) => (
  <div className="admin-edit-field">
    <label htmlFor={id}>{label}</label>
    <div className="flex items-center gap-2">
      <Input
        type="color"
        aria-label={`${label} — pemilih warna`}
        value={HEKS.test(nilai || '') ? nilai : bawaan}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-14 cursor-pointer p-1"
      />
      <Input id={id} value={nilai ?? ''} placeholder={bawaan} onChange={(e) => onChange(e.target.value)} />
    </div>
    {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
  </div>
);

const SchoolIdentitySettings = () => {
  const [form, setForm] = useState(getSchoolIdentity);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const map = await fetchWebsiteContentMap({ keys: [SCHOOL_IDENTITY_KEY, SCHOOL_INFO_KEY] });
        if (!active) return;
        // Kedua kunci diterapkan ke sumber global supaya nav dan footer langsung
        // ikut menampilkan nilai tersimpan begitu panel ini dibuka.
        const applied = applySchoolIdentity({
          ...(map?.[SCHOOL_IDENTITY_KEY] || {}),
          ...(map?.[SCHOOL_INFO_KEY] || {}),
        });
        setForm(applied);
      } catch (error) {
        if (active) setLoadError(getPublicContentErrorMessage(error));
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const solid = form.accentMode === AKSEN_SOLID;

  // Pratinjau memakai fungsi yang sama dengan yang dipakai halaman publik, jadi
  // yang terlihat di sini persis yang akan tampil di situs.
  const palet = turunkanPalet(
    HEKS.test(form.accentColor || '') ? form.accentColor : DEFAULT_SCHOOL_IDENTITY.accentColor,
    HEKS.test(form.accentColor2 || '') ? form.accentColor2 : DEFAULT_SCHOOL_IDENTITY.accentColor2,
    form.accentMode,
  );

  const handleSave = async () => {
    if (!String(form.name || '').trim()) {
      toast({ title: 'Nama sekolah wajib diisi', description: 'Nama ini tampil di banyak tempat, termasuk kuitansi.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const applied = await saveSchoolBrand(form);
      setForm(applied);
      toast({ title: 'Tersimpan', description: 'Identitas produk diperbarui di seluruh aplikasi.' });
    } catch (error) {
      toast({ title: 'Gagal menyimpan', description: getPublicContentErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setForm((prev) => ({
      ...prev,
      name: DEFAULT_SCHOOL_IDENTITY.name,
      shortName: DEFAULT_SCHOOL_IDENTITY.shortName,
      logoAbbr: DEFAULT_SCHOOL_IDENTITY.logoAbbr,
      accentColor: DEFAULT_SCHOOL_IDENTITY.accentColor,
      accentColor2: DEFAULT_SCHOOL_IDENTITY.accentColor2,
      accentMode: DEFAULT_SCHOOL_IDENTITY.accentMode,
    }));
    toast({ title: 'Kembali ke bawaan', description: 'Belum tersimpan — tekan Simpan bila memang diinginkan.' });
  };

  if (isLoading) {
    return (
      <section className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-64 admin-skeleton-shimmer" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl admin-skeleton-shimmer" />)}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6 rounded-lg border bg-muted/20 p-4 sm:p-6" aria-labelledby="identitas-sekolah">
      <div className="flex flex-col gap-4 border-b pb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="admin-panel-header-icon"><Building2 /></div>
          <div>
            <h4 id="identitas-sekolah" className="text-xl font-black text-foreground sm:text-2xl">Identitas Sekolah</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Nama dan warna khas sekolah. Hanya peran ini yang boleh mengubahnya. Kontak, alamat, visi,
              dan misi ada di tab <strong>Info Sekolah</strong> dan boleh diubah admin.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={handleReset} disabled={isSaving}>
            <RotateCcw className="mr-2 h-4 w-4" /> Kembalikan bawaan
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" /> {isSaving ? 'Menyimpan…' : 'Simpan Identitas'}
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="admin-error-state" role="alert">
          <p className="text-sm font-medium">Gagal memuat identitas tersimpan: {loadError}</p>
          <p className="text-xs">Nilai yang tampil adalah bawaan. Menyimpan akan menimpanya.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {TEXT_FIELDS.map((field) => (
          <div key={field.key} className="admin-edit-field">
            <label htmlFor={`identitas-${field.key}`}>{field.label}</label>
            <Input
              id={`identitas-${field.key}`}
              value={form[field.key] ?? ''}
              placeholder={field.placeholder}
              onChange={(e) => setField(field.key, e.target.value)}
            />
            {field.hint && <p className="mt-1 text-xs text-muted-foreground">{field.hint}</p>}
          </div>
        ))}
      </div>

      <div className="space-y-4 border-t pt-6">
        <div>
          <h5 className="font-bold text-foreground">Warna Sekolah</h5>
          <p className="mt-1 text-xs text-muted-foreground">
            Seluruh tombol, judul bergradasi, dan penanda di situs mengikuti pilihan ini.
          </p>
        </div>

        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Jenis warna sekolah">
          {[
            { nilai: AKSEN_GRADASI, label: 'Gradasi dua warna' },
            { nilai: AKSEN_SOLID, label: 'Satu warna solid' },
          ].map((opsi) => {
            const aktif = (form.accentMode || AKSEN_GRADASI) === opsi.nilai;
            return (
              <button
                key={opsi.nilai}
                type="button"
                role="radio"
                aria-checked={aktif}
                onClick={() => setField('accentMode', opsi.nilai)}
                className={`min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${aktif ? 'border-cyan-300 bg-white/85 shadow-sm dark:border-cyan-700 dark:bg-slate-900/80' : 'border-white/70 bg-white/45 hover:bg-white/70 dark:border-slate-700/70 dark:bg-slate-900/35'}`}
              >
                {opsi.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <PemilihWarna
            id="identitas-accentColor"
            label={solid ? 'Warna sekolah' : 'Warna awal gradasi'}
            nilai={form.accentColor}
            bawaan={DEFAULT_SCHOOL_IDENTITY.accentColor}
            hint="Kode heks, contoh #6470ff."
            onChange={(v) => setField('accentColor', v)}
          />
          {/* Kotak warna kedua disembunyikan pada mode solid, bukan dinonaktifkan:
              kotak mati yang tetap terlihat mengundang pertanyaan tanpa jawaban. */}
          {!solid && (
            <PemilihWarna
              id="identitas-accentColor2"
              label="Warna akhir gradasi"
              nilai={form.accentColor2}
              bawaan={DEFAULT_SCHOOL_IDENTITY.accentColor2}
              hint="Warna tujuan gradasi. Pilih yang masih serasi dengan warna awal."
              onChange={(v) => setField('accentColor2', v)}
            />
          )}
        </div>

        <div className="admin-card space-y-3 bg-background p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pratinjau</p>
          <div
            className="flex h-14 items-center justify-center rounded-xl text-sm font-bold text-white"
            style={{ background: `linear-gradient(135deg,${palet.aksen},${palet['aksen-tengah']} 55%,${palet['aksen-ujung']})` }}
          >
            Contoh tombol
          </div>
          <div className="flex flex-wrap gap-2">
            {['aksen', 'aksen-pekat', 'aksen-tengah', 'aksen-tengah-2', 'aksen-ujung', 'aksen-hangat', 'aksen-muda', 'aksen-samar'].map((nama) => (
              <div key={nama} className="flex flex-col items-center gap-1">
                <span className="h-8 w-8 rounded-lg border border-white/70" style={{ background: palet[nama] }} title={palet[nama]} />
                <span className="text-[10px] text-muted-foreground">{palet[nama]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default SchoolIdentitySettings;
