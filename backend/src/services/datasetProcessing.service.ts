import { DatasetProcessingStatus } from "@prisma/client";
import { fetchDatasetAnalytics } from "./analytics.service.js";
import { NotFoundError } from "../lib/errors.js";
import { whereCompanyScoped } from "../lib/tenantScope.js";
import { prisma } from "../lib/prisma.js";
import { scheduleDatasetProcessing } from "../jobs/dataset-processing.queue.js";

export type DatasetProcessingStatusView = {
  id: string;
  processingStatus: DatasetProcessingStatus;
  processedRowCount: number | null;
  processedAt: Date | null;
};

export async function setDatasetProcessingStatus(
  datasetId: string,
  processingStatus: DatasetProcessingStatus,
): Promise<void> {
  const result = await prisma.dataset.updateMany({
    where: { id: datasetId },
    data: { processingStatus },
  });

  if (result.count === 0) {
    throw new NotFoundError("Dataset not found");
  }
}

async function trySetDatasetProcessingStatus(
  datasetId: string,
  processingStatus: DatasetProcessingStatus,
): Promise<boolean> {
  const result = await prisma.dataset.updateMany({
    where: { id: datasetId },
    data: { processingStatus },
  });
  return result.count > 0;
}

export async function markDatasetProcessingPending(datasetId: string): Promise<void> {
  await setDatasetProcessingStatus(datasetId, DatasetProcessingStatus.PENDING);
}

export async function runDatasetProcessingJob(datasetId: string): Promise<void> {
  const started = await trySetDatasetProcessingStatus(
    datasetId,
    DatasetProcessingStatus.PROCESSING,
  );
  if (!started) {
    console.warn(`[dataset-processing] dataset not found: ${datasetId}`);
    return;
  }

  try {
    await fetchDatasetAnalytics(datasetId);
    await trySetDatasetProcessingStatus(
      datasetId,
      DatasetProcessingStatus.COMPLETED,
    );
  } catch (error) {
    await trySetDatasetProcessingStatus(
      datasetId,
      DatasetProcessingStatus.FAILED,
    );
    throw error;
  }
}

export async function enqueueDatasetProcessingJob(
  datasetId: string,
): Promise<void> {
  await markDatasetProcessingPending(datasetId);
  await scheduleDatasetProcessing(datasetId);
}

export async function getDatasetProcessingStatusForCompany(
  companyId: string,
  datasetId: string,
): Promise<DatasetProcessingStatusView> {
  const dataset = await prisma.dataset.findFirst({
    where: {
      id: datasetId,
      ...whereCompanyScoped(companyId),
    },
    select: {
      id: true,
      processingStatus: true,
      processedRowCount: true,
      processedAt: true,
    },
  });

  if (dataset === null) {
    throw new NotFoundError("Dataset not found");
  }

  return dataset;
}
