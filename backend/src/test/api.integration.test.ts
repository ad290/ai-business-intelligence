import assert from "node:assert/strict";
import test from "node:test";

import { getDatasetProcessingQueue } from "../jobs/dataset-processing.queue.js";
import { disconnectDatabase } from "../lib/prisma.js";
import { installExternalServiceFetchMock } from "./mockExternalFetch.js";
import { readJson, startTestServer } from "./http.js";
import { requireLocalServices } from "./requireLocalServices.js";
import {
  deleteCompanyAndData,
  SAMPLE_CSV,
  TEST_PASSWORD,
  uniqueEmail,
} from "./testData.js";

type AuthSession = {
  accessToken: string;
  companyId: string;
  userId: string;
};

async function registerAndLogin(
  baseUrl: string,
  label: string,
  companyName: string
): Promise<AuthSession> {
  const email = uniqueEmail(label);

  const registerRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "API Test User",
      email,
      password: TEST_PASSWORD,
      companyName,
    }),
  });
  assert.equal(registerRes.status, 201);

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  });
  assert.equal(loginRes.status, 200);

  const loginBody = await readJson<{
    accessToken: string;
    user: { id: string; companyId: string };
  }>(loginRes);

  return {
    accessToken: loginBody.accessToken,
    companyId: loginBody.user.companyId,
    userId: loginBody.user.id,
  };
}

async function uploadSampleDataset(
  baseUrl: string,
  accessToken: string
): Promise<string> {
  const form = new FormData();
  form.append(
    "file",
    new Blob([SAMPLE_CSV], { type: "text/csv" }),
    "sales.csv"
  );

  const response = await fetch(`${baseUrl}/api/datasets/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  assert.equal(response.status, 201);
  const body = await readJson<{ id: string }>(response);
  return body.id;
}

let restoreFetch: () => void;
let baseUrl: string;
let closeServer: () => Promise<void>;
const companiesToCleanup: string[] = [];

test.before(async () => {
  process.env.OPENROUTER_API_KEY ??= "test-openrouter-key-for-api-tests";

  await requireLocalServices();
  restoreFetch = installExternalServiceFetchMock();

  const { createApp } = await import("../app.js");
  const app = createApp();
  const server = await startTestServer(app);
  baseUrl = server.baseUrl;
  closeServer = server.close;
});

test.after(async () => {
  restoreFetch();
  await closeServer();
  for (const companyId of companiesToCleanup) {
    await deleteCompanyAndData(companyId);
  }
  await getDatasetProcessingQueue().close();
  await disconnectDatabase();
});

test("authentication: register, login, me, and failures", async () => {
  const email = uniqueEmail("auth");
  const companyName = "Auth Test Co";

  const badRegister = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test",
      email: "not-an-email",
      password: "short",
      companyName: "Co",
    }),
  });
  assert.equal(badRegister.status, 400);
  const badBody = await readJson<{ code: string }>(badRegister);
  assert.equal(badBody.code, "VALIDATION_ERROR");

  const registerRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Auth User",
      email,
      password: TEST_PASSWORD,
      companyName,
    }),
  });
  assert.equal(registerRes.status, 201);
  const registered = await readJson<{ company: { id: string } }>(registerRes);
  companiesToCleanup.push(registered.company.id);

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  });
  assert.equal(loginRes.status, 200);
  const { accessToken } = await readJson<{ accessToken: string }>(loginRes);

  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert.equal(meRes.status, 200);

  const wrongLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "WrongPass1" }),
  });
  assert.equal(wrongLogin.status, 401);

  const unauthMe = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(unauthMe.status, 401);
});

test("datasets: upload, list, and cross-company isolation", async () => {
  const sessionA = await registerAndLogin(baseUrl, "ds-a", "Dataset Co A");
  companiesToCleanup.push(sessionA.companyId);

  const datasetId = await uploadSampleDataset(baseUrl, sessionA.accessToken);

  const listRes = await fetch(`${baseUrl}/api/datasets/`, {
    headers: { Authorization: `Bearer ${sessionA.accessToken}` },
  });
  assert.equal(listRes.status, 200);
  const listBody = await readJson<{ datasets: Array<{ id: string }> }>(listRes);
  assert.ok(listBody.datasets.some((row) => row.id === datasetId));

  const sessionB = await registerAndLogin(baseUrl, "ds-b", "Dataset Co B");
  companiesToCleanup.push(sessionB.companyId);

  const foreignGet = await fetch(`${baseUrl}/api/datasets/${datasetId}`, {
    headers: { Authorization: `Bearer ${sessionB.accessToken}` },
  });
  assert.equal(foreignGet.status, 404);

  const missingFile = await fetch(`${baseUrl}/api/datasets/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionA.accessToken}` },
  });
  assert.equal(missingFile.status, 400);
});

test("dataset AI query and analytics-backed endpoints", async () => {
  const session = await registerAndLogin(baseUrl, "ai-ds", "AI Dataset Co");
  companiesToCleanup.push(session.companyId);
  const datasetId = await uploadSampleDataset(baseUrl, session.accessToken);
  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  };

  const aiQuery = await fetch(
    `${baseUrl}/api/datasets/${datasetId}/ai/query`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ question: "What is total sales?" }),
    }
  );
  assert.equal(aiQuery.status, 200);
  const aiBody = await readJson<{ answer: string; success: boolean }>(aiQuery);
  assert.equal(aiBody.success, true);
  assert.equal(aiBody.answer, "Mock SQL answer");

  const anomalies = await fetch(
    `${baseUrl}/api/datasets/${datasetId}/anomalies`,
    { headers: { Authorization: headers.Authorization } }
  );
  assert.equal(anomalies.status, 200);
  const anomalyBody = await readJson<{ anomaly_count: number }>(anomalies);
  assert.equal(anomalyBody.anomaly_count, 1);

  const prepare = await fetch(
    `${baseUrl}/api/datasets/${datasetId}/forecast/prepare`,
    { headers: { Authorization: headers.Authorization } }
  );
  assert.equal(prepare.status, 200);

  const train = await fetch(
    `${baseUrl}/api/datasets/${datasetId}/forecast/train`,
    { method: "POST", headers: { Authorization: headers.Authorization } }
  );
  assert.equal(train.status, 200);

  const forecast = await fetch(`${baseUrl}/api/datasets/${datasetId}/forecast`, {
    method: "POST",
    headers,
    body: JSON.stringify({ days: 7 }),
  });
  assert.equal(forecast.status, 200);
  const forecastBody = await readJson<{ days: number; predictions: unknown[] }>(
    forecast
  );
  assert.equal(forecastBody.days, 7);
  assert.ok(forecastBody.predictions.length > 0);

  const badAi = await fetch(`${baseUrl}/api/datasets/${datasetId}/ai/query`, {
    method: "POST",
    headers,
    body: JSON.stringify({ question: "   " }),
  });
  assert.equal(badAi.status, 400);
});

test("RAG: document create, search, and rag query", async () => {
  const session = await registerAndLogin(baseUrl, "rag", "RAG Test Co");
  companiesToCleanup.push(session.companyId);
  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  };

  const createDoc = await fetch(`${baseUrl}/api/ai/documents`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: "Policy",
      content: "Our refund policy allows returns within 30 days of purchase.",
    }),
  });
  assert.equal(createDoc.status, 201);

  const search = await fetch(`${baseUrl}/api/ai/search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: "refund policy" }),
  });
  assert.equal(search.status, 200);
  const searchBody = await readJson<{ results: unknown[] }>(search);
  assert.ok(Array.isArray(searchBody.results));

  const rag = await fetch(`${baseUrl}/api/ai/rag`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: "What is the refund policy?" }),
  });
  assert.equal(rag.status, 200);
  const ragBody = await readJson<{ answer: string; sources: unknown[] }>(rag);
  assert.ok(ragBody.answer.length > 0);

  const forbiddenCompany = await fetch(`${baseUrl}/api/ai/search`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: "refund",
      companyId: "00000000-0000-0000-0000-000000000099",
    }),
  });
  assert.equal(forbiddenCompany.status, 403);

  const listRes = await fetch(`${baseUrl}/api/documents`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  assert.equal(listRes.status, 200);
  const listBody = await readJson<{ documents: { id: string; title: string }[] }>(
    listRes
  );
  assert.equal(listBody.documents.length, 1);
  assert.equal(listBody.documents[0]?.title, "Policy");

  const deleteRes = await fetch(
    `${baseUrl}/api/documents/${listBody.documents[0]?.id}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.accessToken}` },
    }
  );
  assert.equal(deleteRes.status, 204);

  const listAfterDelete = await fetch(`${baseUrl}/api/documents`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  const listAfterBody = await readJson<{ documents: unknown[] }>(listAfterDelete);
  assert.equal(listAfterBody.documents.length, 0);
});

