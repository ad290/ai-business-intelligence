/**
 * Smoke test: RAG pipeline with Return Policy document in DB.
 *
 * Usage:
 *   TEST_EMAIL=... TEST_PASSWORD=... npx tsx scripts/test-rag.ts
 */
import dotenv from "dotenv";

dotenv.config();

process.env.OPENROUTER_MODEL =
  process.env.TEST_OPENROUTER_MODEL ?? "nex-agi/nex-n2.5-mini:free";

if (!process.env.OPENROUTER_API_KEY) {
  console.error("OPENROUTER_API_KEY must be set in backend/.env");
  process.exit(1);
}

const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;

if (!email || !password) {
  console.error("Set TEST_EMAIL and TEST_PASSWORD in the environment.");
  process.exit(1);
}

async function main(): Promise<void> {
  const { config } = await import("../src/config/env.js");
  const { runRagQuery } = await import("../src/services/rag.service.js");

  const apiBase = `http://localhost:${config.port}`;

  const loginRes = await fetch(`${apiBase}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
  }

  const loginBody = (await loginRes.json()) as {
    user: { companyId: string };
  };

  const question = "How long do I have to return a product?";
  const result = await runRagQuery(loginBody.user.companyId, question);

  console.log(JSON.stringify(result, null, 2));

  if (!Array.isArray(result.sources) || result.sources.length === 0) {
    throw new Error("Expected at least one source");
  }

  const answer = result.answer.toLowerCase();
  if (!answer.includes("30") && !answer.includes("thirty")) {
    throw new Error(`Answer does not mention 30-day return period: ${result.answer}`);
  }

  console.log("Verified: RAG answer references the 30-day return period.");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
