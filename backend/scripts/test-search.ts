/**
 * Smoke test: POST /ai/search against Return Policy document chunks.
 *
 * Usage:
 *   TEST_EMAIL=... TEST_PASSWORD=... npx tsx scripts/test-search.ts
 */
import "dotenv/config";
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

  const loginBody = (await loginRes.json()) as {
    accessToken: string;
    user: { companyId: string };
  };

  const question = "How long do I have to return a product?";

  const searchRes = await fetch(`${apiBase}/ai/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${loginBody.accessToken}`,
    },
    body: JSON.stringify({
      query: question,
      companyId: loginBody.user.companyId,
    }),
  });

  const searchBody = await searchRes.json();
  if (!searchRes.ok) {
    throw new Error(`Search failed: ${searchRes.status} ${JSON.stringify(searchBody)}`);
  }

  console.log("Search results:", JSON.stringify(searchBody, null, 2));

  const results = (searchBody as { results: Array<{ documentTitle: string; content: string; similarity: number }> })
    .results;

  if (!Array.isArray(results) || results.length === 0) {
    throw new Error("Expected at least one search result");
  }

  const top = results[0];
  if (top.documentTitle !== "Return Policy") {
    throw new Error(`Expected Return Policy, got: ${top.documentTitle}`);
  }

  if (!top.content.toLowerCase().includes("30 days")) {
    throw new Error("Top chunk does not mention 30-day return window");
  }

  if (top.similarity <= 0) {
    throw new Error("Expected positive cosine similarity score");
  }

  console.log(
    `Verified: top hit is "${top.documentTitle}" with similarity ${top.similarity.toFixed(4)}`,
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
