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

        const createdTrip = await addTrip(newTrip);

        onTripAdded(createdTrip);

        setDestination("");
        setCountry("");
        setStartDate("");
        setEndDate("");
        setError("");
    }

    return (
        <div>
            <h2>Trip Form</h2>

            <input
                type="text"
                placeholder="Destination"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
            />

            <input
                type="text"
                placeholder="Country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
            />

            <label>
                Start date
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                />
            </label>

            <label>
                End date
                <input
                    type="date"
                    min={startDate}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                />
            </label>

            {error && <p role="alert">{error}</p>}

            <button onClick={handleAddTrip}>
                Add Trip
            </button>
        </div>
    );
}

export default TripForm;
