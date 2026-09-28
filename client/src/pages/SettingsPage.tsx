import AccountPrivacy from '../components/AccountPrivacy';
import { Link } from 'react-router-dom';
import { useEffect, useState, type FormEvent } from 'react';
import type { AccountSettings, Preferences, SettingsOptions } from '../models/AccountSettings';
import { getSettings, getSettingsOptions, saveSettings } from '../services/settingsServices';
import { setPreferences, t, usePreferences } from '../i18n/preferences';

export default function SettingsPage() {
    usePreferences();
    const [data, setData] = useState<{ account: AccountSettings; options: SettingsOptions } | null>(null);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        let active = true;
        Promise.all([getSettings(), getSettingsOptions()])
            .then(([account, options]) => { if (active) { setData({ account, options }); setPreferences(account); } })
            .catch(() => { if (active) setError('Unable to load or save settings. Please try again.'); });
        return () => { active = false; };
    }, [attempt]);
    return <section className="settings-page">
        <div className="dashboard-intro"><span className="eyebrow">{t('Your account')}</span><h1>{t('Settings')}</h1><p>{t('Make TripPlanner feel like home.')}</p></div>
        <p><Link to="/notifications">{t('Notification preferences')}</Link></p>
        {error ? <div role="alert"><p>{t(error)}</p><button className="button" onClick={() => { setError(''); setAttempt(value => value + 1); }}>{t('Retry settings')}</button></div> : !data ? <p role="status">{t('Loading settings…')}</p> : <SettingsForm account={data.account} options={data.options} />}
        {data && <AccountPrivacy />}
    </section>;
}

function SettingsForm({ account, options }: { account: AccountSettings; options: SettingsOptions }) {
    const [draft, setDraft] = useState<Preferences>(account);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    function change<K extends keyof Preferences>(key: K, value: Preferences[K]) {
        setDraft(current => ({ ...current, [key]: value }));
        setSaved(false);
    }
    async function submit(event: FormEvent) {
        event.preventDefault();
        setIsSaving(true);
        setError('');
        setSaved(false);
        try {
            const result = await saveSettings(draft);
            setDraft(result);
            setPreferences(result);
            setSaved(true);
        } catch { setError('Unable to load or save settings. Please try again.'); }
        finally { setIsSaving(false); }
    }
    return <form className="settings-form" onSubmit={submit}>
        <fieldset disabled={isSaving}><legend>{t('Profile and preferences')}</legend>
            <label>{t('Display name')}<input autoComplete="nickname" maxLength={100} value={draft.displayName} onChange={event => change('displayName', event.target.value)} /></label>
            <label>{t('Email address')}<input type="email" dir="ltr" value={account.email} readOnly /></label>
            <label>{t('Language')}<select value={draft.language} onChange={event => change('language', event.target.value as 'en' | 'he')}><option value="en">English</option><option value="he">עברית</option></select></label>
            <label>{t('Time zone')}<select dir="ltr" value={draft.timeZone} onChange={event => change('timeZone', event.target.value)}>{options.timeZones.map(zone => <option key={zone} value={zone}>{zone.replaceAll('_', ' ')}</option>)}</select></label>
            <p className="settings-hint">{t('Your time zone determines today, trip status, and reminder dates. Itinerary times stay as entered.')}</p>
            <label>{t('Default currency')}<select dir="ltr" value={draft.defaultCurrency} onChange={event => change('defaultCurrency', event.target.value)}>{options.currencies.map(currency => <option key={currency}>{currency}</option>)}</select></label>
            <p className="settings-hint">{t('Used for new trips. Existing budgets and expenses keep their currency.')}</p>
            <button className="button button--primary" type="submit">{t(isSaving ? 'Saving…' : 'Save settings')}</button>
        </fieldset>
        {error && <p className="alert" role="alert">{t(error)}</p>}
        {saved && <p className="success-message" role="status">{t('Settings saved.')}</p>}
    </form>;
}
