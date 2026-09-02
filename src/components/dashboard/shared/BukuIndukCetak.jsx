import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookMarked, Printer, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import useSchoolIdentity from '@/hooks/useSchoolIdentity';
import {
  fetchClassList,
  fetchGuruList,
  fetchSantriClassMutations,
  fetchSantriList,
} from '@/lib/dataMasterAdapters';
import { cariKepalaSekolah } from '@/lib/raporAdapters';
import { resolveAvatarRecords } from '@/lib/storageAdapters';
import '@/styles/buku-induk-cetak.css';

/**
 * Buku induk murid yang bisa dicetak — satu murid satu halaman A4.
 *
 * Buku induk adalah catatan resmi sekolah: identitas murid, orang tua, riwayat
 * kelasnya, dan bagian keluar yang baru terisi bertahun-tahun kemudian. Sebelum
 * ini datanya sudah lengkap di aplikasi tapi tidak ada lembar cetaknya, jadi tata
 * usaha menyalinnya ulang ke buku besar dengan tangan.
 *
 * Beberapa bagian SENGAJA dibiarkan kosong sebagai garis isian: tanggal keluar,
 * alasan, dan keterangan tamat. Itu bukan kelalaian — ketiganya diisi dengan pena
 * bertahun-tahun setelah lembarnya dicetak, dan memaksa sekolah mencetak ulang
 * hanya untuk mengisinya justru menyalahi cara buku induk dipakai.
 */

const AKAR_CETAK_ID = 'induk-cetak-root';

const tanggalPanjang = (iso) => {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

const tanggalPendek = (iso) => {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/* Sama alasannya dengan kartu pelajar: `foto_url` tidak bisa dipakai untuk
 * menyimpulkan murid punya foto, karena tautan bertanda tangan selalu berhasil
 * dibuat dari id murid meski berkasnya tidak ada. Hanya `avatar_path` yang jujur;
 * tautan luar tetap diterima untuk data pindahan. */
const punyaFotoAsli = (m) => {
  if (m?.avatar_path) return true;
  const url = String(m?.foto_url || '').trim();
  return url !== '' && !url.includes('/files/avatars/');
};

const useAkarInduk = (aktif) => {
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
      if (dibuatDiSini && el.parentNode && el.childNodes.length === 0) {
        el.parentNode.removeChild(el);
      }
    };
  }, [aktif]);

  return akar;
};

const Baris = ({ label, nilai, lebar = false }) => (
  <div className={lebar ? 'induk-baris induk-baris--lebar' : 'induk-baris'}>
    <dt>{label}</dt>
    <dd>{nilai || '-'}</dd>
  </div>
);

