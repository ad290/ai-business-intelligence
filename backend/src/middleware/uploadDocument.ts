import type { NextFunction, Request, Response } from "express";
import multer, { MulterError } from "multer";
import { BadRequestError } from "../lib/errors.js";
import { documentFileTypeFromName } from "../lib/documentTextExtraction.js";

/** Limit for company knowledge documents (PDF/DOCX/TXT). */
export const DOCUMENT_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: DOCUMENT_UPLOAD_MAX_BYTES,
    files: 1,
  },
  fileFilter(_req, file, callback) {
    if (documentFileTypeFromName(file.originalname) === null) {
      callback(
        new BadRequestError("Only .pdf, .docx, and .txt files are allowed")
      );
      return;
    }

    callback(null, true);
  },
});

export function uploadDocumentFile(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  upload.single("file")(req, res, (error) => {
    if (error instanceof MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        next(
          new BadRequestError(
            `File exceeds the maximum allowed size (${DOCUMENT_UPLOAD_MAX_BYTES / (1024 * 1024)} MB)`
          )
        );
        return;
      }

      next(new BadRequestError(error.message));
      return;
    }

    if (error) {
      next(error);
      return;
    }

    next();
  });
}
