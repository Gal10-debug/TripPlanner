import { todayKey } from "../i18n/preferences";
import type { Trip } from "../models/Trip";

export type TripStatus = "upcoming" | "current" | "completed";

export function getTripStatus(trip: Trip, today = todayKey()): TripStatus {
    if (trip.startDate > today) return "upcoming";
    if (trip.endDate < today) return "completed";
    return "current";
}

export function sortTripsByStatus(trips: Trip[], status: TripStatus, today = todayKey()) {
    return trips
        .filter(trip => getTripStatus(trip, today) === status)
        .sort((first, second) => status === "completed"
            ? second.endDate.localeCompare(first.endDate)
            : first.startDate.localeCompare(second.startDate));
}
