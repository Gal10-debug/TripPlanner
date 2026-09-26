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
        <form onSubmit={handleSubmit}>
            <h2>{mode === "login" ? "Log in" : "Create account"}</h2>

            <input
                type="email"
                placeholder="Email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
            />

            <input
                type="password"
                placeholder="Password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
            />

            {error && <p role="alert">{error}</p>}

            <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Please wait..." : mode === "login" ? "Log in" : "Register"}
            </button>
            <button type="button" onClick={switchMode}>
                {mode === "login" ? "Create an account" : "I already have an account"}
            </button>
        </form>
    );
}

export default AuthForm;
