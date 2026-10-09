import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DotProps } from "recharts";
import { ApiError } from "../api/client";
import { fetchDatasetAnomalies } from "../api/datasets";
import type { DatasetAnomaliesResponse } from "../types/dataset";
import {
  chartHeightForBreakpoint,
  useBreakpoint,
  yAxisWidthForBreakpoint,
} from "../lib/useBreakpoint";
import {
  AnalyticsDashboardSection,
  DashboardEmptyState,
  DashboardLoadingState,
} from "./AnalyticsDashboardSection";

type AnomalyDetectionSectionProps = {
  datasetId: string;
  disabled?: boolean;
};

type AnomalyChartPoint = {
  dateLabel: string;
  sortKey: number;
  value: number;
  is_anomaly: boolean;
};

function formatDisplayDate(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTableDate(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatMetricValue(value: number): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

function buildChartPoints(
  points: { date: string; value: number; is_anomaly: boolean }[]
): AnomalyChartPoint[] {
  return points
    .map((row) => {
      const sortKey = new Date(row.date).getTime();
      if (!Number.isFinite(sortKey) || !Number.isFinite(row.value)) {
        return null;
      }

      return {
        sortKey,
        dateLabel: formatDisplayDate(row.date),
        value: row.value,
        is_anomaly: row.is_anomaly,
      };
    })
    .filter((row): row is AnomalyChartPoint => row !== null)
    .sort((a, b) => a.sortKey - b.sortKey);
}

function MetricDot(props: DotProps & { payload?: AnomalyChartPoint }) {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined) {
    return null;
  }

  const isAnomaly = payload?.is_anomaly === true;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={isAnomaly ? 5 : 3}
      fill={isAnomaly ? "#dc2626" : "#2563eb"}
      stroke={isAnomaly ? "#991b1b" : "#2563eb"}
      strokeWidth={isAnomaly ? 2 : 0}
    />
  );
}

export function AnomalyDetectionSection({
  datasetId,
  disabled = false,
}: AnomalyDetectionSectionProps) {
  const breakpoint = useBreakpoint();
  const chartHeight = chartHeightForBreakpoint(breakpoint);
  const yAxisWidth = yAxisWidthForBreakpoint(breakpoint);
  const tickFontSize = breakpoint === "mobile" ? 10 : 11;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DatasetAnomaliesResponse | null>(null);

  useEffect(() => {
    setLoading(false);
    setError(null);
    setResult(null);
  }, [datasetId]);

  const chartData = useMemo(() => {
    if (!result) {
      return [];
    }

    return buildChartPoints(result.points);
  }, [result]);

  const anomalousRows = useMemo(() => {
    if (!result) {
      return [];
    }

    return result.points.filter((row) => row.is_anomaly);
  }, [result]);

  async function handleDetectAnomalies() {
    if (loading || disabled) {
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetchDatasetAnomalies(datasetId);
      setResult(response);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to detect anomalies"
      );
    } finally {
      setLoading(false);
    }
  }

  const hasResult = result !== null;

  return (
    <AnalyticsDashboardSection
      id="anomaly-detection-heading"
      title="Anomaly Detection"
    >
      <p className="muted anomaly-detection-hint">
        Spots days that look off compared to the rest of your main metric.
      </p>

      <button
        type="button"
        onClick={() => void handleDetectAnomalies()}
        disabled={loading || disabled}
      >
        {loading ? "Running…" : "Find outliers"}
      </button>

      {loading ? (
        <DashboardLoadingState message="Scanning your data…" />
      ) : null}

      {error ? (
        <p className="error-banner anomaly-detection-error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && !hasResult ? (
        <DashboardEmptyState message="Nothing flagged yet — run it above." />
      ) : null}

      {hasResult ? (
        <div className="anomaly-detection-results">
          <div className="summary-cards-grid anomaly-detection-summary">
            <article className="summary-card">
              <p className="summary-card-label">Anomalies found</p>
              <p className="summary-card-value">{result.anomaly_count}</p>
            </article>
            <article className="summary-card">
              <p className="summary-card-label">Metric analyzed</p>
              <p className="summary-card-value anomaly-metric-label">
                {result.value_column}
              </p>
            </article>
          </div>

          {chartData.length > 0 ? (
            <div className="chart-container anomaly-detection-chart">
              <ResponsiveContainer width="100%" height={chartHeight}>
                <LineChart
                  data={chartData}
                  margin={{
                    top: 8,
                    right: breakpoint === "mobile" ? 4 : 8,
                    left: 0,
                    bottom: breakpoint === "mobile" ? 8 : 0,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: tickFontSize, fill: "#64748b" }}
                    tickLine={false}
                    minTickGap={breakpoint === "mobile" ? 12 : 24}
                    angle={breakpoint === "mobile" ? -40 : 0}
                    textAnchor={breakpoint === "mobile" ? "end" : "middle"}
                    height={breakpoint === "mobile" ? 64 : 30}
                  />
                  <YAxis
                    tick={{ fontSize: tickFontSize, fill: "#64748b" }}
                    tickLine={false}
                    width={yAxisWidth}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      fontSize: 13,
                    }}
                    formatter={(value, _name, item) => {
                      const numeric =
                        typeof value === "number" ? value : Number(value);
                      const label = Number.isFinite(numeric)
                        ? formatMetricValue(numeric)
                        : "—";
                      const isAnomaly =
                        (item.payload as AnomalyChartPoint | undefined)
                          ?.is_anomaly === true;
                      return isAnomaly ? `${label} (anomaly)` : label;
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name="Metric value"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    dot={<MetricDot />}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              <p className="muted anomaly-chart-legend-hint">
                Blue points are normal values; red points are detected anomalies.
              </p>
            </div>
          ) : null}

          <h3 className="anomaly-detection-table-title">Anomalous values</h3>
          {anomalousRows.length === 0 ? (
            <DashboardEmptyState
              message="No anomalies detected in this dataset."
            />
          ) : (
            <div className="table-scroll">
              <table className="data-table anomaly-detection-table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalousRows.map((row) => (
                    <tr key={row.date}>
                      <td>{formatTableDate(row.date)}</td>
                      <td>{formatMetricValue(row.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </AnalyticsDashboardSection>
  );
}
