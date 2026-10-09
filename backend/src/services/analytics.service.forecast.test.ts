import assert from "node:assert/strict";
import test from "node:test";

const predictPayload = {
  dataset_id: "ds-1",
  days: 7,
  predictions: [{ date: "2024-01-08T00:00:00", value: 42 }],
};

const trainPayload = {
  dataset_id: "ds-1",
  model_path: "models/forecast_ds-1.joblib",
  row_count_after_drop: 10,
  train_row_count: 8,
  test_row_count: 2,
  test_mae: 1.5,
  feature_columns: ["lag_1"],
};

test("postForecastPredict trains then retries when forecast model is missing", async () => {
  const originalFetch = globalThis.fetch;
  let predictCalls = 0;

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url.endsWith("/forecast/train") && method === "POST") {
      return new Response(JSON.stringify(trainPayload), { status: 200 });
    }

    if (url.endsWith("/forecast") && method === "POST") {
      predictCalls += 1;
      if (predictCalls === 1) {
        return new Response(
          JSON.stringify({
            detail: "Forecast model not found for dataset; train the model first",
          }),
          { status: 404 }
        );
      }
      return new Response(JSON.stringify(predictPayload), { status: 200 });
    }

    throw new Error(`Unexpected fetch: ${method} ${url}`);
  };

  process.env.ANALYTICS_SERVICE_URL = "http://analytics.test";
  const { postForecastPredict } = await import("./analytics.service.js");

  const result = await postForecastPredict("ds-1", 7);
  assert.equal(predictCalls, 2);
  assert.equal(result.predictions.length, 1);

  globalThis.fetch = originalFetch;
});
