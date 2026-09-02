import React from 'react';
import {
  Users, DollarSign, BookOpen, TrendingDown, BookUser, LogIn, FileText,
  CalendarCheck, Tv, PieChart, Settings, GraduationCap, Calendar,
  Database, CalendarDays, Inbox, MessageSquare, ArrowUpRight, Mail, BookText,
} from 'lucide-react';
import DashboardWorkspace from './shared/DashboardWorkspace';
import { enableBackupRestore, enableTahfizh, enableWaNotifications } from '@/lib/featureFlags';
import useSchoolIdentity from '@/hooks/useSchoolIdentity';

// Full module set for the Administrator. The Tata Usaha dashboard reuses the
// same DashboardWorkspace shell with a narrower subset (see TataUsahaDashboard).
const adminTabs = [
  { value: 'santri', label: 'Data Murid', icon: Users, group: 'data' },
  { value: 'ppdb', label: 'Pendaftaran SPMB', icon: Inbox, group: 'data' },
  { value: 'guru', label: 'Data Guru', icon: BookUser, group: 'data' },
  // Surat keluar dan mutasi keluar murid — pekerjaan harian tata usaha, yang
  // sebelum ini seluruhnya dikerjakan di luar aplikasi.
  { value: 'surat', label: 'Surat & Mutasi', icon: Mail, group: 'data' },
  { value: 'kelas', label: 'Manajemen Kelas', icon: BookOpen, group: 'akademik' },
  // Dipakai sekali setahun, tetapi menyentuh seluruh murid sekaligus — jadi ia
  // berhak punya tempat sendiri, bukan disembunyikan di dalam Manajemen Kelas.
  { value: 'kenaikan-kelas', label: 'Kenaikan Kelas', icon: ArrowUpRight, group: 'akademik' },
  { value: 'jadwal-pelajaran', label: 'Jadwal Pelajaran', icon: CalendarDays, group: 'akademik' },
  { value: 'rekap-absensi', label: 'Rekap Murid', icon: CalendarCheck, group: 'akademik' },
  { value: 'rekap-guru', label: 'Rekap Guru', icon: GraduationCap, group: 'akademik' },
  // Jurnal mengajar: dibaca di sini, ditulis guru dari dashboardnya.
  { value: 'jurnal-mengajar', label: 'Jurnal Mengajar', icon: BookText, group: 'akademik' },
  { value: 'rapat-guru', label: 'Rapat Guru', icon: Users, group: 'akademik' },
  ...(enableTahfizh ? [{ value: 'metode-mengaji', label: 'Metode Mengaji', icon: BookOpen, group: 'akademik' }] : []),
  /* Panel Bisyaroh DICABUT permanen, bukan disembunyikan di balik flag.
   *
   * Ia menghitung gaji guru per sesi memakai tarif "Syahadah / Non-Syahadah" —
   * sertifikasi guru Al-Qur'an, tidak berarti apa pun di SD negeri — dan
   * tombol Simpannya hanya menampilkan pesan sukses tanpa memanggil API sama
   * sekali. Tidak ada tabel, rute, maupun adapter untuk menyimpannya, jadi
   * seluruh isian hilang setiap halaman dimuat ulang.
   *
   * Dicabut atas keputusan pemilik. Jangan dikembalikan tanpa membangun
   * penyimpanannya lebih dulu — lihat docs/HANDOFF.md. */
  { value: 'academic-calendar', label: 'Kalender', icon: Calendar, group: 'akademik' },
  { value: 'payment', label: 'Pembayaran', icon: DollarSign, group: 'keuangan' },
  { value: 'recap', label: 'Rekap SPP', icon: PieChart, group: 'keuangan' },
  { value: 'history', label: 'Riwayat Bayar', icon: FileText, group: 'keuangan' },
  { value: 'expense', label: 'Pengeluaran', icon: TrendingDown, group: 'keuangan' },
  { value: 'content', label: 'Konten', icon: FileText, group: 'konten' },
  { value: 'tv-settings', label: 'Pengaturan TV', icon: Tv, group: 'konten' },
  { value: 'game-config', label: 'Konfigurasi', icon: Settings, group: 'konten' },
  { value: 'backup', label: 'Backup & Restore', icon: Database, group: 'sistem' },
  { value: 'logs', label: 'Log Login', icon: LogIn, group: 'sistem' },
  { value: 'wa-notifikasi', label: 'Notifikasi WA', icon: MessageSquare, group: 'sistem' },
].filter(tab => {
  if (tab.value === 'backup') return enableBackupRestore;
  // Notifikasi WA disembunyikan sampai sekolah punya gerbang WhatsApp dan
  // migrasi wa_outbox diterapkan; lihat enableWaNotifications.
  if (tab.value === 'wa-notifikasi') return enableWaNotifications;
  return true;
});

const AdminDashboard = () => {
  const sekolah = useSchoolIdentity();
  return (
    <DashboardWorkspace
      title="Dashboard Administrator"
      subtitle={`Kelola seluruh sistem ${sekolah.shortName}`}
      tabs={adminTabs}
    />
  );
};

export default AdminDashboard;
