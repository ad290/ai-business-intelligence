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

let restoreFetch: () => void;
let baseUrl: string;
let closeServer: () => Promise<void>;

test.before(async () => {
  process.env.OPENROUTER_API_KEY ??= "test-openrouter-key-for-api-tests";

  await requireLocalServices();
  restoreFetch = installExternalServiceFetchMock();

  const { createApp } = await import("../app.js");
  const server = await startTestServer(createApp());
  baseUrl = server.baseUrl;
  closeServer = server.close;
});

test.after(async () => {
  restoreFetch();
  await closeServer();
  await getDatasetProcessingQueue().close();
  await disconnectDatabase();
});

test("happy path: register through business report", async () => {
  const email = uniqueEmail("e2e");
  const companyName = "E2E Happy Path Co";
  let companyId: string;

  const registerRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "E2E User",
      email,
      password: TEST_PASSWORD,
      companyName,
    }),
  });
  assert.equal(registerRes.status, 201);
  const registered = await readJson<{ company: { id: string } }>(registerRes);
  companyId = registered.company.id;

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  });
  assert.equal(loginRes.status, 200);
  const { accessToken } = await readJson<{ accessToken: string }>(loginRes);

  const auth = { Authorization: `Bearer ${accessToken}` };
  const jsonAuth = {
    ...auth,
    "Content-Type": "application/json",
  };

  const form = new FormData();
  form.append(
    "file",
    new Blob([SAMPLE_CSV], { type: "text/csv" }),
    "sales.csv"
  );
  const uploadRes = await fetch(`${baseUrl}/api/datasets/upload`, {
    method: "POST",
    headers: auth,
    body: form,
  });
  assert.equal(uploadRes.status, 201);
  const { id: datasetId } = await readJson<{ id: string }>(uploadRes);

  const analyticsRes = await fetch(
    `${baseUrl}/api/datasets/${datasetId}/analytics`,
    { headers: auth }
  );
  assert.equal(analyticsRes.status, 200);
  const analyticsBody = await readJson<{ success: boolean; columns: string[] }>(
    analyticsRes
  );
  assert.equal(analyticsBody.success, true);
  assert.ok(analyticsBody.columns.length > 0);

  const aiQueryRes = await fetch(
    `${baseUrl}/api/datasets/${datasetId}/ai/query`,
    {
      method: "POST",
      headers: jsonAuth,
      body: JSON.stringify({ question: "What is total sales?" }),
    }
  );
  assert.equal(aiQueryRes.status, 200);

  await fetch(`${baseUrl}/api/ai/documents`, {
    method: "POST",
    headers: jsonAuth,
    body: JSON.stringify({
      title: "Company context",
      content: "We focus on growing monthly sales and monitoring outliers.",
    }),
  });

  const ragRes = await fetch(`${baseUrl}/api/ai/rag`, {
    method: "POST",
    headers: jsonAuth,
    body: JSON.stringify({ query: "What do we focus on?" }),
  });
  assert.equal(ragRes.status, 200);

  const prepareRes = await fetch(
    `${baseUrl}/api/datasets/${datasetId}/forecast/prepare`,
    { headers: auth }
  );
  assert.equal(prepareRes.status, 200);

  const trainRes = await fetch(
    `${baseUrl}/api/datasets/${datasetId}/forecast/train`,
    { method: "POST", headers: auth }
  );
  assert.equal(trainRes.status, 200);

  const forecastRes = await fetch(
    `${baseUrl}/api/datasets/${datasetId}/forecast`,
    {
      method: "POST",
      headers: jsonAuth,
      body: JSON.stringify({ days: 7 }),
    }
  );
  assert.equal(forecastRes.status, 200);
  const forecastBody = await readJson<{ predictions: unknown[] }>(forecastRes);
  assert.ok(forecastBody.predictions.length > 0);

  const anomaliesRes = await fetch(
    `${baseUrl}/api/datasets/${datasetId}/anomalies`,
    { headers: auth }
  );
  assert.equal(anomaliesRes.status, 200);

  const analysisRes = await fetch(`${baseUrl}/api/ai/business-analysis`, {
    method: "POST",
    headers: jsonAuth,
    body: JSON.stringify({
      datasetId,
      question: "Give a short summary of sales performance.",
    }),
  });
  assert.equal(analysisRes.status, 200);

  const reportRes = await fetch(`${baseUrl}/api/ai/business-report`, {
    method: "POST",
    headers: jsonAuth,
    body: JSON.stringify({ datasetId }),
  });
  assert.equal(reportRes.status, 200);
  const reportBody = await readJson<{ sections: unknown[] }>(reportRes);
  assert.ok(reportBody.sections.length > 0);

  await deleteCompanyAndData(companyId);
});
