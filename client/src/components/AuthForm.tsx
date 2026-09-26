import { useState, type FormEvent } from "react";
import { login, register, requestPasswordReset, resetPassword } from "../services/authServices";
import type { User } from "../models/User";

interface AuthFormProps {
    onAuthenticated: (user: User) => void;
}

function AuthForm({ onAuthenticated }: AuthFormProps) {
    const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [resetToken, setResetToken] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setIsSubmitting(true);

        try {
            if (mode === "forgot") {
                const token = await requestPasswordReset(email);
                setMessage(token
                    ? "Reset code created. Choose your new password below."
                    : "If an account exists for that email, reset instructions have been created.");
                if (token) {
                    setResetToken(token);
                    setMode("reset");
                }
                return;
            }

            if (mode === "reset") {
                if (password !== confirmPassword) {
                    setError("The passwords do not match.");
                    return;
                }
                await resetPassword(email, resetToken, password);
                setPassword("");
                setConfirmPassword("");
                setResetToken("");
                setMode("login");
                setMessage("Password updated. You can now sign in.");
                return;
            }

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
        setMessage("");
    }

    const heading = mode === "login" ? "Ready for your next trip?"
        : mode === "register" ? "Start your travel story"
        : mode === "forgot" ? "Reset your password"
        : "Choose a new password";

    return (
        <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-heading">
                <span className="eyebrow">{mode === "login" ? "Welcome back" : mode === "register" ? "Join Wanderly" : "Account recovery"}</span>
                <h2>{heading}</h2>
                <p>{mode === "login" ? "Sign in to pick up where you left off." : mode === "register" ? "Create an account to save your plans in one place." : mode === "forgot" ? "Enter the email connected to your account." : "Use the reset code to secure your account with a new password."}</p>
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

            {mode !== "forgot" && <div className="field-group"><label htmlFor="password">{mode === "reset" ? "New password" : "Password"}</label><input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
            /></div>}

            {mode === "reset" && <>
                <div className="field-group"><label htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" type="password" placeholder="Enter it again" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></div>
                <div className="field-group"><label htmlFor="reset-token">Reset code</label><textarea id="reset-token" value={resetToken} onChange={(event) => setResetToken(event.target.value)} required /></div>
            </>}

            {error && <p className="alert" role="alert">{error}</p>}
            {message && <p className="success-message" role="status">{message}</p>}

            <button className="button button--primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Just a moment…" : mode === "login" ? "Sign in" : mode === "register" ? "Create my account" : mode === "forgot" ? "Create reset code" : "Update password"}
                {!isSubmitting && <span aria-hidden="true">→</span>}
            </button>
            {mode === "login" && <button className="forgot-password" type="button" onClick={() => { setMode("forgot"); setError(""); setMessage(""); }}>Forgot your password?</button>}
            <p className="auth-switch">{mode === "login" ? "New to Wanderly?" : "Ready to sign in?"}<button type="button" onClick={switchMode}>{mode === "login" ? "Create an account" : "Sign in"}</button></p>
        </form>
    );
}

export default AuthForm;
