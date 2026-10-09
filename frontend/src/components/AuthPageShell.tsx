import type { ReactNode } from "react";
import { APP_LOGO_URL } from "../config/branding";
import { SiteFooter } from "./SiteFooter";

type AuthPageShellProps = {
  children: ReactNode;
};

export function AuthPageShell({ children }: AuthPageShellProps) {
  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <img
          className="auth-logo"
          src={APP_LOGO_URL}
          alt="AI Business Analyst"
          width={320}
          height={90}
          decoding="async"
        />
        {children}
        <SiteFooter />
      </div>
    </div>
  );
}
