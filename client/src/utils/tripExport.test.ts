// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { tripSummaryHtml } from './tripExport';
import { defaultPreferences, setPreferences } from '../i18n/preferences';
import type { TripSummary } from '../services/exportServices';

export const summary: TripSummary = {
  trip: { id: 1, destination: 'Rome', country: 'Italy', startDate: '2030-01-01', endDate: '2030-01-03', days: 3, createdAt: null, notes: 'Bring documents\nMeet at airport', accommodationName: 'Hotel', accommodationAddress: '12 Example Street', bookingReference: 'ABC123', usefulLinks: [{ id: 1, tripId: 1, label: 'Booking', url: 'https://example.com/?a=1&b=2' }], accessRole: 'Viewer' },
  itinerary: [{ id: 1, tripId: 1, title: 'Museum', date: '2030-01-02', time: '09:30:00', location: 'Museum street', note: 'Tickets booked' }],
  packing: [{ id: 1, tripId: 1, name: 'Passport', category: 'Documents', quantity: 2, isPacked: true }],
  budget: { budgetAmount: 100, currency: 'EUR', totalSpent: 20, remaining: 80, percentUsed: 20, expenses: [{ id: 1, tripId: 1, description: 'Tickets', amount: 20, category: 'Activities', date: '2030-01-02' }] },
  generatedAt: new Date('2030-01-01T10:00:00Z'),
};
afterEach(() => setPreferences(defaultPreferences));
it('exports all saved sections in a standalone document without remote resources', () => {
  const doc = new DOMParser().parseFromString(tripSummaryHtml(summary), 'text/html');
  for (const text of ['ABC123', '12 Example Street', 'Museum', '09:30', 'Museum street', 'Tickets booked', 'Passport × 2', 'Packed', 'Tickets']) {
    expect(doc.body.textContent).toContain(text);
  }
  expect(doc.body.textContent).toContain('€20.00');
  expect(doc.querySelectorAll('script,img,iframe,link')).toHaveLength(0);
  expect(doc.querySelector('style')).not.toBeNull();
  expect(doc.querySelector('a')?.getAttribute('href')).toBe('https://example.com/?a=1&b=2');
  expect(doc.querySelector('meta[http-equiv="Content-Security-Policy"]')).not.toBeNull();
});
it('escapes hostile text and removes executable link schemes', () => {
  const doc = new DOMParser().parseFromString(tripSummaryHtml({ ...summary, trip: { ...summary.trip, destination: '</title><script>alert(1)</script>', notes: '<img src=x onerror=alert(1)>', usefulLinks: [{ id: 1, tripId: 1, label: 'Unsafe', url: 'javascript:alert(1)' }] } }), 'text/html');
  expect(doc.querySelectorAll('script,img,a')).toHaveLength(0);
  expect(doc.body.textContent).toContain('<img src=x onerror=alert(1)>');
});
it('supports Hebrew RTL and explicit empty sections', () => {
  setPreferences({ ...defaultPreferences, language: 'he' });
  const doc = new DOMParser().parseFromString(tripSummaryHtml({ ...summary, itinerary: [], packing: [], budget: { ...summary.budget, expenses: [] } }), 'text/html');
  expect(doc.documentElement.dir).toBe('rtl');
  expect(doc.documentElement.lang).toBe('he');
  expect(doc.body.textContent).toContain('אין פעילויות שמורות.');
  expect(doc.body.textContent).toContain('אין פריטי ציוד שמורים.');
});
