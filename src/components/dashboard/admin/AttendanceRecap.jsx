import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchClassList, fetchSantriPage } from '@/lib/dataMasterAdapters';
import {
  fetchAttendance,
  fetchAttendanceDates,
  fetchAttendanceTodaySummary,
  fetchCalendarContext,
} from '@/lib/attendanceAdapters';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { Download, Calendar, BarChart, TrendingUp, Search, User, RefreshCw, X as XIcon } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ResponsiveContainer, BarChart as RechartsBarChart, LineChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from '@/lib/utils';
import AttendanceStatusIcon from '../shared/AttendanceStatusIcon';
import AttendanceDetailsModal from '../shared/AttendanceDetailsModal';
import { buildSessionStartTimestamp, resolveAttendanceRecordStatus, calculateTimeDifference } from '@/utils/AttendanceStatusLogic';
import { useAttendanceSessionConfiguration } from '@/hooks/useAttendanceSessionConfiguration';
import { useAuth } from '@/contexts/AuthContext';
import { resolveAvatarRecords } from '@/lib/storageAdapters';
import DataPagination from '@/components/dashboard/shared/DataPagination';
import { getAllSessions, getSessionNumber } from '@/utils/sessionMapping';
import { getActiveCalendarDates } from '@/lib/calendarUtils';

const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const PAGE_SIZE = 10;

/**
 * Kehadiran murid HARI INI, seluruh sekolah, dipecah per kelas.
 *
 * Angka yang dicari kepala sekolah setiap pagi, dan sengaja terpisah dari rekap
 * bulanan di bawahnya: rekap bulanan menjawab "bagaimana bulan ini", yang ini
 * menjawab "siapa yang belum datang sekarang".
 *
 * Tiga keadaan dibedakan, karena ketiganya bukan hal yang sama:
 *
 *   gagal dibaca         → "—" beserta sebabnya
 *   belum ada yang absen → "Belum ada", BUKAN "0%" yang seolah semua bolos
 *                          padahal jam masuk mungkin belum tiba
 *   sudah berjalan       → persentase, jumlahnya, dan kelas yang paling kosong
 *
 * Menyegarkan sendiri setiap dua menit. Angkanya berubah sepanjang pagi saat
 * murid memindai kartunya, dan panel ini justru dibuka pada saat itu.
 */
