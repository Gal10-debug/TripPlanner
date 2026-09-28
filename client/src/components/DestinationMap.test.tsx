// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import DestinationMap from './DestinationMap';
import { findMapLocations } from '../services/mapServices';
import type { Trip } from '../models/Trip';
import { directionsUrl, embeddedMapUrl } from '../utils/maps';
vi.mock('../services/mapServices', () => ({ findMapLocations: vi.fn() }));
const trip: Trip = { id: 1, destination: 'Paris', country: 'France', startDate: '2030-01-01', endDate: '2030-01-03', days: 3, createdAt: null, notes: '', accommodationName: 'Hôtel & Spa', accommodationAddress: '12 Rue Example', bookingReference: 'PRIVATE', usefulLinks: [], accessRole: 'Viewer' };
const paris = { id: 1, name: 'Paris', country: 'France', latitude: 48.85, longitude: 2.35 };
afterEach(cleanup);
beforeEach(() => { vi.resetAllMocks(); });
it('offers safe destination and stay links to viewers without sending booking details', () => {
  render(<DestinationMap trip={trip} />);
  const link = screen.getByRole('link', { name: /View accommodation on map/ });
  const url = new URL(link.getAttribute('href')!);
  expect(url.origin).toBe('https://www.google.com');
  expect(url.searchParams.get('query')).toBe('Hôtel & Spa, 12 Rue Example, Paris, France');
  expect(link.getAttribute('rel')).toBe('noreferrer');
  expect(url.href).not.toContain('PRIVATE');
  expect(findMapLocations).not.toHaveBeenCalled();
});
it('loads a single result into a labeled map and resets after changing destination', async () => {
  vi.mocked(findMapLocations).mockResolvedValue([paris]);
  const view = render(<DestinationMap trip={trip} />);
  fireEvent.click(screen.getByRole('button', { name: 'Show destination map' }));
  const frame = await screen.findByTitle('Destination map');
  expect(new URL(frame.getAttribute('src')!).searchParams.get('marker')).toBe('48.85,2.35');
  expect(findMapLocations).toHaveBeenCalledWith('Paris, France', 'en', expect.any(AbortSignal));
  view.rerender(<DestinationMap trip={{ ...trip, destination: 'Rome', country: 'Italy' }} />);
  expect(screen.queryByTitle('Destination map')).toBeNull();
  expect(screen.getByRole('button', { name: 'Show destination map' })).toBeTruthy();
});
it('requires a selection when the provider returns ambiguous places', async () => {
  vi.mocked(findMapLocations).mockResolvedValue([paris, { ...paris, id: 2, latitude: 49 }]);
  render(<DestinationMap trip={trip} />);
  fireEvent.click(screen.getByRole('button', { name: 'Show destination map' }));
  const picker = await screen.findByRole('combobox');
  expect(screen.queryByTitle('Destination map')).toBeNull();
  fireEvent.change(picker, { target: { value: '2' } });
  expect(new URL(screen.getByTitle('Destination map').getAttribute('src')!).searchParams.get('marker')).toBe('49,2.35');
});
it('retries a failed lookup and shows a useful empty result with fallback links', async () => {
  vi.mocked(findMapLocations).mockRejectedValueOnce(new Error()).mockResolvedValue([]);
  render(<DestinationMap trip={{ ...trip, accommodationName: '', accommodationAddress: '' }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Show destination map' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Retry map' }));
  expect(await screen.findByText(/No matching destination found/)).toBeTruthy();
  expect(screen.getByRole('link', { name: /Open destination in Google Maps/ })).toBeTruthy();
  expect(screen.queryByRole('link', { name: /View accommodation/ })).toBeNull();
});
it('encodes free text as a directions parameter and bounds the embedded viewport', () => {
  const value = 'A & B # שלום';
  expect(new URL(directionsUrl(value)).searchParams.get('destination')).toBe(value);
  const bbox = new URL(embeddedMapUrl(85, 180)).searchParams.get('bbox')!.split(',').map(Number);
  expect(bbox[2]).toBe(180);
  expect(bbox[3]).toBeLessThanOrEqual(85.05);
});
