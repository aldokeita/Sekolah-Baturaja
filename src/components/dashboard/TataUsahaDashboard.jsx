import React from 'react';
import {
  Users, DollarSign, BookOpen, TrendingDown, BookUser, FileText,
  CalendarCheck, Tv, PieChart, Settings, GraduationCap, Calendar, CalendarDays, Inbox,
} from 'lucide-react';
import DashboardWorkspace from './shared/DashboardWorkspace';
import useSchoolIdentity from '@/hooks/useSchoolIdentity';
import { enableTahfizh } from '@/lib/featureFlags';

// Tata Usaha (administrative staff) module set. Mirrors the Admin dashboard's
// layout and flow via the shared DashboardWorkspace, but deliberately omits the
// admin-only modules:
//   - Bisyaroh (salary)      — payroll is an admin decision
//   - Backup & Restore       — system maintenance
//   - Log Login              — security audit trail
// Account/role provisioning inside Data Guru is additionally hidden and blocked
// server-side (see backend middleware CanManage). Backend authorization is the
// real gate; this list only controls what the UI exposes.
const tataUsahaTabs = [
  { value: 'santri', label: 'Data Murid', icon: Users, group: 'data' },
  { value: 'ppdb', label: 'Pendaftaran SPMB', icon: Inbox, group: 'data' },
  { value: 'guru', label: 'Data Guru', icon: BookUser, group: 'data' },
  { value: 'kelas', label: 'Manajemen Kelas', icon: BookOpen, group: 'akademik' },
  { value: 'jadwal-pelajaran', label: 'Jadwal Pelajaran', icon: CalendarDays, group: 'akademik' },
  { value: 'rekap-absensi', label: 'Rekap Murid', icon: CalendarCheck, group: 'akademik' },
  { value: 'rekap-guru', label: 'Rekap Guru', icon: GraduationCap, group: 'akademik' },
  { value: 'rapat-guru', label: 'Rapat Guru', icon: Users, group: 'akademik' },
  ...(enableTahfizh ? [{ value: 'metode-mengaji', label: 'Metode Mengaji', icon: BookOpen, group: 'akademik' }] : []),
  { value: 'academic-calendar', label: 'Kalender', icon: Calendar, group: 'akademik' },
  { value: 'payment', label: 'Pembayaran', icon: DollarSign, group: 'keuangan' },
  { value: 'recap', label: 'Rekap SPP', icon: PieChart, group: 'keuangan' },
  { value: 'history', label: 'Riwayat Bayar', icon: FileText, group: 'keuangan' },
  { value: 'expense', label: 'Pengeluaran', icon: TrendingDown, group: 'keuangan' },
  { value: 'content', label: 'Konten', icon: FileText, group: 'konten' },
  { value: 'tv-settings', label: 'Pengaturan TV', icon: Tv, group: 'konten' },
  { value: 'game-config', label: 'Konfigurasi', icon: Settings, group: 'konten' },
];

const TataUsahaDashboard = () => {
  const sekolah = useSchoolIdentity();
  return (
    <DashboardWorkspace
      title="Dashboard Tata Usaha"
      subtitle={`Kelola administrasi & operasional ${sekolah.shortName}`}
      tabs={tataUsahaTabs}
    />
  );
};

export default TataUsahaDashboard;
