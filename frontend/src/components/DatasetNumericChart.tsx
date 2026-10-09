import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  chartHeightForBreakpoint,
  useBreakpoint,
  yAxisWidthForBreakpoint,
} from "../lib/useBreakpoint";
import type { DatasetAnalyticsResponse } from "../types/dataset";

export type ChartType = "bar" | "line";

type ChartPoint = {
  label: string;
  value: number;
};

export function getNumericColumnNames(
  analytics: DatasetAnalyticsResponse | null
): string[] {
  if (!analytics?.detected_data_types) {
    return [];
  }

  return Object.entries(analytics.detected_data_types)
    .filter(([, type]) => type === "number")
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b));
}

function buildChartPoints(
  rows: Record<string, unknown>[],
  columnName: string
): ChartPoint[] {
  return rows
    .map((row, index) => {
      const raw = row[columnName];
      const value =
        typeof raw === "number" ? raw : raw != null ? Number(raw) : NaN;

      if (!Number.isFinite(value)) {
        return null;
      }

      return {
        label: `Row ${index + 1}`,
        value,
      };
    })
    .filter((point): point is ChartPoint => point !== null);
}

type DatasetNumericChartProps = {
  rows: Record<string, unknown>[];
  columnName: string;
  chartType: ChartType;
};

export function DatasetNumericChart({
  rows,
  columnName,
  chartType,
}: DatasetNumericChartProps) {
  const breakpoint = useBreakpoint();
  const chartHeight = chartHeightForBreakpoint(breakpoint);
  const yAxisWidth = yAxisWidthForBreakpoint(breakpoint);
  const tickFontSize = breakpoint === "mobile" ? 10 : 12;

  const chartData = useMemo(
    () => buildChartPoints(rows, columnName),
    [rows, columnName]
  );

  if (chartData.length === 0) {
    return (
      <p className="muted">No plottable values for this column in the preview.</p>
    );
  }

  const commonAxis = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
      <XAxis
        dataKey="label"
        tick={{ fontSize: tickFontSize, fill: "#64748b" }}
        tickLine={false}
        interval={breakpoint === "mobile" ? "preserveStartEnd" : 0}
        angle={breakpoint === "mobile" ? -35 : 0}
        textAnchor={breakpoint === "mobile" ? "end" : "middle"}
        height={breakpoint === "mobile" ? 56 : 30}
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
      />
    </>
  );

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={chartHeight}>
        {chartType === "bar" ? (
          <BarChart
            data={chartData}
            margin={{
              top: 8,
              right: breakpoint === "mobile" ? 4 : 8,
              left: 0,
              bottom: breakpoint === "mobile" ? 24 : 0,
            }}
          >
            {commonAxis}
            <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : (
          <LineChart
            data={chartData}
            margin={{
              top: 8,
              right: breakpoint === "mobile" ? 4 : 8,
              left: 0,
              bottom: breakpoint === "mobile" ? 24 : 0,
            }}
          >
            {commonAxis}
            <Line
              type="monotone"
              dataKey="value"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ r: 4, fill: "#2563eb" }}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
