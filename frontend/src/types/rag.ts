export type RagSource = {
  documentTitle: string;
  content: string;
  similarity: number;
};

export type RagResponse = {
  answer: string;
  sources: RagSource[];
};

export type CreateDocumentResponse = {
  id: string;
  title: string;
  chunkCount: number;
  processingStatus?: string;
};
