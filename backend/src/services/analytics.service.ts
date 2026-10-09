import { config } from "../config/env.js";
import { AppError, NotFoundError } from "../lib/errors.js";

export type AnalyticsDatasetResult = {
  dataset_id: string;
  original_row_count: number;
  cleaned_row_count: number;
  columns: string[];
  detected_data_types: Record<string, string>;
  statistics: Record<string, unknown>;
  head: Record<string, unknown>[];
  rows: Record<string, unknown>[];
};

export type ForecastPrepareResult = {
  dataset_id: string;
  date_column: string;
  value_column: string;
  aggregated_row_count: number;
  features: Record<string, unknown>[];
};

export type ForecastTrainResult = {
  dataset_id: string;
  model_path: string;
  row_count_after_drop: number;
  train_row_count: number;
  test_row_count: number;
  test_mae: number;
  feature_columns: string[];
};

export type ForecastPredictResult = {
  dataset_id: string;
  days: number;
  predictions: { date: string; value: number }[];
};

export type AnomalyPoint = {
  date: string;
  value: number;
  is_anomaly: boolean;
};

export type DatasetAnomaliesResult = {
  dataset_id: string;
  date_column: string;
  value_column: string;
  row_count: number;
  anomaly_count: number;
  points: AnomalyPoint[];
};

async function readAnalyticsErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      detail?: string | { msg?: string }[];
    };
    if (typeof body.detail === "string") {
      return body.detail;
    }
    if (Array.isArray(body.detail) && body.detail[0]?.msg) {
      return body.detail[0].msg;
    }
  } catch {
    // ignore
  }
  return "Analytics service request failed";
}

function isDatasetNotFoundDetail(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("dataset not found") ||
    message === "Analytics service request failed"
  );
}

async function throwFromAnalyticsResponse(response: Response): Promise<never> {
  const message = await readAnalyticsErrorMessage(response);

  if (response.status === 404) {
    if (isDatasetNotFoundDetail(message)) {
      throw new NotFoundError("Dataset not found");
    }
    throw new AppError(message, 404, "NOT_FOUND");
  }

  if (response.status === 400) {
    throw new AppError(message, 400, "BAD_REQUEST");
  }

  throw new AppError(
    message,
    response.status >= 500 ? 502 : response.status,
    "ANALYTICS_UNAVAILABLE"
  );
}

export async function fetchForecastPrepare(
  datasetId: string
): Promise<ForecastPrepareResult> {
  const baseUrl = config.analyticsServiceUrl.replace(/\/$/, "");
  const url = `${baseUrl}/datasets/${encodeURIComponent(datasetId)}/forecast/prepare`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new AppError(
      "Analytics service is unavailable",
      502,
      "ANALYTICS_UNAVAILABLE"
    );
  }

  if (!response.ok) {
    await throwFromAnalyticsResponse(response);
  }

  return (await response.json()) as ForecastPrepareResult;
}

export async function fetchDatasetAnomalies(
  datasetId: string
): Promise<DatasetAnomaliesResult> {
  const baseUrl = config.analyticsServiceUrl.replace(/\/$/, "");
  const url = `${baseUrl}/datasets/${encodeURIComponent(datasetId)}/anomalies`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new AppError(
      "Analytics service is unavailable",
      502,
      "ANALYTICS_UNAVAILABLE"
    );
  }

  if (!response.ok) {
    await throwFromAnalyticsResponse(response);
  }

  return (await response.json()) as DatasetAnomaliesResult;
}

export async function postForecastTrain(
  datasetId: string
): Promise<ForecastTrainResult> {
  const baseUrl = config.analyticsServiceUrl.replace(/\/$/, "");
  const url = `${baseUrl}/datasets/${encodeURIComponent(datasetId)}/forecast/train`;

  let response: Response;
  try {
    response = await fetch(url, { method: "POST" });
  } catch {
    throw new AppError(
      "Analytics service is unavailable",
      502,
      "ANALYTICS_UNAVAILABLE"
    );
  }

  if (!response.ok) {
    await throwFromAnalyticsResponse(response);
  }

  return (await response.json()) as ForecastTrainResult;
}

