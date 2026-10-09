import { Router } from "express";
import {
  deleteDocument,
  listDocuments,
  uploadDocument,
} from "../controllers/document.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { uploadDocumentFile } from "../middleware/uploadDocument.js";

const documentRouter = Router();

documentRouter.use(authenticate);

documentRouter.get("/", listDocuments);
documentRouter.post("/upload", uploadDocumentFile, uploadDocument);
documentRouter.delete("/:id", deleteDocument);

export default documentRouter;
