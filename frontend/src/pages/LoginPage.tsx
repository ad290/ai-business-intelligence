import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { getAuthErrorMessage, useAuth } from "../auth/AuthContext";
import { AuthPageShell } from "../components/AuthPageShell";

type LoginLocationState = {
  from?: string;
  registered?: boolean;
};

export function LoginPage() {
  const { login, status, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LoginLocationState | null;
  const redirectTo = locationState?.from ?? "/dashboard";
  const justRegistered = locationState?.registered === true;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status !== "loading" && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  if (status === "loading") {
    return (
      <AuthPageShell>
        <p className="muted auth-shell-status">Loading…</p>
      </AuthPageShell>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login({ email, password });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPageShell>
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Sign in</h1>
        <p className="muted">Access your company workspace</p>

        {justRegistered ? (
          <p className="success-banner" role="status">
            Account created. Sign in with your email and password.
          </p>
        ) : null}

        {error && <p className="error-banner" role="alert">{error}</p>}

        <label>
          Email
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label>
          Password
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <button type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>

        <p className="auth-footer">
          No account? <Link to="/register">Create one</Link>
        </p>
      </form>
    </AuthPageShell>
  );
}
