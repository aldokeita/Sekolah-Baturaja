import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { BookText, Download, Filter, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { fetchClassList, fetchGuruList } from '@/lib/dataMasterAdapters';
import { fetchJadwalList, fetchPeriodeList, getPeriodeLabel } from '@/lib/scheduleAdapters';
import { fetchJurnalList, getJurnalErrorMessage } from '@/lib/jurnalAdapters';

/**
 * Pemeriksaan jurnal mengajar — untuk kepala sekolah, admin, dan tata usaha.
 *
 * Hanya membaca. Jurnal ditulis guru yang mengajar, dan panel ini tidak
 * menyediakan penyuntingan: catatan yang bisa diubah atasannya bukan lagi
 * catatan guru. Yang perlu diperbaiki dibicarakan, lalu gurunya sendiri yang
 * memperbaiki dari dashboardnya.
 *
 * Kolom "Kelengkapan" menjawab pertanyaan yang sebenarnya ditanyakan kepala
 * sekolah: siapa yang belum menulis jurnal minggu ini.
 */

const hariIni = () => new Date().toLocaleDateString('en-CA');

const awalBulan = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('en-CA');
};

const tanggalPendek = (iso) => {
  if (!iso) return '-';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

const JurnalMengajarPanel = () => {
  const [rows, setRows] = useState([]);
  const [guruList, setGuruList] = useState([]);
  const [kelasList, setKelasList] = useState([]);
  const [periodeList, setPeriodeList] = useState([]);

  const [jadwalPeriode, setJadwalPeriode] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filter, setFilter] = useState({
    guruId: 'semua',
    classId: 'semua',
    periodeId: '',
    dari: awalBulan(),
    sampai: hariIni(),
    search: '',
  });
  const [pencarianTertunda, setPencarianTertunda] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setFilter((f) => ({ ...f, search: pencarianTertunda })), 400);
    return () => clearTimeout(t);
  }, [pencarianTertunda]);

  useEffect(() => {
    Promise.all([
      fetchGuruList().catch(() => []),
      fetchClassList({ limit: 200 }).catch(() => []),
      fetchPeriodeList().catch(() => []),
    ]).then(([guru, kelas, periode]) => {
      setGuruList(guru || []);
      setKelasList(kelas || []);
      setPeriodeList(periode || []);
      const aktif = (periode || []).find((p) => p.is_active) || (periode || [])[0] || null;
      setFilter((f) => ({ ...f, periodeId: f.periodeId || aktif?.id || '' }));
    });
  }, []);

  const muat = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setRows(await fetchJurnalList({
        guruId: filter.guruId === 'semua' ? '' : filter.guruId,
        classId: filter.classId === 'semua' ? '' : filter.classId,
        periodeId: filter.periodeId,
        dari: filter.dari,
        sampai: filter.sampai,
        search: filter.search,
        limit: 200,
      }));
    } catch (err) {
      setError(getJurnalErrorMessage(err));
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => { muat(); }, [muat]);

  // Siapa yang punya jam mengajar pada periode ini — dasar daftar kelengkapan.
  useEffect(() => {
    let hidup = true;
    if (!filter.periodeId) { setJadwalPeriode([]); return undefined; }
    fetchJadwalList({ periodeId: filter.periodeId })
      .then((data) => { if (hidup) setJadwalPeriode(data || []); })
      .catch(() => { if (hidup) setJadwalPeriode([]); });
    return () => { hidup = false; };
  }, [filter.periodeId]);

  /* Berapa jurnal yang ditulis tiap guru pada rentang yang sedang dilihat.
   *
   * Guru yang TIDAK pernah menulis pun ikut tampil dengan angka nol — justru
   * merekalah yang dicari kepala sekolah, dan mereka tidak akan pernah muncul
   * bila daftarnya disusun dari baris jurnal yang ada.
   *
   * Daftarnya diambil dari JADWAL, bukan dari seluruh Data Guru. Versi pertama
   * memakai seluruh daftar guru, sehingga Administrator dan tata usaha ikut
   * tercantum "0 jurnal" — padahal mereka tidak mengajar, dan menandai mereka
   * belum menulis jurnal membuat daftar ini berisik tepat di tempat yang
   * seharusnya menunjuk satu-dua nama. Yang wajib menulis jurnal adalah yang
   * punya jam mengajar pada periode itu. */
  const kelengkapan = useMemo(() => {
    const hitung = new Map();
    rows.forEach((r) => {
      hitung.set(r.guru_id, (hitung.get(r.guru_id) || 0) + 1);
    });
    const namaGuru = new Map((guruList || []).map((g) => [g.id, g.nama]));
    const mengajar = new Set(
      (jadwalPeriode || []).map((j) => j.guru_id).filter(Boolean),
    );
    return [...mengajar]
      .map((id) => ({ id, nama: namaGuru.get(id) || 'Guru', jumlah: hitung.get(id) || 0 }))
      .sort((a, b) => a.jumlah - b.jumlah || String(a.nama).localeCompare(String(b.nama), 'id'));
  }, [rows, guruList, jadwalPeriode]);

  const unduh = () => {
    if (rows.length === 0) {
      toast({ title: 'Tidak ada data', description: 'Tidak ada jurnal pada rentang ini.', variant: 'destructive' });
      return;
    }
    const data = rows.map((r, i) => ({
      'No': i + 1,
      'Tanggal': tanggalPendek(r.tanggal),
      'Guru': r.guru_nama || '-',
      'Kelas': r.nama_kelas || '-',
      'Mata Pelajaran': r.mata_pelajaran_nama || '-',
      'Jam Ke': r.jam_ke || '-',
      'Materi': r.materi || '-',
      'Hadir': r.jumlah_hadir ?? '-',
      'Jumlah Murid': r.jumlah_murid ?? '-',
      'Kendala': r.kendala || '-',
      'Tindak Lanjut': r.tindak_lanjut || '-',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 5 }, { wch: 16 }, { wch: 28 }, { wch: 14 }, { wch: 26 }, { wch: 8 },
      { wch: 44 }, { wch: 8 }, { wch: 12 }, { wch: 34 }, { wch: 34 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Jurnal Mengajar');
    XLSX.writeFile(wb, `Jurnal_Mengajar_${filter.dari}_sd_${filter.sampai}.xlsx`);
  };

  return (
    <div>
      <div className="admin-panel-header">
        <div className="flex items-center gap-3">
          <div className="admin-panel-header-icon"><BookText /></div>
          <div className="admin-panel-header-text">
            <h2>Jurnal Mengajar</h2>
            <p>Catatan tiap pertemuan yang ditulis guru. Hanya dibaca di sini — guru yang memperbaikinya.</p>
          </div>
        </div>
      </div>

      <div className="admin-toolbar flex flex-wrap items-end gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Cari materi atau kendala…"
            value={pencarianTertunda}
            onChange={(e) => setPencarianTertunda(e.target.value)}
          />
        </div>

        <Select value={filter.guruId} onValueChange={(v) => setFilter((f) => ({ ...f, guruId: v }))}>
          <SelectTrigger className="w-52"><Filter className="mr-2 h-3.5 w-3.5" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua guru</SelectItem>
            {guruList.map((g) => <SelectItem key={g.id} value={g.id}>{g.nama}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filter.classId} onValueChange={(v) => setFilter((f) => ({ ...f, classId: v }))}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua kelas</SelectItem>
            {kelasList.map((k) => <SelectItem key={k.id} value={k.id}>{k.nama_kelas}</SelectItem>)}
          </SelectContent>
        </Select>

        {periodeList.length > 0 && (
          <Select value={filter.periodeId} onValueChange={(v) => setFilter((f) => ({ ...f, periodeId: v }))}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Periode" /></SelectTrigger>
            <SelectContent>
              {periodeList.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {getPeriodeLabel(p)}{p.is_active ? ' • Aktif' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase text-muted-foreground">Dari</label>
          <Input type="date" className="w-36" value={filter.dari} onChange={(e) => setFilter((f) => ({ ...f, dari: e.target.value }))} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase text-muted-foreground">Sampai</label>
          <Input type="date" className="w-36" value={filter.sampai} onChange={(e) => setFilter((f) => ({ ...f, sampai: e.target.value }))} />
        </div>

        <Button type="button" size="sm" variant="outline" onClick={muat} disabled={isLoading}>
          <RefreshCw className="mr-2 h-4 w-4" /> Muat ulang
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={unduh}>
          <Download className="mr-2 h-4 w-4" /> Export Excel
        </Button>
      </div>

      {error && (
        <div className="admin-error-state mt-4" role="alert">
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 overflow-hidden rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="px-3 py-2 font-semibold">Tanggal</th>
                <th className="px-3 py-2 font-semibold">Guru</th>
                <th className="px-3 py-2 font-semibold">Kelas · Mapel</th>
                <th className="px-3 py-2 font-semibold">Materi</th>
                <th className="px-3 py-2 font-semibold">Hadir</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Memuat jurnal…</td></tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Tidak ada jurnal pada rentang ini.</td></tr>
              )}
              {!isLoading && rows.map((r) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="whitespace-nowrap px-3 py-2">
                    {tanggalPendek(r.tanggal)}
                    {r.jam_ke ? <span className="text-muted-foreground"> · jam {r.jam_ke}</span> : null}
                  </td>
                  <td className="px-3 py-2">{r.guru_nama || '-'}</td>
                  <td className="px-3 py-2">{r.nama_kelas}<span className="text-muted-foreground"> · {r.mata_pelajaran_nama}</span></td>
                  <td className="px-3 py-2">
                    {r.materi}
                    {r.kendala ? <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">Kendala: {r.kendala}</p> : null}
                    {r.tindak_lanjut ? <p className="mt-0.5 text-xs text-muted-foreground">Tindak lanjut: {r.tindak_lanjut}</p> : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {r.jumlah_hadir ?? '-'}
                    {r.jumlah_murid ? <span className="text-muted-foreground">/{r.jumlah_murid}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border p-4">
          <h3 className="mb-1 text-sm font-bold">Kelengkapan per guru</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Rentang {tanggalPendek(filter.dari)} – {tanggalPendek(filter.sampai)}. Yang paling sedikit
            di atas, karena itulah yang perlu ditanyakan.
          </p>
          <div className="space-y-1.5">
            {kelengkapan.map((g) => (
              <div key={g.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate">{g.nama}</span>
                <span className={g.jumlah === 0
                  ? 'rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200'
                  : 'rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200'}>
                  {g.jumlah} jurnal
                </span>
              </div>
            ))}
            {kelengkapan.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Belum ada jadwal mengajar pada periode ini, jadi belum ada yang wajib menulis jurnal.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default JurnalMengajarPanel;
