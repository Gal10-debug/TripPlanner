// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import App from './App';
import { getTrips, deleteTrip, updateTrip, updateTripDetails } from './services/tripServices';
import type { Trip } from './models/Trip';
import { getCalendarMonth } from './services/calendarServices';
import { getSettings } from './services/settingsServices';
import { defaultPreferences, getPreferences, setPreferences } from './i18n/preferences';
import { getCurrentUser } from './services/authServices';

vi.mock('./services/settingsServices', () => ({ getSettings: vi.fn().mockImplementation(async () => ({ ...defaultPreferences, email: 'traveler@example.com' })) }));
vi.mock('./services/calendarServices', () => ({ getCalendarMonth: vi.fn() }));
vi.mock('./services/authServices', () => ({ getCurrentUser: vi.fn(), logout: vi.fn() }));
vi.mock('./services/tripServices', () => ({ getTrips: vi.fn(), deleteTrip: vi.fn(), updateTrip: vi.fn(), updateTripDetails: vi.fn() }));
vi.mock('./components/DepartureAlerts', () => ({ default: () => <p>Departure alerts</p> }));
vi.mock('./services/sharingServices', () => ({ getReceivedInvitations: vi.fn().mockResolvedValue([]) }));
vi.mock('./components/ItineraryPanel', () => ({ default: ({ tripId, canEdit }: { tripId: number; canEdit: boolean }) => <p>Itinerary {tripId} {canEdit ? 'editable' : 'read only'}</p> }));
vi.mock('./components/PackingPanel', () => ({ default: () => <p>Packing list</p> }));
vi.mock('./components/BudgetPanel', () => ({ default: () => <p>Trip budget</p> }));
vi.mock('./components/WeatherRemindersPanel', () => ({ default: () => <p>Weather and reminders</p> }));
vi.mock('./components/SharingPanel', () => ({ default: () => <p>Sharing</p> }));
afterEach(() => { cleanup(); setPreferences(defaultPreferences); });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSettings).mockResolvedValue({ ...defaultPreferences, email: "traveler@example.com" });
  vi.mocked(getCurrentUser).mockResolvedValue({ email: 'traveler@example.com' });
  vi.mocked(getTrips).mockResolvedValue([]);
});

