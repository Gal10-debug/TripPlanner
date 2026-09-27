// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import TripsPage from './TripsPage';
import TripPage from './TripPage';
import type { Trip } from '../models/Trip';
import { searchTrips, sortTrips } from '../utils/tripSearch';

vi.mock('../components/TripDetails', () => ({ default: () => <p>Trip details</p> }));
vi.mock('../components/TripForm', () => ({ default: ({ onTripAdded }: { onTripAdded: (trip: Trip) => void }) => <button onClick={() => onTripAdded(makeTrip(9, 'New trip', 'Italy', '2099-07-01', 2))}>Create a trip</button> }));
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

function makeTrip(id: number, destination: string, country: string, date: string, days: number, createdAt: string | null = null): Trip {
  return { id, destination, country, startDate: date, endDate: date, days, createdAt, notes: '', accommodationName: '', accommodationAddress: '', bookingReference: '', usefulLinks: [], accessRole: 'Owner' };
}
const trips = [
  makeTrip(1, 'São Paulo', 'Brazil', '2099-01-01', 8),
  makeTrip(2, 'Rome', 'Italy', '2099-03-01', 2, '2026-09-20T12:00:00Z'),
  { ...makeTrip(3, 'Venice', 'Italy', '2099-02-01', 5, '2026-09-10T12:00:00Z'), accessRole: 'Viewer' as const },
  makeTrip(4, 'Paris', 'France', '2000-01-01', 3)
];
function Back() { const navigate = useNavigate(); return <button onClick={() => navigate(-1)}>Browser back</button>; }
function open(path = '/trips?status=all', data = trips, onTripAdded = vi.fn()) {
  render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/trips" element={<TripsPage trips={data} isLoading={false} error="" onRetry={vi.fn()} onTripAdded={onTripAdded} />} />
    <Route path="/trips/:tripId" element={<TripPage trips={data} isLoading={false} loadError="" onRetry={vi.fn()} onDelete={vi.fn()} onUpdate={vi.fn()} onUpdateDetails={vi.fn()} />} />
  </Routes><Back /></MemoryRouter>);
}
function tripLinks() { return screen.queryAllByRole('link', { name: /^View trip to/ }); }

it('searches destination and country regardless of case, accents, or extra spaces', () => {
  open();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search trips' }), { target: { value: '  SAO  braZIL  ' } });
  expect(tripLinks()).toHaveLength(1);
  expect(tripLinks()[0].getAttribute('href')).toBe('/trips/1');
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ITALY' } });
  expect(tripLinks()).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'upcoming2' })).toBeTruthy();
});
it('combines search with status filters and shows a recoverable empty state', () => {
  open('/trips?q=Italy&status=completed');
  expect(screen.getByRole('heading', { name: 'No matching trips' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'all2' }));
  expect(tripLinks()).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
  expect(tripLinks()).toHaveLength(4);
});
it.each([
  ['date-asc', [4, 1, 3, 2]], ['date-desc', [2, 3, 1, 4]],
  ['duration-asc', [2, 4, 3, 1]], ['duration-desc', [1, 3, 4, 2]],
  ['added-desc', [2, 3, 4, 1]], ['added-asc', [1, 4, 3, 2]]
])('sorts trips using %s', (sort, ids) => {
  open();
  fireEvent.change(screen.getByRole('combobox', { name: 'Sort trips' }), { target: { value: sort } });
  expect(tripLinks().map(link => link.getAttribute('href'))).toEqual((ids as number[]).map(id => `/trips/${id}`));
});
it.each(['Browser back', '← All trips'])('preserves search, filter, and sorting when returning via %s', returnAction => {
  open('/trips?status=all&q=Italy&sort=duration-desc');
  fireEvent.click(screen.getByRole('link', { name: 'View trip to Venice, Italy' }));
  if (returnAction === 'Browser back') fireEvent.click(screen.getByRole('button', { name: returnAction }));
  else fireEvent.click(screen.getByRole('link', { name: returnAction }));
  expect(screen.getByRole('searchbox')).toHaveProperty('value', 'Italy');
  expect(screen.getByRole('combobox')).toHaveProperty('value', 'duration-desc');
  expect(tripLinks().map(link => link.getAttribute('href'))).toEqual(['/trips/3', '/trips/2']);
});
it('uses safe defaults for invalid URL filters', () => {
  open('/trips?status=invalid&sort=invalid');
  expect(screen.getByRole('button', { pressed: true })).toHaveProperty('textContent', 'upcoming3');
  expect(screen.getByRole('combobox')).toHaveProperty('value', 'date-asc');
  expect(tripLinks()).toHaveLength(3);
});
it('distinguishes an empty collection from an unmatched search', () => {
  open('/trips?status=all', []);
  expect(screen.getByRole('heading', { name: 'Your map is wide open' })).toBeTruthy();
  expect(screen.queryByText('No matching trips')).toBeNull();
});
it('clears a stale search and selects the new trip status after creation', () => {
  const onTripAdded = vi.fn();
  open('/trips?status=completed&q=Paris', trips, onTripAdded);
  fireEvent.click(screen.getByRole('button', { name: 'Create a trip' }));
  expect(onTripAdded).toHaveBeenCalledOnce();
  expect(screen.getByRole('searchbox')).toHaveProperty('value', '');
  expect(screen.getByRole('button', { pressed: true })).toHaveProperty('textContent', 'upcoming3');
});
it('compares creation instants rather than timestamp strings and does not mutate data', () => {
  const input = [makeTrip(1, 'A', 'Italy', '2099-01-01', 2, '2026-09-01T10:00:00+03:00'), makeTrip(2, 'B', 'Italy', '2099-01-01', 2, '2026-09-01T08:00:00Z')];
  expect(sortTrips(input, 'added-desc').map(trip => trip.id)).toEqual([2, 1]);
  expect(input.map(trip => trip.id)).toEqual([1, 2]);
  expect(searchTrips(input, '   ')).toHaveLength(2);
});
it('keeps loading and request errors distinct from no search matches', () => {
  const { rerender } = render(<MemoryRouter><TripsPage trips={[]} isLoading error="" onRetry={vi.fn()} onTripAdded={vi.fn()} /></MemoryRouter>);
  expect(screen.getByRole('status')).toHaveProperty('textContent', 'Loading trips…');
  const retry = vi.fn();
  rerender(<MemoryRouter><TripsPage trips={[]} isLoading={false} error="Trips unavailable" onRetry={retry} onTripAdded={vi.fn()} /></MemoryRouter>);
  fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Retry loading trips' }));
  expect(retry).toHaveBeenCalledOnce();
  expect(screen.queryByText('No matching trips')).toBeNull();
});
