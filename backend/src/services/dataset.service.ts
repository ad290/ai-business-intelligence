import { DatasetFileType, Prisma } from "@prisma/client";
import type { ParsedUploadDataset, SchemaColumn } from "../lib/datasetSchema.js";
import { NotFoundError } from "../lib/errors.js";
import { whereCompanyScoped } from "../lib/tenantScope.js";
import { prisma } from "../lib/prisma.js";

export const DATASET_PREVIEW_ROW_LIMIT = 50;

export type StoredDataset = {
  id: string;
  name: string;
  fileType: "csv" | "json";
  rowCount: number;
  schema: SchemaColumn[];
  preview: Record<string, unknown>[];
};

export type DatasetSummary = {
  id: string;
  name: string;
  originalFileName: string;
  fileType: "csv" | "json";
  rowCount: number;
  schema: SchemaColumn[];
  createdAt: Date;
  updatedAt: Date;
};

export type DatasetPreview = {
  id: string;
  rowCount: number;
  rows: Record<string, unknown>[];
};

const datasetSummarySelect = {
  id: true,
  name: true,
  originalFileName: true,
  fileType: true,
  rowCount: true,
  columns: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DatasetSelect;

function fromDatasetFileType(fileType: DatasetFileType): "csv" | "json" {
  return fileType === DatasetFileType.CSV ? "csv" : "json";
}

function toDatasetFileType(fileType: "csv" | "json"): DatasetFileType {
  return fileType === "csv" ? DatasetFileType.CSV : DatasetFileType.JSON;
}

function parseStoredSchema(columns: Prisma.JsonValue): SchemaColumn[] {
  if (!Array.isArray(columns)) {
    return [];
  }

  return columns as SchemaColumn[];
}

function toDatasetSummary(
  dataset: Prisma.DatasetGetPayload<{ select: typeof datasetSummarySelect }>
): DatasetSummary {
  return {
    id: dataset.id,
    name: dataset.name,
    originalFileName: dataset.originalFileName,
    fileType: fromDatasetFileType(dataset.fileType),
    rowCount: dataset.rowCount,
    schema: parseStoredSchema(dataset.columns),
    createdAt: dataset.createdAt,
    updatedAt: dataset.updatedAt,
  };
}

async function findDatasetForCompany(
  datasetId: string,
  companyId: string
): Promise<DatasetSummary> {
  const dataset = await prisma.dataset.findFirst({
    where: {
      id: datasetId,
      ...whereCompanyScoped(companyId),
    },
    select: datasetSummarySelect,
  });

  if (dataset === null) {
    throw new NotFoundError("Dataset not found");
  }

  return toDatasetSummary(dataset);
}

export function resolveDatasetName(
  originalFileName: string,
  requestedName: unknown
): string {
  if (typeof requestedName === "string") {
    const trimmed = requestedName.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  const dotIndex = originalFileName.lastIndexOf(".");
  if (dotIndex <= 0) {
    return originalFileName;
  }

  return originalFileName.slice(0, dotIndex);
}

export async function storeUploadedDataset(
  companyId: string,
  originalFileName: string,
  fileType: "csv" | "json",
  name: string,
  parsed: ParsedUploadDataset
): Promise<StoredDataset> {
  const dataset = await prisma.$transaction(async (tx) => {
    const created = await tx.dataset.create({
      data: {
        companyId,
        name,
        originalFileName,
        fileType: toDatasetFileType(fileType),
        rowCount: parsed.rowCount,
        columns: parsed.schema as Prisma.InputJsonValue,
      },
    });

    await tx.datasetRow.createMany({
      data: parsed.records.map((record) => ({
        datasetId: created.id,
        data: record as Prisma.InputJsonValue,
      })),
    });

    return created;
  });

  return {
    id: dataset.id,
    name: dataset.name,
    fileType,
    rowCount: dataset.rowCount,
    schema: parsed.schema,
    preview: parsed.preview,
  };
}

export async function listDatasetsForCompany(
  companyId: string
): Promise<DatasetSummary[]> {
  const datasets = await prisma.dataset.findMany({
    where: whereCompanyScoped(companyId),
    select: datasetSummarySelect,
    orderBy: { createdAt: "desc" },
  });

  return datasets.map(toDatasetSummary);
}

export async function getDatasetForCompany(
  companyId: string,
  datasetId: string
): Promise<DatasetSummary> {
  return findDatasetForCompany(datasetId, companyId);
}

export async function getDatasetPreviewForCompany(
  companyId: string,
  datasetId: string
): Promise<DatasetPreview> {
  const dataset = await findDatasetForCompany(datasetId, companyId);

  const rows = await prisma.datasetRow.findMany({
    where: { datasetId: dataset.id },
    orderBy: { createdAt: "asc" },
    take: DATASET_PREVIEW_ROW_LIMIT,
    select: { data: true },
  });

  return {
    id: dataset.id,
    rowCount: dataset.rowCount,
    rows: rows.map((row) => row.data as Record<string, unknown>),
  };
}

export async function deleteDatasetForCompany(
  companyId: string,
  datasetId: string
): Promise<{ id: string }> {
  const result = await prisma.dataset.deleteMany({
    where: {
      id: datasetId,
      ...whereCompanyScoped(companyId),
    },
  });

  if (result.count === 0) {
    throw new NotFoundError("Dataset not found");
  }

  return { id: datasetId };
}
