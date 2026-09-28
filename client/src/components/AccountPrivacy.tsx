import { useState } from 'react';
import { t } from '../i18n/preferences';

export default function AccountPrivacy() {
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    async function act(deleting: boolean) {
        setBusy(true); setError('');
        try {
            const response = await fetch(deleting ? '/api/account' : '/api/account/export', {
                method: deleting ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password, confirmation }),
            });
            if (!response.ok) { const body = await response.json(); throw new Error(body.detail ?? 'Unable to complete the request.'); }
            if (deleting) { window.location.assign('/'); return; }
            const url = URL.createObjectURL(await response.blob());
            const link = document.createElement('a'); link.href = url; link.download = 'tripplanner-account.json'; link.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            setPassword('');
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to complete the request.'); }
        finally { setBusy(false); }
    }
    return <section className="settings-form account-privacy" aria-labelledby="privacy-title"><h2 id="privacy-title">{t('Your data and privacy')}</h2>
        <p>{t('Export your profile, preferences, and owned trips as JSON. Shared trips remain with their owners.')}</p>
        <label>{t('Current password')}<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></label>
        <button type="button" className="button" disabled={busy || !password} onClick={() => act(false)}>{t('Download my data')}</button>
        <hr /><h3>{t('Delete account')}</h3><p>{t('This permanently deletes your account and all trips you own, including access for collaborators. Trips owned by other people are kept. Backups expire according to the retention policy.')}</p>
        <label>{t('Type DELETE to confirm')}<input value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="off" disabled={busy} /></label>
        <button type="button" className="button privacy-delete" disabled={busy || !password || confirmation !== 'DELETE'} onClick={() => act(true)}>{t('Permanently delete my account')}</button>
        {busy && <p role="status">{t('Processing…')}</p>}{error && <p className="alert" role="alert">{t(error)}</p>}
    </section>;
}
