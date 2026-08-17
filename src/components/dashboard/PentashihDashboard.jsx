import React, { useState, useEffect, useCallback, useMemo } from 'react';
import useSchoolIdentity from '@/hooks/useSchoolIdentity';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Users, Calendar, Phone, ShieldCheck,
  GraduationCap, AlertTriangle, BarChart3, FileSpreadsheet,
  Printer, Search, UserCheck, UserX,
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { resolveAvatarRecord, resolveAvatarRecords } from '@/lib/storageAdapters';
import { fetchAllSantri, fetchClassList, fetchGuruDetail } from '@/lib/dataMasterAdapters';
import {
  fetchAllAttendance,
  fetchCalendarContext,
  getLocalDateString,
  isExplicitAbsentAttendance,
} from '@/lib/attendanceAdapters';
import { getActiveCalendarDates } from '@/lib/calendarUtils';
import { isKepalaSekolah, labelStafRole } from '@/lib/staf';
import ClassManagement from '@/components/dashboard/admin/ClassManagement';
import * as XLSX from 'xlsx';

/**
 * Dashboard pengawasan untuk Wakil Kepala Sekolah — dan untuk Kepala Sekolah,
 * bila akunnya memegang sebutan itu (lihat isKepalaSekolah di src/lib/staf.js).
 *
 * Isi lamanya adalah panel mutu program Qur'an: distribusi jilid, pipeline calon
 * khotim, dan daftar murid yang lama belum naik jilid. Semua itu tidak berlaku di
 * sekolah dasar umum — seluruh murid SD tergolong "Jilid Dasar 100%" hanya karena
 * kolom jilid-nya kosong. Yang benar-benar diawasi seorang wakil kepala sekolah
 * adalah kehadiran, keterisian kelas, dan murid yang mulai sering absen.
 *
 * Peran ini BACA SAJA di sini. Menyunting kehadiran tetap milik admin lewat panel
 * Rekap Absensi; backend menjaganya dengan CanManage pada Update dan MarkAbsent.
 */

// Ambang kehadiran bulanan yang dianggap perlu perhatian. 75% kira-kira setara
// dengan absen sepekan penuh dalam sebulan — cukup jarang untuk bermakna, cukup
// sering untuk masih bisa ditolong sebelum jadi putus sekolah.
const AMBANG_KEHADIRAN = 75;

const persen = (bagian, total) => (total > 0 ? Math.round((bagian / total) * 100) : 0);

const nomorWa = (nomor) => String(nomor || '').replace(/\D/g, '').replace(/^0/, '62');

