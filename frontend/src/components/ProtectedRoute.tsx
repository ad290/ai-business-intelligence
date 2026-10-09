import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AuthPageShell } from "./AuthPageShell";

export function ProtectedRoute() {
  const { status, isAuthenticated } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <AuthPageShell>
        <p className="muted auth-shell-status">Restoring session…</p>
      </AuthPageShell>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
