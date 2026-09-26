import { useState } from "react";
import type { Trip, TripDetailsRequest } from "../models/Trip";
import ItineraryPanel from "./ItineraryPanel";
import PackingPanel from "./PackingPanel";
import BudgetPanel from "./BudgetPanel";
import type { TripStatus } from "../utils/tripStatus";

interface TripCardProps {
    trip: Trip;
    onDelete: (id: number) => void;
    onUpdate: (trip: Trip) => Promise<void>;
    onUpdateDetails: (id: number, details: TripDetailsRequest) => Promise<void>;
    status: TripStatus;
}

function TripCard({ trip, status, onDelete, onUpdate, onUpdateDetails }: TripCardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [isEditingDetails, setIsEditingDetails] = useState(false);
    const [destination, setDestination] = useState(trip.destination);
    const [country, setCountry] = useState(trip.country);
    const [startDate, setStartDate] = useState(trip.startDate);
    const [endDate, setEndDate] = useState(trip.endDate);
    const [details, setDetails] = useState<TripDetailsRequest>(() => detailsFromTrip(trip));
    const [error, setError] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    async function handleUpdate() {
        if (!destination.trim() || !country.trim() || !startDate || !endDate) {
            setError("Please complete every field.");
            return;
        }
        if (endDate < startDate) {
            setError("The end date cannot be before the start date.");
            return;
        }
        try {
            await onUpdate({ ...trip, destination: destination.trim(), country: country.trim(), startDate, endDate });
            setError("");
            setIsEditing(false);
        } catch (updateError) {
            setError(updateError instanceof Error ? updateError.message : "Failed to update trip.");
        }
    }

    async function saveDetails() {
        const incompleteLink = details.usefulLinks.some(link => !link.label.trim() || !link.url.trim());
        if (incompleteLink) {
            setError("Every useful link needs both a label and a URL.");
            return;
        }
        setIsSaving(true);
        setError("");
        try {
            await onUpdateDetails(trip.id, details);
            setIsEditingDetails(false);
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : "Failed to save details.");
        } finally {
            setIsSaving(false);
        }
    }

    function cancelEditing() {
        setDestination(trip.destination);
        setCountry(trip.country);
        setStartDate(trip.startDate);
        setEndDate(trip.endDate);
        setError("");
        setIsEditing(false);
    }

    function updateLink(index: number, field: "label" | "url", value: string) {
        setDetails(current => ({ ...current, usefulLinks: current.usefulLinks.map((link, linkIndex) => linkIndex === index ? { ...link, [field]: value } : link) }));
    }

    if (isEditing) {
        return (
            <article className="trip-card trip-card--editing">
                <input aria-label="Destination" type="text" value={destination} onChange={(e) => setDestination(e.target.value)} />
                <input aria-label="Country" type="text" value={country} onChange={(e) => setCountry(e.target.value)} />
                <label>Start date<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
                <label>End date<input type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
                {error && <p className="alert" role="alert">{error}</p>}
                <div className="card-actions"><button onClick={handleUpdate}>Save</button><button className="secondary-action" onClick={cancelEditing}>Cancel</button></div>
            </article>
        );
    }

    return (
        <article className={`trip-card ${isOpen ? "trip-card--open" : ""}`}>
            <button className="trip-card__summary" onClick={() => setIsOpen(open => !open)} aria-expanded={isOpen}>
                <span className="trip-card__place"><small>{trip.country}</small><strong>{trip.destination}</strong><span className={`trip-status trip-status--${status}`}>{status}</span></span>
                <span className="trip-card__dates">{formatDate(trip.startDate)} — {formatDate(trip.endDate)}<small>{trip.days} days</small></span>
                <span className="expand-icon" aria-hidden="true">{isOpen ? "−" : "+"}</span>
            </button>

            {isOpen && <div className="trip-details">
                <div className="trip-details__heading"><div><span className="eyebrow">Trip details</span><h3>Everything in one place</h3></div>{!isEditingDetails && <button className="text-action" onClick={() => { setDetails(detailsFromTrip(trip)); setIsEditingDetails(true); }}>Edit details</button>}</div>

                {isEditingDetails ? <div className="details-form">
                    <label>Notes<textarea value={details.notes} onChange={e => setDetails({ ...details, notes: e.target.value })} placeholder="Ideas, reminders, and plans…" maxLength={4000} /></label>
                    <div className="details-form__row"><label>Accommodation<input value={details.accommodationName} onChange={e => setDetails({ ...details, accommodationName: e.target.value })} placeholder="Hotel or rental name" /></label><label>Booking reference<input value={details.bookingReference} onChange={e => setDetails({ ...details, bookingReference: e.target.value })} placeholder="Confirmation number" /></label></div>
                    <label>Accommodation address<input value={details.accommodationAddress} onChange={e => setDetails({ ...details, accommodationAddress: e.target.value })} placeholder="Street, city, country" /></label>
                    <div className="links-editor"><div className="links-editor__heading"><strong>Useful links</strong><button type="button" className="text-action" onClick={() => setDetails(current => ({ ...current, usefulLinks: [...current.usefulLinks, { label: "", url: "" }] }))}>+ Add link</button></div>
                        {details.usefulLinks.map((link, index) => <div className="link-row" key={index}><input aria-label="Link label" value={link.label} onChange={e => updateLink(index, "label", e.target.value)} placeholder="Airline, hotel…" /><input aria-label="Link URL" type="url" value={link.url} onChange={e => updateLink(index, "url", e.target.value)} placeholder="https://" /><button aria-label="Remove link" className="remove-link" onClick={() => setDetails(current => ({ ...current, usefulLinks: current.usefulLinks.filter((_, linkIndex) => linkIndex !== index) }))}>×</button></div>)}
                    </div>
                    {error && <p className="alert" role="alert">{error}</p>}
                    <div className="card-actions"><button onClick={saveDetails} disabled={isSaving}>{isSaving ? "Saving…" : "Save details"}</button><button className="secondary-action" onClick={() => { setIsEditingDetails(false); setError(""); }}>Cancel</button></div>
                </div> : <DetailsView trip={trip} />}

                {!isEditingDetails && <ItineraryPanel tripId={trip.id} startDate={trip.startDate} endDate={trip.endDate} />}
                {!isEditingDetails && <PackingPanel tripId={trip.id} />}
                {!isEditingDetails && <BudgetPanel tripId={trip.id} />}
                {!isEditingDetails && <div className="trip-card__footer"><button className="text-action" onClick={() => setIsEditing(true)}>Edit trip</button><button className="text-action text-action--danger" onClick={() => onDelete(trip.id)}>Delete trip</button></div>}
            </div>}
        </article>
    );
}

