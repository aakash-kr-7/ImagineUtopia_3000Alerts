import { Download, FlaskConical, Info } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ErrorBar,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const names: Record<string, string> = {
  B0: "Severity only",
  B1: "Host / time",
  B2: "Entity / time",
  B3: "Context per alert",
  UT: "Utopia graph",
};
export function BenchmarkLab() {
  const [report, setReport] = useState<any>(null),
    [external, setExternal] = useState<any>(null),
    [replay, setReplay] = useState<any>(null),
    [count, setCount] = useState(3000),
    [metric, setMetric] = useState("recall_at_25"),
    [error, setError] = useState("");
  useEffect(() => {
    fetch("/benchmark-report.json")
      .then((r) => r.json())
      .then(setReport)
      .catch((e) => setError(e.message));
    fetch("/external-validation.json")
      .then((r) => (r.ok ? r.json() : null))
      .then(setExternal)
      .catch(() => {});
    fetch("/replay-report.json")
      .then((r) => (r.ok ? r.json() : null))
      .then(setReplay)
      .catch(() => {});
  }, []);
  if (error) return <div className="error-banner">{error}</div>;
  if (!report)
    return (
      <div className="loading-panel">Loading reproducible measurements…</div>
    );
  const aggregate = report.aggregates.find((a: any) => a.count === count);
  const chart = aggregate.methods.map((m: any) => {
    const v = m.metrics[metric],
      factor = ["queue_size", "alerts_reviewed_at_25"].includes(metric)
        ? 1
        : 100;
    return {
      name: names[m.id] ?? m.id,
      mean: v.mean * factor,
      error: v.ci95
        ? [(v.mean - v.ci95[0]) * factor, (v.ci95[1] - v.mean) * factor]
        : [0, 0],
    };
  });
  const seedData = report.samples
    .filter((s: any) => s.count === count)
    .map((s: any) => ({
      seed: s.seed,
      ...Object.fromEntries(
        s.methods.map((m: any) => [
          m.id,
          m[metric] *
            (["queue_size", "alerts_reviewed_at_25"].includes(metric)
              ? 1
              : 100),
        ]),
      ),
    }));
  const stress = [
    ...new Set(report.sweeps.map((s: any) => JSON.stringify(s.condition))),
  ].map((condition: any) => {
    const rows = report.sweeps.filter(
        (s: any) => JSON.stringify(s.condition) === condition,
      ),
      ok = rows.filter((s: any) => s.status === "ok"),
      method = (id: string, key: string) =>
        ok.length
          ? ok.reduce(
              (sum: number, s: any) =>
                sum + s.methods.find((m: any) => m.id === id)[key],
              0,
            ) / ok.length
          : null;
    return {
      condition,
      ok: ok.length,
      total: rows.length,
      recall: method("UT", "recall_at_25"),
      contamination: method("UT", "benign_contamination"),
      baseline: method("B0", "recall_at_25"),
    };
  });
  function csv() {
    const rows = [
      [
        "seed",
        "alerts",
        "method",
        "recall_at_25",
        "pairwise_f1",
        "benign_contamination",
        "queue_size",
        "alerts_reviewed_at_25",
      ],
      ...report.samples.flatMap((s: any) =>
        s.methods.map((m: any) => [
          s.seed,
          s.count,
          m.id,
          m.recall_at_25,
          m.pairwise_f1,
          m.benign_contamination,
          m.queue_size,
          m.alerts_reviewed_at_25,
        ]),
      ),
    ];
    const url = URL.createObjectURL(
      new Blob([rows.map((r: any[]) => r.join(",")).join("\n")], {
        type: "text/csv",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "utopia-heldout-measurements.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="benchmark-lab">
      <div className="panel benchmark-hero">
        <span className="eyebrow">REPRODUCIBLE RESEARCH</span>
        <h2>Make the trade-offs visible.</h2>
        <p className="benchmark-note">
          {report.samples.length} held-out runs · {report.held_out_seeds.length}{" "}
          seeds at each scale · {report.sweeps.length} stress experiments ·{" "}
          {report.ablations.length} diagnostic ablations. Configuration is
          frozen before execution; bootstrap intervals use{" "}
          {report.protocol?.bootstrap_replicates ?? 0} resamples.
        </p>
        <div className="benchmark-controls">
          <button className="button secondary" onClick={csv}>
            <Download size={16} />
            Download CSV
          </button>
          <a
            className="button secondary"
            href="/benchmark-report.json"
            download
          >
            Full reproducibility artifact
          </a>
          <button className="button secondary" onClick={() => window.print()}>
            Print / save PDF
          </button>
        </div>
      </div>
      <div className="panel">
        <div className="panel-heading">
          <h2>Method comparison with uncertainty</h2>
          <div className="benchmark-controls">
            <label>
              Batch
              <select
                aria-label="Batch"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              >
                {report.aggregates.map((a: any) => (
                  <option key={a.count} value={a.count}>
                    {a.count.toLocaleString()} alerts
                  </option>
                ))}
              </select>
            </label>
            <label>
              Metric
              <select
                aria-label="Metric"
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
              >
                {[
                  ["recall_at_25", "Episode recall @25"],
                  ["pairwise_f1", "Grouping F1"],
                  ["benign_contamination", "Benign contamination"],
                  ["episode_completeness", "Episode completeness"],
                  ["queue_size", "Queue size"],
                  ["alerts_reviewed_at_25", "Source alerts exposed @25"],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={310}>
          <BarChart data={chart}>
            <CartesianGrid stroke="#263041" vertical={false} />
            <XAxis dataKey="name" stroke="#9aaabd" tick={{ fontSize: 11 }} />
            <YAxis stroke="#9aaabd" />
            <Tooltip
              contentStyle={{
                background: "#111a28",
                border: "1px solid #344055",
              }}
            />
            <Bar
              isAnimationActive={false}
              dataKey="mean"
              fill="#64e0bb"
              radius={[5, 5, 0, 0]}
            >
              <ErrorBar dataKey="error" width={8} stroke="#c8f7e9" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="benchmark-note">
          Whiskers show 95% bootstrap intervals across seeds. Lower is better
          for contamination and queue size; higher for recall, F1 and
          completeness. Accuracy on synthetic data does not establish
          performance in production.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>METHOD</th>
                <th>MEAN</th>
                <th>95% INTERVAL</th>
                <th>MIN–MAX</th>
                <th>VALID N</th>
              </tr>
            </thead>
            <tbody>
              {aggregate.methods.map((m: any) => {
                const v = m.metrics[metric],
                  format = (n: number) =>
                    ["queue_size", "alerts_reviewed_at_25"].includes(metric)
                      ? n.toFixed(1)
                      : pct(n);
                return (
                  <tr key={m.id}>
                    <td>{names[m.id]}</td>
                    <td className="bench-metric">{format(v.mean)}</td>
                    <td>{v.ci95?.map(format).join(" – ") ?? "Unavailable"}</td>
                    <td>
                      {format(v.min)} – {format(v.max)}
                    </td>
                    <td>{v.n}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel">
        <h2>Variation across held-out seeds</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={seedData}>
            <CartesianGrid stroke="#263041" />
            <XAxis dataKey="seed" stroke="#9aaabd" />
            <YAxis stroke="#9aaabd" />
            <Tooltip contentStyle={{ background: "#111a28" }} />
            <Legend />
            {["B0", "B1", "B2", "B3", "UT"].map((id, i) => (
              <Line
                key={id}
                dataKey={id}
                name={names[id]}
                stroke={
                  ["#8c9fb8", "#d3b377", "#b29ce3", "#7eb3d5", "#64e0bb"][i]
                }
                dot={{ r: 2 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="panel">
        <h2>Paired recall improvement @25</h2>
        <p className="benchmark-note">
          Within each seed, compare Utopia with a baseline on exactly the same
          alerts. Negative values indicate a baseline advantage.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>BASELINE</th>
                <th>MEAN DIFFERENCE</th>
                <th>95% BOOTSTRAP INTERVAL</th>
              </tr>
            </thead>
            <tbody>
              {report.paired
                .filter((p: any) => p.count === count)
                .map((p: any) => (
                  <tr key={p.baseline}>
                    <td>{names[p.baseline]}</td>
                    <td>{(p.mean * 100).toFixed(1)} percentage points</td>
                    <td>
                      {p.ci95
                        .map((n: number) => (n * 100).toFixed(1))
                        .join(" – ")}{" "}
                      pp
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel">
        <h2>Robustness and failure conditions</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>CONDITION</th>
                <th>VALID RUNS</th>
                <th>UT RECALL @25</th>
                <th>B0 RECALL @25</th>
                <th>CONTAMINATION</th>
              </tr>
            </thead>
            <tbody>
              {stress.map((s: any) => (
                <tr key={s.condition}>
                  <td>
                    <code>{s.condition}</code>
                  </td>
                  <td>
                    {s.ok} / {s.total}
                  </td>
                  <td>{s.recall === null ? "Unavailable" : pct(s.recall)}</td>
                  <td>
                    {s.baseline === null ? "Unavailable" : pct(s.baseline)}
                  </td>
                  <td>
                    {s.contamination === null
                      ? "Unavailable"
                      : pct(s.contamination)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel">
        <h2>Algorithm ablations · 3,000 alerts</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>DISABLED / CHANGED</th>
                <th>VALID N</th>
                <th>RECALL @25</th>
                <th>GROUPING F1</th>
                <th>CONTAMINATION</th>
              </tr>
            </thead>
            <tbody>
              {report.protocol.ablations.map((variant: string) => {
                const values = report.ablations.filter(
                  (a: any) => a.variant === variant && a.status === "ok",
                );
                const avg = (key: string) =>
                  values.length
                    ? pct(
                        values.reduce(
                          (sum: number, a: any) => sum + a.metric[key],
                          0,
                        ) / values.length,
                      )
                    : "Unavailable";
                return (
                  <tr key={variant}>
                    <td>{variant}</td>
                    <td>
                      {values.length} / {report.held_out_seeds.length}
                    </td>
                    <td>{avg("recall_at_25")}</td>
                    <td>{avg("pairwise_f1")}</td>
                    <td>{avg("benign_contamination")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {replay && (
        <div className="panel">
          <h2>Temporal replay</h2>
          <p className="benchmark-note">
            {replay.checkpoint_minutes}-minute event-time snapshots. Prefix-only
            triage prevents looking ahead; delay measures alert visibility in
            the top {replay.budget} rows, not human detection time.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>SEED</th>
                  <th>OBSERVABLE EPISODES</th>
                  <th>SURFACED</th>
                  <th>MEDIAN VISIBILITY DELAY</th>
                </tr>
              </thead>
              <tbody>
                {replay.samples.map((s: any) => (
                  <tr key={s.seed}>
                    <td>{s.seed}</td>
                    <td>{s.observable}</td>
                    <td>{s.surfaced}</td>
                    <td>{s.median_delay_minutes?.toFixed(1) ?? "NR"} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <a href="/replay-report.json" download>
            Download replay artifact
          </a>
        </div>
      )}
      {external && (
        <div className="panel">
          <span className="eyebrow">EXTERNAL DATA, SEPARATE EVIDENCE</span>
          <h2>AIT Alert Data Set ingestion check</h2>
          <p className="benchmark-note">
            Checksum-verified public archive ·{" "}
            {external.sample_records?.toLocaleString()} sampled source records ·{" "}
            {external.accepted?.toLocaleString()} normalized ·{" "}
            {external.rejected} rejected. {external.label_policy}
          </p>
          <a
            className="button secondary"
            href="/external-validation.json"
            download
          >
            External validation artifact <Download size={15} />
          </a>
        </div>
      )}
      <div className="panel limits-panel">
        <h2>
          <FlaskConical size={18} /> What the measurements establish
        </h2>
        {report.limitations.map((l: string) => (
          <div className="limit-item" key={l}>
            <Info size={15} />
            <span>{l}</span>
          </div>
        ))}
        <p className="mono small-text">
          Protocol SHA-256: {report.protocol_sha256}
        </p>
      </div>
    </div>
  );
}
