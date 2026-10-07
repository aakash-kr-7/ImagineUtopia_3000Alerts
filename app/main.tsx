import {
  Activity,
  Braces,
  ChartNoAxesCombined,
  Check,
  CheckCheck,
  ChevronRight,
  ChevronsUpDown,
  Clock,
  Database,
  Download,
  ExternalLink,
  FileText,
  FlaskConical,
  Info,
  Layers,
  LayoutList,
  LoaderCircle,
  Menu,
  Network,
  Play,
  ScrollText,
  Search,
  Server,
  ShieldCheck,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Alert, AlertGroup, Incident } from "../core/contracts";
import { AlertsView } from "./components/AlertsView";
import { AuditView } from "./components/AuditView";
import { Badge } from "./components/Badge";
import { BenchmarkLab } from "./components/BenchmarkLab";
import { CorrelationGraph } from "./components/CorrelationGraph";
import { EvaluationView } from "./components/EvaluationView";
import { MethodView } from "./components/MethodView";
import { DocumentView, ReportImport } from "./components/ReportImport";
import { SimulationForm } from "./components/SimulationForm";
import { SimulationQuality } from "./components/SimulationQuality";
import { SimulationTheater } from "./components/SimulationTheater";
import { Stat } from "./components/Stat";
import { TruthSourceView } from "./components/TruthSourceView";
import { api, fmt, pct, short, time } from "./lib/api";
import "./styles.css";

type View =
  | "queue"
  | "alerts"
  | "evaluation"
  | "simulation"
  | "audit"
  | "method"
  | "import"
  | "benchmarks"
  | "truth"
  | "briefing";
const nav = [
  { id: "briefing", label: "Demo home", icon: Activity },
  { id: "queue", label: "Incident groups", icon: LayoutList },
  { id: "alerts", label: "Alert replay", icon: Activity },
  { id: "import", label: "Import data", icon: FileText },
  { id: "evaluation", label: "Run results", icon: ChartNoAxesCombined },
  { id: "truth", label: "Source ledger", icon: Database },
  { id: "benchmarks", label: "Benchmark study", icon: FlaskConical },
  { id: "simulation", label: "Simulation design", icon: FlaskConical },
  { id: "audit", label: "Decision history", icon: ScrollText },
] as const;
const primaryNav = nav.filter((item) =>
  ["briefing", "queue", "alerts", "import"].includes(item.id),
);
const reviewNav = nav.filter((item) =>
  ["evaluation", "truth", "benchmarks", "simulation", "audit"].includes(
    item.id,
  ),
);

