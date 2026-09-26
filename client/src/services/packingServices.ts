import type { PackingItem, PackingItemRequest } from "../models/PackingItem";

const packingUrl = (tripId: number) => `/api/trips/${tripId}/packing`;

async function ensureSuccess(response: Response) {
    if (response.ok) return;
    const body = await response.json().catch(() => null) as { detail?: string; errors?: Record<string, string[]> } | null;
    const validationError = body?.errors ? Object.values(body.errors).flat()[0] : undefined;
    throw new Error(validationError ?? body?.detail ?? "Unable to update the packing list.");
}

export async function getPackingItems(tripId: number): Promise<PackingItem[]> {
    const response = await fetch(packingUrl(tripId), { credentials: "include" });
    await ensureSuccess(response);
    return response.json();
}

export async function addPackingItem(tripId: number, item: PackingItemRequest): Promise<PackingItem> {
    const response = await fetch(packingUrl(tripId), { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(item) });
    await ensureSuccess(response);
    return response.json();
}

export async function updatePackingItem(tripId: number, item: PackingItem): Promise<PackingItem> {
    const response = await fetch(`${packingUrl(tripId)}/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(item) });
    await ensureSuccess(response);
    return response.json();
}

export async function deletePackingItem(tripId: number, itemId: number): Promise<void> {
    const response = await fetch(`${packingUrl(tripId)}/${itemId}`, { method: "DELETE", credentials: "include" });
    await ensureSuccess(response);
}

export async function applyPackingTemplate(tripId: number, templateKey: string): Promise<PackingItem[]> {
    const response = await fetch(`${packingUrl(tripId)}/templates/${templateKey}`, { method: "POST", credentials: "include" });
    await ensureSuccess(response);
    return response.json();
}
