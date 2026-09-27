export interface AccountSettings {
    email: string;
    displayName: string;
    language: 'en' | 'he';
    timeZone: string;
    defaultCurrency: string;
}
export type Preferences = Omit<AccountSettings, 'email'>;
export interface SettingsOptions { currencies: string[]; timeZones: string[] }
