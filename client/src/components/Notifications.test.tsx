// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotificationsPage, { NotificationLink, NotificationProvider } from './Notifications';

const notice = { id: 42, tripId: 7, title: 'Pack boots', destination: 'Rome', dueDate: '2030-01-10', isRead: false, isAutomatic: false };
const fetchMock = vi.fn();
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); localStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function open() { render(<MemoryRouter><NotificationProvider><NotificationLink /><NotificationsPage /></NotificationProvider></MemoryRouter>); }
function response(items = [notice]) { return { ok: true, json: async () => items }; }
it('shows an empty state after loading, without a stuck spinner', async () => {
  fetchMock.mockResolvedValue(response([])); open();
  expect(await screen.findByText('No notifications yet. Due trip reminders will appear here.')).toBeTruthy();
  expect(screen.queryByRole('status')).toBeNull();
});
it('loads links and unread counts and persists marking a reminder as read', async () => {
  fetchMock.mockResolvedValue(response()); open();
  expect((await screen.findByRole('link', { name: 'Rome' })).getAttribute('href')).toBe('/trips/7');
  expect(screen.getByRole('link', { name: 'Notifications (1)' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Mark as read' })).toBeNull());
  expect(fetchMock).toHaveBeenCalledWith('/api/notifications/42/read', expect.objectContaining({ method: 'PUT' }));
});
it('shows errors and retries without displaying a misleading empty state', async () => {
  fetchMock.mockResolvedValueOnce({ ok: false }).mockResolvedValue(response()); open();
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByText('No notifications yet. Due trip reminders will appear here.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('Pack boots')).toBeTruthy();
});
it('keeps unread state when a save fails', async () => {
  fetchMock.mockResolvedValueOnce(response()).mockResolvedValue({ ok: false }); open();
  fireEvent.click(await screen.findByRole('button', { name: 'Mark all as read' }));
  expect(await screen.findByText('Unable to update notifications. Please try again.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Mark as read' })).toBeTruthy();
});
it('requests browser permission only after opt-in and avoids repeat delivery', async () => {
  fetchMock.mockResolvedValue(response());
  const permission = vi.fn().mockResolvedValue('granted');
  const showNotification = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('Notification', { requestPermission: permission });
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register: vi.fn().mockResolvedValue({}), ready: Promise.resolve({ showNotification }) } });
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: vi.fn(async (_key, action) => action()) } });
  open(); await screen.findByText('Pack boots');
  expect(permission).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Enable browser alerts' }));
  await waitFor(() => expect(showNotification).toHaveBeenCalledTimes(1));
  expect(showNotification).toHaveBeenCalledWith('Trip reminder', expect.objectContaining({ body: 'Rome: Pack boots', data: { url: '/trips/7' } }));
  fireEvent.click(screen.getByRole('button', { name: 'Turn off browser alerts' }));
  fireEvent.click(screen.getByRole('button', { name: 'Enable browser alerts' }));
  await waitFor(() => expect(permission).toHaveBeenCalledTimes(2));
  expect(showNotification).toHaveBeenCalledTimes(1);
});
