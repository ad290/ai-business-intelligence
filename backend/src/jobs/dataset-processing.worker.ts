import { Worker } from "bullmq";
import { createRedisConnection } from "../lib/redis.js";
import { runDatasetProcessingJob } from "../services/datasetProcessing.service.js";
import {
  DATASET_PROCESSING_QUEUE_NAME,
  type DatasetProcessingJobData,
} from "./dataset-processing.types.js";

export function startDatasetProcessingWorker(): Worker<
  DatasetProcessingJobData,
  void
> {
  const worker = new Worker<DatasetProcessingJobData, void>(
    DATASET_PROCESSING_QUEUE_NAME,
    async (job) => {
      const { datasetId } = job.data;
      console.log(
        `[dataset-processing] started datasetId=${datasetId} jobId=${job.id}`,
      );
      await runDatasetProcessingJob(datasetId);
      console.log(
        `[dataset-processing] completed datasetId=${datasetId} jobId=${job.id}`,
      );
    },
    { connection: createRedisConnection() },
  );

  worker.on("failed", (job, err) => {
    console.error(
      `[dataset-processing] failed jobId=${job?.id ?? "unknown"}:`,
      err,
    );
  });

  return worker;
}
