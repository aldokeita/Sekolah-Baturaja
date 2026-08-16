import React, { useCallback, useEffect, useState } from 'react';
import { GraduationCap, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { APP_CONFIG_KEYS, fetchAppConfigs, upsertAppConfig } from '@/lib/appConfigAdapters';
import { PREDIKAT_BAWAAN, normalisasiPredikat } from '@/lib/raporAdapters';

/**
 * Rentang predikat rapor.
 *
 * Bawaannya A≥90 / B≥80 / C≥70 / D, kebiasaan yang paling umum di SD Indonesia —
 * tetapi setiap sekolah menetapkan KKM-nya sendiri, jadi angka ini tidak boleh
 * tinggal sebagai konstanta di kode. Tersimpan pada kunci app-config
 * `rapor_predikat` dan dibaca `raporAdapters.fetchRapor` saat rapor disusun.
 *
 * Ambang paling bawah selalu dipaksa 0 oleh normalisasi, supaya tidak ada nilai
 * yang jatuh tanpa predikat.
 */

const barisKosong = () => ({ min: 0, huruf: '', label: '' });

const RaporPredikatSettings = () => {
  const [rows, setRows] = useState(PREDIKAT_BAWAAN.map((p) => ({ ...p })));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const muat = useCallback(async () => {
    setIsLoading(true);
    try {
      const konfigurasi = await fetchAppConfigs([APP_CONFIG_KEYS.RAPOR_PREDIKAT]);
      setRows(normalisasiPredikat(konfigurasi?.[APP_CONFIG_KEYS.RAPOR_PREDIKAT]));
    } catch {
      setRows(PREDIKAT_BAWAAN.map((p) => ({ ...p })));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { muat(); }, [muat]);

  const ubah = (i, field, value) => {
    setRows((sebelumnya) => sebelumnya.map((row, n) => (n === i ? { ...row, [field]: value } : row)));
  };

  const simpan = async () => {
    const bersih = rows
      .map((row) => ({
        min: Number(row.min),
        huruf: String(row.huruf || '').trim(),
        label: String(row.label || '').trim(),
      }))
      .filter((row) => row.huruf !== '' && Number.isFinite(row.min));

    if (bersih.length === 0) {
      toast({
        title: 'Belum ada predikat',
        description: 'Isi setidaknya satu baris dengan huruf predikat.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      // Yang disimpan adalah hasil normalisasi, bukan isi form apa adanya: urutan
      // menurun dan ambang terbawah nol adalah syarat yang dipakai pembacanya.
      const akhir = normalisasiPredikat(bersih);
      await upsertAppConfig(APP_CONFIG_KEYS.RAPOR_PREDIKAT, akhir);
      setRows(akhir);
      toast({ title: 'Tersimpan', description: 'Rentang predikat rapor diperbarui.' });
    } catch (err) {
      toast({
        title: 'Gagal menyimpan',
        description: err?.message || 'Rentang predikat tidak dapat disimpan.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5" /> Predikat Rapor
        </CardTitle>
        <CardDescription>
          Batas bawah nilai untuk tiap predikat pada rapor. Bawaannya mengikuti kebiasaan umum SD;
          ubah bila KKM sekolah Anda berbeda. Baris paling bawah selalu berlaku untuk nilai di
          bawah semua ambang, berapa pun angkanya diisi.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {rows.map((row, i) => (
                <div key={i} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[6rem_7rem_1fr_auto]">
                  <div>
                    <Label htmlFor={`predikat-huruf-${i}`} className="text-xs">Predikat</Label>
                    <Input
                      id={`predikat-huruf-${i}`}
                      value={row.huruf}
                      maxLength={4}
                      placeholder="A"
                      onChange={(e) => ubah(i, 'huruf', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`predikat-min-${i}`} className="text-xs">Nilai minimal</Label>
                    <Input
                      id={`predikat-min-${i}`}
                      type="number"
                      min="0"
                      max="100"
                      value={row.min}
                      onChange={(e) => ubah(i, 'min', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`predikat-label-${i}`} className="text-xs">Keterangan</Label>
                    <Input
                      id={`predikat-label-${i}`}
                      value={row.label}
                      placeholder="Sangat Baik"
                      onChange={(e) => ubah(i, 'label', e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="h-10 w-10"
                    aria-label={`Hapus predikat baris ${i + 1}`}
                    onClick={() => setRows((s) => s.filter((_, n) => n !== i))}
                    disabled={rows.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setRows((s) => [...s, barisKosong()])}>
                <Plus className="mr-2 h-4 w-4" /> Tambah predikat
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRows(PREDIKAT_BAWAAN.map((p) => ({ ...p })))}
              >
                <RotateCcw className="mr-2 h-4 w-4" /> Kembalikan bawaan
              </Button>
              <Button type="button" size="sm" onClick={simpan} disabled={isSaving} className="ml-auto">
                <Save className="mr-2 h-4 w-4" /> {isSaving ? 'Menyimpan…' : 'Simpan Predikat'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default RaporPredikatSettings;
