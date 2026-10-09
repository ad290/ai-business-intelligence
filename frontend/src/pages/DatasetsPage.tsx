import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError } from "../api/client";
import {
  deleteDataset,
  fetchDatasetPreview,
  listDatasets,
  uploadDataset,
} from "../api/datasets";
import { AppPageHeader } from "../components/AppPageHeader";
import {
  DashboardEmptyState,
  DashboardLoadingState,
} from "../components/AnalyticsDashboardSection";
import type {
  DatasetPreviewResponse,
  DatasetSummary,
  SchemaColumn,
  UploadSuccessDetails,
} from "../types/dataset";

function formatCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function DataPreviewTable({
  columns,
  rows,
}: {
  columns: SchemaColumn[];
  rows: Record<string, unknown>[];
}) {
  const columnNames =
    columns.length > 0
      ? columns.map((column) => column.name)
      : rows.length > 0
        ? Object.keys(rows[0] ?? {})
        : [];

  if (columnNames.length === 0 || rows.length === 0) {
    return <DashboardEmptyState message="No preview rows available." />;
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {columnNames.map((name) => (
              <th key={name}>{name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columnNames.map((name) => (
                <td key={name}>{formatCell(row[name])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DatasetsPage() {
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [datasetName, setDatasetName] = useState("");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastUpload, setLastUpload] = useState<UploadSuccessDetails | null>(
    null
  );

  const [preview, setPreview] = useState<DatasetPreviewResponse | null>(null);
  const [previewSchema, setPreviewSchema] = useState<SchemaColumn[]>([]);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError(null);

    if (!selectedFile) {
      setUploadError("Choose a .csv or .json file to upload.");
      return;
    }

    const extension = selectedFile.name.split(".").pop()?.toLowerCase();
    if (extension !== "csv" && extension !== "json") {
      setUploadError("Only .csv and .json files are supported.");
      return;
    }

    setUploadLoading(true);

    try {
      const result = await uploadDataset(selectedFile, datasetName);
      setLastUpload({
        ...result,
        originalFileName: selectedFile.name,
      });
      setSelectedFile(null);
      setDatasetName("");
      await loadDatasets();
    } catch (error) {
      setUploadError(
        error instanceof ApiError ? error.message : "Upload failed"
      );
    } finally {
      setUploadLoading(false);
    }
  }

  async function handleViewPreview(dataset: DatasetSummary) {
    setPreviewLoadingId(dataset.id);
    setPreviewError(null);

    try {
      const response = await fetchDatasetPreview(dataset.id);
      setPreview(response);
      setPreviewSchema(dataset.schema);
    } catch (error) {
      setPreview(null);
      setPreviewError(
        error instanceof ApiError ? error.message : "Failed to load preview"
      );
    } finally {
      setPreviewLoadingId(null);
    }
  }

  async function handleDelete(dataset: DatasetSummary) {
    const confirmed = window.confirm(
      `Delete "${dataset.name}"? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(dataset.id);
    setPreviewError(null);

    try {
      await deleteDataset(dataset.id);
      if (preview?.id === dataset.id) {
        setPreview(null);
        setPreviewSchema([]);
      }
      await loadDatasets();
    } catch (error) {
      setListError(
        error instanceof ApiError ? error.message : "Failed to delete dataset"
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="datasets-page app-page">
      <AppPageHeader
        title="Datasets"
        subtitle="Upload CSV or JSON files for your company workspace."
      />

      <section className="page-card datasets-upload-card">
        <h2 className="app-section-title">Upload dataset</h2>
        <p className="muted datasets-upload-hint">
          Choose a file and optionally set a display name before uploading.
        </p>

        <form className="upload-form" onSubmit={(event) => void handleUpload(event)}>
          <label>
            Dataset name (optional)
            <input
              type="text"
              value={datasetName}
              onChange={(event) => setDatasetName(event.target.value)}
              placeholder="Defaults to the file name"
              disabled={uploadLoading}
            />
          </label>

          <label>
            File (.csv or .json)
            <input
              type="file"
              accept=".csv,.json,text/csv,application/json"
              onChange={(event) =>
                setSelectedFile(event.target.files?.[0] ?? null)
              }
              disabled={uploadLoading}
            />
          </label>

          {uploadError ? (
            <p className="error-banner" role="alert">
              {uploadError}
            </p>
          ) : null}

          <button type="submit" disabled={uploadLoading}>
            {uploadLoading ? "Uploading…" : "Upload dataset"}
          </button>
        </form>

        {lastUpload ? (
          <div className="result-panel">
            <h3 className="app-section-title app-section-title--sm">Latest upload</h3>
            <ul className="meta-list">
              <li>
                <strong>Name:</strong> {lastUpload.name}
              </li>
              <li>
                <strong>Filename:</strong> {lastUpload.originalFileName}
              </li>
              <li>
                <strong>Type:</strong> {lastUpload.fileType.toUpperCase()}
              </li>
              <li>
                <strong>Rows:</strong> {lastUpload.rowCount}
              </li>
            </ul>
            <h4 className="result-subheading">Detected schema</h4>
            <ul className="schema-list">
              {lastUpload.schema.map((column) => (
                <li key={column.name}>
                  {column.name} · <code>{column.type}</code>
                </li>
              ))}
            </ul>
            <h4 className="result-subheading">Preview</h4>
            <DataPreviewTable
              columns={lastUpload.schema}
              rows={lastUpload.preview}
            />
          </div>
        ) : null}
      </section>

      <section className="page-card">
        <div className="section-header">
          <h2 className="app-section-title app-section-title--inline">Your datasets</h2>
          <button
            type="button"
            className="button-secondary"
            onClick={() => void loadDatasets()}
            disabled={listLoading}
          >
            Refresh
          </button>
        </div>

        {listLoading ? (
          <DashboardLoadingState message="Loading datasets…" />
        ) : null}
        {listError ? (
          <p className="error-banner" role="alert">
            {listError}
          </p>
        ) : null}

        {!listLoading && !listError && datasets.length === 0 ? (
          <DashboardEmptyState message="No datasets yet. Upload your first file above." />
        ) : null}

        {!listLoading && datasets.length > 0 ? (
          <ul className="dataset-list">
            {datasets.map((dataset) => (
              <li key={dataset.id} className="dataset-item">
                <div className="dataset-item-body">
                  <strong className="dataset-item-name">{dataset.name}</strong>
                  <p className="muted dataset-meta">
                    {dataset.originalFileName} · {dataset.fileType.toUpperCase()}{" "}
                    · {dataset.rowCount} rows
                  </p>
                </div>
                <div className="dataset-actions">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => void handleViewPreview(dataset)}
                    disabled={
                      previewLoadingId === dataset.id || deletingId === dataset.id
                    }
                  >
                    {previewLoadingId === dataset.id
                      ? "Loading…"
                      : "View preview"}
                  </button>
                  <button
                    type="button"
                    className="button-danger"
                    onClick={() => void handleDelete(dataset)}
                    disabled={
                      deletingId === dataset.id || previewLoadingId === dataset.id
                    }
                  >
                    {deletingId === dataset.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {previewError ? (
          <p className="error-banner" role="alert">
            {previewError}
          </p>
        ) : null}

        {preview ? (
          <div className="result-panel">
            <h3 className="app-section-title app-section-title--sm">Dataset preview</h3>
            <p className="muted">
              Showing up to 50 rows ({preview.rowCount} total).
            </p>
            <DataPreviewTable columns={previewSchema} rows={preview.rows} />
          </div>
        ) : null}
      </section>
    </div>
  );
}
