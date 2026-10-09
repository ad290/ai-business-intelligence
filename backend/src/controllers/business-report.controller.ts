import type { NextFunction, Request, Response } from "express";
import { BadRequestError, UnauthorizedError } from "../lib/errors.js";
import { getDatasetForCompany } from "../services/dataset.service.js";
import { runBusinessReport } from "../services/business-report.service.js";

function requireAuthCompanyId(req: Request): string {
  if (req.auth === undefined) {
    throw new UnauthorizedError("Authentication required");
  }

  return req.auth.companyId;
}

function parseBusinessReportBody(body: unknown): { datasetId: string } {
  if (typeof body !== "object" || body === null) {
    throw new BadRequestError("Invalid request body");
  }

  const { datasetId } = body as { datasetId?: unknown };

  if (typeof datasetId !== "string" || datasetId.trim().length === 0) {
    throw new BadRequestError("datasetId is required");
  }

  return { datasetId: datasetId.trim() };
}

export async function businessReport(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = requireAuthCompanyId(req);
    const { datasetId } = parseBusinessReportBody(req.body);

    await getDatasetForCompany(companyId, datasetId);

    const result = await runBusinessReport(companyId, datasetId);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
