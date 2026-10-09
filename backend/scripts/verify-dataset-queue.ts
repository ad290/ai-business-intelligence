import "dotenv/config";
import { QueueEvents } from "bullmq";
import {
  createRedisConnection,
  isRedisReachable,
} from "../src/lib/redis.js";
import { scheduleDatasetProcessing } from "../src/jobs/dataset-processing.queue.js";
import { startDatasetProcessingWorker } from "../src/jobs/dataset-processing.worker.js";
import { DATASET_PROCESSING_QUEUE_NAME } from "../src/jobs/dataset-processing.types.js";

async function main(): Promise<void> {
  if (!(await isRedisReachable())) {
    throw new Error(
      "Redis is not reachable. Start Redis and set REDIS_URL (default redis://127.0.0.1:6379).",
    );
  }

  const datasetId = `verify-${Date.now()}`;
  const worker = startDatasetProcessingWorker();
  const queueEvents = new QueueEvents(DATASET_PROCESSING_QUEUE_NAME, {
    connection: createRedisConnection(),
  });

  try {
    await queueEvents.waitUntilReady();
    const job = await scheduleDatasetProcessing(datasetId);
    try {
      await job.waitUntilFinished(queueEvents, 10_000);
    } catch {
      const state = await job.getState();
      if (state !== "completed" && state !== "failed") {
        throw new Error(`unexpected job state: ${state}`);
      }
    }
    console.log("dataset-processing queue OK");
    console.log(`  jobId: ${job.id}`);
    console.log(`  jobState: ${await job.getState()}`);
    console.log(`  datasetId: ${datasetId}`);
  } finally {
    await queueEvents.close();
    await worker.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
