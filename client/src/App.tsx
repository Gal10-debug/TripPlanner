import { useEffect, useState } from 'react'
import { getTrips } from './services/tripServices';

import './App.css'


interface Trip {
    id: number;
    destination: string;
    country: string;
    days: number;
}



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
