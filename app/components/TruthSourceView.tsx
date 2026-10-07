import { Database, Download, Eye, Search, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, fmt } from "../lib/api";

export function TruthSourceView({ runId }: { runId: string }) {
  const [payload, setPayload] = useState<any>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setPayload(null);
    setRevealed(false);
    setPage(0);
  }, [runId]);

  async function reveal() {
    setLoading(true);
    setError("");
    try {
      setPayload(await api(`runs/${runId}/truth`));
      setRevealed(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const source = payload?.source;
  const events = source?.events ?? [];
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return events;
    return events.filter((event: any) =>
      JSON.stringify(event).toLowerCase().includes(needle),
    );
  }, [events, query]);
  const pageSize = 30;
  const labels: Record<string, string> = source?.truth?.labels ?? {};
  const episodes = source?.truth?.episodes ?? {};

  return (
    <div className="truth-source">
      <div className="panel truth-intro">
        <div className="truth-intro-icon"><Database size={22} /></div>
        <div>
          <span className="eyebrow">POST-RUN SOURCE OF TRUTH</span>
          <h2>Open the simulation ledger</h2>
          <p>
            Review the generated event records, detector labels, scenario stages,
            fictional inventory and validation report. The triage engine did not
            receive episode labels; this view reveals them only after the run is
            complete.
          </p>
        </div>
        {!revealed ? (
          <button className="button primary" onClick={() => void reveal()} disabled={loading}>
            <Eye size={16} /> {loading ? "Loading ledger…" : "Reveal source ledger"}
          </button>
        ) : (
          <button
            className="button secondary"
            onClick={() => {
              const blob = new Blob([JSON.stringify(source, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `utopia-${runId}-source-ledger.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download size={16} /> Export ledger
          </button>
        )}
      </div>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {revealed && source && (
        <>
          <div className="truth-stats">
            <div className="panel"><span>Raw events</span><strong>{fmt(events.length)}</strong></div>
            <div className="panel"><span>Source alerts</span><strong>{fmt(Object.keys(labels).length)}</strong></div>
            <div className="panel"><span>Attack episodes</span><strong>{fmt(Object.keys(episodes).length)}</strong></div>
            <div className="panel"><span>Validation</span><strong className={source.validation?.valid ? "mint-text" : ""}>{source.validation?.valid ? "Passed" : "Review"}</strong></div>
          </div>
          <div className="truth-hashes"><span>Truth SHA-256</span><code>{payload.truth_sha256 ?? "Not recorded for uploaded annotations"}</code><span>Full ledger SHA-256</span><code>{payload.source_ledger_sha256}</code></div>
          <div className="panel truth-ledger">
            <div className="panel-heading">
              <div><h2>Detector event ledger</h2><p>Chronological source observations with simulation-only truth labels.</p></div>
              <span className="verified"><ShieldCheck size={14} /> Disclosed after triage</span>
            </div>
            <label className="search truth-search"><Search size={16} /><input aria-label="Search source ledger" placeholder="Find event, entity, behavior, or label…" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} /></label>
            <div className="table-scroll">
              <table className="raw-table">
                <thead><tr><th>EVENT</th><th>TIME · UTC</th><th>SENSOR</th><th>OBSERVED BEHAVIOR</th><th>SOURCE ALERT · SEVERITY</th><th>SEALED LABEL</th></tr></thead>
                <tbody>
                  {rows.slice(page * pageSize, (page + 1) * pageSize).map((event: any) => {
                    const sourceAlerts = (source.alert_sources ?? []).filter((row: any) => row.event_id === event.id);
                    const alertIds = sourceAlerts.map((row: any) => `${row.alert_id} (${row.severity}/4)`);
                    const label = source.event_labels?.[event.id] ?? "UNKNOWN";
                    return <tr key={event.id}>
                      <td className="mono">{event.id}</td>
                      <td className="mono">{event.timestamp.replace("T", " ").replace(".000Z", "")}</td>
                      <td><span className={`source-tag ${event.sensor}`}>{event.sensor.toUpperCase()}</span></td>
                      <td><strong>{event.behavior.replaceAll("_", " ")}</strong><small className="muted">{event.host} · {event.user}</small></td>
                      <td className="mono">{alertIds.join(", ") || "—"}</td>
                      <td><span className={label === "BENIGN" ? "truth-label benign" : alertIds.length ? "truth-label attack" : "truth-label quiet"}>{label}{!alertIds.length ? " · NO ALERT" : ""}</span></td>
                    </tr>;
                  })}
                </tbody>
              </table>
              {!rows.length && <div className="empty">No source events match this search.</div>}
            </div>
            <div className="table-footer"><span>{fmt(rows.length)} events · page {rows.length ? page + 1 : 0} of {Math.ceil(rows.length / pageSize)}</span><div className="pagination"><button className="button small secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button><button className="button small secondary" disabled={(page + 1) * pageSize >= rows.length} onClick={() => setPage((p) => p + 1)}>Next</button></div></div>
          </div>
          <details className="panel truth-details"><summary>Scenario stages, inventory, validation and raw truth map</summary><pre>{JSON.stringify({ episodes: source.episodes, inventory: source.inventory, validation: source.validation, truth: source.truth }, null, 2)}</pre></details>
          <p className="truth-footnote">This is synthetic simulation truth, suitable for checking this run's labels and measured coverage. It is not independently annotated SOC ground truth and should not be presented as external accuracy.</p>
        </>
      )}
      {!revealed && <div className="panel truth-locked"><ShieldCheck size={18} /> Truth remains undisclosed until you choose to inspect the completed run.</div>}
    </div>
  );
}
