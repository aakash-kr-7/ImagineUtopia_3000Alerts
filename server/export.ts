import type { TriageResult } from "../core/contracts";
const escape = (x: unknown) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
function cell(x: unknown) {
  const s = String(x ?? "");
  return (
    '"' + (/^[=+\-@\t\r]/.test(s) ? "'" : "") + s.replaceAll('"', '""') + '"'
  );
}
export function exportCSV(result: TriageResult) {
  const header = [
    "incident_id",
    "score",
    "tier",
    "disposition",
    "alert_id",
    "timestamp_utc",
    "source",
    "alert_type",
    "severity_0_4",
    "entities",
    "source_reference",
    "source_row",
    "original_severity",
  ];
  const byAlert = new Map(
    result.incidents.flatMap((i) => i.alert_ids.map((id) => [id, i] as const)),
  );
  return [
    header,
    ...result.alerts.map((a) => {
      const i = byAlert.get(a.alert_id)!;
      return [
        i.id,
        i.score,
        i.tier,
        i.disposition,
        a.alert_id,
        a.timestamp,
        a.source,
        a.alert_type,
        a.severity,
        a.entities.join(";"),
        a.raw_reference,
        a.provenance?.record,
        a.provenance?.original_severity,
      ];
    }),
  ]
    .map((r) => r.map(cell).join(","))
    .join("\r\n");
}
export function exportHTML(run: any, result: TriageResult, evaluation: any) {
  const metrics = evaluation?.methods
    ?.map(
      (m: any) =>
        `<tr><td>${escape(m.name)}</td><td>${m.queue_size}</td><td>${(m.recall_at_25 * 100).toFixed(1)}%</td><td>${(m.pairwise_f1 * 100).toFixed(1)}%</td><td>${(m.benign_contamination * 100).toFixed(1)}%</td></tr>`,
    )
    .join("");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Utopia SOC — ${escape(run.id)}</title><style>body{font:15px/1.6 system-ui;color:#18263a;max-width:1100px;margin:40px auto;padding:20px}h1{font-size:36px}h2{margin-top:35px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:10px;text-align:left;border-bottom:1px solid #d9e0e8}th{background:#eef5f3}article{border:1px solid #d9e0e8;border-radius:8px;padding:20px;margin:20px 0;break-inside:avoid}code{word-break:break-all}small{color:#516078}.pill{padding:4px 8px;background:#edf6f2;border-radius:4px}blockquote{border-left:3px solid #247e66;padding-left:12px;margin-left:0}@page{size:A4;margin:16mm}@media print{body{margin:0;padding:0}h1{font-size:25px}}</style><h1>Utopia SOC · evidence dossier</h1><p>${escape(run.id)} · ${result.alerts.length.toLocaleString()} normalized alerts · ${result.incidents.length.toLocaleString()} review items</p><p>Created ${escape(run.created)}. ${run.manifest.synthetic ? "Synthetic simulation: evaluation does not establish real-world detection performance." : "Imported source evidence: findings need analyst verification."}</p><small>Engine ${escape(result.config_version)} · input SHA-256 <code>${escape(run.manifest.input_sha256)}</code></small>${metrics ? `<h2>Method comparison</h2><table><tr><th>Method</th><th>Queue</th><th>Episode recall @25</th><th>Grouping F1</th><th>Benign contamination</th></tr>${metrics}</table>` : "<p>Independent attack labels were not supplied. Attack recall and grouping accuracy are unavailable.</p>"}<h2>Highest-priority investigations · first 25</h2>${result.incidents
    .slice(0, 25)
    .map(
      (i) =>
        `<article><small>${escape(i.id)} · ${escape(i.disposition)}</small><h3>${escape(i.title)} <span class="pill">${i.score}/100 · ${escape(i.tier)}</span></h3><p>${i.alert_ids.length} alerts · ${escape(i.first)} to ${escape(i.last)}</p><p>${i.entities.map(escape).join(" · ")}</p><table><tr><th>Risk component</th><th>Contribution</th><th>Evidence</th></tr>${i.components.map((c) => `<tr><td>${escape(c.label)}</td><td>${c.value}/${c.max}</td><td>${escape(c.reason)}</td></tr>`).join("")}</table><p>${i.mappings.map((m) => `${escape(m.technique)} · ${escape(m.name)}`).join("; ") || "No controlled ATT&CK mapping"}</p>${i.flags.map((f) => `<p>${escape(f)}</p>`).join("")}<small>Source IDs: ${i.alert_ids.slice(0, 30).map(escape).join(", ")}${i.alert_ids.length > 30 ? " (remaining IDs available in JSON/CSV export)" : ""}</small></article>`,
    )
    .join(
      "",
    )}<h2>Interpretation limits</h2><p>Risk is an ordinal, deterministic score, not a compromise probability. Technique mappings describe observed behavior, not malicious intent. Queue rows and evidence volume are workload proxies; analyst time was not measured. Use the full JSON export for provenance, graph diagnostics, and decision audit.</p></html>`;
}
