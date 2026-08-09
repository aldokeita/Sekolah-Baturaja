import { describe, expect, it } from 'vitest';
import {
    DEFAULT_SATURDAY_IS_HOLIDAY,
    getSaturdayHolidayForMonth,
    isAutomaticCalendarHoliday,
    isEffectiveCalendarHoliday,
    normalizeCalendarMonthSettings,
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
});
