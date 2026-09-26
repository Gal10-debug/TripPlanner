import type { User } from "../models/User";

const authUrl = "http://localhost:5075/api/auth";

async function getErrorMessage(response: Response): Promise<string> {
    const body = await response.json().catch(() => null) as {
        detail?: string;
        errors?: Record<string, string[]>;
    } | null;

    const validationMessage = body?.errors
        ? Object.values(body.errors).flat()[0]
        : undefined;

    return validationMessage ?? body?.detail ?? "Authentication failed.";
}

export async function register(email: string, password: string): Promise<void> {
    const response = await fetch(`${authUrl}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include"
    });

    if (!response.ok) {
        throw new Error(await getErrorMessage(response));
    }
}

export async function login(email: string, password: string): Promise<void> {
    const response = await fetch(`${authUrl}/login?useCookies=true`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include"
    });

    if (!response.ok) {
        throw new Error(await getErrorMessage(response));
    }
}

export async function logout(): Promise<void> {
    const response = await fetch(`${authUrl}/logout`, {
        method: "POST",
        credentials: "include"
    });

    if (!response.ok) {
        throw new Error("Failed to log out.");
    }
}

export async function getCurrentUser(): Promise<User | null> {
    const response = await fetch(`${authUrl}/me`, {
        credentials: "include"
    });

    if (response.status === 401) {
        return null;
    }

    if (!response.ok) {
        throw new Error("Failed to check your session.");
    }

    return response.json();
}
