import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
// lucide-react 0.292 belum punya ikon IdCard; Contact adalah kartu berfoto orang.
import { Contact as IdCard, Printer, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import useSchoolIdentity from '@/hooks/useSchoolIdentity';
import { fetchClassList, fetchGuruList, fetchSantriList } from '@/lib/dataMasterAdapters';
import { cariKepalaSekolah } from '@/lib/raporAdapters';
import { resolveAvatarRecords } from '@/lib/storageAdapters';
import { useAkarCetak } from '@/components/dashboard/shared/RaporCetak';
import '@/styles/kartu-pelajar-cetak.css';

/**
 * Kartu pelajar yang bisa dicetak — satu murid atau sekelas sekaligus.
 *
 * Aplikasi ini sudah lama menagih item pembayaran bernama "ID Card Murid"
 * sementara kartunya tidak bisa dicetak dari mana pun. Ini yang menutup jarak itu.
 *
 * Ukuran kartunya ID-1 (85,6 × 54 mm), sepuluh kartu per lembar A4, dengan garis
 * putus-putus panduan gunting yang sengaja ikut tercetak. Ukuran itu bukan selera:
 * kartunya harus masuk ke plastik gantungan dan dompet yang dijual di toko.
 *
 * Foto memakai foto profil murid yang sudah ada di sistem. Murid tanpa foto tetap
 * mendapat kartu, dengan kotak bertulis "Foto 2×3" untuk ditempel manual —
 * menahan kartunya karena fotonya belum ada justru menghambat sekolah.
 */

const AKAR_CETAK_ID = 'kartu-cetak-root';

const tanggalPendek = (iso) => {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** Wadah portal tersendiri, terpisah dari akar rapor. */
const useAkarKartu = (aktif) => {
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

/* Apakah murid ini benar-benar punya foto?
 *
 * `avatar_path` adalah satu-satunya kolom yang jujur: ia hanya terisi setelah
 * foto sungguhan diunggah. `foto_url` TIDAK bisa dipercaya di sini, karena dua
 * hal mengisinya tanpa ada berkasnya:
 *
 *   1. resolveAvatarUrl menyusun path dari id murid saat avatar_path kosong, dan
 *      penandatanganan tidak pernah memeriksa keberadaan berkas
 *   2. panel Data Murid sudah menjalankan itu untuk tabelnya, sehingga baris yang
 *      diteruskan ke sini SUDAH memuat tautan bertanda tangan
 *
 * Tautan luar (bukan /files/avatars/ milik kita) tetap diterima — sekolah yang
 * memindahkan datanya dari sistem lama bisa menyimpan foto di sana. */
const punyaFotoAsli = (m) => {
  if (m?.avatar_path) return true;
  const url = String(m?.foto_url || '').trim();
  return url !== '' && !url.includes('/files/avatars/');
};

const Baris = ({ label, nilai }) => (
  <div className="kartu__baris">
    <dt>{label}</dt>
    <dd>{nilai || '-'}</dd>
  </div>
);

export const Kartu = ({ murid, sekolah, kepalaSekolah, tahunAjaran, namaKelasDari }) => {
  /* Nama kelas punya tiga sumber, dan ketiganya perlu.
   *
   * Baris dari endpoint DETAIL murid membawa `class`/`class_nama`; baris dari
   * DAFTAR murid tidak — ia hanya membawa `current_class_id`. Panel Data Murid
   * memakai yang kedua, jadi tanpa pencarian lewat daftar kelas, kartu yang
   * dicetak dari sana selalu berbunyi "Kelas: -". */
  const kelas = murid.class?.nama_kelas
    || murid.class_nama
    || namaKelasDari?.(murid.current_class_id || murid.id_kelas)
    || '';
  const nomor = murid.nis || murid.nisn || murid.nomor_induk || '';

  return (
    <div className="kartu">
      <div className="kartu__kop">
        {/* Inisial, bukan gambar logo — sama seperti kepala surat rapor. Logo
            tersimpan hidup sebagai konten situs yang dimuat terpisah, dan sebuah
            gambar yang belum termuat saat perintah cetak diberikan akan tercetak
            sebagai kotak kosong. */}
        <div className="kartu__lambang">{sekolah.logoAbbr}</div>
        <div style={{ minWidth: 0 }}>
          <p className="kartu__nama-sekolah">{sekolah.name}</p>
          <p className="kartu__jenis">Kartu Pelajar</p>
        </div>
      </div>

      <div className="kartu__badan">
        <div className="kartu__foto">
          {/* Tulisannya selalu dirender, fotonya ditumpuk di atas. `punyaFoto`
              tidak boleh disimpulkan dari ada-tidaknya tautan foto: tautan
              bertanda tangan dibuat dari id murid dan selalu berhasil dibuat,
              bahkan untuk berkas yang tidak pernah ada. Yang menentukan adalah
              `avatar_path` — hanya terisi setelah foto sungguhan diunggah. */}
          <span>Foto<br />2×3</span>
          {murid.punyaFoto && murid.foto_url && (
            <img
              src={murid.foto_url}
              alt=""
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
        </div>
        <dl className="kartu__data">
          <p className="kartu__nama">{murid.nama_lengkap}</p>
          <Baris label={murid.nis ? 'NIS' : 'No. Induk'} nilai={nomor} />
          <Baris label="NISN" nilai={murid.nisn} />
          <Baris label="Kelas" nilai={kelas} />
          <Baris label="Lahir" nilai={tanggalPendek(murid.tanggal_lahir)} />
          <Baris label="Alamat" nilai={murid.alamat} />
        </dl>
      </div>

      <div className="kartu__kaki">
        <span>{tahunAjaran ? `Tahun ajaran ${tahunAjaran}` : sekolah.address}</span>
        <div className="kartu__ttd">
          <span>Kepala Sekolah</span>
          <div className="kartu__ttd-garis">{kepalaSekolah || ' '}</div>
        </div>
      </div>
    </div>
  );
};

const KartuPelajarCetak = ({
  open,
  onOpenChange,
  classId,
  namaKelas,
  daftarMurid,
}) => {
  const sekolah = useSchoolIdentity();
  const akarCetak = useAkarKartu(open);

  const [murid, setMurid] = useState([]);
  const [kepalaSekolah, setKepalaSekolah] = useState('');
  const [petaKelas, setPetaKelas] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /* Dua cara pemanggilan, satu komponen:
   *
   *   daftarMurid  — dipakai panel Data Murid, yang barisnya sudah dimuat
   *   classId      — dipakai Manajemen Kelas, yang hanya tahu kelasnya
   *
   * Yang pertama menang bila keduanya diberikan. */
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

      /* Foto profil disimpan di bucket privat, jadi tiap baris perlu tautan
       * bertanda tangan — tanpa itu kartunya tercetak tanpa foto tanpa sebab yang
       * terlihat.
       *
       * `punyaFoto` ditandai SEBELUM tautannya dibuat. resolveAvatarUrl menyusun
       * path dari id murid ketika `avatar_path` kosong, dan penandatanganan tidak
       * memeriksa keberadaan berkas — jadi setiap murid selalu mendapat tautan,
       * termasuk yang belum pernah mengunggah foto. Menyimpulkan "punya foto"
       * dari ada-tidaknya tautan membuat seluruh kartu memuat gambar rusak dan
       * membuat hitungan "belum punya foto" di bawah selalu nol. */
      const bertanda = (baris || []).map((m) => ({ ...m, punyaFoto: punyaFotoAsli(m) }));
      setMurid(await resolveAvatarRecords(bertanda, { ownerType: 'santri' }));
      setKepalaSekolah(cariKepalaSekolah(daftarGuru)?.nama || '');
    } catch (err) {
      setError(err?.message || 'Data murid gagal dimuat.');
      setMurid([]);
    } finally {
      setIsLoading(false);
    }
  }, [open, classId, daftarMurid]);

  useEffect(() => { muat(); }, [muat]);

  const tahunAjaran = sekolah.academicYear || '';

  const lembar = useMemo(() => (
    <div className="kartu-lembar">
      <div className="kartu-kisi">
        {murid.map((m) => (
          <Kartu
            key={m.id}
            murid={m}
            sekolah={sekolah}
            kepalaSekolah={kepalaSekolah}
            tahunAjaran={tahunAjaran}
            namaKelasDari={(id) => petaKelas[id]}
          />
        ))}
      </div>
    </div>
  ), [murid, sekolah, kepalaSekolah, tahunAjaran, petaKelas]);

  const tanpaFoto = murid.filter((m) => !m.punyaFoto).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="border-b p-5 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <IdCard className="h-5 w-5" /> Kartu Pelajar{namaKelas ? ` — ${namaKelas}` : ''}
          </DialogTitle>
          <DialogDescription>
            Ukuran kartu 85,6 × 54 mm, sepuluh kartu per lembar A4. Garis putus-putus adalah panduan
            gunting dan ikut tercetak. Cetak pada kertas tebal, lalu potong.
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
            <Printer className="mr-2 h-4 w-4" /> Cetak {murid.length > 0 ? `${murid.length} kartu` : ''}
          </Button>
          {/* Disebutkan terang-terangan. Kartu tanpa foto tetap tercetak, dan
              sekolah perlu tahu berapa banyak yang harus ditempel manual sebelum
              menekan cetak — bukan setelah kertasnya keluar. */}
          {!isLoading && tanpaFoto > 0 && (
            <p className="text-xs text-muted-foreground">
              {tanpaFoto} murid belum punya foto profil; kartunya menyisakan kotak untuk ditempel.
            </p>
          )}
        </div>

        <div className="max-h-[58vh] overflow-y-auto px-5 py-3">
          {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Menyusun kartu…</p>}

          {!isLoading && error && (
            <div className="admin-error-state" role="alert">
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {!isLoading && !error && murid.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Tidak ada murid aktif untuk dibuatkan kartu.
            </p>
          )}

          {!isLoading && murid.length > 0 && (
            <div className="kartu-pratinjau rounded-lg">{lembar}</div>
          )}
        </div>

        {akarCetak && !isLoading && murid.length > 0
          ? createPortal(<div className="kartu-pratinjau">{lembar}</div>, akarCetak)
          : null}
      </DialogContent>
    </Dialog>
  );
};

export default KartuPelajarCetak;
