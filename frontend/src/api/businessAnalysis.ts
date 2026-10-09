import { apiJson } from "./client";
import type {
  BusinessAnalysisResponse,
  BusinessReportResponse,
} from "../types/businessAnalysis";

export async function requestBusinessAnalysis(
  datasetId: string,
  question: string
): Promise<BusinessAnalysisResponse> {
  return apiJson<BusinessAnalysisResponse>("/api/ai/business-analysis", {
    method: "POST",
    body: JSON.stringify({ datasetId, question }),
  });
}

export async function requestBusinessReport(
  datasetId: string
): Promise<BusinessReportResponse> {
  return apiJson<BusinessReportResponse>("/api/ai/business-report", {
    method: "POST",
    body: JSON.stringify({ datasetId }),
  });
}
