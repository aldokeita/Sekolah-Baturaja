import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Ban, FileText, Filter, Mail, Plus, Printer, RefreshCw, Search, Settings, UserMinus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import ConfirmationDialog from '@/components/ui/confirmation-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { canManageRole } from '@/lib/roles';
import { fetchSantriList } from '@/lib/dataMasterAdapters';
import { APP_CONFIG_KEYS, fetchAppConfig, upsertAppConfig } from '@/lib/appConfigAdapters';
import {
  JENIS_SURAT, batalkanSurat, createSurat, fetchSuratList, getSuratErrorMessage,
  labelJenisSurat, mutasiKeluarSantri,
} from '@/lib/suratAdapters';
import SuratCetak from '@/components/dashboard/shared/SuratCetak';

/**
 * Agenda surat keluar sekolah, beserta mutasi keluar murid.
 *
 * Keduanya satu panel karena satu pekerjaan: murid pindah, dan surat pindahnya
 * terbit dari peristiwa itu. Memisahkannya berarti petugas mencatat mutasi di
 * satu layar lalu mencari layar lain untuk suratnya.
 *
 * Nomor surat tidak pernah diketik di sini — lihat catatan di suratAdapters.js.
 */

const ALASAN_KELUAR = ['Pindah', 'Lulus', 'Berhenti', 'Meninggal'];

