import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { APP_LOGO_URL } from "../config/branding";
import { SiteFooter } from "./SiteFooter";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export function AppLayout() {
  const { user, company, logout } = useAuth();

  if (!user || !company) {
    return null;
  }

  return (
    <div className="app-layout">
      <aside className="app-sidebar" aria-label="Application">
        <Link to="/dashboard" className="app-sidebar-brand" aria-label="AI Business Analyst home">
          <img
            className="app-sidebar-logo"
            src={APP_LOGO_URL}
            alt=""
            width={320}
            height={90}
            decoding="async"
          />
          <span className="app-sidebar-brand-text">AI Business Analyst</span>
        </Link>

        <nav className="app-sidebar-nav" aria-label="Main">
          <NavLink to="/dashboard" end className="app-sidebar-link">
            Dashboard
          </NavLink>
          <NavLink to="/datasets" className="app-sidebar-link">
            Datasets
          </NavLink>
          <NavLink to="/documents" className="app-sidebar-link">
            Documents
          </NavLink>
          <NavLink to="/analytics" className="app-sidebar-link">
            Analytics
          </NavLink>
        </nav>

        <div className="app-sidebar-footer">
          <div
            className="app-sidebar-user"
            aria-label={`Signed in as ${user.name}, ${company.name}`}
          >
            <span className="header-user-avatar" aria-hidden="true">
              {getInitials(user.name)}
            </span>
            <span className="app-sidebar-user-text">
              <span className="app-sidebar-user-name">{user.name}</span>
              <span className="app-sidebar-user-company">{company.name}</span>
            </span>
          </div>
          <button
            type="button"
            className="button-secondary app-sidebar-signout"
            onClick={() => void logout()}
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="app-body">
        <header className="app-mobile-header" aria-label="Application header">
          <div className="app-mobile-header-row">
            <Link
              to="/dashboard"
              className="app-mobile-brand"
              aria-label="AI Business Analyst home"
            >
              <img
                className="app-mobile-logo"
                src={APP_LOGO_URL}
                alt=""
                width={320}
                height={90}
                decoding="async"
              />
            </Link>

            <div className="app-mobile-header-actions">
              <div
                className="app-mobile-profile"
                aria-label={`Signed in as ${user.name}, ${company.name}`}
              >
                <span className="header-user-avatar" aria-hidden="true">
                  {getInitials(user.name)}
                </span>
                <span className="app-mobile-profile-text">
                  <span className="app-mobile-profile-name">{user.name}</span>
                  <span className="app-mobile-profile-company">{company.name}</span>
                </span>
              </div>
              <button
                type="button"
                className="button-secondary app-mobile-signout"
                onClick={() => void logout()}
              >
                Sign out
              </button>
            </div>
          </div>

          <nav className="app-topbar-nav" aria-label="Main">
            <NavLink to="/dashboard" end>
              Dashboard
            </NavLink>
            <NavLink to="/datasets">Datasets</NavLink>
            <NavLink to="/documents">Documents</NavLink>
            <NavLink to="/analytics">Analytics</NavLink>
          </nav>
        </header>

        <main className="app-main">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
