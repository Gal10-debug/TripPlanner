import type { ItineraryItem, ItineraryItemRequest } from "../models/ItineraryItem";

function itineraryUrl(tripId: number) {
    return `/api/trips/${tripId}/itinerary`;
}

async function errorMessage(response: Response) {
    const body = await response.json().catch(() => null) as { detail?: string; errors?: Record<string, string[]> } | null;
    return body?.errors ? Object.values(body.errors).flat()[0] : body?.detail ?? "Unable to update the itinerary.";
}

export async function getItinerary(tripId: number): Promise<ItineraryItem[]> {
    const response = await fetch(itineraryUrl(tripId), { credentials: "include" });
    if (!response.ok) throw new Error(await errorMessage(response));
    return response.json();
}

export async function addItineraryItem(tripId: number, item: ItineraryItemRequest): Promise<ItineraryItem> {
    const response = await fetch(itineraryUrl(tripId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(item)
    });
    if (!response.ok) throw new Error(await errorMessage(response));
    return response.json();
}

export async function updateItineraryItem(tripId: number, itemId: number, item: ItineraryItemRequest): Promise<ItineraryItem> {
    const response = await fetch(`${itineraryUrl(tripId)}/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(item)
    });
    if (!response.ok) throw new Error(await errorMessage(response));
    return response.json();
}

export async function deleteItineraryItem(tripId: number, itemId: number): Promise<void> {
    const response = await fetch(`${itineraryUrl(tripId)}/${itemId}`, { method: "DELETE", credentials: "include" });
    if (!response.ok) throw new Error(await errorMessage(response));
}
