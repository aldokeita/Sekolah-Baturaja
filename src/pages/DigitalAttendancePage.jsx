import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fetchAllClassMutations, fetchClassList, fetchGuruByRfid, fetchSantriByRfid } from '@/lib/dataMasterAdapters';
import { createMmqAttendance, fetchMmqAttendance, fetchMmqSchedules, saveMmqAttendance } from '@/lib/mmqAdapters';
import { fetchHafalanProgress, fetchSantriCharacterStrengths } from '@/lib/academicAdapters';
import { fetchWebsiteContentMap } from '@/lib/publicContentAdapters';
import { incrementSantriPoints } from '@/lib/gamificationAdapters';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Fingerprint,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  ArrowLeft,
  Activity,
  Sun,
  Moon,
  Tv,
  Gamepad2,
  Crown,
  Globe2,
  Book,
  Users,
  Briefcase,
  Star,
  ArrowRight,
  Dices,
  Trophy,
  Library,
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useTheme } from '@/contexts/ThemeContext';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import MediaPlayerWidget from '@/components/MediaPlayerWidget';
import {
  DEFAULT_SESSION_TIMES,
  buildSessionStartTimestamp,
  calculateTimeDifference,
  determineAttendanceStatus,
  evaluateAttendanceWindow,
  getJakartaTimeString,
  normalizeAttendanceSessionName,
  resolveSantriAttendanceSession,
} from '@/utils/AttendanceStatusLogic';
import { enableGameFeatures } from '@/lib/featureFlags';
import {
  buildSantriAttendancePayload,
  createAttendance,
  fetchAttendance,
  fetchAttendanceCount,
  fetchAttendanceDates,
  fetchCalendarEvents,
  getAttendanceErrorMessage,
  getLocalDateString,
  getSantriAttendanceSuccessMessage,
  getSantriSession,
  isActiveSantri,
  isExplicitAbsentAttendance,
  normalizeRfidTag,
  updateAttendance,
} from '@/lib/attendanceAdapters';
import { resolveAvatarUrl } from '@/lib/storageAdapters';
import AttendanceProfileCard from '@/components/dashboard/shared/AttendanceProfileCard';
import { useAttendanceSessionConfiguration } from '@/hooks/useAttendanceSessionConfiguration';
import { resolveSantriLevel } from '@/lib/santriLevel';
import useSchoolIdentity from '@/hooks/useSchoolIdentity';

// --- Data (unchanged) ---
const guruQuotes = [
    "Mengajar adalah belajar dua kali.",
    "Guru terbaik mengajar dari hati, bukan hanya dari buku.",
    "Pendidikan adalah senjata paling ampuh untuk mengubah dunia.",
    "Satu anak, satu guru, satu pena bisa mengubah dunia.",
    "Kesabaran Anda adalah jembatan masa depan mereka.",
    "Lelahmu hari ini akan menjadi saksi amal jariyahmu nanti.",
    "Mendidik pikiran tanpa mendidik hati adalah bukan pendidikan sama sekali.",
    "Jadilah inspirasi sebelum mengajarkan materi."
];

const motivationalMessages = [
    "Semangat belajar mengajinya ya!",
    "Jadilah anak yang taat bagi kedua orang tua!",
    "Menuntut ilmu itu wajib bagi setiap muslim.",
    "Barang siapa menempuh jalan mencari ilmu, Allah mudahkan jalan ke surga.",
    "Hafalanmu adalah cahayamu.",
    "Teruslah berbuat baik kepada orang tua.",
    "Jangan lupa sholat 5 waktu ya!",
    "Ilmu adalah harta yang tidak akan habis.",
    "Hafalanmu hari ini adalah tabungan untuk surgamu nanti. Semangat!",
    "Jangan takut salah baca ya, Allah tetap akan catat usahamu kok.",
    "Lelahmu dalam belajar itu bernilai jihad lho. Keren!",
    "Anak sholeh/sholehah adalah harta terindah Ayah Bunda.",
    "Jadilah alasan Ayah dan Bunda tersenyum hari ini.",
    "Bersih itu ciri orang beriman. Sampahnya dibuang di tempatnya ya.",
    "Jujur itu hebat! Murid yang jujur dipercaya banyak orang.",
    "Siapa yang bersungguh-sungguh, pasti akan berhasil. Man Jadda Wajada!",
    "Hari ini pembelajar, besok jadi pemimpin. Aamiin!",
    "Absen diterima! Silakan masuk, pintu ilmu sudah terbuka.",
    "Terima kasih sudah hadir. Kehadiranmu sangat berarti buat kakak."
];

const adultQuotes = [
    "Tak ada kata terlambat untuk belajar Al-Qur'an.",
    "Sebaik-baik kalian adalah yang belajar Al-Qur'an dan mengajarkannya.",
    "Lelah bekerja seharian, sembuhkan dengan lantunan ayat suci.",
    "Setiap huruf yang dibaca adalah pahala yang berlipat ganda.",
    "Kesabaran dunia jangan sampai melalaikan akhirat.",
    "Istiqomah itu berat, tapi hadiahnya surga.",
    "Allah melihat usahamu, bukan hanya hasilmu.",
    "Membaca Al-Qur'an dengan terbata-bata pun mendapat dua pahala."
];

const getCurrentMonthDateRange = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return {
        start: firstDay.toLocaleDateString('en-CA'),
        end: nextMonth.toLocaleDateString('en-CA'),
    };
};

