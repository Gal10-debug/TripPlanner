import type { Trip, TripDetailsRequest } from "../models/Trip";
import type { CreateTripRequest } from "../models/CreateTripRequest";

export async function getTrips(): Promise<Trip[]> {
    const response = await fetch("/api/trips", {
        credentials: "include"
    });

    if (!response.ok) {
        throw new Error("Failed to fetch trips");
    }

    const trips = await response.json() as Trip[];
    return trips.map(normalizeTrip);
}

export async function addTrip(trip: CreateTripRequest): Promise<Trip> {
    const response = await fetch("/api/trips", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(trip)
    });

    if (!response.ok) {
        throw new Error("Failed to add trip");
    }

    return normalizeTrip(await response.json() as Trip);
}

export async function deleteTrip(id: number): Promise<void> {
    const response = await fetch(`/api/trips/${id}`, {
        method: "DELETE",
        credentials: "include"
    });

    if (!response.ok) {
        throw new Error("Failed to delete trip");
    }
}

export async function updateTrip(
    id: number,
    trip: CreateTripRequest
): Promise<Trip> {
    const response = await fetch(`/api/trips/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(trip)
    });

    if (!response.ok) {
        const body = await response.json().catch(() => null) as { detail?: string; errors?: Record<string, string[]> } | null;
        const validationError = body?.errors ? Object.values(body.errors).flat()[0] : undefined;
        throw new Error(validationError ?? body?.detail ?? "Failed to update trip");
    }

    return normalizeTrip(await response.json() as Trip);
}

export async function updateTripDetails(id: number, details: TripDetailsRequest): Promise<Trip> {
    const response = await fetch(`/api/trips/${id}/details`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(details)
    });

    if (!response.ok) {
        throw new Error("Failed to update trip details");
    }

    return normalizeTrip(await response.json() as Trip);
}

function normalizeTrip(trip: Trip): Trip {
    return {
        ...trip,
        notes: trip.notes ?? "",
        accommodationName: trip.accommodationName ?? "",
        accommodationAddress: trip.accommodationAddress ?? "",
        bookingReference: trip.bookingReference ?? "",
        usefulLinks: trip.usefulLinks ?? []
    };
}
