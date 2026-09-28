import { afterEach, expect, it, vi } from 'vitest';
import { findMapLocations } from './mapServices';
afterEach(() => vi.unstubAllGlobals());
it('encodes the lookup and excludes malformed coordinates', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [
    { id: 1, name: 'Paris', latitude: 48.85, longitude: 2.35 },
    { id: 2, name: 'Invalid', latitude: 400, longitude: 2 },
    { id: 3, name: 'Missing', longitude: 2 },
  ] }) });
  vi.stubGlobal('fetch', fetchMock);
  const signal = new AbortController().signal;
  expect(await findMapLocations('A & B, France', 'he', signal)).toHaveLength(1);
  const url = new URL(fetchMock.mock.calls[0][0]);
  expect(url.searchParams.get('name')).toBe('A & B, France');
  expect(url.searchParams.get('language')).toBe('he');
  expect(fetchMock.mock.calls[0][1]).toEqual({ signal, credentials: 'omit' });
});
it('rejects provider failures rather than pretending there are no results', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  await expect(findMapLocations('Paris', 'en', new AbortController().signal)).rejects.toThrow();
});
