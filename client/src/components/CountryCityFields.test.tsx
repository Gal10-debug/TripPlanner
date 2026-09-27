// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CountryCityFields from './CountryCityFields';
import { searchCities } from '../services/locationServices';
import { countries, resolveCountry } from '../data/countries';
import { defaultPreferences, setPreferences } from '../i18n/preferences';
vi.mock('../services/locationServices', () => ({ searchCities: vi.fn() }));
const paris = { id: '1', name: 'Paris', region: 'Île-de-France', countryCode: 'FR' };
function Fields({ initialCountry = '', initialCity = '' }: { initialCountry?: string; initialCity?: string }) {
  const [country, setCountry] = useState(initialCountry);
  const [destination, setDestination] = useState(initialCity);
  return <CountryCityFields country={country} destination={destination} onCountryChange={setCountry} onDestinationChange={setDestination} />;
}
beforeEach(() => { vi.resetAllMocks(); vi.mocked(searchCities).mockResolvedValue([paris]); });
afterEach(() => { cleanup(); setPreferences(defaultPreferences); });
it('includes every ISO country code plus Kosovo and resolves English, Hebrew and aliases', () => {
  expect(countries).toHaveLength(250);
  expect(new Set(countries.map(country => country.code)).size).toBe(250);
  expect(resolveCountry('ישראל')?.code).toBe('IL');
  expect(resolveCountry('Italy')?.code).toBe('IT');
  expect(resolveCountry('USA')?.code).toBe('US');
  expect(resolveCountry('UK')?.code).toBe('GB');
  expect(resolveCountry('Atlantis')).toBeUndefined();
});
it('offers countries offline and supports keyboard selection', () => {
  render(<Fields />);
  const country = screen.getByRole('combobox', { name: 'Country' });
  expect(screen.getByRole('combobox', { name: 'Destination' })).toHaveProperty('disabled', true);
  fireEvent.focus(country);
  expect(screen.getAllByRole('option')).toHaveLength(250);
  fireEvent.change(country, { target: { value: 'fran' } });
  expect(screen.getByRole('option', { name: 'France' })).toBeTruthy();
  fireEvent.keyDown(country, { key: 'ArrowDown' });
  fireEvent.keyDown(country, { key: 'Enter' });
  expect(country).toHaveProperty('value', 'France');
  expect(screen.getByRole('combobox', { name: 'Destination' })).toHaveProperty('disabled', false);
  expect(screen.queryByRole('listbox')).toBeNull();
  expect(searchCities).not.toHaveBeenCalled();
});
it('debounces city input, uses the selected country, and shows regions for ambiguous names', async () => {
  render(<Fields initialCountry="France" />);
  const city = screen.getByRole('combobox', { name: 'Destination' });
  fireEvent.change(city, { target: { value: 'P' } });
  expect(searchCities).not.toHaveBeenCalled();
  fireEvent.change(city, { target: { value: 'Pa' } });
  fireEvent.change(city, { target: { value: 'Par' } });
  fireEvent.click(await screen.findByRole('option', { name: 'Paris, Île-de-France' }));
  expect(searchCities).toHaveBeenCalledTimes(1);
  expect(searchCities).toHaveBeenCalledWith('Par', 'FR', 'en', expect.any(AbortSignal));
  expect(city).toHaveProperty('value', 'Paris');
  expect(screen.queryByRole('listbox')).toBeNull();
});
it('clears the city on country change and ignores a late response from the old country', async () => {
  let resolve!: (value: typeof paris[]) => void;
  vi.mocked(searchCities).mockReturnValue(new Promise(done => { resolve = done; }));
  render(<Fields initialCountry="France" initialCity="Paris" />);
  fireEvent.focus(screen.getByRole('combobox', { name: 'Destination' }));
  await waitFor(() => expect(searchCities).toHaveBeenCalledOnce());
  fireEvent.change(screen.getByRole('combobox', { name: 'Country' }), { target: { value: 'Italy' } });
  expect(screen.getByRole('combobox', { name: 'Destination' })).toHaveProperty('value', '');
  expect(vi.mocked(searchCities).mock.calls[0][3].aborted).toBe(true);
  await act(async () => resolve([paris]));
  expect(screen.queryByRole('option', { name: 'Paris, Île-de-France' })).toBeNull();
});
it('allows manual city entry during a provider failure and can retry', async () => {
  vi.mocked(searchCities).mockRejectedValueOnce(new Error('Offline')).mockResolvedValue([]);
  render(<Fields initialCountry="France" />);
  const city = screen.getByRole('combobox', { name: 'Destination' });
  fireEvent.change(city, { target: { value: 'Unknown village' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Retry city suggestions' }));
  expect(await screen.findByText('No matching cities. Try another spelling or enter the city manually.')).toBeTruthy();
  expect(city).toHaveProperty('value', 'Unknown village');
  expect(city).toHaveProperty('disabled', false);
});
it('shows Hebrew country names and searches cities with the stable country code', async () => {
  setPreferences({ ...defaultPreferences, language: 'he' });
  vi.mocked(searchCities).mockResolvedValue([{ id: '2', name: 'תל אביב', region: 'תל אביב', countryCode: 'IL' }]);
  render(<Fields />);
  fireEvent.change(screen.getByRole('combobox', { name: 'מדינה' }), { target: { value: 'ישרא' } });
  fireEvent.click(screen.getByRole('option', { name: 'ישראל' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'יעד' }), { target: { value: 'תל' } });
  await waitFor(() => expect(searchCities).toHaveBeenCalledWith('תל', 'IL', 'he', expect.any(AbortSignal)));
});