async function requestForecastPredict(
  datasetId: string,
  days: number
): Promise<Response> {
  const baseUrl = config.analyticsServiceUrl.replace(/\/$/, "");
  const url = `${baseUrl}/datasets/${encodeURIComponent(datasetId)}/forecast`;

  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days }),
    });
  } catch {
    throw new AppError(
      "Analytics service is unavailable",
      502,
      "ANALYTICS_UNAVAILABLE"
    );
  }
}

export async function postForecastPredict(
  datasetId: string,
  days: number
): Promise<ForecastPredictResult> {
  let response = await requestForecastPredict(datasetId, days);

  if (response.status === 404) {
    const message = await readAnalyticsErrorMessage(response);
    if (isDatasetNotFoundDetail(message)) {
      throw new NotFoundError("Dataset not found");
    }

    await postForecastTrain(datasetId);
    response = await requestForecastPredict(datasetId, days);
  }

  if (!response.ok) {
    await throwFromAnalyticsResponse(response);
  }

  return (await response.json()) as ForecastPredictResult;
}

export async function fetchDatasetAnalytics(
  datasetId: string
): Promise<AnalyticsDatasetResult> {
  const baseUrl = config.analyticsServiceUrl.replace(/\/$/, "");
  const url = `${baseUrl}/datasets/${encodeURIComponent(datasetId)}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new AppError(
      "Analytics service is unavailable",
      502,
      "ANALYTICS_UNAVAILABLE"
    );
  }

  if (!response.ok) {
    await throwFromAnalyticsResponse(response);
  }

  return (await response.json()) as AnalyticsDatasetResult;
}

export type AiQueryResult = {
  datasetId: string;
  question: string;
  sql: string;
  result: Record<string, unknown>[];
  answer: string;
};

export async function postAiQuery(
  datasetId: string,
  companyId: string,
  question: string
): Promise<AiQueryResult> {
  const baseUrl = config.analyticsServiceUrl.replace(/\/$/, "");
  const url = `${baseUrl}/ai/query`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ datasetId, question, companyId }),
    });
  } catch {
    throw new AppError(
      "Analytics service is unavailable",
      502,
      "ANALYTICS_UNAVAILABLE"
    );
  }

  if (response.status === 404) {
    const message = await readAnalyticsErrorMessage(response);
    if (isDatasetNotFoundDetail(message)) {
      throw new NotFoundError("Dataset not found");
    }
    throw new AppError(message, 404, "NOT_FOUND");
  }

  if (response.status === 403) {
    throw new AppError(
      await readAnalyticsErrorMessage(response),
      403,
      "FORBIDDEN"
    );
  }

  if (response.status === 400) {
    throw new AppError(
      await readAnalyticsErrorMessage(response),
      400,
      "BAD_REQUEST"
    );
  }

  if (!response.ok) {
    throw new AppError(
      await readAnalyticsErrorMessage(response),
      502,
      "ANALYTICS_UNAVAILABLE"
    );
  }

  return (await response.json()) as AiQueryResult;
}

export type AiEmbedResult = {
  embedding: number[];
  dimension: number;
};

export async function postAiEmbed(text: string): Promise<AiEmbedResult> {
  const baseUrl = config.analyticsServiceUrl.replace(/\/$/, "");
  const url = `${baseUrl}/ai/embed`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {
    throw new AppError(
      "Analytics service is unavailable",
      502,
      "ANALYTICS_UNAVAILABLE"
    );
  }

  if (response.status === 400) {
    throw new AppError(
      await readAnalyticsErrorMessage(response),
      400,
      "BAD_REQUEST"
    );
  }

  if (!response.ok) {
    throw new AppError(
      await readAnalyticsErrorMessage(response),
      502,
      "ANALYTICS_UNAVAILABLE"
    );
  }

  return (await response.json()) as AiEmbedResult;
}
