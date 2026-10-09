import { AppError } from "../lib/errors.js";
import type { AiQueryResult, DatasetAnomaliesResult, ForecastPredictResult } from "./analytics.service.js";
import {
  fetchDatasetAnomalies,
  postAiQuery,
  postForecastPredict,
} from "./analytics.service.js";
import { searchDocumentChunks } from "./document.service.js";
import type { DocumentChunkSearchHit } from "./document.service.js";
import { chatCompletion } from "./openrouter.service.js";

const DOCUMENT_SIMILARITY_MIN = 0.25;
const FORECAST_DAYS_DEFAULT = 14;
const SQL_RESULT_ROW_CAP = 25;

export type BusinessAnalysisContext = {
  sqlQuery: AiQueryResult;
  documentExcerpts: DocumentChunkSearchHit[];
  anomalies: DatasetAnomaliesResult | null;
  forecast: ForecastPredictResult | null;
};

export type BusinessAnalysisDataUsed = {
  sql: {
    question: string;
    sql: string;
    answer: string;
    result: Record<string, unknown>[];
    totalRowCount: number;
  };
  ragSources: DocumentChunkSearchHit[];
  anomalies: DatasetAnomaliesResult | null;
  forecast: ForecastPredictResult | null;
};

export type BusinessAnalysisResult = {
  datasetId: string;
  question: string;
  analysis: string;
  dataUsed: BusinessAnalysisDataUsed;
};

function questionMentionsForecast(question: string): boolean {
  return /\b(forecast|predict|projection|future|trend|upcoming|next\s+(week|month|quarter|year))\b/i.test(
    question
  );
}

function questionMentionsAnomalies(question: string): boolean {
  return /\b(anomal|outlier|unusual|spike|abnormal|irregular)\b/i.test(question);
}

function truncateSqlRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.slice(0, SQL_RESULT_ROW_CAP);
}

function formatDocumentExcerpts(sources: DocumentChunkSearchHit[]): string {
  if (sources.length === 0) {
    return "(No relevant document excerpts were retrieved.)";
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
      : flagged
          .map((point) => `${point.date}: value=${point.value}`)
          .join("\n");

  return `Dataset: ${anomalies.dataset_id}
Date column: ${anomalies.date_column}
Value column: ${anomalies.value_column}
Anomaly count: ${anomalies.anomaly_count}
Sample anomaly points:
${sample}`;
}

function formatForecast(forecast: ForecastPredictResult): string {
  const lines = forecast.predictions
    .map((point) => `${point.date}: ${point.value}`)
    .join("\n");

  return `Dataset: ${forecast.dataset_id}
Horizon (days): ${forecast.days}
Predictions:
${lines}`;
}

function buildBusinessAnalysisPrompt(
  question: string,
  ctx: BusinessAnalysisContext
): string {
  const sqlRows = truncateSqlRows(ctx.sqlQuery.result);
  const blocks: string[] = [
    `Business question:\n${question.trim()}`,
    `Dataset SQL insight (generated from the question):
Question used for SQL: ${ctx.sqlQuery.question}
SQL: ${ctx.sqlQuery.sql}
Row count returned: ${ctx.sqlQuery.result.length}
Rows (truncated): ${JSON.stringify(sqlRows)}
Pipeline answer: ${ctx.sqlQuery.answer}`,
  ];

  if (ctx.documentExcerpts.length > 0) {
    blocks.push(`Relevant document excerpts:\n${formatDocumentExcerpts(ctx.documentExcerpts)}`);
  }

  if (ctx.anomalies !== null) {
    blocks.push(`Anomaly detection summary:\n${formatAnomalies(ctx.anomalies)}`);
  }

  if (ctx.forecast !== null) {
    blocks.push(`Forecast:\n${formatForecast(ctx.forecast)}`);
  }

  return `You are an AI business analyst. Write a concise business analysis that answers the user's question.

Rules:
- Use ONLY the information in the sections below. Do not invent numbers or facts.
- If the provided data is insufficient, say so clearly and explain what is missing.
- Keep the response focused (about 2–4 short paragraphs).
- Return plain text only.

${blocks.join("\n\n---\n\n")}`;
}

function rethrowIfServiceUnavailable(error: unknown): void {
  if (error instanceof AppError && error.statusCode === 502) {
    throw error;
  }
}

async function loadOptionalAnomalies(
  datasetId: string,
  question: string
): Promise<DatasetAnomaliesResult | null> {
  if (!questionMentionsAnomalies(question)) {
    return null;
  }

  try {
    return await fetchDatasetAnomalies(datasetId);
  } catch (error) {
    rethrowIfServiceUnavailable(error);
    return null;
  }
}

async function loadOptionalForecast(
  datasetId: string,
  question: string
): Promise<ForecastPredictResult | null> {
  if (!questionMentionsForecast(question)) {
    return null;
  }

  try {
    return await postForecastPredict(datasetId, FORECAST_DAYS_DEFAULT);
  } catch (error) {
    rethrowIfServiceUnavailable(error);
    return null;
  }
}

async function loadDocumentExcerpts(
  companyId: string,
  question: string
): Promise<DocumentChunkSearchHit[]> {
  const hits = await searchDocumentChunks(companyId, question);
  return hits.filter((hit) => hit.similarity >= DOCUMENT_SIMILARITY_MIN);
}

export async function runBusinessAnalysis(
  companyId: string,
  datasetId: string,
  question: string
): Promise<BusinessAnalysisResult> {
  const trimmedQuestion = question.trim();

  const sqlQuery = await postAiQuery(datasetId, companyId, trimmedQuestion);

  const [documentExcerpts, anomalies, forecast] = await Promise.all([
    loadDocumentExcerpts(companyId, trimmedQuestion),
    loadOptionalAnomalies(datasetId, trimmedQuestion),
    loadOptionalForecast(datasetId, trimmedQuestion),
  ]);

  const prompt = buildBusinessAnalysisPrompt(trimmedQuestion, {
    sqlQuery,
    documentExcerpts,
    anomalies,
    forecast,
  });

  const analysis = await chatCompletion(prompt);

  return {
    datasetId,
    question: trimmedQuestion,
    analysis,
    dataUsed: {
      sql: {
        question: sqlQuery.question,
        sql: sqlQuery.sql,
        answer: sqlQuery.answer,
        result: truncateSqlRows(sqlQuery.result),
        totalRowCount: sqlQuery.result.length,
      },
      ragSources: documentExcerpts,
      anomalies,
      forecast,
    },
  };
}
