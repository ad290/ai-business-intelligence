import type { ReactNode } from "react";

type AnalyticsDashboardSectionProps = {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
};

export function AnalyticsDashboardSection({
  id,
  title,
  children,
  className = "",
}: AnalyticsDashboardSectionProps) {
  return (
    <section
      className={`page-card analytics-section ${className}`.trim()}
      aria-labelledby={id}
    >
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

export function DashboardLoadingState({ message }: { message: string }) {
  return (
    <p className="dashboard-status dashboard-status-loading" role="status">
      {message}
    </p>
  );
}

export function DashboardEmptyState({ message }: { message: string }) {
  return <p className="dashboard-status dashboard-status-empty">{message}</p>;
}
