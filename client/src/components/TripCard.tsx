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
    const [days, setDays] = useState(trip.days);

    async function handleUpdate() {
        await onUpdate({ ...trip, destination, country, days });
        setIsEditing(false);
    }

    function cancelEditing() {
        setDestination(trip.destination);
        setCountry(trip.country);
        setDays(trip.days);
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
                <input
                    type="number"
                    min="1"
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                />
                <button onClick={handleUpdate}>Save</button>
                <button onClick={cancelEditing}>Cancel</button>
            </div>
        );
    }

    return (
        <div>
            <h2>Destination: {trip.destination}</h2>
            <p>Country: {trip.country}</p>
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
