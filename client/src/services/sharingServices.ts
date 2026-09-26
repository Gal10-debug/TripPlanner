import type { ReceivedInvitation, SharingOverview } from "../models/Sharing";

const sharingUrl = (tripId: number) => `/api/trips/${tripId}/sharing`;

async function parse(response: Response): Promise<SharingOverview> {
    if (!response.ok) {
        const body = await response.json().catch(() => null) as { detail?: string; errors?: Record<string, string[]> } | null;
        const validationError = body?.errors ? Object.values(body.errors).flat()[0] : undefined;
        throw new Error(validationError ?? body?.detail ?? "Unable to update trip sharing.");
    }
    return response.json();
}

export async function getSharing(tripId: number) {
    return parse(await fetch(sharingUrl(tripId), { credentials: "include" }));
}

export async function inviteMember(tripId: number, email: string, role: "Editor" | "Viewer") {
    return parse(await fetch(`${sharingUrl(tripId)}/invitations`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ email, role }) }));
}

export async function updateMemberRole(tripId: number, userId: string, role: "Editor" | "Viewer") {
    return parse(await fetch(`${sharingUrl(tripId)}/members/${userId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ role }) }));
}

export async function removeMember(tripId: number, userId: string) {
    return parse(await fetch(`${sharingUrl(tripId)}/members/${userId}`, { method: "DELETE", credentials: "include" }));
}

export async function cancelInvitation(tripId: number, invitationId: number) {
    return parse(await fetch(`${sharingUrl(tripId)}/invitations/${invitationId}`, { method: "DELETE", credentials: "include" }));
}

export async function getReceivedInvitations(): Promise<ReceivedInvitation[]> {
    const response = await fetch("/api/sharing/invitations", { credentials: "include" });
    if (!response.ok) throw new Error("Unable to load trip invitations.");
    return response.json();
}

export async function respondToInvitation(invitationId: number, response: "accept" | "decline") {
    const result = await fetch(`/api/sharing/invitations/${invitationId}/${response}`, { method: "POST", credentials: "include" });
    if (!result.ok) throw new Error(`Unable to ${response} the invitation.`);
}
