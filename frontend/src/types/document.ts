export type DocumentProcessingStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export type DocumentFileType = "PDF" | "DOCX" | "TXT";

export type DocumentSummary = {
  id: string;
  title: string;
  originalFileName: string | null;
  fileType: DocumentFileType | null;
  processingStatus: DocumentProcessingStatus;
  chunkCount: number | null;
  createdAt: string;
  processedAt: string | null;
  processingError: string | null;
};

export type ListDocumentsResponse = {
  documents: DocumentSummary[];
};

export type UploadDocumentResponse = {
  id: string;
  title: string;
  chunkCount: number;
  processingStatus: DocumentProcessingStatus;
};
