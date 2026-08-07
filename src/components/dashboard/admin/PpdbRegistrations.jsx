import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check, ChevronDown, Download, FileText, GraduationCap, Inbox, MessageCircle, Printer,
  RefreshCw, Search, Trash2, UserCheck, UserX,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import useSchoolIdentity from '@/hooks/useSchoolIdentity';
import {
  URUTAN_STATUS, fetchPendaftaran, fetchRekapPpdb, fetchStatistikPpdb, getPpdbErrorMessage,
  hapusPendaftaran, imporPendaftaranLama, jadikanMurid, labelStatus, ubahPendaftaran,
  unduhCsvPendaftaran, usulanNomorInduk,
} from '@/lib/ppdbAdapters';
import { fetchPpdbContent } from '@/lib/ppdbContent';
import { fetchClassList } from '@/lib/dataMasterAdapters';
import { fetchWhatsAppTemplates, renderWhatsAppTemplate } from '@/lib/whatsappTemplateAdapters';
import '@/styles/cetak-bukti.css';

/**
 * Panel Pendaftaran PPDB — tempat tata usaha memverifikasi calon murid.
 *
 * Sebelum panel ini ada, pendaftaran dari halaman publik masuk ke Pesan Masuk
 * sebagai satu paragraf teks bersama pesan pengunjung biasa: tanpa kolom, tanpa
 * status, dan tanpa cara menandai mana yang sudah diperiksa.
 *
 * Yang TIDAK bisa dilakukan di sini, dengan sengaja: menyunting data calon murid.
 * Yang mengisinya orang tua, dan riwayat verifikasi kehilangan artinya bila isinya
 * bisa diubah belakangan. Server pun hanya menerima perubahan status dan catatan.
 */

const NADA_STATUS = {
  baru: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  diverifikasi: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  diterima: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  ditolak: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
};

const Lencana = ({ status }) => (
  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${NADA_STATUS[status] || ''}`}>
    {labelStatus(status)}
  </span>
);

const tanggalPanjang = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

const waktuSingkat = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
};

const isi = (nilai) => (nilai === null || nilai === undefined || nilai === '' ? '—' : nilai);

/** Satu baris keterangan pada rincian yang dibuka. */
const Data = ({ label, children }) => (
  <div className="min-w-0">
    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
    <dd className="mt-0.5 break-words text-sm text-foreground">{children}</dd>
  </div>
);

/* Nomor WhatsApp disimpan dalam bentuk 08…, sedangkan tautan wa.me menuntut
 * awalan negara. Diubah di sini saja supaya bentuk tersimpannya tetap yang mudah
 * dibaca dan disalin tata usaha. */
const tautanWa = (hp) => {
  const bersih = String(hp || '').replace(/[^0-9]/g, '');
  if (!bersih) return null;
  return `https://wa.me/62${bersih.replace(/^0+/, '')}`;
};

/* Template mana yang dipakai untuk tiap status. Status `baru` tidak punya pesan:
 * belum ada yang bisa dikabarkan. */
const TEMPLATE_STATUS = {
  diverifikasi: 'ppdbDiverifikasi',
  diterima: 'ppdbDiterima',
  ditolak: 'ppdbDitolak',
};

