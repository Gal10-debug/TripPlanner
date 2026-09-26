import type { Trip } from "../models/Trip";

export type TripStatus = "upcoming" | "current" | "completed";

export function getTripStatus(trip: Trip, today = localDateKey()): TripStatus {
    if (trip.startDate > today) return "upcoming";
    if (trip.endDate < today) return "completed";
    return "current";
}

export function sortTripsByStatus(trips: Trip[], status: TripStatus, today = localDateKey()) {
    return trips
        .filter(trip => getTripStatus(trip, today) === status)
        .sort((first, second) => status === "completed"
            ? second.endDate.localeCompare(first.endDate)
            : first.startDate.localeCompare(second.startDate));
}

function localDateKey() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
