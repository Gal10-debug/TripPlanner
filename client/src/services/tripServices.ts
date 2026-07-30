import type { Trip } from "../models/Trip";
import type { CreateTripRequest } from "../models/CreateTripRequest";

export async function getTrips(): Promise<Trip[]> {
    const response = await fetch("http://localhost:5075/api/trips");

    if (!response.ok) {
        throw new Error("Failed to fetch trips");
    }

    return response.json();
}

export async function addTrip(trip: CreateTripRequest): Promise<Trip> {
    const response = await fetch("http://localhost:5075/api/trips", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(trip)
    });

    if (!response.ok) {
        throw new Error("Failed to add trip");
    }

    return response.json();
}

export async function deleteTrip(id: number): Promise<void> {
    const response = await fetch(`http://localhost:5075/api/trips/${id}`, {
        method: "DELETE"
    });

    if (!response.ok) {
        throw new Error("Failed to delete trip");
    }
}

export async function updateTrip(
    id: number,
    trip: CreateTripRequest
): Promise<Trip> {
    const response = await fetch(`http://localhost:5075/api/trips/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(trip)
    });

    if (!response.ok) {
        throw new Error("Failed to update trip");
    }

    return response.json();
}
