import CountryCityFields from "./CountryCityFields";
import { t } from "../i18n/preferences";
import { useState } from "react";
import { addTrip } from "../services/tripServices";
import type { Trip } from "../models/Trip";

interface TripFormProps {
    onTripAdded: (trip: Trip) => void;
}

function TripForm({ onTripAdded }: TripFormProps) {
    const [destination, setDestination] = useState("");
    const [country, setCountry] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [error, setError] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    async function handleAddTrip() {
        if (!destination.trim() || !country.trim() || !startDate || !endDate) {
            setError("Please complete every field.");
            return;
        }

        if (endDate < startDate) {
            setError("The end date cannot be before the start date.");
            return;
        }

        const newTrip = {
            destination: destination.trim(),
            country: country.trim(),
            startDate,
            endDate
        };

        setIsSaving(true);
        setError("");
        try {
            const createdTrip = await addTrip(newTrip);
            onTripAdded(createdTrip);
            setDestination(""); setCountry(""); setStartDate(""); setEndDate("");
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : "Failed to add trip");
        } finally { setIsSaving(false); }
    }

    return (
        <form onSubmit={event => { event.preventDefault(); if (!isSaving) void handleAddTrip(); }}>
            <h2>{t("Trip Form")}</h2>

            <CountryCityFields country={country} destination={destination} onCountryChange={setCountry} onDestinationChange={setDestination} disabled={isSaving} />

            <label>{t("Start date")}<input
                    type="date" disabled={isSaving}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                />
            </label>

            <label>{t("End date")}<input
                    type="date" disabled={isSaving}
                    min={startDate}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                />
            </label>

            {error && <p role="alert">{t(error)}</p>}

            <button type="submit" disabled={isSaving}>{t(isSaving ? "Saving…" : "Add Trip")}</button>
        </form>
    );
}

export default TripForm;
