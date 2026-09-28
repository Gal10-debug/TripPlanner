import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { t, usePreferences } from '../i18n/preferences';

interface Total { currency: string; budgetAmount: number; totalSpent: number; remaining: number; tripCount: number }
interface BudgetTrip extends Total { id: number; destination: string; country: string; startDate: string; endDate: string; shared: boolean }
export default function BudgetsPage() {
    const { language } = usePreferences();
    const [data, setData] = useState<{ trips: BudgetTrip[]; totals: Total[] } | null>(null);
    const [error, setError] = useState(false);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        const abort = new AbortController();
        fetch('/api/budgets', { signal: abort.signal }).then(response => { if (!response.ok) throw new Error(); return response.json(); })
            .then(setData).catch(() => { if (!abort.signal.aborted) setError(true); });
        return () => abort.abort();
    }, [attempt]);
    const money = (value: number, currency: string) => new Intl.NumberFormat(language, { style: 'currency', currency }).format(value);
    return <section>
        <div className="dashboard-intro"><span className="eyebrow">{t('My journeys')}</span><h1>{t('Budgets')}</h1><p>{t('Plan and track spending across your trips. Totals stay separate for each currency.')}</p></div>
        {error ? <div role="alert"><p>{t('Unable to load budgets.')}</p><button className="button" onClick={() => { setError(false); setAttempt(v => v + 1); }}>{t('Retry')}</button></div> : !data ? <p role="status">{t('Loading budgets…')}</p> : data.trips.length === 0 ? <div className="empty-state"><h2>{t('No trips yet')}</h2><Link to="/trips">{t('Create a trip')}</Link></div> : <>
            <p className="settings-hint">{t('Includes trips shared with you. Shared budgets are whole-trip amounts, not your individual share.')}</p>
            <div className="budget-overview-grid">{data.totals.map(total => <article className="settings-form" key={total.currency}><h2>{total.currency}</h2><dl><dt>{t('Budget')}</dt><dd>{money(total.budgetAmount, total.currency)}</dd><dt>{t('Spent')}</dt><dd>{money(total.totalSpent, total.currency)}</dd><dt>{t('Remaining')}</dt><dd>{money(total.remaining, total.currency)}</dd></dl></article>)}</div>
            <div className="trip-grid">{data.trips.map(trip => <article className="trip-card budget-overview-trip" key={trip.id}><div><Link to={`/trips/${trip.id}`}><strong>{trip.destination}</strong></Link><p>{trip.country} · {trip.startDate} — {trip.endDate}{trip.shared && ` · ${t('Shared trip')}`}</p></div><div><strong>{money(trip.totalSpent, trip.currency)}</strong><p>{t('Remaining')}: {money(trip.remaining, trip.currency)}</p></div></article>)}</div>
        </>}
    </section>;
}
