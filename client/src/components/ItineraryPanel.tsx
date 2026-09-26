import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { ItineraryItem, ItineraryItemRequest } from "../models/ItineraryItem";
import { addItineraryItem, deleteItineraryItem, getItinerary, updateItineraryItem } from "../services/itineraryServices";

interface ItineraryPanelProps {
    tripId: number;
    startDate: string;
    endDate: string;
}

const emptyItem = (date: string): ItineraryItemRequest => ({ title: "", date, time: "09:00", location: "", note: "" });

function ItineraryPanel({ tripId, startDate, endDate }: ItineraryPanelProps) {
    const [items, setItems] = useState<ItineraryItem[]>([]);
    const [draft, setDraft] = useState<ItineraryItemRequest>(() => emptyItem(startDate));
    const [editingId, setEditingId] = useState<number | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        getItinerary(tripId)
            .then(data => { if (active) setItems(data); })
            .catch(loadError => { if (active) setError(loadError instanceof Error ? loadError.message : "Failed to load itinerary."); })
            .finally(() => { if (active) setIsLoading(false); });
        return () => { active = false; };
    }, [tripId]);

    const groupedItems = useMemo(() => {
        const groups = new Map<string, ItineraryItem[]>();
        for (const item of items) {
            const group = groups.get(item.date) ?? [];
            group.push(item);
            groups.set(item.date, group);
        }
        return [...groups.entries()].sort(([first], [second]) => first.localeCompare(second));
    }, [items]);

    async function submitItem(event: FormEvent) {
        event.preventDefault();
        setError("");
        setIsSaving(true);
        try {
            if (editingId === null) {
                const created = await addItineraryItem(tripId, draft);
                setItems(current => sortItems([...current, created]));
            } else {
                const updated = await updateItineraryItem(tripId, editingId, draft);
                setItems(current => sortItems(current.map(item => item.id === editingId ? updated : item)));
            }
            closeForm();
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : "Failed to save activity.");
        } finally {
            setIsSaving(false);
        }
    }

    async function removeItem(itemId: number) {
        setError("");
        try {
            await deleteItineraryItem(tripId, itemId);
            setItems(current => current.filter(item => item.id !== itemId));
        } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : "Failed to delete activity.");
        }
    }

    function editItem(item: ItineraryItem) {
        setDraft({ title: item.title, date: item.date, time: item.time.slice(0, 5), location: item.location, note: item.note });
        setEditingId(item.id);
        setIsAdding(true);
        setError("");
    }

    function closeForm() {
        setDraft(emptyItem(startDate));
        setEditingId(null);
        setIsAdding(false);
    }

    return <section className="itinerary-panel">
        <div className="itinerary-heading">
            <div><span className="eyebrow">Daily itinerary</span><h3>Plan each day</h3></div>
            {!isAdding && <button className="text-action" onClick={() => setIsAdding(true)}>+ Add activity</button>}
        </div>

        {isAdding && <form className="activity-form" onSubmit={submitItem}>
            <div className="activity-form__row"><label>Activity<input value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} placeholder="Museum visit, dinner…" maxLength={200} required /></label><label>Day<input type="date" min={startDate} max={endDate} value={draft.date} onChange={event => setDraft({ ...draft, date: event.target.value })} required /></label><label>Time<input type="time" value={draft.time} onChange={event => setDraft({ ...draft, time: event.target.value })} required /></label></div>
            <label>Location<input value={draft.location} onChange={event => setDraft({ ...draft, location: event.target.value })} placeholder="Address or meeting point" maxLength={300} /></label>
            <label>Note<textarea value={draft.note} onChange={event => setDraft({ ...draft, note: event.target.value })} placeholder="Tickets, what to bring, or anything useful…" maxLength={2000} /></label>
            <div className="card-actions"><button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : editingId === null ? "Add activity" : "Save activity"}</button><button type="button" className="secondary-action" onClick={closeForm}>Cancel</button></div>
        </form>}

        {error && <p className="alert" role="alert">{error}</p>}
        {isLoading ? <p className="itinerary-status">Loading your plans…</p> : groupedItems.length === 0 && !isAdding ? <div className="itinerary-empty"><span>◷</span><p>No activities planned yet. Add the first moment to your itinerary.</p></div> :
            <div className="itinerary-days">{groupedItems.map(([date, dayItems], dayIndex) => <section className="itinerary-day" key={date}>
                <div className="day-label"><span>Day {daysBetween(startDate, date) + 1}</span><strong>{formatDay(date)}</strong></div>
                <div className="day-timeline">{dayItems.map(item => <article className="activity-item" key={item.id}>
                    <time>{formatTime(item.time)}</time><span className="timeline-dot" aria-hidden="true" />
                    <div className="activity-copy"><strong>{item.title}</strong>{item.location && <span>⌖ {item.location}</span>}{item.note && <p>{item.note}</p>}<div className="activity-actions"><button onClick={() => editItem(item)}>Edit</button><button onClick={() => removeItem(item.id)}>Delete</button></div></div>
                </article>)}</div>
                {dayIndex < groupedItems.length - 1 && <div className="day-divider" />}
            </section>)}</div>}
    </section>;
}

function sortItems(items: ItineraryItem[]) {
    return [...items].sort((first, second) => `${first.date}${first.time}`.localeCompare(`${second.date}${second.time}`));
}

function daysBetween(start: string, date: string) {
    return Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) / 86400000);
}

function formatDay(date: string) {
    return new Intl.DateTimeFormat("en", { weekday: "long", month: "short", day: "numeric" }).format(new Date(`${date}T00:00:00`));
}

function formatTime(time: string) {
    const [hours, minutes] = time.split(":").map(Number);
    return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, hours, minutes));
}

export default ItineraryPanel;
