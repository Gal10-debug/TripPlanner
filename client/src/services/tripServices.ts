import type { Trip } from "../models/Trip";

export async function getTrips(): Promise<Trip[]> {
    const response = await fetch("http://localhost:5075/api/trips");

    if (!response.ok) {
        throw new Error("Failed to fetch trips");
    }

    return response.json();
}