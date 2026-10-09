const CHUNK_SIZE = 800;

/**
 * Split text into fixed-size chunks (800 chars, within the 500–1000 target range).
 */
export function splitTextIntoChunks(text: string): string[] {
  const normalized = text.trim();
  if (normalized.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  for (let start = 0; start < normalized.length; start += CHUNK_SIZE) {
    chunks.push(normalized.slice(start, start + CHUNK_SIZE));
  }

  return chunks;
}
