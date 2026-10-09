import type { NextFunction, Request, Response } from "express";
import {
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
} from "../lib/errors.js";
import {
  documentFileTypeFromName,
} from "../lib/documentTextExtraction.js";
import {
  createDocumentFromUpload,
  createDocumentWithChunks,
  deleteDocumentForCompany,
  listDocumentsForCompany,
  resolveDocumentTitle,
  searchDocumentChunks,
} from "../services/document.service.js";
import { runRagQuery } from "../services/rag.service.js";

function requireAuthCompanyId(req: Request): string {
  if (req.auth === undefined) {
    throw new UnauthorizedError("Authentication required");
  }

  return req.auth.companyId;
}

function parseCreateDocumentBody(body: unknown): { title: string; content: string } {
  if (typeof body !== "object" || body === null) {
    throw new BadRequestError("Invalid request body");
  }

  const { title, content } = body as { title?: unknown; content?: unknown };

  if (typeof title !== "string" || title.trim().length === 0) {
    throw new BadRequestError("Title is required");
  }

  if (typeof content !== "string" || content.trim().length === 0) {
    throw new BadRequestError("Content is required");
  }

  return { title: title.trim(), content: content.trim() };
}

function parseRagQuery(body: unknown): string {
  if (typeof body !== "object" || body === null) {
    throw new BadRequestError("Invalid request body");
  }

  const { query } = body as { query?: unknown };
  if (typeof query !== "string" || query.trim().length === 0) {
    throw new BadRequestError("Query is required");
  }

  return query.trim();
}

function parseSearchBody(
  body: unknown,
  authCompanyId: string
): { query: string; companyId: string } {
  if (typeof body !== "object" || body === null) {
    throw new BadRequestError("Invalid request body");
  }

  const { query, companyId } = body as {
    query?: unknown;
    companyId?: unknown;
  };

  if (typeof query !== "string" || query.trim().length === 0) {
    throw new BadRequestError("Query is required");
  }

  if (companyId !== undefined) {
    if (typeof companyId !== "string" || companyId.trim().length === 0) {
      throw new BadRequestError("companyId must be a non-empty string");
    }
    if (companyId !== authCompanyId) {
      throw new ForbiddenError("companyId does not match authenticated company");
    }
  }

  return { query: query.trim(), companyId: authCompanyId };
}

function parseDocumentId(rawId: string | string[] | undefined): string {
  if (typeof rawId !== "string" || rawId.length === 0) {
    throw new BadRequestError("Document id is required");
  }

  return rawId;
}

export async function listDocuments(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = requireAuthCompanyId(req);
    const documents = await listDocumentsForCompany(companyId);

    res.status(200).json({ documents });
  } catch (error) {
    next(error);
  }
}

export async function uploadDocument(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = requireAuthCompanyId(req);

    if (req.file === undefined) {
      next(new BadRequestError('Missing file; use multipart field "file"'));
      return;
    }

    const { originalname, buffer } = req.file;
    const fileType = documentFileTypeFromName(originalname);

    if (fileType === null) {
      next(new BadRequestError("Only .pdf, .docx, and .txt files are allowed"));
      return;
    }

    const title = resolveDocumentTitle(originalname, req.body?.title);

    const result = await createDocumentFromUpload(
      companyId,
      title,
      originalname,
      fileType,
      buffer
    );

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function deleteDocument(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = requireAuthCompanyId(req);
    const documentId = parseDocumentId(req.params.id);

    await deleteDocumentForCompany(companyId, documentId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function ragQuery(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = requireAuthCompanyId(req);
    const query = parseRagQuery(req.body);

    const result = await runRagQuery(companyId, query);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function searchDocuments(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authCompanyId = requireAuthCompanyId(req);
    const { query, companyId } = parseSearchBody(req.body, authCompanyId);

    const results = await searchDocumentChunks(companyId, query);

    res.status(200).json({ results });
  } catch (error) {
    next(error);
  }
}

export async function createDocument(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const companyId = requireAuthCompanyId(req);
    const { title, content } = parseCreateDocumentBody(req.body);

    const result = await createDocumentWithChunks(companyId, title, content);

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}
