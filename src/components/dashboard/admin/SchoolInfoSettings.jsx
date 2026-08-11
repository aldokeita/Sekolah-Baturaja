import React, { useEffect, useState } from 'react';
import { Info, RotateCcw, Save } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DEFAULT_SCHOOL_IDENTITY,
  SCHOOL_IDENTITY_KEY,
  SCHOOL_INFO_KEY,
  applySchoolIdentity,
  getSchoolIdentity,
  saveSchoolInfo,
} from '@/lib/schoolIdentity';
import { fetchWebsiteContentMap, getPublicContentErrorMessage } from '@/lib/publicContentAdapters';

/**
 * Panel info sekolah — boleh disunting pembeli (peran admin).
 *
 * Semua yang ada di sini data sekolah, bukan ciri produk: kontak, alamat, jam
 * layanan, tahun ajaran, deskripsi, visi, misi, dan tujuan. Sebelumnya semuanya
 * ikut di dalam `school_identity` yang terkunci untuk penjual, sehingga pembeli
 * tidak bisa mengubah nomor teleponnya sendiri, apalagi visi sekolahnya.
 *
 * Nama sekolah, nama singkat, inisial logo, dan warna TIDAK di sini — keempatnya
 * identitas produk dan tetap milik penjual. Lihat BRAND_FIELDS di
 * src/lib/schoolIdentity.js.
 */

const TEXT_FIELDS = [
  { key: 'tagline', label: 'Tagline', placeholder: 'Belajar dengan tenang, tumbuh dengan percaya diri.' },
  { key: 'city', label: 'Kota', placeholder: 'Baturaja' },
  { key: 'phone', label: 'Telepon', placeholder: '(0735) 320145' },
  { key: 'whatsapp', label: 'WhatsApp', placeholder: '6285xxxxxxxxx', hint: 'Boleh dikosongkan bila sekolah tidak memakai WhatsApp.' },
  { key: 'email', label: 'Email', placeholder: 'info@sekolahbta.id' },
  { key: 'website', label: 'Situs web', placeholder: 'https://sekolahbta.id' },
  { key: 'mapUrl', label: 'Tautan Google Maps', placeholder: 'https://maps.app.goo.gl/…', hint: 'Boleh dikosongkan. Bila diisi, tombol "Buka peta" muncul di halaman Kontak.' },
  { key: 'officeHours', label: 'Jam layanan', placeholder: 'Senin–Jumat, 07.30–15.00' },
  { key: 'academicYear', label: 'Tahun ajaran', placeholder: '2026/2027', hint: 'Dipakai di halaman PPDB, footer, dan data pokok sekolah.' },
];

const AREA_FIELDS = [
  { key: 'address', label: 'Alamat', rows: 2, placeholder: 'Jalan …, Kabupaten …, Provinsi … 32111' },
  { key: 'description', label: 'Deskripsi singkat', rows: 3, hint: 'Pengantar satu paragraf. Tampil di halaman Profil.' },
  { key: 'vision', label: 'Visi', rows: 2, hint: 'Satu kalimat. Tampil di tab Visi pada halaman Profil.' },
];

// Field bertipe daftar: disunting sebagai teks multi-baris lalu dipecah per baris
// oleh normalizeSchoolIdentity. Harus sejalan dengan LIST_FIELDS di schoolIdentity.js.
const DAFTAR_FIELDS = [
  { key: 'missions', label: 'Misi', placeholder: 'Satu misi per baris', hint: 'Satu baris satu misi. Baris kosong diabaikan. Tampil di tab Misi pada halaman Profil.' },
  { key: 'goals', label: 'Tujuan', placeholder: 'Satu tujuan per baris', hint: 'Satu baris satu tujuan. Tampil di tab Tujuan pada halaman Profil.' },
];

const keFormulir = (identity) => ({
  ...identity,
  ...Object.fromEntries(DAFTAR_FIELDS.map(({ key }) => [key, (identity[key] || []).join('\n')])),
});

const SchoolInfoSettings = () => {
  const [form, setForm] = useState(() => keFormulir(getSchoolIdentity()));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const map = await fetchWebsiteContentMap({ keys: [SCHOOL_IDENTITY_KEY, SCHOOL_INFO_KEY] });
        if (!active) return;
        const applied = applySchoolIdentity({
          ...(map?.[SCHOOL_IDENTITY_KEY] || {}),
          ...(map?.[SCHOOL_INFO_KEY] || {}),
        });
        setForm(keFormulir(applied));
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
    setIsSaving(true);
    try {
      const applied = await saveSchoolInfo(form);
      setForm(keFormulir(applied));
      toast({ title: 'Tersimpan', description: 'Info sekolah diperbarui di seluruh aplikasi.' });
    } catch (error) {
      toast({ title: 'Gagal menyimpan', description: getPublicContentErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    // Hanya field milik panel ini yang dikembalikan; nama dan warna sekolah tidak
    // disentuh karena bukan wewenang panel ini.
    const bawaan = { ...form };
    [...TEXT_FIELDS, ...AREA_FIELDS, ...DAFTAR_FIELDS].forEach(({ key }) => {
      bawaan[key] = DEFAULT_SCHOOL_IDENTITY[key];
    });
    setForm(keFormulir(bawaan));
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
    <section className="space-y-6 rounded-lg border bg-muted/20 p-4 sm:p-6" aria-labelledby="info-sekolah">
      <div className="flex flex-col gap-4 border-b pb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="admin-panel-header-icon"><Info /></div>
          <div>
            <h4 id="info-sekolah" className="text-xl font-black text-foreground sm:text-2xl">Info Sekolah</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Kontak, alamat, jam layanan, tahun ajaran, visi, misi, dan tujuan. Berlaku di seluruh
              aplikasi — halaman Kontak, Profil, footer, halaman PPDB, dan kuitansi.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={handleReset} disabled={isSaving}>
            <RotateCcw className="mr-2 h-4 w-4" /> Kembalikan bawaan
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" /> {isSaving ? 'Menyimpan…' : 'Simpan Info Sekolah'}
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="admin-error-state" role="alert">
          <p className="text-sm font-medium">Gagal memuat info tersimpan: {loadError}</p>
          <p className="text-xs">Nilai yang tampil adalah bawaan. Menyimpan akan menimpanya.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {TEXT_FIELDS.map((field) => (
          <div key={field.key} className="admin-edit-field">
            <label htmlFor={`info-${field.key}`}>{field.label}</label>
            <Input
              id={`info-${field.key}`}
              value={form[field.key] ?? ''}
              placeholder={field.placeholder}
              onChange={(e) => setField(field.key, e.target.value)}
            />
            {field.hint && <p className="mt-1 text-xs text-muted-foreground">{field.hint}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 border-t pt-6">
        {AREA_FIELDS.map((field) => (
          <div key={field.key} className="admin-edit-field">
            <label htmlFor={`info-${field.key}`}>{field.label}</label>
            <Textarea
              id={`info-${field.key}`}
              rows={field.rows}
              value={form[field.key] ?? ''}
              placeholder={field.placeholder}
              onChange={(e) => setField(field.key, e.target.value)}
            />
            {field.hint && <p className="mt-1 text-xs text-muted-foreground">{field.hint}</p>}
          </div>
        ))}

        {DAFTAR_FIELDS.map((field) => (
          <div key={field.key} className="admin-edit-field">
            <label htmlFor={`info-${field.key}`}>{field.label}</label>
            <Textarea
              id={`info-${field.key}`}
              rows={5}
              value={form[field.key] ?? ''}
              placeholder={field.placeholder}
              onChange={(e) => setField(field.key, e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">{field.hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default SchoolInfoSettings;
