import { t, getPreferences } from "../i18n/preferences";
import { useState } from "react";
import type { Trip, TripDetailsRequest } from "../models/Trip";
import ItineraryPanel from "./ItineraryPanel";
import PackingPanel from "./PackingPanel";
import BudgetPanel from "./BudgetPanel";
import type { TripStatus } from "../utils/tripStatus";
import SharingPanel from "./SharingPanel";
import WeatherRemindersPanel from "./WeatherRemindersPanel";

interface TripDetailsProps {
    trip: Trip;
    onDelete: (id: number) => Promise<void>;
    onUpdate: (trip: Trip) => Promise<void>;
    onUpdateDetails: (id: number, details: TripDetailsRequest) => Promise<void>;
    status: TripStatus;
}

function TripDetails({ trip, status, onDelete, onUpdate, onUpdateDetails }: TripDetailsProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [isEditingDetails, setIsEditingDetails] = useState(false);
    const [destination, setDestination] = useState(trip.destination);
    const [country, setCountry] = useState(trip.country);
    const [startDate, setStartDate] = useState(trip.startDate);
    const [endDate, setEndDate] = useState(trip.endDate);
    const [details, setDetails] = useState<TripDetailsRequest>(() => detailsFromTrip(trip));
    const [error, setError] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const canEdit = trip.accessRole !== "Viewer";
    const isOwner = trip.accessRole === "Owner";

    async function handleUpdate() {
        if (!destination.trim() || !country.trim() || !startDate || !endDate) {
            setError("Please complete every field.");
            return;
        }
        if (endDate < startDate) {
            setError("The end date cannot be before the start date.");
            return;
        }
        setIsSaving(true);
        setError("");
        try {
            await onUpdate({ ...trip, destination: destination.trim(), country: country.trim(), startDate, endDate });
            setError("");
            setIsEditing(false);
        } catch (updateError) {
            setError(updateError instanceof Error ? updateError.message : "Failed to update trip.");
        } finally {
            setIsSaving(false);
        }
    }

    async function handleDelete() {
        setIsDeleting(true);
        setError("");
        try {
            await onDelete(trip.id);
        } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : "Failed to delete trip.");
        } finally {
            setIsDeleting(false);
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
                <input aria-label={t("Destination")} type="text" value={destination} onChange={(e) => setDestination(e.target.value)} />
                <input aria-label={t("Country")} type="text" value={country} onChange={(e) => setCountry(e.target.value)} />
                <label>{t("Start date")}<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
                <label>{t("End date")}<input type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
                {error && <p className="alert" role="alert">{t(error)}</p>}
                <div className="card-actions"><button onClick={handleUpdate} disabled={isSaving}>{isSaving ? t("Saving…") : t("Save")}</button><button className="secondary-action" onClick={cancelEditing} disabled={isSaving}>{t("Cancel")}</button></div>
            </article>
        );
    }

    return (
        <article className="trip-card trip-card--open">
            <div className="trip-card__summary trip-page-summary">
                <span className="trip-card__badges"><span className={`trip-status trip-status--${status}`}>{t(status)}</span>{!isOwner && <span className="access-badge">{t("Shared ·")}{" "}{t(trip.accessRole)}</span>}</span>
                <span className="trip-card__dates">{formatDate(trip.startDate)} — {formatDate(trip.endDate)}<small>{trip.days}{" "}{t("days")}</small></span>
            </div>
            <div className="trip-details">
                {error && !isEditingDetails && <p className="alert" role="alert">{t(error)}</p>}
                <div className="trip-details__heading"><div><span className="eyebrow">{t("Trip details")}</span><h3>{t("Everything in one place")}</h3></div>{!isEditingDetails && canEdit && <button className="text-action" onClick={() => { setDetails(detailsFromTrip(trip)); setIsEditingDetails(true); }}>{t("Edit details")}</button>}</div>

                {isEditingDetails ? <div className="details-form">
                    <label>{t("Notes")}<textarea value={details.notes} onChange={e => setDetails({ ...details, notes: e.target.value })} placeholder={t("Ideas, reminders, and plans…")} maxLength={4000} /></label>
                    <div className="details-form__row"><label>{t("Accommodation")}<input value={details.accommodationName} onChange={e => setDetails({ ...details, accommodationName: e.target.value })} placeholder={t("Hotel or rental name")} /></label><label>{t("Booking reference")}<input value={details.bookingReference} onChange={e => setDetails({ ...details, bookingReference: e.target.value })} placeholder={t("Confirmation number")} /></label></div>
                    <label>{t("Accommodation address")}<input value={details.accommodationAddress} onChange={e => setDetails({ ...details, accommodationAddress: e.target.value })} placeholder={t("Street, city, country")} /></label>
                    <div className="links-editor"><div className="links-editor__heading"><strong>{t("Useful links")}</strong><button type="button" className="text-action" onClick={() => setDetails(current => ({ ...current, usefulLinks: [...current.usefulLinks, { label: "", url: "" }] }))}>{t("+ Add link")}</button></div>
                        {details.usefulLinks.map((link, index) => <div className="link-row" key={index}><input aria-label={t("Link label")} value={link.label} onChange={e => updateLink(index, "label", e.target.value)} placeholder={t("Airline, hotel…")} /><input aria-label={t("Link URL")} type="url" value={link.url} onChange={e => updateLink(index, "url", e.target.value)} placeholder={t("https://")} /><button aria-label={t("Remove link")} className="remove-link" onClick={() => setDetails(current => ({ ...current, usefulLinks: current.usefulLinks.filter((_, linkIndex) => linkIndex !== index) }))}>×</button></div>)}
                    </div>
                    {error && <p className="alert" role="alert">{t(error)}</p>}
                    <div className="card-actions"><button onClick={saveDetails} disabled={isSaving}>{isSaving ? t("Saving…") : t("Save details")}</button><button className="secondary-action" disabled={isSaving} onClick={() => { setIsEditingDetails(false); setError(""); }}>{t("Cancel")}</button></div>
                </div> : <DetailsView trip={trip} />}

                {!isEditingDetails && <ItineraryPanel tripId={trip.id} startDate={trip.startDate} endDate={trip.endDate} canEdit={canEdit} />}
                {!isEditingDetails && <PackingPanel tripId={trip.id} canEdit={canEdit} />}
                {!isEditingDetails && <BudgetPanel tripId={trip.id} canEdit={canEdit} />}
                {!isEditingDetails && <WeatherRemindersPanel tripId={trip.id} startDate={trip.startDate} canEdit={canEdit} />}
                {!isEditingDetails && <SharingPanel tripId={trip.id} />}
                {!isEditingDetails && canEdit && <div className="trip-card__footer"><button className="text-action" onClick={() => setIsEditing(true)}>{t("Edit trip")}</button>{isOwner && <button className="text-action text-action--danger" disabled={isDeleting} onClick={handleDelete}>{isDeleting ? t("Deleting…") : t("Delete trip")}</button>}</div>}
            </div>
        </article>
    );
}

