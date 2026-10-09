import type { Request, Response, NextFunction } from "express";
import { BadRequestError, UnauthorizedError } from "../lib/errors.js";
import { datasetFileTypeFromName } from "../middleware/uploadDataset.js";
import { parseUploadedCsv } from "../services/csvDataset.service.js";
import {
  fetchDatasetAnalytics,
  fetchDatasetAnomalies,
  fetchForecastPrepare,
  postAiQuery,
  postForecastPredict,
  postForecastTrain,
} from "../services/analytics.service.js";
import {
  deleteDatasetForCompany,
  getDatasetForCompany,
  getDatasetPreviewForCompany,
  listDatasetsForCompany,
  resolveDatasetName,
  storeUploadedDataset,
} from "../services/dataset.service.js";
import {
  enqueueDatasetProcessingJob,
  getDatasetProcessingStatusForCompany,
} from "../services/datasetProcessing.service.js";
import { parseUploadedJson } from "../services/jsonDataset.service.js";

function requireAuthCompanyId(req: Request): string {
  if (req.auth === undefined) {
    throw new UnauthorizedError("Authentication required");
  }

  return req.auth.companyId;
}

function parseDatasetId(rawId: string | string[] | undefined): string {
  if (typeof rawId !== "string" || rawId.length === 0) {
    throw new BadRequestError("Dataset id is required");
  }

  return rawId;
}

export async function uploadDataset(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = requireAuthCompanyId(req);

    if (req.file === undefined) {
      next(new BadRequestError('Missing file; use multipart field "file"'));
      return;
    }

    const { originalname, buffer } = req.file;
    const fileType = datasetFileTypeFromName(originalname);

    const parsed =
      fileType === "csv"
        ? parseUploadedCsv(buffer)
        : parseUploadedJson(buffer);

    const name = resolveDatasetName(originalname, req.body?.name);

    const stored = await storeUploadedDataset(
      companyId,
      originalname,
      fileType,
      name,
      parsed
    );

    await enqueueDatasetProcessingJob(stored.id);

    res.status(201).json({
      success: true,
      id: stored.id,
      name: stored.name,
      fileType: stored.fileType,
      rowCount: stored.rowCount,
      schema: stored.schema,
      preview: stored.preview,
      processingStatus: "PENDING",
    });
  } catch (error) {
    next(error);
  }
}

export async function listDatasets(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = requireAuthCompanyId(req);
    const datasets = await listDatasetsForCompany(companyId);

    res.status(200).json({
      success: true,
      datasets,
    });
  } catch (error) {
    next(error);
  }
}

export async function getDataset(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = requireAuthCompanyId(req);
    const datasetId = parseDatasetId(req.params.id);
    const dataset = await getDatasetForCompany(companyId, datasetId);

    res.status(200).json({
      success: true,
      dataset,
    });
  } catch (error) {
    next(error);
  }
}

export async function getDatasetPreview(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = requireAuthCompanyId(req);
    const datasetId = parseDatasetId(req.params.id);
    const preview = await getDatasetPreviewForCompany(companyId, datasetId);

    res.status(200).json({
      success: true,
      ...preview,
    });
  } catch (error) {
    next(error);
  }
}

export async function processDataset(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = requireAuthCompanyId(req);
    const datasetId = parseDatasetId(req.params.id);

    await getDatasetForCompany(companyId, datasetId);
    await enqueueDatasetProcessingJob(datasetId);

    res.status(202).json({
      success: true,
      datasetId,
      processingStatus: "PENDING",
    });
  } catch (error) {
    next(error);
  }
}

export async function getDatasetProcessingStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = requireAuthCompanyId(req);
    const datasetId = parseDatasetId(req.params.id);
    const status = await getDatasetProcessingStatusForCompany(
      companyId,
      datasetId,
    );

    res.status(200).json({
      success: true,
      ...status,
    });
  } catch (error) {
    next(error);
  }
}

export async function getDatasetAnalytics(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = requireAuthCompanyId(req);
    const datasetId = parseDatasetId(req.params.id);

    await getDatasetForCompany(companyId, datasetId);

    const analytics = await fetchDatasetAnalytics(datasetId);

    res.status(200).json({
      success: true,
      ...analytics,
    });
  } catch (error) {
    next(error);
  }
}

export async function prepareDatasetForecast(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = requireAuthCompanyId(req);
    const datasetId = parseDatasetId(req.params.id);

    await getDatasetForCompany(companyId, datasetId);

    const prepared = await fetchForecastPrepare(datasetId);

    res.status(200).json({
      success: true,
      ...prepared,
    });
  } catch (error) {
    next(error);
  }
}

export async function getDatasetAnomalies(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = requireAuthCompanyId(req);
    const datasetId = parseDatasetId(req.params.id);

    await getDatasetForCompany(companyId, datasetId);

    const anomalies = await fetchDatasetAnomalies(datasetId);

    res.status(200).json({
      success: true,
      ...anomalies,
    });
  } catch (error) {
    next(error);
  }
}

export async function trainDatasetForecast(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = requireAuthCompanyId(req);
    const datasetId = parseDatasetId(req.params.id);

    await getDatasetForCompany(companyId, datasetId);

    const trained = await postForecastTrain(datasetId);

    res.status(200).json({
      success: true,
      ...trained,
    });
  } catch (error) {
    next(error);
  }
}

function parseForecastDays(body: unknown): number {
  const defaultDays = 30;

  if (typeof body !== "object" || body === null) {
    return defaultDays;
  }

  if (!("days" in body)) {
    return defaultDays;
  }

  const rawDays = (body as { days: unknown }).days;
  if (typeof rawDays !== "number" || !Number.isInteger(rawDays) || rawDays < 1) {
    throw new BadRequestError("days must be a positive integer");
  }

  return rawDays;
}

export async function predictDatasetForecast(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = requireAuthCompanyId(req);
    const datasetId = parseDatasetId(req.params.id);
    const days = parseForecastDays(req.body);

    await getDatasetForCompany(companyId, datasetId);

    const forecast = await postForecastPredict(datasetId, days);

    res.status(200).json({
      success: true,
      ...forecast,
    });
  } catch (error) {
    next(error);
  }
}

function parseAiQuestion(body: unknown): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "question" in body &&
    typeof (body as { question: unknown }).question === "string"
  ) {
    const trimmed = (body as { question: string }).question.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  throw new BadRequestError("Question is required");
}

export async function queryDatasetAi(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = requireAuthCompanyId(req);
    const datasetId = parseDatasetId(req.params.id);
    const question = parseAiQuestion(req.body);

    await getDatasetForCompany(companyId, datasetId);

    const result = await postAiQuery(datasetId, companyId, question);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteDataset(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = requireAuthCompanyId(req);
    const datasetId = parseDatasetId(req.params.id);
    const deleted = await deleteDatasetForCompany(companyId, datasetId);

    res.status(200).json({
      success: true,
      id: deleted.id,
    });
  } catch (error) {
    next(error);
  }
}
