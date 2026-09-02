import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import useSchoolIdentity from '@/hooks/useSchoolIdentity';
import { fetchGuruList } from '@/lib/dataMasterAdapters';
import { cariKepalaSekolah } from '@/lib/raporAdapters';
import { APP_CONFIG_KEYS, fetchAppConfig } from '@/lib/appConfigAdapters';
import '@/styles/surat-cetak.css';

/**
 * Surat keterangan sekolah yang bisa dicetak.
 *
 * Badan suratnya disusun dari jenis surat, bukan diketik ulang petugas: kalimat
 * pembuka dan penutup surat keterangan sekolah baku, dan yang berubah hanya
 * identitas murid serta keperluannya. Petugas tetap bisa menambahkan kalimat
 * sendiri lewat kolom keterangan, yang muncul sebagai paragraf tambahan.
 */

const AKAR_CETAK_ID = 'surat-cetak-root';

const tanggalPanjang = (iso) => {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

const useAkarSurat = (aktif) => {
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

const Baris = ({ label, nilai }) => (
  <div className="surat-identitas__baris">
    <span className="surat-identitas__label">{label}</span>
    <span className="surat-identitas__nilai">: {nilai || '-'}</span>
  </div>
);

/* Kalimat pembuka dan penutup per jenis surat.
 *
 * Ditulis di sini, bukan disimpan di basis data, karena isinya kalimat baku
 * surat keterangan sekolah — bukan data sekolah. Yang memang milik sekolah
 * (nama, alamat, kepala sekolah, nomor) semuanya datang dari luar komponen ini.
 */
const badanSurat = (surat, sekolah) => {
  const data = surat.data || {};
  const keperluan = String(data.keperluan || '').trim();
  const sekolahTujuan = String(data.sekolah_tujuan || surat.penerima || '').trim();
  const alasan = String(data.alasan_keluar || '').trim();

  switch (surat.jenis) {
    case 'pindah':
      return {
        pembuka: `Yang bertanda tangan di bawah ini Kepala ${sekolah.name} menerangkan dengan sesungguhnya bahwa:`,
        penutup: [
          `Murid tersebut benar terdaftar sebagai murid ${sekolah.name} dan sejak tanggal ${tanggalPanjang(data.tanggal_keluar || surat.tanggal_surat)} pindah${sekolahTujuan ? ` ke ${sekolahTujuan}` : ''}${alasan && alasan.toLowerCase() !== 'pindah' ? ` dengan alasan ${alasan.toLowerCase()}` : ''}.`,
          'Selama menjadi murid di sekolah kami, yang bersangkutan tidak memiliki tanggungan apa pun terhadap sekolah.',
          'Demikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.',
        ],
      };
    case 'tidak_mampu':
      return {
        pembuka: `Yang bertanda tangan di bawah ini Kepala ${sekolah.name} menerangkan dengan sesungguhnya bahwa:`,
        penutup: [
          `Menurut sepengetahuan kami, murid tersebut berasal dari keluarga yang kurang mampu secara ekonomi${keperluan ? ` dan surat ini diperlukan untuk ${keperluan}` : ''}.`,
          /* Disebutkan terang-terangan di dalam suratnya sendiri. Surat
             keterangan tidak mampu yang berkekuatan administratif diterbitkan
             kelurahan/desa; yang bisa diterangkan sekolah hanya apa yang
             diketahuinya. Menyamarkan itu membuat sekolah menerbitkan surat yang
             melampaui kewenangannya. */
          'Keterangan ini diberikan berdasarkan keadaan yang diketahui pihak sekolah dan bukan pengganti Surat Keterangan Tidak Mampu dari kelurahan/desa.',
          'Demikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.',
        ],
      };
    case 'keterangan_aktif':
      return {
        pembuka: `Yang bertanda tangan di bawah ini Kepala ${sekolah.name} menerangkan dengan sesungguhnya bahwa:`,
        penutup: [
          `Murid tersebut benar-benar terdaftar dan masih aktif sebagai murid ${sekolah.name} pada tahun ajaran ${sekolah.academicYear}${keperluan ? `, dan surat keterangan ini diperlukan untuk ${keperluan}` : ''}.`,
          'Demikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.',
        ],
      };
    default:
      return {
        pembuka: `Yang bertanda tangan di bawah ini Kepala ${sekolah.name} menerangkan bahwa:`,
        penutup: ['Demikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.'],
      };
  }
};

export const LembarSurat = ({ surat, sekolah, kepalaSekolah, kopBaris = [] }) => {
  const { pembuka, penutup } = badanSurat(surat, sekolah);
  const tambahan = String(surat.isi || '').trim();

  return (
    <div className="surat-lembar">
      <div className="surat-kop">
        <div className="surat-kop__lambang">{sekolah.logoAbbr}</div>
        <div className="surat-kop__teks">
          {/* Baris di atas nama sekolah — "PEMERINTAH KABUPATEN …", "DINAS
              PENDIDIKAN DAN KEBUDAYAAN", kadang nama UPTD — sepenuhnya diisi
              sekolah lewat Pengaturan Surat, dan KOSONG secara bawaan.
              Menebaknya dari alamat sekolah akan mencetak nama pemerintah daerah
              yang salah pada surat resmi; lebih baik tidak ada daripada salah. */}
          {kopBaris.map((baris, i) => (
            <p key={i} className="surat-kop__pemerintah">{baris}</p>
          ))}
          <p className="surat-kop__nama">{sekolah.name.toUpperCase()}</p>
          <p className="surat-kop__alamat">
            {sekolah.address}
            {sekolah.phone ? ` · Telp. ${sekolah.phone}` : ''}
          </p>
        </div>
      </div>

      <div className="surat-judul">
        <p className="surat-judul__utama">{surat.perihal}</p>
        <p className="surat-judul__nomor">Nomor: {surat.nomor}</p>
      </div>

      <div className="surat-badan">
        <p>{pembuka}</p>

        {surat.santri_nama ? (
          <div className="surat-identitas">
            <Baris label="Nama" nilai={surat.santri_nama} />
            <Baris label="Nomor induk / NIS" nilai={surat.santri_nomor} />
            <Baris label="Kelas" nilai={surat.santri_kelas} />
          </div>
        ) : null}

        {penutup.map((kalimat, i) => <p key={i}>{kalimat}</p>)}

        {/* Keterangan tambahan petugas muncul SEBELUM kalimat penutup baku pada
            surat umum, dan sebagai paragraf akhir pada jenis lain — supaya
            "Demikian surat keterangan ini..." tetap menjadi kalimat terakhir. */}
        {tambahan ? <p>{tambahan}</p> : null}
      </div>

      <div className="surat-ttd">
        <div className="surat-ttd__kotak">
          <p style={{ margin: 0 }}>
            {sekolah.city ? `${sekolah.city}, ` : ''}{tanggalPanjang(surat.tanggal_surat)}
          </p>
          <p style={{ margin: 0 }}>Kepala {sekolah.name}</p>
          <div className="surat-ttd__ruang" />
          <p className="surat-ttd__nama" style={{ margin: 0 }}>{kepalaSekolah || '.'}</p>
        </div>
      </div>

      {/* Surat yang dibatalkan tetap bisa dibuka dan dicetak — kadang justru
          itu yang diminta saat memeriksa agenda — tetapi tidak boleh dikira
          masih berlaku. */}
      {surat.dibatalkan && (
        <div className="surat-batal">
          SURAT INI DIBATALKAN
          {surat.alasan_batal ? ` — ${surat.alasan_batal}` : ''}
        </div>
      )}
    </div>
  );
};

const SuratCetak = ({ surat, open, onOpenChange }) => {
  const sekolah = useSchoolIdentity();
  const akarCetak = useAkarSurat(open);
  const [kepalaSekolah, setKepalaSekolah] = useState('');
  const [kopBaris, setKopBaris] = useState([]);

  const muat = useCallback(async () => {
    if (!open) return;
    const [daftarGuru, konfigurasi] = await Promise.all([
      fetchGuruList().catch(() => []),
      fetchAppConfig(APP_CONFIG_KEYS.SURAT).catch(() => null),
    ]);
    setKepalaSekolah(cariKepalaSekolah(daftarGuru)?.nama || '');
    const baris = konfigurasi?.kop_baris;
    setKopBaris(Array.isArray(baris) ? baris.filter((b) => String(b || '').trim() !== '') : []);
  }, [open]);

  useEffect(() => { muat(); }, [muat]);

  const lembar = useMemo(() => (
    surat
      ? <LembarSurat surat={surat} sekolah={sekolah} kepalaSekolah={kepalaSekolah} kopBaris={kopBaris} />
      : null
  ), [surat, sekolah, kepalaSekolah, kopBaris]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="border-b p-5 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> {surat?.nomor || 'Surat'}
          </DialogTitle>
          <DialogDescription>
            Kepala surat, tanggal, dan nama kepala sekolah diambil dari data sekolah — tidak ditulis
            di dalam surat, jadi ikut berubah sendiri saat data sekolah diperbarui.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3">
          <Button type="button" size="sm" onClick={() => window.print()} disabled={!surat}>
            <Printer className="mr-2 h-4 w-4" /> Cetak
          </Button>
          {!kepalaSekolah && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Kepala sekolah belum ditandai di Data Guru, jadi baris tanda tangan tercetak kosong.
            </p>
          )}
        </div>

        <div className="max-h-[58vh] overflow-y-auto px-5 py-3">
          {lembar ? <div className="surat-pratinjau rounded-lg">{lembar}</div> : null}
        </div>

        {akarCetak && lembar
          ? createPortal(<div className="surat-pratinjau">{lembar}</div>, akarCetak)
          : null}
      </DialogContent>
    </Dialog>
  );
};

export default SuratCetak;
