export interface ItineraryItem {
    id: number;
    tripId: number;
    title: string;
    date: string;
    time: string;
    location: string;
    note: string;
}

export type ItineraryItemRequest = Omit<ItineraryItem, "id" | "tripId">;
