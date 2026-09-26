export type SharingRole = "Owner" | "Editor" | "Viewer";

export interface TripMemberInfo {
    userId: string;
    email: string;
    role: SharingRole;
}

export interface PendingTripInvitation {
    id: number;
    email: string;
    role: "Editor" | "Viewer";
}

export interface SharingOverview {
    currentUserRole: SharingRole;
    ownerEmail: string;
    members: TripMemberInfo[];
    invitations: PendingTripInvitation[];
}

export interface ReceivedInvitation {
    id: number;
    tripId: number;
    destination: string;
    country: string;
    role: "Editor" | "Viewer";
    email: string;
}