function HistoryControls() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>Go back</button>;
}
function open(path: string) {
  render(<MemoryRouter initialEntries={[path]}><App /><HistoryControls /></MemoryRouter>);
}
it('opens the trips page directly and marks its navigation link active', async () => {
  open('/trips');
  expect(await screen.findByRole('heading', { name: 'Your trips', level: 1 })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Trips' }).getAttribute('aria-current')).toBe('page');
  expect(screen.queryByText('Departure alerts')).toBeNull();
});
it('navigates between pages and supports history back', async () => {
  open('/dashboard');
  await screen.findByRole('heading', { name: 'Where to next?' });
  fireEvent.click(screen.getByRole('link', { name: 'Invitations' }));
  expect(await screen.findByRole('heading', { name: 'No pending invitations' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
  expect(await screen.findByRole('heading', { name: 'Where to next?' })).toBeTruthy();
});
it('redirects the root to the dashboard', async () => {
  open('/');
  expect(await screen.findByRole('heading', { name: 'Where to next?' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Dashboard' }).getAttribute('aria-current')).toBe('page');
});
it('provides a recovery link for unknown routes', async () => {
  open('/missing');
  expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Return to dashboard' }).getAttribute('href')).toBe('/dashboard');
});
it.each(['/trips', '/trips/123', '/calendar', '/settings'])('requires authentication on direct page access to %s', async path => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);
  open(path);
  expect(await screen.findByText('Adventure is waiting.')).toBeTruthy();
  expect(screen.queryByRole('navigation')).toBeNull();
});

const sampleTrip: Trip = {
  id: 123, createdAt: '2026-09-01T12:00:00Z', destination: 'Rome', country: 'Italy', startDate: '2099-06-01', endDate: '2099-06-05', days: 5,
  notes: 'Visit the forum', accommodationName: '', accommodationAddress: '', bookingReference: '', usefulLinks: [], accessRole: 'Owner'
};
it('opens a trip directly with all panels and keeps Trips navigation active', async () => {
  vi.mocked(getTrips).mockResolvedValue([sampleTrip]);
  open('/trips/123');
  expect(await screen.findByRole('heading', { name: 'Rome', level: 1 })).toBeTruthy();
  expect(screen.getByText('Visit the forum')).toBeTruthy();
  for (const name of ['Itinerary 123 editable', 'Packing list', 'Trip budget', 'Weather and reminders', 'Sharing']) expect(screen.getByText(name)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Trips' }).getAttribute('aria-current')).toBe('page');
});
it('opens a compact trip link and returns to the list with history back', async () => {
  vi.mocked(getTrips).mockResolvedValue([sampleTrip]);
  open('/trips');
  fireEvent.click(await screen.findByRole('link', { name: 'View trip to Rome, Italy' }));
  await screen.findByRole('heading', { name: 'Rome', level: 1 });
  fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
  expect(await screen.findByRole('link', { name: 'View trip to Rome, Italy' })).toBeTruthy();
  expect(screen.queryByText('Packing list')).toBeNull();
});
it('shows loading until trips arrive without flashing not found', async () => {
  let resolveTrips!: (trips: Trip[]) => void;
  vi.mocked(getTrips).mockReturnValueOnce(new Promise(resolve => { resolveTrips = resolve; }));
  open('/trips/123');
  expect(await screen.findByText('Loading trip…')).toBeTruthy();
  expect(screen.queryByText('Trip not found')).toBeNull();
  resolveTrips([sampleTrip]);
  expect(await screen.findByRole('heading', { name: 'Rome' })).toBeTruthy();
});
it.each(['/trips/999', '/trips/123abc', '/trips/0'])('handles unavailable or invalid trip URL %s', async path => {
  vi.mocked(getTrips).mockResolvedValue([sampleTrip]);
  open(path);
  expect(await screen.findByRole('heading', { name: 'Trip not found' })).toBeTruthy();
  expect(screen.getByRole('link', { name: '← All trips' }).getAttribute('href')).toBe('/trips');
});
it('offers a retry after a load error', async () => {
  vi.mocked(getTrips).mockRejectedValueOnce(new Error('Connection failed')).mockResolvedValue([sampleTrip]);
  open('/trips/123');
  fireEvent.click(await screen.findByRole('button', { name: 'Retry loading trips' }));
  expect(await screen.findByRole('heading', { name: 'Rome' })).toBeTruthy();
});
it('saves trip edits on the dedicated page and updates the list', async () => {
  vi.mocked(getTrips).mockResolvedValue([sampleTrip]);
  vi.mocked(updateTrip).mockResolvedValue({ ...sampleTrip, destination: 'Florence' });
  open('/trips/123');
  fireEvent.click(await screen.findByRole('button', { name: 'Edit trip' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Destination' }), { target: { value: 'Florence' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('heading', { name: 'Florence' })).toBeTruthy();
  expect(updateTrip).toHaveBeenCalledWith(123, { destination: 'Florence', country: 'Italy', startDate: '2099-06-01', endDate: '2099-06-05' });
  fireEvent.click(screen.getByRole('link', { name: '← All trips' }));
  expect(await screen.findByRole('link', { name: 'View trip to Florence, Italy' })).toBeTruthy();
});
it('saves trip details on the dedicated page', async () => {
  vi.mocked(getTrips).mockResolvedValue([sampleTrip]);
  vi.mocked(updateTripDetails).mockResolvedValue({ ...sampleTrip, notes: 'Book museum tickets' });
  open('/trips/123');
  fireEvent.click(await screen.findByRole('button', { name: 'Edit details' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Notes' }), { target: { value: 'Book museum tickets' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save details' }));
  expect(await screen.findByText('Book museum tickets')).toBeTruthy();
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Save details' })).toBeNull());
});
it('keeps the trip open on delete failure then returns to the list on success', async () => {
  vi.mocked(getTrips).mockResolvedValue([sampleTrip]);
  vi.mocked(deleteTrip).mockRejectedValueOnce(new Error('Unable to delete')).mockResolvedValue(undefined);
  open('/trips/123');
  fireEvent.click(await screen.findByRole('button', { name: 'Delete trip' }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Unable to delete');
  expect(screen.getByRole('heading', { name: 'Rome' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Delete trip' }));
  expect(await screen.findByRole('heading', { name: 'Your trips', level: 1 })).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'View trip to Rome, Italy' })).toBeNull();
});
it.each(['Viewer', 'Editor'] as const)('preserves %s permissions on the trip page', async accessRole => {
  vi.mocked(getTrips).mockResolvedValue([{ ...sampleTrip, accessRole }]);
  open('/trips/123');
  await screen.findByRole('heading', { name: 'Rome' });
  expect(screen.queryByRole('button', { name: 'Delete trip' })).toBeNull();
  expect(Boolean(screen.queryByRole('button', { name: 'Edit trip' }))).toBe(accessRole === 'Editor');
  expect(Boolean(screen.queryByRole('button', { name: 'Edit details' }))).toBe(accessRole === 'Editor');
  expect(screen.getByText(`Itinerary 123 ${accessRole === 'Editor' ? 'editable' : 'read only'}`)).toBeTruthy();
});

it('opens the calendar route and marks the navigation link active', async () => {
  vi.mocked(getCalendarMonth).mockResolvedValue({ trips: [], activities: [] });
  open('/calendar?month=2026-09');
  expect(await screen.findByRole('table', { name: 'September 2026' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Calendar' }).getAttribute('aria-current')).toBe('page');
});

it('restores saved account preferences on sign-in and resets them on logout', async () => {
  vi.mocked(getSettings).mockResolvedValue({ email: 'traveler@example.com', displayName: 'גל', language: 'he', timeZone: 'Asia/Jerusalem', defaultCurrency: 'ILS' });
  open('/dashboard');
  expect(await screen.findByText('גל')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'הגדרות' }).getAttribute('href')).toBe('/settings');
  expect(document.documentElement.dir).toBe('rtl');
  expect(getPreferences().defaultCurrency).toBe('ILS');
  fireEvent.click(screen.getByRole('button', { name: 'התנתקות' }));
  expect(await screen.findByText('Adventure is waiting.')).toBeTruthy();
  expect(document.documentElement.dir).toBe('ltr');
  expect(getPreferences()).toEqual(defaultPreferences);
});
