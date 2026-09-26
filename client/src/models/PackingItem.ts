export interface PackingItem {
    id: number;
    tripId: number;
    name: string;
    category: string;
    quantity: number;
    isPacked: boolean;
}

export type PackingItemRequest = Omit<PackingItem, "id" | "tripId">;
