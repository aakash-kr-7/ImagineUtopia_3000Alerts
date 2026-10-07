import { ChevronLeft, ChevronRight, Plus, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Alert } from "../../core/contracts";
import { api, fmt } from "../lib/api";
import { sourceAbbreviation, sourceLabel } from "../lib/labels";
import { SimulationTheater } from "./SimulationTheater";
export function AlertsView({
  runId,
  notify,
  onImport,
  showReplay = false,
  focusAlert,
  onImportReports,
  onOpenIncident,
}: {
  runId: string;
  notify: (s: string) => void;
  onImport: (a: unknown) => Promise<void>;
  showReplay?: boolean;
  focusAlert?: { id: string; token: number } | null;
  onImportReports?: () => void;
  onOpenIncident?: (incidentId: string) => void;
}) {
  const [rows, setRows] = useState<any>(null),
    [q, setQ] = useState(""),
    [importance, setImportance] = useState("all"),
    [page, setPage] = useState(0),
    [detail, setDetail] = useState<any>(null),
    file = useRef<HTMLInputElement>(null);
  async function openAlert(alertId: string) {
    try {
      setDetail(
        await api(`runs/${runId}/alert/${encodeURIComponent(alertId)}`),
      );
    } catch (e) {
      notify((e as Error).message);
    }
  }
  useEffect(() => {
    if (focusAlert) void openAlert(focusAlert.id);
  }, [focusAlert?.token]);
  useEffect(() => {
    const c = new AbortController();
    api(
      `runs/${runId}/alerts?offset=${page * 100}&limit=100&q=${encodeURIComponent(q)}&importance=${importance}`,
      { signal: c.signal },
    )
      .then(setRows)
      .catch((e) => {
        if (e.name !== "AbortError") notify(e.message);
      });
    return () => c.abort();
  }, [runId, q, page, importance]);
  return (
    <div className="alert-workspace">
      {showReplay && (
        <SimulationTheater
          runId={runId}
          onInspect={(id) => void openAlert(id)}
        />
      )}
      <div className="panel">
        <div className="queue-heading">
          <div>
            <h2>Normalized source alerts</h2>
            <p>
              Open any alert to see its incident group, rank, score, and reason
              for grouping.
            </p>
            <p className="field-legend">
              EDR = endpoint detection and response · IdP = identity provider ·
              IDS = network intrusion detection. Severity is an ordered 0–4
              value; 4 is highest.
            </p>
          </div>
          <div className="queue-filters">
            <div className="search">
              <Search size={16} />
              <input
                aria-label="Search alerts"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(0);
                }}
                placeholder="Search any alert field…"
              />
            </div>
            <button
              className="button secondary"
              onClick={() => file.current?.click()}
            >
              <Plus size={16} />
              Import JSONL
            </button>
            {onImportReports && (
              <button className="button secondary" onClick={onImportReports}>
                <Plus size={16} />
                CSV / Excel
              </button>
            )}
            <select
              aria-label="Filter source alert priority"
              value={importance}
              onChange={(e) => {
                setImportance(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">All alerts</option>
              <option value="review">Worth reviewing</option>
              <option value="high">High-importance incidents</option>
              <option value="top25">Alerts in top 25 items</option>
            </select>
            <input
              ref={file}
              type="file"
              accept=".json,.jsonl"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  if (f.size > 5_000_000)
                    throw new Error("Maximum upload is 5 MB");
                  const text = await f.text(),
                    alerts = text.trim().startsWith("[")
                      ? JSON.parse(text)
                      : text
                          .trim()
                          .split("\n")
                          .map((x) => JSON.parse(x));
                  await onImport(alerts);
                } catch (err) {
                  notify((err as Error).message);
                } finally {
                  e.target.value = "";
                }
              }}
            />
          </div>
        </div>
        <div className="table-scroll">
          <table className="raw-table">
            <thead>
              <tr>
                <th>ALERT ID</th>
                <th>TIME / UTC</th>
                <th>SOURCE</th>
                <th>BEHAVIOR</th>
                <th>SEVERITY</th>
                <th>ENTITIES</th>
              </tr>
            </thead>
            <tbody>
              {rows?.items.map((a: Alert) => (
                <tr
                  key={a.alert_id}
                  className="clickable-row"
                  onClick={() => void openAlert(a.alert_id)}
                >
                  <td>
                    <button
                      className="incident-link mono"
                      onClick={(e) => {
                        e.stopPropagation();
                        void openAlert(a.alert_id);
                      }}
                    >
                      {a.alert_id}
                    </button>
                  </td>
                  <td className="mono">
                    {a.timestamp.replace("T", " ").replace(".000Z", "")}
                  </td>
                  <td>
                    <span
                      className={"source-tag " + a.source}
                      title={sourceLabel(a.source)}
                      aria-label={sourceLabel(a.source)}
                    >
                      {sourceAbbreviation(a.source)}
                    </span>
                  </td>
                  <td>
                    <strong>{a.alert_type.replaceAll("_", " ")}</strong>
                    <small className="muted description">{a.description}</small>
                  </td>
                  <td>
                    <span className={"severity level" + a.severity}>
                      {a.severity}/4
                    </span>
                  </td>
                  <td className="mono small-text">
                    {a.entities.join(" · ") || "Missing"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows?.total === 0 && (
            <div className="empty">No matching source alerts.</div>
          )}
        </div>
        <div className="table-footer">
          <span>
            {rows
              ? `${fmt(rows.total)} alerts · page ${page + 1}`
              : "Loading alerts…"}
          </span>
          <div className="pagination">
            <button
              className="icon-button"
              aria-label="Previous alert page"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="icon-button"
              aria-label="Next alert page"
              disabled={!rows || (page + 1) * 100 >= rows.total}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        {detail && (
          <div
            className="alert-decision panel"
            role="region"
            aria-label="Alert decision explanation"
          >
            <div className="panel-heading">
              <div>
                <span className="eyebrow">ALERT DECISION TRACE</span>
                <h2>{detail.alert.alert_id}</h2>
                <p>{detail.alert.description}</p>
              </div>
              <button
                className="icon-button"
                aria-label="Close alert decision trace"
                onClick={() => setDetail(null)}
              >
                <X size={19} />
              </button>
            </div>
            <div className="decision-status-grid">
              <div>
                <span>Priority outcome</span>
                <strong className={detail.prioritized ? "mint-text" : ""}>
                  {detail.prioritized
                    ? `Top 25 · rank ${detail.queue_rank}`
                    : `Rank ${detail.queue_rank} · outside top 25`}
                </strong>
              </div>
              <div>
                <span>Incident group</span>
                <strong>{detail.incident?.id ?? "Standalone alert"}</strong>
              </div>
              <div>
                <span>Group priority score</span>
                <strong>
                  {detail.incident
                    ? `${Math.round(detail.incident.score)}/100 · ${detail.incident.tier}`
                    : "—"}
                </strong>
              </div>
              <div>
                <span>Group membership</span>
                <strong>
                  {detail.group
                    ? `${detail.group.alerts.length} source alert${detail.group.alerts.length === 1 ? "" : "s"}`
                    : "No matching group"}
                </strong>
              </div>
            </div>
            <p className="decision-explanation">
              {detail.rationale.priority} {detail.rationale.grouping}
            </p>
            <div className="decision-columns">
              <div>
                <h3>Why this group has its priority</h3>
                {detail.rationale.components.map((component: any) => (
                  <div className="decision-component" key={component.key}>
                    <span>
                      {component.label}
                      <small>{component.reason}</small>
                    </span>
                    <strong>
                      {component.value}/{component.max}
                    </strong>
                  </div>
                ))}
              </div>
              <div>
                <h3>Why the alerts were linked</h3>
                {detail.linked_edges.length ? (
                  detail.linked_edges.flatMap((edge: any) =>
                    edge.reasons.map((reason: any, idx: number) => (
                      <div
                        className="decision-component"
                        key={`${edge.from}-${edge.to}-${idx}`}
                      >
                        <span>
                          {reason.entity}
                          <small>
                            {Math.round(reason.gap_seconds)} seconds apart ·
                            rarity weight {reason.idf.toFixed(3)}
                          </small>
                        </span>
                        <strong>{reason.weight.toFixed(3)}</strong>
                      </div>
                    )),
                  )
                ) : (
                  <p className="muted">
                    No cross-alert link met the evidence threshold. This alert
                    remains in its own group.
                  </p>
                )}
              </div>
            </div>
            <div className="citation-row">
              {detail.rationale.mapping.map((mapping: any) => (
                <a
                  className="citation"
                  key={mapping.technique}
                  href={mapping.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {mapping.technique} · {mapping.tactic}
                </a>
              ))}
            </div>
            <div className="citation-row">
              <span className="muted small-text">Triage flags:</span>
              {detail.rationale.flags.length ? (
                detail.rationale.flags.map((flag: string) => (
                  <span className="citation" key={flag}>
                    {flag}
                  </span>
                ))
              ) : (
                <span className="muted small-text">None</span>
              )}
              {detail.incident && onOpenIncident && (
                <button
                  className="button small secondary"
                  onClick={() => onOpenIncident(detail.incident.id)}
                >
                  Open full incident
                </button>
              )}
            </div>
            <p className="truth-footnote">
              Priority is a ranking decision, not a claim that the alert is
              malicious. Ground-truth labels are disclosed separately after
              scoring.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
