import { useState, type FormEvent } from "react";
import {
  requestBusinessAnalysis,
  requestBusinessReport,
} from "../api/businessAnalysis";
import { formatAiServiceError } from "../lib/aiServiceErrors";
import { formatQueryResult } from "../lib/formatQueryResult";
import type {
  BusinessAnalysisResponse,
  BusinessReportResponse,
} from "../types/businessAnalysis";
import {
  AnalyticsDashboardSection,
  DashboardLoadingState,
} from "./AnalyticsDashboardSection";

type AiBusinessAnalystSectionProps = {
  datasetId: string;
  disabled?: boolean;
  embedded?: boolean;
};

function formatSimilarity(value: number): string {
  return value.toFixed(2);
}

function DataUsedPanel({ dataUsed }: { dataUsed: BusinessAnalysisResponse["dataUsed"] }) {
  const hasRag = dataUsed.ragSources.length > 0;
  const hasAnomalies = dataUsed.anomalies !== null;
  const hasForecast = dataUsed.forecast !== null;

  return (
    <details className="ask-ai-sql-details business-analyst-data-used">
      <summary>How this was calculated</summary>
      <div className="business-analyst-data-used-body">
        <details className="business-analyst-data-subsection">
          <summary>SQL query</summary>
          <p className="muted business-analyst-data-hint">
            Pipeline answer: {dataUsed.sql.answer}
          </p>
          <pre className="ask-ai-code">{dataUsed.sql.sql}</pre>
          <p className="muted business-analyst-data-hint">
            Rows returned: {dataUsed.sql.totalRowCount}
            {dataUsed.sql.totalRowCount > dataUsed.sql.result.length
              ? ` (showing first ${dataUsed.sql.result.length})`
              : ""}
          </p>
          <pre className="ask-ai-code">{formatQueryResult(dataUsed.sql.result)}</pre>
        </details>

        {hasRag ? (
          <details className="business-analyst-data-subsection">
            <summary>Sources used</summary>
            <ul className="rag-sources-list">
              {dataUsed.ragSources.map((source, index) => (
                <li
                  key={`${source.documentTitle}-${index}`}
                  className="rag-source-item"
                >
                  <p className="rag-source-meta">
                    <strong>{source.documentTitle}</strong>
                    <span className="muted">
                      Similarity: {formatSimilarity(source.similarity)}
                    </span>
                  </p>
                  <p className="rag-source-content">{source.content}</p>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        {hasForecast && dataUsed.forecast ? (
          <details className="business-analyst-data-subsection">
            <summary>Forecast data</summary>
            <p className="muted business-analyst-data-hint">
              {dataUsed.forecast.days}-day horizon for dataset{" "}
              {dataUsed.forecast.dataset_id}
            </p>
            <pre className="ask-ai-code">
              {JSON.stringify(dataUsed.forecast.predictions, null, 2)}
            </pre>
          </details>
        ) : null}

        {hasAnomalies && dataUsed.anomalies ? (
          <details className="business-analyst-data-subsection">
            <summary>Anomaly data</summary>
            <p className="muted business-analyst-data-hint">
              {dataUsed.anomalies.anomaly_count} anomalies in{" "}
              {dataUsed.anomalies.value_column} ({dataUsed.anomalies.date_column})
            </p>
            <pre className="ask-ai-code">
              {JSON.stringify(
                dataUsed.anomalies.points.filter((point) => point.is_anomaly),
                null,
                2
              )}
            </pre>
          </details>
        ) : null}

        {!hasRag && !hasForecast && !hasAnomalies ? (
          <p className="muted dashboard-status-empty">
            Only SQL data was included for this question. Mention forecasts,
            anomalies, or company documents in your question to pull in more
            context.
          </p>
        ) : null}
      </div>
    </details>
  );
}

function BusinessReportPanel({ report }: { report: BusinessReportResponse }) {
  return (
    <div className="business-report">
      {report.sections.map((section) => (
        <article key={section.id} className="business-report-section">
          <h3 className="business-report-section-title">{section.title}</h3>
          <p className="business-report-section-body whitespace-pre-wrap">
            {section.body}
          </p>
        </article>
      ))}
    </div>
  );
}

function BusinessAnalysisPanel({
  datasetId,
  disabled = false,
}: {
  datasetId: string;
  disabled?: boolean;
}) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<BusinessAnalysisResponse | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [report, setReport] = useState<BusinessReportResponse | null>(null);

  const busy = loading || reportLoading || disabled;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = question.trim();
    if (!trimmed || busy) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await requestBusinessAnalysis(datasetId, trimmed);
      setResponse(result);
    } catch (err) {
      setResponse(null);
      setError(
        formatAiServiceError(err, "Failed to generate business analysis")
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateReport() {
    if (busy) {
      return;
    }

    setReportLoading(true);
    setReportError(null);

    try {
      const result = await requestBusinessReport(datasetId);
      setReport(result);
    } catch (err) {
      setReport(null);
      setReportError(
        formatAiServiceError(err, "Failed to generate business report")
      );
    } finally {
      setReportLoading(false);
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
            placeholder="What drove revenue last quarter, and are there any unusual spikes?"
            rows={3}
            disabled={busy}
          />
        </label>
        <div className="insights-form-actions">
          <button type="submit" disabled={busy || !question.trim()}>
            {loading ? "Analyzing…" : "Analyze"}
          </button>
          <button
            type="button"
            className="button-secondary"
            disabled={busy}
            onClick={() => void handleGenerateReport()}
          >
            {reportLoading ? "Generating…" : "Generate report"}
          </button>
        </div>
      </form>

      {loading ? (
        <DashboardLoadingState message="Gathering data and writing your business analysis…" />
      ) : null}

      {reportLoading ? (
        <DashboardLoadingState message="Collecting dataset context and writing your business report…" />
      ) : null}

      {error ? (
        <p className="error-banner ask-ai-error" role="alert">
          {error}
        </p>
      ) : null}

      {reportError ? (
        <p className="error-banner ask-ai-error" role="alert">
          {reportError}
        </p>
      ) : null}

      {report && !reportLoading ? (
        <div className="ask-ai-response business-report-output">
          <h3 className="ask-ai-block-title">Business report</h3>
          <BusinessReportPanel report={report} />
        </div>
      ) : null}

      {response && !loading ? (
        <div className="ask-ai-response">
          <div className="ask-ai-block ask-ai-answer-block">
            <h3 className="ask-ai-block-title">Analysis</h3>
            <p className="ask-ai-block-body ask-ai-answer whitespace-pre-wrap">
              {response.analysis}
            </p>
          </div>

          <DataUsedPanel dataUsed={response.dataUsed} />
        </div>
      ) : null}
    </>
  );
}

export function AiBusinessAnalystSection({
  datasetId,
  disabled = false,
  embedded = false,
}: AiBusinessAnalystSectionProps) {
  if (embedded) {
    return <BusinessAnalysisPanel datasetId={datasetId} disabled={disabled} />;
  }

  return (
    <AnalyticsDashboardSection
      id="ai-business-analyst-heading"
      title="AI Business Analyst"
    >
      <p className="muted ask-ai-hint">
        Ask a business question about the selected dataset. The analyst combines
        SQL insights, documents, and optional forecast or anomaly data.
      </p>
      <BusinessAnalysisPanel datasetId={datasetId} disabled={disabled} />
    </AnalyticsDashboardSection>
  );
}