const tanggalPendek = (iso) => {
  if (!iso) return '-';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

const hariIni = () => new Date().toLocaleDateString('en-CA');

const FORM_KOSONG = {
  jenis: 'keterangan_aktif',
  santriId: '',
  penerima: '',
  keperluan: '',
  isi: '',
  tanggalSurat: hariIni(),
};

const MUTASI_KOSONG = {
  santriId: '',
  tanggalKeluar: hariIni(),
  alasanKeluar: 'Pindah',
  sekolahTujuan: '',
  keterangan: '',
  buatSurat: true,
};

const SuratManagement = () => {
  const { role } = useAuth();
  const canManage = canManageRole(role);

  const [daftar, setDaftar] = useState([]);
  const [murid, setMurid] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filter, setFilter] = useState({ jenis: 'semua', search: '', hanyaBerlaku: false });
  const [pencarianTertunda, setPencarianTertunda] = useState('');

  const [formTerbuka, setFormTerbuka] = useState(false);
  const [form, setForm] = useState(FORM_KOSONG);
  const [menyimpan, setMenyimpan] = useState(false);

  const [mutasiTerbuka, setMutasiTerbuka] = useState(false);
  const [mutasi, setMutasi] = useState(MUTASI_KOSONG);

  const [suratDilihat, setSuratDilihat] = useState(null);
  const [konfirmasi, setKonfirmasi] = useState({ isOpen: false, title: '', description: '', onConfirm: () => {} });

  const [pengaturanTerbuka, setPengaturanTerbuka] = useState(false);
  const [pengaturan, setPengaturan] = useState({ kode_sekolah: '', kop_baris: '', klasifikasi: {} });

  // Pencarian ditunda supaya tidak memanggil server pada setiap ketikan.
  useEffect(() => {
    const t = setTimeout(() => setFilter((f) => ({ ...f, search: pencarianTertunda })), 400);
    return () => clearTimeout(t);
  }, [pencarianTertunda]);

  const muat = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [surat, daftarMurid] = await Promise.all([
        fetchSuratList({
          jenis: filter.jenis === 'semua' ? '' : filter.jenis,
          search: filter.search,
          hanyaBerlaku: filter.hanyaBerlaku,
        }),
        fetchSantriList({ activeOnly: true, notDeleted: true, order: 'nama', limit: 200 }).catch(() => []),
      ]);
      setDaftar(surat);
      setMurid(daftarMurid);
    } catch (err) {
      setError(getSuratErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [filter.jenis, filter.search, filter.hanyaBerlaku]);

  useEffect(() => { muat(); }, [muat]);

  useEffect(() => {
    fetchAppConfig(APP_CONFIG_KEYS.SURAT)
      .then((cfg) => {
        if (!cfg) return;
        setPengaturan({
          kode_sekolah: cfg.kode_sekolah || '',
          kop_baris: Array.isArray(cfg.kop_baris) ? cfg.kop_baris.join('\n') : '',
          klasifikasi: cfg.klasifikasi || {},
        });
      })
      .catch(() => { /* pemasangan baru belum punya konfigurasi; bawaan dipakai */ });
  }, []);

  const jenisTerpilih = useMemo(
    () => JENIS_SURAT.find((j) => j.value === form.jenis) || JENIS_SURAT[0],
    [form.jenis],
  );

  const simpanSurat = async () => {
    if (jenisTerpilih.butuhMurid && !form.santriId) {
      toast({ title: 'Belum lengkap', description: 'Pilih murid yang menjadi pokok surat.', variant: 'destructive' });
      return;
    }
    setMenyimpan(true);
    try {
      const hasil = await createSurat({
        jenis: form.jenis,
        santriId: form.santriId || null,
        perihal: jenisTerpilih.perihal,
        penerima: form.penerima,
        isi: form.isi,
        tanggalSurat: form.tanggalSurat,
        data: form.keperluan ? { keperluan: form.keperluan } : {},
      });
      toast({ title: 'Surat diterbitkan', description: `Nomor ${hasil?.nomor || 'baru'} tercatat di agenda.` });
      setFormTerbuka(false);
      setForm(FORM_KOSONG);
      await muat();
      // Langsung dibuka: yang dicari petugas setelah menyimpan adalah lembar
      // cetaknya, bukan barisnya di daftar.
      if (hasil) setSuratDilihat(hasil);
    } catch (err) {
      toast({ title: 'Gagal', description: getSuratErrorMessage(err), variant: 'destructive' });
    } finally {
      setMenyimpan(false);
    }
  };

  const simpanMutasi = async () => {
    if (!mutasi.santriId) {
      toast({ title: 'Belum lengkap', description: 'Pilih murid yang keluar.', variant: 'destructive' });
      return;
    }
    const namaMurid = murid.find((m) => m.id === mutasi.santriId)?.nama_lengkap || 'Murid';
    setKonfirmasi({
      isOpen: true,
      title: `Catat ${namaMurid} keluar dari sekolah?`,
      description: `${namaMurid} akan dinonaktifkan dan dipindahkan ke arsip dengan tanggal keluar ${tanggalPendek(mutasi.tanggalKeluar)}. `
        + `Seluruh riwayatnya tetap tersimpan dan bisa dipulihkan.${mutasi.buatSurat ? ' Surat pindah beserta nomornya akan diterbitkan sekaligus.' : ''}`,
      onConfirm: async () => {
        setMenyimpan(true);
        try {
          const hasil = await mutasiKeluarSantri(mutasi.santriId, mutasi);
          toast({
            title: 'Mutasi tercatat',
            description: hasil?.surat?.nomor
              ? `Surat ${hasil.surat.nomor} diterbitkan.`
              : `${namaMurid} tercatat keluar.`,
          });
          setMutasiTerbuka(false);
          setMutasi(MUTASI_KOSONG);
          await muat();
          if (hasil?.surat) setSuratDilihat(hasil.surat);
        } catch (err) {
          toast({ title: 'Gagal', description: getSuratErrorMessage(err), variant: 'destructive' });
        } finally {
          setMenyimpan(false);
        }
      },
    });
  };

  const batalkan = (surat) => {
    setKonfirmasi({
      isOpen: true,
      title: `Batalkan surat ${surat.nomor}?`,
      description: 'Surat tetap tercatat di agenda beserta nomornya — nomor surat tidak boleh lompat. '
        + 'Yang berubah hanya statusnya menjadi dibatalkan, dan lembar cetaknya diberi cap pembatalan.',
      onConfirm: async () => {
        try {
          await batalkanSurat(surat.id, 'Dibatalkan petugas');
          toast({ title: 'Surat dibatalkan', description: `${surat.nomor} tidak lagi berlaku.` });
          await muat();
        } catch (err) {
          toast({ title: 'Gagal', description: getSuratErrorMessage(err), variant: 'destructive' });
        }
      },
    });
  };

  const simpanPengaturan = async () => {
    try {
      await upsertAppConfig(APP_CONFIG_KEYS.SURAT, {
        kode_sekolah: pengaturan.kode_sekolah.trim(),
        kop_baris: pengaturan.kop_baris.split('\n').map((b) => b.trim()).filter(Boolean),
        klasifikasi: pengaturan.klasifikasi,
      });
      toast({
        title: 'Pengaturan disimpan',
        description: 'Berlaku untuk surat yang diterbitkan setelah ini. Surat lama tetap memakai nomor yang sudah keluar.',
      });
      setPengaturanTerbuka(false);
    } catch (err) {
      toast({ title: 'Gagal', description: getSuratErrorMessage(err), variant: 'destructive' });
    }
  };

  return (
    <div>
      <div className="admin-panel-header">
        <div className="flex items-center gap-3">
          <div className="admin-panel-header-icon"><Mail /></div>
          <div className="admin-panel-header-text">
            <h2>Surat & Mutasi</h2>
            <p>Agenda surat keluar dengan nomor berurutan, dan pencatatan murid keluar.</p>
          </div>
        </div>
      </div>

      <div className="admin-toolbar flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Cari nomor, perihal, nama murid, atau tujuan…"
            value={pencarianTertunda}
            onChange={(e) => setPencarianTertunda(e.target.value)}
          />
        </div>

        <Select value={filter.jenis} onValueChange={(v) => setFilter((f) => ({ ...f, jenis: v }))}>
          <SelectTrigger className="w-56">
            <Filter className="mr-2 h-3.5 w-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua jenis</SelectItem>
            {JENIS_SURAT.map((j) => <SelectItem key={j.value} value={j.value}>{j.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Button
          type="button"
          size="sm"
          variant={filter.hanyaBerlaku ? 'default' : 'outline'}
          onClick={() => setFilter((f) => ({ ...f, hanyaBerlaku: !f.hanyaBerlaku }))}
        >
          Hanya yang berlaku
        </Button>

        <Button type="button" size="sm" variant="outline" onClick={muat} disabled={isLoading}>
          <RefreshCw className="mr-2 h-4 w-4" /> Muat ulang
        </Button>

        {canManage && (
          <>
            <Button type="button" size="sm" variant="outline" onClick={() => setPengaturanTerbuka(true)}>
              <Settings className="mr-2 h-4 w-4" /> Pengaturan
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { setMutasi(MUTASI_KOSONG); setMutasiTerbuka(true); }}>
              <UserMinus className="mr-2 h-4 w-4" /> Mutasi keluar
            </Button>
            <Button type="button" size="sm" onClick={() => { setForm(FORM_KOSONG); setFormTerbuka(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Terbitkan surat
            </Button>
          </>
        )}
      </div>

      {error && (
        <div className="admin-error-state mt-4" role="alert">
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Nomor</th>
              <th className="px-3 py-2.5 font-semibold">Tanggal</th>
              <th className="px-3 py-2.5 font-semibold">Jenis</th>
              <th className="px-3 py-2.5 font-semibold">Untuk</th>
              <th className="px-3 py-2.5 font-semibold">Tujuan</th>
              <th className="px-3 py-2.5 text-right font-semibold">Tindakan</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Memuat agenda surat…</td></tr>
            )}

            {!isLoading && daftar.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  Belum ada surat. Surat pertama sekolah akan bernomor urut 001.
                </td>
              </tr>
            )}

            {!isLoading && daftar.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-3 py-2.5 font-mono text-xs font-semibold">{s.nomor}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{tanggalPendek(s.tanggal_surat)}</td>
                <td className="px-3 py-2.5">{labelJenisSurat(s.jenis)}</td>
                <td className="px-3 py-2.5">
                  {s.santri_nama || <span className="text-muted-foreground">—</span>}
                  {s.santri_kelas ? <span className="text-muted-foreground"> · {s.santri_kelas}</span> : null}
                </td>
                <td className="px-3 py-2.5">{s.penerima || <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-2">
                    {s.dibatalkan && <Badge variant="destructive">Dibatalkan</Badge>}
                    <Button type="button" size="sm" variant="outline" onClick={() => setSuratDilihat(s)}>
                      <Printer className="mr-1 h-3.5 w-3.5" /> Cetak
                    </Button>
                    {canManage && !s.dibatalkan && (
                      <Button type="button" size="sm" variant="ghost" onClick={() => batalkan(s)} title="Batalkan surat">
                        <Ban className="h-3.5 w-3.5 text-red-600" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Terbitkan surat ────────────────────────────────────────────────── */}
      <Dialog open={formTerbuka} onOpenChange={setFormTerbuka}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Terbitkan surat</DialogTitle>
            <DialogDescription>
              Nomornya ditentukan sistem saat disimpan, melanjutkan agenda tahun ini. Isi surat disusun
              dari jenisnya; kolom keterangan menjadi paragraf tambahan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Jenis surat</label>
              <Select value={form.jenis} onValueChange={(v) => setForm((f) => ({ ...f, jenis: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {JENIS_SURAT.map((j) => <SelectItem key={j.value} value={j.value}>{j.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {jenisTerpilih.butuhMurid && (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Murid</label>
                <Select value={form.santriId} onValueChange={(v) => setForm((f) => ({ ...f, santriId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Pilih murid" /></SelectTrigger>
                  <SelectContent>
                    {murid.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nama_lengkap}{m.nis ? ` · ${m.nis}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  {jenisTerpilih.penerimaLabel}
                </label>
                <Input
                  placeholder={jenisTerpilih.penerimaContoh}
                  value={form.penerima}
                  onChange={(e) => setForm((f) => ({ ...f, penerima: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Tanggal surat</label>
                <Input
                  type="date"
                  value={form.tanggalSurat}
                  onChange={(e) => setForm((f) => ({ ...f, tanggalSurat: e.target.value }))}
                />
              </div>
            </div>

            {jenisTerpilih.keperluan && (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Keperluan</label>
                <Input
                  placeholder="pengajuan beasiswa / pembukaan rekening"
                  value={form.keperluan}
                  onChange={(e) => setForm((f) => ({ ...f, keperluan: e.target.value }))}
                />
                <p className="mt-1 text-xs text-muted-foreground">Masuk ke dalam kalimat surat, bukan sebagai baris tersendiri.</p>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Keterangan tambahan</label>
              <Textarea
                rows={3}
                placeholder="Boleh dikosongkan."
                value={form.isi}
                onChange={(e) => setForm((f) => ({ ...f, isi: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFormTerbuka(false)}>Batal</Button>
            <Button type="button" onClick={simpanSurat} disabled={menyimpan}>
              {menyimpan ? 'Menyimpan…' : 'Terbitkan & lihat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Mutasi keluar ─────────────────────────────────────────────────── */}
      <Dialog open={mutasiTerbuka} onOpenChange={setMutasiTerbuka}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserMinus className="h-5 w-5" /> Mutasi keluar murid</DialogTitle>
            <DialogDescription>
              Mencatat tanggal keluar, alasan, dan sekolah tujuan sekaligus menonaktifkan akun murid.
              Riwayatnya tetap tersimpan dan bisa dipulihkan dari arsip.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Murid</label>
              <Select value={mutasi.santriId} onValueChange={(v) => setMutasi((m) => ({ ...m, santriId: v }))}>
                <SelectTrigger><SelectValue placeholder="Pilih murid" /></SelectTrigger>
                <SelectContent>
                  {murid.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nama_lengkap}{m.nis ? ` · ${m.nis}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Alasan</label>
                <Select value={mutasi.alasanKeluar} onValueChange={(v) => setMutasi((m) => ({ ...m, alasanKeluar: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ALASAN_KELUAR.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Tanggal keluar</label>
                <Input
                  type="date"
                  value={mutasi.tanggalKeluar}
                  onChange={(e) => setMutasi((m) => ({ ...m, tanggalKeluar: e.target.value }))}
                />
              </div>
            </div>

            {mutasi.alasanKeluar === 'Pindah' && (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Sekolah tujuan</label>
                <Input
                  placeholder="SD Negeri 5 Baturaja"
                  value={mutasi.sekolahTujuan}
                  onChange={(e) => setMutasi((m) => ({ ...m, sekolahTujuan: e.target.value }))}
                />
                <p className="mt-1 text-xs text-muted-foreground">Wajib untuk murid pindah — ini yang ditanyakan sekolah tujuan saat meminta berkas.</p>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Keterangan</label>
              <Textarea
                rows={2}
                placeholder="Boleh dikosongkan."
                value={mutasi.keterangan}
                onChange={(e) => setMutasi((m) => ({ ...m, keterangan: e.target.value }))}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={mutasi.buatSurat}
                onChange={(e) => setMutasi((m) => ({ ...m, buatSurat: e.target.checked }))}
              />
              Terbitkan surat pindah sekaligus
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMutasiTerbuka(false)}>Batal</Button>
            <Button type="button" onClick={simpanMutasi} disabled={menyimpan}>
              {menyimpan ? 'Menyimpan…' : 'Catat mutasi keluar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Pengaturan penomoran ──────────────────────────────────────────── */}
      <Dialog open={pengaturanTerbuka} onOpenChange={setPengaturanTerbuka}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Pengaturan surat</DialogTitle>
            <DialogDescription>
              Nomor surat disusun sebagai <span className="font-mono">kode klasifikasi / nomor urut / kode sekolah / bulan romawi / tahun</span>.
              Nomor urutnya berulang dari 1 setiap Januari.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Kode sekolah</label>
              <Input
                placeholder="SDN-BTR"
                value={pengaturan.kode_sekolah}
                onChange={(e) => setPengaturan((p) => ({ ...p, kode_sekolah: e.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Baris kepala surat</label>
              <Textarea
                rows={3}
                placeholder={'PEMERINTAH KABUPATEN OGAN KOMERING ULU\nDINAS PENDIDIKAN DAN KEBUDAYAAN'}
                value={pengaturan.kop_baris}
                onChange={(e) => setPengaturan((p) => ({ ...p, kop_baris: e.target.value }))}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Satu baris per garis, tercetak di atas nama sekolah. Dibiarkan kosong berarti kepala surat
                hanya memuat nama sekolah — sistem tidak menebak nama pemerintah daerah Anda.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Kode klasifikasi</label>
              <div className="space-y-2">
                {JENIS_SURAT.map((j) => (
                  <div key={j.value} className="flex items-center gap-2">
                    <span className="flex-1 text-sm">{j.label}</span>
                    <Input
                      className="w-28"
                      placeholder={j.value === 'pindah' ? '422' : '421.2'}
                      value={pengaturan.klasifikasi[j.value] || ''}
                      onChange={(e) => setPengaturan((p) => ({
                        ...p,
                        klasifikasi: { ...p.klasifikasi, [j.value]: e.target.value },
                      }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPengaturanTerbuka(false)}>Batal</Button>
            <Button type="button" onClick={simpanPengaturan}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SuratCetak
        surat={suratDilihat}
        open={Boolean(suratDilihat)}
        onOpenChange={(terbuka) => { if (!terbuka) setSuratDilihat(null); }}
      />

      <ConfirmationDialog
        isOpen={konfirmasi.isOpen}
        onClose={() => setKonfirmasi((k) => ({ ...k, isOpen: false }))}
        onConfirm={konfirmasi.onConfirm}
        title={konfirmasi.title}
        description={konfirmasi.description}
      />
    </div>
  );
};

export default SuratManagement;
