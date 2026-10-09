import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import { listDatasets } from "../api/datasets";
import { useAuth } from "../auth/AuthContext";
import { DashboardLoadingState } from "../components/AnalyticsDashboardSection";
import type { DatasetSummary } from "../types/dataset";

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRowLabel(rowCount: number, fileType: DatasetSummary["fileType"]): string {
  const count = rowCount.toLocaleString();
  return fileType === "json" ? `${count} records` : `${count} rows`;
}

function firstName(fullName: string): string {
  const part = fullName.trim().split(/\s+/)[0];
  return part || fullName;
}

const ANALYTICS_SHORTCUTS = [
  { title: "Charts & KPIs", tag: "Line chart" },
  { title: "Revenue forecast", tag: "Forecast" },
  { title: "Anomaly detection", tag: "Analysis" },
] as const;

function RecentItemMenu({
  datasetId,
  variant,
}: {
  datasetId?: string;
  variant: "datasets" | "analytics";
}) {
  return (
    <details className="dashboard-item-menu">
      <summary className="dashboard-item-menu-trigger" aria-label="Actions">
        ⋮
      </summary>
      <div className="dashboard-item-menu-panel">
        {variant === "datasets" ? (
          <Link to="/datasets">Manage datasets</Link>
        ) : (
          <Link to="/analytics">Open analytics</Link>
        )}
        {datasetId ? (
          <Link to={`/analytics?dataset=${datasetId}`}>View dataset</Link>
        ) : null}
      </div>
    </details>
  );
}

export function UserDashboardPage() {
  const { user, company } = useAuth();
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await listDatasets();
        if (!cancelled) {
          setDatasets(response.datasets);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Failed to load datasets"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const recentDatasets = useMemo(() => {
    return [...datasets]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 3);
  }, [datasets]);

  const recentAnalytics = useMemo(() => {
    const sorted = [...datasets].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    return ANALYTICS_SHORTCUTS.map((shortcut, index) => {
      const dataset = sorted[index];
      return {
        title: shortcut.title,
        tag: shortcut.tag,
        datasetId: dataset?.id,
        date: dataset?.updatedAt ?? dataset?.createdAt,
      };
    });
  }, [datasets]);

  if (!user || !company) {
    return null;
  }

  return (
    <div className="app-page app-page--home dashboard-home">
      <header className="dashboard-home-header">
        <h1 id="dashboard-title">Dashboard</h1>
        <p className="dashboard-home-greeting">
          Welcome back, {firstName(user.name)}.
        </p>
      </header>

      <div className="dashboard-home-grid">
        <section
          className="dashboard-panel dashboard-panel--datasets"
          aria-labelledby="dashboard-datasets-heading"
        >
          <div className="dashboard-panel-head">
            <div>
              <h2 id="dashboard-datasets-heading" className="dashboard-panel-title">
                Datasets
              </h2>
              <p className="dashboard-panel-desc">
                Upload CSV or JSON files for your company.
              </p>
            </div>
            <Link to="/datasets" className="dashboard-panel-cta dashboard-panel-cta--green">
              Upload Dataset
            </Link>
          </div>

          <div className="dashboard-recent-bar">
            <h3 className="dashboard-recent-title">Recent datasets</h3>
            <Link to="/datasets" className="dashboard-recent-link dashboard-recent-link--green">
              View all →
            </Link>
          </div>

          {loading ? (
            <DashboardLoadingState message="Loading datasets…" />
          ) : null}

          {error ? (
            <p className="error-banner" role="alert">{error}</p>
          ) : null}

          {!loading && !error && recentDatasets.length === 0 ? (
            <p className="muted dashboard-recent-empty">No datasets yet.</p>
          ) : null}

          {!loading && recentDatasets.length > 0 ? (
            <ul className="dashboard-recent-list">
              {recentDatasets.map((dataset) => (
                <li key={dataset.id} className="dashboard-recent-item">
                  <Link to="/datasets" className="dashboard-recent-item-main">
                    <span className="dashboard-recent-item-title">
                      {dataset.originalFileName}
                    </span>
                    <span className="dashboard-recent-item-meta">
                      {formatRowLabel(dataset.rowCount, dataset.fileType)} · Uploaded{" "}
                      {formatShortDate(dataset.createdAt)}
                    </span>
                  </Link>
                  <RecentItemMenu datasetId={dataset.id} variant="datasets" />
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section
          className="dashboard-panel dashboard-panel--analytics"
          aria-labelledby="dashboard-analytics-heading"
        >
          <div className="dashboard-panel-head">
            <div>
              <h2 id="dashboard-analytics-heading" className="dashboard-panel-title">
                Analytics
              </h2>
              <p className="dashboard-panel-desc">
                Charts, forecasts, anomalies, and AI questions.
              </p>
            </div>
            <Link
              to="/analytics"
              className="dashboard-panel-cta dashboard-panel-cta--purple"
            >
              Open Analytics
            </Link>
          </div>

          <div className="dashboard-recent-bar">
            <h3 className="dashboard-recent-title">Recent analytics</h3>
            <Link to="/analytics" className="dashboard-recent-link dashboard-recent-link--purple">
              View all →
            </Link>
          </div>

          {!loading && datasets.length === 0 ? (
            <p className="muted dashboard-recent-empty">
              Upload a dataset to start analyzing.
            </p>
          ) : null}

          {!loading && datasets.length > 0 ? (
            <ul className="dashboard-recent-list">
              {recentAnalytics.map((item, index) => (
                <li key={`${item.title}-${index}`} className="dashboard-recent-item">
                  <Link
                    to={
                      item.datasetId
                        ? `/analytics?dataset=${item.datasetId}`
                        : "/analytics"
                    }
                    className="dashboard-recent-item-main"
                  >
                    <span className="dashboard-recent-item-title">
                      {item.title}
                    </span>
                    <span className="dashboard-recent-item-meta">
                      {item.tag}
                      {item.date ? ` · ${formatShortDate(item.date)}` : ""}
                    </span>
                  </Link>
                  <RecentItemMenu datasetId={item.datasetId} variant="analytics" />
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  );
}
