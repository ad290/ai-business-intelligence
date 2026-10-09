import { randomUUID } from "node:crypto";
import { DatasetProcessingStatus, Prisma, type DocumentFileType } from "@prisma/client";
import { BadRequestError, NotFoundError } from "../lib/errors.js";
import { extractTextFromUpload } from "../lib/documentTextExtraction.js";
import { prisma } from "../lib/prisma.js";
import { splitTextIntoChunks } from "../lib/textChunking.js";
import { whereCompanyScoped } from "../lib/tenantScope.js";
import { toVectorLiteral } from "../lib/vector.js";
import { postAiEmbed } from "./analytics.service.js";

export type CreateDocumentResult = {
  id: string;
  title: string;
  chunkCount: number;
  processingStatus: DatasetProcessingStatus;
};

export type DocumentSummary = {
  id: string;
  title: string;
  originalFileName: string | null;
  fileType: DocumentFileType | null;
  processingStatus: DatasetProcessingStatus;
  chunkCount: number | null;
  createdAt: Date;
  processedAt: Date | null;
  processingError: string | null;
};

export type DocumentChunkSearchHit = {
  documentTitle: string;
  content: string;
  similarity: number;
};

type CreateDocumentMetadata = {
  originalFileName?: string;
  fileType?: DocumentFileType;
};

export function resolveDocumentTitle(
  originalFileName: string,
  requestedName: unknown
): string {
  if (typeof requestedName === "string" && requestedName.trim().length > 0) {
    return requestedName.trim();
  }

  const dotIndex = originalFileName.lastIndexOf(".");
  const base =
    dotIndex === -1
      ? originalFileName
      : originalFileName.slice(0, dotIndex);

  const normalized = base.replace(/[_-]+/g, " ").trim();
  return normalized.length > 0 ? normalized : originalFileName;
}

export async function listDocumentsForCompany(
  companyId: string
): Promise<DocumentSummary[]> {
  return prisma.document.findMany({
    where: whereCompanyScoped(companyId),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      originalFileName: true,
      fileType: true,
      processingStatus: true,
      chunkCount: true,
      createdAt: true,
      processedAt: true,
      processingError: true,
    },
  });
}

export async function deleteDocumentForCompany(
  companyId: string,
  documentId: string
): Promise<void> {
  const result = await prisma.document.deleteMany({
    where: {
      id: documentId,
      ...whereCompanyScoped(companyId),
    },
  });

  if (result.count === 0) {
    throw new NotFoundError("Document not found");
  }
}

export async function createDocumentFromUpload(
  companyId: string,
  title: string,
  originalFileName: string,
  fileType: DocumentFileType,
  buffer: Buffer
): Promise<CreateDocumentResult> {
  const extracted = await extractTextFromUpload(buffer, fileType);
  const content = extracted.trim();

  if (content.length === 0) {
    throw new BadRequestError("Could not extract any text from this file");
  }

  return createDocumentWithChunks(companyId, title, content, {
    originalFileName,
    fileType,
  });
}

export async function searchDocumentChunks(
  companyId: string,
  query: string
): Promise<DocumentChunkSearchHit[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length === 0) {
    throw new BadRequestError("Query is required");
  }

  const { embedding } = await postAiEmbed(trimmedQuery);
  const queryVector = toVectorLiteral(embedding);

  const rows = await prisma.$queryRaw<
    Array<{
      documentTitle: string;
      content: string;
      similarity: number;
    }>
  >(
    Prisma.sql`
      SELECT
        d.title AS "documentTitle",
        c.content AS content,
        (1 - (c.embedding <=> CAST(${queryVector} AS vector)))::float8 AS similarity
      FROM "DocumentChunk" c
      INNER JOIN "Document" d ON d.id = c."documentId"
      WHERE d."companyId" = ${companyId}
        AND d."processingStatus" = ${DatasetProcessingStatus.COMPLETED}::"DatasetProcessingStatus"
        AND c.embedding IS NOT NULL
      ORDER BY c.embedding <=> CAST(${queryVector} AS vector)
      LIMIT 3
    `
  );

  return rows.map((row) => ({
    documentTitle: row.documentTitle,
    content: row.content,
    similarity: Number(row.similarity),
  }));
}

export async function createDocumentWithChunks(
  companyId: string,
  title: string,
  content: string,
  metadata: CreateDocumentMetadata = {}
): Promise<CreateDocumentResult> {
  const trimmedContent = content.trim();
  const chunks = splitTextIntoChunks(trimmedContent);
  if (chunks.length === 0) {
    throw new BadRequestError("Content is required");
  }

  const document = await prisma.document.create({
    data: {
      companyId,
      title: title.trim(),
      content: trimmedContent,
      originalFileName: metadata.originalFileName ?? null,
      fileType: metadata.fileType ?? null,
      processingStatus: DatasetProcessingStatus.PROCESSING,
    },
  });

  try {
    const embeddedChunks: Array<{
      id: string;
      content: string;
      vectorLiteral: string;
    }> = [];

    for (const chunkContent of chunks) {
      const { embedding } = await postAiEmbed(chunkContent);
      embeddedChunks.push({
        id: randomUUID(),
        content: chunkContent,
        vectorLiteral: toVectorLiteral(embedding),
      });
    }

    await prisma.$transaction(async (tx) => {
      for (const chunk of embeddedChunks) {
        await tx.$executeRaw(
          Prisma.sql`
            INSERT INTO "DocumentChunk" ("id", "documentId", "content", "embedding", "createdAt")
            VALUES (
              ${chunk.id},
              ${document.id},
              ${chunk.content},
              CAST(${chunk.vectorLiteral} AS vector),
              NOW()
            )
          `
        );
      }

      await tx.document.update({
        where: { id: document.id },
        data: {
          processingStatus: DatasetProcessingStatus.COMPLETED,
          chunkCount: chunks.length,
          processedAt: new Date(),
          processingError: null,
        },
      });
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Document processing failed";

    await prisma.document.update({
      where: { id: document.id },
      data: {
        processingStatus: DatasetProcessingStatus.FAILED,
        processingError: message,
      },
    });

    throw error;
  }

  return {
    id: document.id,
    title: document.title,
    chunkCount: chunks.length,
    processingStatus: DatasetProcessingStatus.COMPLETED,
  };
}
