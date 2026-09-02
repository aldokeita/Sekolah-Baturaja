
import React, { useState, useEffect, useRef } from 'react';
import { fetchGuruByRfid } from '@/lib/dataMasterAdapters';
import {
    createAttendance, updateAttendance, fetchTodayAttendance,
    buildSantriAttendancePayload, getLocalDateString, getLocalTimeString, isExplicitAbsentAttendance,
} from '@/lib/attendanceAdapters';
import apiClient from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    XCircle, CheckCircle, Sun, Moon, Keyboard, Megaphone, CalendarDays, Image as GalleryIcon, ImageOff, Clock,
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import useKembali from '@/hooks/useKembali';
import { Helmet } from 'react-helmet';
import { useTheme } from '@/contexts/ThemeContext';
import { resolveAvatarUrl } from '@/lib/storageAdapters';
import { resolveSantriAttendanceSession } from '@/utils/AttendanceStatusLogic';
import { useAttendanceSessionConfiguration } from '@/hooks/useAttendanceSessionConfiguration';
import { fetchAppConfigs } from '@/lib/appConfigAdapters';
import { fetchPublishedAnnouncements, fetchWebsiteContentMap } from '@/lib/publicContentAdapters';
import { fetchPeriodeList, fetchJadwalList, getHariLabel, formatJamRange } from '@/lib/scheduleAdapters';
import { getSchoolIdentity } from '@/lib/schoolIdentity';

// Panel yang berputar di layar lobi. Sekolah umum: pengumuman, jadwal hari ini,
// galeri. Absensi RFID tetap berjalan di latar (scan kartu → catat kehadiran),
// terlepas dari panel mana yang sedang tampil.
const PANELS = [
    { key: 'pengumuman', label: 'Pengumuman', icon: Megaphone },
    { key: 'jadwal', label: 'Jadwal Hari Ini', icon: CalendarDays },
    { key: 'galeri', label: 'Galeri', icon: GalleryIcon },
];

const DEFAULT_DURATIONS = { pengumuman: 20, jadwal: 20, galeri: 18 };

const DigitalClock = ({ showSeconds = true, size = 'large', colorClass = '' }) => {
    const [time, setTime] = useState(() => new Date());
    useEffect(() => {
        const timerId = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timerId);
    }, []);
    const jam = time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: showSeconds ? '2-digit' : undefined });
    const tanggal = time.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: size === 'small' ? 'short' : 'long', year: 'numeric' });
    if (size === 'small') {
        return (
            <div className={`text-right ${colorClass}`}>
                <div className="text-2xl font-bold font-mono leading-none">{jam}</div>
                <div className="text-xs opacity-80 mt-1 font-light">{tanggal}</div>
            </div>
        );
    }
    return (
        <div className="flex flex-col items-center justify-center space-y-2">
            <div className="text-6xl md:text-8xl font-mono font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-800 dark:from-blue-400 dark:to-indigo-500 drop-shadow-sm">{jam}</div>
            <div className="text-xl md:text-2xl text-slate-500 dark:text-slate-200/70 font-light tracking-widest">{tanggal}</div>
        </div>
    );
};

const PopupScanResult = ({ scan }) => (
    <motion.div
        initial={{ opacity: 0, y: -50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -50, scale: 0.9 }}
        className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 flex items-center gap-6 border-2 border-blue-500 max-w-md w-full"
    >
        <div className="relative">
            <Avatar className="w-24 h-24 border-4 border-blue-500 shadow-lg">
                <AvatarImage src={scan.photo} className="object-cover" />
                <AvatarFallback>{scan.name?.[0]}</AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-2 -right-2 bg-blue-500 text-white p-1 rounded-full shadow-md"><CheckCircle className="w-6 h-6" /></div>
        </div>
        <div>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-tight">{scan.name}</h3>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mt-1">{scan.role === 'guru' ? 'Guru' : 'Murid'}</p>
            <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-3 py-1 rounded-full text-xs font-bold inline-block mt-2">ABSEN BERHASIL</div>
        </div>
    </motion.div>
);

