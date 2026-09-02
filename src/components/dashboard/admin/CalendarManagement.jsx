import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Save, Trash2, CalendarOff, CalendarCheck, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  deleteCalendarEvent,
  deleteCalendarMonthSetting,
  fetchCalendarEvents,
  fetchCalendarMonthSettings,
  getAcademicErrorMessage,
  saveCalendarEvent,
  saveCalendarMonthSetting,
} from '@/lib/academicAdapters';
import {
  DEFAULT_SATURDAY_IS_HOLIDAY,
  getSaturdayHolidayForMonth,
  isAutomaticCalendarHoliday,
  isEffectiveCalendarHoliday,
  normalizeCalendarMonthSettings,
} from '@/lib/calendarUtils';
import { useAuth } from '@/contexts/AuthContext';

const months = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const emptyForm = { title: '', description: '', is_holiday: true };

const CalendarManagement = () => {
  const { user } = useAuth();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  // date string -> array of agenda entries. A date may carry several entries
  // since the one-row-per-date constraint was lifted.
  const [eventsByDate, setEventsByDate] = useState({});
  const [monthSettings, setMonthSettings] = useState({});
  const [saturdayHolidayDraft, setSaturdayHolidayDraft] = useState(DEFAULT_SATURDAY_IS_HOLIDAY);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingSetting, setIsSavingSetting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [holidayForm, setHolidayForm] = useState(emptyForm);

  const fetchHolidays = useCallback(async () => {
    setIsLoading(true);
    setMonthSettings({});
    const startDate = `${selectedYear}-01-01`;
    const endDate = `${selectedYear}-12-31`;

    try {
      const [calendarResult, settingsResult] = await Promise.allSettled([
        fetchCalendarEvents({ startDate, endDate }),
        fetchCalendarMonthSettings(selectedYear),
      ]);
      if (calendarResult.status === 'rejected') throw calendarResult.reason;

      const data = calendarResult.value;
      const grouped = {};
      data.forEach(item => {
        if (!item?.date) return;
        (grouped[item.date] ||= []).push(item);
      });
      setEventsByDate(grouped);
      if (settingsResult.status === 'fulfilled') {
        setMonthSettings(normalizeCalendarMonthSettings(settingsResult.value));
      } else {
        // Bila konfigurasi belum tersedia (mis. migration belum diterapkan),
        // kalender tetap memakai perilaku bawaan dan agenda tetap tampil.
        setMonthSettings({});
        toast({
          title: 'Memakai aturan kalender bawaan',
          description: 'Pengaturan Sabtu belum tersedia untuk tahun ini.',
        });
      }
    } catch (error) {
      toast({ title: 'Gagal memuat kalender', description: getAcademicErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  const selectedMonthNumber = selectedMonth + 1;

  /* Bulan yang belum punya setelan sendiri. Ini yang paling berbahaya di panel
   * ini: bulan tanpa baris memakai DEFAULT_SATURDAY_IS_HOLIDAY, jadi sekolah yang
   * mengatur sebagian bulan mendapat rekap yang tidak seragam TANPA pesan galat
   * apa pun. Yang salah baru terlihat saat rapor dicetak.
   *
   * Dihitung dari daftar bulan, bukan dari jumlah barisnya, supaya namanya bisa
   * disebutkan — "empat bulan belum diatur" tidak menolong siapa pun mencari
   * bulan mana. */
  const bulanBelumDiatur = months
    .map((nama, i) => ({ nama, nomor: i + 1 }))
    .filter(({ nomor }) => !monthSettings[nomor]);
  const savedMonthSetting = monthSettings[selectedMonthNumber];
  const savedSaturdayHoliday = getSaturdayHolidayForMonth(monthSettings, selectedMonthNumber);
  const hasSavedMonthSetting = Boolean(savedMonthSetting);

  useEffect(() => {
    setSaturdayHolidayDraft(savedSaturdayHoliday);
  }, [selectedYear, selectedMonth, savedSaturdayHoliday]);

  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] || []) : [];

  const handleDateClick = (day) => {
    const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const d = new Date(selectedYear, selectedMonth, day);
    const isAutomaticHoliday = isAutomaticCalendarHoliday(d.getDay(), savedSaturdayHoliday);

    setSelectedDate(dateStr);
    setEditingId(null);
    // The dialog always opens on a blank "add" form; existing entries are
    // listed above it and loaded into the form only when one is clicked.
    setHolidayForm({
      ...emptyForm,
      title: (eventsByDate[dateStr]?.length || !isAutomaticHoliday) ? '' : 'Libur Akhir Pekan',
    });
    setDialogOpen(true);
  };

  const handleEditEvent = (event) => {
    setEditingId(event.id);
    setHolidayForm({
      title: event.title || '',
      description: event.description || '',
      is_holiday: event.is_holiday,
    });
  };

  const handleSaveHoliday = async () => {
    if (!selectedDate) return;
    if (!String(holidayForm.title || '').trim() && !String(holidayForm.description || '').trim()) {
      toast({ title: 'Nama agenda wajib diisi', description: 'Isi nama agenda atau keterangannya.', variant: 'destructive' });
      return;
    }

    try {
      await saveCalendarEvent({
        existingId: editingId,
        selectedDate,
        title: holidayForm.title,
        description: holidayForm.description,
        isHoliday: holidayForm.is_holiday,
        userId: user?.id
      });
      toast({ title: 'Berhasil', description: editingId ? 'Agenda diperbarui.' : 'Agenda ditambahkan.' });
      setEditingId(null);
      setHolidayForm(emptyForm);
      fetchHolidays();
    } catch (error) {
      toast({ title: 'Gagal menyimpan', description: getAcademicErrorMessage(error), variant: 'destructive' });
    }
  };

  const handleSaveMonthSetting = async () => {
    setIsSavingSetting(true);
    try {
      const saved = await saveCalendarMonthSetting({
        year: selectedYear,
        month: selectedMonthNumber,
        saturdayIsHoliday: saturdayHolidayDraft,
      });
      setMonthSettings((previous) => ({
        ...previous,
        [selectedMonthNumber]: saved || {
          year: selectedYear,
          month: selectedMonthNumber,
          saturday_is_holiday: saturdayHolidayDraft,
        },
      }));
      toast({ title: 'Berhasil', description: 'Aturan hari Sabtu bulan ini tersimpan.' });
    } catch (error) {
      toast({ title: 'Gagal menyimpan aturan', description: getAcademicErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsSavingSetting(false);
    }
  };

  /* Menerapkan kebijakan Sabtu ke SELURUH dua belas bulan sekaligus.
   *
   * Sebelumnya saklarnya hanya per bulan, jadi sekolah lima hari harus memilih
   * bulan, memilih kebijakan, dan menekan Simpan dua belas kali. Bukan sulit,
   * tetapi berulang — dan bulan yang terlewat diam-diam memakai bawaan, sehingga
   * rekapnya berbeda dari bulan lain tanpa satu pun peringatan. Itu baru terlihat
   * saat rapor dicetak.
   *
   * Disimpan satu per satu, bukan sekali kirim: endpoint-nya memang per bulan
   * (`PUT /calendar-settings/{year}/{month}`), dan menambah endpoint massal
   * berarti menyentuh backend untuk hal yang tidak menuntutnya. Yang gagal
   * dilaporkan berikut nama bulannya, jadi admin tahu mana yang harus diulang
   * alih-alih menebak. */
  const handleApplyYearSetting = async () => {
    const label = saturdayHolidayDraft ? 'Senin–Jumat (Sabtu libur)' : 'Senin–Sabtu (Sabtu hari sekolah)';
    if (!window.confirm(`Terapkan kebijakan "${label}" ke dua belas bulan tahun ${selectedYear}? Agenda dan libur per tanggal tidak berubah.`)) return;

    setIsSavingSetting(true);
    const berhasil = {};
    const gagal = [];
    for (let bulan = 1; bulan <= 12; bulan += 1) {
      try {
        const saved = await saveCalendarMonthSetting({
          year: selectedYear,
          month: bulan,
          saturdayIsHoliday: saturdayHolidayDraft,
        });
        berhasil[bulan] = saved || { year: selectedYear, month: bulan, saturday_is_holiday: saturdayHolidayDraft };
      } catch {
        gagal.push(months[bulan - 1]);
      }
    }
    setMonthSettings((previous) => ({ ...previous, ...berhasil }));
    setIsSavingSetting(false);

    if (gagal.length === 0) {
      toast({ title: 'Berhasil', description: `Kebijakan hari Sabtu diterapkan ke dua belas bulan ${selectedYear}.` });
      return;
    }
    toast({
      title: `${gagal.length} bulan gagal disimpan`,
      description: `Belum tersimpan: ${gagal.join(', ')}. Bulan lainnya sudah tersimpan.`,
      variant: 'destructive',
    });
  };

  const handleResetMonthSetting = async () => {
    setIsSavingSetting(true);
    try {
      await deleteCalendarMonthSetting({ year: selectedYear, month: selectedMonthNumber });
      setMonthSettings((previous) => {
        const next = { ...previous };
        delete next[selectedMonthNumber];
        return next;
      });
      toast({ title: 'Berhasil', description: 'Bulan ini kembali ke aturan kalender bawaan.' });
    } catch (error) {
      toast({ title: 'Gagal mengembalikan aturan', description: getAcademicErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsSavingSetting(false);
    }
  };

  const handleDeleteEvent = async (id) => {
    try {
      await deleteCalendarEvent(id);
      toast({ title: 'Berhasil', description: 'Agenda dihapus.' });
      if (editingId === id) {
        setEditingId(null);
        setHolidayForm(emptyForm);
      }
      fetchHolidays();
    } catch (error) {
      toast({ title: 'Gagal menghapus', description: getAcademicErrorMessage(error), variant: 'destructive' });
    }
  };

  const generateCalendarDays = () => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const firstDayObj = new Date(selectedYear, selectedMonth, 1);
    const startDayOfWeek = firstDayObj.getDay() === 0 ? 6 : firstDayObj.getDay() - 1;

    const days = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 bg-slate-50/50 dark:bg-slate-900/20 border border-transparent rounded-lg"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayDate = new Date(selectedYear, selectedMonth, d);
      const isAutomaticHoliday = isAutomaticCalendarHoliday(dayDate.getDay(), savedSaturdayHoliday);
      const dayEvents = eventsByDate[dateStr] || [];

      // A date is off if ANY of its entries marks it a holiday. An explicit
      // "masuk" entry is what overrides the automatic weekend rule.
      const isEffectiveHoliday = isEffectiveCalendarHoliday({
        dayOfWeek: dayDate.getDay(),
        dayEvents,
        saturdayIsHoliday: savedSaturdayHoliday,
      });

      let bgClass = "bg-white dark:bg-slate-800 hover:border-blue-500";
      let statusIcon = null;
      let statusText = "";

      if (isEffectiveHoliday) {
        if (isAutomaticHoliday && dayEvents.length === 0) {
             // Implicit Weekend
             bgClass = "bg-slate-100 dark:bg-slate-900/50 text-slate-500 hover:border-slate-400";
             statusText = "Akhir Pekan";
        } else {
             // Explicit Holiday
             bgClass = "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 hover:border-red-500";
             statusIcon = <CalendarOff className="w-4 h-4 text-red-500" />;
             statusText = dayEvents[0]?.title || dayEvents[0]?.description || "Libur";
        }
      } else {
        // Active Day — may still carry agenda entries (e.g. an exam or a visit).
        statusIcon = dayEvents.length > 0
          ? <CalendarIcon className="w-4 h-4 text-blue-500" />
          : <CalendarCheck className="w-4 h-4 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />;
        if (dayEvents.length > 0) {
          bgClass = "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 hover:border-blue-500";
          statusText = dayEvents[0]?.title || dayEvents[0]?.description || "Agenda";
        }
      }

      const extraCount = dayEvents.length > 1 ? dayEvents.length - 1 : 0;

      days.push(
        <div
          key={d}
          onClick={() => handleDateClick(d)}
          className={`h-24 p-2 rounded-lg border transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden ${bgClass}`}
        >
          <div className="flex justify-between items-start">
            <span className={`font-bold text-lg ${isEffectiveHoliday ? 'text-slate-600 dark:text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>{d}</span>
            {statusIcon}
          </div>
          <div className="text-xs font-medium truncate mt-1 flex items-center gap-1">
            {statusText && <Badge variant="outline" className={`text-[10px] h-5 px-1 border-0 truncate ${isEffectiveHoliday ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{statusText}</Badge>}
            {extraCount > 0 && <Badge variant="outline" className="text-[10px] h-5 px-1 border-0 bg-slate-200 text-slate-600 flex-shrink-0">+{extraCount}</Badge>}
          </div>
        </div>
      );
    }
    return days;
  };

  const nextMonth = () => {
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  };

  const prevMonth = () => {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  };

  return (
    <Card className="border-none shadow-md bg-white dark:bg-slate-950">
      <CardHeader className="flex flex-col md:flex-row items-center justify-between pb-4 border-b gap-4">
        <div>
            <CardTitle className="text-xl flex items-center gap-2"><CalendarIcon className="w-6 h-6 text-primary"/> Kalender Akademik</CardTitle>
            <CardDescription>
              Atur hari libur dan agenda kegiatan. Satu tanggal boleh memuat beberapa agenda.
              {savedSaturdayHoliday ? ' Sabtu dan Minggu otomatis dianggap libur.' : ' Minggu otomatis dianggap libur; Sabtu tetap menjadi hari sekolah.'}
            </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-4 justify-center">
            {/* Button removed as requested */}
            <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="w-4 h-4"/></Button>
                <div className="text-center w-32">
                    <div className="font-bold text-lg">{months[selectedMonth]}</div>
                    <div className="text-xs text-muted-foreground">{selectedYear}</div>
                </div>
                <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="w-4 h-4"/></Button>
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="mb-6 flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/50 md:flex-row md:items-end md:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
              <CalendarCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="font-semibold">Aturan hari Sabtu · {months[selectedMonth]}</div>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Tentukan apakah Sabtu pada bulan ini libur otomatis. Hari Minggu tetap libur otomatis dan agenda manual tidak berubah.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {hasSavedMonthSetting ? 'Pengaturan khusus bulan ini tersimpan.' : 'Belum ada pengaturan khusus; memakai aturan bawaan: Sabtu dan Minggu libur.'}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 sm:min-w-[17rem]">
              <Label htmlFor="calendar-saturday-policy" className="text-xs text-muted-foreground">Kebijakan bulan ini</Label>
              <Select
                value={saturdayHolidayDraft ? 'saturday-holiday' : 'saturday-school'}
                onValueChange={(value) => setSaturdayHolidayDraft(value === 'saturday-holiday')}
                disabled={isLoading || isSavingSetting}
              >
                <SelectTrigger id="calendar-saturday-policy" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="saturday-holiday">Senin–Jumat (Sabtu libur otomatis)</SelectItem>
                  <SelectItem value="saturday-school">Senin–Sabtu (Sabtu hari sekolah)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSaveMonthSetting}
                disabled={isLoading || isSavingSetting || (hasSavedMonthSetting && saturdayHolidayDraft === savedSaturdayHoliday)}
              >
                {isSavingSetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Simpan
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleApplyYearSetting}
                disabled={isLoading || isSavingSetting}
                title={`Terapkan kebijakan ini ke dua belas bulan tahun ${selectedYear}`}
              >
                {isSavingSetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarCheck className="mr-2 h-4 w-4" />}
                Terapkan ke seluruh tahun
              </Button>
              {hasSavedMonthSetting && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetMonthSetting}
                  disabled={isLoading || isSavingSetting}
                >
                  Gunakan default
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Peringatan bulan yang belum diatur. Bulan tanpa setelan sendiri memakai
            aturan bawaan, dan itu tidak salah — yang berbahaya adalah SEBAGIAN
            bulan diatur dan sebagian tidak, karena rekap kehadirannya lalu tidak
            seragam sepanjang tahun tanpa satu pun pesan galat. Karena itu
            peringatan ini hanya muncul saat campuran, bukan saat semua bulan
            belum diatur — sekolah yang belum menyentuh panel ini sama sekali
            memang konsisten memakai bawaan. */}
        {!isLoading && bulanBelumDiatur.length > 0 && bulanBelumDiatur.length < months.length && (
          <div className="mb-4 border-l-[3px] border-amber-500 bg-amber-50 px-3.5 py-3 dark:border-amber-400 dark:bg-amber-950/30">
            <p className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-200">
              <CalendarOff className="h-4 w-4" aria-hidden="true" />
              {bulanBelumDiatur.length} bulan {selectedYear} belum diatur
            </p>
            <p className="mt-1 text-xs text-amber-900/90 dark:text-amber-200/90">
              {bulanBelumDiatur.map((b) => b.nama).join(', ')} memakai aturan bawaan
              {DEFAULT_SATURDAY_IS_HOLIDAY ? ' (Sabtu libur)' : ' (Sabtu hari sekolah)'}, sementara bulan lain
              sudah diatur sendiri. Rekap kehadiran jadi tidak seragam sepanjang tahun.
              Tekan &ldquo;Terapkan ke seluruh tahun&rdquo; untuk menyamakan.
            </p>
          </div>
        )}
        <div className="grid grid-cols-7 gap-4 mb-4 text-center">
            {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(day => (
                <div key={day} className={`font-semibold text-sm uppercase ${day === 'Min' || (day === 'Sab' && savedSaturdayHoliday) ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground'}`}>{day}</div>
            ))}
        </div>
        <div className={`grid grid-cols-7 gap-2 md:gap-4 transition-opacity ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
            {generateCalendarDays()}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-muted-foreground justify-center">
            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-white border rounded"></div> Hari Efektif</div>
            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-slate-100 border rounded"></div> {savedSaturdayHoliday ? 'Sabtu & Minggu otomatis libur' : 'Minggu otomatis libur'}</div>
            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-red-50 border border-red-200 rounded"></div> Hari Libur Nasional / Cuti</div>
            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-blue-50 border border-blue-200 rounded"></div> Ada Agenda (Tetap KBM)</div>
        </div>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Agenda Tanggal Ini</DialogTitle>
                <DialogDescription>
                    {selectedDate && (() => {
                        // Parse dari komponen y/m/d agar tidak dianggap UTC (yang
                        // bisa menggeser tampilan tanggal mundur satu hari).
                        const [y, m, d] = selectedDate.split('-').map(Number);
                        return new Date(y, m - 1, d).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                    })()}
                </DialogDescription>
            </DialogHeader>

            {selectedEvents.length > 0 && (
                <div className="space-y-2 border-b pb-4">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                        {selectedEvents.length} agenda tersimpan
                    </Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {selectedEvents.map(event => (
                            <div
                                key={event.id}
                                className={`flex items-start gap-2 rounded-lg border p-2 text-sm ${editingId === event.id ? 'border-primary bg-primary/5' : 'border-border'}`}
                            >
                                {event.is_holiday
                                    ? <CalendarOff className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                                    : <CalendarCheck className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />}
                                <button
                                    type="button"
                                    onClick={() => handleEditEvent(event)}
                                    className="flex-1 text-left min-w-0"
                                >
                                    <div className="font-medium truncate">{event.title}</div>
                                    {event.description && event.description !== event.title && (
                                        <div className="text-xs text-muted-foreground truncate">{event.description}</div>
                                    )}
                                </button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 flex-shrink-0"
                                    onClick={() => handleDeleteEvent(event.id)}
                                    type="button"
                                >
                                    <Trash2 className="w-4 h-4 text-destructive"/>
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="space-y-4 py-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    {editingId ? 'Ubah agenda' : 'Tambah agenda baru'}
                </Label>
                <div className="space-y-2">
                    <Label>Nama Agenda</Label>
                    <Input
                        placeholder="Contoh: Rapat Komite Sekolah"
                        value={holidayForm.title}
                        onChange={e => setHolidayForm(prev => ({ ...prev, title: e.target.value }))}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                        value={holidayForm.is_holiday ? "yes" : "no"}
                        onValueChange={v => setHolidayForm(prev => ({ ...prev, is_holiday: v === "yes" }))}
                    >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="yes">Libur (Tidak Ada KBM)</SelectItem>
                            <SelectItem value="no">Masuk (Ada KBM)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Keterangan <span className="text-muted-foreground font-normal">(opsional)</span></Label>
                    <Input
                        placeholder="Contoh: Pukul 09.00 di aula"
                        value={holidayForm.description}
                        onChange={e => setHolidayForm(prev => ({ ...prev, description: e.target.value }))}
                    />
                </div>
            </div>
            <DialogFooter className="flex justify-between sm:justify-between">
                {editingId ? (
                    <Button
                        variant="outline"
                        type="button"
                        onClick={() => { setEditingId(null); setHolidayForm(emptyForm); }}
                    >
                        Batal Ubah
                    </Button>
                ) : <div></div>}
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>Tutup</Button>
                    <Button onClick={handleSaveHoliday}>
                        <Save className="w-4 h-4 mr-2"/> {editingId ? 'Simpan Perubahan' : 'Tambah'}
                    </Button>
                </div>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default CalendarManagement;
