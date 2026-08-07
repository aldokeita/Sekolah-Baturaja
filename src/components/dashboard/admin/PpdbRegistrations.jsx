import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check, ChevronDown, Download, Inbox, RefreshCw, Search, Trash2, UserCheck, UserX,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  URUTAN_STATUS, fetchPendaftaran, fetchStatistikPpdb, getPpdbErrorMessage,
  hapusPendaftaran, labelStatus, ubahPendaftaran, unduhCsvPendaftaran,
} from '@/lib/ppdbAdapters';
import { fetchPpdbContent } from '@/lib/ppdbContent';

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

const PpdbRegistrations = () => {
  const { role } = useAuth();
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
  const [cari, setCari] = useState('');
  const [cariTertunda, setCariTertunda] = useState('');

  const [terbuka, setTerbuka] = useState(null);
  const [draftCatatan, setDraftCatatan] = useState({});

  /* `berkas_siap` tersimpan sebagai id ("kk", "akta") karena daftar berkasnya
   * disunting pembeli dan bisa berubah. Nama bacanya diambil dari isi halaman
   * pendaftaran supaya panel tidak menampilkan id mentah kepada tata usaha. */
  const [namaBerkasPpdb, setNamaBerkasPpdb] = useState({});
  useEffect(() => {
    let aktif = true;
    fetchPpdbContent()
      .then((konten) => {
        if (!aktif) return;
        setNamaBerkasPpdb(Object.fromEntries(konten.berkas.map((b) => [b.id, b.name])));
      })
      .catch(() => { /* id mentah tetap terbaca, sekadar kurang ramah */ });
    return () => { aktif = false; };
  }, []);

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
        fetchPendaftaran({ tahun, status, q: cari }),
        fetchStatistikPpdb(tahun),
      ]);
      setRows(daftar);
      setStatistik(stat);
    } catch (error) {
      setLoadError(getPpdbErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [tahun, status, cari]);

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
            <h4 id="ppdb-pendaftaran" className="text-xl font-black text-foreground sm:text-2xl">Pendaftaran PPDB</h4>
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
    </section>
  );
};

export default PpdbRegistrations;
