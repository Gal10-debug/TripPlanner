import type { Trip } from "../models/Trip";

interface TripCardProps {
    trip: Trip;
    onDelete: (id: number) => void;
}

function TripCard({ trip, onDelete }: TripCardProps) {
    return (
        <div>
            <h2>Destination: {trip.destination}</h2>
            <p>Country: {trip.country}</p>
            <p>Days: {trip.days}</p>
            <button onClick={() => onDelete(trip.id)}>
                Delete Trip
            </button>
        </div>
    );
}

export default TripCard;