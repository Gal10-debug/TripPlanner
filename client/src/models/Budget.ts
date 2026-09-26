export interface Expense {
    id: number;
    tripId: number;
    description: string;
    amount: number;
    category: string;
    date: string;
}

export type ExpenseRequest = Omit<Expense, "id" | "tripId">;

export interface BudgetOverview {
    budgetAmount: number;
    currency: string;
    totalSpent: number;
    remaining: number;
    percentUsed: number;
    expenses: Expense[];
}
