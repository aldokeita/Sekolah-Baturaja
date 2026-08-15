import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import PpdbBody from '@/components/sdnb/generated/PpdbBody';
import useSchoolIdentity from '@/hooks/useSchoolIdentity';
import { kirimPendaftaran } from '@/lib/ppdbAdapters';
import { DEFAULT_PPDB_CONTENT, fetchPpdbContent, isiPenanda } from '@/lib/ppdbContent';
import { tahunAjaranAwal } from '@/lib/schoolIdentity';
import '@/styles/sdnb.css';
import '@/styles/cetak-bukti.css';

/**
 * Formulir PPDB — markup generated verbatim from `Formulir PPDB.dc.html` by
 * tools/dc-convert.mjs. Standalone full-screen page: the mockup has no shared
 * nav or footer, so it renders outside PublicLayout.
 *
 * Reproduces the mockup's logic class: the four-step wizard, gender/jalur/minat
 * pickers, the document checklist, the review table, the agreement checkbox,
 * and the 1.5s localStorage draft autosave under the same key.
 *
 * Penyambungan backend: POST /api/ppdb, tersimpan sebagai baris tersendiri di
 * `pendaftaran_ppdb` dan dikelola tata usaha di panel Pendaftaran PPDB.
 *
 * Sebelumnya seluruh isian diratakan menjadi satu paragraf lalu dikirim ke
 * endpoint pesan pengunjung. Tiga akibatnya diperbaiki di sini:
 *
 *   1. Pengiriman tidak ditunggu (`kirim()` tanpa await) dan galatnya ditelan
 *      diam-diam, jadi layar "terkirim" muncul walau tidak ada data yang masuk.
 *   2. Tidak ada satu pun pemeriksaan isian — formulir kosong pun bisa dikirim.
 *   3. Nomor pendaftaran yang ditunjukkan dikarang di markup dan sama untuk
 *      semua orang.
 */

const DRAFT_KEY = 'snb-ppdb-draft-v1';
const FIELD_KEYS = ['nama', 'nisn', 'nik', 'tempat', 'lahir', 'alamat', 'hp', 'email', 'sekolah', 'npsn', 'nilai', 'ayah', 'ibu', 'kerja', 'hpwali'];
const EMPTY = Object.fromEntries(FIELD_KEYS.map((k) => [k, '']));

const STEP_DEFS = [
  [1, 'Data diri', 'Identitas siswa'],
  [2, 'Asal TK', 'Jalur pendaftaran'],
  [3, 'Berkas', 'Orang tua & dokumen'],
  [4, 'Tinjau', 'Kirim pendaftaran'],
];

/* Jalur pendaftaran, program pendukung, dan daftar berkas TIDAK lagi di sini.
 *
 * Ketiganya ketentuan yang berbeda di tiap sekolah — dan salah satu program
 * pendukung bawaannya dulu "Tahfiz", yang tidak berlaku untuk sekolah umum. Kini
 * disunting pembeli di Konten → Informasi Pendaftaran; lihat
 * src/lib/ppdbContent.js. Tahun ajarannya dari panel Identitas Sekolah. */

const chipStyle = (on) => 'position:relative;overflow:hidden;padding:12px 20px;border-radius:14px;cursor:pointer;font-family:inherit;font-size:13.5px;font-weight:700;transition:all .2s ease;border:1px solid '
  + (on ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.9)') + ';color:' + (on ? '#fff' : '#3f4468') + ';background:'
  + (on ? 'linear-gradient(135deg,var(--sekolah-aksen),var(--sekolah-aksen-tengah-2))' : 'rgba(255,255,255,.62)') + ';box-shadow:'
  + (on ? '0 14px 30px -14px rgba(95,105,235,.9),inset 0 1px 0 rgba(255,255,255,.5)' : 'inset 0 1px 0 rgba(255,255,255,.95)');

