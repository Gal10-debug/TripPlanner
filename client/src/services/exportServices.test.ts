import { afterEach, expect, it, vi } from 'vitest';
import { loadTripSummary } from './exportServices';
afterEach(() => vi.unstubAllGlobals());
it('loads the trip and every section with credentials and cancellation', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
  vi.stubGlobal('fetch', fetchMock);
  const signal = new AbortController().signal;
  const result = await loadTripSummary(7, signal);
  expect(fetchMock.mock.calls.map(call => call[0])).toEqual(['/api/trips/7', '/api/trips/7/itinerary', '/api/trips/7/packing', '/api/trips/7/budget']);
  expect(fetchMock.mock.calls.every(call => call[1].signal === signal && call[1].credentials === 'include')).toBe(true);
  expect(result.generatedAt).toBeInstanceOf(Date);
});
it('rejects the entire export when any required section cannot load', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: !url.endsWith('/packing'), json: async () => [] })));
  await expect(loadTripSummary(7, new AbortController().signal)).rejects.toThrow('Unable to prepare');
});
