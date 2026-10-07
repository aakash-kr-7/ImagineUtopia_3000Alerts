import {
  Check,
  Download,
  FileText,
  LoaderCircle,
  ShieldCheck,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  assessDocument,
  type DocumentAssessment,
} from "../../core/ingestion/assessment";
import {
  IMPORT_DEFAULTS,
  normalize,
  suggestedFields,
  type ImportOptions,
  type SeverityScale,
} from "../../core/ingestion/normalize";
import { readFile, type ParsedFile } from "../lib/read-file";
export function ReportImport({
  onAnalyze,
  onSaveDocument,
}: {
  onAnalyze: (alerts: unknown[], report: unknown) => Promise<void>;
  onSaveDocument: (report: DocumentAssessment) => Promise<void>;
}) {
  const [parsed, setParsed] = useState<ParsedFile | null>(null),
    [options, setOptions] = useState<ImportOptions>(IMPORT_DEFAULTS),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [ack, setAck] = useState(false);
  const normalized = useMemo(
    () =>
      parsed?.records.length
        ? normalize(parsed.records, parsed.filename, parsed.sha256, options)
        : null,
    [parsed, options],
  );
  const assessment = useMemo(
    () =>
      parsed?.pages.length
        ? assessDocument(parsed.pages, parsed.filename, parsed.sha256)
        : null,
    [parsed],
  );
  const fields = useMemo(
    () =>
      parsed?.records.length
        ? Object.keys(
            parsed.records
              .slice(0, 5)
              .reduce((a, r) => ({ ...a, ...flattenForFields(r.value) }), {}),
          )
        : [],
    [parsed],
  );
  async function choose(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    setParsed(null);
    setAck(false);
    try {
      const p = await readFile(file);
      setParsed(p);
      setOptions({ ...IMPORT_DEFAULTS, fields: suggestedFields(p.records) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    setBusy(true);
    setError("");
    try {
      if (normalized) await onAnalyze(normalized.alerts, normalized.report);
      else if (assessment) await onSaveDocument(assessment);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="import-workbench">
      <div className="panel import-intro">
        <span className="eyebrow">FROM EXPORT TO EVIDENCE</span>
        <h2>Bring your own SOC data.</h2>
        <p>
          Preview the extraction, confirm normalization, then investigate.
          Structured events become an incident queue. Narrative reports become
          an evidence assessment with source citations.
        </p>
        <div className="import-trust">
          <ShieldCheck size={18} />
          <span>
            Files are parsed in your browser. Only accepted normalized records
            or extracted findings are saved to your private workspace.
          </span>
        </div>
        <label
          className="upload-zone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void choose(e.dataTransfer.files[0]);
          }}
        >
          <Upload size={32} />
          <strong>
            {busy ? "Reading document…" : "Drop a report or choose a file"}
          </strong>
          <span>JSON · JSONL · CSV · TSV · XLSX · PDF · DOCX · TXT</span>
          <small>12 MB maximum · 10,000 events · 100 PDF pages</small>
          <input
            type="file"
            aria-label="Choose SOC report"
            accept=".json,.jsonl,.ndjson,.csv,.tsv,.xlsx,.pdf,.docx,.txt,.log"
            onChange={(e) => void choose(e.target.files?.[0])}
            disabled={busy}
          />
        </label>
        <div className="resource-links">
          <a href="/examples/sentinel-alerts.json" download>
            Sentinel example <Download size={14} />
          </a>
          <a href="/examples/alerts.csv" download>
            CSV template <Download size={14} />
          </a>
          <a href="/examples/soc-report.txt" download>
            Narrative report <Download size={14} />
          </a>
        </div>
      </div>
      {error && (
        <div role="alert" className="error-banner">
          {error}
        </div>
      )}
      {parsed && (
        <>
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h2>{parsed.filename}</h2>
                <p>{parsed.format.toUpperCase()} · SHA-256 provenance</p>
              </div>
              <span className="verified">
                <Check size={14} />
                Parsed locally
              </span>
            </div>
            <code className="hash-line">{parsed.sha256}</code>
            {parsed.notes.map((n) => (
              <p className="inline-note" key={n}>
                {n}
              </p>
            ))}
          </div>
          {normalized && (
            <>
              <div className="panel">
                <div className="panel-heading">
                  <h2>Normalization controls</h2>
                  <span>Review before analysis</span>
                </div>
                <div className="form-grid">
                  <label>
                    Severity scale
                    <select
                      value={options.severityScale}
                      onChange={(e) =>
                        setOptions({
                          ...options,
                          severityScale: e.target.value as SeverityScale,
                        })
                      }
                    >
                      {[
                        ["auto", "Vendor defaults / textual severity"],
                        ["normalized", "Normalized 0–4"],
                        ["wazuh", "Wazuh 0–15"],
                        ["ten", "Source-specific 0–10"],
                        ["percent", "Source-specific 0–100"],
                        ["syslog", "Syslog 0–7 (inverse)"],
                      ].map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Unzoned timestamps
                    <select
                      value={options.timezone}
                      onChange={(e) =>
                        setOptions({
                          ...options,
                          timezone: e.target.value as ImportOptions["timezone"],
                        })
                      }
                    >
                      <option value="require">Require explicit timezone</option>
                      <option value="UTC">
                        I confirm these timestamps are UTC
                      </option>
                    </select>
                  </label>
                  {[
                    "timestamp",
                    "severity",
                    "id",
                    "type",
                    "host",
                    "user",
                    "ip",
                    "source",
                    "criticality",
                  ].map((key) => (
                    <label key={key}>
                      {key.replaceAll("_", " ")} field
                      <select
                        value={
                          options.fields[
                            key as keyof ImportOptions["fields"]
                          ] ?? ""
                        }
                        onChange={(e) =>
                          setOptions({
                            ...options,
                            fields: {
                              ...options.fields,
                              [key]: e.target.value,
                            },
                          })
                        }
                      >
                        <option value="">Automatic / unavailable</option>
                        {fields.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
              <div className="stats-grid import-stats">
                {[
                  ["Accepted", normalized.report.accepted],
                  ["Rejected", normalized.report.rejected],
                  ["No entities", normalized.report.missing.entities],
                  ["Unknown inventory", normalized.report.missing.criticality],
                ].map(([name, n]) => (
                  <div className="panel" key={name}>
                    <span className="muted">{name}</span>
                    <h2>{n.toLocaleString()}</h2>
                  </div>
                ))}
              </div>
              <div className="panel">
                <div className="panel-heading">
                  <h2>Accepted evidence preview</h2>
                  <span>
                    {Object.entries(normalized.report.adapters)
                      .map(([k, n]) => `${k}: ${n}`)
                      .join(" · ")}
                  </span>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>ROW</th>
                        <th>TIME UTC</th>
                        <th>BEHAVIOR</th>
                        <th>SEVERITY</th>
                        <th>ENTITIES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {normalized.alerts.slice(0, 10).map((a) => (
                        <tr key={a.alert_id}>
                          <td>{a.provenance?.record}</td>
                          <td>{a.timestamp}</td>
                          <td>{a.alert_type}</td>
                          <td>
                            {a.provenance?.original_severity} → {a.severity}/4
                          </td>
                          <td>{a.entities.join(", ") || "None"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {normalized.report.issues.length > 0 && (
                <details className="panel">
                  <summary>
                    Normalization issues ({normalized.report.issues.length}{" "}
                    shown)
                  </summary>
                  <div className="issue-list">
                    {normalized.report.issues.slice(0, 100).map((issue, i) => (
                      <p
                        key={i}
                        className={
                          issue.level === "error" ? "red-text" : "muted"
                        }
                      >
                        <strong>
                          Row {issue.record} · {issue.level}
                        </strong>{" "}
                        {issue.message}
                      </p>
                    ))}
                  </div>
                </details>
              )}
              {normalized.report.rejected > 0 && (
                <label className="ack">
                  <input
                    type="checkbox"
                    checked={ack}
                    onChange={(e) => setAck(e.target.checked)}
                  />
                  I reviewed the rejected rows and want to analyze the accepted
                  subset.
                </label>
              )}
              <div className="flow-note">
                <TriangleAlert size={16} />
                Unlabeled exports show workload and evidence comparisons. Attack
                accuracy requires independent ground truth.
              </div>
            </>
          )}
          {assessment && <DocumentView report={assessment} />}
          <button
            className="button primary"
            onClick={() => void submit()}
            disabled={
              busy ||
              (!!normalized &&
                (!normalized.alerts.length ||
                  (normalized.report.rejected > 0 && !ack)))
            }
          >
            {busy ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <FileText size={16} />
            )}{" "}
            {normalized
              ? `Analyze ${normalized.alerts.length.toLocaleString()} accepted events`
              : "Save document assessment"}
          </button>
        </>
      )}
    </div>
  );
}
function flattenForFields(
  v: unknown,
  prefix = "",
  out: Record<string, unknown> = {},
) {
  if (v && typeof v === "object" && !Array.isArray(v))
    for (const [k, x] of Object.entries(v))
      flattenForFields(x, prefix ? `${prefix}.${k}` : k, out);
  else out[prefix] = v;
  return out;
}
export function DocumentView({ report }: { report: DocumentAssessment }) {
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "utopia-document-assessment.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="document-assessment">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">DOCUMENT EVIDENCE</span>
            <h2>{report.filename}</h2>
            <p>
              {report.pages} extracted pages · {report.findings.length} matching
              passages · {report.indicators.length} indicator mentions
            </p>
          </div>
          <button className="button secondary" onClick={download}>
            <Download size={16} />
            Export
          </button>
        </div>
        <p>
          These are cited mentions for review. They are not confirmed attacks or
          reconstructed telemetry.
        </p>
        <div className="technique-tags">
          {report.techniques.map((t) => (
            <span className="count-pill" key={t.id}>
              {t.id} · {t.mapping?.name ?? "Outside controlled mapping"}
            </span>
          ))}
        </div>
      </div>
      <div className="panel">
        <h2>Evidence passages</h2>
        {report.findings.length ? (
          report.findings.map((f) => (
            <article className="document-finding" key={f.id}>
              <small className="mono muted">
                {f.id} · page {f.page}
              </small>
              <blockquote>{f.quote}</blockquote>
              <div className="technique-tags">
                {[...f.techniques, ...f.indicators].map((x) => (
                  <code key={x}>{x}</code>
                ))}
              </div>
            </article>
          ))
        ) : (
          <p>
            No matching behavior or indicators extracted. Review the original
            report or export structured events.
          </p>
        )}
      </div>
      <div className="panel limits-panel">
        {report.limitations.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </div>
    </div>
  );
}
