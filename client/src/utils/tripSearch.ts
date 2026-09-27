import type { Trip } from "../models/Trip";
import { getTripStatus, type TripStatus } from "./tripStatus";

export type TripFilter = TripStatus | "all";
export const tripSortOptions = [
    { value: "date-asc", label: "Travel date: earliest first" },
    { value: "date-desc", label: "Travel date: latest first" },
    { value: "duration-asc", label: "Trip length: shortest first" },
    { value: "duration-desc", label: "Trip length: longest first" },
    { value: "added-desc", label: "Date added: newest first" },
    { value: "added-asc", label: "Date added: oldest first" }
] as const;
export type TripSort = typeof tripSortOptions[number]["value"];

function normalize(value: string) {
    return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

export function searchTrips(trips: Trip[], query: string): Trip[] {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    return trips.filter(trip => {
        const place = normalize(`${trip.destination} ${trip.country}`);
        return words.every(word => place.includes(word));
    });
}

export function sortTrips(trips: Trip[], sort: TripSort): Trip[] {
    const direction = sort.endsWith("desc") ? -1 : 1;
    return [...trips].sort((a, b) => {
        let difference: number;
        if (sort.startsWith("duration")) difference = a.days - b.days;
        else if (sort.startsWith("added")) {
            const first = a.createdAt ? Date.parse(a.createdAt) : NaN;
            const second = b.createdAt ? Date.parse(b.createdAt) : NaN;
            // Pre-migration trips have no recorded timestamp. Keep them before dated
            // trips in ascending order, using their original ID sequence among themselves.
            difference = Number.isFinite(first) && Number.isFinite(second) ? first - second
                : Number.isFinite(first) ? 1 : Number.isFinite(second) ? -1 : a.id - b.id;
            return direction * (difference || a.id - b.id);
        } else difference = a.startDate.localeCompare(b.startDate);
        return direction * difference || a.destination.localeCompare(b.destination) || a.id - b.id;
    });
}

export function filterTrips(trips: Trip[], filter: TripFilter): Trip[] {
    return filter === "all" ? trips : trips.filter(trip => getTripStatus(trip) === filter);
}
