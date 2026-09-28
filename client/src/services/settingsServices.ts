import type { AccountSettings, Preferences, SettingsOptions } from '../models/AccountSettings';

async function read<T>(response: Response): Promise<T> {
    if (!response.ok) throw new Error('Unable to load or save settings. Please try again.');
    return response.json();
}
export async function getSettings(): Promise<AccountSettings> {
    return read(await fetch('/api/settings', { credentials: 'include' }));
}
export async function getSettingsOptions(): Promise<SettingsOptions> {
    return read(await fetch('/api/settings/options', { credentials: 'include' }));
}
export async function saveSettings(settings: Preferences): Promise<AccountSettings> {
    return read(await fetch('/api/settings', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) }));
}
