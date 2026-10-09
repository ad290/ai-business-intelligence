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
import { ApiError } from "../api/client";
import {
  postDatasetForecast,
  prepareDatasetForecast,
} from "../api/datasets";
import type { ForecastPredictResponse } from "../types/dataset";
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

const FORECAST_DAYS = 30;

type RevenueForecastSectionProps = {
  datasetId: string;
  disabled?: boolean;
};

type ForecastChartPoint = {
  dateLabel: string;
  sortKey: number;
  historical: number | null;
  forecast: number | null;
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

function formatCurrency(value: number): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

function buildChartPoints(
  historical: { date: string; value: number }[],
  predictions: { date: string; value: number }[]
): ForecastChartPoint[] {
  const points: ForecastChartPoint[] = [];

  for (const row of historical) {
    const sortKey = new Date(row.date).getTime();
    if (!Number.isFinite(sortKey)) {
      continue;
    }

    points.push({
      sortKey,
      dateLabel: formatDisplayDate(row.date),
      historical: row.value,
      forecast: null,
    });
  }

  for (const row of predictions) {
    const sortKey = new Date(row.date).getTime();
    if (!Number.isFinite(sortKey)) {
      continue;
    }

    points.push({
      sortKey,
      dateLabel: formatDisplayDate(row.date),
      historical: null,
      forecast: row.value,
    });
  }

  return points.sort((a, b) => a.sortKey - b.sortKey);
}

export function RevenueForecastSection({
  datasetId,
  disabled = false,
}: RevenueForecastSectionProps) {
  const breakpoint = useBreakpoint();
  const chartHeight = chartHeightForBreakpoint(breakpoint);
  const yAxisWidth = yAxisWidthForBreakpoint(breakpoint);
  const tickFontSize = breakpoint === "mobile" ? 10 : 11;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historical, setHistorical] = useState<
    { date: string; value: number }[]
  >([]);
  const [forecast, setForecast] = useState<ForecastPredictResponse | null>(
    null
  );

  useEffect(() => {
    setLoading(false);
    setError(null);
    setHistorical([]);
    setForecast(null);
  }, [datasetId]);

  const chartData = useMemo(() => {
    if (!forecast) {
      return [];
    }

    return buildChartPoints(historical, forecast.predictions);
  }, [forecast, historical]);

  async function handleGenerateForecast() {
    if (loading || disabled) {
      return;
    }

    setLoading(true);
    setError(null);
    setForecast(null);
    setHistorical([]);

    try {
      const prepared = await prepareDatasetForecast(datasetId);
      const normalizedHistorical = prepared.features
        .map((row) => ({
          date: String(row.date),
          value: Number(row.value),
        }))
        .filter((row) => Number.isFinite(row.value));

      const result = await postDatasetForecast(datasetId, FORECAST_DAYS);
      setHistorical(normalizedHistorical);
      setForecast(result);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to generate revenue forecast"
      );
    } finally {
      setLoading(false);
    }
  }

  const hasForecast = forecast !== null && forecast.predictions.length > 0;

  return (
    <AnalyticsDashboardSection
      id="revenue-forecast-heading"
      title="Revenue Forecast"
    >
      <p className="muted revenue-forecast-hint">
        Projects the next {FORECAST_DAYS} days from your main metric. First run
        trains the model.
      </p>

      <button
        type="button"
        onClick={() => void handleGenerateForecast()}
        disabled={loading || disabled}
      >
        {loading ? "Running…" : `Run ${FORECAST_DAYS}-day forecast`}
      </button>

      {loading ? (
        <DashboardLoadingState message="Building your forecast…" />
      ) : null}

      {error ? (
        <p className="error-banner revenue-forecast-error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && !hasForecast ? (
        <DashboardEmptyState message="No forecast yet — use the button above." />
      ) : null}

      {hasForecast ? (
        <div className="revenue-forecast-results">
          <div className="chart-container revenue-forecast-chart">
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
                  formatter={(value) => {
                    if (value === null || value === undefined || value === "") {
                      return "—";
                    }

                    const numeric =
                      typeof value === "number" ? value : Number(value);
                    if (!Number.isFinite(numeric)) {
                      return "—";
                    }

                    return formatCurrency(numeric);
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="historical"
                  name="Historical"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  name="Forecast"
                  stroke="#ea580c"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={{ r: 3, fill: "#ea580c" }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <h3 className="revenue-forecast-table-title">Forecasted values</h3>
          <div className="table-scroll">
            <table className="data-table revenue-forecast-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Predicted value</th>
                </tr>
              </thead>
              <tbody>
                {forecast.predictions.map((row) => (
                  <tr key={row.date}>
                    <td>{formatTableDate(row.date)}</td>
                    <td>{formatCurrency(row.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </AnalyticsDashboardSection>
  );
}
