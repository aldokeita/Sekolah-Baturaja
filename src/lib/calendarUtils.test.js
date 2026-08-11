import { describe, expect, it } from 'vitest';
import {
    DEFAULT_SATURDAY_IS_HOLIDAY,
    getSaturdayHolidayForMonth,
    getActiveCalendarDates,
    getCalendarDateDayOfWeek,
    groupCalendarEventsByDate,
    isAutomaticCalendarHoliday,
    isCalendarDateActive,
    isEffectiveCalendarHoliday,
    normalizeCalendarMonthSettings,
    normalizeCalendarMonthSettingsByYear,
} from '@/lib/calendarUtils';

describe('aturan Sabtu kalender akademik', () => {
    it('memakai perilaku lama saat bulan belum memiliki konfigurasi', () => {
        expect(getSaturdayHolidayForMonth({}, 8)).toBe(DEFAULT_SATURDAY_IS_HOLIDAY);
        expect(isAutomaticCalendarHoliday(0, false)).toBe(true);
        expect(isAutomaticCalendarHoliday(6)).toBe(true);
    });

    it('membedakan Sabtu sekolah dan Sabtu libur per bulan', () => {
        const settings = normalizeCalendarMonthSettings([
            { month: 8, saturday_is_holiday: false },
            { month: 9, saturday_is_holiday: true },
        ]);

        expect(getSaturdayHolidayForMonth(settings, 8)).toBe(false);
        expect(getSaturdayHolidayForMonth(settings, 9)).toBe(true);
        expect(isAutomaticCalendarHoliday(6, false)).toBe(false);
        expect(isAutomaticCalendarHoliday(6, true)).toBe(true);
        expect(isAutomaticCalendarHoliday(0, false)).toBe(true);
    });

    it('mengabaikan baris konfigurasi dengan bulan tidak valid', () => {
        const settings = normalizeCalendarMonthSettings([
            { month: 0, saturday_is_holiday: false },
            { month: 13, saturday_is_holiday: false },
            { month: 4, saturday_is_holiday: 'false' },
        ]);

        expect(Object.keys(settings)).toEqual(['4']);
        expect(getSaturdayHolidayForMonth(settings, 4)).toBe(false);
    });

    it('tidak menghapus atau menimpa libur manual saat aturan Sabtu berubah', () => {
        const manualHoliday = [{ is_holiday: true, title: 'Cuti bersama' }];
        const manualSchoolDay = [{ is_holiday: false, title: 'Ujian' }];

        expect(isEffectiveCalendarHoliday({
            dayOfWeek: 6,
            dayEvents: manualHoliday,
            saturdayIsHoliday: false,
        })).toBe(true);
        expect(isEffectiveCalendarHoliday({
            dayOfWeek: 6,
            dayEvents: manualSchoolDay,
            saturdayIsHoliday: true,
        })).toBe(false);
        expect(isEffectiveCalendarHoliday({
            dayOfWeek: 0,
            dayEvents: manualSchoolDay,
            saturdayIsHoliday: false,
        })).toBe(false);
    });

    it('menghasilkan hari aktif Sabtu dari konfigurasi tahun-bulan dan tetap melewati Minggu', () => {
        const monthSettingsByYear = normalizeCalendarMonthSettingsByYear([
            { year: 2026, month: 8, saturday_is_holiday: false },
        ]);
        const activeDates = getActiveCalendarDates({
            startDate: '2026-08-01',
            endDate: '2026-08-09',
            monthSettingsByYear,
        });

        expect(getCalendarDateDayOfWeek('2026-08-01')).toBe(6);
        expect(activeDates).toContain('2026-08-01');
        expect(activeDates).not.toContain('2026-08-02');
    });

    it('mempertahankan libur manual dan memakai default saat konfigurasi bulan tidak ada', () => {
        const eventsByDate = groupCalendarEventsByDate([
            { date: '2026-08-08', is_holiday: true, title: 'Cuti bersama' },
        ]);
        const defaultSettings = normalizeCalendarMonthSettingsByYear([]);

        expect(isCalendarDateActive({
            dateString: '2026-08-08',
            eventsByDate,
            monthSettingsByYear: normalizeCalendarMonthSettingsByYear([
                { year: 2026, month: 8, saturday_is_holiday: false },
            ]),
        })).toBe(false);
        expect(isCalendarDateActive({
            dateString: '2026-08-08',
            eventsByDate: {},
            monthSettingsByYear: defaultSettings,
        })).toBe(false);
    });
});
