import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import { deleteDocument, listDocuments, uploadDocument } from "../api/documents";
import { AppPageHeader } from "../components/AppPageHeader";
import {
  DashboardEmptyState,
  DashboardLoadingState,
} from "../components/AnalyticsDashboardSection";
import type { DocumentSummary } from "../types/document";

const ALLOWED_EXTENSIONS = new Set(["pdf", "docx", "txt", "md"]);

function formatStatus(status: DocumentSummary["processingStatus"]): string {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "PROCESSING":
      return "Processing";
    case "COMPLETED":
      return "Ready";
    case "FAILED":
      return "Failed";
    default:
      return status;
  }
}

function formatUploadDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function titleFromFileName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}

export function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentTitle, setDocumentTitle] = useState("");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastUploadTitle, setLastUploadTitle] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setListLoading(true);
    setListError(null);

    try {
      const response = await listDocuments();
      setDocuments(response.documents);
    } catch (error) {
      setListError(
        error instanceof ApiError ? error.message : "Failed to load documents"
      );
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError(null);
    setLastUploadTitle(null);

    if (!selectedFile) {
      setUploadError("Choose a PDF, DOCX, or TXT file to upload.");
      return;
    }

    const extension = selectedFile.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      setUploadError("Only .pdf, .docx, and .txt files are supported.");
      return;
    }

    setUploadLoading(true);

    try {
      const title =
        documentTitle.trim() || titleFromFileName(selectedFile.name);
      const result = await uploadDocument(selectedFile, title);
      setLastUploadTitle(result.title);
      setSelectedFile(null);
      setDocumentTitle("");
      await loadDocuments();
    } catch (error) {
      setUploadError(
        error instanceof ApiError ? error.message : "Upload failed"
      );
    } finally {
      setUploadLoading(false);
    }
  }

  async function handleDelete(document: DocumentSummary) {
    const confirmed = window.confirm(
      `Delete "${document.title}"? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(document.id);
    setListError(null);

    try {
      await deleteDocument(document.id);
      await loadDocuments();
    } catch (error) {
      setListError(
        error instanceof ApiError ? error.message : "Failed to delete document"
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="documents-page app-page">
      <AppPageHeader
        title="Company documents"
        subtitle="Upload PDF, DOCX, or TXT files for your company knowledge base."
      />

      <section className="page-card datasets-upload-card">
        <h2 className="app-section-title">Upload document</h2>
        <p className="muted datasets-upload-hint">
          Set a display title or leave blank.
        </p>

        <form
          className="upload-form"
          onSubmit={(event) => void handleUpload(event)}
        >
          <label>
            Document title (optional)
            <input
              type="text"
              value={documentTitle}
              onChange={(event) => setDocumentTitle(event.target.value)}
              placeholder="Defaults to the file name"
              disabled={uploadLoading}
              maxLength={200}
            />
          </label>

          <label>
            File (.pdf, .docx, or .txt)
            <input
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={(event) =>
                setSelectedFile(event.target.files?.[0] ?? null)
              }
              disabled={uploadLoading}
            />
          </label>

          {uploadError ? (
            <p className="error-banner" role="alert">
              {uploadError}
            </p>
          ) : null}

          <button type="submit" disabled={uploadLoading}>
            {uploadLoading ? "Processing…" : "Upload document"}
          </button>
        </form>

        {uploadLoading ? (
          <DashboardLoadingState message="Extracting text and building embeddings…" />
        ) : null}

        {lastUploadTitle ? (
          <p className="company-docs-success" role="status">
            <strong>{lastUploadTitle}</strong> is indexed and ready for Company
            Docs search.{" "}
            <Link to="/dashboard">Ask questions on the dashboard</Link>.
          </p>
        ) : null}
      </section>

      <section className="page-card">
        <div className="section-header">
          <h2 className="app-section-title app-section-title--inline">
            Your documents
          </h2>
          <button
            type="button"
            className="button-secondary"
            onClick={() => void loadDocuments()}
            disabled={listLoading}
          >
            Refresh
          </button>
        </div>

        {listLoading ? (
          <DashboardLoadingState message="Loading documents…" />
        ) : null}
        {listError ? (
          <p className="error-banner" role="alert">
            {listError}
          </p>
        ) : null}

        {!listLoading && !listError && documents.length === 0 ? (
          <DashboardEmptyState message="No documents yet. Upload your first file above." />
        ) : null}

        {!listLoading && documents.length > 0 ? (
          <ul className="dataset-list">
            {documents.map((document) => (
              <li key={document.id} className="dataset-item">
                <div className="dataset-item-body">
                  <strong className="dataset-item-name">{document.title}</strong>
                  <p className="muted dataset-meta">
                    {document.originalFileName ?? "Pasted text"}
                    {document.fileType ? ` · ${document.fileType}` : ""}
                    {" · "}
                    {formatStatus(document.processingStatus)}
                    {document.chunkCount != null
                      ? ` · ${document.chunkCount} chunks`
                      : ""}
                    {" · "}
                    Uploaded {formatUploadDate(document.createdAt)}
                  </p>
                  {document.processingStatus === "FAILED" &&
                  document.processingError ? (
                    <p className="error-banner" role="alert">
                      {document.processingError}
                    </p>
                  ) : null}
                </div>
                <div className="dataset-actions">
                  <button
                    type="button"
                    className="button-danger"
                    onClick={() => void handleDelete(document)}
                    disabled={deletingId === document.id}
                  >
                    {deletingId === document.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
