import { useEffect, useState } from "react";
import type { DashboardReminder } from "../models/WeatherReminder";
import { getDashboardReminders } from "../services/weatherReminderServices";

function DepartureAlerts() {
    const [reminders, setReminders] = useState<DashboardReminder[]>([]);
    useEffect(() => { getDashboardReminders().then(setReminders).catch(() => undefined); }, []);
    if (reminders.length === 0) return null;
    return <section className="departure-alerts"><div><span className="eyebrow">Before you go</span><h2>Departure checklist</h2></div><div>{reminders.slice(0, 5).map(reminder => <article key={reminder.id}><span>!</span><div><strong>{reminder.title}</strong><small>{reminder.destination}, {reminder.country}</small></div><time>{formatDue(reminder.dueDate)}</time></article>)}</div></section>;
}

function formatDue(date: string) { const value = new Date(`${date}T00:00:00`); const today = new Date(); today.setHours(0, 0, 0, 0); const days = Math.round((value.getTime() - today.getTime()) / 86400000); return days < 0 ? "Overdue" : days === 0 ? "Today" : `In ${days}d`; }

export default DepartureAlerts;