const getSantriMonthlyAttendanceStats = async (santriId) => {
    if (!santriId) return { present: 0, late: 0, absent: 0 };

    const { start, end } = getCurrentMonthDateRange();
    const now = new Date();
    const selectedYear = now.getFullYear();
    const selectedMonth = now.getMonth();
    const today = new Date(selectedYear, selectedMonth, now.getDate());
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const endInclusive = new Date(selectedYear, selectedMonth, lastDay).toLocaleDateString('en-CA');

    // date_to is inclusive on the API, so pass endInclusive rather than the
    // exclusive `end` the old .lt() filter used.
    const [attendanceRows, holidayRows] = await Promise.all([
      fetchAttendance({ user_id: santriId, date_from: start, date_to: endInclusive, limit: 500 }).catch(() => null),
      fetchCalendarEvents(start, endInclusive).catch(() => null),
    ]);

    if (!attendanceRows || !holidayRows) {
        return { present: 0, late: 0, absent: 0 };
    }
    const attendanceResult = { data: attendanceRows };

    const holidaySet = new Set(holidayRows.map(item => item.date));
    const activeDaysUntilToday = [];

    for (let day = 1; day <= lastDay; day++) {
        const date = new Date(selectedYear, selectedMonth, day);
        const dateStr = date.toLocaleDateString('en-CA');
        const dayOfWeek = new Date(Date.UTC(selectedYear, selectedMonth, day)).getUTCDay();
        const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
        const isPastOrToday = date <= today;

        if (isWeekday && isPastOrToday && !holidaySet.has(dateStr)) {
            activeDaysUntilToday.push(dateStr);
        }
    }

    const activeDaySet = new Set(activeDaysUntilToday);
    const presentDateSet = new Set();
    const lateDateSet = new Set();

    (attendanceResult.data || []).forEach(row => {
        const date = String(row.attendance_date || '').split('T')[0];
        if (!date || !activeDaySet.has(date)) return;

        if (row.status === 'Terlambat') {
            lateDateSet.add(date);
            presentDateSet.delete(date);
            return;
        }

        if (!lateDateSet.has(date) && ['Hadir', 'Tepat Waktu'].includes(row.status)) {
            presentDateSet.add(date);
        }
    });

    const present = presentDateSet.size;
    const late = lateDateSet.size;
    const attended = new Set([...presentDateSet, ...lateDateSet]).size;
    const absent = Math.max(activeDaysUntilToday.length - attended, 0);

    return { present, late, absent };
};

const getSantriLearningHighlights = async (santriId) => {
    if (!santriId) {
        return { hafalanCount: 0, characterStrength: null, strongestHafalanCategory: null };
    }

    const [progressRows, strengthRows] = await Promise.all([
        fetchHafalanProgress([santriId]).catch(() => null),
        fetchSantriCharacterStrengths(santriId).catch(() => null),
    ]);

    // The old query took the most recently selected strength; the profile
    // endpoint returns them ordered the same way, so the first row still wins.
    const strengthResult = { data: (strengthRows || [])[0] || null };
    const rows = progressRows || [];
    const scoredRows = rows.map((row) => {
        const rawScore = Number(row.score ?? row.nilai);
        const score = Number.isFinite(rawScore) && rawScore >= 1 && rawScore <= 4
            ? rawScore
            : row.status === 'lulus' ? 4 : null;
        return { ...row, score };
    });
    const hafalanCount = scoredRows.filter((row) => row.status === 'lulus' || row.score === 4).length;
    const categoryStats = new Map();

    scoredRows.forEach((row) => {
        const category = String(row.category || '').trim();
        if (!category || row.score === null) return;
        const current = categoryStats.get(category) || { category, total: 0, assessed: 0, completed: 0 };
        current.total += row.score;
        current.assessed += 1;
        if (row.status === 'lulus' || row.score === 4) current.completed += 1;
        categoryStats.set(category, current);
    });

    const strongest = [...categoryStats.values()]
        .map((item) => ({ ...item, average: item.total / item.assessed }))
        .sort((left, right) => (
            right.average - left.average
            || right.completed - left.completed
            || right.assessed - left.assessed
            || left.category.localeCompare(right.category, 'id')
        ))[0];
    const averageLabel = strongest
        ? strongest.average.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
        : null;

    return {
        hafalanCount,
        characterStrength: strengthResult.error ? null : (strengthResult.data?.strength_key || null),
        strongestHafalanCategory: strongest ? `${strongest.category} · ${averageLabel}` : null,
    };
};

// --- Business logic (unchanged) ---
const canCheckIn = (sesi, userRole, isPentashih = false, timestamp = new Date(), sessionTimes = DEFAULT_SESSION_TIMES) => {
    if (isPentashih) return { can: true, message: '' };

    const today = timestamp;
    const dayOfWeek = today.getDay();
    if (userRole === 'guru' && (dayOfWeek === 0 || dayOfWeek === 6)) {
      return { can: false, message: 'Absensi libur pada hari Sabtu dan Minggu.' };
    }

    const windowState = evaluateAttendanceWindow({ timestamp, sesi, sessionTimes });
    return { can: windowState.canRecord, ...windowState };
};

// --- Digital Clock Component ---
const DigitalClock = ({ showSeconds = true }) => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timerId = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  return (
    <div className="attendance-clock">
      <div className="attendance-clock__time">
        {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: showSeconds ? '2-digit' : undefined })}
      </div>
      <div className="attendance-clock__date">
        {time.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </div>
    </div>
  );
};

