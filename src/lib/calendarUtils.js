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
            saturday_is_holiday: asBoolean(row?.saturday_is_holiday),
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
    Number(dayOfWeek) === 0 || (Number(dayOfWeek) === 6 && Boolean(saturdayIsHoliday))
);

// Agenda manual selalu menang: baris libur tetap libur walaupun kebijakan
// Sabtu bulan itu berubah, sedangkan baris "Masuk" hanya mengesampingkan
// libur otomatis pada tanggal yang sama.
export const isEffectiveCalendarHoliday = ({
    dayOfWeek,
    dayEvents = [],
    saturdayIsHoliday = DEFAULT_SATURDAY_IS_HOLIDAY,
}) => {
    const isDbHoliday = dayEvents.some((event) => event?.is_holiday === true);
    const isDbActive = dayEvents.some((event) => event?.is_holiday === false);
    return isDbHoliday || (
        isAutomaticCalendarHoliday(dayOfWeek, saturdayIsHoliday) && !isDbActive
    );
};
