import type { BudgetOverview, ExpenseRequest } from "../models/Budget";

const budgetUrl = (tripId: number) => `/api/trips/${tripId}/budget`;

async function parse(response: Response): Promise<BudgetOverview> {
    if (!response.ok) {
        const body = await response.json().catch(() => null) as { detail?: string; errors?: Record<string, string[]> } | null;
        const validationError = body?.errors ? Object.values(body.errors).flat()[0] : undefined;
        throw new Error(validationError ?? body?.detail ?? "Unable to update the trip budget.");
    }
    return response.json();
}

export async function getBudget(tripId: number) {
    return parse(await fetch(budgetUrl(tripId), { credentials: "include" }));
}

export async function saveBudget(tripId: number, amount: number, currency: string) {
    return parse(await fetch(budgetUrl(tripId), { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ amount, currency }) }));
}

export async function addExpense(tripId: number, expense: ExpenseRequest) {
    return parse(await fetch(`${budgetUrl(tripId)}/expenses`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(expense) }));
}

export async function updateExpense(tripId: number, expenseId: number, expense: ExpenseRequest) {
    return parse(await fetch(`${budgetUrl(tripId)}/expenses/${expenseId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(expense) }));
}

export async function deleteExpense(tripId: number, expenseId: number) {
    return parse(await fetch(`${budgetUrl(tripId)}/expenses/${expenseId}`, { method: "DELETE", credentials: "include" }));
}
