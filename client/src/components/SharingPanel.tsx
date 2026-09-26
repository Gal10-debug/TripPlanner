import { useEffect, useState, type FormEvent } from "react";
import type { SharingOverview } from "../models/Sharing";
import { cancelInvitation, getSharing, inviteMember, removeMember, updateMemberRole } from "../services/sharingServices";

function SharingPanel({ tripId }: { tripId: number }) {
    const [sharing, setSharing] = useState<SharingOverview | null>(null);
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<"Editor" | "Viewer">("Editor");
    const [showInvite, setShowInvite] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        getSharing(tripId).then(data => { if (active) setSharing(data); }).catch(loadError => { if (active) setError(loadError instanceof Error ? loadError.message : "Failed to load sharing."); });
        return () => { active = false; };
    }, [tripId]);

    async function submitInvite(event: FormEvent) {
        event.preventDefault();
        setIsSaving(true);
        setError("");
        try {
            setSharing(await inviteMember(tripId, email, role));
            setEmail("");
            setShowInvite(false);
        } catch (inviteError) { setError(inviteError instanceof Error ? inviteError.message : "Failed to send invitation."); }
        finally { setIsSaving(false); }
    }

    async function changeRole(userId: string, nextRole: "Editor" | "Viewer") {
        setIsSaving(true);
        try { setSharing(await updateMemberRole(tripId, userId, nextRole)); }
        catch (updateError) { setError(updateError instanceof Error ? updateError.message : "Failed to update access."); }
        finally { setIsSaving(false); }
    }

    async function remove(userId: string) {
        setIsSaving(true);
        try { setSharing(await removeMember(tripId, userId)); }
        catch (removeError) { setError(removeError instanceof Error ? removeError.message : "Failed to remove member."); }
        finally { setIsSaving(false); }
    }

    async function cancel(invitationId: number) {
        setIsSaving(true);
        try { setSharing(await cancelInvitation(tripId, invitationId)); }
        catch (cancelError) { setError(cancelError instanceof Error ? cancelError.message : "Failed to cancel invitation."); }
        finally { setIsSaving(false); }
    }

    const isOwner = sharing?.currentUserRole === "Owner";

    return <section className="sharing-panel">
        <div className="sharing-heading"><div><span className="eyebrow">Trip sharing</span><h3>Plan together</h3></div>{isOwner && <button className="text-action" onClick={() => setShowInvite(value => !value)}>+ Invite someone</button>}</div>
        {showInvite && <form className="invite-form" onSubmit={submitInvite}><label>Email address<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="friend@example.com" required /></label><label>Permission<select value={role} onChange={event => setRole(event.target.value as "Editor" | "Viewer")}><option value="Editor">Can edit</option><option value="Viewer">View only</option></select></label><div className="card-actions"><button type="submit" disabled={isSaving}>Send invite</button><button type="button" className="secondary-action" onClick={() => setShowInvite(false)}>Cancel</button></div></form>}
        {error && <p className="alert" role="alert">{error}</p>}
        {!sharing ? !error && <p className="sharing-status">Loading people…</p> : <div className="people-list">
            <article><span className="person-avatar">{initials(sharing.ownerEmail)}</span><div><strong>{sharing.ownerEmail}</strong><small>Trip owner</small></div><span className="role-badge">Owner</span></article>
            {sharing.members.map(member => <article key={member.userId}><span className="person-avatar">{initials(member.email)}</span><div><strong>{member.email}</strong><small>Trip member</small></div>{isOwner ? <select disabled={isSaving} value={member.role} onChange={event => changeRole(member.userId, event.target.value as "Editor" | "Viewer")}><option value="Editor">Can edit</option><option value="Viewer">View only</option></select> : <span className="role-badge">{member.role}</span>}{isOwner && <button className="remove-person" disabled={isSaving} onClick={() => remove(member.userId)}>Remove</button>}</article>)}
            {sharing.invitations.map(invitation => <article className="person-pending" key={invitation.id}><span className="person-avatar">…</span><div><strong>{invitation.email}</strong><small>Invitation pending · {invitation.role}</small></div><button className="remove-person" disabled={isSaving} onClick={() => cancel(invitation.id)}>Cancel</button></article>)}
        </div>}
    </section>;
}

function initials(email: string) {
    return email.slice(0, 2).toUpperCase();
}

export default SharingPanel;
