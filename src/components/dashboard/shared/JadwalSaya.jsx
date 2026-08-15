import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Clock, MapPin, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  HARI_OPTIONS,
  fetchJadwalList,
  fetchPeriodeList,
  formatJamRange,
  getHariLabel,
  getPeriodeLabel,
  getScheduleErrorMessage,
  groupJadwalByHari,
} from '@/lib/scheduleAdapters';

/**
 * Jadwal pelajaran dalam mode baca saja, dipakai dua dashboard:
 *
 * - Guru  → `guruId`  : jadwal mengajar dirinya sendiri
 * - Murid → `classId` : jadwal kelas tempat ia berada
 *
 * Penyuntingan tetap hanya di panel admin. Endpoint yang sama dipakai keduanya,
 * dibedakan penyaringnya saja, jadi tidak ada logika jadwal yang terduplikasi.
 *
 * Periode diambil yang berstatus aktif; sekolah hanya boleh punya satu.
 */
const JadwalSaya = ({ guruId, classId, title = 'Jadwal Pelajaran', emptyText }) => {
  const [rows, setRows] = useState([]);
  const [periode, setPeriode] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Murid yang belum ditempatkan ke kelas tidak punya `classId`. Jalur ini dulu
  // keluar lebih awal TANPA pernah mengisi `periode`, sehingga judulnya berbunyi
  // "Periode ajaran belum ditentukan" — pernyataan yang keliru ketika periodenya
  // justru aktif, dan mengirim sekolah mencari masalah yang tidak ada. Yang
  // sebenarnya kurang adalah penempatan kelasnya.
  const belumPunyaSasaran = !guruId && !classId;

  const muat = useCallback(async () => {
    if (!guruId && !classId) {
      setRows([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const daftarPeriode = await fetchPeriodeList();
      const aktif = (daftarPeriode || []).find((p) => p.is_active) || (daftarPeriode || [])[0] || null;
      setPeriode(aktif);
      if (!aktif) {
        setRows([]);
        return;
      }
      setRows(await fetchJadwalList({ periodeId: aktif.id, guruId, classId }));
    } catch (err) {
      setError(getScheduleErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [guruId, classId]);

  useEffect(() => { muat(); }, [muat]);

  if (isLoading) {
    return (
      <section className="admin-card space-y-3 p-4" aria-busy="true">
        <Skeleton className="h-6 w-56 admin-skeleton-shimmer" />
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl admin-skeleton-shimmer" />)}
      </section>
    );
  }

  const jadwalByHari = groupJadwalByHari(rows);
  const kosong = rows.length === 0;

  return (
    <section className="admin-card space-y-4 p-4" aria-labelledby="jadwal-saya">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="admin-panel-header-icon"><CalendarDays /></div>
          <div>
            <h3 id="jadwal-saya" className="text-lg font-bold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground">
              {periode ? getPeriodeLabel(periode)
                : belumPunyaSasaran ? 'Belum masuk kelas'
                : 'Periode ajaran belum ditentukan'}
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={muat}>
          <RefreshCw className="mr-2 h-4 w-4" /> Muat ulang
        </Button>
      </div>

      {error && (
        <div className="admin-error-state" role="alert">
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {!error && kosong && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {belumPunyaSasaran
            ? 'Jadwal pelajaran muncul setelah murid ditempatkan ke sebuah kelas.'
            : (emptyText || 'Belum ada jadwal pelajaran yang tercatat untuk periode ini.')}
        </p>
      )}

      {!error && !kosong && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {HARI_OPTIONS.filter((h) => jadwalByHari[h.value]?.length > 0).map((hari) => (
            <div key={hari.value} className="rounded-xl border bg-background p-3">
              <h4 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                {getHariLabel(hari.value)}
              </h4>
              <ul className="space-y-2">
                {jadwalByHari[hari.value].map((row) => (
                  <li key={row.id} className="rounded-lg bg-muted/40 p-2.5">
                    <p className="text-sm font-semibold text-foreground">{row.mata_pelajaran_nama}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      {formatJamRange(row.jam_mulai, row.jam_selesai)}
                    </p>
                    {/* Guru melihat kelas mana yang diajarnya; murid melihat siapa gurunya. */}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {guruId ? row.nama_kelas : (row.guru_nama || 'Guru belum ditentukan')}
                    </p>
                    {row.ruang && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {row.ruang}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default JadwalSaya;