const PentashihDashboard = () => {
  const sekolah = useSchoolIdentity();
  const { user } = useAuth();
  const [guruData, setGuruData] = useState(null);
  const [santriList, setSantriList] = useState([]);
  const [classList, setClassList] = useState([]);
  const [hadirHariIni, setHadirHariIni] = useState(new Set());
  const [kehadiranBulanIni, setKehadiranBulanIni] = useState({});
  const [hariEfektif, setHariEfektif] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [cariKelas, setCariKelas] = useState('');
  const [cariMurid, setCariMurid] = useState('');

  const fetchDashboardData = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const hariIni = getLocalDateString();
      const awalBulan = `${hariIni.slice(0, 7)}-01`;

      const [guruProfile, classes, santri, absensiBulan, kalender] = await Promise.all([
        fetchGuruDetail(user.id),
        fetchClassList({ is_active: true, includeGuru: true, limit: 200 }),
        fetchAllSantri({ activeOnly: true, notDeleted: true }),
        // Satu permintaan untuk seluruh bulan berjalan; kehadiran hari ini
        // disaring dari hasil yang sama supaya tidak ada dua sumber angka yang
        // bisa berselisih.
        fetchAllAttendance({ role: 'santri', date_from: awalBulan, date_to: hariIni }),
        fetchCalendarContext(awalBulan, hariIni).catch(() => null),
      ]);

      const resolvedGuru = await resolveAvatarRecord(guruProfile, { ownerType: 'guru' });
      const resolvedSantri = await resolveAvatarRecords(santri || [], { ownerType: 'santri' });

      const classMap = Object.fromEntries((classes || []).map((c) => [c.id, c]));

      const mappedSantri = resolvedSantri.map((s) => {
        const classId = s.current_class_id || null;
        const cls = classId ? classMap[classId] : null;
        return {
          ...s,
          classId,
          className: cls?.nama_kelas || 'Belum masuk kelas',
          teacherName: cls?.guru?.nama || 'Belum ada wali kelas',
          teacherHp: cls?.guru?.no_hp || null,
        };
      });

      // Baris "tidak hadir" yang dicatat admin BUKAN kehadiran. Tanpa penyaringan
      // ini seorang murid yang ditandai alpa setiap hari akan terhitung hadir
      // penuh, karena barisnya tetap ada di tabel absensi.
      const hadirSaja = (absensiBulan || []).filter((row) => !isExplicitAbsentAttendance(row.status));

      const setHariIni = new Set(
        hadirSaja.filter((row) => row.attendance_date === hariIni).map((row) => row.user_id)
      );

      // Satu murid bisa punya lebih dari satu baris per hari (mis. dua sesi),
      // jadi yang dihitung adalah jumlah HARI berbeda, bukan jumlah baris.
      const hariPerMurid = {};
      hadirSaja.forEach((row) => {
        if (!hariPerMurid[row.user_id]) hariPerMurid[row.user_id] = new Set();
        hariPerMurid[row.user_id].add(row.attendance_date);
      });
      const rekap = Object.fromEntries(
        Object.entries(hariPerMurid).map(([id, hari]) => [id, hari.size])
      );

      // Penyebutnya adalah hari efektif menurut kalender akademik, bukan jumlah
      // hari kalender: akhir pekan dan libur nasional tidak boleh menurunkan
      // persentase kehadiran siapa pun (lihat migrasi libur nasional).
      const efektif = getActiveCalendarDates({
        startDate: awalBulan,
        endDate: hariIni,
        ...(kalender || { eventsByDate: {}, monthSettingsByYear: {} }),
      });

      setGuruData(resolvedGuru || null);
      setClassList(classes || []);
      setSantriList(mappedSantri);
      setHadirHariIni(setHariIni);
      setKehadiranBulanIni(rekap);
      setHariEfektif(Array.isArray(efektif) ? efektif.length : 0);
    } catch (error) {
      toast({ title: 'Gagal memuat data', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const kelasStats = useMemo(() => {
    const perKelas = (classList || []).map((cls) => {
      const murid = santriList.filter((s) => s.classId === cls.id);
      const hadir = murid.filter((s) => hadirHariIni.has(s.id)).length;
      return {
        id: cls.id,
        nama: cls.nama_kelas,
        sesi: cls.sesi || '-',
        wali: cls.guru?.nama || null,
        waliHp: cls.guru?.no_hp || null,
        jumlah: murid.length,
        hadir,
        persen: persen(hadir, murid.length),
      };
    });

    if (!cariKelas) return perKelas;
    const cari = cariKelas.toLowerCase();
    return perKelas.filter(
      (k) => k.nama.toLowerCase().includes(cari) || (k.wali || '').toLowerCase().includes(cari)
    );
  }, [classList, santriList, hadirHariIni, cariKelas]);

  const ringkasan = useMemo(() => {
    const total = santriList.length;
    const hadir = santriList.filter((s) => hadirHariIni.has(s.id)).length;
    const kelasTanpaWali = (classList || []).filter((c) => !c.guru?.nama).length;
    const belumMasukKelas = santriList.filter((s) => !s.classId).length;
    return { total, hadir, persenHadir: persen(hadir, total), kelasTanpaWali, belumMasukKelas };
  }, [santriList, hadirHariIni, classList]);

  const muridPerluPerhatian = useMemo(() => {
    // Tanpa hari efektif tidak ada penyebut yang sah, jadi daftarnya dikosongkan
    // ketimbang menampilkan 0% untuk semua orang di awal bulan.
    if (hariEfektif <= 0) return [];

    const daftar = santriList
      .map((s) => {
        const hadir = kehadiranBulanIni[s.id] || 0;
        return { ...s, hadirBulanIni: hadir, persenBulanIni: persen(hadir, hariEfektif) };
      })
      .filter((s) => s.persenBulanIni < AMBANG_KEHADIRAN)
      .sort((a, b) => a.persenBulanIni - b.persenBulanIni);

    if (!cariMurid) return daftar;
    const cari = cariMurid.toLowerCase();
    return daftar.filter(
      (s) =>
        s.nama_lengkap.toLowerCase().includes(cari) ||
        (s.nisn || '').toLowerCase().includes(cari) ||
        s.className.toLowerCase().includes(cari)
    );
  }, [santriList, kehadiranBulanIni, hariEfektif, cariMurid]);

  const exportExcelReport = () => {
    try {
      const ringkasanData = [
        { Indikator: 'Total murid aktif', Nilai: ringkasan.total },
        { Indikator: 'Hadir hari ini', Nilai: `${ringkasan.hadir} (${ringkasan.persenHadir}%)` },
        { Indikator: 'Hari efektif bulan berjalan', Nilai: hariEfektif },
        { Indikator: `Murid di bawah ${AMBANG_KEHADIRAN}% kehadiran`, Nilai: muridPerluPerhatian.length },
        { Indikator: 'Kelas tanpa wali kelas', Nilai: ringkasan.kelasTanpaWali },
        { Indikator: 'Murid belum masuk kelas', Nilai: ringkasan.belumMasukKelas },
      ];

      const kelasData = kelasStats.map((k, idx) => ({
        No: idx + 1,
        Kelas: k.nama,
        Sesi: k.sesi,
        'Wali Kelas': k.wali || 'Belum ada',
        'Jumlah Murid': k.jumlah,
        'Hadir Hari Ini': k.hadir,
        Persentase: `${k.persen}%`,
      }));

      const perhatianData = muridPerluPerhatian.map((s, idx) => ({
        No: idx + 1,
        NISN: s.nisn || '-',
        'Nama Murid': s.nama_lengkap,
        Kelas: s.className,
        'Wali Kelas': s.teacherName,
        'Hari Hadir': s.hadirBulanIni,
        'Hari Efektif': hariEfektif,
        Persentase: `${s.persenBulanIni}%`,
        'No HP Wali': s.no_hp_ortu || '-',
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ringkasanData), 'Ringkasan');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kelasData), 'Kehadiran per Kelas');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(perhatianData), 'Murid Perlu Perhatian');

      const dateStr = new Date().toLocaleDateString('id-ID').replace(/\//g, '-');
      XLSX.writeFile(wb, `Laporan_Pengawasan_Sekolah_${dateStr}.xlsx`);

      toast({ title: 'Berhasil Ekspor Excel', description: 'File laporan berhasil diunduh.' });
    } catch (err) {
      toast({ title: 'Gagal Ekspor', description: err.message, variant: 'destructive' });
    }
  };

  const printPdfReport = () => {
    window.print();
  };

  const sebutan = guruData && isKepalaSekolah(guruData)
    ? 'Kepala Sekolah'
    : labelStafRole(guruData?.jabatan || 'Wakil Kepala Sekolah');

  return (
    <>
      {/* Isi dashboard ini sudah lama disiapkan untuk dicetak — tombolnya
          `print:hidden`, judulnya `print:text-black` — tapi tidak ada satu pun
          aturan yang menyingkirkan CANGKANG di luarnya, jadi "Cetak PDF" ikut
          mengeluarkan bilah navigasi dan menu samping.

          Aturan penyapunya dipagari `:has()` seperti empat aturan cetak lain di
          aplikasi ini; lihat tabelnya di docs/HANDOFF.md. Pengecualiannya ikut
          dipagari karena `:has()` mewarisi bobot argumennya — pengecualian polos
          akan kalah dari penyapunya sendiri. */}
      <style>{`@media print {
        body:has(#pengawasan-cetak) * { visibility: hidden !important; }
        body:has(#pengawasan-cetak) #pengawasan-cetak,
        body:has(#pengawasan-cetak) #pengawasan-cetak * { visibility: visible !important; }
        #pengawasan-cetak { position: absolute; left: 0; top: 0; width: 100%; }
      }`}</style>
    <div id="pengawasan-cetak" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-32 pb-16 bg-slate-50 dark:bg-slate-950 min-h-screen space-y-8 print:pt-4 print:pb-4 print:bg-white print:dark:bg-white print:text-black">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6 print:border-b-2">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl md:text-4xl font-black uppercase text-purple-700 dark:text-purple-400 tracking-wide print:text-black">
              Dashboard {sebutan}
            </h1>
            <Badge className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-1 text-xs uppercase tracking-wider flex items-center gap-1 shadow-sm print:hidden">
              <ShieldCheck className="w-3.5 h-3.5" /> Pengawasan Sekolah
            </Badge>
          </div>
          <p className="text-muted-foreground print:text-slate-600">
            Pantau kehadiran, keterisian kelas, dan murid yang perlu perhatian di {sekolah.shortName}.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={printPdfReport}
            className="bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:bg-slate-100 font-semibold flex items-center gap-1.5 shadow-sm"
          >
            <Printer className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            Cetak PDF
          </Button>

          <Button
            size="sm"
            onClick={exportExcelReport}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-md"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Ekspor Excel
          </Button>

          <div className="px-3.5 py-1.5 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 print:grid-cols-4 print:gap-3">
        <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4 print:col-span-4 print:grid-cols-4">
          <Card className="bg-white dark:bg-slate-900 border-l-4 border-purple-500 shadow-sm print:border print:shadow-none">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-3 bg-purple-100 dark:bg-purple-950/50 rounded-xl shrink-0 print:hidden">
                <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100 print:text-black">{ringkasan.total}</p>
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider print:text-slate-600">Total Murid Aktif</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border-l-4 border-emerald-500 shadow-sm print:border print:shadow-none">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-950/50 rounded-xl shrink-0 print:hidden">
                <UserCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 print:text-emerald-800">
                  {ringkasan.hadir}<span className="text-sm font-bold opacity-70"> / {ringkasan.total}</span>
                </p>
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider print:text-slate-600">
                  Hadir Hari Ini ({ringkasan.persenHadir}%)
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border-l-4 border-rose-500 shadow-sm print:border print:shadow-none">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-3 bg-rose-100 dark:bg-rose-950/50 rounded-xl shrink-0 print:hidden">
                <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <p className="text-2xl font-black text-rose-600 dark:text-rose-400 print:text-rose-800">{muridPerluPerhatian.length}</p>
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider print:text-slate-600">Murid Perlu Perhatian</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-4 print:hidden">
          {guruData ? (
            <Card className="bg-gradient-to-br from-purple-700 via-indigo-700 to-blue-800 text-white h-full shadow-lg relative overflow-hidden border-0 rounded-2xl">
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <ShieldCheck className="w-32 h-32 text-white" />
              </div>
              <CardContent className="p-4 flex flex-col justify-center h-full relative z-10">
                <div className="flex items-center gap-3 mb-2">
                  <Avatar className="w-12 h-12 border-2 border-white/40 shadow-md">
                    <AvatarImage src={guruData.foto_url} className="object-cover" />
                    <AvatarFallback className="text-purple-700 font-bold text-lg bg-white">
                      {guruData.nama?.charAt(0) || 'P'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-bold leading-tight truncate">{guruData.nama}</h2>
                    <span className="inline-flex items-center gap-1 text-purple-100 text-[11px] font-semibold bg-white/20 px-2 py-0.5 rounded-full mt-0.5">
                      <ShieldCheck className="w-3 h-3" /> {sebutan}
                    </span>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-white/15 text-[11px] text-purple-100 flex items-center justify-between">
                  <span>RFID: <strong className="font-mono text-white">{guruData.rfid_tag || '-'}</strong></span>
                  {guruData.no_hp && (
                    <span className="flex items-center gap-1 opacity-90">
                      <Phone className="w-3 h-3" /> {guruData.no_hp}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="h-full bg-slate-200 dark:bg-slate-800 animate-pulse rounded-2xl min-h-[90px]" />
          )}
        </div>
      </div>

      {/* Dua tanda keterisian yang paling sering luput: kelas tanpa wali kelas dan
          murid yang belum ditempatkan. Keduanya hanya tampil ketika benar-benar
          ada, supaya sekolah yang rapi tidak dihadiahi kotak peringatan kosong. */}
      {(ringkasan.kelasTanpaWali > 0 || ringkasan.belumMasukKelas > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ringkasan.kelasTanpaWali > 0 && (
            <Card className="border-l-4 border-amber-500 bg-amber-50/60 dark:bg-amber-950/20">
              <CardContent className="p-4 flex items-center gap-3">
                <UserX className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-sm text-amber-900 dark:text-amber-200">
                  <strong>{ringkasan.kelasTanpaWali} kelas</strong> belum punya wali kelas. Penugasannya diatur admin di Manajemen Kelas.
                </p>
              </CardContent>
            </Card>
          )}
          {ringkasan.belumMasukKelas > 0 && (
            <Card className="border-l-4 border-amber-500 bg-amber-50/60 dark:bg-amber-950/20">
              <CardContent className="p-4 flex items-center gap-3">
                <UserX className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-sm text-amber-900 dark:text-amber-200">
                  <strong>{ringkasan.belumMasukKelas} murid</strong> belum ditempatkan ke kelas mana pun.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-1">
        {/* Kehadiran per kelas hari ini */}
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden flex flex-col print:border-slate-300">
          <CardContent className="p-5 flex-1 flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 dark:bg-purple-950/50 rounded-lg text-purple-700 dark:text-purple-400 print:hidden">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 print:text-black">Kehadiran per Kelas Hari Ini</h3>
                  <p className="text-xs text-muted-foreground">Perbandingan murid yang sudah tercatat hadir terhadap jumlah muridnya.</p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs font-semibold text-purple-700 border-purple-200 dark:text-purple-300 w-fit print:border-slate-400 print:text-black">
                {classList.length} Kelas
              </Badge>
            </div>

            <div className="relative print:hidden">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari kelas atau wali kelas..."
                value={cariKelas}
                onChange={(e) => setCariKelas(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex-1 overflow-x-auto max-h-80 overflow-y-auto custom-scrollbar">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b text-muted-foreground bg-slate-50 dark:bg-slate-800/50">
                    <th className="py-2.5 px-3 font-semibold">Kelas</th>
                    <th className="py-2.5 px-3 font-semibold">Wali Kelas</th>
                    <th className="py-2.5 px-3 font-semibold">Hadir</th>
                    <th className="py-2.5 px-3 font-semibold w-28">Persentase</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {kelasStats.map((k) => (
                    <tr key={k.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{k.nama}</p>
                        <p className="text-[10px] text-muted-foreground">Sesi {k.sesi}</p>
                      </td>
                      <td className="py-2.5 px-3">
                        {k.wali ? (
                          <span className="text-slate-800 dark:text-slate-200">{k.wali}</span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">Belum ada</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-800 dark:text-slate-200">
                        {k.hadir} / {k.jumlah}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${k.persen >= AMBANG_KEHADIRAN ? 'bg-emerald-500' : 'bg-rose-500'}`}
                              style={{ width: `${k.persen}%` }}
                            />
                          </div>
                          <span className="font-bold tabular-nums text-slate-700 dark:text-slate-300">{k.persen}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {kelasStats.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-muted-foreground">
                        {isLoading ? 'Memuat data kelas…' : 'Belum ada kelas yang cocok dengan pencarian.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Murid dengan kehadiran rendah bulan berjalan */}
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden flex flex-col print:border-slate-300">
          <CardContent className="p-5 flex-1 flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-100 dark:bg-rose-950/50 rounded-lg text-rose-600 dark:text-rose-400 print:hidden">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 print:text-black">Murid Perlu Perhatian</h3>
                  <p className="text-xs text-muted-foreground">
                    Kehadiran di bawah {AMBANG_KEHADIRAN}% dari {hariEfektif} hari efektif bulan ini.
                  </p>
                </div>
              </div>
              <Badge variant="destructive" className="font-bold text-xs w-fit">
                {muridPerluPerhatian.length} Murid
              </Badge>
            </div>

            <div className="relative print:hidden">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari murid atau kelas..."
                value={cariMurid}
                onChange={(e) => setCariMurid(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex-1 overflow-x-auto max-h-80 overflow-y-auto custom-scrollbar">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b text-muted-foreground bg-slate-50 dark:bg-slate-800/50">
                    <th className="py-2.5 px-3 font-semibold">Murid</th>
                    <th className="py-2.5 px-3 font-semibold">Kehadiran</th>
                    <th className="py-2.5 px-3 font-semibold">Wali Kelas</th>
                    <th className="py-2.5 px-3 font-semibold text-right print:hidden">Kontak Wali</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {muridPerluPerhatian.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-7 h-7 print:hidden">
                            <AvatarImage src={s.foto_url} />
                            <AvatarFallback className="text-[10px] font-bold bg-rose-100 text-rose-700">
                              {s.nama_lengkap?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold leading-tight text-slate-900 dark:text-slate-100">{s.nama_lengkap}</p>
                            <p className="text-[10px] text-muted-foreground">{s.className}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant="outline"
                          className={`w-fit font-bold text-[10px] px-2 py-0.5 ${
                            s.persenBulanIni < 50
                              ? 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {s.persenBulanIni}%
                        </Badge>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {s.hadirBulanIni} dari {hariEfektif} hari
                        </p>
                      </td>
                      <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200">{s.teacherName}</td>
                      <td className="py-2.5 px-3 text-right print:hidden">
                        {s.no_hp_ortu ? (
                          <a
                            href={`https://wa.me/${nomorWa(s.no_hp_ortu)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                          >
                            <Phone className="w-3 h-3" /> WA Wali
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">-</span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {muridPerluPerhatian.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-muted-foreground">
                        {isLoading
                          ? 'Memuat data kehadiran…'
                          : hariEfektif <= 0
                            ? 'Belum ada hari efektif pada bulan ini.'
                            : 'Tidak ada murid dengan kehadiran di bawah ambang.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 print:hidden">
        <div className="border-b pb-4 mb-2">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            Manajemen Kelas &amp; Murid
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tampilan kelas per sesi. Klik murid untuk melihat rincian profil dan riwayat absensinya.
          </p>
        </div>

        <ClassManagement userRole="pentashih" />
      </div>
    </div>
    </>
  );
};

export default PentashihDashboard;