// --- Main Component ---
const DigitalAttendancePage = () => {
  const sekolah = useSchoolIdentity();
  const { sessionTimes } = useAttendanceSessionConfiguration();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const [rfidTag, setRfidTag] = useState('');
  const [lastScan, setLastScan] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [levelConfig, setLevelConfig] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
      let cancelled = false;
      const fetchConfig = async () => {
          const map = await fetchWebsiteContentMap({ keys: ['level_config'] }).catch(() => null);
          if (!cancelled && map?.level_config) setLevelConfig(map.level_config);
      };
      fetchConfig();

      // The kiosk stays open all day, so poll instead of the realtime channel
      // The old realtime channel A minute of staleness on level styling is fine.
      const pollId = setInterval(fetchConfig, 60_000);
      return () => {
        cancelled = true;
        clearInterval(pollId);
      };
  }, []);

  const getLevelInfo = (points = 0, gender) => {
      const defaultInfo = {
          label: 'Bronze',
          color: '#b7793f',
          badgeIcon: <Book className="w-8 h-8 text-[#b7793f]" />,
          enableGradient: true,
          cardBgColor: '#ffffff',
          textColor: '#3b82f6',
          cardBorderThickness: 8,
          avatarBorderThickness: 4,
          textGradient: true
      };

      if (!levelConfig) return defaultInfo;

      const resolvedLevel = resolveSantriLevel({ points, gender, config: levelConfig });
      const accentColor = resolvedLevel.accentColor || defaultInfo.color;
      let icon = <Book className="w-8 h-8" style={{ color: accentColor }} />;
      const levelName = String(resolvedLevel.name || '').toLowerCase();
      if (levelName.includes('diamond') || levelName.includes('mythic') || levelName.includes('mahir') || levelName.includes('legend')) {
          icon = <Crown className="w-10 h-10" style={{ color: accentColor }} />;
      } else if (levelName.includes('gold') || levelName.includes('platinum') || levelName.includes('menengah') || levelName.includes('super')) {
          icon = <Globe2 className="w-10 h-10" style={{ color: accentColor }} />;
      }

      return {
          label: resolvedLevel.name || defaultInfo.label,
          color: accentColor,
          badgeIcon: icon,
          enableGradient: resolvedLevel.enableGradient,
          cardBgColor: resolvedLevel.cardBgColor,
          textColor: resolvedLevel.textColor,
          cardBorderThickness: resolvedLevel.cardBorderThickness,
          avatarBorderThickness: resolvedLevel.avatarBorderThickness,
          textGradient: resolvedLevel.textGradient
      };
  };

  const forceFocus = () => { if (inputRef.current) { inputRef.current.focus(); } };

  useEffect(() => {
    forceFocus();
    const reFocusHandler = () => setTimeout(forceFocus, 100);
    window.addEventListener('click', reFocusHandler);
    return () => window.removeEventListener('click', reFocusHandler);
  }, [lastScan]);

  // --- processScan (ALL business logic preserved exactly) ---
  const processScan = async (tagToProcess) => {
      if (!tagToProcess || isLoading) return;
      const tag = normalizeRfidTag(tagToProcess);

      // Pentashih handling
      if (lastScan?.type === 'success' && lastScan.isPentashih && lastScan.rfid === tag) {
          setIsLoading(true);
          const history = await fetchAllClassMutations({ limit: 6 }).catch(() => []);
          setLastScan({ ...lastScan, type: 'pentashih_history', historyData: history || [] });
          setIsLoading(false); setRfidTag(''); setTimeout(forceFocus, 50); return;
      }

      // Guru Detail View handling
      if ((lastScan?.type === 'guru_info' || lastScan?.type === 'warning' || lastScan?.type === 'success') && lastScan.rfid === tag && lastScan.role === 'guru' && !lastScan.isPentashih) {
          if(!lastScan.classesData) {
             setIsLoading(true);
             const guruData = await fetchGuruByRfid(tag).catch(() => null);
             if(guruData) {
                 const classes = await fetchClassList({ id_guru: guruData.id, includeSantri: true, limit: 100 }).catch(() => []);
                 setLastScan({ ...lastScan, type: 'guru_schedule_detail', classesData: classes || [] });
             }
             setIsLoading(false);
          } else { setLastScan({ ...lastScan, type: 'guru_schedule_detail' }); }
          setRfidTag(''); setTimeout(forceFocus, 50); return;
      }

      // Re-scan confirmation handling for normal attendance
      if (lastScan?.type === 'confirmation') {
        if (tag === lastScan.rfid) {
          setIsLoading(true);
          try {
            const now = new Date();
            const nowTime = getJakartaTimeString(now);
            const timestamp = now.toISOString();

            if (lastScan.isMMQ) {
                 await saveMmqAttendance({ id: lastScan.attendanceId, check_in_timestamp: timestamp });
                 setLastScan(prev => ({ ...prev, type: 'success', time: nowTime, message: 'Absensi MMQ diperbarui!', quote: lastScan.pendingQuote }));
            } else {
                const levelInfo = (lastScan.role === 'santri' && lastScan.kategori !== 'Dewasa') ? getLevelInfo(lastScan.points, lastScan.gender) : null;
                setLastScan(prev => ({ ...prev, type: 'success', levelInfo, message: 'Absensi sudah tercatat.', quote: lastScan.pendingQuote }));
            }
          } catch (err) { setLastScan({ type: 'error', message: err.message, name: 'Error' }); }
          finally { setIsLoading(false); setRfidTag(''); setTimeout(forceFocus, 50); return; }
        } else { setLastScan(null); setRfidTag(''); return; }
      }

      setIsLoading(true);
      setLastScan({ type: 'scanning' });

      try {
        await new Promise(resolve => setTimeout(resolve, 300));
        const todayDate = new Date();
        const todayStr = getLocalDateString(todayDate);

        let user = null, userRole = '', sesiUser = '', kategori = '', guruClasses = [];
        let guruData = await fetchGuruByRfid(tag).catch(() => null);

        // Check MMQ Schedule if it's a Guru
        if (guruData) {
            const foto_url = await resolveAvatarUrl({
                ownerType: 'guru',
                ownerId: guruData.id,
                fallbackUrl: guruData.foto_url,
            });
            user = { ...guruData, foto_url }; userRole = 'guru';
            const todayDay = todayDate.getDay();
            const mmqSchedules = await fetchMmqSchedules().catch(() => []);
            const mmqSchedule = (mmqSchedules || []).find(
                (s) => s.is_active && Number(s.day_of_week) === todayDay
            ) || null;

            if (mmqSchedule) {
                try {
                    const timestamp = new Date().toISOString();
                    const sessionStart = `${todayStr}T${mmqSchedule.start_time}+07:00`;

                    let rawStatus = determineAttendanceStatus(timestamp, sessionStart);
                    const timeDiff = calculateTimeDifference(timestamp, sessionStart);

                    const allowedStatuses = ['Hadir', 'Terlambat', 'Tidak Hadir', 'Alpha', 'Izin', 'Sakit'];
                    let validStatus = 'Hadir';

                    if (rawStatus === 'Terlambat') validStatus = 'Terlambat';
                    else if (['Tidak Hadir', 'Alpha', 'Ghaib'].includes(rawStatus)) validStatus = 'Tidak Hadir';
                    else if (['Tepat Waktu', 'Hadir'].includes(rawStatus)) validStatus = 'Hadir';
                    else if (rawStatus === 'Izin') validStatus = 'Izin';
                    else if (rawStatus === 'Sakit') validStatus = 'Sakit';

                    const isValidUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

                    if (!allowedStatuses.includes(validStatus)) {
                        throw new Error(`Sistem Error: Status absensi '${validStatus}' tidak diizinkan.`);
                    }

                    if (!mmqSchedule.id) {
                        const fallbackSchedule = (mmqSchedules || []).find((s) => s.is_active && s.id);
                        if (fallbackSchedule?.id) {
                            mmqSchedule.id = fallbackSchedule.id;
                        } else {
                            throw new Error("Gagal: Sesi MMQ untuk hari ini tidak ditemukan di database.");
                        }
                    }

                    if (!isValidUUID(mmqSchedule.id)) {
                        throw new Error("Gagal: Format ID Jadwal MMQ tidak valid.");
                    }

                    if (!user.id || !isValidUUID(user.id)) {
                        throw new Error("Gagal: Format ID Guru tidak valid.");
                    }

                    const todayMmq = await fetchMmqAttendance({ date: todayStr }).catch(() => {
                        throw new Error("Gagal memeriksa status absensi sebelumnya.");
                    });
                    const existingMMQ = (todayMmq || []).find(
                        (row) => row.schedule_id === mmqSchedule.id && row.guru_id === user.id
                    ) || null;

                    const randomQuote = adultQuotes[Math.floor(Math.random() * adultQuotes.length)];

                    if (existingMMQ) {
                        setLastScan({
                            type: 'confirmation',
                            role: 'guru',
                            isMMQ: true,
                            message: 'Konfirmasi Kehadiran MMQ',
                            name: user.nama,
                            photo: user.foto_url,
                            rfid: tag,
                            attendanceId: existingMMQ.id,
                            pendingQuote: randomQuote
                        });
                        return;
                    }

                    const insertPayload = {
                        guru_id: user.id,
                        schedule_id: mmqSchedule.id,
                        attendance_date: todayStr,
                        check_in_timestamp: timestamp,
                        status: validStatus
                    };

                    try {
                        await createMmqAttendance(insertPayload);
                    } catch (mmqError) {
                        let friendlyMessage = "Gagal menyimpan absensi MMQ ke database.";
                        if (String(mmqError?.message || '').includes("mmq_attendance_status_check")) {
                            friendlyMessage = `Gagal: Status "${validStatus}" tidak sesuai dengan aturan database. Hubungi admin.`;
                        } else if (mmqError?.code === '23505' || String(mmqError?.message || '').includes('duplicate')) {
                            friendlyMessage = 'Guru sudah tercatat hadir pada jadwal MMQ ini.';
                        }
                        throw new Error(friendlyMessage);
                    }

                    let msg = `Absensi MMQ: ${validStatus}`;
                    if (validStatus === 'Terlambat') msg += ` (${timeDiff} menit)`;

                    setLastScan({
                        type: 'mmq_success',
                        name: user.nama,
                        photo: user.foto_url,
                        status: validStatus,
                        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                        message: msg,
                        quote: randomQuote
                    });
                } catch (err) {
                    setLastScan({
                        type: 'error',
                        message: err.message || "Terjadi kesalahan sistem saat absensi MMQ.",
                        name: user.nama || "Error",
                        photo: user?.foto_url
                    });
                }
                return;
            }

            // Normal Guru Attendance Session Assignment
            const assignedClasses = await fetchClassList({
              id_guru: user.id,
              is_active: true,
              includeSantri: true,
              limit: 200,
            }).catch(() => []);
            guruClasses = assignedClasses || [];
            const assignedSessions = [...new Set(guruClasses.map(item => normalizeAttendanceSessionName(item.sesi)).filter(Boolean))];
            const matchingSessions = assignedSessions
              .map(sesi => ({ sesi, window: evaluateAttendanceWindow({ timestamp: todayDate, dateStr: todayStr, sesi, sessionTimes }) }))
              .filter(item => item.window.canRecord)
              .sort((a, b) => new Date(b.window.openAt) - new Date(a.window.openAt));
            sesiUser = matchingSessions[0]?.sesi || '';

            if (!sesiUser && assignedSessions.length > 0) {
              const priorRows = await fetchAttendance({
                user_id: user.id,
                date: todayStr,
                sesi: assignedSessions.join(','),
              }).catch(() => []);
              const previousAttendance = (priorRows || [])[0] || null;

              if (previousAttendance) {
                setLastScan({
                  type: 'success',
                  role: 'guru',
                  name: user.nama,
                  photo: user.foto_url,
                  rfid: tag,
                  sesi: normalizeAttendanceSessionName(previousAttendance.sesi),
                  time: previousAttendance.check_in_time,
                  status: previousAttendance.status,
                  message: 'Absensi sudah tercatat.',
                });
                return;
              }
            }
        } else {
          let santriData = await fetchSantriByRfid(tag).catch(() => null);
          if (santriData) {
              const foto_url = await resolveAvatarUrl({
                  ownerType: 'santri',
                  ownerId: santriData.id,
                  avatarPath: santriData.avatar_path,
                  fallbackUrl: santriData.foto_url,
              });
              santriData = { ...santriData, foto_url };
              if (!isActiveSantri(santriData.status)) {
                  setLastScan({ type: 'warning', message: 'Murid nonaktif tidak dapat dicatat absensinya.', name: santriData.nama_lengkap, photo: santriData.foto_url });
                  return;
              }
              user = santriData; userRole = 'santri'; kategori = santriData.kategori || 'Anak';
              sesiUser = getSantriSession(santriData);
          }
        }

        if (!user) { setLastScan({ type: 'error', message: 'RFID tidak dikenal. Tidak ada absensi yang dibuat.', name: 'Tidak Dikenal' }); return; }

        const isPentashih = userRole === 'guru' && ((user.roles && user.roles.includes('Pentashih')) || (user.jabatan && user.jabatan.toLowerCase().includes('pentashih')));
        if (userRole === 'guru' && !sesiUser && !isPentashih) {
              // classesForInfo, not guruClasses: redeclaring the outer binding in
              // this block put the `guruClasses.length` read above in its TDZ.
              const [classesForInfo, attendanceCountResult, historyDates] = await Promise.all([
                  guruClasses.length > 0
                    ? Promise.resolve(guruClasses)
                    : fetchClassList({ id_guru: user.id, includeSantri: true, limit: 200 }).catch(() => []),
                  fetchAttendanceCount(user.id, true).catch(() => null),
                  fetchAttendanceDates(user.id, 30).catch(() => [])
              ]);
              const uniqueSessions = [...new Set((classesForInfo || []).map(c => c.sesi))];
              const scheduledSessionsCount = uniqueSessions.length;
              const totalMonthAttendance = attendanceCountResult?.count || 0;
              const hoursTaught = (totalMonthAttendance * 1.25).toFixed(2);
              const uniqueDates = [...new Set((historyDates || []).map(h => h.attendance_date || h))];
              let streak = 0;
              const checkDate = new Date(); checkDate.setDate(checkDate.getDate() - 1);
              while (true) {
                  const dateStr = checkDate.toLocaleDateString('en-CA');
                  if (uniqueDates.includes(dateStr)) { streak++; checkDate.setDate(checkDate.getDate() - 1); }
                  else { const day = checkDate.getDay(); if (day === 0 || day === 6) { checkDate.setDate(checkDate.getDate() - 1); continue; } break; }
              }
              if (totalMonthAttendance > 0) streak++;
              const timeMap = { 'Pagi': 8, 'Siang': 14, 'Sore': 16, 'Malam': 18 };
              const sortedSessions = uniqueSessions.sort((a, b) => (timeMap[a] || 0) - (timeMap[b] || 0));
              const currentHour = new Date().getHours();
              let nextSession = sortedSessions.find(s => (timeMap[s] || 0) > currentHour);
              if (!nextSession && sortedSessions.length > 0) { nextSession = `${sortedSessions[0]} (Besok)`; } else if (!nextSession) { nextSession = "-"; } else { const startTime = sessionTimes[nextSession]?.start || ''; nextSession = `${nextSession} (${startTime})`; }
              const quote = guruQuotes[Math.floor(Math.random() * guruQuotes.length)];
              setLastScan({ type: 'guru_info', rfid: tag, role: 'guru', name: user.nama, photo: user.foto_url, quote, classesData: classesForInfo || [], roles: user.roles || [], jabatan: user.jabatan, gender: user.jenis_kelamin || 'Laki-laki', no_hp: user.no_hp, stats: { sessions: scheduledSessionsCount, hours: hoursTaught, streak: streak, nextSession }});
              return;
        }

        // The list endpoint returns newest-first; for santri we want the first
        // check-in of the day, so sort ascending client-side.
        const existingRows = await fetchAttendance({
            user_id: user.id,
            date: todayStr,
            ...(userRole === 'guru' && { sesi: sesiUser }),
        }).catch(() => []);
        const existingAttendance = userRole === 'guru'
            ? (existingRows || [])[0] || null
            : [...(existingRows || [])].sort((a, b) => (
                String(a.check_in_timestamp || a.created_at || '').localeCompare(
                    String(b.check_in_timestamp || b.created_at || ''))
              ))[0] || null;

        const isAdult = kategori === 'Dewasa';
        const randomQuote = (userRole === 'guru' || isAdult) ? (isAdult ? adultQuotes[Math.floor(Math.random() * adultQuotes.length)] : guruQuotes[Math.floor(Math.random() * guruQuotes.length)]) : motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
        const successData = { type: 'success', role: userRole, kategori, name: user.nama || user.nama_lengkap, photo: user.foto_url, quote: randomQuote, points: user.points, jilid: user.jilid, jabatan: user.jabatan, no_hp: user.no_hp, rfid: tag, gender: user.jenis_kelamin, isPentashih, sesi: sesiUser };

        const shouldRestoreAbsentAttendance = userRole === 'santri'
          && existingAttendance
          && isExplicitAbsentAttendance(existingAttendance.status);

        if (existingAttendance && !shouldRestoreAbsentAttendance) {
          if (userRole === 'santri') {
             const levelInfo = (!isAdult) ? getLevelInfo(user.points, user.jenis_kelamin) : null;
             const [monthlyStats, learningHighlights] = await Promise.all([
                 getSantriMonthlyAttendanceStats(user.id),
                 getSantriLearningHighlights(user.id),
             ]);
             setLastScan({
                ...successData,
                 message: 'Absensi sudah tercatat.',
                time: existingAttendance.check_in_time,
                status: existingAttendance.status,
                levelInfo,
                monthlyStats,
                ...learningHighlights
             });
             return;
          }
          setLastScan({ ...successData, message: 'Absensi sudah tercatat.', time: existingAttendance.check_in_time, status: existingAttendance.status });
          return;
        }

        const checkInStatus = userRole === 'santri'
          ? resolveSantriAttendanceSession({
              timestamp: todayDate,
              dateStr: todayStr,
              assignedSession: sesiUser,
              sessionTimes,
            })
          : canCheckIn(sesiUser, userRole, isPentashih, todayDate, sessionTimes);
        if (!checkInStatus.can) {
          setLastScan({ type: 'warning', message: checkInStatus.message, name: user.nama || user.nama_lengkap, photo: user.foto_url, role: userRole, rfid: tag });
          return;
        }

        const timestamp = todayDate.toISOString();
        const attendanceStatusText = checkInStatus.status || 'Hadir';

        const newAttendance = userRole === 'santri'
          ? buildSantriAttendancePayload({
              santri: user,
              timestamp: todayDate,
              status: attendanceStatusText,
              attendedSession: checkInStatus.attendedSession,
            })
          : {
              user_id: user.id,
              role: userRole,
              attendance_date: todayStr,
              check_in_time: getJakartaTimeString(new Date(timestamp)),
              check_in_timestamp: timestamp,
              class_id: null,
              sesi: sesiUser || (isPentashih ? 'Flex' : 'Pagi'),
              status: attendanceStatusText,
              source: 'rfid',
          };
        let insertError = null;
        try {
          if (shouldRestoreAbsentAttendance) {
            await updateAttendance(existingAttendance.id, {
              check_in_time: newAttendance.check_in_time,
              check_in_timestamp: newAttendance.check_in_timestamp,
              class_id: newAttendance.class_id,
              attended_session: newAttendance.attended_session,
              status: newAttendance.status,
              source: 'rfid',
            });
          } else {
            await createAttendance(newAttendance);
          }
        } catch (err) {
          insertError = err;
        }

        if (insertError) { setLastScan({ type: 'error', message: getAttendanceErrorMessage(insertError), name: user.nama || user.nama_lengkap, photo: user.foto_url }); }
        else {
          let newPoints = user.points || 0;
          if (userRole === 'santri' && !isAdult && attendanceStatusText === 'Hadir' && !shouldRestoreAbsentAttendance) {
            // Points are a bonus, not part of the attendance record — a failure
            // here must not turn a saved check-in into an error screen.
            const awarded = await incrementSantriPoints(user.id, 1).then(() => true).catch(() => false);
            if (awarded) newPoints += 1;
          }
          const levelInfo = (userRole === 'santri' && !isAdult) ? getLevelInfo(newPoints, user.jenis_kelamin) : null;
          const [monthlyStats, learningHighlights] = userRole === 'santri'
            ? await Promise.all([
                getSantriMonthlyAttendanceStats(user.id),
                getSantriLearningHighlights(user.id),
              ])
            : [undefined, {}];
          let adultStats = null;
          if (isAdult) {
              const totals = await fetchAttendanceCount(user.id).catch(() => null);
              const daysCount = totals?.count || 0;
              adultStats = { daysStudied: daysCount || 1, timesStudied: daysCount || 1 };
          }
          let guruStats = null;
          if (userRole === 'guru' && !isPentashih) {
             const [monthTotals, historyDates] = await Promise.all([
               fetchAttendanceCount(user.id, true).catch(() => null),
               fetchAttendanceDates(user.id, 30).catch(() => []),
             ]);
             const hoursTaught = ((monthTotals?.count || 1) * 1.25).toFixed(2);
             const uniqueDates = [...new Set((historyDates || []).map(h => h.attendance_date || h))];
              let streak = 0;
              const checkDate = new Date(); checkDate.setDate(checkDate.getDate() - 1);
              while (true) {
                  const dateStr = checkDate.toLocaleDateString('en-CA');
                  if (uniqueDates.includes(dateStr)) { streak++; checkDate.setDate(checkDate.getDate() - 1); }
                  else { const day = checkDate.getDay(); if (day === 0 || day === 6) { checkDate.setDate(checkDate.getDate() - 1); continue; } break; }
              }
              streak++;
              guruStats = { hours: hoursTaught, streak, session: sesiUser };
          }
          setLastScan({
            ...successData,
            message: userRole === 'santri'
              ? getSantriAttendanceSuccessMessage({ assignedSession: sesiUser, attendedSession: newAttendance.attended_session })
              : `Absensi ${isPentashih ? '' : `sesi ${sesiUser}`} berhasil!`,
            time: newAttendance.check_in_time,
            status: newAttendance.status,
            points: newPoints,
            levelInfo,
            monthlyStats,
            ...learningHighlights,
            adultStats,
            guruStats,
          });
        }
      } finally { setIsLoading(false); setRfidTag(''); setTimeout(forceFocus, 50); }
  };

  const handleRfidSubmit = async e => { e.preventDefault(); processScan(rfidTag); };

  // --- Scan Result Component (modernized) ---
  const ScanResult = ({ scan }) => {
    // Processing state
    if (scan?.type === 'scanning') {
      return (
        <div className="attendance-status-processing" role="status" aria-live="polite" aria-label="Sedang memproses">
          <div className="attendance-status-processing__ring">
            <div className="attendance-status-processing__ring-outer" />
            <div className="attendance-status-processing__ring-inner" />
            <Fingerprint className="w-12 h-12" style={{ color: 'hsl(var(--att-accent))' }} />
          </div>
          <p className="attendance-status-processing__text">MEMPROSES DATA</p>
        </div>
      );
    }

    // Ready state (no scan)
    if (!scan) {
      return (
        <div className="attendance-status-ready" aria-label="Siap memindai">
          <Fingerprint className="attendance-status-ready__icon" />
          <p className="attendance-status-ready__text">SIAP MEMINDAI</p>
        </div>
      );
    }

    // MMQ Success
    if (scan.type === 'mmq_success') {
      return (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="attendance-result" role="status" aria-live="polite">
          <AttendanceProfileCard
            variant="teacher"
            name={scan.name}
            photo={scan.photo}
            status={scan.status === 'Terlambat' ? 'Terlambat' : 'Hadir'}
            time={scan.time}
            message={scan.message}
            quote={scan.quote}
            showSuccessBadge
          />
        </motion.div>
      );
    }

    // Confirmation
    if (scan.type === 'confirmation') {
      return (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="attendance-result" role="status" aria-live="polite">
          <div className="attendance-result-card attendance-result-card--info">
            {scan.isMMQ && (
              <div className="absolute top-4 right-4">
                <Badge className="bg-[hsl(var(--att-accent-soft))] text-[hsl(var(--att-accent))] border-none text-xs">
                  <Library className="w-3 h-3 mr-1" /> MMQ
                </Badge>
              </div>
            )}
            <div className="attendance-confirmation">
              <Avatar className="attendance-confirmation__avatar">
                <AvatarImage src={scan.photo} className="object-cover" />
                <AvatarFallback>{scan.name?.[0]}</AvatarFallback>
              </Avatar>
              <h2 className="attendance-confirmation__name">{scan.name}</h2>
              <p className="attendance-confirmation__text">Anda sudah absen hari ini.</p>
              <div className="attendance-confirmation__prompt">
                <p>Tap kartu sekali lagi untuk update jam pulang/masuk.</p>
              </div>
              <p className="attendance-confirmation__hint">Atau biarkan untuk membatalkan.</p>
            </div>
          </div>
        </motion.div>
      );
    }

    // Guru Schedule Detail
    if (scan.type === 'guru_schedule_detail') {
      return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="attendance-result" role="region" aria-label="Daftar kelas" style={{ maxWidth: '72rem' }}>
          <div className="attendance-result-card" style={{ maxWidth: '100%' }}>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b" style={{ borderColor: 'hsl(var(--att-border-subtle))' }}>
              <Briefcase className="w-5 h-5" style={{ color: 'hsl(var(--att-accent))' }} />
              <h2 className="text-xl font-bold" style={{ color: 'hsl(var(--att-text-primary))' }}>Kelas Anda</h2>
            </div>
            <div className="attendance-schedule-grid">
              {scan.classesData && scan.classesData.length > 0 ? scan.classesData.map(cls => (
                <div key={cls.id} className="attendance-schedule-card">
                  <div className="attendance-schedule-card__header">
                    <h3 className="attendance-schedule-card__name">{cls.nama_kelas}</h3>
                    <span className="attendance-schedule-card__session">{cls.sesi}</span>
                  </div>
                  <div className="attendance-schedule-card__santri">
                    {cls.santri && cls.santri.length > 0 ? (
                      cls.santri.map(s => (
                        <span key={s.id} className="attendance-schedule-card__santri-chip">{s.nama_lengkap}</span>
                      ))
                    ) : (
                      <span className="text-xs italic" style={{ color: 'hsl(var(--att-text-muted))' }}>Kosong</span>
                    )}
                  </div>
                </div>
              )) : (
                <div className="col-span-full text-center py-10" style={{ color: 'hsl(var(--att-text-muted))' }}>
                  Tidak ada kelas yang diampu.
                </div>
              )}
            </div>
          </div>
        </motion.div>
      );
    }

    // Pentashih History
    if (scan.type === 'pentashih_history') {
      return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="attendance-result" role="region" aria-label="Riwayat mutasi" style={{ maxWidth: '64rem' }}>
          <div className="attendance-result-card" style={{ maxWidth: '100%' }}>
            <div className="flex items-center gap-2 mb-6 pb-4 border-b" style={{ borderColor: 'hsl(var(--att-border-subtle))' }}>
              <Activity className="w-5 h-5" style={{ color: 'hsl(var(--att-accent))' }} />
              <h2 className="text-xl font-bold" style={{ color: 'hsl(var(--att-text-primary))' }}>Riwayat Mutasi Terkini</h2>
            </div>
            <div className="attendance-schedule-grid">
              {scan.historyData.map((history, idx) => (
                <div key={idx} className="attendance-schedule-card">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="w-10 h-10 border-2 border-white shadow-sm">
                      <AvatarImage src={history.santri?.foto_url} />
                      <AvatarFallback>{history.santri?.nama_lengkap?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="overflow-hidden">
                      <p className="font-bold text-sm truncate" style={{ color: 'hsl(var(--att-text-primary))' }}>{history.santri?.nama_lengkap}</p>
                      <p className="text-xs" style={{ color: 'hsl(var(--att-text-muted))' }}>{new Date(history.mutation_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs p-2 rounded-lg" style={{ backgroundColor: 'hsl(var(--att-surface))', border: '1px solid hsl(var(--att-border-subtle))' }}>
                    <div className="text-center w-1/2">
                      <p className="font-bold" style={{ color: 'hsl(var(--att-danger))' }}>{history.from_jilid || '?'}</p>
                      <p className="text-[10px] truncate" style={{ color: 'hsl(var(--att-text-muted))' }}>{history.from_class?.nama_kelas || '-'}</p>
                    </div>
                    <ArrowRight className="w-4 h-4" style={{ color: 'hsl(var(--att-text-muted))' }} />
                    <div className="text-center w-1/2">
                      <p className="font-bold" style={{ color: 'hsl(var(--att-success))' }}>{history.to_jilid || '?'}</p>
                      <p className="text-[10px] truncate" style={{ color: 'hsl(var(--att-text-muted))' }}>{history.to_class?.nama_kelas || '-'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      );
    }

    // Error
    if (scan.type === 'error') {
      return (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="attendance-result" role="alert" aria-live="assertive">
          <div className="attendance-result-card attendance-result-card--error">
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: 'hsl(var(--att-danger-bg))' }}>
                <XCircle className="w-10 h-10" style={{ color: 'hsl(var(--att-danger))' }} />
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: 'hsl(var(--att-text-primary))' }}>{scan.name}</h2>
              <div className="w-full p-4 rounded-xl mb-4" style={{ backgroundColor: 'hsl(var(--att-danger-bg))', border: '1px solid hsl(var(--att-danger-border))' }}>
                <p className="font-medium" style={{ color: 'hsl(var(--att-danger))' }}>{scan.message}</p>
              </div>
              <p className="text-sm" style={{ color: 'hsl(var(--att-text-muted))' }}>Silakan hubungi admin jika ini adalah kesalahan.</p>
            </div>
          </div>
        </motion.div>
      );
    }

    // Warning
    if (scan.type === 'warning') {
      return (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="attendance-result" role="alert" aria-live="polite">
          <div className="attendance-result-card attendance-result-card--warning">
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: 'hsl(var(--att-amber-bg))' }}>
                <AlertTriangle className="w-10 h-10" style={{ color: 'hsl(var(--att-amber))' }} />
              </div>
              {scan.photo && (
                <Avatar className="w-20 h-20 mb-3 border-2" style={{ borderColor: 'hsl(var(--att-amber))' }}>
                  <AvatarImage src={scan.photo} className="object-cover" />
                  <AvatarFallback>{scan.name?.[0]}</AvatarFallback>
                </Avatar>
              )}
              <h2 className="text-xl font-bold mb-2" style={{ color: 'hsl(var(--att-text-primary))' }}>{scan.name}</h2>
              <p className="text-sm" style={{ color: 'hsl(var(--att-text-secondary))' }}>{scan.message}</p>
            </div>
          </div>
        </motion.div>
      );
    }

    // Guru Info or Guru Success
    if (scan.type === 'guru_info' || (scan.type === 'success' && scan.role === 'guru')) {
      const isPentashih = scan.type === 'guru_info'
        ? ((scan.roles && scan.roles.includes('Pentashih')) || (scan.jabatan && scan.jabatan.toLowerCase().includes('pentashih')))
        : scan.isPentashih;

      return (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="attendance-result" role="status" aria-live="polite">
          <AttendanceProfileCard
            variant="teacher"
            name={scan.name}
            photo={scan.photo}
            status={scan.type === 'success' ? (scan.status || 'Hadir') : undefined}
            time={scan.type === 'success' ? scan.time : undefined}
            jabatan={scan.jabatan}
            sesi={scan.type === 'guru_info' && scan.stats ? undefined : undefined}
            guruStats={scan.type === 'success' && scan.guruStats ? scan.guruStats : (scan.type === 'guru_info' && scan.stats ? { session: scan.stats.sessions, hours: scan.stats.hours, streak: scan.stats.streak } : undefined)}
            quote={scan.quote}
            message={scan.type === 'success' ? scan.message : undefined}
            showSuccessBadge={scan.type === 'success'}
            isPentashih={isPentashih}
          />
          {/* Pentashih success: extra info grid */}
          {scan.type === 'success' && isPentashih && scan.name && (
            <div className="attendance-stats-row mt-4">
              <div className="attendance-stat-item">
                <span className="attendance-stat-item__value">{scan.name}</span>
                <span className="attendance-stat-item__label">Nama</span>
              </div>
              <div className="attendance-stat-item attendance-stat-item--amber">
                <span className="attendance-stat-item__value">{scan.jabatan || '-'}</span>
                <span className="attendance-stat-item__label">Jabatan</span>
              </div>
            </div>
          )}
        </motion.div>
      );
    }

    // Santri Success — Adult
    if (scan.type === 'success' && scan.role === 'santri' && scan.kategori === 'Dewasa') {
      return (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="attendance-result" role="status" aria-live="polite">
          <AttendanceProfileCard
            variant="student"
            name={scan.name}
            photo={scan.photo}
            status={scan.status || 'Hadir'}
            time={scan.time}
            jilid={scan.jilid}
            points={scan.points}
            monthlyStats={scan.monthlyStats}
            hafalanCount={scan.hafalanCount}
            characterStrength={scan.characterStrength}
            strongestHafalanCategory={scan.strongestHafalanCategory}
            sesi={scan.sesi}
            message={scan.message}
            quote={scan.quote}
            showSuccessBadge
          />
        </motion.div>
      );
    }

    // Santri Success — Child
    if (scan.type === 'success' && scan.role === 'santri') {
      return (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="attendance-result" role="status" aria-live="polite">
          <AttendanceProfileCard
            variant="student"
            name={scan.name}
            photo={scan.photo}
            status={scan.status || 'Hadir'}
            time={scan.time}
            jilid={scan.jilid}
            points={scan.points}
            levelInfo={scan.levelInfo}
            monthlyStats={scan.monthlyStats}
            hafalanCount={scan.hafalanCount}
            characterStrength={scan.characterStrength}
            strongestHafalanCategory={scan.strongestHafalanCategory}
            sesi={scan.sesi}
            message={scan.message}
            quote={scan.quote}
            showSuccessBadge
          />
        </motion.div>
      );
    }

    return null;
  };

  // --- Render ---
  return (
    <>
      <Helmet><title>Absensi Digital - {sekolah.name}</title></Helmet>
      <div className="attendance-page">
        {/* Background */}
        <div className="attendance-page__bg" aria-hidden="true" />

        {/* Header */}
        <header className="attendance-header">
          <div className="attendance-header__left">
            <button
              className="attendance-header__back"
              onClick={() => navigate('/dashboard')}
              aria-label="Kembali ke Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Kembali</span>
            </button>
          </div>
          <div className="attendance-header__right">
            {enableGameFeatures && (
              <>
                <button
                  className="attendance-header__action-btn attendance-header__action-btn--gatcha"
                  onClick={() => navigate('/gatcha-game')}
                  title="Play Gatcha"
                  aria-label="Play Gatcha"
                >
                  <Gamepad2 className="w-4 h-4" />
                  <span>Gatcha</span>
                </button>
                <button
                  className="attendance-header__action-btn attendance-header__action-btn--quiz"
                  onClick={() => navigate('/quiz-hafalan')}
                  title="Play Quiz"
                  aria-label="Play Quiz"
                >
                  <Library className="w-4 h-4" />
                  <span>Quiz</span>
                </button>
                <button
                  className="attendance-header__action-btn attendance-header__action-btn--random"
                  onClick={() => navigate('/random-name')}
                  title="Acak Nama"
                  aria-label="Acak Nama"
                >
                  <Dices className="w-4 h-4" />
                  <span>Acak Nama</span>
                </button>
              </>
            )}
            <button
              className="attendance-header__action-btn attendance-header__action-btn--tv"
              onClick={() => navigate('/tv-display-mode')}
              title="TV Display Mode"
              aria-label="TV Display Mode"
            >
              <Tv className="w-4 h-4" />
              <span>TV Display</span>
            </button>
            <button className="attendance-header__icon-btn" onClick={toggleTheme} title={isDark ? 'Mode Terang' : 'Mode Gelap'} aria-label={isDark ? 'Mode Terang' : 'Mode Gelap'}>
              {isDark ? <Sun className="w-4 h-4" style={{ color: 'hsl(var(--att-amber))' }} /> : <Moon className="w-4 h-4" />}
            </button>
            <div className="attendance-header__system-chip">
              <span className="attendance-header__system-dot" />
              <span>SYSTEM ONLINE</span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="relative z-10 flex-grow flex flex-col items-center justify-center p-4 md:p-8 gap-6 md:gap-8">
          <DigitalClock />

          {/* Scan Result Area */}
          <div className="w-full flex items-center justify-center">
            <AnimatePresence mode="wait">
              <ScanResult key={lastScan?.type || 'ready'} scan={lastScan} />
            </AnimatePresence>
          </div>

          {/* RFID Input */}
          <div className="attendance-scan-area">
            <div className="attendance-scan-area__glow" aria-hidden="true" />
            <form onSubmit={handleRfidSubmit} className="attendance-scan-area__form">
              <Search className="attendance-scan-area__icon w-5 h-5" />
              <Input
                ref={inputRef}
                type="text"
                placeholder="Menunggu Scan Kartu..."
                value={rfidTag}
                onChange={e => setRfidTag(e.target.value)}
                className="attendance-scan-area__input"
                disabled={isLoading}
                autoFocus
                autoComplete="off"
                aria-label="Input RFID"
              />
              {isLoading && <div className="attendance-scan-area__spinner" aria-hidden="true" />}
            </form>
            <p className="attendance-scan-area__hint">Silakan tap kartu untuk scan absen</p>
          </div>

          <MediaPlayerWidget />
        </main>

        {/* Footer */}
        <footer className="attendance-footer">
          <p className="attendance-footer__text">{sekolah.name} &bull; ABSENSI DIGITAL</p>
        </footer>
      </div>
    </>
  );
};

export default DigitalAttendancePage;
