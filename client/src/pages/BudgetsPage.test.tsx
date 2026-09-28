// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BudgetsPage from './BudgetsPage';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('shows separate currency totals and links to trip details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
        totals: [{ currency: 'USD', budgetAmount: 500, totalSpent: 100, remaining: 400 }, { currency: 'EUR', budgetAmount: 300, totalSpent: 50, remaining: 250 }],
        trips: [{ id: 42, destination: 'Rome', country: 'Italy', startDate: '2099-06-01', endDate: '2099-06-05', currency: 'EUR', totalSpent: 50, remaining: 250, shared: true }],
    }) }));
    render(<MemoryRouter><BudgetsPage /></MemoryRouter>);
    expect((await screen.findByRole('link', { name: 'Rome' })).getAttribute('href')).toBe('/trips/42');
    expect(screen.getByRole('heading', { name: 'USD' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'EUR' })).toBeTruthy();
    expect(screen.getByText(/Shared budgets are whole-trip amounts/)).toBeTruthy();
});
it('shows a retry action when the overview cannot load', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error()));
    render(<MemoryRouter><BudgetsPage /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
});
