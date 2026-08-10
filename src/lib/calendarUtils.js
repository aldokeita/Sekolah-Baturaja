export const DEFAULT_SATURDAY_IS_HOLIDAY = true;

const asBoolean = (value) => value === true || value === 'true';

// Bentuk internal ini sengaja berupa map bulan -> baris agar komponen kalender
// dapat membaca aturan bulan aktif tanpa mencari ulang setiap tanggal.
export const normalizeCalendarMonthSettings = (rows = []) => (
    (rows || []).reduce((settings, row) => {
        const month = Number(row?.month);
        if (!Number.isInteger(month) || month < 1 || month > 12) return settings;
        settings[month] = {
            ...row,
            month,
            saturday_is_holiday: row?.saturday_is_holiday === undefined
                ? DEFAULT_SATURDAY_IS_HOLIDAY
                : asBoolean(row.saturday_is_holiday),
        };
        return settings;
    }, {})
);

export const normalizeCalendarMonthSettingsByYear = (rows = []) => (
    (rows || []).reduce((settings, row) => {
        const year = Number(row?.year);
        const month = Number(row?.month);
        if (!Number.isInteger(year) || year < 1 || year > 9999) return settings;
        if (!Number.isInteger(month) || month < 1 || month > 12) return settings;
        if (!settings[year]) settings[year] = {};
        settings[year][month] = {
            ...row,
            year,
            month,
            saturday_is_holiday: row?.saturday_is_holiday === undefined
                ? DEFAULT_SATURDAY_IS_HOLIDAY
                : asBoolean(row.saturday_is_holiday),
        };
        return settings;
    }, {})
);

export const getSaturdayHolidayForMonth = (settings, month) => {
    const row = Array.isArray(settings)
        ? settings.find((item) => Number(item?.month) === Number(month))
        : settings?.[month];
    return row?.saturday_is_holiday === undefined
        ? DEFAULT_SATURDAY_IS_HOLIDAY
        : asBoolean(row.saturday_is_holiday);
};

export const isAutomaticCalendarHoliday = (dayOfWeek, saturdayIsHoliday = DEFAULT_SATURDAY_IS_HOLIDAY) => (
    Number(dayOfWeek) === 0 || (Number(dayOfWeek) === 6 && asBoolean(saturdayIsHoliday))
);

// Agenda manual selalu menang: baris libur tetap libur walaupun kebijakan
// Sabtu bulan itu berubah, sedangkan baris "Masuk" hanya mengesampingkan
// libur otomatis pada tanggal yang sama.
export const isEffectiveCalendarHoliday = ({
    dayOfWeek,
    dayEvents = [],
    saturdayIsHoliday = DEFAULT_SATURDAY_IS_HOLIDAY,
}) => {
    const isDbHoliday = dayEvents.some((event) => (
        event?.is_holiday === true || event?.is_holiday === 'true'
    ));
    const isDbActive = dayEvents.some((event) => (
        event?.is_holiday === false || event?.is_holiday === 'false'
    ));
    return isDbHoliday || (
        isAutomaticCalendarHoliday(dayOfWeek, asBoolean(saturdayIsHoliday)) && !isDbActive
    );
};

const toISODateOnly = (value) => {
    if (typeof value === 'string') {
        const date = value.slice(0, 10);
        return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
    }
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const getCalendarDateDayOfWeek = (dateString) => {
    const date = toISODateOnly(dateString);
    if (!date) return null;
    const [year, month, day] = date.split('-').map(Number);
    const utcDate = new Date(Date.UTC(year, month - 1, day));
    if (
        utcDate.getUTCFullYear() !== year
        || utcDate.getUTCMonth() !== month - 1
        || utcDate.getUTCDate() !== day
    ) return null;
    return utcDate.getUTCDay();
};

export const groupCalendarEventsByDate = (events = []) => (
    (events || []).reduce((grouped, event) => {
        const date = toISODateOnly(event?.date);
        if (!date) return grouped;
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(event);
        return grouped;
    }, {})
);

export const isCalendarDateActive = ({
    dateString,
    eventsByDate = {},
    monthSettingsByYear = {},
} = {}) => {
    const date = toISODateOnly(dateString);
    const dayOfWeek = getCalendarDateDayOfWeek(date);
    if (!date || dayOfWeek === null) return false;

    const [year, month] = date.split('-').map(Number);
    const settings = monthSettingsByYear?.[year] || monthSettingsByYear?.[String(year)] || {};
    return !isEffectiveCalendarHoliday({
        dayOfWeek,
        dayEvents: eventsByDate?.[date] || [],
        saturdayIsHoliday: getSaturdayHolidayForMonth(settings, month),
    });
};

export const getCalendarDateRange = (startDate, endDate) => {
    const start = toISODateOnly(startDate);
    const end = toISODateOnly(endDate);
    if (!start || !end || start > end) return [];
    if (getCalendarDateDayOfWeek(start) === null || getCalendarDateDayOfWeek(end) === null) return [];

    const [startYear, startMonth, startDay] = start.split('-').map(Number);
    const [endYear, endMonth, endDay] = end.split('-').map(Number);
    const current = new Date(Date.UTC(startYear, startMonth - 1, startDay));
    const boundary = new Date(Date.UTC(endYear, endMonth - 1, endDay));
    if (Number.isNaN(current.getTime()) || Number.isNaN(boundary.getTime())) return [];

    const dates = [];
    while (current <= boundary) {
        dates.push(current.toISOString().slice(0, 10));
        current.setUTCDate(current.getUTCDate() + 1);
    }
    return dates;
};

export const getActiveCalendarDates = ({
    startDate,
    endDate,
    eventsByDate = {},
    monthSettingsByYear = {},
    throughDate = null,
} = {}) => {
    const start = toISODateOnly(startDate);
    const end = toISODateOnly(endDate);
    const limit = throughDate ? toISODateOnly(throughDate) : null;
    const boundedEnd = limit && limit < end ? limit : end;
    if (!start || !boundedEnd || start > boundedEnd) return [];

    return getCalendarDateRange(start, boundedEnd).filter((dateString) => (
        isCalendarDateActive({ dateString, eventsByDate, monthSettingsByYear })
    ));
};
