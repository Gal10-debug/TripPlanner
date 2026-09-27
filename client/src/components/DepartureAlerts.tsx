import { useEffect, useState } from "react";
import type { DashboardReminder } from "../models/WeatherReminder";
import { getDashboardReminders } from "../services/weatherReminderServices";

function DepartureAlerts() {
    const [reminders, setReminders] = useState<DashboardReminder[]>([]);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        let active = true;
        getDashboardReminders()
            .then(data => { if (active) setReminders(data); })
            .catch(loadError => { if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load departure alerts."); })
            .finally(() => { if (active) setIsLoading(false); });
        return () => { active = false; };
    }, [attempt]);
    if (isLoading) return <p className="travel-status" role="status">Loading departure alerts…</p>;
    if (error) return <section className="departure-alerts"><div><span className="eyebrow">Before you go</span><h2>Departure checklist</h2></div><div><p role="alert">{error}</p><button className="button" onClick={() => { setError(""); setIsLoading(true); setAttempt(current => current + 1); }}>Retry departure alerts</button></div></section>;
    if (reminders.length === 0) return null;
    return <section className="departure-alerts"><div><span className="eyebrow">Before you go</span><h2>Departure checklist</h2></div><div>{reminders.slice(0, 5).map(reminder => <article key={reminder.id}><span>!</span><div><strong>{reminder.title}</strong><small>{reminder.destination}, {reminder.country}</small></div><time>{formatDue(reminder.dueDate)}</time></article>)}</div></section>;
}

function formatDue(date: string) { const value = new Date(`${date}T00:00:00`); const today = new Date(); today.setHours(0, 0, 0, 0); const days = Math.round((value.getTime() - today.getTime()) / 86400000); return days < 0 ? "Overdue" : days === 0 ? "Today" : `In ${days}d`; }

export default DepartureAlerts;
