import React, { useEffect, useState } from 'react';
import { ClipboardList, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { DEFAULT_PPDB_CONTENT, fetchPpdbContent, savePpdbContent } from '@/lib/ppdbContent';
import { getPublicContentErrorMessage } from '@/lib/publicContentAdapters';

/**
 * Penyunting halaman pendaftaran murid baru.
 *
 * Menggantikan panel "Informasi Pendaftaran" yang lama: panel itu mengelola
 * kategori "Murid TPQ (Anak)" dan "Murid Dewasa" beserta rincian biaya sekolah
 * Al-Qur'an, dan tidak dirender halaman mana pun.
 *
 * Tahun ajaran tidak ada di sini — ia diatur di Identitas Sekolah dan dipakai
 * otomatis oleh halaman PPDB, termasuk mengganti `{tahun}` pada daftar syarat.
 */

const salinBawaan = () => JSON.parse(JSON.stringify(DEFAULT_PPDB_CONTENT));

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

const PpdbContentSettings = () => {
  const [isi, setIsi] = useState(salinBawaan);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await fetchPpdbContent();
        if (active) setIsi(stored);
      } catch (error) {
        if (active) setLoadError(getPublicContentErrorMessage(error));
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const ubahAkar = (field, value) => setIsi((prev) => ({ ...prev, [field]: value }));

  const ubahBaris = (blok, index, field, value) => setIsi((prev) => ({
    ...prev,
    [blok]: prev[blok].map((row, i) => (i === index ? { ...row, [field]: value } : row)),
  }));

  // Blok minat dan requirements berisi teks biasa, bukan objek.
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
      const tersimpan = await savePpdbContent(isi);
      setIsi(tersimpan);
      toast({ title: 'Tersimpan', description: 'Halaman pendaftaran diperbarui. Muat ulang halaman publik untuk melihatnya.' });
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
    <section className="space-y-6 rounded-lg border bg-muted/20 p-4 sm:p-6" aria-labelledby="isi-ppdb">
      <div className="flex flex-col gap-4 border-b pb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="admin-panel-header-icon"><ClipboardList /></div>
          <div>
            <h4 id="isi-ppdb" className="text-xl font-black text-foreground sm:text-2xl">Informasi Pendaftaran</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Ketentuan yang tampil di halaman pendaftaran murid baru. Tahun ajarannya diambil otomatis
              dari Identitas Sekolah.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={handleReset} disabled={isSaving}>
            <RotateCcw className="mr-2 h-4 w-4" /> Kembalikan bawaan
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" /> {isSaving ? 'Menyimpan…' : 'Simpan Pendaftaran'}
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
        <h5 className="font-bold text-foreground">Pembuka</h5>
        <div className="admin-edit-field">
          <label htmlFor="ppdb-gelombang">Label gelombang</label>
          <Input id="ppdb-gelombang" value={isi.waveLabel} placeholder="Gelombang 1 · tutup 20 Agustus" onChange={(e) => ubahAkar('waveLabel', e.target.value)} />
          <p className="mt-1 text-xs text-muted-foreground">Tampil di bagian atas formulir.</p>
        </div>
        <div className="admin-edit-field">
          <label htmlFor="ppdb-intro">Kalimat pengantar</label>
          <Textarea id="ppdb-intro" rows={3} value={isi.intro} onChange={(e) => ubahAkar('intro', e.target.value)} />
        </div>
      </div>

      <Bagian
        judul="Jalur Pendaftaran"
        keterangan="Pilihan jalur pada langkah kedua formulir, beserta kuotanya."
        tombol={(
          <Button type="button" size="sm" variant="outline" onClick={() => tambah('jalur', { id: '', name: '', desc: '', kuota: 0 })}>
            <Plus className="mr-1 h-4 w-4" /> Tambah jalur
          </Button>
        )}
      >
        <div className="admin-card bg-muted/40 p-3 text-xs text-muted-foreground">
          Bawaannya mengikuti <strong>Permendikdasmen No. 3 Tahun 2025</strong> untuk SD: Domisili
          paling sedikit 70%, Afirmasi paling sedikit 15%, Mutasi paling banyak 5%. Jalur prestasi
          tidak diberlakukan untuk murid kelas satu SD. Ubah bila ketentuan daerah Anda berbeda —
          sistem tidak menegur.
        </div>
        {isi.jalur.map((j, i) => (
          <Baris key={i} nomor={i + 1} onHapus={() => hapus('jalur', i)}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_9rem]">
              <div className="admin-edit-field">
                <label htmlFor={`ppdb-jalur-nama-${i}`}>Nama jalur</label>
                <Input id={`ppdb-jalur-nama-${i}`} value={j.name} placeholder="Domisili" onChange={(e) => ubahBaris('jalur', i, 'name', e.target.value)} />
              </div>
              <div className="admin-edit-field">
                <label htmlFor={`ppdb-jalur-kuota-${i}`}>Kuota (%)</label>
                <Input
                  id={`ppdb-jalur-kuota-${i}`}
                  type="number"
                  min="0"
                  max="100"
                  value={j.kuota ?? 0}
                  onChange={(e) => ubahBaris('jalur', i, 'kuota', e.target.value)}
                />
              </div>
            </div>
            <div className="admin-edit-field">
              <label htmlFor={`ppdb-jalur-desc-${i}`}>Keterangan</label>
              <Textarea id={`ppdb-jalur-desc-${i}`} rows={2} value={j.desc} onChange={(e) => ubahBaris('jalur', i, 'desc', e.target.value)} />
            </div>
          </Baris>
        ))}
        <p className="text-xs text-muted-foreground">
          Total kuota saat ini <strong>{isi.jalur.reduce((t, j) => t + (Number(j.kuota) || 0), 0)}%</strong>.
          Persentase dihitung dari daya tampung, yaitu jumlah kapasitas seluruh kelas aktif di
          Manajemen Kelas.
        </p>
      </Bagian>

      <Bagian
        judul="Program Pendukung"
        keterangan="Pilihan minat calon murid. Boleh dikosongkan bila sekolah tidak menawarkannya."
        tombol={(
          <Button type="button" size="sm" variant="outline" onClick={() => tambah('minat', '')}>
            <Plus className="mr-1 h-4 w-4" /> Tambah program
          </Button>
        )}
      >
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {isi.minat.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={m} placeholder="Bahasa Inggris" aria-label={`Program pendukung ${i + 1}`} onChange={(e) => ubahTeks('minat', i, e.target.value)} />
              <Button type="button" variant="destructive" size="icon" className="h-9 w-9 flex-none" onClick={() => hapus('minat', i)} aria-label={`Hapus program ${i + 1}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </Bagian>

      <Bagian
        judul="Berkas yang Disiapkan"
        keterangan="Daftar centang pada langkah ketiga formulir. Pendaftar menyatakan berkas mana yang sudah siap — berkasnya tidak diunggah, tapi dibawa saat daftar ulang."
        tombol={(
          <Button type="button" size="sm" variant="outline" onClick={() => tambah('berkas', { id: '', name: '', hint: '' })}>
            <Plus className="mr-1 h-4 w-4" /> Tambah berkas
          </Button>
        )}
      >
        {isi.berkas.map((b, i) => (
          <Baris key={i} nomor={i + 1} onHapus={() => hapus('berkas', i)}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="admin-edit-field">
                <label htmlFor={`ppdb-berkas-nama-${i}`}>Nama berkas</label>
                <Input id={`ppdb-berkas-nama-${i}`} value={b.name} placeholder="Kartu keluarga" onChange={(e) => ubahBaris('berkas', i, 'name', e.target.value)} />
              </div>
              <div className="admin-edit-field">
                <label htmlFor={`ppdb-berkas-hint-${i}`}>Keterangan</label>
                <Input id={`ppdb-berkas-hint-${i}`} value={b.hint} placeholder="Fotokopi, dibawa saat daftar ulang" onChange={(e) => ubahBaris('berkas', i, 'hint', e.target.value)} />
              </div>
            </div>
          </Baris>
        ))}
      </Bagian>

      <Bagian
        judul="Jadwal"
        keterangan="Tahapan pendaftaran beserta tanggalnya."
        tombol={(
          <Button type="button" size="sm" variant="outline" onClick={() => tambah('timeline', { when: '', what: '' })}>
            <Plus className="mr-1 h-4 w-4" /> Tambah tahap
          </Button>
        )}
      >
        {isi.timeline.map((t, i) => (
          <Baris key={i} nomor={i + 1} onHapus={() => hapus('timeline', i)}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="admin-edit-field">
                <label htmlFor={`ppdb-jadwal-kapan-${i}`}>Tanggal</label>
                <Input id={`ppdb-jadwal-kapan-${i}`} value={t.when} placeholder="1 Juli – 20 Agustus" onChange={(e) => ubahBaris('timeline', i, 'when', e.target.value)} />
              </div>
              <div className="admin-edit-field">
                <label htmlFor={`ppdb-jadwal-apa-${i}`}>Kegiatan</label>
                <Input id={`ppdb-jadwal-apa-${i}`} value={t.what} placeholder="Pengisian formulir daring" onChange={(e) => ubahBaris('timeline', i, 'what', e.target.value)} />
              </div>
            </div>
          </Baris>
        ))}
      </Bagian>

      <Bagian
        judul="Yang Perlu Disiapkan"
        keterangan="Daftar syarat di sisi kanan formulir. Tulis {tahun} untuk menyisipkan tahun ajaran berjalan secara otomatis."
        tombol={(
          <Button type="button" size="sm" variant="outline" onClick={() => tambah('requirements', '')}>
            <Plus className="mr-1 h-4 w-4" /> Tambah syarat
          </Button>
        )}
      >
        <div className="space-y-2">
          {isi.requirements.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={r} placeholder="Kartu keluarga dan akta kelahiran" aria-label={`Syarat ${i + 1}`} onChange={(e) => ubahTeks('requirements', i, e.target.value)} />
              <Button type="button" variant="destructive" size="icon" className="h-9 w-9 flex-none" onClick={() => hapus('requirements', i)} aria-label={`Hapus syarat ${i + 1}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </Bagian>
    </section>
  );
};

export default PpdbContentSettings;
