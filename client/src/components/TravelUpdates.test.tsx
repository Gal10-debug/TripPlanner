// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import DepartureAlerts from './DepartureAlerts';
import WeatherRemindersPanel from './WeatherRemindersPanel';
import { getDashboardReminders, getReminders, getWeather, deleteReminder } from '../services/weatherReminderServices';
import type { TripReminder } from '../models/WeatherReminder';

vi.mock('../services/weatherReminderServices', () => ({
  getDashboardReminders: vi.fn(), getReminders: vi.fn(), getWeather: vi.fn(), deleteReminder: vi.fn()
}));
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getWeather).mockResolvedValue({ available: false, message: 'Forecast available nearer departure.' });
});
it('replaces reminder loading with an empty state after an empty response', async () => {
  let resolve!: (items: TripReminder[]) => void;
  vi.mocked(getReminders).mockReturnValue(new Promise(done => { resolve = done; }));
  render(<WeatherRemindersPanel tripId={1} startDate="2099-01-01" canEdit />);
  expect(screen.getByText('Loading reminders…')).toBeTruthy();
  resolve([]);
  expect(await screen.findByText('No reminders yet. Add one to prepare for your trip.')).toBeTruthy();
  expect(screen.queryByText('Loading reminders…')).toBeNull();
});
it('shows an error rather than loading forever when reminders fail', async () => {
  vi.mocked(getReminders).mockRejectedValue(new Error('Reminders unavailable'));
  render(<WeatherRemindersPanel tripId={1} startDate="2099-01-01" canEdit={false} />);
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Reminders unavailable');
  await waitFor(() => expect(screen.queryByText('Loading reminders…')).toBeNull());
  expect(screen.queryByText(/No reminders yet/)).toBeNull();
});
it('shows the empty state after deleting the final reminder', async () => {
  vi.mocked(getReminders).mockResolvedValue([{ id: 1, tripId: 1, title: 'Pack', dueDate: '2099-01-01', isCompleted: false, isAutomatic: false }]);
  vi.mocked(deleteReminder).mockResolvedValue(undefined);
  render(<WeatherRemindersPanel tripId={1} startDate="2099-01-01" canEdit />);
  fireEvent.click(await screen.findByRole('button', { name: '×' }));
  expect(await screen.findByText('No reminders yet. Add one to prepare for your trip.')).toBeTruthy();
});
it('retries departure alerts after failure and renders recovered results', async () => {
  vi.mocked(getDashboardReminders).mockRejectedValueOnce(new Error('Alerts unavailable')).mockResolvedValueOnce([
    { id: 1, tripId: 1, title: 'Check passport', dueDate: '2099-01-01', isCompleted: false, isAutomatic: true, destination: 'Rome', country: 'Italy' }
  ]);
  render(<DepartureAlerts />);
  expect(screen.getByText('Loading departure alerts…')).toBeTruthy();
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Alerts unavailable');
  fireEvent.click(screen.getByRole('button', { name: 'Retry departure alerts' }));
  expect(await screen.findByText('Check passport')).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(getDashboardReminders).toHaveBeenCalledTimes(2);
});
it('hides departure alerts after a successful empty response', async () => {
  vi.mocked(getDashboardReminders).mockResolvedValue([]);
  const { container } = render(<DepartureAlerts />);
  await waitFor(() => expect(container.innerHTML).toBe(''));
});
