export type ColumnDataType = "string" | "number" | "boolean" | "date";

export type SchemaColumn = {
  name: string;
  type: ColumnDataType;
};

export type DatasetSummary = {
  id: string;
  name: string;
  originalFileName: string;
  fileType: "csv" | "json";
  rowCount: number;
  schema: SchemaColumn[];
  createdAt: string;
  updatedAt: string;
};

export type UploadDatasetResponse = {
  success: true;
  id: string;
  name: string;
  fileType: "csv" | "json";
  rowCount: number;
  schema: SchemaColumn[];
  preview: Record<string, unknown>[];
};

export type ListDatasetsResponse = {
  success: true;
  datasets: DatasetSummary[];
};

export type DatasetPreviewResponse = {
  success: true;
  id: string;
  rowCount: number;
  rows: Record<string, unknown>[];
};

export type DatasetProcessingStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export type DatasetProcessingStatusResponse = {
  success: true;
  id: string;
  processingStatus: DatasetProcessingStatus;
  processedRowCount: number | null;
  processedAt: string | null;
};

export type DatasetAnalyticsResponse = {
  success: true;
  dataset_id: string;
  original_row_count: number;
  cleaned_row_count: number;
  columns: string[];
  detected_data_types: Record<string, string>;
  statistics: Record<string, unknown>;
  head: Record<string, unknown>[];
  rows?: Record<string, unknown>[];
};

export type DatasetAiQueryResponse = {
  success: true;
  datasetId: string;
  question: string;
  sql: string;
  result: Record<string, unknown>[];
  answer: string;
};

export type ForecastPrepareResponse = {
  success: true;
  dataset_id: string;
  date_column: string;
  value_column: string;
  aggregated_row_count: number;
  features: { date: string; value: number }[];
};

export type ForecastPredictResponse = {
  success: true;
  dataset_id: string;
  days: number;
  predictions: { date: string; value: number }[];
};

export type AnomalyPoint = {
  date: string;
  value: number;
  is_anomaly: boolean;
};

export type DatasetAnomaliesResponse = {
  success: true;
  dataset_id: string;
  date_column: string;
  value_column: string;
  row_count: number;
  anomaly_count: number;
  points: AnomalyPoint[];
};

export type UploadSuccessDetails = UploadDatasetResponse & {
  originalFileName: string;
};