function DetailsView({ trip }: { trip: Trip }) {
    const usefulLinks = trip.usefulLinks ?? [];
    const hasDetails = trip.notes || trip.accommodationName || trip.accommodationAddress || trip.bookingReference || usefulLinks.length > 0;
    if (!hasDetails) return <div className="details-empty"><span>⌁</span><p>{t("No details yet. Add notes, a stay, booking references, or useful links.")}</p></div>;
    return <div className="details-view">
        {trip.notes && <section className="detail-block detail-block--wide"><small>{t("Notes")}</small><p>{trip.notes}</p></section>}
        {(trip.accommodationName || trip.accommodationAddress) && <section className="detail-block"><small>{t("Accommodation")}</small><strong>{trip.accommodationName}</strong><p>{trip.accommodationAddress}</p></section>}
        {trip.bookingReference && <section className="detail-block"><small>{t("Booking reference")}</small><strong>{trip.bookingReference}</strong></section>}
        {usefulLinks.length > 0 && <section className="detail-block detail-block--wide"><small>{t("Useful links")}</small><div className="saved-links">{usefulLinks.map(link => <a key={link.id} href={link.url} target="_blank" rel="noreferrer">{link.label}<span>↗</span></a>)}</div></section>}
    </div>;
}

function detailsFromTrip(trip: Trip): TripDetailsRequest {
    return { notes: trip.notes ?? "", accommodationName: trip.accommodationName ?? "", accommodationAddress: trip.accommodationAddress ?? "", bookingReference: trip.bookingReference ?? "", usefulLinks: (trip.usefulLinks ?? []).map(({ label, url }) => ({ label, url })) };
}

function formatDate(date: string) {
    return new Intl.DateTimeFormat(getPreferences().language, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T00:00:00`));
}

export default TripDetails;
