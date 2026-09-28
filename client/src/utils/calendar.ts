import { getPreferences } from "../i18n/preferences";
// Date keys are calendar dates, not UTC instants. Keep local dates intact across time zones.
export function localDateKey(date = new Date()) {
    return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function isValidMonth(month: string): boolean {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && Number(month.slice(0, 4)) > 0;
}

export function daysInMonth(month: string): number {
    const [year, number] = month.split("-").map(Number);
    if (number === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
    return [4, 6, 9, 11].includes(number) ? 30 : 31;
}

export function monthDates(month: string): string[] {
    return Array.from({ length: daysInMonth(month) }, (_, day) => `${month}-${String(day + 1).padStart(2, "0")}`);
}

export function shiftMonth(month: string, offset: number): string {
    const [year, number] = month.split("-").map(Number);
    const index = Math.max(12, Math.min(9999 * 12 + 11, year * 12 + number - 1 + offset));
    return `${String(Math.floor(index / 12)).padStart(4, "0")}-${String(index % 12 + 1).padStart(2, "0")}`;
}

export function calendarDate(date: string): Date {
    return new Date(`${date}T12:00:00`);
}

export function formatCalendarDate(date: string): string {
    return new Intl.DateTimeFormat(getPreferences().language, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(calendarDate(date));
}
