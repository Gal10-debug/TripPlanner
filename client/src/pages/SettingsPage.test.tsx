// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SettingsPage from './SettingsPage';
import TripsPage from './TripsPage';
import CalendarPage from './CalendarPage';
import { getSettings, getSettingsOptions, saveSettings } from '../services/settingsServices';
import { getCalendarMonth } from '../services/calendarServices';
import { defaultPreferences, getPreferences, setPreferences, t, todayKey, usePreferences } from '../i18n/preferences';
import { getTripStatus } from '../utils/tripStatus';
import { formatCalendarDate } from '../utils/calendar';
import type { Trip } from '../models/Trip';

vi.mock('../services/settingsServices', () => ({ getSettings: vi.fn(), getSettingsOptions: vi.fn(), saveSettings: vi.fn() }));
vi.mock('../services/calendarServices', () => ({ getCalendarMonth: vi.fn() }));
const account = { ...defaultPreferences, email: 'me@example.test' };
beforeEach(() => {
  vi.resetAllMocks();
  setPreferences(defaultPreferences);
  vi.mocked(getSettings).mockResolvedValue(account);
  vi.mocked(getSettingsOptions).mockResolvedValue({ timeZones: ['UTC', 'Asia/Jerusalem', 'America/Los_Angeles'], currencies: ['USD', 'ILS', 'EUR'] });
});
afterEach(() => { cleanup(); setPreferences(defaultPreferences); });

it('loads the profile and saves preferences with Hebrew labels and RTL', async () => {
  const changed = { ...account, displayName: 'גל', language: 'he' as const, timeZone: 'Asia/Jerusalem', defaultCurrency: 'ILS' };
  vi.mocked(saveSettings).mockResolvedValue(changed);
  render(<SettingsPage />);
  fireEvent.change(await screen.findByLabelText('Display name'), { target: { value: 'גל' } });
  fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'he' } });
  fireEvent.change(screen.getByLabelText('Time zone'), { target: { value: 'Asia/Jerusalem' } });
  fireEvent.change(screen.getByLabelText('Default currency'), { target: { value: 'ILS' } });
  expect(document.documentElement.dir).toBe('ltr');
  fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
  expect(await screen.findByText('ההגדרות נשמרו.')).toBeTruthy();
  expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining(changed));
  expect(document.documentElement.dir).toBe('rtl');
  expect(document.documentElement.lang).toBe('he');
  expect(screen.getByLabelText('כתובת דוא״ל')).toHaveProperty('readOnly', true);
  expect(screen.getByRole('heading', { name: 'הגדרות' })).toBeTruthy();
  expect(getPreferences().defaultCurrency).toBe('ILS');
});
it('retains active preferences and unsaved inputs after a save failure', async () => {
  vi.mocked(saveSettings).mockRejectedValue(new Error('Offline'));
  render(<SettingsPage />);
  fireEvent.change(await screen.findByLabelText('Language'), { target: { value: 'he' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(document.documentElement.dir).toBe('ltr');
  expect(screen.getByLabelText('Language')).toHaveProperty('value', 'he');
});
it('retries a failed initial load', async () => {
  vi.mocked(getSettings).mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(account);
  render(<SettingsPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry settings' }));
  expect(await screen.findByLabelText('Default currency')).toHaveProperty('value', 'USD');
});
it('returns to English and LTR after saving English', async () => {
  setPreferences({ ...defaultPreferences, language: 'he' });
  vi.mocked(getSettings).mockResolvedValue({ ...account, language: 'he' });
  vi.mocked(saveSettings).mockResolvedValue(account);
  render(<SettingsPage />);
  fireEvent.change(await screen.findByLabelText('שפה'), { target: { value: 'en' } });
  fireEvent.click(screen.getByRole('button', { name: 'שמירת הגדרות' }));
  expect(await screen.findByText('Settings saved.')).toBeTruthy();
  expect(document.documentElement.dir).toBe('ltr');
});
it('calculates today in the selected zone including DST and midnight boundaries', () => {
  const instant = new Date('2026-09-27T00:30:00Z');
  expect(todayKey(instant, 'America/Los_Angeles')).toBe('2026-09-26');
  expect(todayKey(instant, 'Asia/Jerusalem')).toBe('2026-09-27');
  expect(todayKey(new Date('2026-03-08T09:30:00Z'), 'America/Los_Angeles')).toBe('2026-03-08');
  expect(todayKey(new Date('2026-03-08T10:30:00Z'), 'America/Los_Angeles')).toBe('2026-03-08');
});
it('localizes the trip list without changing route parameters or user content', () => {
  setPreferences({ ...defaultPreferences, language: 'he' });
  const trip: Trip = { id: 1, destination: 'Rome', country: 'Italy', startDate: '2099-01-01', endDate: '2099-01-02', days: 2, createdAt: null, notes: '', accommodationName: '', accommodationAddress: '', bookingReference: '', usefulLinks: [], accessRole: 'Viewer' };
  render(<MemoryRouter initialEntries={['/trips?status=upcoming']}><TripsPage trips={[trip]} isLoading={false} error="" onRetry={vi.fn()} onTripAdded={vi.fn()} /></MemoryRouter>);
  expect(screen.getByLabelText('חיפוש נסיעות')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'פתיחת הנסיעה אל Rome, Italy' }).getAttribute('href')).toBe('/trips/1');
  expect(screen.getByRole('combobox')).toHaveProperty('value', 'date-asc');
  expect(screen.getByText('בקרוב', { selector: '.trip-status' }).className).toContain('trip-status--upcoming');
});
it('localizes calendar weekdays and leaves date-only values on their original day', async () => {
  setPreferences({ ...defaultPreferences, language: 'he', timeZone: 'America/Los_Angeles' });
  vi.mocked(getCalendarMonth).mockResolvedValue({ trips: [], activities: [] });
  render(<MemoryRouter initialEntries={['/calendar?month=2026-09']}><CalendarPage /></MemoryRouter>);
  expect(await screen.findByRole('table')).toBeTruthy();
  expect(screen.getByTitle('יום ראשון')).toHaveProperty('textContent', 'א׳');
  expect(formatCalendarDate('2026-09-01')).toContain('1');
  expect(t('View trip to {destination}, {country}', { destination: 'Paris', country: 'France' })).toContain('Paris, France');
});
it('updates subscribers and resets account-specific preferences on logout', () => {
  function Subscriber() { const prefs = usePreferences(); return <p>{prefs.displayName} {t('Settings')}</p>; }
  render(<Subscriber />);
  act(() => setPreferences({ ...defaultPreferences, language: 'he', displayName: 'גל' }));
  expect(screen.getByText('גל הגדרות')).toBeTruthy();
  act(() => setPreferences(defaultPreferences));
  expect(screen.getByText('Settings')).toBeTruthy();
  expect(document.documentElement.dir).toBe('ltr');
});
it('uses the preferred day when deriving trip status', () => {
  const current = new Date();
  const west = todayKey(current, 'Etc/GMT+12');
  const east = todayKey(current, 'Pacific/Kiritimati');
  expect(west < east).toBe(true);
  const trip = { startDate: east, endDate: east } as Trip;
  setPreferences({ ...defaultPreferences, timeZone: 'Etc/GMT+12' });
  expect(getTripStatus(trip)).toBe('upcoming');
  setPreferences({ ...defaultPreferences, timeZone: 'Pacific/Kiritimati' });
  expect(getTripStatus(trip)).toBe('current');
});
