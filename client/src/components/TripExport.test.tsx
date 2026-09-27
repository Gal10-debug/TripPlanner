// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TripExport from './TripExport';
import { loadTripSummary } from '../services/exportServices';
import { downloadTripSummary } from '../utils/tripExport';
vi.mock('../services/exportServices', () => ({ loadTripSummary: vi.fn() }));
vi.mock('../utils/tripExport', () => ({ tripSummaryHtml: vi.fn(() => '<!doctype html><html><body>Snapshot</body></html>'), downloadTripSummary: vi.fn() }));
afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());
it('loads only on request and offers an offline download and isolated print preview', async () => {
  vi.mocked(loadTripSummary).mockResolvedValue({} as Awaited<ReturnType<typeof loadTripSummary>>);
  render(<TripExport tripId={7} />);
  expect(loadTripSummary).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Prepare trip summary' }));
  const frame = await screen.findByTitle('Trip summary preview');
  expect(frame.getAttribute('sandbox')).toBe('allow-same-origin allow-modals');
  fireEvent.click(screen.getByRole('button', { name: 'Download summary' }));
  expect(downloadTripSummary).toHaveBeenCalledWith(expect.stringContaining('Snapshot'), 7);
  const print = vi.fn();
  Object.defineProperty(frame, 'contentWindow', { value: { print, focus: vi.fn() } });
  fireEvent.load(frame);
  fireEvent.click(screen.getByRole('button', { name: 'Print / Save as PDF' }));
  expect(print).toHaveBeenCalledOnce();
});
it('prevents partial exports on failure and retries with fresh data', async () => {
  vi.mocked(loadTripSummary).mockRejectedValueOnce(new Error('Denied')).mockResolvedValue({} as Awaited<ReturnType<typeof loadTripSummary>>);
  render(<TripExport tripId={7} />);
  fireEvent.click(screen.getByRole('button', { name: 'Prepare trip summary' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Download summary' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Prepare trip summary' }));
  expect(await screen.findByTitle('Trip summary preview')).toBeTruthy();
  expect(loadTripSummary).toHaveBeenCalledTimes(2);
});
it('cancels a pending summary when closed', async () => {
  vi.mocked(loadTripSummary).mockImplementation((_id, signal) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))));
  render(<TripExport tripId={7} />);
  fireEvent.click(screen.getByRole('button', { name: 'Prepare trip summary' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close summary' }));
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  expect(vi.mocked(loadTripSummary).mock.calls[0][1].aborted).toBe(true);
  expect(screen.queryByRole('alert')).toBeNull();
});
