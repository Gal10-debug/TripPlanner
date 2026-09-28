// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import TripHero from './TripHero';
import type { Trip } from '../models/Trip';
import photos from '../data/countryPhotos.json';

const trip: Trip = { id: 1, destination: 'Rome', country: 'Italy', startDate: '2026-10-01', endDate: '2026-10-05', days: 5, createdAt: null, notes: '', accommodationName: '', accommodationAddress: '', bookingReference: '', usefulLinks: [], accessRole: 'Owner' };
afterEach(cleanup);

it.each(['Italy', 'IT', 'איטליה'])('uses the country photo for %s and credits the loaded image', country => {
    const { container } = render(<TripHero trip={{ ...trip, country }} />);
    const image = container.querySelector('img')!;
    expect(image.getAttribute('src')).toBe(photos.IT.url);
    expect(image.getAttribute('alt')).toBe('');
    fireEvent.load(image);
    expect(screen.getByText('Photo credits')).toBeTruthy();
    expect(screen.getByRole('link', { name: photos.IT.artist }).getAttribute('href')).toBe(photos.IT.source);
});

it('retains trip details after image failure and resets the image on country changes', () => {
    const { container, rerender } = render(<TripHero trip={trip} />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Rome' })).toBeTruthy();
    expect(screen.queryByText('Photo credits')).toBeNull();
    rerender(<TripHero trip={{ ...trip, country: 'Japan', destination: 'Tokyo' }} />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe(photos.JP.url);
    expect(screen.getByRole('heading', { name: 'Tokyo' })).toBeTruthy();
});

it('uses the fallback for an unknown country without an unrelated photo', () => {
    const { container } = render(<TripHero trip={{ ...trip, country: 'Unknown place' }} />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Rome' })).toBeTruthy();
    expect(screen.getByText('5 days')).toBeTruthy();
});


it.each(['Great Britian', 'Great Britain', 'United Kingdom', 'UK', 'England'])('shows the British destination photo for %s', country => {
    const { container } = render(<TripHero trip={{ ...trip, country, destination: 'London' }} />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe(photos.GB.url);
    expect(screen.getByRole('heading', { name: 'London' })).toBeTruthy();
});

it('changes the background when moving from Britain to Italy', () => {
    const { container, rerender } = render(<TripHero trip={{ ...trip, country: 'Great Britian', destination: 'London' }} />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe(photos.GB.url);
    rerender(<TripHero trip={trip} />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe(photos.IT.url);
});
