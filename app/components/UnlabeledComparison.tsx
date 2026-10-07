import { Info, Upload } from "lucide-react";
import { useEffect, useState } from "react";
export function UnlabeledComparison({
  runId,
  onLabeled,
}: {
  runId: string;
  onLabeled: () => void;
}) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch(`/api/runs/${runId}/comparison`)
      .then(async (r) => {
        const d: any = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [runId]);
  async function labels(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      if (file.size > 2_000_000)
        throw new Error("Annotation file exceeds 2 MB");
      const payload = JSON.parse(await file.text()),
        r = await fetch(`/api/runs/${runId}/labels`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
      const d: any = await r.json();
      if (!r.ok) throw new Error(d.error);
      onLabeled();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Label import failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="benchmark-lab">
      <div className="panel benchmark-hero">
        <span className="eyebrow">OBSERVABLE COMPARISON</span>
        <h2>Measure workload without inventing accuracy.</h2>
        <p className="benchmark-note">
          This export has no independent attack labels. Compare queue size,
          source evidence per item, and compression. Attack recall and grouping
          correctness remain unavailable.
        </p>
      </div>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {data && (
        <div className="panel">
          <h2>Identical input, four grouping methods</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>METHOD</th>
                  <th>REVIEW ITEMS</th>
                  <th>ROW REDUCTION</th>
                  <th>ALERTS / ITEM</th>
                  <th>LARGEST ITEM</th>
                  <th>ACCURACY</th>
                </tr>
              </thead>
              <tbody>
                {data.methods.map((m: any) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>{m.queue_size.toLocaleString()}</td>
                    <td>{(m.row_reduction * 100).toFixed(1)}%</td>
                    <td>{m.mean_alerts_per_item.toFixed(1)}</td>
                    <td>{m.largest_item}</td>
                    <td>Requires labels</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.limitations.map((l: string) => (
            <div className="limit-item" key={l}>
              <Info size={15} />
              <span>{l}</span>
            </div>
          ))}
        </div>
      )}
      <div className="panel">
        <h2>Have independently annotated ground truth?</h2>
        <p className="benchmark-note">
          Upload a JSON file with a complete <code>labels</code> map (alert ID →
          episode or BENIGN) and <code>episodes</code> map (family, alert_ids).
          Annotations are stored separately after triage. Every accepted alert
          must be covered exactly once; scoring and grouping remain unchanged.
        </p>
        <pre className="inline-note">
          {
            '{"labels":{"AL-1":"ATTACK-1","AL-2":"BENIGN"},\n "episodes":{"ATTACK-1":{"family":"Analyst annotated",\n "alert_ids":["AL-1"]}}}'
          }
        </pre>
        <label className="button secondary">
          <Upload size={16} />
          {busy ? "Validating annotations…" : "Upload independent labels"}
          <input
            type="file"
            accept=".json"
            aria-label="Upload independent ground truth"
            disabled={busy}
            onChange={(e) => void labels(e.target.files?.[0])}
          />
        </label>
      </div>
    </div>
  );
}
