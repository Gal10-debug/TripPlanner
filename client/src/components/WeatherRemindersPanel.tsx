import { t, getPreferences, todayKey } from "../i18n/preferences";
import { useEffect, useState, type FormEvent } from "react";
import type { TripReminder, WeatherForecast } from "../models/WeatherReminder";
import { addReminder, deleteReminder, getReminders, getWeather, updateReminder } from "../services/weatherReminderServices";

interface WeatherRemindersPanelProps {
    tripId: number;
    startDate: string;
    canEdit: boolean;
}

function WeatherRemindersPanel({ tripId, startDate, canEdit }: WeatherRemindersPanelProps) {
    const [weather, setWeather] = useState<WeatherForecast | null>(null);
    const [isLoadingReminders, setIsLoadingReminders] = useState(true);
    const [reminders, setReminders] = useState<TripReminder[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [title, setTitle] = useState("");
    const [dueDate, setDueDate] = useState(startDate);
    const [weatherError, setWeatherError] = useState("");
    const [reminderError, setReminderError] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        let active = true;
        getWeather(tripId).then(data => { if (active) setWeather(data); }).catch(error => { if (active) setWeatherError(error instanceof Error ? error.message : "Weather is unavailable."); });
        getReminders(tripId).then(data => { if (active) setReminders(data); }).catch(error => { if (active) setReminderError(error instanceof Error ? error.message : "Reminders are unavailable."); }).finally(() => { if (active) setIsLoadingReminders(false); });
        return () => { active = false; };
    }, [tripId]);

    async function submitReminder(event: FormEvent) {
        event.preventDefault();
        setIsSaving(true);
        setReminderError("");
        try {
            const created = await addReminder(tripId, { title, dueDate, isCompleted: false });
            setReminders(current => sortReminders([...current, created]));
            setTitle("");
            setShowForm(false);
        } catch (error) { setReminderError(error instanceof Error ? error.message : "Failed to add reminder."); }
        finally { setIsSaving(false); }
    }

    async function toggleReminder(reminder: TripReminder) {
        setIsSaving(true);
        setReminderError("");
        try {
            const updated = await updateReminder(tripId, { ...reminder, isCompleted: !reminder.isCompleted });
            setReminders(current => sortReminders(current.map(item => item.id === reminder.id ? updated : item)));
        } catch (error) { setReminderError(error instanceof Error ? error.message : "Failed to update reminder."); }
        finally { setIsSaving(false); }
    }

    async function removeReminder(reminderId: number) {
        setIsSaving(true);
        setReminderError("");
        try { await deleteReminder(tripId, reminderId); setReminders(current => current.filter(item => item.id !== reminderId)); }
        catch (error) { setReminderError(error instanceof Error ? error.message : "Failed to delete reminder."); }
        finally { setIsSaving(false); }
    }

    return <section className="weather-reminders-panel">
        <div className="weather-block">
            <div className="travel-section-heading"><div><span className="eyebrow">{t("Destination weather")}</span><h3>{t("Forecast for your journey")}</h3></div>{weather?.location && <small>{weather.location.name}, {weather.location.country}</small>}</div>
            {weatherError ? <p className="inline-notice inline-notice--error">{t(weatherError)}</p> : !weather ? <p className="travel-status">{t("Checking the forecast…")}</p> : !weather.available ? <div className="forecast-waiting"><span>◌</span><div><strong>{t("Not forecast time yet")}</strong><p>{weather.reason === "too-early" && weather.daysUntilAvailable !== undefined ? t("A live forecast will appear in {days} days.", { days: weather.daysUntilAvailable }) : t(weather.message ?? "")}</p></div></div> : <><div className="forecast-days">{weather.days?.map(day => <article key={day.date}><span className="weather-icon" aria-label={t(weatherLabel(day.weatherCode))}>{weatherIcon(day.weatherCode)}</span><strong>{formatWeekday(day.date)}</strong><div><b>{Math.round(day.temperatureMax)}°</b><span>{Math.round(day.temperatureMin)}°</span></div><small>☂ {day.precipitationProbability}%</small></article>)}</div><a className="weather-credit" href="https://open-meteo.com/" target="_blank" rel="noreferrer">{t("Weather by Open-Meteo ↗")}</a></>}
        </div>

        <div className="reminders-block">
            <div className="travel-section-heading"><div><span className="eyebrow">{t("Departure reminders")}</span><h3>{t("Leave nothing behind")}</h3></div>{canEdit && <button className="text-action" disabled={isLoadingReminders} onClick={() => setShowForm(value => !value)}>{t("+ Add reminder")}</button>}</div>
            {showForm && <form className="reminder-form" onSubmit={submitReminder}><label>{t("Reminder")}<input value={title} onChange={event => setTitle(event.target.value)} placeholder={t("Download offline maps…")} maxLength={200} required /></label><label>{t("Due date")}<input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} required /></label><div className="card-actions"><button type="submit" disabled={isSaving}>{t("Add reminder")}</button><button type="button" className="secondary-action" onClick={() => setShowForm(false)}>{t("Cancel")}</button></div></form>}
            {reminderError && <p className="inline-notice inline-notice--error" role="alert">{t(reminderError)}</p>}
            {isLoadingReminders ? <p className="travel-status" role="status">{t("Loading reminders…")}</p> : reminders.length === 0 && !reminderError ? <p className="travel-status">{t("No reminders yet.")}{canEdit ? t(" Add one to prepare for your trip.") : ""}</p> : <div className="reminder-list">{reminders.map(reminder => <article className={reminder.isCompleted ? "reminder-item reminder-item--done" : "reminder-item"} key={reminder.id}><label><input type="checkbox" checked={reminder.isCompleted} disabled={!canEdit || isSaving} onChange={() => toggleReminder(reminder)} /><span className="custom-check">✓</span><span><strong>{reminder.isAutomatic ? t(reminder.title) : reminder.title}</strong><small>{relativeDueDate(reminder.dueDate)}{reminder.isAutomatic ? t(" · Suggested") : ""}</small></span></label>{canEdit && !reminder.isAutomatic && <button disabled={isSaving} onClick={() => removeReminder(reminder.id)}>×</button>}</article>)}</div>}
        </div>
    </section>;
}

function sortReminders(reminders: TripReminder[]) { return [...reminders].sort((a, b) => Number(a.isCompleted) - Number(b.isCompleted) || a.dueDate.localeCompare(b.dueDate)); }
function formatWeekday(date: string) { return new Intl.DateTimeFormat(getPreferences().language, { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${date}T00:00:00`)); }
function relativeDueDate(date: string) { const days = Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${todayKey()}T00:00:00`).getTime()) / 86400000); if (getPreferences().language === "he") return days < 0 ? t("{days} days overdue", { days: Math.abs(days) }) : days === 0 ? t("Due today") : t("Due in {days} days", { days }); return days < 0 ? `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue` : days === 0 ? "Due today" : `Due in ${days} day${days === 1 ? "" : "s"}`; }

function weatherIcon(code: number) { if (code === 0) return "☀"; if (code <= 3) return "◒"; if (code <= 48) return "≋"; if (code <= 67 || code >= 80 && code <= 82) return "☂"; if (code <= 77 || code >= 85 && code <= 86) return "❄"; return "ϟ"; }
function weatherLabel(code: number) { if (code === 0) return "Clear"; if (code <= 3) return "Cloudy"; if (code <= 48) return "Foggy"; if (code <= 67 || code >= 80 && code <= 82) return "Rain"; if (code <= 77 || code >= 85 && code <= 86) return "Snow"; return "Thunderstorm"; }

export default WeatherRemindersPanel;
