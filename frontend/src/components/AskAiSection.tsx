import { useState, type FormEvent } from "react";
import { ApiError } from "../api/client";
import { askDatasetAi } from "../api/datasets";
import type { DatasetAiQueryResponse } from "../types/dataset";
import { formatQueryResult } from "../lib/formatQueryResult";
import {
  AnalyticsDashboardSection,
  DashboardLoadingState,
} from "./AnalyticsDashboardSection";

type AskAiSectionProps = {
  datasetId: string;
  disabled?: boolean;
  embedded?: boolean;
};

function AskAiPanel({
  datasetId,
  disabled = false,
}: {
  datasetId: string;
  disabled?: boolean;
}) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<DatasetAiQueryResponse | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = question.trim();
    if (!trimmed || loading || disabled) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await askDatasetAi(datasetId, trimmed);
      setResponse(result);
    } catch (err) {
      setResponse(null);
      setError(
        err instanceof ApiError ? err.message : "Failed to get an AI answer"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form
        className="ask-ai-form ask-ai-form--stacked"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <label className="ask-ai-label">
          <span className="sr-only">Your question</span>
          <textarea
            className="ask-ai-textarea"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="What was our total revenue?"
            rows={3}
            disabled={loading || disabled}
          />
        </label>
        <div className="insights-form-actions">
          <button type="submit" disabled={loading || disabled || !question.trim()}>
            {loading ? "Working…" : "Get answer"}
          </button>
        </div>
      </form>

      {loading ? (
        <DashboardLoadingState message="Generating SQL and preparing your answer…" />
      ) : null}

      {error ? (
        <p className="error-banner ask-ai-error" role="alert">
          {error}
        </p>
      ) : null}

      {response && !loading ? (
        <div className="ask-ai-response">
          <div className="ask-ai-block ask-ai-answer-block">
            <h3 className="ask-ai-block-title">Answer</h3>
            <p className="ask-ai-block-body ask-ai-answer">{response.answer}</p>
          </div>

          <details className="ask-ai-sql-details">
            <summary>How this was calculated</summary>
            <p className="muted business-analyst-data-hint">Generated SQL</p>
            <pre className="ask-ai-code">{response.sql}</pre>
            <p className="muted business-analyst-data-hint">Query result</p>
            <pre className="ask-ai-code">{formatQueryResult(response.result)}</pre>
          </details>
        </div>
      ) : null}
    </>
  );
}

export function AskAiSection({
  datasetId,
  disabled = false,
  embedded = false,
}: AskAiSectionProps) {
  if (embedded) {
    return <AskAiPanel datasetId={datasetId} disabled={disabled} />;
  }

  return (
    <AnalyticsDashboardSection id="ask-ai-heading" title="Ask AI">
      <p className="muted ask-ai-hint">
        Ask a question about the selected dataset in plain language.
      </p>
      <AskAiPanel datasetId={datasetId} disabled={disabled} />
    </AnalyticsDashboardSection>
  );
}
