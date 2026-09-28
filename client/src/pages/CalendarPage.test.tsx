// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import CalendarPage from './CalendarPage';
import { getCalendarMonth } from '../services/calendarServices';
import { localDateKey, monthDates, shiftMonth, isValidMonth } from '../utils/calendar';
import type { CalendarMonth } from '../models/Calendar';

vi.mock('../services/calendarServices', () => ({ getCalendarMonth: vi.fn() }));
afterEach(cleanup);
beforeEach(() => { vi.resetAllMocks(); vi.mocked(getCalendarMonth).mockResolvedValue({ trips: [], activities: [] }); });

const plans: CalendarMonth = {
  trips: [
    { id: 1, destination: 'Rome', country: 'Italy', startDate: '2026-08-30', endDate: '2026-09-02' },
    { id: 2, destination: 'Paris', country: 'France', startDate: '2026-09-02', endDate: '2026-10-03' }
  ],
  activities: [
    { id: 1, tripId: 1, title: 'Museum', date: '2026-09-02', time: '14:00:00', location: 'Forum', destination: 'Rome', country: 'Italy' },
    { id: 2, tripId: 2, title: 'Breakfast', date: '2026-09-02', time: '08:30:00', location: 'Cafe', destination: 'Paris', country: 'France' }
  ]
};
function Back() { const navigate = useNavigate(); return <button onClick={() => navigate(-1)}>Browser back</button>; }
function open(path = '/calendar?month=2026-09&day=2026-09-02') {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/calendar" element={<CalendarPage />} /><Route path="/trips/:tripId" element={<h1>Trip details</h1>} /></Routes><Back /></MemoryRouter>);
}

it('shows spanning and overlapping trips on every travel day, plus activities', async () => {
  vi.mocked(getCalendarMonth).mockResolvedValue(plans);
  open();
  expect(await screen.findByRole('table', { name: 'September 2026' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Tuesday, September 1, 2026: 1 trips, 0 activities' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Wednesday, September 2, 2026: 2 trips, 2 activities' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button', { name: 'Wednesday, September 30, 2026: 1 trips, 0 activities' })).toBeTruthy();
  const agenda = within(screen.getByRole('region', { name: 'Wednesday, September 2, 2026' }));
  expect(agenda.getAllByRole('link').map(link => link.getAttribute('href'))).toEqual(['/trips/1', '/trips/2', '/trips/2', '/trips/1']);
  expect(agenda.getByText('Rome, Italy · Forum')).toBeTruthy();
});
it('selects a day without another request and shows its agenda', async () => {
  vi.mocked(getCalendarMonth).mockResolvedValue(plans);
  open();
  fireEvent.click(await screen.findByRole('button', { name: 'Thursday, September 3, 2026: 1 trips, 0 activities' }));
  const agenda = within(screen.getByRole('region', { name: 'Thursday, September 3, 2026' }));
  expect(agenda.getAllByRole('link')).toHaveLength(1);
  expect(getCalendarMonth).toHaveBeenCalledTimes(1);
});
it('preserves month and selected day after opening a trip and going back', async () => {
  vi.mocked(getCalendarMonth).mockResolvedValue(plans);
  open();
  fireEvent.click(await screen.findByRole('link', { name: /14:00 · Museum/ }));
  expect(screen.getByRole('heading', { name: 'Trip details' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Browser back' }));
  expect(await screen.findByRole('region', { name: 'Wednesday, September 2, 2026' })).toBeTruthy();
});
it('navigates across year boundaries and jumps to a month or today', async () => {
  open('/calendar?month=2026-12');
  await screen.findByRole('table');
  fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
  expect(await screen.findByRole('table', { name: 'January 2027' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
  expect(await screen.findByRole('table', { name: 'December 2026' })).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Jump to month'), { target: { value: '2028-02' } });
  expect(await screen.findByRole('button', { name: /Tuesday, February 29, 2028/ })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Today' }));
  await screen.findByRole('table');
  expect(getCalendarMonth).toHaveBeenLastCalledWith(localDateKey().slice(0, 7), expect.any(AbortSignal));
  expect(screen.getByRole('button', { pressed: true }).getAttribute('aria-current')).toBe('date');
});
it('handles an empty month without hiding the date grid', async () => {
  open();
  expect(await screen.findByText(/No trips or activities this month/)).toBeTruthy();
  expect(screen.getByRole('table')).toBeTruthy();
  expect(screen.getByText('No plans on this day.')).toBeTruthy();
});
it('distinguishes loading and failure and allows retry', async () => {
  vi.mocked(getCalendarMonth).mockRejectedValueOnce(new Error('Network failed')).mockResolvedValueOnce(plans);
  open();
  expect(screen.getByRole('status').textContent).toBe('Loading calendar…');
  fireEvent.click(await screen.findByRole('button', { name: 'Retry calendar' }));
  expect(await screen.findByRole('table')).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
});
it('ignores an obsolete month response after navigating', async () => {
  let finish!: (value: CalendarMonth) => void;
  vi.mocked(getCalendarMonth).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  open();
  const oldSignal = vi.mocked(getCalendarMonth).mock.calls[0][1];
  fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
  await screen.findByRole('table', { name: 'October 2026' });
  expect(oldSignal?.aborted).toBe(true);
  await act(async () => { finish(plans); });
  expect(screen.queryByText('2 trips · 2 activities this month')).toBeNull();
});
it('falls back from invalid URL dates to a valid calendar', async () => {
  open('/calendar?month=2026-13&day=2026-13-99');
  await screen.findByRole('table');
  expect(getCalendarMonth).toHaveBeenCalledWith(localDateKey().slice(0, 7), expect.any(AbortSignal));
});
it('handles leap years and date boundaries without UTC date conversion', () => {
  expect(monthDates('2028-02')).toHaveLength(29);
  expect(monthDates('2100-02')).toHaveLength(28);
  expect(monthDates('2000-02')).toHaveLength(29);
  expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  expect(shiftMonth('9999-12', 1)).toBe('9999-12');
  expect(shiftMonth('0001-01', -1)).toBe('0001-01');
  expect(isValidMonth('0000-01')).toBe(false);
  expect(localDateKey(new Date(2026, 8, 1, 0, 15))).toBe('2026-09-01');
});
it('shows no impossible selected date for a shorter month', async () => {
  open('/calendar?month=2026-02&day=2026-02-31');
  await waitFor(() => expect(screen.getByRole('button', { pressed: true }).textContent).toBe('1'));
});