const PRIORITY_BADGE = {
    high: { label: 'Penting', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
    normal: { label: 'Info', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    low: { label: 'Umum', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};

const TvDisplayPage = () => {
    const { sessionTimes: attendanceSessionTimes } = useAttendanceSessionConfiguration();
    const navigate = useNavigate();
    // Kembali ke tempat asal penekan; lihat src/hooks/useKembali.js.
    const kembali = useKembali('/absensi-digital');
    const { isDark, toggleTheme } = useTheme();
    const identity = getSchoolIdentity();

    const [config, setConfig] = useState({ transitionTime: 18, showSeconds: true, enabledPanels: {}, durations: {} });
    const [logoUrl, setLogoUrl] = useState('');

    // Data panel
    const [announcements, setAnnouncements] = useState([]);
    const [schedule, setSchedule] = useState([]);
    const [gallery, setGallery] = useState([]);

    // Rotasi panel & galeri
    const [activeIndex, setActiveIndex] = useState(0);
    const [galleryIndex, setGalleryIndex] = useState(0);

    // Scanning
    const [scanBuffer, setScanBuffer] = useState('');
    const [popupScan, setPopupScan] = useState(null);
    const scanTimeoutRef = useRef(null);
    const popupTimerRef = useRef(null);
    const [manualScanOpen, setManualScanOpen] = useState(false);
    const [manualScanId, setManualScanId] = useState('');

    // Panel yang aktif: default semua nyala bila config belum menyetel.
    const enabledPanels = PANELS.filter((p) => config.enabledPanels?.[p.key] !== false);
    const activePanel = enabledPanels[activeIndex % (enabledPanels.length || 1)] || PANELS[0];

    // ── Absensi RFID (dipertahankan dari versi lama) ────────────────────────
    const processScan = async (tag) => {
        const today = getLocalDateString();
        let user = null, userRole = '', sesiUser = '';

        const guruData = await fetchGuruByRfid(tag).catch(() => null);
        if (guruData) {
            user = guruData; userRole = 'guru';
            // Dua shift saja: masuk pagi dan masuk siang.
            sesiUser = new Date().getHours() < 12 ? 'Pagi' : 'Siang';
        } else {
            const santriData = await apiClient.get(`/api/santri/by-rfid/${encodeURIComponent(tag)}`).catch(() => null);
            if (santriData) {
                const foto_url = await resolveAvatarUrl({
                    ownerType: 'santri', ownerId: santriData.id,
                    avatarPath: santriData.avatar_path, fallbackUrl: santriData.foto_url,
                });
                user = { ...santriData, id_kelas: santriData.current_class_id, foto_url };
                userRole = 'santri';
                sesiUser = santriData.sesi_mengaji || santriData.class?.sesi || 'Pagi';
            }
        }

        if (!user) return;

        const existingList = await fetchTodayAttendance().catch(() => []);
        const existing = (existingList || []).find((r) => r.user_id === user.id) || null;
        const shouldRestoreAbsentAttendance = userRole === 'santri' && existing && isExplicitAbsentAttendance(existing.status);

        if (!existing || shouldRestoreAbsentAttendance) {
            const now = new Date();
            const santriSession = userRole === 'santri'
                ? resolveSantriAttendanceSession({ timestamp: now, dateStr: today, assignedSession: sesiUser, sessionTimes: attendanceSessionTimes })
                : null;
            if (santriSession && !santriSession.can) return;

            const payload = userRole === 'santri'
                ? buildSantriAttendancePayload({ santri: user, timestamp: now, status: santriSession.status, attendedSession: santriSession.attendedSession })
                : {
                    user_id: user.id, role: userRole, attendance_date: today,
                    check_in_time: getLocalTimeString(now), check_in_timestamp: now.toISOString(),
                    class_id: null, sesi: sesiUser, status: 'Hadir', source: 'rfid',
                };
            if (shouldRestoreAbsentAttendance) {
                await updateAttendance(existing.id, {
                    check_in_time: payload.check_in_time, check_in_timestamp: payload.check_in_timestamp,
                    class_id: payload.class_id, attended_session: payload.attended_session,
                    status: payload.status, source: 'rfid',
                });
            } else {
                await createAttendance(payload);
            }
        }

        setPopupScan({ name: user.nama || user.nama_lengkap, photo: user.foto_url, role: userRole });
        if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
        popupTimerRef.current = setTimeout(() => setPopupScan(null), 5000);
    };

    const handleManualScanSubmit = (e) => {
        e.preventDefault();
        if (manualScanId) {
            processScan(manualScanId);
            setManualScanId('');
            setManualScanOpen(false);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'Enter') {
                if (scanBuffer) processScan(scanBuffer);
                setScanBuffer('');
            } else {
                setScanBuffer((prev) => prev + e.key);
                if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
                scanTimeoutRef.current = setTimeout(() => setScanBuffer(''), 200);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
        };
    }, [scanBuffer]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Data panel: pengumuman, jadwal hari ini, galeri ─────────────────────
    useEffect(() => {
        const fetchData = async () => {
            const configs = await fetchAppConfigs(['tv_config', 'logoUrl']).catch(() => ({}));
            if (configs.tv_config) setConfig((prev) => ({ ...prev, ...configs.tv_config }));
            if (typeof configs.logoUrl === 'string' && configs.logoUrl.trim()) setLogoUrl(configs.logoUrl.trim());

            const ann = await fetchPublishedAnnouncements({ limit: 8 }).catch(() => []);
            setAnnouncements(Array.isArray(ann) ? ann : []);

            const media = await fetchWebsiteContentMap({ keys: ['galleryPhotos'] }).catch(() => ({}));
            const foto = Array.isArray(media?.galleryPhotos) ? media.galleryPhotos.filter((f) => f?.url) : [];
            setGallery(foto);

            // Jadwal hari ini: periode aktif → seluruh jadwalnya → saring hari ini.
            // getDay() 1..6 = Senin..Sabtu, cocok langsung dengan kolom `hari`.
            const jsDay = new Date().getDay();
            const hariIni = jsDay === 0 ? null : jsDay;
            if (hariIni) {
                const periodeList = await fetchPeriodeList().catch(() => []);
                const aktif = (periodeList || []).find((p) => p.is_active);
                if (aktif) {
                    const rows = await fetchJadwalList({ periodeId: aktif.id }).catch(() => []);
                    const hariIniRows = (rows || [])
                        .filter((r) => Number(r.hari) === hariIni)
                        .sort((a, b) => String(a.jam_mulai).localeCompare(String(b.jam_mulai)) || String(a.nama_kelas).localeCompare(String(b.nama_kelas)));
                    setSchedule(hariIniRows);
                } else {
                    setSchedule([]);
                }
            } else {
                setSchedule([]);
            }
        };
        fetchData();
        const dataInterval = setInterval(fetchData, 60000);
        return () => clearInterval(dataInterval);
    }, []);

    // Rotasi antar panel sesuai durasi tiap panel.
    useEffect(() => {
        if (enabledPanels.length <= 1) return undefined;
        const key = activePanel.key;
        const duration = (config.durations?.[key] || DEFAULT_DURATIONS[key] || config.transitionTime || 18) * 1000;
        const timer = setTimeout(() => setActiveIndex((prev) => (prev + 1) % enabledPanels.length), duration);
        return () => clearTimeout(timer);
    }, [activeIndex, activePanel.key, config.durations, config.transitionTime, enabledPanels.length]);

    // Slideshow galeri.
    useEffect(() => {
        if (activePanel.key !== 'galeri' || gallery.length <= 1) return undefined;
        const timer = setInterval(() => setGalleryIndex((prev) => (prev + 1) % gallery.length), 6000);
        return () => clearInterval(timer);
    }, [activePanel.key, gallery.length]);

    const EmptyState = ({ icon: Icon, text }) => (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-50">
            <Icon className="w-20 h-20" />
            <p className="text-2xl font-bold uppercase tracking-widest text-center px-8">{text}</p>
        </div>
    );

    const renderPanel = () => {
        if (activePanel.key === 'pengumuman') {
            if (announcements.length === 0) return <EmptyState icon={Megaphone} text="Belum ada pengumuman" />;
            return (
                <div className="h-full p-8 flex flex-col gap-4 overflow-hidden">
                    <h2 className="text-3xl font-black flex items-center gap-3 text-blue-700 dark:text-blue-400 shrink-0"><Megaphone className="w-8 h-8" /> Pengumuman</h2>
                    <div className="flex-1 flex flex-col gap-3 overflow-hidden">
                        {announcements.slice(0, 5).map((a) => {
                            const badge = PRIORITY_BADGE[a.priority] || PRIORITY_BADGE.normal;
                            return (
                                <div key={a.id} className="rounded-2xl border bg-white/80 dark:bg-slate-900/60 p-5 shadow-sm flex flex-col gap-1.5">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <span className={`px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${badge.cls}`}>{badge.label}</span>
                                        <span className="text-sm text-muted-foreground font-medium">{a.date}</span>
                                    </div>
                                    <h3 className="text-2xl font-bold leading-tight">{a.title}</h3>
                                    {a.summary && <p className="text-lg text-muted-foreground line-clamp-2">{a.summary}</p>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }

        if (activePanel.key === 'jadwal') {
            const hariLabel = getHariLabel(new Date().getDay() === 0 ? 7 : new Date().getDay());
            if (schedule.length === 0) return <EmptyState icon={CalendarDays} text={`Tidak ada jadwal untuk hari ini`} />;
            return (
                <div className="h-full p-8 flex flex-col gap-4 overflow-hidden">
                    <h2 className="text-3xl font-black flex items-center gap-3 text-emerald-700 dark:text-emerald-400 shrink-0"><CalendarDays className="w-8 h-8" /> Jadwal Pelajaran &mdash; {hariLabel}</h2>
                    <div className="flex-1 overflow-hidden">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {schedule.slice(0, 12).map((r) => (
                                <div key={r.id} className="rounded-xl border bg-white/80 dark:bg-slate-900/60 p-4 shadow-sm flex items-center gap-4">
                                    <div className="flex flex-col items-center justify-center bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3 py-2 min-w-[110px]">
                                        <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mb-1" />
                                        <span className="text-sm font-mono font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">{formatJamRange(r.jam_mulai, r.jam_selesai)}</span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xl font-bold truncate">{r.mata_pelajaran_nama}</p>
                                        <p className="text-sm text-muted-foreground truncate">{r.nama_kelas}{r.guru_nama ? ` · ${r.guru_nama}` : ''}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );
        }

        // galeri
        if (gallery.length === 0) return <EmptyState icon={ImageOff} text="Belum ada foto galeri" />;
        const foto = gallery[galleryIndex % gallery.length];
        return (
            <div className="h-full relative flex items-center justify-center bg-black">
                <AnimatePresence mode="wait">
                    <motion.img
                        key={galleryIndex}
                        src={foto.url}
                        alt={foto.caption || 'Galeri sekolah'}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6 }}
                        className="max-w-full max-h-full object-contain"
                    />
                </AnimatePresence>
                {foto.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-8 text-white">
                        <p className="text-2xl font-bold">{foto.caption}</p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <>
            <Helmet><title>Mode TV &mdash; {identity.name}</title></Helmet>
            <div className={`fixed inset-0 z-50 ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900'} overflow-hidden flex flex-col transition-colors duration-500`}>
                <div className={`h-20 shrink-0 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border-b flex justify-between items-center px-8 shadow-lg z-20`}>
                    <div className="flex items-center gap-4">
                        {logoUrl
                            ? <img src={logoUrl} onError={() => setLogoUrl('')} alt="Logo" className="h-14 w-14 rounded-2xl bg-white/95 p-1.5 object-contain shadow-lg ring-1 ring-blue-500/20" />
                            : <div className="h-14 w-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl font-black shadow-lg">{(identity.name || 'S')[0]}</div>}
                        <div>
                            <h1 className="text-2xl font-bold tracking-wider">{identity.name}</h1>
                            <p className={`text-xs tracking-[0.3em] font-mono ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>PAPAN INFORMASI</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" onClick={() => setManualScanOpen(true)} className="hidden md:flex" title="Input Manual"><Keyboard className="w-5 h-5" /></Button>
                        <Button variant="outline" size="icon" onClick={toggleTheme}>{isDark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-slate-600" />}</Button>
                        <div className={`w-px h-8 ${isDark ? 'bg-slate-700' : 'bg-slate-300'} mx-2`}></div>
                        <DigitalClock size="small" showSeconds={config.showSeconds} colorClass={isDark ? 'text-white' : 'text-slate-800'} />
                        <div onClick={(e) => { e.stopPropagation(); kembali(); }} className="ml-4 opacity-50 hover:opacity-100 cursor-pointer p-2" title="Keluar mode TV"><XCircle className="w-8 h-8" /></div>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden relative bg-gradient-to-br from-slate-100 to-white dark:from-slate-950 dark:to-black">
                    <AnimatePresence>{popupScan && <PopupScanResult scan={popupScan} />}</AnimatePresence>
                    <AnimatePresence mode="wait">
                        <motion.div key={activePanel.key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full relative z-10 flex flex-col">
                            {renderPanel()}
                        </motion.div>
                    </AnimatePresence>
                </div>

                <div className={`h-12 shrink-0 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border-t flex justify-center items-center gap-4 overflow-x-auto z-20`}>
                    {enabledPanels.map((p, idx) => (
                        <div key={p.key} onClick={() => setActiveIndex(idx)} className={`cursor-pointer flex items-center gap-2 px-4 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap hover:scale-110 ${activePanel.key === p.key ? (isDark ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-400' : 'bg-blue-50 text-blue-700 ring-1 ring-blue-700') : 'opacity-30 hover:opacity-100'}`}>
                            <p.icon className="w-3.5 h-3.5" />{p.label}
                        </div>
                    ))}
                </div>

                <Dialog open={manualScanOpen} onOpenChange={setManualScanOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader><DialogTitle>Input Manual ID</DialogTitle></DialogHeader>
                        <form onSubmit={handleManualScanSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Input placeholder="Masukkan ID/NIS/Tag..." value={manualScanId} onChange={(e) => setManualScanId(e.target.value)} autoFocus />
                                <p className="text-xs text-muted-foreground">Gunakan bila pemindai kartu tidak merespon.</p>
                            </div>
                            <div className="flex justify-end"><Button type="submit">Proses</Button></div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
};

export default TvDisplayPage;
