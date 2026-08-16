import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, FileText, Printer, RefreshCw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import useSchoolIdentity from '@/hooks/useSchoolIdentity';
import { fetchPeriodeList, getPeriodeLabel } from '@/lib/scheduleAdapters';
import {
  deleteCatatanRapor,
  fetchRapor,
  getRaporErrorMessage,
  saveCatatanRapor,
  saveDeskripsiMapel,
} from '@/lib/raporAdapters';
import { useToast } from '@/components/ui/use-toast';
import { formatSkor } from '@/lib/nilaiAdapters';
import '@/styles/rapor-cetak.css';

/**
 * Rapor murid yang bisa dicetak.
 *
 * Dibuat sebagai HTML, bukan lewat jsPDF seperti laporan lain di
 * `src/utils/reportUtils.js`. Alasannya bukan kepraktisan: rapor harus memakai
 * identitas sekolah — nama, alamat, lambang, dan WARNA pilihan pembeli — dan warna
 * itu hidup sebagai properti CSS (`--sekolah-aksen*`). Menyusunnya di jsPDF berarti
 * menyalin palet ke JavaScript dan menjaga dua sumber warna tetap sama; dengan HTML
 * rapor ikut berubah sendiri begitu pembeli mengganti warna sekolahnya.
 *
 * Lembarnya dirender lewat portal ke anak langsung `body`, supaya aturan cetak
 * cukup menyembunyikan saudara-saudaranya. Lihat catatan di rapor-cetak.css.
 */

const AKAR_CETAK_ID = 'rapor-cetak-root';

const NARASI_KOSONG = Object.freeze({ catatan: '', kokurikuler: '', ekstrakurikuler: '' });

const samaIsinya = (a, b) => Object.keys({ ...a, ...b })
  .every((k) => String(a?.[k] || '').trim() === String(b?.[k] || '').trim());