const PpdbPage = () => {
  const sekolah = useSchoolIdentity();
  // Bawaan dipakai lebih dulu supaya formulir tidak kosong selagi menunggu server.
  const [ppdb, setPpdb] = useState(DEFAULT_PPDB_CONTENT);
  const [step, setStep] = useState(1);
  const [gender, setGender] = useState('');
  const [jalur, setJalur] = useState('domisili');
  const [wilayah, setWilayah] = useState('');
  const [minat, setMinat] = useState('');
  const [files, setFiles] = useState({});
  const [setuju, setSetuju] = useState(false);
  const [done, setDone] = useState(false);
  const [restored, setRestored] = useState(false);
  const [mengirim, setMengirim] = useState(false);
  const [pesanGalat, setPesanGalat] = useState('');
  // Diisi server setelah pendaftaran tersimpan; ditunjukkan di layar terakhir.
  const [hasil, setHasil] = useState(null);

  // Uncontrolled inputs write straight into this object, exactly like the
  // mockup's `this.data` — no re-render while typing.
  const data = useRef({ ...EMPTY });
  const handlers = useRef(null);
  if (!handlers.current) {
    handlers.current = Object.fromEntries(FIELD_KEYS.map((k) => [k, (e) => { data.current[k] = e.target.value; }]));
  }

  useEffect(() => {
    let aktif = true;
    fetchPpdbContent()
      .then((tersimpan) => { if (aktif && tersimpan) setPpdb(tersimpan); })
      .catch(() => { /* bawaan tetap tampil */ });
    return () => { aktif = false; };
  }, []);

  // restore draft
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.data) data.current = { ...EMPTY, ...saved.data };
        if (saved?.state) {
          setStep(saved.state.step ?? 1);
          setGender(saved.state.gender ?? '');
          setJalur(saved.state.jalur ?? 'domisili');
          setWilayah(saved.state.wilayah ?? '');
          setMinat(saved.state.minat ?? '');
          setFiles(saved.state.files ?? {});
          setSetuju(!!saved.state.setuju);
          // `hasil` ikut disimpan supaya nomor pendaftaran tidak hilang bila orang
          // tua menutup lalu membuka lagi halaman konfirmasinya. Tanpa itu, layar
          // "terkirim" kembali muncul tanpa nomor apa pun.
          setHasil(saved.state.hasil ?? null);
          setDone(!!saved.state.done && !!saved.state.hasil);
        }
      }
    } catch { /* ignore unreadable drafts */ }
    setRestored(true);
  }, []);

  // autosave every 1.5s + on unload (verbatim cadence)
  useEffect(() => {
    if (!restored) return undefined;
    const save = () => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
          data: data.current,
          state: { step, gender, jalur, wilayah, minat, files, setuju, done, hasil },
        }));
      } catch { /* storage may be unavailable */ }
    };
    const id = setInterval(save, 1500);
    window.addEventListener('beforeunload', save);
    return () => { clearInterval(id); window.removeEventListener('beforeunload', save); };
  }, [restored, step, gender, jalur, wilayah, minat, files, setuju, done, hasil]);

  const go = useCallback((n) => { setStep(n); window.scrollTo({ top: 0, behavior: 'smooth' }); }, []);

  // Pilihan jalur bisa menunjuk jalur yang sudah dimatikan sekolah: nilai awalnya
  // 'domisili' dipasang mati-matian di kode, dan draf yang tersimpan di perangkat
  // orang tua bisa berumur berhari-hari. Tanpa penyelarasan ini pendaftaran terkirim
  // membawa jalur yang tidak dibuka, dan langkah keduanya tampak tanpa pilihan
  // terpilih sama sekali.
  useEffect(() => {
    const aktif = ppdb.jalur.filter((j) => j.aktif !== false);
    if (aktif.length === 0) return;
    if (!aktif.some((j) => j.id === jalur)) setJalur(aktif[0].id);
  }, [ppdb.jalur, jalur]);

  const d = data.current;
  const v = (k) => (d[k] && String(d[k]).trim() ? d[k] : '—');
  const jalurAktif = ppdb.jalur.filter((j) => j.aktif !== false);
  const jalurLabel = jalurAktif.find((j) => j.id === jalur)?.name || '—';
  const pct = done ? 100 : Math.round(((step - 1) / 3) * 100);

  // Tahun ajaran dari panel Identitas. Sebelumnya "2026/2027" ditulis di enam
  // tempat pada halaman ini, jadi sekolah pembeli tetap membuka PPDB tahun 2026.
  const tahunAjaran = sekolah.academicYear;
  const tahunAwal = tahunAjaranAwal(tahunAjaran);

  /**
   * Mengirim pendaftaran, lalu berpindah ke layar terakhir HANYA bila server
   * menerimanya.
   *
   * Server memeriksa ulang seluruh isian dan pesan galatnya berbahasa Indonesia,
   * jadi ia ditampilkan apa adanya — tidak perlu menyalin aturan yang sama ke
   * browser dan mempertaruhkan keduanya berbeda. Pemeriksaan di browser hanya
   * mengurangi perjalanan bolak-balik untuk kesalahan yang paling sering; lihat
   * `kurang` di bawah.
   */
  const kirim = async () => {
    setMengirim(true);
    setPesanGalat('');
    try {
      const hasilKirim = await kirimPendaftaran({
        tahun_ajaran: tahunAjaran,
        nama_lengkap: d.nama || '',
        nisn: d.nisn || '',
        nik: d.nik || '',
        tempat_lahir: d.tempat || '',
        tanggal_lahir: d.lahir || '',
        jenis_kelamin: gender,
        alamat: d.alamat || '',
        no_hp: d.hp || '',
        email: d.email || '',
        sekolah_asal: d.sekolah || '',
        npsn_asal: d.npsn || '',
        usia_keterangan: d.nilai || '',
        jalur,
        jalur_label: jalurLabel === '—' ? '' : jalurLabel,
        wilayah,
        minat,
        nama_ayah: d.ayah || '',
        nama_ibu: d.ibu || '',
        pekerjaan_orang_tua: d.kerja || '',
        no_hp_wali: d.hpwali || '',
        berkas_siap: Object.fromEntries(Object.entries(files).filter(([, siap]) => siap)),
      });
      setHasil(hasilKirim);
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setPesanGalat(error.message || 'Gagal mengirim pendaftaran. Periksa sambungan lalu coba lagi.');
    } finally {
      setMengirim(false);
    }
  };

  /* Kolom wajib yang bisa diperiksa tanpa memanggil server. Isinya sengaja hanya
   * yang PASTI ditolak server — bukan salinan seluruh aturannya — supaya keduanya
   * tidak bisa berbeda pendapat. */
  const kurang = (() => {
    if (!String(d.nama || '').trim()) return 'Nama lengkap belum diisi.';
    if (!d.lahir) return 'Tanggal lahir belum diisi.';
    if (!gender) return 'Jenis kelamin belum dipilih.';
    if (!String(d.alamat || '').trim()) return 'Alamat tempat tinggal belum diisi.';
    if (!String(d.hp || '').trim()) return 'Nomor WhatsApp belum diisi.';
    if (!String(d.ayah || '').trim() && !String(d.ibu || '').trim()) return 'Nama ayah atau ibu belum diisi.';
    // Hanya wajib bila sekolah memakai daftar wilayah — sama seperti aturan server.
    if (ppdb.wilayah.length > 0 && !wilayah) return 'Wilayah tempat tinggal belum dipilih.';
    return '';
  })();

  const vals = {
    h: handlers.current,
    d: { ...EMPTY, ...d },

    // Identitas untuk markup PpdbBody, yang dulu menanam nama sekolah dan tahun.
    namaSekolah: sekolah.name,
    inisialLogo: sekolah.logoAbbr,
    tahunAjaran,
    tahunAwal,

    // Ketentuan dari panel Informasi Pendaftaran.
    labelGelombang: ppdb.waveLabel,
    pengantar: ppdb.intro,
    jadwal: ppdb.timeline,
    // `{tahun}` diganti di sini, bukan di panel: syarat usia jadi ikut berubah
    // saat tahun ajaran diperbarui tanpa perlu disunting ulang.
    syarat: ppdb.requirements.map((s) => isiPenanda(s, tahunAwal)),

    steps: STEP_DEFS.map(([n, label, hint]) => {
      const active = n === step && !done;
      const passed = n < step || done;
      return {
        num: passed ? '✓' : String(n), label, hint,
        go: () => { if (!done) go(n); },
        wrap: `display:flex;align-items:center;gap:11px;padding:8px 12px;border-radius:14px;cursor:pointer;transition:background .2s ease;background:${active ? 'rgba(255,255,255,.72)' : 'transparent'}`,
        dot: `flex:none;width:30px;height:30px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:${active || passed ? '#fff' : '#6b7093'};background:${active ? 'linear-gradient(135deg,var(--sekolah-aksen),var(--sekolah-aksen-tengah-2))' : passed ? 'linear-gradient(135deg,#7fd8c0,#6fc9e0)' : 'rgba(255,255,255,.72)'};box-shadow:inset 0 1px 0 rgba(255,255,255,.7)`,
        title: `font-size:13.5px;font-weight:700;letter-spacing:-.01em;color:${active ? '#1b1c2c' : '#4d5273'}`,
      };
    }),

    genders: [['L', 'Laki-laki'], ['P', 'Perempuan']].map(([k, label]) => ({
      label, style: chipStyle(gender === k), pick: () => setGender(k),
    })),

    // Hanya jalur yang dinyalakan sekolah yang boleh dipilih orang tua. Jalur mati
    // tetap tersimpan lengkap di Konten → Informasi Pendaftaran supaya bisa
    // dinyalakan kembali, tetapi menampilkannya di sini berarti menerima pendaftar
    // pada jalur yang tidak dibuka sekolah.
    jalur: jalurAktif.map(({ id: k, name: label, desc }) => {
      const on = jalur === k;
      return {
        label, desc,
        pick: () => setJalur(k),
        style: `position:relative;overflow:hidden;display:flex;gap:12px;align-items:flex-start;padding:15px 16px;border-radius:16px;cursor:pointer;transition:all .2s ease;border:1px solid ${on ? 'rgba(120,132,255,.55)' : 'rgba(255,255,255,.9)'};background:rgba(255,255,255,${on ? '.8' : '.55'});box-shadow:${on ? '0 16px 34px -18px rgba(95,105,235,.8),inset 0 1px 0 rgba(255,255,255,.95)' : 'inset 0 1px 0 rgba(255,255,255,.95)'}`,
        mark: `flex:none;margin-top:2px;width:18px;height:18px;border-radius:50%;border:2px solid ${on ? 'var(--sekolah-aksen)' : 'rgba(120,127,160,.4)'};background:${on ? 'radial-gradient(circle,var(--sekolah-aksen) 0 42%,transparent 44%)' : 'transparent'}`,
      };
    }),

    minat: ppdb.minat.map((label) => ({ label, style: chipStyle(minat === label), pick: () => setMinat(label) })),

    // Daftar kosong menyembunyikan kolomnya di PpdbBody.
    wilayahOpsi: ppdb.wilayah,
    wilayahNilai: wilayah,
    wilayahPilih: (e) => setWilayah(e.target.value),

    berkas: ppdb.berkas.map(({ id: k, name: label, hint: note }) => {
      const on = !!files[k];
      return {
        label,
        // Dulu berbunyi "Terunggah · kartu-keluarga.pdf" — nama berkas karangan
        // untuk unggahan yang tidak pernah terjadi.
        note: on ? 'Sudah disiapkan' : note,
        toggle: () => setFiles((s) => ({ ...s, [k]: !s[k] })),
        style: `position:relative;overflow:hidden;display:flex;gap:13px;align-items:center;padding:16px;border-radius:16px;cursor:pointer;transition:all .2s ease;border:1px dashed ${on ? 'rgba(110,200,180,.7)' : 'rgba(140,148,190,.45)'};background:rgba(255,255,255,${on ? '.72' : '.45'});box-shadow:inset 0 1px 0 rgba(255,255,255,.9)`,
        icon: `flex:none;width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;background:${on ? 'linear-gradient(140deg,#8ee6c4,#6fd0e8)' : 'linear-gradient(140deg,#b9c4ff,#8b9bff)'};box-shadow:inset 0 1px 0 rgba(255,255,255,.8)`,
      };
    }),

    review: [
      { k: 'Nama lengkap', v: v('nama') },
      { k: 'NISN', v: v('nisn') },
      { k: 'Tempat, tanggal lahir', v: `${v('tempat')}, ${v('lahir')}` },
      { k: 'Jenis kelamin', v: gender === 'L' ? 'Laki-laki' : gender === 'P' ? 'Perempuan' : '—' },
      { k: 'Nomor WhatsApp', v: v('hp') },
      { k: 'Asal TK atau RA', v: v('sekolah') },
      { k: `Usia per 1 Juli ${tahunAwal}`, v: v('nilai') },
      { k: 'Jalur pendaftaran', v: jalurLabel },
      ...(ppdb.wilayah.length > 0 ? [{ k: 'Wilayah tempat tinggal', v: wilayah || '—' }] : []),
      { k: 'Program pendukung', v: minat || '—' },
      // "dari 4" dulu ditulis tetap, padahal daftar berkas disunting pembeli dan
      // bisa berisi berapa pun barisnya. Dan yang dicentang adalah KESIAPAN berkas,
      // bukan berkas terunggah — halaman publik tidak menerima unggahan.
      { k: 'Berkas yang disiapkan', v: `${Object.keys(files).filter((k) => files[k]).length} dari ${ppdb.berkas.length}` },
    ],

    isStep1: step === 1 && !done,
    isStep2: step === 2 && !done,
    isStep3: step === 3 && !done,
    isStep4: step === 4 && !done,
    isDone: done,

    // Hasil dari server: nomor pendaftaran sungguhan, dan penanda bila pendaftaran
    // ini sudah pernah masuk (orang tua menekan kirim dua kali).
    nomorPendaftaran: hasil?.nomor_pendaftaran || '',
    sudahTerdaftar: !!hasil?.duplikat,
    pesanGalat,

    progressStyle: `height:100%;width:${pct}%;border-radius:99px;background:linear-gradient(90deg,var(--sekolah-aksen),var(--sekolah-aksen-tengah-2) 55%,#f090c0);transition:width .5s cubic-bezier(.3,.8,.3,1);box-shadow:0 0 12px rgba(120,132,255,.6)`,
    stepCounter: done ? '' : mengirim ? 'Mengirim pendaftaran…'
      : (step === 4 && !setuju) ? 'Centang pernyataan untuk mengirim'
        : (step === 4 && kurang) ? kurang
          : `Langkah ${step} dari 4`,
    nextLabel: step === 4 ? (mengirim ? 'Mengirim…' : 'Kirim pendaftaran') : 'Lanjut',
    // Tombol dimatikan juga selagi mengirim, supaya satu pendaftaran tidak dikirim
    // dua kali karena tombolnya ditekan berulang.
    nextStyle: `position:relative;overflow:hidden;display:inline-flex;align-items:center;gap:9px;padding:14px 24px;border-radius:15px;border:0;font-family:inherit;font-size:14px;font-weight:700;color:#fff;background:linear-gradient(135deg,var(--sekolah-aksen-pekat),var(--sekolah-aksen-tengah) 55%,var(--sekolah-aksen-ujung));box-shadow:0 20px 40px -16px rgba(90,100,235,.95),inset 0 1px 0 rgba(255,255,255,.6);transition:opacity .2s ease;cursor:${step === 4 && (!setuju || mengirim) ? 'not-allowed' : 'pointer'};opacity:${step === 4 && (!setuju || mengirim) ? '.42' : '1'}`,
    navStyle: `position:relative;margin-top:30px;padding-top:22px;border-top:1px solid rgba(255,255,255,.75);display:${done ? 'none' : 'flex'};align-items:center;gap:14px`,
    prevStyle: `position:relative;overflow:hidden;padding:14px 22px;border-radius:15px;cursor:pointer;font-family:inherit;font-size:14px;font-weight:700;color:#33375a;background:rgba(255,255,255,.62);border:1px solid rgba(255,255,255,.9);box-shadow:inset 0 1px 0 rgba(255,255,255,.95);opacity:${step === 1 ? '.4' : '1'};pointer-events:${step === 1 ? 'none' : 'auto'}`,

    prev: () => go(Math.max(1, step - 1)),
    // Layar "terkirim" hanya muncul setelah server menerimanya — lihat kirim().
    next: () => {
      if (step === 4) {
        if (!setuju || mengirim) return;
        if (kurang) { setPesanGalat(kurang); return; }
        kirim();
      } else go(step + 1);
    },

    toggleSetuju: () => setSetuju((s) => !s),
    setujuStyle: `display:flex;gap:12px;align-items:flex-start;margin-top:20px;padding:16px;border-radius:16px;cursor:pointer;border:1px solid rgba(255,255,255,.9);background:rgba(255,255,255,${setuju ? '.72' : '.5'})`,
    setujuBox: `flex:none;width:22px;height:22px;border-radius:7px;display:flex;align-items:center;justify-content:center;transition:all .2s ease;border:1px solid ${setuju ? 'transparent' : 'rgba(120,127,160,.4)'};background:${setuju ? 'linear-gradient(135deg,var(--sekolah-aksen),var(--sekolah-aksen-tengah-2))' : 'rgba(255,255,255,.7)'}`,

    reset: () => {
      data.current = { ...EMPTY };
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      setStep(1); setDone(false); setGender(''); setJalur('domisili'); setWilayah(''); setMinat(''); setFiles({}); setSetuju(false);
      setHasil(null); setPesanGalat('');
      document.querySelectorAll('input').forEach((el) => { if (el.type !== 'button') el.value = ''; });
    },
  };

  return (
    <div className="sdnb sdnb-ppdb">
      <Helmet>
        <title>{`Formulir SPMB — ${sekolah.name}`}</title>
        <meta name="description" content={`Formulir pendaftaran murid baru ${tahunAjaran} ${sekolah.name}.`} />
      </Helmet>
      {PpdbBody(vals)}
    </div>
  );
};

export default PpdbPage;
