import { AppError } from "../lib/errors.js";
import type {
  AiQueryResult,
  AnalyticsDatasetResult,
  DatasetAnomaliesResult,
  ForecastPredictResult,
} from "./analytics.service.js";
import {
  fetchDatasetAnalytics,
  fetchDatasetAnomalies,
  postAiQuery,
  postForecastPredict,
} from "./analytics.service.js";
import type { DocumentChunkSearchHit } from "./document.service.js";
import { searchDocumentChunks } from "./document.service.js";
import type { BusinessAnalysisDataUsed } from "./business-analysis.service.js";
import { chatCompletion } from "./openrouter.service.js";

const DOCUMENT_SIMILARITY_MIN = 0.25;
const FORECAST_DAYS_DEFAULT = 14;
const SQL_RESULT_ROW_CAP = 25;
const RAG_REPORT_QUERY =
  "company business context policies goals KPIs strategy operations";

const REPORT_SQL_QUESTIONS = [
  "What are the key metrics and aggregate totals for this dataset?",
  "What trends or patterns appear over time in this dataset?",
] as const;

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

export type BusinessReportDataUsed = {
  analytics: {
    dataset_id: string;
    original_row_count: number;
    cleaned_row_count: number;
    columns: string[];
    detected_data_types: Record<string, string>;
    statistics: Record<string, unknown>;
  };
  sqlQueries: BusinessAnalysisDataUsed["sql"][];
  ragSources: DocumentChunkSearchHit[];
  anomalies: DatasetAnomaliesResult | null;
  forecast: ForecastPredictResult | null;
};

export type BusinessReportResult = {
  datasetId: string;
  sections: BusinessReportSection[];
  dataUsed: BusinessReportDataUsed;
};

const SECTION_TITLE_TO_ID: Record<string, BusinessReportSectionId> = {
  "Executive Summary": "executiveSummary",
  "Key Metrics": "keyMetrics",
  "Important Trends": "importantTrends",
  Anomalies: "anomalies",
  Forecast: "forecast",
  "Relevant Documents": "relevantDocuments",
};

function truncateSqlRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.slice(0, SQL_RESULT_ROW_CAP);
}

function mapSqlDataUsed(sqlQuery: AiQueryResult): BusinessAnalysisDataUsed["sql"] {
  return {
    question: sqlQuery.question,
    sql: sqlQuery.sql,
    answer: sqlQuery.answer,
    result: truncateSqlRows(sqlQuery.result),
    totalRowCount: sqlQuery.result.length,
  };
}

function rethrowIfServiceUnavailable(error: unknown): void {
  if (error instanceof AppError && error.statusCode === 502) {
    throw error;
  }
}

function formatDocumentExcerpts(sources: DocumentChunkSearchHit[]): string {
  if (sources.length === 0) {
    return "(No document excerpts were retrieved.)";
  }

  return sources
    .map(
      (source, index) =>
        `[${index + 1}] "${source.documentTitle}" (similarity: ${source.similarity.toFixed(4)})\n${source.content}`
    )
    .join("\n\n");
}

function formatAnomalies(anomalies: DatasetAnomaliesResult): string {
  const flagged = anomalies.points.filter((point) => point.is_anomaly).slice(0, 20);
  const sample =
    flagged.length === 0
      ? "(No anomaly points in the returned series.)"
      : flagged.map((point) => `${point.date}: value=${point.value}`).join("\n");

  return `Anomaly count: ${anomalies.anomaly_count}
Date column: ${anomalies.date_column}
Value column: ${anomalies.value_column}
Sample anomaly points:
${sample}`;
}

function formatForecast(forecast: ForecastPredictResult): string {
  return forecast.predictions
    .map((point) => `${point.date}: ${point.value}`)
    .join("\n");
}

function formatAnalyticsSnapshot(analytics: AnalyticsDatasetResult): string {
  return `Dataset id: ${analytics.dataset_id}
Original rows: ${analytics.original_row_count}
Cleaned rows: ${analytics.cleaned_row_count}
Columns: ${analytics.columns.join(", ")}
Detected types: ${JSON.stringify(analytics.detected_data_types)}
Statistics: ${JSON.stringify(analytics.statistics)}`;
}

function formatSqlBlocks(sqlQueries: AiQueryResult[]): string {
  return sqlQueries
    .map((query, index) => {
      const rows = truncateSqlRows(query.result);
      return `Query ${index + 1}:
Question: ${query.question}
SQL: ${query.sql}
Row count: ${query.result.length}
Rows (truncated): ${JSON.stringify(rows)}
Pipeline answer: ${query.answer}`;
    })
    .join("\n\n");
}

