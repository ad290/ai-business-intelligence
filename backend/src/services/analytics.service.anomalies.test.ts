import assert from "node:assert/strict";
import test from "node:test";

import { AppError, NotFoundError } from "../lib/errors.js";

const analyticsPayload = {
  dataset_id: "ds-1",
  date_column: "date",
  value_column: "sales",
  row_count: 2,
  anomaly_count: 1,
  points: [
    { date: "2024-01-01T00:00:00", value: 10, is_anomaly: false },
    { date: "2024-01-02T00:00:00", value: 500, is_anomaly: true },
  ],
};

test("fetchDatasetAnomalies returns parsed analytics response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    assert.equal(
      String(input),
      "http://analytics.test/datasets/ds-1/anomalies"
    );
    return new Response(JSON.stringify(analyticsPayload), { status: 200 });
  };

  process.env.ANALYTICS_SERVICE_URL = "http://analytics.test";
  const { fetchDatasetAnomalies } = await import("./analytics.service.js");

  const result = await fetchDatasetAnomalies("ds-1");
  assert.equal(result.anomaly_count, 1);
  assert.equal(result.points.length, 2);

  globalThis.fetch = originalFetch;
});

test("fetchDatasetAnomalies maps 404 to NotFoundError", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 404 });

  process.env.ANALYTICS_SERVICE_URL = "http://analytics.test";
  const { fetchDatasetAnomalies } = await import("./analytics.service.js");

  await assert.rejects(
    () => fetchDatasetAnomalies("missing"),
    (error: unknown) => error instanceof NotFoundError
  );

  globalThis.fetch = originalFetch;
});

test("fetchDatasetAnomalies maps 400 to AppError", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ detail: "Need at least 3 daily values" }), {
      status: 400,
    });

  process.env.ANALYTICS_SERVICE_URL = "http://analytics.test";
  const { fetchDatasetAnomalies } = await import("./analytics.service.js");

  await assert.rejects(
    () => fetchDatasetAnomalies("ds-1"),
    (error: unknown) =>
      error instanceof AppError &&
      error.statusCode === 400 &&
      error.message.includes("3 daily values")
  );

  globalThis.fetch = originalFetch;
});

test("fetchDatasetAnomalies maps network errors to analytics unavailable", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("connection refused");
  };

  process.env.ANALYTICS_SERVICE_URL = "http://analytics.test";
  const { fetchDatasetAnomalies } = await import("./analytics.service.js");

  await assert.rejects(
    () => fetchDatasetAnomalies("ds-1"),
    (error: unknown) =>
      error instanceof AppError && error.code === "ANALYTICS_UNAVAILABLE"
  );

  globalThis.fetch = originalFetch;
});
