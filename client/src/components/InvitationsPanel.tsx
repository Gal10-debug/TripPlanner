import { t } from "../i18n/preferences";
import { useEffect, useState } from "react";
import type { ReceivedInvitation } from "../models/Sharing";
import { getReceivedInvitations, respondToInvitation } from "../services/sharingServices";

function InvitationsPanel({ onAccepted }: { onAccepted: () => Promise<void> }) {
    const [invitations, setInvitations] = useState<ReceivedInvitation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [error, setError] = useState("");

    useEffect(() => { getReceivedInvitations().then(setInvitations).catch(() => setError("Unable to load invitations.")).finally(() => setIsLoading(false)); }, []);

    async function respond(invitation: ReceivedInvitation, response: "accept" | "decline") {
        setBusyId(invitation.id);
        setError("");
        try {
            await respondToInvitation(invitation.id, response);
            setInvitations(current => current.filter(item => item.id !== invitation.id));
            if (response === "accept") await onAccepted();
        } catch (responseError) { setError(responseError instanceof Error ? responseError.message : "Unable to respond."); }
        finally { setBusyId(null); }
    }

    if (isLoading) return <p role="status">{t("Loading invitations…")}</p>;
    if (invitations.length === 0 && !error) return <div className="empty-state"><h2>{t("No pending invitations")}</h2><p>{t("Invitations from your travel companions will appear here.")}</p></div>;
    return <section className="invitation-banner"><div><span className="eyebrow">{t("Invitations")}</span><h2>{t("Someone wants to travel with you")}</h2></div>{error && <p className="alert">{t(error)}</p>}{invitations.map(invitation => <article key={invitation.id}><div><strong>{invitation.destination}, {invitation.country}</strong><span>{t("You’ve been invited as")}{" "}{t(invitation.role.toLowerCase())}.</span></div><div><button disabled={busyId === invitation.id} onClick={() => respond(invitation, "accept")}>{t("Accept")}</button><button disabled={busyId === invitation.id} onClick={() => respond(invitation, "decline")}>{t("Decline")}</button></div></article>)}</section>;
}

export default InvitationsPanel;
