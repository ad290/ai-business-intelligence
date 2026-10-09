import { Router } from "express";
import {
  deleteDataset,
  getDataset,
  getDatasetAnalytics,
  getDatasetAnomalies,
  getDatasetPreview,
  getDatasetProcessingStatus,
  listDatasets,
  prepareDatasetForecast,
  predictDatasetForecast,
  trainDatasetForecast,
  processDataset,
  queryDatasetAi,
  uploadDataset,
} from "../controllers/dataset.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { uploadDatasetFile } from "../middleware/uploadDataset.js";

const datasetRouter = Router();

datasetRouter.use(authenticate);

datasetRouter.post("/upload", uploadDatasetFile, uploadDataset);
datasetRouter.get("/", listDatasets);
datasetRouter.get("/:id/preview", getDatasetPreview);
datasetRouter.get("/:id/processing-status", getDatasetProcessingStatus);
datasetRouter.post("/:id/process", processDataset);
datasetRouter.get("/:id/analytics", getDatasetAnalytics);
datasetRouter.get("/:id/anomalies", getDatasetAnomalies);
datasetRouter.get("/:id/forecast/prepare", prepareDatasetForecast);
datasetRouter.post("/:id/forecast/train", trainDatasetForecast);
datasetRouter.post("/:id/forecast", predictDatasetForecast);
datasetRouter.post("/:id/ai/query", queryDatasetAi);
datasetRouter.get("/:id", getDataset);
datasetRouter.delete("/:id", deleteDataset);

export default datasetRouter;