function DetailsView({ trip }: { trip: Trip }) {
    const usefulLinks = trip.usefulLinks ?? [];
    const hasDetails = trip.notes || trip.accommodationName || trip.accommodationAddress || trip.bookingReference || usefulLinks.length > 0;
    if (!hasDetails) return <div className="details-empty"><span>⌁</span><p>No details yet. Add notes, a stay, booking references, or useful links.</p></div>;
    return <div className="details-view">
        {trip.notes && <section className="detail-block detail-block--wide"><small>Notes</small><p>{trip.notes}</p></section>}
        {(trip.accommodationName || trip.accommodationAddress) && <section className="detail-block"><small>Accommodation</small><strong>{trip.accommodationName}</strong><p>{trip.accommodationAddress}</p></section>}
        {trip.bookingReference && <section className="detail-block"><small>Booking reference</small><strong>{trip.bookingReference}</strong></section>}
        {usefulLinks.length > 0 && <section className="detail-block detail-block--wide"><small>Useful links</small><div className="saved-links">{usefulLinks.map(link => <a key={link.id} href={link.url} target="_blank" rel="noreferrer">{link.label}<span>↗</span></a>)}</div></section>}
    </div>;
}

function detailsFromTrip(trip: Trip): TripDetailsRequest {
    return { notes: trip.notes ?? "", accommodationName: trip.accommodationName ?? "", accommodationAddress: trip.accommodationAddress ?? "", bookingReference: trip.bookingReference ?? "", usefulLinks: (trip.usefulLinks ?? []).map(({ label, url }) => ({ label, url })) };
}

function formatDate(date: string) {
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${date}T00:00:00`));
}

export default TripCard;
