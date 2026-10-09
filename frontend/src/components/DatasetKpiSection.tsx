import { useMemo } from "react";
import { getNumericColumnNames } from "./DatasetNumericChart";
import {
  computeNumericKpis,
  formatColumnTitle,
  formatKpiValue,
  type NumericKpis,
} from "../lib/numericKpis";
import type { DatasetAnalyticsResponse } from "../types/dataset";

type DatasetKpiSectionProps = {
  analytics: DatasetAnalyticsResponse;
  selectedColumn: string;
  onColumnChange: (columnName: string) => void;
  useRowBasedKpis?: boolean;
  rowBasedKpis?: NumericKpis | null;
};

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="summary-card">
      <p className="summary-card-label">{label}</p>
      <p className="summary-card-value">{value}</p>
    </article>
  );
}

export function DatasetKpiSection({
  analytics,
  selectedColumn,
  onColumnChange,
  useRowBasedKpis = false,
  rowBasedKpis,
}: DatasetKpiSectionProps) {
  const numericColumnNames = useMemo(
    () => getNumericColumnNames(analytics),
    [analytics]
  );

  const kpis = useMemo(() => {
    if (!selectedColumn) {
      return null;
    }

    if (useRowBasedKpis) {
      return rowBasedKpis;
    }

    return computeNumericKpis(analytics, selectedColumn);
  }, [analytics, rowBasedKpis, selectedColumn, useRowBasedKpis]);

  const columnTitle = formatColumnTitle(selectedColumn);

  if (numericColumnNames.length === 0) {
    return (
      <p className="muted">No numeric columns available for KPIs.</p>
    );
  }

  return (
    <>
      <label className="dataset-select-label">
        <span>KPI column</span>
        <select
          className="dataset-select"
          value={selectedColumn}
          onChange={(event) => onColumnChange(event.target.value)}
        >
          {numericColumnNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>

      {kpis ? (
        <div className="summary-cards-grid kpi-cards-grid">
          <KpiCard
            label={`Total ${columnTitle}`}
            value={formatKpiValue(kpis.sum)}
          />
          <KpiCard
            label={`Average ${columnTitle}`}
            value={formatKpiValue(kpis.average)}
          />
          <KpiCard
            label={`Minimum ${columnTitle}`}
            value={formatKpiValue(kpis.minimum)}
          />
          <KpiCard
            label={`Maximum ${columnTitle}`}
            value={formatKpiValue(kpis.maximum)}
          />
        </div>
      ) : (
        <p className="muted">KPIs are not available for this column.</p>
      )}
    </>
  );
}
