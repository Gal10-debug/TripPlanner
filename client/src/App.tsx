import { useEffect, useState } from "react";
import { getTrips, deleteTrip, updateTrip } from "./services/tripServices";
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

  async function handleUpdateTrip(updatedTrip: Trip) {
    const savedTrip = await updateTrip(updatedTrip.id, {
      destination: updatedTrip.destination,
      country: updatedTrip.country,
      days: updatedTrip.days
    });

    setTrips(currentTrips =>
      currentTrips.map(trip => trip.id === savedTrip.id ? savedTrip : trip)
    );
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
          onUpdate={handleUpdateTrip}
        />
      ))}
    </div>
  );
}

export default App;
