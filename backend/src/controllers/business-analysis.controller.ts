import type { NextFunction, Request, Response } from "express";
import { BadRequestError, UnauthorizedError } from "../lib/errors.js";
import { getDatasetForCompany } from "../services/dataset.service.js";
import { runBusinessAnalysis } from "../services/business-analysis.service.js";

function requireAuthCompanyId(req: Request): string {
  if (req.auth === undefined) {
    throw new UnauthorizedError("Authentication required");
  }

  return req.auth.companyId;
}

function parseBusinessAnalysisBody(body: unknown): {
  datasetId: string;
  question: string;
} {
  if (typeof body !== "object" || body === null) {
    throw new BadRequestError("Invalid request body");
  }

  const { datasetId, question } = body as {
    datasetId?: unknown;
    question?: unknown;
  };

  if (typeof datasetId !== "string" || datasetId.trim().length === 0) {
    throw new BadRequestError("datasetId is required");
  }

  if (typeof question !== "string" || question.trim().length === 0) {
    throw new BadRequestError("question is required");
  }

  return { datasetId: datasetId.trim(), question: question.trim() };
}

export async function businessAnalysis(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = requireAuthCompanyId(req);
    const { datasetId, question } = parseBusinessAnalysisBody(req.body);

    await getDatasetForCompany(companyId, datasetId);

    const result = await runBusinessAnalysis(companyId, datasetId, question);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
