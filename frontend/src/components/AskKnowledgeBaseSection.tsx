import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import { askKnowledgeBase } from "../api/rag";
import type { RagResponse } from "../types/rag";
import {
  AnalyticsDashboardSection,
  DashboardLoadingState,
} from "./AnalyticsDashboardSection";

function formatSimilarity(value: number): string {
  return value.toFixed(2);
}

function CompanyDocsPanel() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<RagResponse | null>(null);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = question.trim();
    if (!trimmed || loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await askKnowledgeBase(trimmed);
      setResponse(result);
    } catch (err) {
      setResponse(null);
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to get a knowledge base answer"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section
        className="company-docs-block"
        aria-labelledby="search-policy-heading"
      >
        <h3 id="search-policy-heading" className="company-docs-block-title">
          Ask your documents
        </h3>

        <form
          className="ask-ai-form ask-ai-form--stacked"
          onSubmit={(event) => void handleSearch(event)}
        >
          <label className="ask-ai-label">
            <span className="sr-only">Your question</span>
            <textarea
              className="ask-ai-textarea"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="How long do I have to return a product?"
              rows={3}
              disabled={loading}
            />
          </label>
          <div className="insights-form-actions">
            <button type="submit" disabled={loading || !question.trim()}>
              {loading ? "Searching…" : "Search documents"}
            </button>
          </div>
        </form>

        {loading ? (
          <DashboardLoadingState message="Searching documents and generating an answer…" />
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
              <summary>Sources used</summary>
              {response.sources.length === 0 ? (
                <p className="muted ask-ai-block-body">
                  No matching document chunks. Upload documents on the{" "}
                  <Link to="/documents">documents page</Link>.
                </p>
              ) : (
                <ul className="rag-sources-list">
                  {response.sources.map((source, index) => (
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
              )}
            </details>
          </div>
        ) : null}
      </section>
    </>
  );
}

type AskKnowledgeBaseSectionProps = {
  embedded?: boolean;
};

export function AskKnowledgeBaseSection({
  embedded = false,
}: AskKnowledgeBaseSectionProps) {
  if (embedded) {
    return <CompanyDocsPanel />;
  }

  return (
    <AnalyticsDashboardSection
      id="ask-knowledge-base-heading"
      title="Ask Knowledge Base"
    >
      <p className="muted ask-ai-hint">
        Ask questions about policies and knowledge stored in your company
        documents.
      </p>
      <CompanyDocsPanel />
    </AnalyticsDashboardSection>
  );
}
