import { useEffect, useState } from "react";
import { getTrips, deleteTrip, updateTrip } from "./services/tripServices";
import TripForm from "./components/TripForm";
import type { Trip } from "./models/Trip";
import TripCard from "./components/TripCard";
import AuthForm from "./components/AuthForm";
import type { User } from "./models/User";
import { getCurrentUser, logout } from "./services/authServices";


import "./App.css";

function App() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function checkSession() {
      try {
        setUser(await getCurrentUser());
      } catch (sessionError) {
        setError(sessionError instanceof Error ? sessionError.message : "Failed to check your session.");
      } finally {
        setIsCheckingSession(false);
      }
    }

    checkSession();
  }, []);

  useEffect(() => {
    if (!user) {
      setTrips([]);
      return;
    }

    getTrips()
      .then(setTrips)
      .catch(loadError => {
        setError(loadError instanceof Error ? loadError.message : "Failed to load trips.");
      });
  }, [user]);

  async function handleDeleteTrip(id: number) {
    await deleteTrip(id);

    setTrips(trips.filter(trip => trip.id !== id));
  }

  async function handleUpdateTrip(updatedTrip: Trip) {
    const savedTrip = await updateTrip(updatedTrip.id, {
      destination: updatedTrip.destination,
      country: updatedTrip.country,
      startDate: updatedTrip.startDate,
      endDate: updatedTrip.endDate
    });

    setTrips(currentTrips =>
      currentTrips.map(trip => trip.id === savedTrip.id ? savedTrip : trip)
    );
  }

  async function handleLogout() {
    await logout();
    setUser(null);
  }

  if (isCheckingSession) {
    return <p>Checking your session...</p>;
  }

  if (!user) {
    return (
      <div>
        <h1>Trip Planner</h1>
        {error && <p role="alert">{error}</p>}
        <AuthForm onAuthenticated={setUser} />
      </div>
    );
  }

  return (
    <div>
      <h1>Trip Planner</h1>
      <p>Signed in as {user.email}</p>
      <button onClick={handleLogout}>Log out</button>
      {error && <p role="alert">{error}</p>}

      <TripForm
        onTripAdded={(trip) => {
          setTrips(currentTrips => [...currentTrips, trip]);
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
