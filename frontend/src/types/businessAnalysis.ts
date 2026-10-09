import type {
  AnomalyPoint,
  DatasetAnomaliesResponse,
  ForecastPredictResponse,
} from "./dataset";

export type BusinessAnalysisRagSource = {
  documentTitle: string;
  content: string;
  similarity: number;
};

export type BusinessAnalysisSqlData = {
  question: string;
  sql: string;
  answer: string;
  result: Record<string, unknown>[];
  totalRowCount: number;
};

export type BusinessAnalysisAnomaliesData = Omit<
  DatasetAnomaliesResponse,
  "success"
>;

export type BusinessAnalysisForecastData = Omit<
  ForecastPredictResponse,
  "success"
>;

export type BusinessAnalysisResponse = {
  datasetId: string;
  question: string;
  analysis: string;
  dataUsed: {
    sql: BusinessAnalysisSqlData;
    ragSources: BusinessAnalysisRagSource[];
    anomalies: BusinessAnalysisAnomaliesData | null;
    forecast: BusinessAnalysisForecastData | null;
  };
};

export type BusinessReportSectionId =
  | "executiveSummary"
  | "keyMetrics"
  | "importantTrends"
  | "anomalies"
  | "forecast"
  | "relevantDocuments";

export type BusinessReportSection = {
  id: BusinessReportSectionId;
  title: string;
  body: string;
};

export type BusinessReportAnalyticsSnapshot = {
  dataset_id: string;
  original_row_count: number;
  cleaned_row_count: number;
  columns: string[];
  detected_data_types: Record<string, string>;
  statistics: Record<string, unknown>;
};

export type BusinessReportResponse = {
  datasetId: string;
  sections: BusinessReportSection[];
  dataUsed: {
    analytics: BusinessReportAnalyticsSnapshot;
    sqlQueries: BusinessAnalysisSqlData[];
    ragSources: BusinessAnalysisRagSource[];
    anomalies: BusinessAnalysisAnomaliesData | null;
    forecast: BusinessAnalysisForecastData | null;
  };
};

export type { AnomalyPoint };
