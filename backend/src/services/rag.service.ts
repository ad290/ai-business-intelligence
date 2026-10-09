import type { DocumentChunkSearchHit } from "./document.service.js";
import { searchDocumentChunks } from "./document.service.js";
import { chatCompletion } from "./openrouter.service.js";

export type RagSource = {
  documentTitle: string;
  content: string;
  similarity: number;
};

export type RagResult = {
  answer: string;
  sources: RagSource[];
};

function buildRagPrompt(query: string, sources: DocumentChunkSearchHit[]): string {
  const contextBlocks =
    sources.length === 0
      ? "(No document excerpts were retrieved.)"
      : sources
          .map(
            (source, index) =>
              `[${index + 1}] Document: "${source.documentTitle}" (similarity: ${source.similarity.toFixed(4)})\n${source.content}`
          )
          .join("\n\n");

  return `You are a business knowledge assistant. Answer the user's question using ONLY the document excerpts below.

Rules:
- If the excerpts do not contain enough information to answer the question, respond clearly that the information is not available in the provided documents.
- Do not guess, invent, or use outside knowledge.
- Keep the answer concise (one or two short paragraphs at most).
- Return plain text only.

Document excerpts:
${contextBlocks}

User question:
${query.trim()}`;
}

export async function runRagQuery(
  companyId: string,
  query: string
): Promise<RagResult> {
  const sources = await searchDocumentChunks(companyId, query);
  const prompt = buildRagPrompt(query, sources);
  const answer = await chatCompletion(prompt);

  return {
    answer,
    sources: sources.map((source) => ({
      documentTitle: source.documentTitle,
      content: source.content,
      similarity: source.similarity,
    })),
  };
}
