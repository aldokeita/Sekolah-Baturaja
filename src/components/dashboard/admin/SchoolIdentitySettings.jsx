import React, { useEffect, useState } from 'react';
import { Building2, RotateCcw, Save } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DEFAULT_SCHOOL_IDENTITY,
  SCHOOL_IDENTITY_KEY,
  getSchoolIdentity,
  applySchoolIdentity,
  saveSchoolIdentity,
} from '@/lib/schoolIdentity';
import { fetchWebsiteContentMap, getPublicContentErrorMessage } from '@/lib/publicContentAdapters';

// Satu tempat untuk seluruh identitas yang tampil ke pengunjung dan ke staf.
// Aplikasi ini template, jadi pembeli harus bisa mengganti semuanya dari sini
// tanpa menyentuh kode.
const TEXT_FIELDS = [
  { key: 'name', label: 'Nama sekolah', placeholder: 'Sekolah Dasar Negeri Baturaja', hint: 'Nama resmi lengkap. Dipakai di footer, kuitansi, dan judul halaman.' },
  { key: 'shortName', label: 'Nama singkat', placeholder: 'SDN Baturaja', hint: 'Dipakai di tempat sempit seperti header dashboard.' },
  { key: 'logoAbbr', label: 'Inisial logo', placeholder: 'SDN', hint: 'Dua sampai empat huruf, tampil di kotak logo bila belum ada gambar.' },
  { key: 'tagline', label: 'Tagline', placeholder: 'Belajar dengan tenang, tumbuh dengan percaya diri.' },
  { key: 'city', label: 'Kota', placeholder: 'Baturaja' },
  { key: 'phone', label: 'Telepon', placeholder: '(0735) 320145' },
  { key: 'whatsapp', label: 'WhatsApp', placeholder: '6285xxxxxxxxx', hint: 'Boleh dikosongkan bila sekolah tidak memakai WhatsApp.' },
  { key: 'email', label: 'Email', placeholder: 'info@sekolahbta.id' },
  { key: 'website', label: 'Situs web', placeholder: 'https://sekolahbta.id' },
  { key: 'mapUrl', label: 'Tautan Google Maps', placeholder: 'https://maps.app.goo.gl/…', hint: 'Boleh dikosongkan.' },
  { key: 'officeHours', label: 'Jam layanan', placeholder: 'Senin–Jumat, 07.30–15.00' },
  { key: 'academicYear', label: 'Tahun ajaran', placeholder: '2026/2027' },
];

const AREA_FIELDS = [
  { key: 'address', label: 'Alamat', rows: 2, placeholder: 'Jalan …, Kabupaten …, Provinsi … 32111' },
  { key: 'description', label: 'Deskripsi singkat', rows: 3, hint: 'Satu paragraf pengantar untuk halaman publik.' },
  { key: 'vision', label: 'Visi', rows: 2 },
];

const SchoolIdentitySettings = () => {
  const [form, setForm] = useState(() => {
    const current = getSchoolIdentity();
    return { ...current, missions: (current.missions || []).join('\n') };
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const map = await fetchWebsiteContentMap({ keys: [SCHOOL_IDENTITY_KEY] });
        if (!active) return;
        const stored = map?.[SCHOOL_IDENTITY_KEY];
        // Terapkan ke sumber global juga, supaya header dan footer langsung ikut
        // menampilkan nilai tersimpan begitu panel ini dibuka.
        const applied = applySchoolIdentity(stored || getSchoolIdentity());
        setForm({ ...applied, missions: (applied.missions || []).join('\n') });
      } catch (error) {
        if (active) setLoadError(getPublicContentErrorMessage(error));
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!String(form.name || '').trim()) {
      toast({ title: 'Nama sekolah wajib diisi', description: 'Nama ini tampil di banyak tempat, termasuk kuitansi.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const applied = await saveSchoolIdentity(form);
      setForm({ ...applied, missions: (applied.missions || []).join('\n') });
      toast({ title: 'Tersimpan', description: 'Identitas sekolah diperbarui di seluruh aplikasi.' });
    } catch (error) {
      toast({ title: 'Gagal menyimpan', description: getPublicContentErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setForm({ ...DEFAULT_SCHOOL_IDENTITY, missions: DEFAULT_SCHOOL_IDENTITY.missions.join('\n') });
    toast({ title: 'Kembali ke bawaan', description: 'Belum tersimpan — tekan Simpan bila memang diinginkan.' });
  };

  if (isLoading) {
    return (
      <section className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-64 admin-skeleton-shimmer" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl admin-skeleton-shimmer" />)}
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
              Nama, kontak, visi, dan misi yang dipakai di halaman publik maupun dashboard. Ubah di sini,
              berlaku di seluruh aplikasi.
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

      <div className="grid grid-cols-1 gap-4">
        {AREA_FIELDS.map((field) => (
          <div key={field.key} className="admin-edit-field">
            <label htmlFor={`identitas-${field.key}`}>{field.label}</label>
            <Textarea
              id={`identitas-${field.key}`}
              rows={field.rows}
              value={form[field.key] ?? ''}
              placeholder={field.placeholder}
              onChange={(e) => setField(field.key, e.target.value)}
            />
            {field.hint && <p className="mt-1 text-xs text-muted-foreground">{field.hint}</p>}
          </div>
        ))}

        <div className="admin-edit-field">
          <label htmlFor="identitas-missions">Misi</label>
          <Textarea
            id="identitas-missions"
            rows={5}
            value={form.missions ?? ''}
            placeholder={'Satu misi per baris'}
            onChange={(e) => setField('missions', e.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">Satu baris satu misi. Baris kosong diabaikan.</p>
        </div>
      </div>
    </section>
  );
};

export default SchoolIdentitySettings;