const KehadiranHariIni = () => {
    const [data, setData] = useState(null);
    const [gagal, setGagal] = useState(false);
    const [memuat, setMemuat] = useState(true);

    const muat = useCallback(async () => {
        try {
            setData(await fetchAttendanceTodaySummary());
            setGagal(false);
        } catch {
            setGagal(true);
        } finally {
            setMemuat(false);
        }
    }, []);

    useEffect(() => {
        muat();
        const timer = setInterval(muat, 120000);
        return () => clearInterval(timer);
    }, [muat]);

    const total = data?.total || 0;
    const tercatat = data?.tercatat || 0;
    const terlambat = data?.terlambat || 0;
    const perKelas = data?.per_kelas || [];
    const persen = total > 0 ? Math.round((tercatat / total) * 100) : 0;

    const nilai = (() => {
        if (gagal) return '—';
        if (total === 0) return '—';
        if (tercatat === 0) return 'Belum ada';
        return `${persen}%`;
    })();

    const keterangan = (() => {
        if (gagal) return 'Data kehadiran belum bisa dibaca.';
        if (total === 0) return 'Belum ada murid aktif.';
        if (tercatat === 0) return `0 dari ${total} murid tercatat absen hari ini. Jam masuk mungkin belum tiba.`;
        const bagian = [`${tercatat} dari ${total} murid sudah tercatat`];
        if (terlambat > 0) bagian.push(`${terlambat} terlambat`);
        return `${bagian.join(' · ')}.`;
    })();

    // Warnanya mengikuti ambang yang sama dengan tabel rekap di bawah, supaya
    // hijau-kuning-merah berarti hal yang sama di seluruh panel ini.
    const nadaPersen = persen >= 71
        ? 'text-emerald-700 dark:text-emerald-400'
        : persen >= 41 ? 'text-amber-700 dark:text-amber-400' : 'text-red-700 dark:text-red-400';

    return (
        <div className="admin-form-section">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h3 className="mb-1 flex items-center gap-2 text-lg font-semibold" style={{ color: 'hsl(var(--admin-text-primary))' }}>
                        <TrendingUp className="w-5 h-5" style={{ color: 'hsl(var(--admin-accent))' }} /> Kehadiran Hari Ini
                    </h3>
                    <p className="text-sm text-muted-foreground">{memuat ? 'Menghitung…' : keterangan}</p>
                </div>
                <div className="text-right">
                    <p className={cn('text-3xl font-black leading-none', tercatat > 0 && !gagal ? nadaPersen : 'text-muted-foreground')}>
                        {memuat ? '…' : nilai}
                    </p>
                    <button type="button" onClick={muat} className="mt-1 text-xs text-muted-foreground underline hover:text-foreground">
                        Muat ulang
                    </button>
                </div>
            </div>

            {!memuat && !gagal && perKelas.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    {perKelas.map((k) => {
                        const persenKelas = k.total > 0 ? Math.round((k.tercatat / k.total) * 100) : 0;
                        return (
                            <div key={k.nama_kelas} className="rounded-lg border px-3 py-2" style={{ borderColor: 'hsl(var(--admin-border))' }}>
                                <p className="truncate text-xs font-semibold" style={{ color: 'hsl(var(--admin-text-primary))' }}>{k.nama_kelas}</p>
                                <p className="text-sm font-bold">
                                    {k.tercatat}<span className="text-muted-foreground">/{k.total}</span>
                                    <span className="ml-1 text-xs font-medium text-muted-foreground">{persenKelas}%</span>
                                </p>
                                {/* Yang belum absen disebut angkanya, bukan hanya
                                    tersirat dari selisih — itu yang perlu ditindak. */}
                                {k.belum_absen > 0 && (
                                    <p className="text-[11px] text-amber-700 dark:text-amber-400">{k.belum_absen} belum absen</p>
                                )}
                                {k.terlambat > 0 && (
                                    <p className="text-[11px] text-muted-foreground">{k.terlambat} terlambat</p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export const SantriRecapDetailModal = ({ santri, isOpen, onClose }) => {
    const [year, setYear] = useState(new Date().getFullYear());
    const [attendance, setAttendance] = useState([]);
    const [availableYears, setAvailableYears] = useState([]);
    const [chartData, setChartData] = useState([]);

    useEffect(() => {
        if (!santri) return;
        const fetchDetail = async () => {
            try {
                const dates = await fetchAttendanceDates(santri.id, 2000);
                const data = (dates || []).map((d) => ({ attendance_date: d }));

                setAttendance(data);
                const years = [...new Set(data.map(a => parseInt(a.attendance_date.split('-')[0])))].sort((a,b) => b-a);
                const currentYear = new Date().getFullYear();
                if (!years.includes(currentYear)) years.unshift(currentYear);
                setAvailableYears(years);
                if (!years.includes(year)) setYear(years[0] || currentYear);
            } catch (err) {
                toast({ title: 'Error', description: 'Gagal mengambil detail absensi.', variant: 'destructive'});
            }
        };
        fetchDetail();
    }, [santri, year]);

    useEffect(() => {
        if (!santri) return;
        const yearAttendance = attendance.filter(a => parseInt(a.attendance_date.split('-')[0]) === year);
        const monthlyData = Array(12).fill(0).map((_, monthIndex) => {
            return yearAttendance.filter(a => parseInt(a.attendance_date.split('-')[1]) === monthIndex + 1).length;
        });
        setChartData(months.map((name, index) => ({ name: name.substring(0,3), Kehadiran: monthlyData[index] })));
    }, [year, attendance, santri]);

    const handleExportDetail = () => {
        const dataToExport = chartData.map(d => ({ 'Bulan': d.name, 'Jumlah Kehadiran': d.Kehadiran }));
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Rekap ${year}`);
        XLSX.writeFile(wb, `Rekap_Absensi_${santri.name}_${year}.xlsx`);
    }

    if (!santri) return null;
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Rekap Absensi Detail: {santri.name}</DialogTitle>
                </DialogHeader>
                <div className="flex justify-between items-center mt-4">
                    <Select value={year.toString()} onValueChange={(val) => setYear(Number(val))}>
                        <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                        <SelectContent>{availableYears.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button onClick={handleExportDetail} size="sm"><Download className="w-4 h-4 mr-2"/> Export Excel</Button>
                </div>
                <div className="h-80 w-full mt-4">
                    <ResponsiveContainer>
                        <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="Kehadiran" stroke="#16a34a" activeDot={{ r: 8 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </DialogContent>
        </Dialog>
    );
};

const AttendanceRecap = () => {
    const { role, user } = useAuth();
    const { sessionTimes } = useAttendanceSessionConfiguration();
    const [attendanceData, setAttendanceData] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [classes, setClasses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedClass, setSelectedClass] = useState('all');
    const [selectedSession, setSelectedSession] = useState('all');
    const [availableYears, setAvailableYears] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');
    const [detailSantri, setDetailSantri] = useState(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [calendarContext, setCalendarContext] = useState({ eventsByDate: {}, monthSettingsByYear: {} });
    const [currentPage, setCurrentPage] = useState(1);
    const [totalUsers, setTotalUsers] = useState(0);
    const [debouncedSearch, setDebouncedSearch] = useState('');

    const [previewImage, setPreviewImage] = useState(null);
    const [attendanceDetails, setAttendanceDetails] = useState(null);

    useEffect(() => {
        const timer = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
        return () => window.clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        setCurrentPage(1);
    }, [selectedYear, selectedMonth, selectedClass, selectedSession, debouncedSearch, sortKey, sortOrder]);

    const fetchAllData = useCallback(async () => {
        setIsLoading(true);

        const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        try {
            const calendarStartDate = `${selectedYear}-01-01`;
            const calendarEndDate = `${selectedYear}-12-31`;
            const [classData, calendarContextData] = await Promise.all([
                fetchClassList({ is_active: true }),
                fetchCalendarContext(calendarStartDate, calendarEndDate),
            ]);
            const scopedClasses = role === 'guru'
                ? (classData || []).filter((item) => item.id_guru === user?.id)
                : (classData || []);

            const normalizedSearch = debouncedSearch.replace(/[%_,().]/g, ' ').trim();
            const santriFilters = {
                notDeleted: true,
                activeOnly: true,
                order: 'nama',
                page: currentPage - 1,
                limit: PAGE_SIZE,
            };

            if (selectedClass !== 'all') {
                santriFilters.classId = selectedClass;
            } else if (role === 'guru') {
                const classIds = scopedClasses.map((item) => item.id);
                if (classIds.length === 0) {
                    setAttendanceData([]);
                    setAllUsers([]);
                    setTotalUsers(0);
                    setClasses(scopedClasses);
                    setCalendarContext(calendarContextData);
                    return;
                }
                santriFilters.classIds = classIds;
            }

            if (selectedSession !== 'all') {
                santriFilters.sesi = [String(getSessionNumber(selectedSession)), selectedSession];
            }
            if (normalizedSearch) santriFilters.search = normalizedSearch;

            const { data: santri, total: count } = await fetchSantriPage(santriFilters);
            const santriIds = (santri || []).map((item) => item.id);
            const allAttendance = santriIds.length > 0
                ? await fetchAttendance({
                    date_from: startDate,
                    date_to: endDate,
                    limit: 500,
                    ...(selectedClass !== 'all' ? { class_id: selectedClass } : {}),
                })
                : [];
            const santriIdSet = new Set(santriIds);
            const attendance = (allAttendance || []).filter((row) => santriIdSet.has(row.user_id));

            const resolvedSantri = await resolveAvatarRecords(santri, { ownerType: 'santri' });

            setAttendanceData(attendance || []);
            setAllUsers(resolvedSantri.map(s => ({ ...s, id_kelas: s.current_class_id, name: s.nama_lengkap, role: 'santri', kategori: s.kategori })));
            setTotalUsers(count || 0);
            setClasses(scopedClasses);
            setCalendarContext(calendarContextData);

            const totalPages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE));
            if (currentPage > totalPages) setCurrentPage(totalPages);

            // Auto-select class for guru if they have one and 'all' is selected
            if (role === 'guru' && scopedClasses.length > 0 && selectedClass === 'all') {
                setSelectedClass(scopedClasses[0].id);
            }

            const years = [selectedYear, new Date().getFullYear()];
            const uniqueYears = [...new Set(years)].sort((a,b) => b-a);
            setAvailableYears(uniqueYears);

        } catch (err) {
             console.error("Exception fetching data:", err);
             toast({ title: "Error", description: err.message || "Gagal memuat data rekap.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [currentPage, debouncedSearch, selectedYear, selectedMonth, role, user?.id, selectedClass, selectedSession]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const getSessionStartTimestamp = useCallback(
        (dateStr, sesiName) => buildSessionStartTimestamp(dateStr, sesiName, sessionTimes),
        [sessionTimes],
    );

    const handleIconClick = (record, day, user) => {
        const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const registeredSession = user.sesi_mengaji || 'Pagi';
        const attendedSession = record?.attended_session || registeredSession;
        const sessionStartTime = getSessionStartTimestamp(dateStr, attendedSession);

        if (!record && user[day] !== 'H') {
            // Unrecorded past day
            setAttendanceDetails({
                id: null,
                status: 'Tidak Hadir',
                checkInTimestamp: null,
                sessionStartTime: sessionStartTime,
                lateMinutes: 0,
                // Info for manual confirm
                user_id: user.id,
                attendance_date: dateStr,
                sesi: user.sesi_mengaji || 'Pagi',
                attended_session: registeredSession,
                class_id: user.current_class_id || user.id_kelas,
                user_role: user.role
            });
            return;
        }

        const isStoredPresent = ['hadir', 'terlambat'].includes(String(record?.status || '').trim().toLowerCase());
        const timestamp = record?.check_in_timestamp || (isStoredPresent ? record?.created_at : null);
        const computedStatus = resolveAttendanceRecordStatus(record, sessionStartTime);
        const diff = calculateTimeDifference(timestamp, sessionStartTime);

        setAttendanceDetails({
            id: record?.id,
            status: record ? computedStatus : 'Tidak Hadir',
            checkInTimestamp: timestamp,
            sessionStartTime: sessionStartTime,
            lateMinutes: diff,
            user_id: user.id,
            attendance_date: dateStr,
            sesi: user.sesi_mengaji || 'Pagi',
            attended_session: attendedSession,
            class_id: user.current_class_id || user.id_kelas,
            user_role: user.role
        });
    };

    const recapData = useMemo(() => {
        const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const monthStart = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
        const monthEnd = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
        const weekdaysInMonth = getActiveCalendarDates({
            startDate: monthStart,
            endDate: monthEnd,
            ...calendarContext,
        }).map((dateString) => Number(dateString.slice(8, 10)));

        const pastSessionDaysCount = weekdaysInMonth.filter(d => new Date(selectedYear, selectedMonth, d) <= today).length;

        const filteredAttendance = attendanceData.filter(a => {
            if (!a.attendance_date) return false;
            const datePart = a.attendance_date.split('T')[0];
            const [y, m, d] = datePart.split('-').map(Number);
            return y === selectedYear && (m - 1) === selectedMonth;
        });

        let usersToRecap = allUsers.filter(u => u.role === 'santri');

        if (selectedClass !== 'all') { usersToRecap = usersToRecap.filter(u => (u.current_class_id || u.id_kelas) === selectedClass); }
        if (searchTerm) { usersToRecap = usersToRecap.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase())); }

        const userRecap = usersToRecap.map(user => {
            const attendanceByDate = {};
            let totalHadir = 0;

            weekdaysInMonth.forEach(day => {
                const dateToCompare = new Date(selectedYear, selectedMonth, day);
                const isPast = dateToCompare <= today;

                const attendanceRecord = filteredAttendance.find(a => {
                    const datePart = a.attendance_date.split('T')[0];
                    const [y, m, d] = datePart.split('-').map(Number);
                    return a.user_id === user.id && d === day;
                });

                if (isPast) {
                    const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const sessionStart = getSessionStartTimestamp(
                        dateStr,
                        attendanceRecord?.attended_session || user.sesi_mengaji || 'Pagi',
                    );
                    const recordStatus = resolveAttendanceRecordStatus(attendanceRecord, sessionStart);
                    const isPresent = recordStatus === 'Hadir' || recordStatus === 'Terlambat';
                    attendanceByDate[day] = isPresent ? 'H' : 'A';
                    attendanceByDate[`${day}_record`] = attendanceRecord;
                    if (isPresent) totalHadir++;
                } else {
                    attendanceByDate[day] = 'F';
                }
            });

            let attendancePercentage = 0;
            if (totalHadir === 0) {
                attendancePercentage = 0;
            } else if (totalHadir === pastSessionDaysCount && pastSessionDaysCount > 0) {
                attendancePercentage = 100;
            } else if (pastSessionDaysCount > 0) {
                attendancePercentage = Math.round((totalHadir / pastSessionDaysCount) * 100);
            }

            return {
                id: user.id,
                name: user.name,
                role: user.role,
                photo: user.foto_url,
                sesi_mengaji: user.sesi_mengaji,
                id_kelas: user.current_class_id || user.id_kelas,
                current_class_id: user.current_class_id || user.id_kelas,
                ...attendanceByDate,
                totalHadir,
                attendancePercentage
            };
        });

        userRecap.sort((a, b) => {
            let valA = a[sortKey];
            let valB = b[sortKey];

            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return { userRecap, weekdaysInMonth };
    }, [attendanceData, allUsers, selectedYear, selectedMonth, selectedClass, searchTerm, sortKey, sortOrder, calendarContext, getSessionStartTimestamp]);

    const chartData = useMemo(() => {
        return recapData.weekdaysInMonth.map(day => {
            let hadirCount = recapData.userRecap.filter(user => user[day] === 'H').length;
            return { day: `${day}`, Hadir: hadirCount };
        });
    }, [recapData]);

    const handleExport = () => {
        toast({ title: 'Membuat File Excel...', description: 'Mohon tunggu sebentar.' });
        try {
            const { userRecap, weekdaysInMonth } = recapData;
            const headers = ['No', 'Nama', 'Peran', ...weekdaysInMonth, 'Total Hadir', '% Kehadiran'];
            const data = userRecap.map((user, index) => {
                const row = [index + 1, user.name, user.role];
                weekdaysInMonth.forEach(day => {
                    const status = user[day];
                    row.push(status === 'H' ? 'Hadir' : (status === 'A' ? 'Alpha' : '-'));
                });
                row.push(user.totalHadir, `${user.attendancePercentage}%`);
                return row;
            });
            const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
            const wscols = [{wch: 5}, {wch: 30}, {wch: 10}];
            weekdaysInMonth.forEach(() => wscols.push({wch: 4}));
            wscols.push({wch: 12}, {wch: 12});
            ws['!cols'] = wscols;

            const wb = XLSX.utils.book_new();
            const sheetName = 'Rekap Absensi Murid';
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
            XLSX.writeFile(wb, `Rekap_Absensi_Murid_${months[selectedMonth]}_${selectedYear}.xlsx`);
            toast({ title: "Ekspor Berhasil", description: "File rekap absensi telah diunduh." });
        } catch (error) { toast({ title: "Ekspor Gagal", description: error.message, variant: 'destructive' }); }
    };

    const openDetailModal = (santri) => {
        setDetailSantri(santri);
        setIsDetailOpen(true);
    };

    /* Nada teksnya satu-dua langkah lebih gelap dari pilihan mockup. Di atas latar
     * -50 yang sangat terang, emerald-600 hanya mencapai rasio 3.60, amber-500
     * 2.08, dan red-500 3.44 — semuanya di bawah 4.5 yang diminta WCAG AA. Amber
     * yang terburuk, dan justru ia menandai kehadiran yang perlu diperhatikan.
     * Nada sekarang: 5.24, 4.86, dan 5.91. Rona ketiganya tidak berubah, jadi
     * hijau-kuning-merah tetap terbaca sebagai isyarat yang sama. */
    const getAttendanceColorClass = (percentage) => {
        if (percentage >= 71) return "bg-green-50 text-emerald-700 font-bold border-green-200";
        if (percentage >= 41) return "bg-yellow-50 text-amber-700 font-bold border-yellow-200";
        return "bg-red-50 text-red-700 font-bold border-red-200";
    };

    if (isLoading) return <div className="admin-table-loading" style={{ position: 'relative', minHeight: '12rem', borderRadius: '0.75rem', border: '1px solid hsl(var(--admin-border))', backgroundColor: 'hsl(var(--admin-surface))' }}><div className="admin-table-loading-spinner"></div><p>Memuat rekap absensi...</p></div>;

    return (
        <>
        <div className="space-y-6">
            <div className="admin-panel-header">
                <div className="flex items-center gap-3">
                    <div className="admin-panel-header-icon">
                        <Calendar />
                    </div>
                    <div className="admin-panel-header-text">
                        <h2>Rekap Absensi Digital</h2>
                        <p>Pantau kehadiran murid per bulan dan sesi.</p>
                    </div>
                </div>
                <div className="admin-panel-header-actions">
                    <button onClick={handleExport} className="admin-panel-primary-btn" style={{ backgroundColor: 'hsl(var(--admin-accent))' }}>
                        <Download className="w-4 h-4"/> Export Excel
                    </button>
                </div>
            </div>

            {/* Kehadiran HARI INI, terpisah dari rekap bulanan di bawahnya.
                Sebelumnya ini kartu kelima di ringkasan dashboard; di sana ia
                menyempitkan empat kartu lain dan keterangannya terpotong.
                Tempatnya di sini, dan ruangnya cukup untuk menyebut persentase,
                jumlah, keterlambatan, dan kelas yang paling banyak kosong
                sekaligus — tanpa memaksa siapa pun membaca tabel bulanan dulu. */}
            <KehadiranHariIni />

            <div className="admin-filter-bar">
                <div className="flex items-center gap-2 flex-wrap">
                    <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(Number(val))}><SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger><SelectContent>{availableYears.map(year => <SelectItem key={year} value={year.toString()}>{year}</SelectItem>)}</SelectContent></Select>
                    <Select value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(Number(val))}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger><SelectContent>{months.map((month, index) => <SelectItem key={month} value={index.toString()}>{month}</SelectItem>)}</SelectContent></Select>
                    <Select value={selectedClass} onValueChange={setSelectedClass}><SelectTrigger className="w-[180px]"><SelectValue placeholder="Semua Kelas" /></SelectTrigger><SelectContent><SelectItem value="all">{role === 'guru' ? 'Semua Kelas Saya' : 'Semua Kelas'}</SelectItem>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.nama_kelas}</SelectItem>)}</SelectContent></Select>
                    <Select value={selectedSession} onValueChange={setSelectedSession}>
                        <SelectTrigger className="w-[150px]"><SelectValue placeholder="Semua Sesi" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Sesi</SelectItem>
                            {getAllSessions().map(session => (
                                <SelectItem key={session.id} value={session.name}>{session.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button onClick={fetchAllData} variant="outline" size="icon" title="Refresh Data"><RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}/></Button>
                </div>
            </div>

            <div className="admin-form-section">
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4" style={{ color: 'hsl(var(--admin-text-primary))' }}><BarChart className="w-5 h-5" style={{ color: 'hsl(var(--admin-accent))' }}/>Statistik Kehadiran Halaman Ini ({months[selectedMonth]} {selectedYear})</h3>
                <div className="h-72 w-full">
                    <ResponsiveContainer>
                        <RechartsBarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="day" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Bar dataKey="Hadir" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        </RechartsBarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div className="relative flex-grow w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Cari nama murid..." className="w-full pl-9 pr-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white dark:bg-slate-950" />
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Select value={sortKey} onValueChange={setSortKey}>
                                <SelectTrigger className="w-[150px] bg-white dark:bg-slate-950"><SelectValue placeholder="Urutkan" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="name">Nama</SelectItem>
                                    <SelectItem value="totalHadir">Total Hadir</SelectItem>
                                    <SelectItem value="attendancePercentage">% Kehadiran</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={sortOrder} onValueChange={setSortOrder}>
                                <SelectTrigger className="w-[120px] bg-white dark:bg-slate-950"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="asc">Menaik</SelectItem><SelectItem value="desc">Menurun</SelectItem></SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="overflow-x-auto border rounded-xl shadow-sm max-h-[70vh] custom-scrollbar bg-white dark:bg-slate-950 relative">
                        <table className="w-full text-sm min-w-max border-collapse">
                            <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0 z-30 shadow-sm">
                                <tr>
                                    <th className="px-3 py-4 text-center w-12 sticky left-0 bg-slate-100 dark:bg-slate-900 z-40 border-r border-slate-200 dark:border-slate-800 font-semibold text-slate-600 dark:text-slate-300">No</th>
                                    <th className="px-3 py-4 text-left w-16 sticky left-12 bg-slate-100 dark:bg-slate-900 z-40 font-semibold text-slate-600 dark:text-slate-300">Foto</th>
                                    <th className="px-3 py-4 text-left w-48 sticky left-28 bg-slate-100 dark:bg-slate-900 z-40 border-r border-slate-200 dark:border-slate-800 font-semibold text-slate-600 dark:text-slate-300 shadow-[1px_0_5px_rgba(0,0,0,0.05)]">Nama</th>
                                    <th className="px-3 py-4 text-center w-20 font-semibold text-slate-600 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800">Aksi</th>
                                    {recapData.weekdaysInMonth.map(day => <th key={day} className="px-1.5 py-4 text-center w-10 min-w-[2.5rem] max-w-[2.5rem] font-medium text-slate-500">{day}</th>)}
                                    <th className="px-3 py-4 text-center w-28 font-semibold sticky right-0 bg-slate-100 dark:bg-slate-900 z-30 shadow-[-1px_0_5px_rgba(0,0,0,0.05)] border-l border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">Hadir</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {recapData.userRecap.map((user, index) => (
                                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group h-14">
                                        <td className="px-3 py-2 text-center text-muted-foreground sticky left-0 bg-white dark:bg-slate-950 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50 z-10 border-r border-slate-100 dark:border-slate-800">{((currentPage - 1) * PAGE_SIZE) + index + 1}</td>
                                        <td className="px-3 py-2 sticky left-12 bg-white dark:bg-slate-950 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50 z-10">
                                            <Avatar className="w-8 h-8 border border-slate-200 cursor-pointer hover:scale-110 transition-transform shadow-sm" onClick={() => setPreviewImage(user.photo)}>
                                                <AvatarImage src={user.photo} className="object-cover" />
                                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium"><User className="w-4 h-4"/></AvatarFallback>
                                            </Avatar>
                                        </td>
                                        <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap sticky left-28 bg-white dark:bg-slate-950 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50 z-20 border-r border-slate-100 dark:border-slate-800 shadow-[1px_0_5px_rgba(0,0,0,0.02)]">{user.name}</td>
                                        <td className="px-3 py-2 text-center border-r border-slate-100 dark:border-slate-800">
                                            {user.role === 'santri' && (
                                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 mx-auto" onClick={() => openDetailModal(user)} title="Lihat Detail Progres">
                                                    <TrendingUp className="w-4 h-4"/>
                                                </Button>
                                            )}
                                        </td>
                                        {recapData.weekdaysInMonth.map(day => {
                                            const status = user[day];
                                            const record = user[`${day}_record`];
                                            const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                            const sessionStart = getSessionStartTimestamp(
                                                dateStr,
                                                record?.attended_session || user.sesi_mengaji || 'Pagi',
                                            );
                                            let displayStatus = status === 'H' ? 'Hadir' : (status === 'A' ? 'Tidak Hadir' : 'Future');

                                            if (status === 'H' && record) {
                                                displayStatus = resolveAttendanceRecordStatus(record, sessionStart);
                                            }

                                            return (
                                                <td key={day} className="px-1 py-1 text-center border-x border-slate-50 dark:border-slate-800/30 overflow-hidden w-10 min-w-[2.5rem] max-w-[2.5rem]">
                                                    {status === 'F' ? (
                                                        <span className="text-slate-300 dark:text-slate-700 flex justify-center">-</span>
                                                    ) : (
                                                        <div className="flex items-center justify-center w-full h-full">
                                                            <AttendanceStatusIcon
                                                                status={displayStatus}
                                                                onClick={() => handleIconClick(record, day, user)}
                                                            />
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td className="px-3 py-2 text-center border-l border-slate-100 dark:border-slate-800 sticky right-0 bg-white dark:bg-slate-950 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50 z-10 shadow-[-1px_0_5px_rgba(0,0,0,0.02)]">
                                            <div className={cn("inline-flex flex-col items-center justify-center px-2 py-1 rounded-md border w-full", getAttendanceColorClass(user.attendancePercentage))} title="Total Hadir (Persentase)">
                                                <span className="text-sm font-bold leading-tight">{user.totalHadir} <span className="text-[11px] font-medium opacity-90">({user.attendancePercentage}%)</span></span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {recapData.userRecap.length === 0 && (
                                    <tr>
                                        <td colSpan={recapData.weekdaysInMonth.length + 5} className="text-center py-10 text-slate-500 bg-slate-50/50 dark:bg-slate-900/20">
                                            Tidak ada data murid ditemukan.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <DataPagination
                        currentPage={currentPage}
                        totalItems={totalUsers}
                        pageSize={PAGE_SIZE}
                        onPageChange={setCurrentPage}
                        itemLabel="murid"
                    />
            </div>
        </div>

        <SantriRecapDetailModal santri={detailSantri} isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} />
        <AttendanceDetailsModal isOpen={!!attendanceDetails} onClose={() => setAttendanceDetails(null)} details={attendanceDetails} onSuccess={fetchAllData} />

        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
            <DialogContent className="max-w-xl p-0 overflow-hidden bg-transparent border-none shadow-none">
                <div className="relative w-full h-[80vh] flex items-center justify-center pointer-events-auto">
                    {previewImage ? (
                        <img src={previewImage} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl bg-black/50" />
                    ) : (
                        <div className="w-64 h-64 bg-slate-200 flex items-center justify-center rounded-lg">
                            <User className="w-20 h-20 text-slate-400" />
                        </div>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-sm"
                        onClick={() => setPreviewImage(null)}
                    >
                        <XIcon className="w-6 h-6" />
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
        </>
    );
};

export default AttendanceRecap;
