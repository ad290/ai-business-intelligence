const EMBED_DIMENSION = 384;

function mockEmbedding(): number[] {
  return Array.from({ length: EMBED_DIMENSION }, (_, index) => (index + 1) * 0.001);
}

function datasetIdFromPath(pathname: string): string | null {
  const match = /^\/datasets\/([^/]+)/.exec(pathname);
  return match?.[1] ?? null;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Stubs analytics-service and OpenRouter HTTP calls for API tests. */
export function installExternalServiceFetchMock(): () => void {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input, init) => {
    const url = String(input);

    if (url.includes("openrouter.ai")) {
      return jsonResponse({
        choices: [{ message: { content: "Mock LLM response for API tests." } }],
      });
    }

    let pathname: string;
    try {
      pathname = new URL(url).pathname;
    } catch {
      return originalFetch(input, init);
    }

    if (pathname === "/ai/embed") {
      return jsonResponse({
        embedding: mockEmbedding(),
        dimension: EMBED_DIMENSION,
      });
    }

    if (pathname === "/ai/query") {
      const body =
        typeof init?.body === "string" ? JSON.parse(init.body) : {};
      const datasetId = body.datasetId ?? "unknown";
      const question = body.question ?? "";
      return jsonResponse({
        datasetId,
        question,
        sql: "SELECT 1",
        result: [{ total: 30 }],
        answer: "Mock SQL answer",
      });
    }

    const datasetId = datasetIdFromPath(pathname);
    if (datasetId === null) {
      return originalFetch(input, init);
    }

    if (pathname.endsWith("/anomalies")) {
      return jsonResponse({
        dataset_id: datasetId,
        date_column: "date",
        value_column: "sales",
        row_count: 2,
        anomaly_count: 1,
        points: [
          { date: "2024-01-01T00:00:00", value: 10, is_anomaly: false },
          { date: "2024-01-02T00:00:00", value: 500, is_anomaly: true },
        ],
      });
    }

    if (pathname.endsWith("/forecast/prepare")) {
      return jsonResponse({
        dataset_id: datasetId,
        date_column: "date",
        value_column: "sales",
        aggregated_row_count: 2,
        features: [],
      });
    }

    if (pathname.endsWith("/forecast/train")) {
      return jsonResponse({
        dataset_id: datasetId,
        model_path: "/tmp/mock-model",
        row_count_after_drop: 2,
        train_row_count: 2,
        test_row_count: 0,
        test_mae: 0,
        feature_columns: ["sales"],
      });
    }

    if (pathname.endsWith("/forecast")) {
      const body =
        typeof init?.body === "string" ? JSON.parse(init.body) : {};
      const days = typeof body.days === "number" ? body.days : 30;
      return jsonResponse({
        dataset_id: datasetId,
        days,
        predictions: [{ date: "2024-02-01", value: 42 }],
      });
    }

    if (pathname === `/datasets/${datasetId}`) {
      return jsonResponse({
        dataset_id: datasetId,
        original_row_count: 2,
        cleaned_row_count: 2,
        columns: ["date", "sales"],
        detected_data_types: { date: "datetime", sales: "numeric" },
        statistics: {},
        head: [],
        rows: [],
      });
    }

    return originalFetch(input, init);
  };

  return () => {
    globalThis.fetch = originalFetch;
  };
}
