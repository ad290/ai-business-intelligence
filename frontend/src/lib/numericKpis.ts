import type { DatasetAnalyticsResponse } from "../types/dataset";

type NumericColumnStats = {
  type: "number";
  count: number;
  mean: number | null;
  min: number | null;
  max: number | null;
};

export type NumericKpis = {
  sum: number | null;
  average: number | null;
  minimum: number | null;
  maximum: number | null;
};

export function formatColumnTitle(columnName: string): string {
  return columnName
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function parseNumericStats(
  analytics: DatasetAnalyticsResponse,
  columnName: string
): NumericColumnStats | null {
  const raw = analytics.statistics[columnName];
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const stats = raw as Record<string, unknown>;
  if (stats.type !== "number") {
    return null;
  }

  const count = typeof stats.count === "number" ? stats.count : 0;
  const mean = typeof stats.mean === "number" ? stats.mean : null;
  const min = typeof stats.min === "number" ? stats.min : null;
  const max = typeof stats.max === "number" ? stats.max : null;

  return {
    type: "number",
    count,
    mean,
    min,
    max,
  };
}

export function computeNumericKpisFromRows(
  rows: Record<string, unknown>[],
  columnName: string
): NumericKpis | null {
  const values = rows
    .map((row) => {
      const raw = row[columnName];
      return typeof raw === "number" ? raw : raw != null ? Number(raw) : NaN;
    })
    .filter((value) => Number.isFinite(value));

  if (values.length === 0) {
    return {
      sum: null,
      average: null,
      minimum: null,
      maximum: null,
    };
  }

  const sum = values.reduce((total, value) => total + value, 0);

  return {
    sum,
    average: sum / values.length,
    minimum: Math.min(...values),
    maximum: Math.max(...values),
  };
}

export function computeNumericKpis(
  analytics: DatasetAnalyticsResponse,
  columnName: string
): NumericKpis | null {
  const stats = parseNumericStats(analytics, columnName);
  if (!stats) {
    return null;
  }

  const sum =
    stats.mean !== null && stats.count > 0
      ? stats.mean * stats.count
      : null;

  return {
    sum,
    average: stats.mean,
    minimum: stats.min,
    maximum: stats.max,
  };
}

export function formatKpiValue(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}
