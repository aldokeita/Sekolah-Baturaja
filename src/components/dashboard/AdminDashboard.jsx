import React from 'react';
import {
  Users, DollarSign, BookOpen, TrendingDown, BookUser, LogIn, FileText,
  CalendarCheck, Tv, PieChart, Settings, GraduationCap, Calendar, Calculator,
  Database, CalendarDays, Inbox,
} from 'lucide-react';
import DashboardWorkspace from './shared/DashboardWorkspace';
import { enableBackupRestore, enableTahfizh } from '@/lib/featureFlags';
import useSchoolIdentity from '@/hooks/useSchoolIdentity';

// Full module set for the Administrator. The Tata Usaha dashboard reuses the
// same DashboardWorkspace shell with a narrower subset (see TataUsahaDashboard).
const adminTabs = [
  { value: 'santri', label: 'Data Murid', icon: Users, group: 'data' },
  { value: 'ppdb', label: 'Pendaftaran PPDB', icon: Inbox, group: 'data' },
  { value: 'guru', label: 'Data Guru', icon: BookUser, group: 'data' },
  { value: 'kelas', label: 'Manajemen Kelas', icon: BookOpen, group: 'akademik' },
  { value: 'jadwal-pelajaran', label: 'Jadwal Pelajaran', icon: CalendarDays, group: 'akademik' },
  { value: 'rekap-absensi', label: 'Rekap Murid', icon: CalendarCheck, group: 'akademik' },
  { value: 'rekap-guru', label: 'Rekap Guru', icon: GraduationCap, group: 'akademik' },
  { value: 'rapat-guru', label: 'Rapat Guru', icon: Users, group: 'akademik' },
  ...(enableTahfizh ? [{ value: 'metode-mengaji', label: 'Metode Mengaji', icon: BookOpen, group: 'akademik' }] : []),
  { value: 'salary', label: 'Bisyaroh', icon: Calculator, group: 'akademik' },
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
].filter(tab => {
  if (tab.value === 'backup') return enableBackupRestore;
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
