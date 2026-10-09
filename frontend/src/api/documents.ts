import { ApiError, apiFetch, apiJson } from "./client";
import type {
  ListDocumentsResponse,
  UploadDocumentResponse,
} from "../types/document";

export async function listDocuments(): Promise<ListDocumentsResponse> {
  return apiJson<ListDocumentsResponse>("/api/documents");
}

export async function uploadDocument(
  file: File,
  title?: string
): Promise<UploadDocumentResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const trimmedTitle = title?.trim();
  if (trimmedTitle) {
    formData.append("title", trimmedTitle);
  }

  const response = await apiFetch("/api/documents/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let body: { message?: string; code?: string } = {
      message: response.statusText,
    };
    try {
      body = (await response.json()) as { message?: string; code?: string };
    } catch {
      // ignore
    }
    throw new ApiError(response.status, body);
  }

  return (await response.json()) as UploadDocumentResponse;
}

export async function deleteDocument(documentId: string): Promise<void> {
  await apiJson<void>(`/api/documents/${documentId}`, {
    method: "DELETE",
  });
}
