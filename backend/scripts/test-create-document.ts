/**
 * Smoke test: POST /ai/documents and verify rows in PostgreSQL.
 * Requires backend + analytics-service running, and a user in the DB.
 *
 * Usage:
 *   TEST_EMAIL=... TEST_PASSWORD=... npx tsx scripts/test-create-document.ts
 */
import "dotenv/config";
import pg from "pg";
import { config } from "../src/config/env.js";

const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;
const apiBase = `http://localhost:${config.port}`;

if (!email || !password) {
  console.error("Set TEST_EMAIL and TEST_PASSWORD in the environment.");
  process.exit(1);
}

async function main(): Promise<void> {
  const loginRes = await fetch(`${apiBase}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
  }

  const loginBody = (await loginRes.json()) as { accessToken: string };
  const token = loginBody.accessToken;

  const sample = {
    title: "Return Policy",
    content:
      "Our products can be returned within 30 days of purchase. Items must be unused and in original packaging. " +
      "Refunds are processed within 5 business days after we receive the return. Contact support for a return label.",
  };

  const createRes = await fetch(`${apiBase}/ai/documents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(sample),
  });

  const createBody = await createRes.json();
  if (!createRes.ok) {
    throw new Error(`Create document failed: ${createRes.status} ${JSON.stringify(createBody)}`);
  }

  console.log("Created document:", createBody);

  const pool = new pg.Pool({ connectionString: config.databaseUrl });
  const docId = (createBody as { id: string }).id;

  const docRow = await pool.query(
    `SELECT id, "companyId", title FROM "Document" WHERE id = $1`,
    [docId]
  );
  const chunkRows = await pool.query<{ id: string; embedding: string | null }>(
    `SELECT id, embedding::text AS embedding FROM "DocumentChunk" WHERE "documentId" = $1 ORDER BY "createdAt"`,
    [docId]
  );

  await pool.end();

  if (docRow.rowCount !== 1) {
    throw new Error("Document row not found in PostgreSQL");
  }

  const expectedChunks = (createBody as { chunkCount: number }).chunkCount;
  if (chunkRows.rowCount !== expectedChunks) {
    throw new Error(
      `Expected ${expectedChunks} chunks, found ${chunkRows.rowCount ?? 0}`,
    );
  }

  for (const row of chunkRows.rows) {
    if (!row.embedding || !row.embedding.startsWith("[")) {
      throw new Error(`Chunk ${row.id} missing embedding`);
    }
  }

  console.log(
    `Verified: 1 document, ${chunkRows.rowCount} chunks with embeddings in PostgreSQL.`,
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
