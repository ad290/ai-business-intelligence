import { Router } from "express";
import { businessAnalysis } from "../controllers/business-analysis.controller.js";
import { businessReport } from "../controllers/business-report.controller.js";
import {
  createDocument,
  ragQuery,
  searchDocuments,
} from "../controllers/document.controller.js";
import { authenticate } from "../middleware/authenticate.js";

const aiRouter = Router();

aiRouter.use(authenticate);

aiRouter.post("/business-analysis", businessAnalysis);
aiRouter.post("/business-report", businessReport);
aiRouter.post("/documents", createDocument);
aiRouter.post("/search", searchDocuments);
aiRouter.post("/rag", ragQuery);

export default aiRouter;
