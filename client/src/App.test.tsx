// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import App from './App';
import { getCurrentUser } from './services/authServices';

vi.mock('./services/authServices', () => ({ getCurrentUser: vi.fn(), logout: vi.fn() }));
vi.mock('./services/tripServices', () => ({ getTrips: vi.fn().mockResolvedValue([]) }));
vi.mock('./components/DepartureAlerts', () => ({ default: () => <p>Departure alerts</p> }));
vi.mock('./services/sharingServices', () => ({ getReceivedInvitations: vi.fn().mockResolvedValue([]) }));
afterEach(cleanup);
beforeEach(() => vi.mocked(getCurrentUser).mockResolvedValue({ email: 'traveler@example.com' }));

function HistoryControls() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>Go back</button>;
}
function open(path: string) {
  render(<MemoryRouter initialEntries={[path]}><App /><HistoryControls /></MemoryRouter>);
}
it('opens the trips page directly and marks its navigation link active', async () => {
  open('/trips');
  expect(await screen.findByRole('heading', { name: 'Your trips', level: 1 })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Trips' }).getAttribute('aria-current')).toBe('page');
  expect(screen.queryByText('Departure alerts')).toBeNull();
});
it('navigates between pages and supports history back', async () => {
  open('/dashboard');
  await screen.findByRole('heading', { name: 'Where to next?' });
  fireEvent.click(screen.getByRole('link', { name: 'Invitations' }));
  expect(await screen.findByRole('heading', { name: 'No pending invitations' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
  expect(await screen.findByRole('heading', { name: 'Where to next?' })).toBeTruthy();
});
it('redirects the root to the dashboard', async () => {
  open('/');
  expect(await screen.findByRole('heading', { name: 'Where to next?' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Dashboard' }).getAttribute('aria-current')).toBe('page');
});
it('provides a recovery link for unknown routes', async () => {
  open('/missing');
  expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Return to dashboard' }).getAttribute('href')).toBe('/dashboard');
});
it('requires authentication on direct page access', async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);
  open('/trips');
  expect(await screen.findByText('Adventure is waiting.')).toBeTruthy();
  expect(screen.queryByRole('navigation')).toBeNull();
});
