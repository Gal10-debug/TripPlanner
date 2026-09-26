import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { BudgetOverview, Expense, ExpenseRequest } from "../models/Budget";
import { addExpense, deleteExpense, getBudget, saveBudget, updateExpense } from "../services/budgetServices";

const categories = ["Accommodation", "Transport", "Food", "Activities", "Shopping", "Other"];
const currencies = ["USD", "EUR", "GBP", "ILS", "JPY", "CAD", "AUD"];
const emptyOverview: BudgetOverview = { budgetAmount: 0, currency: "USD", totalSpent: 0, remaining: 0, percentUsed: 0, expenses: [] };
const newExpense = (): ExpenseRequest => ({ description: "", amount: 0, category: "Food", date: new Date().toISOString().slice(0, 10) });

function BudgetPanel({ tripId }: { tripId: number }) {
    const [overview, setOverview] = useState<BudgetOverview>(emptyOverview);
    const [budgetAmount, setBudgetAmount] = useState("");
    const [currency, setCurrency] = useState("USD");
    const [draft, setDraft] = useState<ExpenseRequest>(newExpense);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [showBudgetForm, setShowBudgetForm] = useState(false);
    const [showExpenseForm, setShowExpenseForm] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        getBudget(tripId)
            .then(data => { if (active) { const normalized = { ...data, currency: data.currency || "USD" }; setOverview(normalized); setBudgetAmount(String(data.budgetAmount || "")); setCurrency(normalized.currency); } })
            .catch(loadError => { if (active) setError(loadError instanceof Error ? loadError.message : "Failed to load budget."); })
            .finally(() => { if (active) setIsLoading(false); });
        return () => { active = false; };
    }, [tripId]);

    const categoryTotals = useMemo(() => {
        const totals = new Map<string, number>();
        for (const expense of overview.expenses) totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount);
        return [...totals.entries()].sort(([, first], [, second]) => second - first);
    }, [overview.expenses]);

    async function submitBudget(event: FormEvent) {
        event.preventDefault();
        setIsSaving(true);
        setError("");
        try {
            setOverview(await saveBudget(tripId, Number(budgetAmount), currency));
            setShowBudgetForm(false);
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : "Failed to save budget.");
        } finally { setIsSaving(false); }
    }

    async function submitExpense(event: FormEvent) {
        event.preventDefault();
        setIsSaving(true);
        setError("");
        try {
            const updated = editingId === null ? await addExpense(tripId, draft) : await updateExpense(tripId, editingId, draft);
            setOverview(updated);
            closeExpenseForm();
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : "Failed to save expense.");
        } finally { setIsSaving(false); }
    }

    async function removeExpense(expenseId: number) {
        setIsSaving(true);
        setError("");
        try { setOverview(await deleteExpense(tripId, expenseId)); }
        catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "Failed to delete expense."); }
        finally { setIsSaving(false); }
    }

    function editExpense(expense: Expense) {
        setDraft({ description: expense.description, amount: expense.amount, category: expense.category, date: expense.date });
        setEditingId(expense.id);
        setShowExpenseForm(true);
    }

    function closeExpenseForm() {
        setDraft(newExpense());
        setEditingId(null);
        setShowExpenseForm(false);
    }

    const money = (value: number) => new Intl.NumberFormat("en", { style: "currency", currency: overview.currency, maximumFractionDigits: 2 }).format(value);
    const isOverBudget = overview.budgetAmount > 0 && overview.remaining < 0;

    return <section className="budget-panel">
        <div className="budget-heading"><div><span className="eyebrow">Budget & expenses</span><h3>Know where it goes</h3></div><div><button className="text-action" onClick={() => setShowBudgetForm(value => !value)}>{overview.budgetAmount ? "Edit budget" : "Set budget"}</button><button className="text-action" onClick={() => { closeExpenseForm(); setShowExpenseForm(true); }}>+ Add expense</button></div></div>

        {showBudgetForm && <form className="budget-form" onSubmit={submitBudget}><label>Trip budget<input type="number" min="0" step="0.01" value={budgetAmount} onChange={event => setBudgetAmount(event.target.value)} placeholder="0.00" required /></label><label>Currency<select value={currency} onChange={event => setCurrency(event.target.value)}>{currencies.map(code => <option key={code}>{code}</option>)}</select></label><div className="card-actions"><button type="submit" disabled={isSaving}>Save budget</button><button type="button" className="secondary-action" onClick={() => setShowBudgetForm(false)}>Cancel</button></div></form>}

        {showExpenseForm && <form className="expense-form" onSubmit={submitExpense}><div className="expense-form__row"><label>Description<input value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} placeholder="Hotel, train tickets…" maxLength={200} required /></label><label>Amount<input type="number" min="0.01" step="0.01" value={draft.amount || ""} onChange={event => setDraft({ ...draft, amount: Number(event.target.value) })} required /></label></div><div className="expense-form__row"><label>Category<select value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })}>{categories.map(category => <option key={category}>{category}</option>)}</select></label><label>Date<input type="date" value={draft.date} onChange={event => setDraft({ ...draft, date: event.target.value })} required /></label></div><div className="card-actions"><button type="submit" disabled={isSaving}>{editingId === null ? "Add expense" : "Save expense"}</button><button type="button" className="secondary-action" onClick={closeExpenseForm}>Cancel</button></div></form>}

        {error && <p className="alert" role="alert">{error}</p>}
        {isLoading ? <p className="budget-status">Loading your budget…</p> : <>
            <div className="budget-summary"><div><small>Spent</small><strong>{money(overview.totalSpent)}</strong></div><div><small>Budget</small><strong>{overview.budgetAmount ? money(overview.budgetAmount) : "Not set"}</strong></div><div className={isOverBudget ? "budget-balance budget-balance--over" : "budget-balance"}><small>{isOverBudget ? "Over budget" : "Remaining"}</small><strong>{money(Math.abs(overview.remaining))}</strong></div></div>
            {overview.budgetAmount > 0 && <div className={isOverBudget ? "budget-meter budget-meter--over" : "budget-meter"}><div><span style={{ width: `${Math.min(overview.percentUsed, 100)}%` }} /></div><small>{overview.percentUsed}% used</small></div>}
            {categoryTotals.length > 0 && <div className="category-breakdown">{categoryTotals.map(([category, total]) => <div key={category}><span>{category}</span><div><i style={{ width: `${overview.totalSpent ? total / overview.totalSpent * 100 : 0}%` }} /></div><strong>{money(total)}</strong></div>)}</div>}
            {overview.expenses.length === 0 ? <div className="budget-empty"><span>¤</span><p>No expenses yet. Add your first cost to start tracking.</p></div> : <div className="expense-list">{overview.expenses.map(expense => <article key={expense.id}><span className="expense-icon">{categoryIcon(expense.category)}</span><div><strong>{expense.description}</strong><small>{expense.category} · {formatDate(expense.date)}</small></div><b>{money(expense.amount)}</b><div><button onClick={() => editExpense(expense)}>Edit</button><button disabled={isSaving} onClick={() => removeExpense(expense.id)}>Delete</button></div></article>)}</div>}
        </>}
    </section>;
}

function categoryIcon(category: string) {
    return ({ Accommodation: "⌂", Transport: "→", Food: "◉", Activities: "✦", Shopping: "◇", Other: "·" } as Record<string, string>)[category] ?? "·";
}

function formatDate(date: string) {
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T00:00:00`));
}

export default BudgetPanel;
