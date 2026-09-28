import { afterEach, expect, it, vi } from 'vitest';
import { searchCities } from './locationServices';
afterEach(() => vi.unstubAllGlobals());
it('sends the ISO country filter and excludes other countries and non-city results', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [
    { id: 1, name: 'Paris', admin1: 'Île-de-France', country_code: 'FR', feature_code: 'PPLC' },
    { id: 2, name: 'Paris', country_code: 'US', feature_code: 'PPL' },
    { id: 3, name: 'France', country_code: 'FR', feature_code: 'PCLI' },
    { id: 4, name: 'Park', country_code: 'FR', feature_code: 'PRK' },
    { id: 1, name: 'Paris', country_code: 'FR', feature_code: 'PPLC' },
  ] }) });
  vi.stubGlobal('fetch', fetchMock);
  const result = await searchCities('Par', 'FR', 'en', new AbortController().signal);
  expect(result).toEqual([{ id: '1', name: 'Paris', region: 'Île-de-France', countryCode: 'FR' }]);
  const url = new URL(fetchMock.mock.calls[0][0]);
  expect(url.searchParams.get('countryCode')).toBe('FR');
  expect(url.searchParams.get('name')).toBe('Par');
  await searchCities('Par', 'FR', 'en', new AbortController().signal);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('reports failed requests rather than claiming there are no cities', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  await expect(searchCities('Rom', 'IT', 'en', new AbortController().signal)).rejects.toThrow();
});
