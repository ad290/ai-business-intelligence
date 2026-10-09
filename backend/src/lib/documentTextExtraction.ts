import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { BadRequestError } from "./errors.js";
import type { DocumentFileType } from "@prisma/client";

export function documentFileTypeFromName(
  originalFilename: string
): DocumentFileType | null {
  const dotIndex = originalFilename.lastIndexOf(".");
  if (dotIndex === -1) {
    return null;
  }

  const extension = originalFilename.slice(dotIndex + 1).toLowerCase();

  switch (extension) {
    case "pdf":
      return "PDF";
    case "docx":
      return "DOCX";
    case "txt":
    case "md":
      return "TXT";
    default:
      return null;
  }
}

export async function extractTextFromUpload(
  buffer: Buffer,
  fileType: DocumentFileType
): Promise<string> {
  switch (fileType) {
    case "TXT":
      return buffer.toString("utf-8");
    case "PDF": {
      const parser = new PDFParse({ data: buffer });
      try {
        const parsed = await parser.getText();
        return parsed.text;
      } finally {
        await parser.destroy();
      }
    }
    case "DOCX": {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    default:
      throw new BadRequestError("Unsupported document type");
  }
}
