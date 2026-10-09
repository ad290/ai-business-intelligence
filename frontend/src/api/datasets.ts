import { ApiError, apiFetch, apiJson } from "./client";
import type {
  DatasetAiQueryResponse,
  DatasetAnalyticsResponse,
  DatasetPreviewResponse,
  DatasetProcessingStatusResponse,
  ForecastPredictResponse,
  DatasetAnomaliesResponse,
  ForecastPrepareResponse,
  ListDatasetsResponse,
  UploadDatasetResponse,
} from "../types/dataset";

const POLL_INTERVAL_MS = 500;
const MAX_POLL_ATTEMPTS = 120;

async function parseErrorBody(response: Response) {
  try {
    return (await response.json()) as { message?: string; code?: string };
  } catch {
    return { message: response.statusText };
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const timeoutId = setTimeout(() => resolve(), ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeoutId);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}

export async function listDatasets(): Promise<ListDatasetsResponse> {
  return apiJson<ListDatasetsResponse>("/api/datasets");
}

export async function uploadDataset(
  file: File,
  name?: string
): Promise<UploadDatasetResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const trimmedName = name?.trim();
  if (trimmedName) {
    formData.append("name", trimmedName);
  }

  const response = await apiFetch("/api/datasets/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorBody(response));
  }

  return (await response.json()) as UploadDatasetResponse;
}

export async function fetchDatasetPreview(
  datasetId: string
): Promise<DatasetPreviewResponse> {
  return apiJson<DatasetPreviewResponse>(`/api/datasets/${datasetId}/preview`);
}

export async function fetchDatasetProcessingStatus(
  datasetId: string
): Promise<DatasetProcessingStatusResponse> {
  return apiJson<DatasetProcessingStatusResponse>(
    `/api/datasets/${datasetId}/processing-status`
  );
}

export async function fetchDatasetAnalytics(
  datasetId: string
): Promise<DatasetAnalyticsResponse> {
  return apiJson<DatasetAnalyticsResponse>(
    `/api/datasets/${datasetId}/analytics`
  );
}

export async function processDataset(
  datasetId: string,
  options?: { signal?: AbortSignal }
): Promise<DatasetAnalyticsResponse> {
  await apiJson(`/api/datasets/${datasetId}/process`, {
    method: "POST",
  });

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    if (options?.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const status = await fetchDatasetProcessingStatus(datasetId);

    if (status.processingStatus === "COMPLETED") {
      return fetchDatasetAnalytics(datasetId);
    }

    if (status.processingStatus === "FAILED") {
      throw new ApiError(502, {
        message: "Dataset processing failed",
        code: "DATASET_PROCESSING_FAILED",
      });
    }

    await sleep(POLL_INTERVAL_MS, options?.signal);
  }

  throw new ApiError(504, {
    message: "Dataset processing timed out",
    code: "DATASET_PROCESSING_TIMEOUT",
  });
}

export async function askDatasetAi(
  datasetId: string,
  question: string
): Promise<DatasetAiQueryResponse> {
  return apiJson<DatasetAiQueryResponse>(`/api/datasets/${datasetId}/ai/query`, {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}

export async function fetchDatasetAnomalies(
  datasetId: string
): Promise<DatasetAnomaliesResponse> {
  return apiJson<DatasetAnomaliesResponse>(
    `/api/datasets/${datasetId}/anomalies`
  );
}

export async function prepareDatasetForecast(
  datasetId: string
): Promise<ForecastPrepareResponse> {
  return apiJson<ForecastPrepareResponse>(
    `/api/datasets/${datasetId}/forecast/prepare`
  );
}

export async function postDatasetForecast(
  datasetId: string,
  days = 30
): Promise<ForecastPredictResponse> {
  return apiJson<ForecastPredictResponse>(
    `/api/datasets/${datasetId}/forecast`,
    {
      method: "POST",
      body: JSON.stringify({ days }),
    }
  );
}

export async function deleteDataset(datasetId: string): Promise<void> {
  await apiJson(`/api/datasets/${datasetId}`, {
    method: "DELETE",
  });
}