function buildBusinessReportPrompt(input: {
  analytics: AnalyticsDatasetResult;
  sqlQueries: AiQueryResult[];
  documentExcerpts: DocumentChunkSearchHit[];
  anomalies: DatasetAnomaliesResult | null;
  forecast: ForecastPredictResult | null;
}): string {
  const anomalyBlock =
    input.anomalies === null
      ? "(Anomaly detection was not available for this dataset.)"
      : formatAnomalies(input.anomalies);

  const forecastBlock =
    input.forecast === null
      ? "(Forecast was not available for this dataset.)"
      : formatForecast(input.forecast);

  const context = [
    `Dataset overview:\n${formatAnalyticsSnapshot(input.analytics)}`,
    `SQL insights:\n${formatSqlBlocks(input.sqlQueries)}`,
    `Document excerpts:\n${formatDocumentExcerpts(input.documentExcerpts)}`,
    `Anomaly data:\n${anomalyBlock}`,
    `Forecast data:\n${forecastBlock}`,
  ].join("\n\n---\n\n");

  return `You are an AI business analyst writing an automated business report.

Use ONLY the data in the context below. Do not invent numbers or facts.

Write the report with EXACTLY these markdown section headings (in this order), each starting with "## ":

## Executive Summary
## Key Metrics
## Important Trends
## Anomalies
## Forecast
## Relevant Documents

Rules:
- Under each heading, write clear prose for a business reader (a short paragraph or bullet list where appropriate).
- If a section has no supporting data, state briefly that it is not available or not applicable — do not skip the heading.
- Plain text under headings (bullets with "-" are allowed).
- Do not add extra top-level sections.

Context:
${context}`;
}

export function parseBusinessReportSections(markdown: string): BusinessReportSection[] {
  const chunks = markdown
    .split(/^## /m)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);

  const sections: BusinessReportSection[] = [];

  for (const chunk of chunks) {
    const newlineIndex = chunk.indexOf("\n");
    const title =
      newlineIndex === -1 ? chunk.trim() : chunk.slice(0, newlineIndex).trim();
    const body =
      newlineIndex === -1 ? "" : chunk.slice(newlineIndex + 1).trim();
    const id = SECTION_TITLE_TO_ID[title];

    if (id !== undefined) {
      sections.push({ id, title, body });
    }
  }

  if (sections.length === 0) {
    return [
      {
        id: "executiveSummary",
        title: "Executive Summary",
        body: markdown.trim(),
      },
    ];
  }

  return sections;
}

async function loadReportAnomalies(
  datasetId: string
): Promise<DatasetAnomaliesResult | null> {
  try {
    return await fetchDatasetAnomalies(datasetId);
  } catch (error) {
    rethrowIfServiceUnavailable(error);
    return null;
  }
}

async function loadReportForecast(
  datasetId: string
): Promise<ForecastPredictResult | null> {
  try {
    return await postForecastPredict(datasetId, FORECAST_DAYS_DEFAULT);
  } catch (error) {
    rethrowIfServiceUnavailable(error);
    return null;
  }
}

async function loadReportDocumentExcerpts(
  companyId: string
): Promise<DocumentChunkSearchHit[]> {
  const hits = await searchDocumentChunks(companyId, RAG_REPORT_QUERY);
  return hits.filter((hit) => hit.similarity >= DOCUMENT_SIMILARITY_MIN);
}

export async function runBusinessReport(
  companyId: string,
  datasetId: string
): Promise<BusinessReportResult> {
  const analytics = await fetchDatasetAnalytics(datasetId);

  const sqlQueries = await Promise.all(
    REPORT_SQL_QUESTIONS.map((question) =>
      postAiQuery(datasetId, companyId, question)
    )
  );

  const [documentExcerpts, anomalies, forecast] = await Promise.all([
    loadReportDocumentExcerpts(companyId),
    loadReportAnomalies(datasetId),
    loadReportForecast(datasetId),
  ]);

  const prompt = buildBusinessReportPrompt({
    analytics,
    sqlQueries,
    documentExcerpts,
    anomalies,
    forecast,
  });

  const reportMarkdown = await chatCompletion(prompt);
  const sections = parseBusinessReportSections(reportMarkdown);

  return {
    datasetId,
    sections,
    dataUsed: {
      analytics: {
        dataset_id: analytics.dataset_id,
        original_row_count: analytics.original_row_count,
        cleaned_row_count: analytics.cleaned_row_count,
        columns: analytics.columns,
        detected_data_types: analytics.detected_data_types,
        statistics: analytics.statistics,
      },
      sqlQueries: sqlQueries.map(mapSqlDataUsed),
      ragSources: documentExcerpts,
      anomalies,
      forecast,
    },
  };
}
