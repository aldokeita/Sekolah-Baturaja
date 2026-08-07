import React, { useEffect, useState } from 'react';
import { BookMarked, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { DEFAULT_PROFILE_CONTENT, fetchProfileContent, saveProfileContent } from '@/lib/profileContent';
import { getPublicContentErrorMessage } from '@/lib/publicContentAdapters';

/**
 * Penyunting halaman Profil: pembuka, riwayat, fasilitas, dan data pokok sekolah.
 *
 * Hanya teks dan angka. Gradasi, sudut putar kartu foto, dan ukuran kotak
 * fasilitas tetap di kode dan dipasangkan ProfilePage berdasarkan posisi.
 *
 * Visi, misi, dan tujuan TIDAK di sini — ketiganya bagian dari Identitas Sekolah
 * karena ikut dipakai di luar halaman Profil.
 */

const salinBawaan = () => JSON.parse(JSON.stringify(DEFAULT_PROFILE_CONTENT));

const Baris = ({ nomor, onHapus, children }) => (
  <div className="admin-card space-y-3 bg-background p-4">
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">#{nomor}</span>
      <Button type="button" variant="destructive" size="icon" className="h-7 w-7" onClick={onHapus} aria-label={`Hapus item ${nomor}`}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
    {children}
  </div>
);

const Bagian = ({ judul, keterangan, tombol, children }) => (
  <div className="space-y-4 border-t pt-6">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h5 className="font-bold text-foreground">{judul}</h5>
        {keterangan && <p className="mt-1 text-xs text-muted-foreground">{keterangan}</p>}
      </div>
      {tombol}
    </div>
    {children}
  </div>
);

const ProfileContentSettings = () => {
  const [isi, setIsi] = useState(salinBawaan);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await fetchProfileContent();
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

  // Field teks tunggal di akar isi, bukan di dalam blok hero.
  const ubahAkar = (field, value) => setIsi((prev) => ({ ...prev, [field]: value }));

  const ubahBaris = (blok, index, field, value) => setIsi((prev) => ({
    ...prev,
    [blok]: prev[blok].map((row, i) => (i === index ? { ...row, [field]: value } : row)),
  }));

  // Blok tiker dan kutipan berisi teks biasa, bukan objek.
  const ubahTeks = (blok, index, value) => setIsi((prev) => ({
    ...prev,
    [blok]: prev[blok].map((row, i) => (i === index ? value : row)),
  }));

  const tambah = (blok, kosong) => setIsi((prev) => ({ ...prev, [blok]: [...prev[blok], kosong] }));

  const hapus = (blok, index) => setIsi((prev) => ({
    ...prev,
    [blok]: prev[blok].filter((_, i) => i !== index),
  }));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const tersimpan = await saveProfileContent(isi);
      setIsi(tersimpan);
      toast({ title: 'Tersimpan', description: 'Halaman Profil diperbarui. Muat ulang halaman publik untuk melihatnya.' });
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
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl admin-skeleton-shimmer" />)}
      </section>
    );
  }

  return (
    <section className="space-y-6 rounded-lg border bg-muted/20 p-4 sm:p-6" aria-labelledby="isi-profil">
      <div className="flex flex-col gap-4 border-b pb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="admin-panel-header-icon"><BookMarked /></div>
          <div>
            <h4 id="isi-profil" className="text-xl font-black text-foreground sm:text-2xl">Isi Halaman Profil</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Pembuka, riwayat sekolah, fasilitas, dan data pokok. Visi, misi, dan tujuan diatur di
              Identitas Sekolah; daftar guru diambil otomatis dari Data Guru.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={handleReset} disabled={isSaving}>
            <RotateCcw className="mr-2 h-4 w-4" /> Kembalikan bawaan
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" /> {isSaving ? 'Menyimpan…' : 'Simpan Halaman Profil'}
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
        <h5 className="font-bold text-foreground">Pembuka Halaman</h5>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="admin-edit-field">
            <label htmlFor="profil-kicker">Label kecil di atas judul</label>
            <Input id="profil-kicker" value={isi.hero.kicker} placeholder="Sejak 1966" onChange={(e) => ubahHero('kicker', e.target.value)} />
          </div>
          <div className="admin-edit-field">
            <label htmlFor="profil-judul-atas">Baris judul pertama</label>
            <Input id="profil-judul-atas" value={isi.hero.titleTop} placeholder="Enam puluh tahun" onChange={(e) => ubahHero('titleTop', e.target.value)} />
          </div>
          <div className="admin-edit-field">
            <label htmlFor="profil-judul-utama">Baris judul kedua</label>
            <Input id="profil-judul-utama" value={isi.hero.titleMain} placeholder="mengajar anak" onChange={(e) => ubahHero('titleMain', e.target.value)} />
          </div>
          <div className="admin-edit-field">
            <label htmlFor="profil-judul-aksen">Baris judul berwarna</label>
            <Input id="profil-judul-aksen" value={isi.hero.titleAccent} placeholder="Baturaja." onChange={(e) => ubahHero('titleAccent', e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">Baris ini memakai warna aksen sekolah.</p>
          </div>
        </div>
        <div className="admin-edit-field">
          <label htmlFor="profil-cerita">Paragraf pembuka</label>
          <Textarea id="profil-cerita" rows={3} value={isi.hero.story} onChange={(e) => ubahHero('story', e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="admin-edit-field">
            <label htmlFor="profil-badge-nilai">Angka pada kartu mengapung</label>
            <Input id="profil-badge-nilai" value={isi.hero.badgeValue} placeholder="624" onChange={(e) => ubahHero('badgeValue', e.target.value)} />
          </div>
          <div className="admin-edit-field">
            <label htmlFor="profil-badge-label">Keterangan kartu mengapung</label>
            <Input id="profil-badge-label" value={isi.hero.badgeLabel} placeholder="murid hari ini" onChange={(e) => ubahHero('badgeLabel', e.target.value)} />
          </div>
        </div>
      </div>

      <Bagian
        judul="Kartu Foto Pembuka"
        keterangan="Tiga kartu miring di samping judul. Hanya keterangannya yang diubah; warna dan sudutnya mengikuti desain."
        tombol={(
          <Button type="button" size="sm" variant="outline" onClick={() => tambah('photos', { label: '' })}>
            <Plus className="mr-1 h-4 w-4" /> Tambah kartu
          </Button>
        )}
      >
        {isi.photos.map((f, i) => (
          <Baris key={i} nomor={i + 1} onHapus={() => hapus('photos', i)}>
            <div className="admin-edit-field">
              <label htmlFor={`profil-foto-${i}`}>Keterangan</label>
              <Input id={`profil-foto-${i}`} value={f.label} placeholder="Kelas pagi" onChange={(e) => ubahBaris('photos', i, 'label', e.target.value)} />
            </div>
          </Baris>
        ))}
      </Bagian>

      <Bagian
        judul="Tulisan Berjalan"
        keterangan="Deretan keterangan singkat yang bergerak di bawah pembuka."
        tombol={(
          <Button type="button" size="sm" variant="outline" onClick={() => tambah('ticker', '')}>
            <Plus className="mr-1 h-4 w-4" /> Tambah tulisan
          </Button>
        )}
      >
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {isi.ticker.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={t} placeholder="Terakreditasi A" aria-label={`Tulisan berjalan ${i + 1}`} onChange={(e) => ubahTeks('ticker', i, e.target.value)} />
              <Button type="button" variant="destructive" size="icon" className="h-9 w-9 flex-none" onClick={() => hapus('ticker', i)} aria-label={`Hapus tulisan ${i + 1}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </Bagian>

      <Bagian
        judul="Angka Ringkasan"
        keterangan="Empat angka besar di bawah pembuka. Angkanya dihitung naik dari nol saat pengunjung menggulir."
        tombol={(
          <Button type="button" size="sm" variant="outline" onClick={() => tambah('stats', { value: '', label: '', suffix: '', plain: false })}>
            <Plus className="mr-1 h-4 w-4" /> Tambah angka
          </Button>
        )}
      >
        {isi.stats.map((s, i) => (
          <Baris key={i} nomor={i + 1} onHapus={() => hapus('stats', i)}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="admin-edit-field">
                <label htmlFor={`profil-stat-nilai-${i}`}>Angka</label>
                <Input id={`profil-stat-nilai-${i}`} value={s.value} placeholder="18" onChange={(e) => ubahBaris('stats', i, 'value', e.target.value)} />
              </div>
              <div className="admin-edit-field md:col-span-2">
                <label htmlFor={`profil-stat-label-${i}`}>Keterangan</label>
                <Input id={`profil-stat-label-${i}`} value={s.label} placeholder="Rombongan belajar" onChange={(e) => ubahBaris('stats', i, 'label', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="admin-edit-field">
                <label htmlFor={`profil-stat-akhiran-${i}`}>Tambahan di belakang angka</label>
                <Input id={`profil-stat-akhiran-${i}`} value={s.suffix} placeholder=" : 1" onChange={(e) => ubahBaris('stats', i, 'suffix', e.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground">Boleh dikosongkan. Contoh: &quot; : 1&quot; untuk rasio.</p>
              </div>
              <div className="flex items-start gap-2 pt-6">
                <Checkbox id={`profil-stat-plain-${i}`} checked={Boolean(s.plain)} onCheckedChange={(v) => ubahBaris('stats', i, 'plain', Boolean(v))} />
                <label htmlFor={`profil-stat-plain-${i}`} className="cursor-pointer select-none text-sm">
                  Tanpa pemisah ribuan
                  <span className="mt-1 block text-xs text-muted-foreground">Nyalakan untuk tahun, supaya 1966 tidak tampil sebagai 1.966.</span>
                </label>
              </div>
            </div>
          </Baris>
        ))}
      </Bagian>

      <Bagian
        judul="Kutipan Kepala Sekolah"
        keterangan="Nama penanda tangannya diambil dari Data Guru, dari baris yang jabatannya memuat “Kepala Sekolah”."
        tombol={(
          <Button type="button" size="sm" variant="outline" onClick={() => tambah('quote', '')}>
            <Plus className="mr-1 h-4 w-4" /> Tambah paragraf
          </Button>
        )}
      >
        <div className="admin-edit-field">
          <label htmlFor="profil-kutipan-utama">Kalimat besar</label>
          <Textarea id="profil-kutipan-utama" rows={3} value={isi.quoteLead} onChange={(e) => ubahAkar('quoteLead', e.target.value)} />
          <p className="mt-1 text-xs text-muted-foreground">
            Apit satu frasa dengan tanda bintang untuk mewarnainya dengan aksen sekolah.
            Contoh: membawa <code>*kecepatan belajarnya sendiri*</code>.
          </p>
        </div>
        {isi.quote.map((q, i) => (
          <Baris key={i} nomor={i + 1} onHapus={() => hapus('quote', i)}>
            <div className="admin-edit-field">
              <label htmlFor={`profil-kutipan-${i}`}>Paragraf</label>
              <Textarea id={`profil-kutipan-${i}`} rows={3} value={q} onChange={(e) => ubahTeks('quote', i, e.target.value)} />
            </div>
          </Baris>
        ))}
      </Bagian>

      <Bagian
        judul="Riwayat Sekolah"
        keterangan="Garis waktu perjalanan sekolah. Urutan tampilnya mengikuti urutan di sini."
        tombol={(
          <Button type="button" size="sm" variant="outline" onClick={() => tambah('history', { year: '', text: '' })}>
            <Plus className="mr-1 h-4 w-4" /> Tambah tahun
          </Button>
        )}
      >
        {isi.history.map((h, i) => (
          <Baris key={i} nomor={i + 1} onHapus={() => hapus('history', i)}>
            <div className="admin-edit-field">
              <label htmlFor={`profil-riwayat-tahun-${i}`}>Tahun</label>
              <Input id={`profil-riwayat-tahun-${i}`} value={h.year} placeholder="1966" onChange={(e) => ubahBaris('history', i, 'year', e.target.value)} />
            </div>
            <div className="admin-edit-field">
              <label htmlFor={`profil-riwayat-teks-${i}`}>Yang terjadi</label>
              <Textarea id={`profil-riwayat-teks-${i}`} rows={2} value={h.text} onChange={(e) => ubahBaris('history', i, 'text', e.target.value)} />
            </div>
          </Baris>
        ))}
      </Bagian>

      <Bagian
        judul="Fasilitas"
        keterangan="Mosaik fasilitas di halaman Profil. Ukuran kotaknya mengikuti posisi secara otomatis."
        tombol={(
          <Button type="button" size="sm" variant="outline" onClick={() => tambah('facilities', { name: '', desc: '' })}>
            <Plus className="mr-1 h-4 w-4" /> Tambah fasilitas
          </Button>
        )}
      >
        {isi.facilities.map((f, i) => (
          <Baris key={i} nomor={i + 1} onHapus={() => hapus('facilities', i)}>
            <div className="admin-edit-field">
              <label htmlFor={`profil-fasilitas-nama-${i}`}>Nama</label>
              <Input id={`profil-fasilitas-nama-${i}`} value={f.name} placeholder="Perpustakaan" onChange={(e) => ubahBaris('facilities', i, 'name', e.target.value)} />
            </div>
            <div className="admin-edit-field">
              <label htmlFor={`profil-fasilitas-desc-${i}`}>Keterangan</label>
              <Textarea id={`profil-fasilitas-desc-${i}`} rows={2} value={f.desc} onChange={(e) => ubahBaris('facilities', i, 'desc', e.target.value)} />
            </div>
          </Baris>
        ))}
      </Bagian>

      <Bagian
        judul="Data Pokok Sekolah"
        keterangan="Bebas ditentukan sendiri: hapus baris yang tidak berlaku, tambah yang perlu. Baris tanpa nilai tidak ditampilkan di halaman. Nama sekolah, tahun ajaran, dan jam layanan sudah otomatis dari Identitas Sekolah, jadi tidak perlu ditulis lagi di sini."
        tombol={(
          <Button type="button" size="sm" variant="outline" onClick={() => tambah('registry', { label: '', value: '' })}>
            <Plus className="mr-1 h-4 w-4" /> Tambah baris
          </Button>
        )}
      >
        {isi.registry.length === 0 && (
          <p className="text-sm text-muted-foreground">Belum ada baris. Blok &quot;Data pokok sekolah&quot; tidak akan tampil di halaman Profil.</p>
        )}
        <div className="space-y-2">
          {isi.registry.map((r, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto]">
              <Input value={r.label} placeholder="NPSN" aria-label={`Nama data ${i + 1}`} onChange={(e) => ubahBaris('registry', i, 'label', e.target.value)} />
              <Input value={r.value} placeholder="10645512" aria-label={`Isi data ${i + 1}`} onChange={(e) => ubahBaris('registry', i, 'value', e.target.value)} />
              <Button type="button" variant="destructive" size="icon" className="h-9 w-9 flex-none" onClick={() => hapus('registry', i)} aria-label={`Hapus baris ${i + 1}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </Bagian>
    </section>
  );
};

export default ProfileContentSettings;