const tanggalPanjang = (iso) => {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

const Baris = ({ label, nilai }) => (
  <div className="rapor-identitas__baris">
    <span className="rapor-identitas__label">{label}</span>
    <span className="rapor-identitas__nilai">: {nilai || '-'}</span>
  </div>
);

/** Wadah portal, dibuat sekali dan dipakai ulang oleh setiap rapor. */
export const useAkarCetak = (aktif) => {
  const [akar, setAkar] = useState(null);

  useEffect(() => {
    if (!aktif) return undefined;
    let el = document.getElementById(AKAR_CETAK_ID);
    let dibuatDiSini = false;
    if (!el) {
      el = document.createElement('div');
      el.id = AKAR_CETAK_ID;
      document.body.appendChild(el);
      dibuatDiSini = true;
    }
    setAkar(el);
    return () => {
      setAkar(null);
      // Hanya yang membuatnya yang membersihkan, supaya dua rapor yang terbuka
      // bergantian tidak saling mencabut wadahnya.
      if (dibuatDiSini && el.parentNode && el.childNodes.length === 0) {
        el.parentNode.removeChild(el);
      }
    };
  }, [aktif]);

  return akar;
};

export const LembarRapor = ({ data, sekolah, narasi }) => {
  const {
    murid, kelas, fase, periode, mapel,
    rataKeseluruhan, predikatKeseluruhan, kehadiran, waliKelas, kepalaSekolah,
  } = data;

  const totalHari = kehadiran.hadir + kehadiran.sakit + kehadiran.izin + kehadiran.alpa;

  return (
    <div className="rapor-lembar">
      <div className="rapor-kop">
        <div className="rapor-kop__lambang">{sekolah.logoAbbr}</div>
        <div>
          <h1 className="rapor-kop__nama">{sekolah.name}</h1>
          <p className="rapor-kop__alamat">
            {sekolah.address}
            {sekolah.phone ? ` · Telp. ${sekolah.phone}` : ''}
          </p>
        </div>
      </div>

      {/* Judulnya SENGAJA bukan "Rapor". "Laporan Kemajuan Belajar" adalah istilah
          Permendikbudristek 21/2022 Pasal 8 ayat (1), jadi akurat menurut regulasi
          tanpa mengesankan dokumen ini keluaran e-Rapor Kemendikdasmen — yang
          bukan. Lihat docs/51-riset-rapor-resmi-kemendikdasmen.md. */}
      <div className="rapor-judul">
        <p className="rapor-judul__utama">Laporan Kemajuan Belajar</p>
        <p className="rapor-judul__periode">
          {periode
            ? `${getPeriodeLabel(periode)} · Tahun Ajaran ${periode.tahun_ajaran || sekolah.academicYear}`
            : `Tahun Ajaran ${sekolah.academicYear}`}
        </p>
      </div>

      <div className="rapor-identitas">
        <Baris label="Nama" nilai={murid.nama_lengkap} />
        <Baris label="Kelas" nilai={kelas?.nama_kelas} />
        <Baris label="NISN" nilai={murid.nisn} />
        <Baris label="Wali Kelas" nilai={waliKelas} />
        <Baris label="NIS" nilai={murid.nis || murid.nomor_induk} />
        <Baris label="Semester" nilai={periode?.semester} />
        {/* Fase hanya tampil bila bisa diturunkan dari tingkat kelas; menebaknya
            lebih buruk daripada mengosongkannya. */}
        {fase && <Baris label="Fase" nilai={fase} />}
      </div>

      <div className="rapor-bagian">
        <h2 className="rapor-bagian__judul">Nilai Mata Pelajaran</h2>
        {mapel.length === 0 ? (
          <p className="rapor-kosong">
            Belum ada nilai yang tercatat untuk periode ini.
          </p>
        ) : (
          <table className="rapor-tabel">
            <thead>
              <tr>
                <th style={{ width: '5%' }} className="rapor-angka">No</th>
                <th>Mata Pelajaran</th>
                <th style={{ width: '11%' }} className="rapor-angka">Asesmen</th>
                <th style={{ width: '11%' }} className="rapor-angka">Nilai</th>
                <th style={{ width: '9%' }} className="rapor-angka">Predikat</th>
                <th style={{ width: '34%' }}>Capaian Kompetensi</th>
              </tr>
            </thead>
            <tbody>
              {mapel.map((m, i) => (
                <tr key={m.id}>
                  <td className="rapor-angka">{i + 1}</td>
                  <td>{m.nama}</td>
                  <td className="rapor-angka">{m.jumlah}</td>
                  <td className="rapor-angka">{m.rataRata === null ? '-' : formatSkor(m.rataRata)}</td>
                  <td className="rapor-angka">{m.predikat.huruf}</td>
                  {/* Deskripsi capaian yang ditulis guru; bila belum ada, label
                      predikat dipakai agar kolomnya tidak kosong sama sekali. */}
                  <td>{m.deskripsi || m.predikat.label}</td>
                </tr>
              ))}
            </tbody>
            {rataKeseluruhan !== null && (
              <tfoot>
                <tr>
                  <td colSpan={3}>Rata-rata keseluruhan</td>
                  <td className="rapor-angka">{formatSkor(rataKeseluruhan)}</td>
                  <td className="rapor-angka">{predikatKeseluruhan.huruf}</td>
                  <td>{predikatKeseluruhan.label}</td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
        {/* Nilai per mata pelajaran adalah RATA-RATA seluruh asesmen pada periode
            ini, bukan satu angka ujian akhir. Ditulis terus-terang supaya orang tua
            tidak menyangka anaknya diuji satu kali. */}
        <p className="rapor-catatan-kaki">
          Nilai adalah rata-rata seluruh asesmen yang tercatat pada periode ini.
        </p>
      </div>

      {/* Komponen minimal BSKAP nomor 8 dan 9. Keduanya narasi bebas: kokurikuler
          adalah projek penguatan profil pelajar, ekstrakurikuler adalah kegiatan
          yang diikuti murid beserta keterangannya. */}
      <div className="rapor-dua-kolom">
        <div>
          <h2 className="rapor-bagian__judul">Capaian Kokurikuler</h2>
          <div className="rapor-catatan__kotak">{narasi.kokurikuler}</div>
        </div>
        <div>
          <h2 className="rapor-bagian__judul">Kegiatan Ekstrakurikuler</h2>
          <div className="rapor-catatan__kotak">{narasi.ekstrakurikuler}</div>
        </div>
      </div>

      <div className="rapor-dua-kolom">
        <div>
          <h2 className="rapor-bagian__judul">Ketidakhadiran</h2>
          <table className="rapor-tabel">
            <tbody>
              <tr><td>Sakit</td><td className="rapor-angka">{kehadiran.sakit} hari</td></tr>
              <tr><td>Izin</td><td className="rapor-angka">{kehadiran.izin} hari</td></tr>
              <tr><td>Tanpa keterangan</td><td className="rapor-angka">{kehadiran.alpa} hari</td></tr>
              <tr><td>Hadir</td><td className="rapor-angka">{kehadiran.hadir} hari</td></tr>
            </tbody>
          </table>
          {totalHari === 0 && (
            <p className="rapor-catatan-kaki">Belum ada catatan kehadiran pada periode ini.</p>
          )}
        </div>
        <div>
          <h2 className="rapor-bagian__judul">Catatan Wali Kelas</h2>
          <div className="rapor-catatan__kotak">{narasi.catatan}</div>
        </div>
      </div>

      {/* Komponen minimal BSKAP nomor 12. Sengaja TIDAK disimpan di basis data:
          tanggapan ditulis tangan orang tua pada lembar yang dibawa pulang, sama
          seperti kolom tanda tangannya. */}
      <div className="rapor-bagian">
        <h2 className="rapor-bagian__judul">Tanggapan Orang Tua / Wali Murid</h2>
        <div className="rapor-catatan__kotak rapor-catatan__kotak--lebar" />
      </div>

      <div className="rapor-ttd">
        <div>
          <p className="rapor-ttd__peran">Orang Tua / Wali</p>
          <p className="rapor-ttd__nama">&nbsp;</p>
        </div>
        <div>
          <p className="rapor-ttd__peran">Wali Kelas</p>
          <p className="rapor-ttd__nama">{waliKelas || ' '}</p>
        </div>
        <div>
          {/* Yang mengesahkan rapor adalah kepala sekolah. Namanya datang dari Data
              Guru; bila sekolah belum menandai seorang kepala sekolah, barisnya
              dibiarkan kosong untuk ditulis tangan — bukan diisi nama karangan. */}
          <p className="rapor-ttd__peran">{sekolah.city ? `${sekolah.city}, ` : ''}Kepala Sekolah</p>
          <p className="rapor-ttd__nama">{kepalaSekolah || ' '}</p>
        </div>
      </div>

      {/* Pernyataan ini melindungi sekolah DAN produk. Dokumen ini sah sebagai
          laporan hasil belajar menurut Permendikbudristek 21/2022 Pasal 8 ayat (5),
          tetapi BUKAN keluaran e-Rapor Kemendikdasmen — dan tidak boleh terbaca
          seolah-olah begitu. Lihat docs/51-riset-rapor-resmi-kemendikdasmen.md. */}
      <p className="rapor-catatan-kaki rapor-penafian">
        Dokumen ini adalah laporan kemajuan belajar yang diterbitkan {sekolah.name}.
        Rapor resmi untuk keperluan administrasi pendidikan mengikuti mekanisme yang ditetapkan sekolah.
      </p>
    </div>
  );
};

const RaporCetak = ({ santriId, open, onOpenChange, daftarMurid = [], onPindahMurid }) => {
  const sekolah = useSchoolIdentity();
  const akarCetak = useAkarCetak(open);
  const { toast } = useToast();

  const [periodeList, setPeriodeList] = useState([]);
  const [periodeId, setPeriodeId] = useState('');
  const [data, setData] = useState(null);
  // Tiga narasi rapor disimpan bersama dalam satu baris, jadi state-nya satu objek
  // dan tombol simpannya satu. `tersimpan` menyimpan salinan terakhir dari server
  // supaya penanda "belum disimpan" jujur.
  const [narasi, setNarasi] = useState(NARASI_KOSONG);
  const [narasiTersimpan, setNarasiTersimpan] = useState(NARASI_KOSONG);
  const [deskripsi, setDeskripsi] = useState({});
  const [deskripsiTersimpan, setDeskripsiTersimpan] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const santriTerakhir = useRef(null);

  // Daftar periode dimuat sekali per pembukaan dialog; pilihan periode boleh
  // berbeda dari yang aktif, karena rapor semester lalu tetap perlu dicetak ulang.
  useEffect(() => {
    if (!open) return;
    fetchPeriodeList()
      .then((daftar) => {
        setPeriodeList(daftar || []);
        setPeriodeId((sebelumnya) => sebelumnya
          || (daftar || []).find((p) => p.is_active)?.id
          || (daftar || [])[0]?.id
          || '');
      })
      .catch(() => setPeriodeList([]));
  }, [open]);

  useEffect(() => {
    if (santriTerakhir.current !== santriId) santriTerakhir.current = santriId;
  }, [santriId]);

  const muat = useCallback(async () => {
    if (!open || !santriId) return;
    setIsLoading(true);
    setError(null);
    try {
      const hasil = await fetchRapor(santriId, periodeId);
      setData(hasil);
      // Narasi yang tersimpan di server menjadi isi kotak. Ini juga yang membuat
      // berpindah periode terasa benar: tiap periode punya narasinya sendiri.
      const dariServer = {
        catatan: hasil.catatan || '',
        kokurikuler: hasil.kokurikuler || '',
        ekstrakurikuler: hasil.ekstrakurikuler || '',
      };
      setNarasi(dariServer);
      setNarasiTersimpan(dariServer);
      const desk = Object.fromEntries((hasil.mapel || []).map((m) => [m.id, m.deskripsi || '']));
      setDeskripsi(desk);
      setDeskripsiTersimpan(desk);
    } catch (err) {
      setError(getRaporErrorMessage(err));
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [open, santriId, periodeId]);

  useEffect(() => { muat(); }, [muat]);

  const belumDisimpan = !samaIsinya(narasi, narasiTersimpan) || !samaIsinya(deskripsi, deskripsiTersimpan);

  const simpanNarasi = useCallback(async () => {
    if (!santriId || !data?.periode?.id) return;
    const periodeAktifId = data.periode.id;
    setIsSaving(true);
    try {
      const isi = {
        catatan: narasi.catatan.trim(),
        kokurikuler: narasi.kokurikuler.trim(),
        ekstrakurikuler: narasi.ekstrakurikuler.trim(),
      };
      // Mengosongkan SEMUA kotak berarti menghapus barisnya. Menyimpan baris yang
      // seluruhnya kosong ditolak backend, jadi jalur hapus dipakai — kalau tidak,
      // mengosongkan narasi terasa gagal tanpa sebab.
      const adaIsi = Object.values(isi).some((teks) => teks !== '');
      if (adaIsi) {
        await saveCatatanRapor(santriId, periodeAktifId, isi);
      } else {
        await deleteCatatanRapor(santriId, periodeAktifId);
      }
      await saveDeskripsiMapel(santriId, periodeAktifId, deskripsi);

      setNarasi(isi);
      setNarasiTersimpan(isi);
      setDeskripsiTersimpan(deskripsi);
      // Lembar cetak membaca deskripsi dari `data.mapel`, jadi salinan itu ikut
      // diperbarui — tanpa ini pratinjau masih menampilkan deskripsi lama sampai
      // rapornya dimuat ulang.
      setData((sebelumnya) => (sebelumnya ? {
        ...sebelumnya,
        mapel: (sebelumnya.mapel || []).map((m) => ({ ...m, deskripsi: deskripsi[m.id] || '' })),
      } : sebelumnya));
      toast({ title: 'Tersimpan', description: 'Catatan dan deskripsi capaian disimpan.' });
    } catch (err) {
      toast({
        title: 'Gagal menyimpan',
        description: getRaporErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [santriId, data, narasi, deskripsi, toast]);

  const labelPeriode = useMemo(
    () => periodeList.map((p) => ({ id: p.id, label: getPeriodeLabel(p) + (p.is_active ? ' • Aktif' : '') })),
    [periodeList],
  );

  const urutan = daftarMurid.findIndex((m) => m.id === santriId);
  const bisaPindah = Boolean(onPindahMurid) && urutan >= 0 && daftarMurid.length > 1;

  // Berpindah murid saat masih ada isian yang belum disimpan akan membuang
  // pekerjaan tanpa peringatan, jadi dimintakan persetujuan lebih dulu.
  const pindah = useCallback((arah) => {
    const tujuan = daftarMurid[urutan + arah];
    if (!tujuan) return;
    if (belumDisimpan) {
      const lanjut = window.confirm(
        'Ada isian rapor yang belum disimpan. Pindah ke murid lain dan membuang perubahan itu?',
      );
      if (!lanjut) return;
    }
    onPindahMurid(tujuan.id);
  }, [daftarMurid, urutan, belumDisimpan, onPindahMurid]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="border-b p-5 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Rapor Murid
          </DialogTitle>
          <DialogDescription>
            Pratinjau di bawah adalah tampilan yang akan tercetak. Warna dan kop mengikuti
            identitas sekolah di panel Identitas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3 border-b px-5 py-3">
          <div className="min-w-48 flex-1">
            <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground" htmlFor="rapor-periode">
              Periode
            </label>
            <Select value={periodeId} onValueChange={setPeriodeId} disabled={labelPeriode.length === 0}>
              <SelectTrigger id="rapor-periode">
                <SelectValue placeholder={labelPeriode.length === 0 ? 'Belum ada periode' : 'Pilih periode'} />
              </SelectTrigger>
              <SelectContent>
                {labelPeriode.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={muat} disabled={isLoading}>
            <RefreshCw className="mr-2 h-4 w-4" /> Muat ulang
          </Button>
          <Button type="button" size="sm" onClick={() => window.print()} disabled={isLoading || !data}>
            <Printer className="mr-2 h-4 w-4" /> Cetak
          </Button>

          {bisaPindah && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => pindah(-1)}
                disabled={isLoading || isSaving || urutan <= 0}
                aria-label="Murid sebelumnya"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-20 text-center text-xs font-medium tabular-nums text-muted-foreground">
                {urutan + 1} / {daftarMurid.length}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => pindah(1)}
                disabled={isLoading || isSaving || urutan >= daftarMurid.length - 1}
                aria-label="Murid berikutnya"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="max-h-[52vh] overflow-y-auto border-b px-5 py-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Isian rapor
            </p>
            <div className="flex items-center gap-2">
              {belumDisimpan && (
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Belum disimpan</span>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={simpanNarasi}
                disabled={isSaving || isLoading || !data?.periode?.id || !belumDisimpan}
              >
                <Save className="mr-2 h-4 w-4" /> {isSaving ? 'Menyimpan…' : 'Simpan isian'}
              </Button>
            </div>
          </div>

          {/* Deskripsi capaian per mata pelajaran — komponen minimal BSKAP nomor 7.
              Hanya muncul untuk mata pelajaran yang benar-benar punya nilai, supaya
              guru tidak dihadapkan pada daftar seluruh mata pelajaran sekolah. */}
          {(data?.mapel || []).length > 0 && (
            <div className="mb-3 space-y-2">
              {data.mapel.map((m) => (
                <div key={m.id}>
                  <label className="mb-1 block text-xs text-muted-foreground" htmlFor={`rapor-deskripsi-${m.id}`}>
                    Capaian kompetensi — <span className="font-semibold text-foreground">{m.nama}</span>
                  </label>
                  <Textarea
                    id={`rapor-deskripsi-${m.id}`}
                    rows={2}
                    value={deskripsi[m.id] || ''}
                    onChange={(e) => setDeskripsi((s) => ({ ...s, [m.id]: e.target.value }))}
                    placeholder={`Kosong akan tercetak sebagai "${m.predikat.label}".`}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground" htmlFor="rapor-kokurikuler">
                Capaian kokurikuler
              </label>
              <Textarea
                id="rapor-kokurikuler"
                rows={3}
                value={narasi.kokurikuler}
                onChange={(e) => setNarasi((s) => ({ ...s, kokurikuler: e.target.value }))}
                placeholder="Projek penguatan profil pelajar yang diikuti murid."
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground" htmlFor="rapor-ekstrakurikuler">
                Kegiatan ekstrakurikuler
              </label>
              <Textarea
                id="rapor-ekstrakurikuler"
                rows={3}
                value={narasi.ekstrakurikuler}
                onChange={(e) => setNarasi((s) => ({ ...s, ekstrakurikuler: e.target.value }))}
                placeholder="Misalnya: Pramuka — aktif dan disiplin."
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="mb-1 block text-xs text-muted-foreground" htmlFor="rapor-catatan">
              Catatan wali kelas
            </label>
            <Textarea
              id="rapor-catatan"
              rows={3}
              value={narasi.catatan}
              onChange={(e) => setNarasi((s) => ({ ...s, catatan: e.target.value }))}
              placeholder="Tersimpan per murid per periode."
            />
          </div>

          {data?.catatanDiperbaruiPada && !belumDisimpan && (
            <p className="mt-1 text-xs text-muted-foreground">
              Terakhir disimpan {tanggalPanjang(data.catatanDiperbaruiPada)}.
            </p>
          )}
          {/* Tanggapan orang tua sengaja tidak punya kotak isian di sini: pada rapor
              kertas kolom itu ditulis tangan wali murid. */}
          <p className="mt-1 text-xs text-muted-foreground">
            Kolom Tanggapan Orang Tua/Wali dicetak kosong untuk ditulis tangan.
          </p>

          <div className="rapor-pratinjau mt-4 rounded-lg">
            {isLoading && (
              <div className="space-y-3 rounded bg-white p-6">
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-40 w-full" />
              </div>
            )}
            {!isLoading && error && (
              <div className="admin-error-state" role="alert">
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}
            {!isLoading && !error && data && (
              <LembarRapor data={data} sekolah={sekolah} narasi={narasi} />
            )}
          </div>
        </div>

        {/* Salinan yang benar-benar dicetak. Dirender ke anak langsung body dan
            disembunyikan di layar; aturan @media print membalik keadaannya. */}
        {akarCetak && data && !isLoading && !error
          ? createPortal(
            <div className="rapor-hanya-cetak">
              <LembarRapor data={data} sekolah={sekolah} narasi={narasi} />
            </div>,
            akarCetak,
          )
          : null}
      </DialogContent>
    </Dialog>
  );
};

export default RaporCetak;
