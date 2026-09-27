export interface Trip {
    id: number;
    destination: string;
    country: string;
    startDate: string;
    endDate: string;
    days: number;
    createdAt: string | null;
    notes: string;
    accommodationName: string;
    accommodationAddress: string;
    bookingReference: string;
    usefulLinks: TripLink[];
    accessRole: "Owner" | "Editor" | "Viewer";
}

export interface TripLink {
    id: number;
    tripId: number;
    label: string;
    url: string;
}

export interface TripDetailsRequest {
    notes: string;
    accommodationName: string;
    accommodationAddress: string;
    bookingReference: string;
    usefulLinks: Array<{ label: string; url: string }>;
}
