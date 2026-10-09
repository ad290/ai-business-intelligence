import { useEffect, useState } from "react";
import { AiBusinessAnalystSection } from "./AiBusinessAnalystSection";
import { AskAiSection } from "./AskAiSection";
import { AskKnowledgeBaseSection } from "./AskKnowledgeBaseSection";

export type InsightsMode = "analysis" | "quick" | "docs";

type InsightsHubSectionProps = {
  datasetId: string;
  analyticsReady: boolean;
  datasetName?: string;
};

const MODE_HINTS: Record<InsightsMode, string> = {
  analysis:
    "Combines your dataset with documents, forecasts, and anomalies when relevant.",
  quick: "Get a direct answer from your dataset.",
  docs: "Search answers from documents you upload on the Documents page.",
};

export function InsightsHubSection({
  datasetId,
  analyticsReady,
  datasetName,
}: InsightsHubSectionProps) {
  const [mode, setMode] = useState<InsightsMode>(
    analyticsReady ? "analysis" : "docs"
  );

  useEffect(() => {
    if (!datasetId) {
      setMode("docs");
      return;
    }

    if (analyticsReady) {
      setMode("analysis");
    }
  }, [datasetId, analyticsReady]);

  function selectMode(next: InsightsMode) {
    if ((next === "analysis" || next === "quick") && !analyticsReady) {
      return;
    }
    setMode(next);
  }

  return (
    <aside
      className="insights-hub page-card"
      aria-labelledby="insights-hub-heading"
    >
      <h2 id="insights-hub-heading" className="insights-hub-title">
        Insights &amp; AI
      </h2>

      <div className="insights-tabs" role="tablist" aria-label="Insights mode">
        <button
          type="button"
          role="tab"
          className="insights-tab"
          aria-selected={mode === "analysis"}
          disabled={!analyticsReady}
          onClick={() => selectMode("analysis")}
        >
          Business Analysis
        </button>
        <button
          type="button"
          role="tab"
          className="insights-tab"
          aria-selected={mode === "quick"}
          disabled={!analyticsReady}
          onClick={() => selectMode("quick")}
        >
          Quick Numbers
        </button>
        <button
          type="button"
          role="tab"
          className="insights-tab"
          aria-selected={mode === "docs"}
          onClick={() => selectMode("docs")}
        >
          Company Docs
        </button>
      </div>

      {analyticsReady && datasetName ? (
        <p className="insights-context-chip">
          Dataset: <strong>{datasetName}</strong>
        </p>
      ) : null}

      {!analyticsReady && mode !== "docs" ? (
        <p className="muted insights-mode-hint">
          Select a dataset to use Business Analysis or Quick Numbers.
        </p>
      ) : (
        <p className="muted insights-mode-hint">{MODE_HINTS[mode]}</p>
      )}

      <div className="insights-tab-panel" role="tabpanel">
        {mode === "docs" ? <AskKnowledgeBaseSection embedded /> : null}
        {mode === "quick" && analyticsReady ? (
          <AskAiSection
            key={`quick-${datasetId}`}
            embedded
            datasetId={datasetId}
          />
        ) : null}
        {mode === "analysis" && analyticsReady ? (
          <AiBusinessAnalystSection
            key={`analysis-${datasetId}`}
            embedded
            datasetId={datasetId}
          />
        ) : null}
      </div>
    </aside>
  );
}
