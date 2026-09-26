import { useState, type FormEvent } from "react";
import { login, register } from "../services/authServices";
import type { User } from "../models/User";

interface AuthFormProps {
    onAuthenticated: (user: User) => void;
}

function AuthForm({ onAuthenticated }: AuthFormProps) {
    const [mode, setMode] = useState<"login" | "register">("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setIsSubmitting(true);

        try {
            if (mode === "register") {
                await register(email, password);
            }

            await login(email, password);
            onAuthenticated({ email });
        } catch (authError) {
            setError(authError instanceof Error ? authError.message : "Authentication failed.");
        } finally {
            setIsSubmitting(false);
        }
    }

    function switchMode() {
        setMode(current => current === "login" ? "register" : "login");
        setError("");
    }

    return (
        <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-heading">
                <span className="eyebrow">{mode === "login" ? "Welcome back" : "Join Wanderly"}</span>
                <h2>{mode === "login" ? "Ready for your next trip?" : "Start your travel story"}</h2>
                <p>{mode === "login" ? "Sign in to pick up where you left off." : "Create an account to save your plans in one place."}</p>
            </div>

            <div className="field-group"><label htmlFor="email">Email address</label><input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
            /></div>

            <div className="field-group"><label htmlFor="password">Password</label><input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
            /></div>

            {error && <p className="alert" role="alert">{error}</p>}

            <button className="button button--primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Just a moment…" : mode === "login" ? "Sign in" : "Create my account"}
                {!isSubmitting && <span aria-hidden="true">→</span>}
            </button>
            <p className="auth-switch">{mode === "login" ? "New to Wanderly?" : "Already have an account?"}<button type="button" onClick={switchMode}>{mode === "login" ? "Create an account" : "Sign in"}</button></p>
        </form>
    );
}

export default AuthForm;
