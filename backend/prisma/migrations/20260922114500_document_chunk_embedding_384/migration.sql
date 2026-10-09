-- Match DocumentChunk.embedding to all-MiniLM-L6-v2 (384 dimensions).
ALTER TABLE "DocumentChunk" ALTER COLUMN "embedding" TYPE vector(384);
