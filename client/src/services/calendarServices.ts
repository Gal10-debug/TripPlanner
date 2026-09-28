import type { CalendarMonth } from "../models/Calendar";

export async function getCalendarMonth(month: string, signal?: AbortSignal): Promise<CalendarMonth> {
    const response = await fetch(`/api/calendar?month=${encodeURIComponent(month)}`, { credentials: "include", signal });
    if (!response.ok) throw new Error("Unable to load the calendar. Please try again.");
    return response.json();
}
