import { useSyncExternalStore } from 'react';
import type { Preferences } from '../models/AccountSettings';
import { hebrew } from './he';

export const defaultPreferences: Preferences = { displayName: '', language: 'en', timeZone: 'UTC', defaultCurrency: 'USD' };
let preferences = defaultPreferences;
const listeners = new Set<() => void>();
export function getPreferences() { return preferences; }
export function setPreferences(value: Preferences) {
    preferences = { displayName: value.displayName, language: value.language, timeZone: value.timeZone, defaultCurrency: value.defaultCurrency };
    document.documentElement.lang = preferences.language;
    document.documentElement.dir = preferences.language === 'he' ? 'rtl' : 'ltr';
    listeners.forEach(listener => listener());
}
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function usePreferences() { return useSyncExternalStore(subscribe, getPreferences); }
export function t(text: string, values: Record<string, string | number> = {}): string {
    const translated = preferences.language === 'he' ? hebrew[text] ?? text : text;
    return translated.replace(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match));
}
export function todayKey(date = new Date(), timeZone = preferences.timeZone): string {
    const parts = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const value = (type: string) => parts.find(part => part.type === type)!.value;
    return `${value('year')}-${value('month')}-${value('day')}`;
}
