import { useEffect, useState } from 'react'
import { addTrip, getTrips } from './services/tripServices';


import './App.css'


interface Trip {
  id: number;
  destination: string;
  country: string;
  days: number;
}



function App() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [destination, setDestination] = useState("");
  const [country, setCountry] = useState("");
  const [days, setDays] = useState(0);

  useEffect(() => {
    async function loadTrips() {
      const tripsData = await getTrips();
      setTrips(tripsData);
    }
    loadTrips();
  }, []);

  async function handleAddTrip() {
    const newTrip = {
      id: 0,
      destination,
      country,
      days
    };

    const createdTrip = await addTrip(newTrip);

    setTrips([...trips, createdTrip]);

    setDestination("");
    setCountry("");
    setDays(0);
  }

  return (
    <div>
      <h1>Trip Planner</h1>
      <div>
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
      </div>

      <button onClick={handleAddTrip}>
        Add Trip
      </button>

      {trips.map(trip => (
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
