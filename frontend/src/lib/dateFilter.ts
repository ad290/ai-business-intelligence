import type { DatasetAnalyticsResponse } from "../types/dataset";

export function getDateColumnNames(
  analytics: DatasetAnalyticsResponse | null
): string[] {
  if (!analytics?.detected_data_types) {
    return [];
  }

  return Object.entries(analytics.detected_data_types)
    .filter(([, type]) => type === "datetime")
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b));
}

export function getAnalyticsRows(
  analytics: DatasetAnalyticsResponse
): Record<string, unknown>[] {
  if (analytics.rows && analytics.rows.length > 0) {
    return analytics.rows;
  }

  return analytics.head;
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseRowDate(value: unknown): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function filterRowsByDateRange(
  rows: Record<string, unknown>[],
  dateColumn: string,
  startDate: string,
  endDate: string
): Record<string, unknown>[] {
  if (!startDate && !endDate) {
    return rows;
  }

  return rows.filter((row) => {
    const parsed = parseRowDate(row[dateColumn]);
    if (!parsed) {
      return false;
    }

    const day = toLocalDateKey(parsed);
    if (startDate && day < startDate) {
      return false;
    }
    if (endDate && day > endDate) {
      return false;
    }

    return true;
  });
}
