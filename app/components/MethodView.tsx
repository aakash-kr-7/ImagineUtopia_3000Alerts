import {
  Braces,
  ChartNoAxesCombined,
  ExternalLink,
  FileText,
  FlaskConical,
  Network,
  Users,
} from "lucide-react";
export function MethodView() {
  return (
    <div className="method-content">
      <div className="panel method-intro">
        <span className="eyebrow">THE TRUST BOUNDARY</span>
        <h2>Correlate → map → classify → score.</h2>
        <p>
          The operational engine receives normalized alerts only. Hidden episode
          labels are unavailable to its imports and inputs. Each incident
          preserves every source alert ID.
        </p>
        <div className="method-steps">
          {[
            "Validate",
            "Deduplicate",
            "Correlate",
            "ATT&CK map",
            "Classify",
            "Score",
            "Rank",
            "Review",
          ].map((s, i) => (
            <div key={s}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <strong>{s}</strong>
            </div>
          ))}
        </div>
      </div>
      <div className="method-grid">
        {[
          {
            title: "Inspectable correlation",
            icon: Network,
            text: "Typed user, host, and IP links use per-entity time windows, inverse frequency, and temporal decay. Common hubs contribute less. Accepted links retain entity, gap, weight, and threshold.",
          },
          {
            title: "Deterministic risk",
            icon: ChartNoAxesCombined,
            text: "Severity (25), asset criticality (25), tactic progression (25), accumulation (10), spread (10), and sensitive behavior (5). The capped score is reproducible and is not a probability.",
          },
          {
            title: "Model-optional briefs",
            icon: FileText,
            text: "A structured facts packet drives the brief. Schema, counts, scores, entities, technique IDs, and citations are checked. The live demo uses deterministic templates. An optional provider adapter is included in source.",
          },
          {
            title: "Fair measurement",
            icon: FlaskConical,
            text: "Severity-only rows, host/time buckets, typed entity/time buckets, and the proposed graph share one metric implementation. Episode recall and pairwise grouping quality answer different questions.",
          },
          {
            title: "Human decisions",
            icon: Users,
            text: "An analyst records status and a reason. Optimistic versions protect concurrent edits; idempotency prevents duplicate writes. SHA-256 chains provide tamper evidence, with a trusted-head assumption.",
          },
          {
            title: "Reproducible deployment",
            icon: Braces,
            text: "React + TypeScript with a shared server engine, SQLite locally and D1 on the hosted demo. A FastAPI/Pydantic adapter exposes the same engine for local Python integration; no parallel scoring implementation.",
          },
        ].map((c) => (
          <div className="panel method-card" key={c.title}>
            <c.icon size={23} />
            <h3>{c.title}</h3>
            <p>{c.text}</p>
          </div>
        ))}
      </div>
      <div className="panel limits-panel">
        <h2>Scope & evidence</h2>
        <p>
          A research prototype for analyst triage. It does not replace SIEM or
          XDR, execute response actions, establish regulatory compliance, or
          prove reduced breach impact. Public AIT-ADS data has an adapter in the
          source package; external ingestion has been checked on a
          checksum-verified stratified AIT-ADS sample; gold attack accuracy is
          not established.
        </p>
        <div className="resource-links">
          <a href="https://attack.mitre.org/" target="_blank" rel="noreferrer">
            MITRE ATT&CK <ExternalLink size={14} />
          </a>
          <a
            href="https://learn.microsoft.com/en-us/azure/sentinel/scheduled-rules-overview"
            target="_blank"
            rel="noreferrer"
          >
            Sentinel grouping concepts <ExternalLink size={14} />
          </a>
          <a href="/benchmark-report.json" target="_blank">
            Measured benchmark artifact <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