export const LembarBukuInduk = ({ murid, sekolah, kepalaSekolah, namaKelasDari, riwayat = [] }) => {
  const kelas = murid.class?.nama_kelas
    || murid.class_nama
    || namaKelasDari?.(murid.current_class_id || murid.id_kelas)
    || '';

  const berkas = [
    ['Foto', murid.berkas_foto],
    ['Akta kelahiran', murid.berkas_akta],
    ['Kartu keluarga', murid.berkas_kk],
    ['Formulir pendaftaran', murid.berkas_form],
  ];

  return (
    <div className="induk-lembar">
      <div className="induk-kop">
        <div className="induk-kop__lambang">{sekolah.logoAbbr}</div>
        <div style={{ minWidth: 0 }}>
          <p className="induk-kop__nama">{sekolah.name}</p>
          <p className="induk-kop__alamat">
            {sekolah.address}
            {sekolah.phone ? ` · Telp. ${sekolah.phone}` : ''}
          </p>
        </div>
      </div>

      <div className="induk-judul">
        <p className="induk-judul__utama">Buku Induk Murid</p>
        <p className="induk-judul__nomor">
          Nomor Induk: <strong>{murid.nomor_induk || murid.nis || '-'}</strong>
          {murid.nisn ? ` · NISN: ${murid.nisn}` : ''}
        </p>
      </div>

      <div className="induk-atas">
        <div className="induk-atas__isi">
          <div className="induk-bagian">
            <h2 className="induk-bagian__judul">A · Keterangan Murid</h2>
            <dl className="induk-data">
              <Baris label="Nama lengkap" nilai={murid.nama_lengkap} lebar />
              <Baris label="Nama panggilan" nilai={murid.nama_panggilan} />
              <Baris label="Jenis kelamin" nilai={murid.jenis_kelamin} />
              <Baris label="Agama" nilai={murid.agama} />
              <Baris label="NIS" nilai={murid.nis} />
              <Baris label="Tempat lahir" nilai={murid.tempat_lahir} />
              <Baris label="Tanggal lahir" nilai={tanggalPanjang(murid.tanggal_lahir)} />
              <Baris label="NIK" nilai={murid.no_nik} />
              <Baris label="Nomor kartu keluarga" nilai={murid.no_kk} />
              <Baris label="Alamat" nilai={murid.alamat} lebar />
            </dl>
          </div>
        </div>

        <div className="induk-foto">
          <span>Foto<br />3×4</span>
          {punyaFotoAsli(murid) && murid.foto_url && (
            <img
              src={murid.foto_url}
              alt=""
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
        </div>
      </div>

      <div className="induk-bagian">
        <h2 className="induk-bagian__judul">B · Keterangan Orang Tua / Wali</h2>
        <dl className="induk-data">
          <Baris label="Nama ayah" nilai={murid.nama_ayah} />
          <Baris label="Pekerjaan ayah" nilai={murid.pekerjaan_ayah} />
          <Baris label="Nama ibu" nilai={murid.nama_ibu} />
          <Baris label="Pekerjaan ibu" nilai={murid.pekerjaan_ibu} />
          <Baris label="Nomor telepon" nilai={murid.no_hp_ortu} />
          {/* Alamat orang tua kosong berarti "sama dengan alamat murid", bukan
              "tidak diketahui" — sama seperti yang ditampilkan profil murid. */}
          <Baris label="Alamat orang tua" nilai={murid.alamat_ortu || murid.alamat} lebar />
        </dl>
      </div>

      <div className="induk-bagian">
        <h2 className="induk-bagian__judul">C · Keterangan Pendidikan</h2>
        <dl className="induk-data">
          <Baris label="Terdaftar sejak" nilai={tanggalPanjang(murid.tanggal_pendaftaran)} />
          <Baris label="Angkatan" nilai={murid.angkatan} />
          <Baris label="Kelas saat ini" nilai={kelas} />
          <Baris label="Status" nilai={murid.status} />
        </dl>
      </div>

      <div className="induk-bagian">
        <h2 className="induk-bagian__judul">D · Riwayat Kelas</h2>
        <table className="induk-tabel">
          <thead>
            <tr>
              <th style={{ width: '24mm' }}>Tanggal</th>
              <th>Dari</th>
              <th>Ke</th>
              <th>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {riwayat.length === 0 && (
              <tr>
                <td colSpan={4} className="induk-tabel__kosong">
                  Belum ada perpindahan kelas yang tercatat.
                </td>
              </tr>
            )}
            {riwayat.map((m) => (
              <tr key={m.id}>
                <td>{tanggalPendek(m.mutation_date)}</td>
                <td>{m.from_class?.nama_kelas || 'Luar kelas'}</td>
                <td>{m.to_class?.nama_kelas || 'Luar kelas'}</td>
                <td>{m.reason || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="induk-bagian">
        <h2 className="induk-bagian__judul">E · Kelengkapan Berkas</h2>
        <dl className="induk-data">
          {berkas.map(([nama, ada]) => (
            <Baris key={nama} label={nama} nilai={ada ? 'Sudah diterima' : 'Belum diterima'} />
          ))}
        </dl>
      </div>

      <div className="induk-bagian">
        <h2 className="induk-bagian__judul">F · Keterangan Keluar / Tamat</h2>
        {/* Sengaja garis kosong. Ketiganya diisi dengan pena bertahun-tahun
            setelah lembar ini dicetak. */}
        <dl className="induk-data induk-data--satu-kolom">
          <div className="induk-baris induk-baris--lebar">
            <dt>Tanggal keluar</dt>
            <dd className="induk-isian" style={{ flex: 1 }} />
          </div>
          <div className="induk-baris induk-baris--lebar">
            <dt>Alasan / pindah ke</dt>
            <dd className="induk-isian" style={{ flex: 1 }} />
          </div>
          <div className="induk-baris induk-baris--lebar">
            <dt>Nomor surat</dt>
            <dd className="induk-isian" style={{ flex: 1 }} />
          </div>
        </dl>
      </div>

      <div className="induk-ttd">
        <div className="induk-ttd__kotak">
          <p style={{ margin: 0 }}>
            {sekolah.city || ''}
            {sekolah.city ? ', ' : ''}
            {tanggalPanjang(new Date().toISOString())}
          </p>
          <p className="induk-ttd__jabatan" style={{ margin: 0 }}>Kepala Sekolah</p>
          <div className="induk-ttd__ruang" />
          <p className="induk-ttd__nama" style={{ margin: 0 }}>{kepalaSekolah || '.'}</p>
        </div>
      </div>
    </div>
  );
};

const BukuIndukCetak = ({ open, onOpenChange, classId, namaKelas, daftarMurid }) => {
  const sekolah = useSchoolIdentity();
  const akarCetak = useAkarInduk(open);

  const [murid, setMurid] = useState([]);
  const [riwayatPerMurid, setRiwayatPerMurid] = useState({});
  const [kepalaSekolah, setKepalaSekolah] = useState('');
  const [petaKelas, setPetaKelas] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const muat = useCallback(async () => {
    if (!open) return;
    setIsLoading(true);
    setError(null);
    try {
      const [baris, daftarGuru, daftarKelas] = await Promise.all([
        Array.isArray(daftarMurid) && daftarMurid.length > 0
          ? Promise.resolve(daftarMurid)
          : (classId
            ? fetchSantriList({ classId, activeOnly: true, notDeleted: true, order: 'nama', limit: 200 })
            : Promise.resolve([])),
        fetchGuruList().catch(() => []),
        fetchClassList({ limit: 200 }).catch(() => []),
      ]);

      setPetaKelas(Object.fromEntries((daftarKelas || []).map((k) => [k.id, k.nama_kelas])));
      setKepalaSekolah(cariKepalaSekolah(daftarGuru)?.nama || '');
      setMurid(await resolveAvatarRecords(baris, { ownerType: 'santri' }));

      /* Riwayat kelas diambil per murid, dan kegagalannya TIDAK menjatuhkan
       * lembarnya: buku induk tanpa riwayat kelas masih dokumen yang berguna,
       * sedangkan menolak mencetak seluruhnya karena satu riwayat gagal dibaca
       * membuat tata usaha tidak bisa bekerja. Bagian D akan berbunyi "belum ada
       * perpindahan yang tercatat" — dan itu yang memang terlihat. */
      const pasangan = await Promise.all((baris || []).map(async (m) => [
        m.id,
        await fetchSantriClassMutations(m.id).catch(() => []),
      ]));
      setRiwayatPerMurid(Object.fromEntries(pasangan));
    } catch (err) {
      setError(err?.message || 'Data murid gagal dimuat.');
      setMurid([]);
    } finally {
      setIsLoading(false);
    }
  }, [open, classId, daftarMurid]);

  useEffect(() => { muat(); }, [muat]);

  const lembar = useMemo(() => (
    <>
      {murid.map((m) => (
        <LembarBukuInduk
          key={m.id}
          murid={m}
          sekolah={sekolah}
          kepalaSekolah={kepalaSekolah}
          namaKelasDari={(id) => petaKelas[id]}
          riwayat={riwayatPerMurid[m.id] || []}
        />
      ))}
    </>
  ), [murid, sekolah, kepalaSekolah, petaKelas, riwayatPerMurid]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="border-b p-5 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <BookMarked className="h-5 w-5" /> Buku Induk{namaKelas ? ` — ${namaKelas}` : ''}
          </DialogTitle>
          <DialogDescription>
            Satu murid satu halaman A4. Bagian Keterangan Keluar sengaja dibiarkan bergaris kosong —
            bagian itu diisi dengan pena saat murid benar-benar keluar atau tamat.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3">
          <Button type="button" variant="outline" size="sm" onClick={muat} disabled={isLoading}>
            <RefreshCw className="mr-2 h-4 w-4" /> Muat ulang
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => window.print()}
            disabled={isLoading || murid.length === 0}
          >
            <Printer className="mr-2 h-4 w-4" /> Cetak {murid.length > 0 ? `${murid.length} halaman` : ''}
          </Button>
        </div>

        <div className="max-h-[58vh] overflow-y-auto px-5 py-3">
          {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Menyusun buku induk…</p>}

          {!isLoading && error && (
            <div className="admin-error-state" role="alert">
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {!isLoading && !error && murid.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Tidak ada murid untuk dicetak.
            </p>
          )}

          {!isLoading && murid.length > 0 && (
            <div className="induk-pratinjau rounded-lg">{lembar}</div>
          )}
        </div>

        {akarCetak && !isLoading && murid.length > 0
          ? createPortal(<div className="induk-pratinjau">{lembar}</div>, akarCetak)
          : null}
      </DialogContent>
    </Dialog>
  );
};

export default BukuIndukCetak;