test("business analysis and business report", async () => {
  const session = await registerAndLogin(
    baseUrl,
    "biz",
    "Business Analysis Co"
  );
  companiesToCleanup.push(session.companyId);
  const datasetId = await uploadSampleDataset(baseUrl, session.accessToken);
  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  };

  await fetch(`${baseUrl}/api/ai/documents`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: "Goals",
      content: "Increase quarterly revenue by ten percent.",
    }),
  });

  const analysis = await fetch(`${baseUrl}/api/ai/business-analysis`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      datasetId,
      question: "Summarize sales and note any anomalies in the data.",
    }),
  });
  assert.equal(analysis.status, 200);
  const analysisBody = await readJson<{ analysis: string; datasetId: string }>(
    analysis
  );
  assert.equal(analysisBody.datasetId, datasetId);
  assert.ok(analysisBody.analysis.length > 0);

  const report = await fetch(`${baseUrl}/api/ai/business-report`, {
    method: "POST",
    headers,
    body: JSON.stringify({ datasetId }),
  });
  assert.equal(report.status, 200);
  const reportBody = await readJson<{ datasetId: string; sections: unknown[] }>(
    report
  );
  assert.equal(reportBody.datasetId, datasetId);
  assert.ok(reportBody.sections.length > 0);

  const missingDataset = await fetch(`${baseUrl}/api/ai/business-report`, {
    method: "POST",
    headers,
    body: JSON.stringify({ datasetId: "00000000-0000-0000-0000-000000000099" }),
  });
  assert.equal(missingDataset.status, 404);
});

test("protected routes reject missing auth", async () => {
  const res = await fetch(`${baseUrl}/api/datasets/`);
  assert.equal(res.status, 401);
});
