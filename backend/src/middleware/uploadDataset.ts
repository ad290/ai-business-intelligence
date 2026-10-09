import type { Request, Response, NextFunction } from "express";
import multer, { MulterError } from "multer";
import { BadRequestError } from "../lib/errors.js";

/** Suitable limit for demo/resume uploads (CSV/JSON). */
export const DATASET_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([".csv", ".json"]);

function fileExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1) {
    return "";
  }

  return filename.slice(dotIndex).toLowerCase();
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: DATASET_UPLOAD_MAX_BYTES,
    files: 1,
  },
  fileFilter(_req, file, callback) {
    const extension = fileExtension(file.originalname);

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      callback(
        new BadRequestError("Only .csv and .json files are allowed")
      );
      return;
    }

    callback(null, true);
  },
});

/**
 * Parses a single multipart field `file`. File stays in memory; not persisted yet.
 */
export function uploadDatasetFile(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  upload.single("file")(req, res, (error) => {
    if (error instanceof MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        next(
          new BadRequestError(
            `File exceeds the maximum allowed size (${DATASET_UPLOAD_MAX_BYTES / (1024 * 1024)} MB)`
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

export function datasetFileTypeFromName(
  originalFilename: string
): "csv" | "json" {
  const extension = fileExtension(originalFilename);

  if (extension === ".json") {
    return "json";
  }

  return "csv";
}
