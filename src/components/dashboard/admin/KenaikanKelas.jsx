import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { ArrowUpRight, GraduationCap, Loader2, AlertTriangle, CheckCircle2, History } from 'lucide-react';
import {
  fetchClassList,
  fetchSantriList,
  fetchPromotionRuns,
  promoteClasses,
} from '@/lib/dataMasterAdapters';
import { fetchPeriodeList } from '@/lib/scheduleAdapters';

const TUJUAN_LULUS = 'LULUS';
const TUJUAN_LEWATI = 'LEWATI';

/* Tahun ajaran berikutnya diturunkan dari yang sekarang: "2026/2027" menjadi
 * "2027/2028". Kalau bentuknya bukan itu, dikembalikan kosong supaya admin
 * mengisinya sendiri alih-alih menerima tebakan yang salah. */
const tahunBerikutnya = (tahun) => {
  const cocok = /^(\d{4})\/(\d{4})$/.exec(String(tahun || '').trim());
  if (!cocok) return '';
  return `${Number(cocok[1]) + 1}/${Number(cocok[2]) + 1}`;
};

const KenaikanKelas = () => {
  const [kelas, setKelas] = useState([]);
  const [murid, setMurid] = useState([]);
  const [riwayat, setRiwayat] = useState([]);
  const [tahunAsal, setTahunAsal] = useState('');
  const [tahunTujuan, setTahunTujuan] = useState('');
  const [peta, setPeta] = useState({});
  const [tinggal, setTinggal] = useState({});
  const [catatan, setCatatan] = useState('');
  const [memuat, setMemuat] = useState(true);
  const [menjalankan, setMenjalankan] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const [daftarKelas, daftarMurid, daftarPeriode, daftarRiwayat] = await Promise.all([
        fetchClassList({ isActive: true }),
        fetchSantriList({ activeOnly: true, notDeleted: true, limit: 500 }),
        fetchPeriodeList().catch(() => []),
        fetchPromotionRuns().catch(() => []),
      ]);
      setKelas(Array.isArray(daftarKelas) ? daftarKelas : []);
      setMurid(Array.isArray(daftarMurid) ? daftarMurid : []);
      setRiwayat(daftarRiwayat);

      const aktif = (daftarPeriode || []).find((p) => p.is_active) || (daftarPeriode || [])[0];
      const asal = aktif?.tahun_ajaran || '';
      setTahunAsal(asal);
      setTahunTujuan(tahunBerikutnya(asal));
    } catch (error) {
      toast({ title: 'Gagal memuat data kenaikan kelas', description: error.message, variant: 'destructive' });
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => { muat(); }, [muat]);

  /* Rombel yang ikut kenaikan: hanya yang punya `tingkat`. Rombel bertingkat
   * NULL sengaja dilewati — itu artinya "bukan rombel tingkat", misalnya kelompok
   * khusus, dan menaikkannya otomatis akan salah. */
  const kelasBertingkat = useMemo(
    () => kelas.filter((k) => Number.isFinite(Number(k.tingkat))).sort((a, b) => Number(a.tingkat) - Number(b.tingkat) || String(a.nama_kelas).localeCompare(String(b.nama_kelas))),
    [kelas],
  );
  const tingkatTertinggi = useMemo(
    () => kelasBertingkat.reduce((maks, k) => Math.max(maks, Number(k.tingkat)), 0),
    [kelasBertingkat],
  );

  /* Usulan peta. Dicocokkan lewat `tingkat`, BUKAN nama kelas: sekolah boleh
   * menamai rombelnya "2 Melati" dan usulannya tetap benar. Kalau ada rombel
   * dengan huruf akhir yang sama di tingkat berikutnya, itu yang dipilih —
   * 2B ke 3B — supaya satu angkatan tetap bersama bila sekolah memang begitu.
   * Admin tetap bisa mengubah tiap barisnya. */
  useEffect(() => {
    if (kelasBertingkat.length === 0) return;
    const usulan = {};
    kelasBertingkat.forEach((k) => {
      const tingkat = Number(k.tingkat);
      if (tingkat >= tingkatTertinggi) {
        usulan[k.id] = TUJUAN_LULUS;
        return;
      }
      const kandidat = kelasBertingkat.filter((c) => Number(c.tingkat) === tingkat + 1);
      if (kandidat.length === 0) {
        usulan[k.id] = TUJUAN_LEWATI;
        return;
      }
      const hurufAsal = String(k.nama_kelas).trim().slice(-1).toUpperCase();
      const serupa = kandidat.find((c) => String(c.nama_kelas).trim().slice(-1).toUpperCase() === hurufAsal);
      usulan[k.id] = (serupa || kandidat[0]).id;
    });
    setPeta(usulan);
  }, [kelasBertingkat, tingkatTertinggi]);

  const muridPerKelas = useMemo(() => {
    const map = {};
    murid.forEach((s) => {
      const id = s.current_class_id || s.class?.id;
      if (!id) return;
      if (!map[id]) map[id] = [];
      map[id].push(s);
    });
    Object.values(map).forEach((list) => list.sort((a, b) => (a.order_in_class ?? 999) - (b.order_in_class ?? 999)));
    return map;
  }, [murid]);

  const sudahDijalankan = useMemo(
    () => riwayat.find((r) => r.tahun_ajaran_asal === tahunAsal),
    [riwayat, tahunAsal],
  );

  const ringkasan = useMemo(() => {
    let naik = 0; let lulus = 0; let tetap = 0;
    kelasBertingkat.forEach((k) => {
      const isi = muridPerKelas[k.id] || [];
      const tujuan = peta[k.id];
      isi.forEach((s) => {
        if (tinggal[s.id]) { tetap += 1; return; }
        if (tujuan === TUJUAN_LULUS) { lulus += 1; return; }
        if (tujuan === TUJUAN_LEWATI || !tujuan) { tetap += 1; return; }
        naik += 1;
      });
    });
    return { naik, lulus, tetap };
  }, [kelasBertingkat, muridPerKelas, peta, tinggal]);

  const jalankan = async () => {
    if (!tahunAsal || !tahunTujuan) {
      toast({ title: 'Tahun ajaran belum lengkap', description: 'Isi tahun ajaran asal dan tujuan.', variant: 'destructive' });
      return;
    }
    const petaKirim = [];
    const lulusIds = [];
    kelasBertingkat.forEach((k) => {
      const tujuan = peta[k.id];
      if (tujuan === TUJUAN_LULUS) lulusIds.push(k.id);
      else if (tujuan && tujuan !== TUJUAN_LEWATI) petaKirim.push({ from_class_id: k.id, to_class_id: tujuan });
    });
    if (petaKirim.length === 0 && lulusIds.length === 0) {
      toast({ title: 'Tidak ada yang dinaikkan', description: 'Semua rombel disetel dilewati.', variant: 'destructive' });
      return;
    }
    const tinggalIds = Object.keys(tinggal).filter((id) => tinggal[id]);
    const pesan = `Naikkan ${ringkasan.naik} murid, luluskan ${ringkasan.lulus} murid, dan biarkan ${ringkasan.tetap} murid di kelasnya?\n\n`
      + `Tahun ajaran ${tahunAsal} ke ${tahunTujuan}. Tindakan ini tidak bisa dibatalkan dari aplikasi, dan hanya bisa dijalankan sekali untuk ${tahunAsal}.`;
    if (!window.confirm(pesan)) return;

    setMenjalankan(true);
    try {
      const hasil = await promoteClasses({
        tahunAjaranAsal: tahunAsal,
        tahunAjaranTujuan: tahunTujuan,
        peta: petaKirim,
        lulusClassIds: lulusIds,
        tinggalSantriIds: tinggalIds,
        catatan,
      });
      toast({
        title: 'Kenaikan kelas selesai',
        description: `${hasil?.jumlah_naik ?? 0} murid naik, ${hasil?.jumlah_lulus ?? 0} lulus, ${hasil?.jumlah_tinggal ?? 0} tinggal kelas.`,
      });
      setTinggal({});
      setCatatan('');
      await muat();
    } catch (error) {
      toast({ title: 'Kenaikan kelas gagal', description: error.message, variant: 'destructive' });
    } finally {
      setMenjalankan(false);
    }
  };

  if (memuat) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Memuat data kenaikan kelas...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-black tracking-tight">
          <ArrowUpRight className="h-6 w-6 text-indigo-500" aria-hidden="true" /> Kenaikan Kelas
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Menaikkan seluruh rombel sekaligus di akhir tahun ajaran. Usulan tujuannya dibuat dari tingkat
          tiap rombel, dan setiap baris bisa Anda ubah sebelum dijalankan.
        </p>
      </div>

      {sudahDijalankan && (
        <div className="border-l-[3px] border-emerald-500 bg-emerald-50 px-3.5 py-3 dark:border-emerald-400 dark:bg-emerald-950/30">
          <p className="flex items-center gap-2 text-sm font-bold text-emerald-900 dark:text-emerald-200">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Kenaikan kelas {tahunAsal} sudah dijalankan
          </p>
          <p className="mt-1 text-xs text-emerald-900/90 dark:text-emerald-200/90">
            {sudahDijalankan.jumlah_naik} murid naik, {sudahDijalankan.jumlah_lulus} lulus,
            {' '}{sudahDijalankan.jumlah_tinggal} tinggal kelas. Satu tahun ajaran hanya bisa dinaikkan sekali,
            jadi tombol di bawah akan ditolak. Ubah tahun ajaran asal bila Anda memang menaikkan tahun lain.
          </p>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tahun ajaran</CardTitle>
          <CardDescription>Diambil dari periode aktif. Ubah bila Anda menaikkan tahun ajaran lain.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="kk-asal" className="text-xs text-muted-foreground">Dari</Label>
            <Input id="kk-asal" value={tahunAsal} onChange={(e) => setTahunAsal(e.target.value)} placeholder="2026/2027" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="kk-tujuan" className="text-xs text-muted-foreground">Ke</Label>
            <Input id="kk-tujuan" value={tahunTujuan} onChange={(e) => setTahunTujuan(e.target.value)} placeholder="2027/2028" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="kk-catatan" className="text-xs text-muted-foreground">Catatan (opsional)</Label>
            <Input id="kk-catatan" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Rapat kenaikan 20 Juni" className="mt-1" />
          </div>
        </CardContent>
      </Card>

      {kelasBertingkat.length === 0 ? (
        <div className="border-l-[3px] border-amber-500 bg-amber-50 px-3.5 py-3 dark:border-amber-400 dark:bg-amber-950/30">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Belum ada rombel yang punya tingkat
          </p>
          <p className="mt-1 text-xs text-amber-900/90 dark:text-amber-200/90">
            Kenaikan kelas memakai angka tingkat tiap rombel, bukan namanya. Isi tingkat rombel di
            Manajemen Kelas lebih dulu.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {kelasBertingkat.map((k) => {
            const isi = muridPerKelas[k.id] || [];
            const tujuan = peta[k.id] || TUJUAN_LEWATI;
            const kandidat = kelasBertingkat.filter((c) => Number(c.tingkat) === Number(k.tingkat) + 1);
            const jumlahTinggal = isi.filter((s) => tinggal[s.id]).length;
            return (
              <Card key={k.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">
                        {k.nama_kelas} <span className="font-normal text-muted-foreground">· tingkat {k.tingkat} · {isi.length} murid</span>
                      </CardTitle>
                      <CardDescription>
                        {tujuan === TUJUAN_LULUS
                          ? `${isi.length - jumlahTinggal} murid dinyatakan lulus dan keluar dari rombel`
                          : tujuan === TUJUAN_LEWATI
                            ? 'Rombel ini dilewati, muridnya tetap di tempat'
                            : `${isi.length - jumlahTinggal} murid naik${jumlahTinggal > 0 ? `, ${jumlahTinggal} tinggal kelas` : ''}`}
                      </CardDescription>
                    </div>
                    <div className="min-w-[13rem]">
                      <Label className="text-xs text-muted-foreground">Naik ke</Label>
                      <Select value={tujuan} onValueChange={(v) => setPeta((p) => ({ ...p, [k.id]: v }))} disabled={menjalankan}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {kandidat.map((c) => <SelectItem key={c.id} value={c.id}>{c.nama_kelas}</SelectItem>)}
                          <SelectItem value={TUJUAN_LULUS}>Lulus / keluar sekolah</SelectItem>
                          <SelectItem value={TUJUAN_LEWATI}>Lewati rombel ini</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                {isi.length > 0 && (
                  <CardContent className="pt-0">
                    {/* Centang berarti TINGGAL KELAS. Dibuat per murid karena
                        keputusan tinggal kelas memang per murid, bukan per rombel. */}
                    <p className="mb-2 text-xs text-muted-foreground">Centang murid yang tinggal kelas:</p>
                    <div className="flex flex-wrap gap-2">
                      {isi.map((s) => {
                        const dicentang = Boolean(tinggal[s.id]);
                        return (
                          <label
                            key={s.id}
                            className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${dicentang
                              ? 'border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-500/60 dark:bg-amber-950/40 dark:text-amber-200'
                              : 'border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300'}`}
                          >
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5"
                              checked={dicentang}
                              disabled={menjalankan}
                              onChange={(e) => setTinggal((t) => ({ ...t, [s.id]: e.target.checked }))}
                            />
                            {s.nama_lengkap}
                          </label>
                        );
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span><strong className="text-lg font-black text-indigo-600 dark:text-indigo-400">{ringkasan.naik}</strong> naik</span>
            <span><strong className="text-lg font-black text-emerald-600 dark:text-emerald-400">{ringkasan.lulus}</strong> lulus</span>
            <span><strong className="text-lg font-black text-amber-600 dark:text-amber-400">{ringkasan.tetap}</strong> tetap</span>
          </div>
          <Button onClick={jalankan} disabled={menjalankan || kelasBertingkat.length === 0} className="bg-indigo-600 font-bold text-white hover:bg-indigo-700">
            {menjalankan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GraduationCap className="mr-2 h-4 w-4" />}
            Jalankan kenaikan kelas
          </Button>
        </CardContent>
      </Card>

      {riwayat.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Riwayat kenaikan kelas
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
              {riwayat.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-semibold">{r.tahun_ajaran_asal} → {r.tahun_ajaran_tujuan}</span>
                  <span className="text-muted-foreground">
                    {r.jumlah_naik} naik · {r.jumlah_lulus} lulus · {r.jumlah_tinggal} tinggal
                    {r.dijalankan_oleh_nama ? ` · oleh ${r.dijalankan_oleh_nama}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default KenaikanKelas;
