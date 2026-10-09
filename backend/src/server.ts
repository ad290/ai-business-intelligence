import { config } from "./config/env.js";
import { createApp } from "./app.js";
import { startDatasetProcessingWorker } from "./jobs/dataset-processing.worker.js";

const app = createApp();

const datasetProcessingWorker = startDatasetProcessingWorker();

async function shutdown(): Promise<void> {
  await datasetProcessingWorker.close();
}

process.once("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});
process.once("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});

app.listen(config.port, () => {
  console.log(
    `Server running on http://localhost:${config.port} (${config.nodeEnv})`
  );
});