function App() {
  const [view, setView] = useState<View>("briefing"),
    [runs, setRuns] = useState<any[]>([]),
    [runId, setRunId] = useState(""),
    [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [simulationProgress, setSimulationProgress] = useState(0),
    [q, setQ] = useState(""),
    [tier, setTier] = useState("all"),
    [status, setStatus] = useState("all"),
    [simOpen, setSimOpen] = useState(false),
    [detail, setDetail] = useState<any>(null),
    [aiOverview, setAiOverview] = useState<any>(null),
    [aiOverviewBusy, setAiOverviewBusy] = useState(false),
    [aiOverviewConsent, setAiOverviewConsent] = useState(false),
    [tab, setTab] = useState("overview"),
    [action, setAction] = useState(""),
    [reason, setReason] = useState(""),
    [toast, setToast] = useState(""),
    [mobileNav, setMobileNav] = useState(false);
  const [focusAlert, setFocusAlert] = useState<{
    id: string;
    token: number;
  } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null),
    simDialog = useRef<HTMLDialogElement>(null),
    actionDialog = useRef<HTMLDialogElement>(null),
    detailAbort = useRef<AbortController | null>(null);
  const notify = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(""), 5000);
  };
  async function bootstrap() {
    try {
      const b = await api("bootstrap");
      setRuns(b.runs);
      setRunId(b.runs[0]?.id ?? "");
      setView("briefing");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void bootstrap();
  }, []);
  useEffect(() => {
    if (!runId) return;
    let live = true;
    setData(null);
    api("runs/" + runId)
      .then((d) => {
        if (live) {
          setData(d);
          setError("");
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [runId]);
  async function openIncident(id: string) {
    detailAbort.current?.abort();
    const controller = new AbortController();
    detailAbort.current = controller;
    try {
      const d = await api(`runs/${runId}/incidents/${id}`, {
        signal: controller.signal,
      });
      setDetail(d);
      setAiOverview(null);
      setAiOverviewConsent(false);
      setTab("overview");
      dialog.current?.showModal();
    } catch (e) {
      if ((e as Error).name !== "AbortError") notify((e as Error).message);
    }
  }
  function closeDetail() {
    dialog.current?.close();
    setDetail(null);
  }
  async function generateAiOverview() {
    if (!detail?.ai_overview_enabled || !aiOverviewConsent) return;
    setAiOverviewBusy(true);
    try {
      const result = await api(
        `runs/${runId}/incidents/${detail.incident.id}/overview`,
        { method: "POST", body: "{}" },
      );
      setAiOverview(result.brief);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setAiOverviewBusy(false);
    }
  }
  async function simulate(config: any) {
    setBusy(true);
    setSimOpen(false);
    simDialog.current?.close();
    setView("simulation");
    setSimulationProgress(0);
    setError("");
    const started = Date.now();
    const progressTimer = window.setInterval(
      () => setSimulationProgress((current) => Math.min(3, current + 1)),
      400,
    );
    try {
      const r = await api("runs", {
        method: "POST",
        body: JSON.stringify(config),
      });
      await new Promise((resolve) =>
        window.setTimeout(resolve, Math.max(0, 1500 - (Date.now() - started))),
      );
      window.clearInterval(progressTimer);
      setSimulationProgress(4);
      setRuns((p) => [r, ...p]);
      setRunId(r.id);
      setSimOpen(false);
      simDialog.current?.close();
      setView("queue");
      closeDetail();
      notify(`Run ready · ${fmt(r.count)} alerts in the saved replay`);
    } catch (e) {
      setError((e as Error).message);
      setView("simulation");
    } finally {
      window.clearInterval(progressTimer);
      setBusy(false);
      setSimulationProgress(0);
    }
  }
  async function saveAction() {
    if (!detail) return;
    setBusy(true);
    try {
      await api(`runs/${runId}/actions`, {
        method: "POST",
        body: JSON.stringify({
          incident_id: detail.incident.id,
          disposition: action,
          reason,
          expected_version: detail.incident.version,
          idempotency_key: crypto.randomUUID(),
        }),
      });
      const [d, r] = await Promise.all([
        api(`runs/${runId}/incidents/${detail.incident.id}`),
        api(`runs/${runId}`),
      ]);
      setDetail(d);
      setData(r);
      setAction("");
      actionDialog.current?.close();
      setReason("");
      notify("Decision saved · audit record appended");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (simOpen) simDialog.current?.showModal();
  }, [simOpen]);
  useEffect(() => {
    if (action) actionDialog.current?.showModal();
  }, [action]);
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    for (const tool of [
      {
        name: "read_incident_queue",
        description:
          "Read the currently selected run and its ranked incidents.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: async () => ({
          run_id: runId,
          incidents: data?.incidents?.slice(0, 25) ?? [],
        }),
      },
      {
        name: "open_incident",
        description:
          "Open an incident investigation. Does not change its disposition.",
        inputSchema: {
          type: "object",
          properties: { incident_id: { type: "string" } },
          required: ["incident_id"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: async (input: any) => {
          if (
            !input ||
            Object.keys(input).length !== 1 ||
            !data?.incidents.some((i: Incident) => i.id === input.incident_id)
          )
            throw new Error("Valid incident_id required");
          await openIncident(input.incident_id);
          return { opened: input.incident_id };
        },
      },
    ]) {
      try {
        Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    }
    return () => lifecycle.abort();
  }, [runId, data]);
  const incidents: Incident[] = data?.incidents ?? [];
  const filtered = incidents.filter(
    (i) =>
      (tier === "all" || i.tier === tier) &&
      (status === "all" || i.disposition === status) &&
      (!q ||
        [i.id, i.title, ...i.entities]
          .join(" ")
          .toLowerCase()
          .includes(q.toLowerCase())),
  );
  const selectedRun = runs.find((r) => r.id === runId);
  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <aside className={"sidebar " + (mobileNav ? "mobile-open" : "")}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("briefing");
          }}
        >
          <div className="brand-mark">
            <img src="/favicon.svg" alt="" />
          </div>
          <span className="brand-name">
            Utopia Signal
            <span className="brand-sub">TEAM 239 · SOC WORKBENCH</span>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-icon">239</span>
          <div>
            Aster Financial<small>Fictional simulation environment</small>
          </div>
          <ChevronsUpDown size={14} />
        </div>
        <div className="nav-label">DEMO</div>
        <nav aria-label="Primary navigation">
          {primaryNav.map((n) => (
            <button
              key={n.id}
              className={"nav-item " + (view === n.id ? "active" : "")}
              onClick={() => {
                setView(n.id);
                setMobileNav(false);
                setQ("");
              }}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {n.id === "queue" && data && (
                <span className="nav-count">
                  {data.stats.critical + data.stats.high}
                </span>
              )}
            </button>
          ))}
          <details className="nav-more">
            <summary>Review &amp; research</summary>
            <div>
              {reviewNav.map((n) => (
                <button
                  key={n.id}
                  className={"nav-item " + (view === n.id ? "active" : "")}
                  onClick={() => {
                    setView(n.id);
                    setMobileNav(false);
                    setQ("");
                  }}
                >
                  <n.icon size={18} />
                  <span>{n.label}</span>
                </button>
              ))}
            </div>
          </details>
        </nav>
        <div className="nav-bottom">
          <button
            className={"nav-item " + (view === "method" ? "active" : "")}
            onClick={() => setView("method")}
          >
            <Braces size={18} />
            How it works
          </button>
          <div className="boundary-card">
            <ShieldCheck size={19} />
            <strong>Analyst in control</strong>
            <p>
              Evidence guides decisions.
              <br />
              No autonomous response.
            </p>
          </div>
          <div className="profile">
            <div className="avatar">IU</div>
            <div>
              Utopia Signal<small>Team 239</small>
            </div>
            <Badge tier="research" />
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              aria-label="Toggle navigation"
              aria-expanded={mobileNav}
              onClick={() => setMobileNav(!mobileNav)}
            >
              <Menu size={22} />
            </button>
            <span>Team 239</span>
            <ChevronRight size={14} />
            <strong>
              {nav.find((n) => n.id === view)?.label ?? "How it works"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="prototype-label">EVIDENCE WORKBENCH</span>
            <div className="top-divider" />
            <span className="top-time">UTC</span>
            <div className="avatar small">IU</div>
          </div>
        </header>
        <main id="main">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {view === "briefing"
                  ? "START HERE · TEAM 239"
                  : view === "queue"
                    ? "TRIAGE WORKSPACE"
                    : view === "evaluation"
                      ? "MEASURED, NOT CLAIMED"
                      : view === "simulation"
                        ? "CONTROLLED TEST ENVIRONMENT"
                        : "SECURITY OPERATIONS"}
              </div>
              <h1>
                {view === "briefing"
                  ? "Utopia Signal"
                  : view === "truth"
                    ? "Simulation source ledger"
                    : data?.document && view === "queue"
                      ? "Document assessment"
                      : view === "import"
                        ? "Import data"
                        : view === "benchmarks"
                          ? "Benchmark lab"
                          : view === "queue"
                            ? "Incident groups"
                            : view === "alerts"
                              ? "Alert replay"
                              : view === "evaluation"
                                ? "Run results"
                                : view === "simulation"
                                  ? "Simulation design"
                                  : view === "audit"
                                    ? "Audit trail"
                                    : "Transparent by design"}
              </h1>
              <p>
                {view === "briefing"
                  ? "Turn a busy alert stream into a short, explainable incident queue."
                  : view === "truth"
                    ? "Check what generated each simulated alert after the incident groups are ready."
                    : view === "import"
                      ? "Preview a supported security export, then see how its alerts group into incidents."
                      : view === "benchmarks"
                        ? "Compare the current run with fixed, repeatable baselines."
                        : view === "queue"
                          ? "See the incident groups that bring related alerts together."
                          : view === "alerts"
                            ? "Replay saved alerts in timestamp order and inspect any alert’s incident."
                            : view === "evaluation"
                              ? "See episode coverage and review effort for this simulation."
                              : view === "simulation"
                                ? "Choose the alert volume, timing, and fictional activity for a demo run."
                                : view === "audit"
                                  ? "Review analyst decisions and their recorded reasons."
                                  : "Inspect the logic behind every group and risk score."}
              </p>
            </div>
            <div className="heading-actions">
              {view === "briefing" && (
                <button
                  className="button secondary"
                  onClick={() => setView("import")}
                >
                  <FileText size={16} />
                  Review CSV / Excel
                </button>
              )}
              {data && (
                <a
                  className="button secondary"
                  href={`/api/runs/${runId}/export`}
                  download
                >
                  <Download size={16} />
                  JSON
                </a>
              )}{" "}
              {data && !data.document && (
                <a
                  className="button secondary"
                  href={`/api/runs/${runId}/export?format=html`}
                  download
                >
                  Report
                </a>
              )}{" "}
              {data && !data.document && (
                <a
                  className="button secondary"
                  href={`/api/runs/${runId}/export?format=csv`}
                  download
                >
                  CSV
                </a>
              )}
              <button
                className="button primary"
                onClick={() => setSimOpen(true)}
              >
                <Play size={16} />
                Run simulation
              </button>
            </div>
          </div>
          {runId && view !== "briefing" && (
            <div className="run-bar">
              <div className="run-badge">
                <Database size={14} />
                <span>
                  {selectedRun?.seed == null
                    ? "Imported batch"
                    : `Seed ${selectedRun?.seed ?? 239}`}
                </span>
              </div>
              <select
                aria-label="Select simulation run"
                value={runId}
                onChange={(e) => {
                  setRunId(e.target.value);
                  closeDetail();
                }}
              >
                {runs.map((r) => (
                  <option value={r.id} key={r.id}>
                    {r.manifest?.kind === "document"
                      ? r.manifest.filename
                      : r.id}{" "}
                    ·{" "}
                    {r.manifest?.kind === "document"
                      ? "document"
                      : `${fmt(r.count)} alerts`}
                  </option>
                ))}
              </select>
              <button
                className="button small secondary"
                onClick={async () => {
                  if (
                    !confirm(
                      "Delete this analysis and its evidence from this workspace?",
                    )
                  )
                    return;
                  try {
                    await api(`runs/${runId}`, { method: "DELETE" });
                    setRuns((p) => p.filter((r) => r.id !== runId));
                    setRunId(runs.find((r) => r.id !== runId)?.id ?? "");
                    setData(null);
                    notify("Analysis deleted");
                  } catch (e) {
                    notify((e as Error).message);
                  }
                }}
              >
                Delete analysis
              </button>
              <span className="run-meta">
                {data
                  ? data.document
                    ? `${data.document.findings.length} cited passages`
                    : `${fmt(data.stats.alerts)} accepted · ${selectedRun?.manifest?.import_report?.rejected ?? 0} source rows rejected`
                  : "Loading run…"}
              </span>
              <span className="run-meta right">
                <CheckCheck size={14} />
                Deterministic engine v2.0
              </span>
            </div>
          )}
          {error && (
            <div role="alert" className="error-banner">
              <TriangleAlert size={18} />
              {error}
              <button
                className="button small secondary"
                onClick={() => void bootstrap()}
              >
                Retry
              </button>
            </div>
          )}
          {view === "briefing" ? (
            <section className="briefing-page">
              <div className="briefing-hero panel">
                <div className="briefing-copy">
                  <span className="eyebrow">
                    FROM ALERTS TO INCIDENT GROUPS
                  </span>
                  <h2>See the investigation take shape.</h2>
                  <p>
                    Watch individual alerts become linked incident groups,
                    understand why each group ranks, and review the evidence.
                  </p>
                  <div className="briefing-actions">
                    <button
                      className="button primary"
                      onClick={() => setSimOpen(true)}
                    >
                      <Play size={16} />
                      Start a demo
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => setView("import")}
                    >
                      <FileText size={16} />
                      Import data
                    </button>
                  </div>
                  <small>
                    Random 450–900 alerts · random 1–2 hour event window
                  </small>
                  <a
                    className="briefing-sample-link"
                    href="/examples/ait-wazuh-demo.csv"
                    download
                  >
                    Download the public Wazuh example CSV
                  </a>
                </div>
                <div className="briefing-metric">
                  <span>SYNTHETIC HOLDOUT · 3,000 ALERTS · 20 SEEDS</span>
                  <strong>80%</strong>
                  <p>
                    Simulated attack episodes visible in the first 25 ranked
                    incident groups.
                  </p>
                  <small>
                    Severity-only baseline: 16.7% · each group counts as one
                    review item; not analyst time.
                  </small>
                </div>
              </div>
              <div className="briefing-three">
                <article className="panel">
                  <span className="brief-step">THE PROBLEM</span>
                  <h3>Signals lose context.</h3>
                  <p>
                    Analysts connect activity scattered across alerts, entities,
                    and time.
                  </p>
                  <small>Source 1 · Problem relevance</small>
                </article>
                <article className="panel">
                  <span className="brief-step">THE CONTRIBUTION</span>
                  <h3>Groups have visible reasons.</h3>
                  <p>
                    Trace the related alerts, shared evidence, score, and rank.
                  </p>
                  <small>Sources 2–3 · Solution and originality</small>
                </article>
                <article className="panel">
                  <span className="brief-step">THE EVIDENCE</span>
                  <h3>80% vs 16.7% at 3k.</h3>
                  <p>
                    Synthetic benchmark across 20 fixed runs—not real SOC
                    accuracy or time saved.
                  </p>
                  <small>Source 4 · Impact and evaluation</small>
                </article>
              </div>
              <div
                className="demo-flow"
                aria-label="How the demo turns alerts into useful incident groups"
              >
                <div>
                  <span>1</span>
                  <strong>Incoming alerts</strong>
                  <small>Separate signals from security tools</small>
                </div>
                <ChevronRight aria-hidden="true" />
                <div>
                  <span>2</span>
                  <strong>Related activity</strong>
                  <small>Connect shared users, devices, and time</small>
                </div>
                <ChevronRight aria-hidden="true" />
                <div className="demo-flow-highlight">
                  <span>3</span>
                  <strong>Incident groups</strong>
                  <small>Rank the investigations worth opening</small>
                </div>
                <ChevronRight aria-hidden="true" />
                <div>
                  <span>4</span>
                  <strong>Analyst review</strong>
                  <small>See the evidence and record a decision</small>
                </div>
              </div>
              <details className="panel briefing-notes">
                <summary>
                  Judge notes · source trail · MITRE ATT&amp;CK v17.1
                </summary>
                <div className="briefing-notes-grid">
                  <div>
                    <span className="eyebrow">45-SECOND ANSWER</span>
                    <p>
                      Security teams already have alert correlation. Our
                      contribution is making triage decisions and their
                      evaluation inspectable: trace how signals become a ranked
                      incident, then measure episode coverage against the same
                      alerts and labels used by simple baselines.
                    </p>
                  </div>
                  <div>
                    <span className="eyebrow">SOURCE REPORTS</span>
                    <p>
                      1 · Why SOC Alert Triage Needs to Exist
                      <br />2 · Proposed Solution Analysis
                      <br />3 · Solution &amp; Innovation: An Honest Originality
                      Audit
                      <br />4 · Impact and Scalability
                    </p>
                    <a href="/judge-brief.md" target="_blank" rel="noreferrer">
                      Open the full judge brief ↗
                    </a>
                  </div>
                  <div>
                    <span className="eyebrow">BOUNDARY</span>
                    <p>
                      ATT&amp;CK maps observed behavior; it does not prove
                      intent. Correlation is established practice. This is a
                      synthetic research prototype, not a commercial-product
                      comparison.
                    </p>
                    <a
                      href="https://attack.mitre.org/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      MITRE ATT&amp;CK ↗
                    </a>
                  </div>
                </div>
              </details>
            </section>
          ) : view === "simulation" ? (
            <>
              {busy && (
                <div className="panel simulation-progress" role="status">
                  <span className="eyebrow">RUN PIPELINE</span>
                  <h2>
                    {
                      [
                        "Generating fictional telemetry",
                        "Applying label-independent detector rules",
                        "Grouping evidence and mapping ATT&CK",
                        "Scoring, evaluating and saving the source ledger",
                      ][Math.min(simulationProgress, 3)]
                    }
                  </h2>
                  <div className="simulation-stage-grid">
                    {[
                      "Generate events",
                      "Detect alerts",
                      "Triage & map",
                      "Evaluate & store",
                    ].map((stage, index) => (
                      <div
                        className={
                          simulationProgress >= index ? "stage-active" : ""
                        }
                        key={stage}
                      >
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <strong>{stage}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="progress-track">
                    <span
                      style={{
                        width: `${Math.min(92, 16 + simulationProgress * 22)}%`,
                      }}
                    />
                  </div>
                  <p>
                    The local engine computes this run as one batch. These
                    stages are a visual guide; the saved alerts replay in
                    timestamp order when it completes.
                  </p>
                </div>
              )}
              <SimulationQuality manifest={selectedRun?.manifest} />
              <SimulationForm
                busy={busy}
                onSubmit={simulate}
                error={error}
                expanded
              />
            </>
          ) : view === "truth" ? (
            data ? (
              <TruthSourceView runId={runId} />
            ) : (
              <div className="empty">
                Choose a completed simulation run to open its source ledger.
              </div>
            )
          ) : view === "import" ? (
            <ReportImport
              onAnalyze={async (alerts, report) => {
                const r = await api("runs", {
                  method: "POST",
                  body: JSON.stringify({ alerts, import_report: report }),
                });
                setRuns((p) => [r, ...p]);
                setRunId(r.id);
                setView("queue");
                notify("Accepted evidence analyzed");
              }}
              onSaveDocument={async (report) => {
                const {
                  filename,
                  sha256,
                  pages,
                  extracted_characters,
                  findings,
                } = report;
                const r = await api("documents", {
                  method: "POST",
                  body: JSON.stringify({
                    filename,
                    sha256,
                    pages,
                    extracted_characters,
                    findings,
                  }),
                });
                setRuns((p) => [r, ...p]);
                setRunId(r.id);
                setView("queue");
                notify("Document assessment saved");
              }}
            />
          ) : view === "benchmarks" ? (
            <BenchmarkLab />
          ) : data?.document && !["method", "simulation"].includes(view) ? (
            <DocumentView report={data.document} />
          ) : !data && !error ? (
            runId ? (
              <div className="loading-panel" role="status">
                <LoaderCircle className="spin" size={26} />
                <strong>Loading saved analysis</strong>
                <span>Retrieving run records from this workspace.</span>
              </div>
            ) : (
              <div className="panel truth-locked">
                <ShieldCheck size={18} />
                Start a simulation or import reports to create the first run.
              </div>
            )
          ) : (
            data && (
              <>
                {view === "queue" && (
                  <>
                    {selectedRun?.seed != null && (
                      <SimulationTheater
                        runId={runId}
                        onInspect={(alertId) => {
                          setFocusAlert({ id: alertId, token: Date.now() });
                          setView("alerts");
                        }}
                      />
                    )}
                    <div className="stats-grid">
                      <Stat
                        label="Incoming alerts"
                        value={fmt(data.stats.alerts)}
                        subtitle="Endpoint, identity, and network sensors"
                        icon={<Activity size={18} />}
                        spark="blue"
                      />
                      <Stat
                        label="Incident groups"
                        value={fmt(data.stats.incidents)}
                        subtitle={`${pct(1 - data.stats.incidents / data.stats.alerts)} fewer queue rows`}
                        icon={<Layers size={18} />}
                        spark="mint"
                      />
                      <Stat
                        label="High-priority groups"
                        value={fmt(data.stats.critical + data.stats.high)}
                        subtitle={`${data.stats.critical} critical · ${data.stats.high} high priority`}
                        icon={<TriangleAlert size={18} />}
                        spark="red"
                      />
                      <Stat
                        label="Analysis time"
                        value={
                          data.stats.runtime_ms < 1000
                            ? `${Math.round(data.stats.runtime_ms)}`
                            : (data.stats.runtime_ms / 1000).toFixed(2)
                        }
                        unit={data.stats.runtime_ms < 1000 ? "ms" : "s"}
                        subtitle="To group and rank this batch"
                        icon={<Clock size={18} />}
                        spark="purple"
                      />
                    </div>
                    <div className="overview-grid">
                      <div className="panel flow-panel">
                        <div className="panel-heading">
                          <h2>From signals to investigations</h2>
                          <span className="muted small-text">This batch</span>
                        </div>
                        <div className="pipeline-visual">
                          <div>
                            <Activity size={24} />
                            <strong>{fmt(data.stats.alerts)}</strong>
                            <span>Source alerts</span>
                          </div>
                          <div className="flow-line">
                            <span>COMBINE REPEATS</span>
                            <ChevronRight size={17} />
                          </div>
                          <div>
                            <Layers size={24} />
                            <strong>{fmt(data.stats.groups)}</strong>
                            <span title="Repeat notifications for the same signal are combined">
                              Unique alert signals
                            </span>
                          </div>
                          <div className="flow-line">
                            <span>LINK EVIDENCE</span>
                            <ChevronRight size={17} />
                          </div>
                          <div className="flow-final">
                            <Network size={24} />
                            <strong>{fmt(data.stats.incidents)}</strong>
                            <span title="Analyst-sized investigations ranked by score">
                              Incident groups to review
                            </span>
                          </div>
                        </div>
                        <div className="flow-note">
                          <Info size={14} />
                          <span>
                            Queue compression is measured. Time savings require
                            analyst testing.
                          </span>
                        </div>
                      </div>
                      <div className="panel source-panel">
                        <div className="panel-heading">
                          <h2>Signal sources</h2>
                          <span className="muted small-text">
                            3 connected schemas
                          </span>
                        </div>
                        {Object.entries(data.stats.sources).map(([s, n]) => (
                          <div className="source-row" key={s}>
                            <span className={"source-icon " + s}>
                              {s === "edr" ? (
                                <Server size={15} />
                              ) : s === "idp" ? (
                                <Users size={15} />
                              ) : (
                                <Network size={15} />
                              )}
                            </span>
                            <span>
                              {s === "edr"
                                ? "Endpoint detection"
                                : s === "idp"
                                  ? "Identity provider"
                                  : "Network detection"}
                            </span>
                            <strong>{fmt(n as number)}</strong>
                            <div className="source-bar">
                              <span
                                style={{
                                  width: `${((n as number) / data.stats.alerts) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="panel queue-panel">
                      <div className="queue-heading">
                        <div>
                          <h2>
                            Ranked investigations{" "}
                            <span className="count-pill">
                              {filtered.length}
                            </span>
                          </h2>
                          <p>Highest risk first · deterministic tie-breaks</p>
                        </div>
                        <div className="queue-filters">
                          <div className="search">
                            <Search size={16} />
                            <input
                              aria-label="Search incidents"
                              value={q}
                              onChange={(e) => setQ(e.target.value)}
                              placeholder="Search incidents, hosts, users…"
                            />
                          </div>
                          <select
                            aria-label="Filter risk tier"
                            value={tier}
                            onChange={(e) => setTier(e.target.value)}
                          >
                            <option value="all">All risk levels</option>
                            {["critical", "high", "medium", "low"].map((s) => (
                              <option key={s} value={s}>
                                {s[0].toUpperCase() + s.slice(1)}
                              </option>
                            ))}
                          </select>
                          <select
                            aria-label="Filter disposition"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                          >
                            <option value="all">All statuses</option>
                            {[
                              "open",
                              "investigating",
                              "escalated",
                              "false_positive",
                              "closed",
                            ].map((s) => (
                              <option key={s} value={s}>
                                {s.replaceAll("_", " ")}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="table-scroll">
                        <table className="queue-table">
                          <thead>
                            <tr>
                              <th>RISK</th>
                              <th>INCIDENT</th>
                              <th>ENTITIES</th>
                              <th>ALERTS</th>
                              <th>FIRST SEEN</th>
                              <th>STATUS</th>
                              <th aria-label="Open incident" />
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.slice(0, 100).map((i) => (
                              <tr
                                key={i.id}
                                onClick={() => void openIncident(i.id)}
                              >
                                <td>
                                  <div className="risk-cell">
                                    <span className={"score " + i.tier}>
                                      {Math.round(i.score)}
                                    </span>
                                    <Badge tier={i.tier} />
                                  </div>
                                </td>
                                <td>
                                  <button
                                    className="incident-link"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void openIncident(i.id);
                                    }}
                                  >
                                    {i.title}
                                  </button>
                                  <div className="incident-meta">
                                    <span className="mono">
                                      INC-{short(i.id)}
                                    </span>
                                    <span>·</span>
                                    <span>
                                      {i.mappings.length} mapped behaviors
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  <div className="entity-cell">
                                    <span>
                                      <Server size={13} />
                                      {
                                        i.entities.filter((e) =>
                                          e.startsWith("host:"),
                                        ).length
                                      }{" "}
                                      hosts
                                    </span>
                                    <span>
                                      <Users size={13} />
                                      {
                                        i.entities.filter((e) =>
                                          e.startsWith("user:"),
                                        ).length
                                      }{" "}
                                      users
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  <strong className="alert-count">
                                    {i.alert_ids.length}
                                  </strong>
                                </td>
                                <td>
                                  <span className="mono">{time(i.first)}</span>
                                  <small className="muted">
                                    {new Date(i.first).toLocaleDateString(
                                      "en-GB",
                                      {
                                        day: "2-digit",
                                        month: "short",
                                        timeZone: "UTC",
                                      },
                                    )}
                                  </small>
                                </td>
                                <td>
                                  <span className={"status " + i.disposition}>
                                    <span />
                                    {i.disposition.replaceAll("_", " ")}
                                  </span>
                                </td>
                                <td>
                                  <ChevronRight size={17} className="muted" />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {!filtered.length && (
                          <div className="empty">
                            <Search size={24} />
                            <strong>No matching incidents</strong>
                            <span>
                              Change the search or filters to see more results.
                            </span>
                            <button
                              className="button secondary"
                              onClick={() => {
                                setQ("");
                                setTier("all");
                                setStatus("all");
                              }}
                            >
                              Clear filters
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="table-footer">
                        <span>
                          Showing {Math.min(filtered.length, 100)} of{" "}
                          {fmt(filtered.length)} review items
                        </span>
                        <span>
                          <ShieldCheck size={14} />
                          All source evidence retained
                        </span>
                      </div>
                    </div>
                  </>
                )}
                {view === "alerts" && (
                  <AlertsView
                    runId={runId}
                    notify={notify}
                    showReplay={Boolean(selectedRun?.manifest?.synthetic)}
                    focusAlert={focusAlert}
                    onImportReports={() => setView("import")}
                    onOpenIncident={openIncident}
                    onImport={async (raw) => {
                      setBusy(true);
                      try {
                        const r = await api("runs", {
                          method: "POST",
                          body: JSON.stringify({ alerts: raw }),
                        });
                        setRuns((p) => [r, ...p]);
                        setRunId(r.id);
                        notify("Imported batch validated and processed");
                      } catch (e) {
                        notify((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                )}
                {view === "evaluation" && (
                  <EvaluationView
                    runId={runId}
                    onOpen={openIncident}
                    incidents={incidents}
                  />
                )}
                {view === "audit" && <AuditView runId={runId} />}
                {view === "method" && <MethodView />}
              </>
            )
          )}
          <footer className="footer">
            <span>Utopia Signal · Team 239 · Microsoft Innovate 2026</span>
            <span>
              <ShieldCheck size={13} />
              Evidence preserved · Human decisions
            </span>
          </footer>
        </main>
      </div>
      <dialog
        ref={dialog}
        className="incident-dialog"
        onClose={() => setDetail(null)}
      >
        {detail && (
          <>
            <div className="detail-top">
              <span className="mono">{detail.incident.id.toUpperCase()}</span>
              <button
                aria-label="Close investigation"
                className="icon-button"
                onClick={closeDetail}
              >
                <X size={20} />
              </button>
            </div>
            <div className="detail-heading">
              <div>
                <Badge tier={detail.incident.tier} />
                <span className="muted small-text">
                  {detail.incident.alert_ids.length} source alerts
                </span>
              </div>
              <h2>{detail.incident.title}</h2>
              <div className="detail-summary">
                <span>
                  <Clock size={14} />
                  {time(detail.incident.first)} – {time(detail.incident.last)}{" "}
                  UTC
                </span>
                <span className={"status " + detail.incident.disposition}>
                  {detail.incident.disposition.replaceAll("_", " ")}
                </span>
              </div>
            </div>
            <div className="detail-tabs" role="tablist">
              {["overview", "evidence", "correlation"].map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                >
                  {t[0].toUpperCase() + t.slice(1)}
                  {t === "evidence" && <span>{detail.alerts.length}</span>}
                </button>
              ))}
            </div>
            <div className="detail-body" role="tabpanel">
              {tab === "overview" && (
                <>
                  <div className="brief-card">
                    <div className="section-title">
                      <span>
                        <FileText size={17} />
                        Incident overview
                      </span>
                      <span className="verified">
                        <Check size={13} />
                        Facts checked
                      </span>
                    </div>
                    <p>{(aiOverview ?? detail.brief).summary}</p>
                    <div className="citation-row">
                      {(aiOverview ?? detail.brief).citations.map(
                        (id: string) => (
                          <button
                            className="citation"
                            key={id}
                            onClick={() => setTab("evidence")}
                          >
                            {id}
                          </button>
                        ),
                      )}
                    </div>
                    <div className="brief-footer">
                      {(aiOverview ?? detail.brief).generator === "model"
                        ? "Groq AI overview · structured facts checked"
                        : "Rules-based overview · "}
                      {(aiOverview ?? detail.brief).verification.valid
                        ? "Facts and citations checked"
                        : "Verification failed"}
                      <span>Human interpretation required</span>
                    </div>
                    <details className="ai-overview-settings">
                      <summary>
                        {detail.ai_overview_enabled
                          ? "Optional AI overview"
                          : "AI overview · not enabled"}
                      </summary>
                      {detail.ai_overview_enabled ? (
                        <>
                          <label>
                            <input
                              type="checkbox"
                              checked={aiOverviewConsent}
                              onChange={(event) =>
                                setAiOverviewConsent(event.target.checked)
                              }
                            />
                            Send this group’s alert IDs, timestamps, behavior
                            types, severity, entity identifiers, score, and
                            technique codes to Groq. Descriptions and simulation
                            labels are excluded.
                          </label>
                          <button
                            className="button secondary"
                            disabled={!aiOverviewConsent || aiOverviewBusy}
                            onClick={() => void generateAiOverview()}
                          >
                            {aiOverviewBusy
                              ? "Writing overview…"
                              : "Generate AI overview"}
                          </button>
                          {aiOverview?.generator === "template_fallback" && (
                            <p className="inline-note">
                              AI was unavailable; the rules-based overview is
                              shown.
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="muted">
                          Set GROQ_API_KEY on the local server to enable this
                          optional feature. The rules-based overview works
                          without an AI provider.
                        </p>
                      )}
                    </details>
                  </div>
                  <div className="detail-section">
                    <div className="section-title">
                      <span>Why this risk score?</span>
                      <strong className={"score-total " + detail.incident.tier}>
                        {detail.incident.score}
                        <small>/100</small>
                      </strong>
                    </div>
                    {detail.incident.components.map((c: any) => (
                      <div className="component-row" key={c.key}>
                        <div>
                          <span>{c.label}</span>
                          <strong>
                            {c.value}
                            <small> / {c.max}</small>
                          </strong>
                        </div>
                        <div className="component-bar">
                          <span
                            style={{ width: (c.value / c.max) * 100 + "%" }}
                          />
                        </div>
                        <p>{c.reason}</p>
                      </div>
                    ))}
                    <div className="inline-note">
                      Critical ≥80 · High ≥60 · Medium ≥35. Scores are review
                      aids, not probabilities.
                    </div>
                  </div>
                  <div className="detail-section">
                    <div className="section-title">
                      <span>Affected entities</span>
                      <span className="muted small-text">Observed scope</span>
                    </div>
                    <div className="entity-tags">
                      {detail.incident.entities.map((e: string) => (
                        <span key={e}>
                          {e.startsWith("host:") ? (
                            <Server size={13} />
                          ) : e.startsWith("user:") ? (
                            <Users size={13} />
                          ) : (
                            <Network size={13} />
                          )}
                          <span>{e}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="detail-section">
                    <div className="section-title">
                      <span>ATT&CK behaviors</span>
                      <span className="muted small-text">Pinned v17.1</span>
                    </div>
                    {detail.incident.mappings.length ? (
                      detail.incident.mappings.map((m: any) => (
                        <a
                          key={m.type}
                          href={m.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mapping-row"
                        >
                          <span className="technique-id">{m.technique}</span>
                          <div>
                            {m.name}
                            <small>{m.tactic.replaceAll("-", " ")}</small>
                          </div>
                          <ExternalLink size={14} />
                        </a>
                      ))
                    ) : (
                      <div className="inline-note">
                        No controlled mapping. Category remains unclassified.
                      </div>
                    )}
                  </div>
                  <div className="detail-section">
                    <div className="section-title">
                      <span>Suggested checks</span>
                    </div>
                    {detail.brief.actions.map((a: string) => (
                      <div key={a} className="recommendation">
                        <Check size={15} />
                        {a}
                      </div>
                    ))}
                  </div>
                  {detail.incident.flags.map((f: string) => (
                    <div className="warning-note" key={f}>
                      <TriangleAlert size={16} />
                      {f}
                    </div>
                  ))}
                </>
              )}
              {tab === "evidence" && (
                <>
                  <div className="inline-note">
                    <Info size={15} />
                    Source descriptions are untrusted data. All member IDs
                    survive deduplication.
                  </div>
                  <div className="timeline">
                    {detail.groups.map((g: AlertGroup) => (
                      <div className="timeline-item" key={g.id}>
                        <span className="timeline-dot" />
                        <div className="timeline-time">
                          {time(g.first)} UTC{" "}
                          <span>{g.alerts[0].source.toUpperCase()}</span>
                        </div>
                        <h3>{g.type.replaceAll("_", " ")}</h3>
                        <p>{g.alerts[0].description}</p>
                        <div className="citation-row">
                          {g.alerts.map((a) => (
                            <span className="citation" key={a.alert_id}>
                              {a.alert_id}
                            </span>
                          ))}
                        </div>
                        <div className="muted small-text">
                          {g.alerts.length} alerts · severity{" "}
                          {g.alerts[0].severity}/4 · {g.id}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {detail?.alerts?.some((a: Alert) => a.provenance) && (
                <details className="panel">
                  <summary>Import provenance · original source rows</summary>
                  {detail.alerts
                    .filter((a: Alert) => a.provenance)
                    .slice(0, 40)
                    .map((a: Alert) => (
                      <div className="document-finding" key={a.alert_id}>
                        <code>{a.alert_id}</code>
                        <p>
                          Source row {a.provenance?.record} ·{" "}
                          {a.provenance?.adapter} · severity{" "}
                          {a.provenance?.original_severity} → {a.severity}/4
                        </p>
                        <small>{a.raw_reference}</small>
                        {a.provenance?.warnings.map((w) => (
                          <p key={w} className="muted">
                            {w}
                          </p>
                        ))}
                      </div>
                    ))}
                </details>
              )}
              {tab === "correlation" && <CorrelationGraph detail={detail} />}
            </div>
            <div className="detail-actions">
              <button
                className="button secondary"
                onClick={() => {
                  setReason("");
                  setAction("false_positive");
                }}
              >
                Mark false positive
              </button>
              <button
                className="button secondary"
                onClick={() => {
                  setReason("");
                  setAction("investigating");
                }}
              >
                Investigate
              </button>
              <button
                className="button primary"
                onClick={() => {
                  setReason("");
                  setAction("escalated");
                }}
              >
                Escalate
              </button>
            </div>
          </>
        )}
      </dialog>
      <dialog
        ref={simDialog}
        className="modal"
        onClose={() => setSimOpen(false)}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">NEW CONTROLLED RUN</span>
            <h2>Run a simulation</h2>
          </div>
          <button
            aria-label="Close simulation"
            className="icon-button"
            onClick={() => {
              simDialog.current?.close();
              setSimOpen(false);
            }}
          >
            <X size={21} />
          </button>
        </div>
        <SimulationForm busy={busy} onSubmit={simulate} error={error} />
      </dialog>
      <dialog
        ref={actionDialog}
        className="modal action-modal"
        onClose={() => setAction("")}
      >
        <div className="modal-heading">
          <h2>
            {action === "false_positive"
              ? "Mark as false positive"
              : action === "escalated"
                ? "Escalate incident"
                : "Start investigation"}
          </h2>
          <button
            className="icon-button"
            aria-label="Cancel decision"
            onClick={() => actionDialog.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <p className="muted">
          Your decision changes the review status. Record the evidence and
          context behind it.
        </p>
        <label htmlFor="reason">Decision reason</label>
        <textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="What did you observe? Why is this the right next step?"
          rows={5}
          maxLength={1000}
        />
        <span className="muted small-text">
          At least 8 characters · appended to the audit chain
        </span>
        <div className="modal-actions">
          <button
            className="button secondary"
            onClick={() => actionDialog.current?.close()}
          >
            Cancel
          </button>
          <button
            className="button primary"
            disabled={busy || reason.trim().length < 8}
            onClick={() => void saveAction()}
          >
            {busy ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Check size={16} />
            )}
            Save decision
          </button>
        </div>
      </dialog>
      {toast && (
        <div className="toast" role="status">
          <CheckCheck size={18} />
          {toast}
          <button
            aria-label="Dismiss notification"
            className="icon-button"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
