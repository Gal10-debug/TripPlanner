import type { User } from "../models/User";

const authUrl = "/api/auth";

async function request(url: string, options?: RequestInit): Promise<Response> {
    try {
        return await fetch(url, options);
    } catch {
        throw new Error("Unable to connect to the server. Please make sure it is running and try again.");
    }
}

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
    const response = await request(`${authUrl}/register`, {
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
    const response = await request(`${authUrl}/login?useCookies=true`, {
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
    const response = await request(`${authUrl}/logout`, {
        method: "POST",
        credentials: "include"
    });

    if (!response.ok) {
        throw new Error("Failed to log out.");
    }
}

export async function getCurrentUser(): Promise<User | null> {
    let response: Response;

    try {
        response = await request(`${authUrl}/me`, {
            credentials: "include"
        });
    } catch {
        // A session check should never prevent the sign-in screen from opening.
        return null;
    }

    if (response.status === 401) {
        return null;
    }

    if (!response.ok) {
        throw new Error("Failed to check your session.");
    }

    return response.json();
}
