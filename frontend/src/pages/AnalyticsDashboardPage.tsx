import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { listDatasets, processDataset } from "../api/datasets";
import {
  AnalyticsDashboardSection,
  DashboardEmptyState,
  DashboardLoadingState,
} from "../components/AnalyticsDashboardSection";
import { DatasetKpiSection } from "../components/DatasetKpiSection";
import { AnomalyDetectionSection } from "../components/AnomalyDetectionSection";
import { RevenueForecastSection } from "../components/RevenueForecastSection";
import { InsightsHubSection } from "../components/InsightsHubSection";
import {
  DatasetNumericChart,
  getNumericColumnNames,
  type ChartType,
} from "../components/DatasetNumericChart";
import {
  filterRowsByDateRange,
  getAnalyticsRows,
  getDateColumnNames,
} from "../lib/dateFilter";
import { computeNumericKpisFromRows } from "../lib/numericKpis";
import type { DatasetAnalyticsResponse, DatasetSummary } from "../types/dataset";

function countNumericColumns(
  detectedTypes: Record<string, string> | undefined
): number {
  if (!detectedTypes) {
    return 0;
  }

  return Object.values(detectedTypes).filter((type) => type === "number").length;
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="summary-card">
      <p className="summary-card-label">{label}</p>
      <p className="summary-card-value">{value}</p>
    </article>
  );
}