const PpdbRegistrations = () => {
  const { role } = useAuth();
  const sekolah = useSchoolIdentity();
  // Hanya admin yang boleh menghapus; tata usaha memverifikasi dan menolak.
  // Server menerapkan aturan yang sama — ini sekadar tidak memajang tombol mati.
  const bolehHapus = ['admin', 'superadmin'].includes(role);

  const [rows, setRows] = useState([]);
  const [statistik, setStatistik] = useState({ cacah: {}, total: 0, tahun_ajaran: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [sedangSimpan, setSedangSimpan] = useState(null);

  const [tahun, setTahun] = useState('');
  const [status, setStatus] = useState('');
  const [wilayah, setWilayah] = useState('');
  const [cari, setCari] = useState('');
  const [cariTertunda, setCariTertunda] = useState('');

  const [terbuka, setTerbuka] = useState(null);
  const [draftCatatan, setDraftCatatan] = useState({});

  /* `berkas_siap` tersimpan sebagai id ("kk", "akta") karena daftar berkasnya
   * disunting pembeli dan bisa berubah. Nama bacanya diambil dari isi halaman
   * pendaftaran supaya panel tidak menampilkan id mentah kepada tata usaha. */
  const [namaBerkasPpdb, setNamaBerkasPpdb] = useState({});
  const [jalurPpdb, setJalurPpdb] = useState([]);
  const [wilayahPpdb, setWilayahPpdb] = useState([]);
  const [kelasList, setKelasList] = useState([]);
  const [templatePesan, setTemplatePesan] = useState({});

  useEffect(() => {
    let aktif = true;
    // Ketiganya dimuat sekali dan tidak menghalangi daftar pendaftaran: kalau salah
    // satu gagal, panel tetap berguna — hanya tombolnya yang kurang lengkap.
    fetchPpdbContent()
      .then((konten) => {
        if (!aktif) return;
        setNamaBerkasPpdb(Object.fromEntries(konten.berkas.map((b) => [b.id, b.name])));
        setJalurPpdb(konten.jalur || []);
        setWilayahPpdb(konten.wilayah || []);
      })
      .catch(() => { /* id mentah tetap terbaca, sekadar kurang ramah */ });
    fetchClassList({ is_active: true })
      .then((rows) => { if (aktif) setKelasList(rows || []); })
      .catch(() => { /* dialog tetap bisa dipakai tanpa memilih kelas */ });
    fetchWhatsAppTemplates()
      .then((t) => { if (aktif) setTemplatePesan(t || {}); })
      .catch(() => { /* tombol WhatsApp disembunyikan bila template tidak ada */ });
    return () => { aktif = false; };
  }, []);

  /* Dialog "Jadikan murid". `pendaftar` null berarti tertutup. */
  const [dialog, setDialog] = useState(null);
  const [formMurid, setFormMurid] = useState({ nomorInduk: '', classId: '', angkatan: '' });
  const [sedangCatat, setSedangCatat] = useState(false);

  const bukaDialogMurid = async (row) => {
    setDialog(row);
    setFormMurid({ nomorInduk: '', classId: '', angkatan: row.tahun_ajaran || '' });
    try {
      // Usulan diminta saat dialog dibuka, bukan saat panel dimuat: nomor bisa
      // terpakai oleh petugas lain di antara keduanya.
      const usulan = await usulanNomorInduk(row.tahun_ajaran);
      setFormMurid((s) => ({ ...s, nomorInduk: usulan }));
    } catch {
      /* dibiarkan kosong; petugas mengisi sendiri */
    }
  };

  const simpanMurid = async () => {
    if (!dialog) return;
    if (!formMurid.nomorInduk.trim()) {
      toast({ title: 'Nomor induk belum diisi', variant: 'destructive' });
      return;
    }
    setSedangCatat(true);
    try {
      const hasil = await jadikanMurid(dialog.id, formMurid);
      toast({
        title: 'Tercatat sebagai murid',
        description: `${hasil.nama} — nomor induk ${hasil.nomor_induk}. Sandi awalnya NISN murid.`,
      });
      setDialog(null);
      await muat({ diam: true });
      // Panel Data Murid menyegarkan dirinya lewat peristiwa ini.
      window.dispatchEvent(new Event('lpq:santri-data-changed'));
    } catch (error) {
      toast({ title: 'Gagal mencatat murid', description: getPpdbErrorMessage(error), variant: 'destructive' });
    } finally {
      setSedangCatat(false);
    }
  };

  /* Membuka WhatsApp dengan pesan yang sudah terisi.
   *
   * Pengirimannya TIDAK otomatis — tidak ada gerbang WhatsApp di aplikasi ini.
   * Petugas menekan tombol, WhatsApp terbuka, dan dia yang menekan kirim. Pola yang
   * sama dipakai bukti pembayaran dan pemberitahuan kenaikan jilid. */
  const kabariOrangTua = (row) => {
    const kunci = TEMPLATE_STATUS[row.status];
    const template = kunci && templatePesan[kunci];
    if (!template) {
      toast({ title: 'Template pesan belum tersedia', description: 'Isi dulu di Konfigurasi → Pesan WhatsApp.', variant: 'destructive' });
      return;
    }
    const nomor = String(row.no_hp_wali || row.no_hp || '').replace(/[^0-9]/g, '');
    if (!nomor) {
      toast({ title: 'Tidak ada nomor WhatsApp', description: 'Pendaftaran ini tidak mencantumkan nomor.', variant: 'destructive' });
      return;
    }
    const pesan = renderWhatsAppTemplate(template, {
      nama_santri: row.nama_lengkap,
      // Nama ibu lebih sering yang memegang nomor; ayah jadi cadangan.
      nama_ortu: row.nama_ibu || row.nama_ayah || 'Ayah/Bunda',
      nomor_pendaftaran: row.nomor_pendaftaran,
      tahun_ajaran: row.tahun_ajaran,
      jalur: row.jalur_label || '-',
      telepon: sekolah.phone,
      nama_lembaga: sekolah.name,
    });
    window.open(`https://wa.me/62${nomor.replace(/^0+/, '')}?text=${encodeURIComponent(pesan)}`, '_blank', 'noopener');
  };

  // Pencarian ditunda supaya tiap ketukan tidak memanggil server.
  useEffect(() => {
    const id = setTimeout(() => setCari(cariTertunda), 400);
    return () => clearTimeout(id);
  }, [cariTertunda]);

  const muat = useCallback(async ({ diam = false } = {}) => {
    if (!diam) setIsLoading(true);
    setLoadError(null);
    try {
      const [daftar, stat] = await Promise.all([
        fetchPendaftaran({ tahun, status, q: cari, wilayah }),
        fetchStatistikPpdb(tahun),
      ]);
      setRows(daftar);
      setStatistik(stat);
    } catch (error) {
      setLoadError(getPpdbErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [tahun, status, cari, wilayah]);

  useEffect(() => { muat(); }, [muat]);

  const ubahStatus = async (row, statusBaru) => {
    setSedangSimpan(row.id);
    try {
      await ubahPendaftaran(row.id, { status: statusBaru });
      toast({ title: 'Status diperbarui', description: `${row.nama_lengkap} — ${labelStatus(statusBaru)}.` });
      await muat({ diam: true });
    } catch (error) {
      toast({ title: 'Gagal memperbarui', description: getPpdbErrorMessage(error), variant: 'destructive' });
    } finally {
      setSedangSimpan(null);
    }
  };

  const simpanCatatan = async (row) => {
    const catatan = draftCatatan[row.id] ?? row.catatan ?? '';
    setSedangSimpan(row.id);
    try {
      await ubahPendaftaran(row.id, { catatan });
      toast({ title: 'Catatan tersimpan' });
      await muat({ diam: true });
    } catch (error) {
      toast({ title: 'Gagal menyimpan catatan', description: getPpdbErrorMessage(error), variant: 'destructive' });
    } finally {
      setSedangSimpan(null);
    }
  };

  const hapus = async (row) => {
    if (!window.confirm(`Hapus pendaftaran ${row.nomor_pendaftaran} — ${row.nama_lengkap}?\n\nPendaftaran yang ditolak sebaiknya dibiarkan sebagai riwayat, bukan dihapus.`)) return;
    setSedangSimpan(row.id);
    try {
      await hapusPendaftaran(row.id);
      toast({ title: 'Pendaftaran dihapus' });
      await muat({ diam: true });
    } catch (error) {
      toast({ title: 'Gagal menghapus', description: getPpdbErrorMessage(error), variant: 'destructive' });
    } finally {
      setSedangSimpan(null);
    }
  };

  const [sedangImpor, setSedangImpor] = useState(false);

  /* Lembar rekap. Dimuat hanya saat diminta, bukan bersama panel: ia empat query
   * pengelompokan yang tidak dibutuhkan tata usaha untuk pekerjaan sehari-hari. */
  const [rekap, setRekap] = useState(null);
  const [sedangRekap, setSedangRekap] = useState(false);

  const bukaRekap = async () => {
    setSedangRekap(true);
    try {
      setRekap(await fetchRekapPpdb(tahun));
    } catch (error) {
      toast({ title: 'Gagal memuat rekap', description: getPpdbErrorMessage(error), variant: 'destructive' });
    } finally {
      setSedangRekap(false);
    }
  };

  /* Impor pendaftaran lama dari Pesan Masuk.
   *
   * Disimulasikan lebih dulu supaya petugas melihat berapa yang akan masuk dan
   * berapa yang tidak bisa diurai SEBELUM menyetujuinya. Penguraian teks bebas
   * tidak bisa dijamin benar, jadi persetujuan itu bukan formalitas. */
  const imporLama = async () => {
    setSedangImpor(true);
    try {
      const coba = await imporPendaftaranLama({ simulasi: true });
      if (coba.ditemukan === 0) {
        toast({ title: 'Tidak ada yang perlu diimpor', description: 'Tidak ditemukan pendaftaran lama di Pesan Masuk.' });
        return;
      }
      const akanMasuk = coba.diimpor?.length || 0;
      const takTerbaca = coba.dilewati?.length || 0;
      if (akanMasuk === 0) {
        toast({
          title: 'Tidak ada yang bisa diimpor',
          description: `${takTerbaca} pesan ditemukan tapi tidak bisa diurai. Alasan pertama: ${coba.dilewati?.[0]?.alasan || '—'}`,
          variant: 'destructive',
        });
        return;
      }
      const rincian = (coba.dilewati || []).slice(0, 5)
        .map((d) => `• ${d.nama || 'tanpa nama'} — ${d.alasan}`).join('\n');
      const setuju = window.confirm(
        `Ditemukan ${coba.ditemukan} pendaftaran lama di Pesan Masuk.\n\n`
        + `${akanMasuk} bisa diimpor.\n`
        + `${takTerbaca} dilewati.\n\n`
        + (rincian ? `Yang dilewati:\n${rincian}\n\n` : '')
        + 'Pesan aslinya tidak dihapus, dan menjalankan ini lagi tidak akan menggandakan data.\n\nLanjutkan impor?',
      );
      if (!setuju) return;

      const hasil = await imporPendaftaranLama({ simulasi: false });
      toast({
        title: `${hasil.diimpor?.length || 0} pendaftaran diimpor`,
        description: 'Nomornya berawalan LAMA- karena dibuat saat impor. Periksa isinya, lalu perbarui statusnya.',
      });
      await muat({ diam: true });
    } catch (error) {
      toast({ title: 'Gagal mengimpor', description: getPpdbErrorMessage(error), variant: 'destructive' });
    } finally {
      setSedangImpor(false);
    }
  };

  /* Kursi per jalur = persentase kuota × daya tampung, dibandingkan dengan yang
   * sudah diterima. Hanya ditampilkan bila daya tampungnya sudah diisi; tanpa itu
   * seluruh angkanya nol dan hanya membingungkan. */
  const ringkasanKursi = useMemo(() => {
    const dayaTampung = statistik.daya_tampung || 0;
    if (!dayaTampung || jalurPpdb.length === 0) return null;
    return {
      dayaTampung,
      baris: jalurPpdb.map((j) => {
        const kursi = Math.floor((dayaTampung * (Number(j.kuota) || 0)) / 100);
        const diterima = statistik.diterima_jalur?.[j.id] || 0;
        return { id: j.id, nama: j.name, kuota: Number(j.kuota) || 0, kursi, diterima };
      }),
    };
  }, [statistik, jalurPpdb]);

  const namaBerkas = useMemo(() => {
    const bagian = ['pendaftaran-ppdb'];
    if (tahun) bagian.push(tahun.replace(/\//g, '-'));
    if (status) bagian.push(status);
    return `${bagian.join('-')}.csv`;
  }, [tahun, status]);

  const kartu = URUTAN_STATUS.map((s) => ({ s, jumlah: statistik.cacah?.[s] ?? 0 }));

  if (isLoading && rows.length === 0) {
    return (
      <section className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-72 admin-skeleton-shimmer" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl admin-skeleton-shimmer" />)}
        </div>
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl admin-skeleton-shimmer" />)}
      </section>
    );
  }

  return (
    <section className="space-y-6 rounded-lg border bg-muted/20 p-4 sm:p-6" aria-labelledby="ppdb-pendaftaran">
      <div className="flex flex-col gap-4 border-b pb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="admin-panel-header-icon"><Inbox /></div>
          <div>
            <h4 id="ppdb-pendaftaran" className="text-xl font-black text-foreground sm:text-2xl">Pendaftaran SPMB</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Calon murid yang mengisi formulir di halaman pendaftaran. Data calon murid tidak bisa
              disunting di sini — yang mengisinya orang tua.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => muat()} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Muat ulang
          </Button>
          {/* Hanya admin: impor menulis banyak baris sekaligus dari penguraian teks,
              dan yang membereskannya bila keliru juga admin. */}
          {bolehHapus && (
            <Button
              type="button"
              variant="outline"
              onClick={imporLama}
              disabled={sedangImpor}
              title="Memindahkan pendaftaran lama yang dulu masuk ke Pesan Masuk"
            >
              <Inbox className="mr-2 h-4 w-4" /> {sedangImpor ? 'Memeriksa…' : 'Impor dari Pesan Masuk'}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={bukaRekap} disabled={sedangRekap}>
            <FileText className="mr-2 h-4 w-4" /> {sedangRekap ? 'Menyusun…' : 'Lembar rekap'}
          </Button>
          <Button
            type="button"
            onClick={() => unduhCsvPendaftaran(rows, namaBerkas)}
            disabled={rows.length === 0}
            title={rows.length === 0 ? 'Belum ada pendaftaran untuk diunduh' : `Unduh ${rows.length} baris`}
          >
            <Download className="mr-2 h-4 w-4" /> Unduh CSV
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="admin-error-state" role="alert">
          <p className="text-sm font-medium">Gagal memuat pendaftaran: {loadError}</p>
        </div>
      )}

      {/* Ringkasan. Menekan kartu ikut menyaring, jadi angkanya bukan sekadar hiasan. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kartu.map(({ s, jumlah }) => {
          const aktif = status === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(aktif ? '' : s)}
              aria-pressed={aktif}
              className={`admin-card p-4 text-left transition ${aktif ? 'ring-2 ring-primary' : 'hover:bg-muted/40'}`}
            >
              <p className="text-2xl font-black text-foreground">{jumlah}</p>
              <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{labelStatus(s)}</p>
            </button>
          );
        })}
      </div>

      {/* Daya tampung dan kursi per jalur. Angka saja, tanpa teguran — sekolah yang
          memutuskan, dan ada kondisi lapangan yang tidak bisa ditebak sistem. */}
      {ringkasanKursi ? (
        <div className="admin-card overflow-hidden">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b p-4">
            <h5 className="font-bold text-foreground">Daya tampung</h5>
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{ringkasanKursi.dayaTampung}</strong> kursi dari kapasitas seluruh kelas aktif
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2">Jalur</th>
                  <th className="px-4 py-2 text-right">Kuota</th>
                  <th className="px-4 py-2 text-right">Kursi</th>
                  <th className="px-4 py-2 text-right">Diterima</th>
                  <th className="px-4 py-2 text-right">Sisa</th>
                </tr>
              </thead>
              <tbody>
                {ringkasanKursi.baris.map((b) => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="px-4 py-2 font-semibold text-foreground">{b.nama}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{b.kuota}%</td>
                    <td className="px-4 py-2 text-right">{b.kursi}</td>
                    <td className="px-4 py-2 text-right">{b.diterima}</td>
                    <td className="px-4 py-2 text-right font-semibold text-foreground">{b.kursi - b.diterima}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t p-3 text-xs text-muted-foreground">
            Kuota diatur di <strong>Konten → Informasi Pendaftaran</strong>, kapasitas kelas di
            <strong> Manajemen Kelas</strong>. Angka sisa boleh minus — sistem tidak memblokir
            penerimaan, keputusannya tetap milik sekolah.
          </p>
        </div>
      ) : (
        <div className="admin-card bg-muted/30 p-4 text-sm text-muted-foreground">
          Daya tampung belum bisa dihitung. Isi <strong>kapasitas</strong> tiap kelas di Manajemen
          Kelas, dan <strong>kuota jalur</strong> di Konten → Informasi Pendaftaran, supaya sisa kursi
          per jalur tampil di sini.
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="admin-edit-field flex-1">
          <label htmlFor="ppdb-cari">Cari</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="ppdb-cari"
              className="pl-9"
              value={cariTertunda}
              placeholder="Nama, nomor pendaftaran, NISN, atau nomor HP"
              onChange={(e) => setCariTertunda(e.target.value)}
            />
          </div>
        </div>
        <div className="admin-edit-field sm:w-52">
          <label htmlFor="ppdb-tahun">Tahun ajaran</label>
          <select
            id="ppdb-tahun"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={tahun}
            onChange={(e) => setTahun(e.target.value)}
          >
            <option value="">Semua tahun</option>
            {(statistik.tahun_ajaran || []).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {/* Penyaring wilayah hanya muncul bila sekolah memakai daftar wilayah. */}
        {wilayahPpdb.length > 0 && (
          <div className="admin-edit-field sm:w-56">
            <label htmlFor="ppdb-wilayah-saring">Wilayah</label>
            <select
              id="ppdb-wilayah-saring"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={wilayah}
              onChange={(e) => setWilayah(e.target.value)}
            >
              <option value="">Semua wilayah</option>
              {wilayahPpdb.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
        )}
        <div className="admin-edit-field sm:w-52">
          <label htmlFor="ppdb-status">Status</label>
          <select
            id="ppdb-status"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Semua status</option>
            {URUTAN_STATUS.map((s) => <option key={s} value={s}>{labelStatus(s)}</option>)}
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="admin-card p-8 text-center">
          <Inbox className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-bold text-foreground">
            {cari || status || tahun ? 'Tidak ada pendaftaran yang cocok' : 'Belum ada pendaftaran masuk'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {cari || status || tahun
              ? 'Ubah atau kosongkan penyaring di atas.'
              : 'Pendaftaran akan muncul di sini begitu orang tua mengirim formulir di halaman pendaftaran.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const buka = terbuka === row.id;
            const sibuk = sedangSimpan === row.id;
            const wa = tautanWa(row.no_hp);
            return (
              <article key={row.id} className="admin-card overflow-hidden">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => setTerbuka(buka ? null : row.id)}
                    aria-expanded={buka}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <ChevronDown className={`h-4 w-4 flex-none text-muted-foreground transition-transform ${buka ? 'rotate-180' : ''}`} />
                    <div className="min-w-0">
                      <p className="truncate font-bold text-foreground">{row.nama_lengkap}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {row.nomor_pendaftaran} · {isi(row.jalur_label)} · masuk {waktuSingkat(row.created_at)}
                      </p>
                    </div>
                  </button>
                  <div className="flex flex-none flex-wrap items-center gap-2">
                    <Lencana status={row.status} />
                    {row.santri_id && (
                      <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        <GraduationCap className="mr-1 h-3.5 w-3.5" /> Sudah jadi murid
                      </span>
                    )}
                    {row.status !== 'diverifikasi' && row.status !== 'diterima' && (
                      <Button type="button" size="sm" variant="outline" disabled={sibuk} onClick={() => ubahStatus(row, 'diverifikasi')}>
                        <Check className="mr-1 h-4 w-4" /> Sudah diperiksa
                      </Button>
                    )}
                    {row.status !== 'diterima' && (
                      <Button type="button" size="sm" disabled={sibuk} onClick={() => ubahStatus(row, 'diterima')}>
                        <UserCheck className="mr-1 h-4 w-4" /> Terima
                      </Button>
                    )}
                    {/* Hanya yang sudah diterima dan belum tercatat. Server menolak
                        keduanya juga — ini sekadar tidak memajang tombol mati. */}
                    {row.status === 'diterima' && !row.santri_id && (
                      <Button type="button" size="sm" disabled={sibuk} onClick={() => bukaDialogMurid(row)}>
                        <GraduationCap className="mr-1 h-4 w-4" /> Jadikan murid
                      </Button>
                    )}
                    {TEMPLATE_STATUS[row.status] && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={sibuk}
                        onClick={() => kabariOrangTua(row)}
                        title="Membuka WhatsApp dengan pesan yang sudah terisi. Anda yang menekan kirim."
                      >
                        <MessageCircle className="mr-1 h-4 w-4" /> Kabari
                      </Button>
                    )}
                    {row.status !== 'ditolak' && (
                      <Button type="button" size="sm" variant="outline" disabled={sibuk} onClick={() => ubahStatus(row, 'ditolak')}>
                        <UserX className="mr-1 h-4 w-4" /> Tolak
                      </Button>
                    )}
                    {bolehHapus && (
                      <Button type="button" size="icon" variant="destructive" className="h-8 w-8" disabled={sibuk} onClick={() => hapus(row)} aria-label={`Hapus pendaftaran ${row.nomor_pendaftaran}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {buka && (
                  <div className="space-y-5 border-t bg-background/60 p-4">
                    {/* Satu kolom di bawah 640px: dua kolom menyisakan ~130px per sel,
                        terlalu sempit untuk NIK 16 angka dan alamat lengkap. */}
                    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <Data label="Nomor pendaftaran">{row.nomor_pendaftaran}</Data>
                      <Data label="Tahun ajaran">{isi(row.tahun_ajaran)}</Data>
                      <Data label="NISN">{isi(row.nisn)}</Data>
                      <Data label="NIK">{isi(row.nik)}</Data>
                      <Data label="Tempat, tanggal lahir">
                        {`${isi(row.tempat_lahir)}, ${tanggalPanjang(row.tanggal_lahir)}`}
                      </Data>
                      <Data label="Jenis kelamin">
                        {row.jenis_kelamin === 'L' ? 'Laki-laki' : row.jenis_kelamin === 'P' ? 'Perempuan' : '—'}
                      </Data>
                      <Data label="Usia">{isi(row.usia_keterangan)}</Data>
                      <Data label="Nomor WhatsApp">
                        {wa ? (
                          <a href={wa} target="_blank" rel="noreferrer" className="font-semibold text-primary underline">
                            {row.no_hp}
                          </a>
                        ) : isi(row.no_hp)}
                      </Data>
                      <Data label="Email">{isi(row.email)}</Data>
                      <Data label="Alamat">{isi(row.alamat)}</Data>
                      <Data label="Wilayah domisili">{isi(row.wilayah)}</Data>
                      <Data label="Sekolah asal">
                        {`${isi(row.sekolah_asal)}${row.npsn_asal ? ` (NPSN ${row.npsn_asal})` : ''}`}
                      </Data>
                      <Data label="Program pendukung">{isi(row.minat)}</Data>
                      <Data label="Nama ayah">{isi(row.nama_ayah)}</Data>
                      <Data label="Nama ibu">{isi(row.nama_ibu)}</Data>
                      <Data label="Pekerjaan orang tua">{isi(row.pekerjaan_orang_tua)}</Data>
                      <Data label="Nomor WhatsApp wali">{isi(row.no_hp_wali)}</Data>
                    </dl>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Kesiapan berkas yang dinyatakan
                      </p>
                      <p className="mt-1 text-sm text-foreground">
                        {Object.entries(row.berkas_siap || {})
                          .filter(([, v]) => v)
                          // Berkas yang sudah dihapus pembeli dari daftar tetap muncul
                          // sebagai id-nya — lebih baik daripada hilang tanpa jejak.
                          .map(([k]) => namaBerkasPpdb[k] || k)
                          .join(', ') || 'Belum ada yang dinyatakan siap'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Ini pernyataan orang tua, bukan berkas terunggah. Berkas aslinya diperiksa saat daftar ulang.
                      </p>
                    </div>

                    <div className="admin-edit-field">
                      <label htmlFor={`ppdb-catatan-${row.id}`}>Catatan verifikasi</label>
                      <Textarea
                        id={`ppdb-catatan-${row.id}`}
                        rows={2}
                        value={draftCatatan[row.id] ?? row.catatan ?? ''}
                        placeholder="Contoh: akta kelahiran belum dibawa, dihubungi lewat WhatsApp 12 Juli."
                        onChange={(e) => setDraftCatatan((s) => ({ ...s, [row.id]: e.target.value }))}
                      />
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <Button type="button" size="sm" variant="outline" disabled={sibuk} onClick={() => simpanCatatan(row)}>
                          {sibuk ? 'Menyimpan…' : 'Simpan catatan'}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          Terakhir diputuskan: {waktuSingkat(row.diproses_pada)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Menampilkan {rows.length} pendaftaran{statistik.total ? ` dari ${statistik.total} total` : ''}.
        Daftar dibatasi 500 baris terbaru; gunakan penyaring bila lebih dari itu.
      </p>

      {/* Lembar rekap. `bukti-cetak` menyalakan aturan @media print di sdnb.css,
          jadi yang keluar hanya lembarnya — bukan seluruh dashboard. */}
      <Dialog open={!!rekap} onOpenChange={(buka) => { if (!buka) setRekap(null); }}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader className="bukti-sembunyi-cetak">
            <DialogTitle>Lembar rekap SPMB</DialogTitle>
            <DialogDescription>
              Angka dihitung dari seluruh pendaftaran{rekap?.tahun_ajaran ? ` tahun ${rekap.tahun_ajaran}` : ''},
              bukan dari daftar yang tampil di panel.
            </DialogDescription>
          </DialogHeader>

          {rekap && (
            <div className="bukti-cetak space-y-5 text-sm">
              <div className="bukti-kepala" style={{ display: 'none' }}>
                <strong style={{ fontSize: '15px' }}>{sekolah.name}</strong>
                <div style={{ fontSize: '12px' }}>{sekolah.address}</div>
                <div style={{ fontSize: '12px' }}>{sekolah.phone} · {sekolah.email}</div>
              </div>

              <div>
                <h5 className="text-base font-bold text-foreground">
                  Rekapitulasi Penerimaan Murid Baru {rekap.tahun_ajaran || '— semua tahun'}
                </h5>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
                  <span>Pendaftar: <strong className="text-foreground">{rekap.total}</strong></span>
                  <span>Diterima: <strong className="text-foreground">{rekap.diterima}</strong></span>
                  <span>Tercatat sebagai murid: <strong className="text-foreground">{rekap.jadi_murid}</strong></span>
                </div>
              </div>

              {[
                ['Menurut jalur', rekap.jalur],
                ['Menurut jenis kelamin', rekap.jenis_kelamin],
                ['Menurut wilayah domisili', rekap.wilayah],
                ['Menurut sekolah asal', rekap.asal_sekolah],
              ].map(([judul, baris]) => (
                <div key={judul}>
                  <h6 className="font-bold text-foreground">{judul}</h6>
                  {(baris || []).length === 0 ? (
                    <p className="mt-1 text-muted-foreground">Belum ada data.</p>
                  ) : (
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            <th className="py-1.5 pr-3">Keterangan</th>
                            <th className="py-1.5 px-2 text-right">Mendaftar</th>
                            <th className="py-1.5 px-2 text-right">Diperiksa</th>
                            <th className="py-1.5 px-2 text-right">Diterima</th>
                            <th className="py-1.5 pl-2 text-right">Tidak diterima</th>
                          </tr>
                        </thead>
                        <tbody>
                          {baris.map((b) => (
                            <tr key={b.label} className="border-b last:border-0">
                              <td className="py-1.5 pr-3 font-semibold text-foreground">{b.label}</td>
                              <td className="py-1.5 px-2 text-right">{b.total}</td>
                              <td className="py-1.5 px-2 text-right">{b.diverifikasi}</td>
                              <td className="py-1.5 px-2 text-right">{b.diterima}</td>
                              <td className="py-1.5 pl-2 text-right">{b.ditolak}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}

              <p className="text-xs text-muted-foreground">
                Kolom Diperiksa berisi yang berstatus Sudah diperiksa dan belum diputuskan. Baris
                &ldquo;Tidak diisi&rdquo; muncul bila pendaftar tidak melengkapi keterangan itu.
              </p>
            </div>
          )}

          <DialogFooter className="bukti-sembunyi-cetak">
            <Button type="button" variant="outline" onClick={() => setRekap(null)}>Tutup</Button>
            <Button type="button" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Cetak
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!dialog} onOpenChange={(buka) => { if (!buka) setDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Jadikan murid</DialogTitle>
            <DialogDescription>
              {dialog ? `${dialog.nama_lengkap} — ${dialog.nomor_pendaftaran}` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="admin-edit-field">
              <label htmlFor="murid-nomor-induk">Nomor induk</label>
              <Input
                id="murid-nomor-induk"
                value={formMurid.nomorInduk}
                placeholder="2026001"
                onChange={(e) => setFormMurid((s) => ({ ...s, nomorInduk: e.target.value }))}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Diusulkan otomatis dari nomor yang belum terpakai. Boleh Anda ganti.
              </p>
            </div>

            <div className="admin-edit-field">
              <label htmlFor="murid-kelas">Kelas</label>
              <select
                id="murid-kelas"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={formMurid.classId}
                onChange={(e) => setFormMurid((s) => ({ ...s, classId: e.target.value }))}
              >
                <option value="">Belum ditempatkan</option>
                {kelasList.map((k) => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Boleh dikosongkan dan ditentukan nanti di Manajemen Kelas.
              </p>
            </div>

            <div className="admin-edit-field">
              <label htmlFor="murid-angkatan">Angkatan</label>
              <Input
                id="murid-angkatan"
                value={formMurid.angkatan}
                placeholder="2026/2027"
                onChange={(e) => setFormMurid((s) => ({ ...s, angkatan: e.target.value }))}
              />
            </div>

            <div className="admin-card bg-muted/40 p-3 text-xs text-muted-foreground">
              Seluruh data calon murid ikut dipindahkan: NISN, NIK, tempat & tanggal lahir, alamat,
              nama orang tua, dan nomor WhatsApp. Akun muridnya langsung dibuat, dengan
              <strong> NISN sebagai sandi awal</strong>. Data selebihnya bisa dilengkapi di Data Murid.
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialog(null)} disabled={sedangCatat}>
              Batal
            </Button>
            <Button type="button" onClick={simpanMurid} disabled={sedangCatat}>
              {sedangCatat ? 'Mencatat…' : 'Catat sebagai murid'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default PpdbRegistrations;
