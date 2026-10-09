import { apiJson } from "./client";
import type { CreateDocumentResponse, RagResponse } from "../types/rag";

export async function askKnowledgeBase(query: string): Promise<RagResponse> {
  return apiJson<RagResponse>("/ai/rag", {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}

export async function createCompanyDocument(
  title: string,
  content: string
): Promise<CreateDocumentResponse> {
  return apiJson<CreateDocumentResponse>("/api/ai/documents", {
    method: "POST",
    body: JSON.stringify({ title, content }),
  });
}