export function AnalyticsDashboardPage() {
  const [searchParams] = useSearchParams();
  const datasetFromUrl = searchParams.get("dataset") ?? "";

  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");

  const [analytics, setAnalytics] = useState<DatasetAnalyticsResponse | null>(
    null
  );
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const [selectedNumericColumn, setSelectedNumericColumn] = useState("");
  const [selectedKpiColumn, setSelectedKpiColumn] = useState("");
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId);

  const numericColumnNames = useMemo(
    () => getNumericColumnNames(analytics),
    [analytics]
  );

  const dateColumnNames = useMemo(
    () => getDateColumnNames(analytics),
    [analytics]
  );

  const dateColumn = dateColumnNames[0] ?? "";

  const displayRows = useMemo(() => {
    if (!analytics) {
      return [];
    }

    const rows = getAnalyticsRows(analytics);
    if (!dateColumn) {
      return rows;
    }

    return filterRowsByDateRange(rows, dateColumn, startDate, endDate);
  }, [analytics, dateColumn, endDate, startDate]);

  const hasDateFilterApplied = Boolean(startDate || endDate);
  const isFilteredRangeEmpty =
    Boolean(dateColumn) && hasDateFilterApplied && displayRows.length === 0;

  const loadDatasets = useCallback(async () => {
    setListLoading(true);
    setListError(null);

    try {
      const response = await listDatasets();
      setDatasets(response.datasets);
    } catch (error) {
      setListError(
        error instanceof ApiError ? error.message : "Failed to load datasets"
      );
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDatasets();
  }, [loadDatasets]);

  useEffect(() => {
    if (datasets.length === 0) {
      return;
    }

    if (datasetFromUrl && datasets.some((dataset) => dataset.id === datasetFromUrl)) {
      setSelectedDatasetId(datasetFromUrl);
      return;
    }

    setSelectedDatasetId((current) => {
      if (current && datasets.some((dataset) => dataset.id === current)) {
        return current;
      }
      return datasets[0].id;
    });
  }, [datasets, datasetFromUrl]);

  useEffect(() => {
    if (!selectedDatasetId) {
      setAnalytics(null);
      setAnalyticsError(null);
      setAnalyticsLoading(false);
      setStartDate("");
      setEndDate("");
      return;
    }

    setStartDate("");
    setEndDate("");

    let cancelled = false;
    const abortController = new AbortController();

    async function loadAnalytics() {
      setAnalyticsLoading(true);
      setAnalyticsError(null);
      setAnalytics(null);

      try {
        const response = await processDataset(selectedDatasetId, {
          signal: abortController.signal,
        });
        if (!cancelled) {
          setAnalytics(response);
        }
      } catch (error) {
        if (!cancelled && !(error instanceof DOMException && error.name === "AbortError")) {
          setAnalyticsError(
            error instanceof ApiError
              ? error.message
              : "Failed to load analytics"
          );
        }
      } finally {
        if (!cancelled) {
          setAnalyticsLoading(false);
        }
      }
    }

    void loadAnalytics();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [selectedDatasetId]);

  useEffect(() => {
    if (numericColumnNames.length === 0) {
      setSelectedNumericColumn("");
      setSelectedKpiColumn("");
      return;
    }

    if (!numericColumnNames.includes(selectedNumericColumn)) {
      setSelectedNumericColumn(numericColumnNames[0]);
    }

    if (!numericColumnNames.includes(selectedKpiColumn)) {
      setSelectedKpiColumn(numericColumnNames[0]);
    }
  }, [numericColumnNames, selectedNumericColumn, selectedKpiColumn]);

  const summary = useMemo(() => {
    if (!selectedDatasetId || !analytics) {
      return null;
    }

    return {
      totalRows: analytics.original_row_count,
      cleanedRows: analytics.cleaned_row_count,
      columnCount: analytics.columns.length,
      numericColumns: countNumericColumns(analytics.detected_data_types),
    };
  }, [analytics, selectedDatasetId]);

  const kpiRowMetrics = useMemo(() => {
    if (!analytics || !dateColumn || !selectedKpiColumn) {
      return null;
    }

    return computeNumericKpisFromRows(displayRows, selectedKpiColumn);
  }, [analytics, dateColumn, displayRows, selectedKpiColumn]);

  const chartRows = dateColumn
    ? displayRows
    : analytics
      ? getAnalyticsRows(analytics)
      : [];

  const analyticsReady =
    Boolean(selectedDatasetId) &&
    !analyticsLoading &&
    !analyticsError &&
    analytics !== null;

  return (
    <div className="analytics-dashboard">
      <header className="analytics-dashboard-header page-card">
        <div className="analytics-header-intro app-page-header-text">
          <h1>Analytics Dashboard</h1>
          <p className="muted analytics-dashboard-subtitle">
            Explore your data, charts, and forecasts. Ask questions in the
            Insights panel.
          </p>
        </div>

        <div className="analytics-header-dataset">
          {listLoading ? (
            <DashboardLoadingState message="Loading datasets…" />
          ) : null}
          {listError ? (
            <p className="error-banner" role="alert">
              {listError}
            </p>
          ) : null}
          {!listLoading && !listError && datasets.length === 0 ? (
            <p className="dashboard-status dashboard-status-empty">
              No datasets yet.{" "}
              <Link to="/datasets">Upload a file on the Datasets page</Link> to
              get started.
            </p>
          ) : null}
          {!listLoading && datasets.length > 0 ? (
            <div className="analytics-dataset-row">
              <label className="dataset-select-label dataset-select-label-wide">
                <span>Selected dataset</span>
                <select
                  className="dataset-select"
                  value={selectedDatasetId}
                  onChange={(event) => setSelectedDatasetId(event.target.value)}
                  disabled={listLoading}
                >
                  <option value="">Select a dataset…</option>
                  {datasets.map((dataset) => (
                    <option key={dataset.id} value={dataset.id}>
                      {dataset.name} ({dataset.rowCount} rows)
                    </option>
                  ))}
                </select>
              </label>
              <Link to="/datasets" className="button-secondary analytics-datasets-link">
                Manage datasets
              </Link>
            </div>
          ) : null}
        </div>
      </header>

      <div className="analytics-workspace">
        <div className="analytics-main">
          {selectedDatasetId && analyticsLoading ? (
            <AnalyticsDashboardSection id="analytics-loading-heading" title="Summary">
              <DashboardLoadingState message="Loading analytics for this dataset…" />
            </AnalyticsDashboardSection>
          ) : null}

          {selectedDatasetId && analyticsError ? (
            <div className="page-card analytics-error-panel" role="alert">
              <p className="error-banner analytics-error-banner">
                {analyticsError}
              </p>
              <p className="muted">
                Check that the analytics service is running, then select the dataset
                again.
              </p>
            </div>
          ) : null}

          {analyticsReady && summary ? (
            <AnalyticsDashboardSection id="summary-heading" title="Summary">
              <div className="summary-cards-grid">
                <SummaryCard label="Total Rows" value={summary.totalRows} />
                <SummaryCard label="Cleaned Rows" value={summary.cleanedRows} />
                <SummaryCard
                  label="Number of Columns"
                  value={summary.columnCount}
                />
                <SummaryCard
                  label="Numeric Columns"
                  value={summary.numericColumns}
                />
              </div>
            </AnalyticsDashboardSection>
          ) : null}

          {analyticsReady && analytics && dateColumn ? (
            <AnalyticsDashboardSection id="date-filter-heading" title="Date filter">
              <p className="muted date-filter-hint">
                Filter KPIs and charts using the <strong>{dateColumn}</strong>{" "}
                column.
              </p>
              <div className="chart-controls">
                <label className="dataset-select-label">
                  <span>Start date</span>
                  <input
                    type="date"
                    className="date-input"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </label>
                <label className="dataset-select-label">
                  <span>End date</span>
                  <input
                    type="date"
                    className="date-input"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                </label>
              </div>
              {!hasDateFilterApplied ? (
                <p className="muted dashboard-status-empty">
                  Leave dates empty to include all rows.
                </p>
              ) : null}
            </AnalyticsDashboardSection>
          ) : null}

          {analyticsReady && analytics ? (
            <AnalyticsDashboardSection id="kpi-heading" title="Business KPIs">
              {isFilteredRangeEmpty ? (
                <DashboardEmptyState
                  message="No rows match the selected date range. Adjust the dates above."
                />
              ) : (
                <DatasetKpiSection
                  analytics={analytics}
                  selectedColumn={selectedKpiColumn}
                  onColumnChange={setSelectedKpiColumn}
                  useRowBasedKpis={Boolean(dateColumn)}
                  rowBasedKpis={kpiRowMetrics}
                />
              )}
            </AnalyticsDashboardSection>
          ) : null}

          {analyticsReady && analytics ? (
            <AnalyticsDashboardSection id="chart-heading" title="Chart">
              {numericColumnNames.length === 0 ? (
                <DashboardEmptyState
                  message="No numeric data available for visualization."
                />
              ) : isFilteredRangeEmpty ? (
                <DashboardEmptyState
                  message="No rows match the selected date range. Adjust the dates above."
                />
              ) : (
                <>
                  <div className="chart-controls">
                    <label className="dataset-select-label">
                      <span>Numeric column</span>
                      <select
                        className="dataset-select"
                        value={selectedNumericColumn}
                        onChange={(event) =>
                          setSelectedNumericColumn(event.target.value)
                        }
                      >
                        {numericColumnNames.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="dataset-select-label">
                      <span>Chart type</span>
                      <select
                        className="dataset-select"
                        value={chartType}
                        onChange={(event) =>
                          setChartType(event.target.value as ChartType)
                        }
                      >
                        <option value="bar">Bar</option>
                        <option value="line">Line</option>
                      </select>
                    </label>
                  </div>
                  {selectedNumericColumn ? (
                    <DatasetNumericChart
                      rows={chartRows}
                      columnName={selectedNumericColumn}
                      chartType={chartType}
                    />
                  ) : null}
                </>
              )}
            </AnalyticsDashboardSection>
          ) : null}

          {analyticsReady && selectedDatasetId ? (
            <RevenueForecastSection datasetId={selectedDatasetId} />
          ) : null}

          {analyticsReady && selectedDatasetId ? (
            <AnomalyDetectionSection datasetId={selectedDatasetId} />
          ) : null}

          {!selectedDatasetId && !listLoading && datasets.length > 0 ? (
            <div className="page-card analytics-placeholder">
              <p className="muted dashboard-status-empty">
                Choose a dataset above to load summary metrics, charts, forecast,
                and anomaly tools.
              </p>
            </div>
          ) : null}
        </div>

        <InsightsHubSection
          datasetId={selectedDatasetId}
          analyticsReady={analyticsReady}
          datasetName={selectedDataset?.name}
        />
      </div>
    </div>
  );
}
