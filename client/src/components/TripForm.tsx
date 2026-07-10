import { useState } from "react";
import { addTrip } from "../services/tripServices";
import type { Trip } from "../models/Trip";

interface TripFormProps {
    onTripAdded: (trip: Trip) => void;
}

function TripForm({ onTripAdded }: TripFormProps) {
    const [destination, setDestination] = useState("");
    const [country, setCountry] = useState("");
    const [days, setDays] = useState(0);

    async function handleAddTrip() {
        const newTrip = {
            destination,
            country,
            days
        };

        const createdTrip = await addTrip(newTrip);

        onTripAdded(createdTrip);

        setDestination("");
        setCountry("");
        setDays(0);
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

            <input
                type="number"
                placeholder="Days"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
            />

            <button onClick={handleAddTrip}>
                Add Trip
            </button>
        </div>
    );
}

export default TripForm;