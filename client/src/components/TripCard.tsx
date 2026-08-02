import { useState } from "react";
import type { Trip } from "../models/Trip";

interface TripCardProps {
    trip: Trip;
    onDelete: (id: number) => void;
    onUpdate: (trip: Trip) => Promise<void>;
}

function TripCard({ trip, onDelete, onUpdate }: TripCardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [destination, setDestination] = useState(trip.destination);
    const [country, setCountry] = useState(trip.country);
    const [startDate, setStartDate] = useState(trip.startDate);
    const [endDate, setEndDate] = useState(trip.endDate);
    const [error, setError] = useState("");

    async function handleUpdate() {
        if (!destination.trim() || !country.trim() || !startDate || !endDate) {
            setError("Please complete every field.");
            return;
        }

        if (endDate < startDate) {
            setError("The end date cannot be before the start date.");
            return;
        }

        await onUpdate({
            ...trip,
            destination: destination.trim(),
            country: country.trim(),
            startDate,
            endDate
        });
        setError("");
        setIsEditing(false);
    }

    function cancelEditing() {
        setDestination(trip.destination);
        setCountry(trip.country);
        setStartDate(trip.startDate);
        setEndDate(trip.endDate);
        setError("");
        setIsEditing(false);
    }

    if (isEditing) {
        return (
            <div>
                <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                />
                <input
                    type="text"
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
                <button onClick={handleUpdate}>Save</button>
                <button onClick={cancelEditing}>Cancel</button>
            </div>
        );
    }

    return (
        <div>
            <h2>Destination: {trip.destination}</h2>
            <p>Country: {trip.country}</p>
            <p>Dates: {trip.startDate} to {trip.endDate}</p>
            <p>Days: {trip.days}</p>
            <button onClick={() => onDelete(trip.id)}>
                Delete Trip
            </button>
            <button onClick={() => setIsEditing(true)}>
                Edit Trip
            </button>
        </div>
    );
}

export default TripCard;
