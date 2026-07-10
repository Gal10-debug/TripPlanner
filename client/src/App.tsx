import { useEffect, useState } from "react";
import { getTrips } from "./services/tripServices";
import TripForm from "./components/TripForm";
import type { Trip } from "./models/Trip";

import "./App.css";

function App() {
    const [trips, setTrips] = useState<Trip[]>([]);

    useEffect(() => {
        async function loadTrips() {
            const tripsData = await getTrips();
            setTrips(tripsData);
        }

        loadTrips();
    }, []);

    return (
        <div>
            <h1>Trip Planner</h1>

            <TripForm
                onTripAdded={(trip) => {
                    setTrips([...trips, trip]);
                }}
            />

            {trips.map((trip) => (
                <div key={trip.id}>
                    <h2>Destination: {trip.destination}</h2>
                    <p>Country: {trip.country}</p>
                    <p>Days: {trip.days}</p>
                </div>
            ))}
        </div>
    );
}

export default App;