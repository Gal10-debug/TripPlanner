import { useEffect, useState } from "react";
import { getTrips,deleteTrip } from "./services/tripServices";
import TripForm from "./components/TripForm";
import type { Trip } from "./models/Trip";
import TripCard from "./components/TripCard";


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

  async function handleDeleteTrip(id: number) {
    await deleteTrip(id);

    setTrips(trips.filter(trip => trip.id !== id));
  }

  return (
    <div>
      <h1>Trip Planner</h1>

      <TripForm
        onTripAdded={(trip) => {
          setTrips([...trips, trip]);
        }}
      />

      {trips.map((trip) => (
        <TripCard
          key={trip.id}
          trip={trip}
          onDelete={handleDeleteTrip}
        />
      ))}
    </div>
  );
}

export default App;