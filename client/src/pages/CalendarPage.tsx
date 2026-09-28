import { t, getPreferences, todayKey } from "../i18n/preferences";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { CalendarMonth } from "../models/Calendar";
import { getCalendarMonth } from "../services/calendarServices";
import { calendarDate, formatCalendarDate, isValidMonth, monthDates, shiftMonth } from "../utils/calendar";

export default function CalendarPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const today = todayKey();
    const requestedMonth = searchParams.get("month") ?? "";
    const month = isValidMonth(requestedMonth) ? requestedMonth : today.slice(0, 7);
    const dates = monthDates(month);
    const requestedDay = searchParams.get("day") ?? "";
    const selectedDay = dates.includes(requestedDay) ? requestedDay : dates.includes(today) ? today : dates[0];
    const monthLabel = new Intl.DateTimeFormat(getPreferences().language, { month: "long", year: "numeric" }).format(calendarDate(dates[0]));

    function chooseMonth(value: string) {
        if (isValidMonth(value)) setSearchParams({ month: value });
    }

    return <section className="calendar-page">
        <div className="dashboard-intro"><span className="eyebrow">{t("Your travel calendar")}</span><h1>{t("Calendar")}</h1><p>{t("See your trips and daily plans together. Select a day to explore.")}</p></div>
        <div className="calendar-toolbar">
            <h2 aria-live="polite">{monthLabel}</h2>
            <div className="calendar-controls">
                <button aria-label={t("Previous month")} disabled={month === "0001-01"} onClick={() => chooseMonth(shiftMonth(month, -1))}>←</button>
                <button onClick={() => setSearchParams({ month: today.slice(0, 7), day: today })}>{t("Today")}</button>
                <button aria-label={t("Next month")} disabled={month === "9999-12"} onClick={() => chooseMonth(shiftMonth(month, 1))}>→</button>
                <label>{t("Jump to month")}<input type="month" min="0001-01" max="9999-12" value={month} onChange={event => chooseMonth(event.target.value)} /></label>
            </div>
        </div>
        <CalendarContent key={month} month={month} monthLabel={monthLabel} selectedDay={selectedDay} today={today}
            onSelectDay={day => setSearchParams({ month, day }, { replace: true })} />
    </section>;
}

function CalendarContent({ month, monthLabel, selectedDay, today, onSelectDay }: {
    month: string; monthLabel: string; selectedDay: string; today: string; onSelectDay: (day: string) => void;
}) {
    const [data, setData] = useState<CalendarMonth | null>(null);
    const [error, setError] = useState("");
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        getCalendarMonth(month, controller.signal)
            .then(result => { if (!controller.signal.aborted) setData(result); })
            .catch(() => { if (!controller.signal.aborted) setError("Unable to load the calendar. Please try again."); });
        return () => controller.abort();
    }, [month, attempt]);

    if (error) return <div className="calendar-notice" role="alert"><p>{t(error)}</p><button className="button" onClick={() => { setError(""); setAttempt(value => value + 1); }}>{t("Retry calendar")}</button></div>;
    if (!data) return <p className="travel-status" role="status">{t("Loading calendar…")}</p>;

    const dates = monthDates(month);
    const offset = calendarDate(dates[0]).getDay();
    const cells: Array<string | null> = [...Array<string | null>(offset).fill(null), ...dates];
    while (cells.length % 7 !== 0) cells.push(null);
    const selectedTrips = data.trips.filter(trip => trip.startDate <= selectedDay && trip.endDate >= selectedDay);
    const selectedActivities = data.activities.filter(activity => activity.date === selectedDay)
        .sort((a, b) => a.time.localeCompare(b.time) || a.id - b.id);

    return <>
        <p className="calendar-summary">{data.trips.length} {data.trips.length === 1 ? t("trip") : t("trips")} · {data.activities.length} {data.activities.length === 1 ? t("activity") : t("activities")}{" "}{t("this month")}</p>
        {data.trips.length === 0 && data.activities.length === 0 && <p className="calendar-notice">{t("No trips or activities this month.")}{" "}<Link to="/trips">{t("Plan a trip")}</Link>{" "}{t("or browse another month.")}</p>}
        <div className="calendar-legend"><span>{t("● Trip")}</span><span>{t("◆ Activity")}</span><small>{t("Times are as entered in each trip’s itinerary.")}</small></div>
        <table className="month-calendar" aria-label={monthLabel}>
            <thead><tr>{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, index) => <th scope="col" key={day}><abbr title={t(day)}>{getPreferences().language === "he" ? ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"][index] : day.slice(0, 3)}</abbr></th>)}</tr></thead>
            <tbody>{Array.from({ length: cells.length / 7 }, (_, week) => <tr key={week}>{cells.slice(week * 7, week * 7 + 7).map((date, column) => {
                if (!date) return <td className="calendar-blank" key={`blank-${column}`} />;
                const trips = data.trips.filter(trip => trip.startDate <= date && trip.endDate >= date);
                const activities = data.activities.filter(activity => activity.date === date);
                const entries = [
                    ...trips.map(trip => ({ key: `trip-${trip.id}`, text: trip.destination, kind: "trip", symbol: "●" })),
                    ...activities.map(activity => ({ key: `activity-${activity.id}`, text: `${activity.time.slice(0, 5)} ${activity.title}`, kind: "activity", symbol: "◆" }))
                ];
                return <td key={date}><button className={`calendar-day${date === selectedDay ? " calendar-day--selected" : ""}`}
                    aria-label={t("{date}: {trips} trips, {activities} activities", { date: formatCalendarDate(date), trips: trips.length, activities: activities.length })}
                    aria-pressed={date === selectedDay} aria-current={date === today ? "date" : undefined} onClick={() => onSelectDay(date)}>
                    <time dateTime={date}>{Number(date.slice(-2))}</time>
                    <span className="calendar-day-events" aria-hidden="true">{entries.slice(0, 2).map(entry => <span className={`calendar-entry calendar-entry--${entry.kind}`} key={entry.key}>{entry.symbol} {entry.text}</span>)}{entries.length > 2 && <span className="calendar-more">+{entries.length - 2}{" "}{t("more")}</span>}</span>
                    {entries.length > 0 && <span className="calendar-day-count" aria-hidden="true">{entries.length}{" "}{t("plans")}</span>}
                </button></td>;
            })}</tr>)}</tbody>
        </table>
        <section className="calendar-agenda" aria-labelledby="agenda-heading">
            <h2 id="agenda-heading">{formatCalendarDate(selectedDay)}</h2>
            {selectedTrips.length === 0 && selectedActivities.length === 0 ? <p>{t("No plans on this day.")}</p> : <>
                {selectedTrips.length > 0 && <><h3>{t("Trips")}</h3><ul>{selectedTrips.map(trip => <li key={trip.id}><Link to={`/trips/${trip.id}`}><strong>{trip.destination}, {trip.country}</strong><span>{formatCalendarDate(trip.startDate)} – {formatCalendarDate(trip.endDate)}</span></Link></li>)}</ul></>}
                {selectedActivities.length > 0 && <><h3>{t("Activities")}</h3><ul>{selectedActivities.map(activity => <li key={activity.id}><Link to={`/trips/${activity.tripId}`}><strong><time>{activity.time.slice(0, 5)}</time> · {activity.title}</strong><span>{activity.destination}, {activity.country}{activity.location ? ` · ${activity.location}` : ""}</span></Link></li>)}</ul></>}
            </>}
        </section>
    </>;
}
