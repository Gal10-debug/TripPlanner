import type { DashboardReminder, ReminderRequest, TripReminder, WeatherForecast } from "../models/WeatherReminder";

async function ensureSuccess(response: Response) {
    if (response.ok) return;
    const body = await response.json().catch(() => null) as { detail?: string; title?: string; errors?: Record<string, string[]> } | null;
    const validationError = body?.errors ? Object.values(body.errors).flat()[0] : undefined;
    throw new Error(validationError ?? body?.detail ?? body?.title ?? "Unable to load travel updates.");
}

export async function getWeather(tripId: number): Promise<WeatherForecast> {
    const response = await fetch(`/api/trips/${tripId}/weather`, { credentials: "include" });
    await ensureSuccess(response);
    return response.json();
}

export async function getReminders(tripId: number): Promise<TripReminder[]> {
    const response = await fetch(`/api/trips/${tripId}/reminders`, { credentials: "include" });
    await ensureSuccess(response);
    return response.json();
}

export async function addReminder(tripId: number, reminder: ReminderRequest): Promise<TripReminder> {
    const response = await fetch(`/api/trips/${tripId}/reminders`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(reminder) });
    await ensureSuccess(response);
    return response.json();
}

export async function updateReminder(tripId: number, reminder: TripReminder): Promise<TripReminder> {
    const response = await fetch(`/api/trips/${tripId}/reminders/${reminder.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(reminder) });
    await ensureSuccess(response);
    return response.json();
}

export async function deleteReminder(tripId: number, reminderId: number): Promise<void> {
    const response = await fetch(`/api/trips/${tripId}/reminders/${reminderId}`, { method: "DELETE", credentials: "include" });
    await ensureSuccess(response);
}

export async function getDashboardReminders(): Promise<DashboardReminder[]> {
    const response = await fetch("/api/reminders", { credentials: "include" });
    await ensureSuccess(response);
    return response.json();
}
