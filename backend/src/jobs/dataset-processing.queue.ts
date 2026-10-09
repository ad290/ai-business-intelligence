import { Queue } from "bullmq";
import { createRedisConnection } from "../lib/redis.js";
import {
  DATASET_PROCESSING_JOB_NAME,
  DATASET_PROCESSING_QUEUE_NAME,
  type DatasetProcessingJobData,
} from "./dataset-processing.types.js";

export function createDatasetProcessingQueue(): Queue<
  DatasetProcessingJobData,
  void,
  typeof DATASET_PROCESSING_JOB_NAME
> {
  return new Queue<DatasetProcessingJobData, void, typeof DATASET_PROCESSING_JOB_NAME>(
    DATASET_PROCESSING_QUEUE_NAME,
    { connection: createRedisConnection() },
  );
}

let datasetProcessingQueue:
  | Queue<
      DatasetProcessingJobData,
      void,
      typeof DATASET_PROCESSING_JOB_NAME
    >
  | undefined;

export function getDatasetProcessingQueue(): Queue<
  DatasetProcessingJobData,
  void,
  typeof DATASET_PROCESSING_JOB_NAME
> {
  if (datasetProcessingQueue === undefined) {
    datasetProcessingQueue = createDatasetProcessingQueue();
  }

  return datasetProcessingQueue;
}

function datasetProcessingJobId(datasetId: string): string {
  return `dataset-${datasetId}`;
}

export async function enqueueDatasetProcessing(
  queue: Queue<
    DatasetProcessingJobData,
    void,
    typeof DATASET_PROCESSING_JOB_NAME
  >,
  datasetId: string,
) {
  const jobId = datasetProcessingJobId(datasetId);
  const existing = await queue.getJob(jobId);
  if (existing !== undefined) {
    await existing.remove();
  }

  return queue.add(
    DATASET_PROCESSING_JOB_NAME,
    { datasetId },
    {
      jobId,
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 1,
    },
  );
}

export async function scheduleDatasetProcessing(datasetId: string) {
  return enqueueDatasetProcessing(getDatasetProcessingQueue(), datasetId);
}
