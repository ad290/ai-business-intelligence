import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { getAuthErrorMessage, useAuth } from "../auth/AuthContext";
import { AuthPageShell } from "../components/AuthPageShell";

export function RegisterPage() {
  const { register, status, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
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
      await register({ name, email, password, companyName });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPageShell>
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Create account</h1>
        <p className="muted">Register your company and admin user</p>

        {error && <p className="error-banner" role="alert">{error}</p>}

        <label>
          Your name
          <input
            type="text"
            name="name"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

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
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <label>
          Company name
          <input
            type="text"
            name="companyName"
            autoComplete="organization"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
        </label>

        <button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create account"}
        </button>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </AuthPageShell>
  );
}
