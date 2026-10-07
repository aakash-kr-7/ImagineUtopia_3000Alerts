import {
  ExternalLink,
  Eye,
  Info,
  Layers,
  LoaderCircle,
  Network,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Incident } from "../../core/contracts";
import { api, fmt, pct } from "../lib/api";
import { Stat } from "./Stat";
import { UnlabeledComparison } from "./UnlabeledComparison";
export function EvaluationView({
  runId,
  onOpen,
  incidents,
}: {
  runId: string;
  onOpen: (s: string) => void;
  incidents: Incident[];
}) {
  const [report, setReport] = useState<any>(undefined),
    [error, setError] = useState(""),
    [budget, setBudget] = useState(100);
  useEffect(() => {
    let live = true;
    setReport(undefined);
    api(`runs/${runId}/evaluation`)
      .then((d) => {
        if (live) setReport(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [runId]);
  if (error) return <div className="error-banner">{error}</div>;
  if (report === undefined)
    return (
      <div className="loading-panel">
        <LoaderCircle className="spin" />
        Loading measured results…
      </div>
    );
  if (report === null)
    return (
      <UnlabeledComparison
        runId={runId}
        onLabeled={() => {
          api(`runs/${runId}/evaluation`)
            .then(setReport)
            .catch((e) => setError(e.message));
        }}
      />
    );
  const ut = report.methods.find((m: any) => m.id === "UT"),
    b0 = report.methods[0],
    colors = ["#8996ad", "#c3a1f6", "#efa863", "#7eb3d5", "#64e0bb"];
  const all = Array.from(
    { length: Math.max(...report.methods.map((m: any) => m.queue_size)) + 1 },
    (_, k) =>
      Object.fromEntries([
        ["k", k],
        ...report.methods.map((m: any) => [
          m.id,
          m.curve[Math.min(k, m.queue_size)].recall * 100,
        ]),
      ]),
  ).filter(
    (x: any, i, a) =>
      i === 0 ||
      i === a.length - 1 ||
      report.methods.some((m: any) => x[m.id] !== a[i - 1][m.id]),
  );
  return (
    <>
      <div className="evaluation-boundary">
        <ShieldCheck size={19} />
        <div>
          <strong>Evaluation-only ground truth</strong>
          <span>
            {report.episode_count} independent episodes ·{" "}
            {fmt(report.attack_alerts)} attack alerts ·{" "}
            {fmt(report.benign_alerts)} benign alerts. Labels never enter the
            triage engine.
          </span>
        </div>
      </div>
      <div className="stats-grid">
        <Stat
          label="Episode recall @25"
          value={pct(ut.recall_at_25)}
          subtitle={`Severity baseline: ${pct(b0.recall_at_25)}`}
          icon={<Eye size={18} />}
          spark="mint"
        />
        <Stat
          label="Items for full coverage"
          value={ut.items_at_100 === null ? "NR" : fmt(ut.items_at_100)}
          subtitle={`Severity baseline: ${b0.items_at_100 ?? "NR"} items`}
          icon={<Layers size={18} />}
          spark="blue"
        />
        <Stat
          label="Grouping F1"
          value={pct(ut.pairwise_f1)}
          subtitle="Attack pairs · benign pairs penalized"
          icon={<Network size={18} />}
          spark="purple"
        />
        <Stat
          label="Benign contamination"
          value={pct(ut.benign_contamination)}
          subtitle={`${ut.benign_alerts_in_attack_items} / ${ut.benign_alerts_in_attack_items + ut.attack_alerts_in_attack_items} alerts in attack-containing items`}
          icon={<TriangleAlert size={18} />}
          spark="red"
        />
      </div>
      <div className="panel chart-panel">
        <div className="panel-heading">
          <div>
            <h2>Attack coverage vs. review workload</h2>
            <p>One opened review item exposes its source evidence.</p>
          </div>
          <div className="budget-control">
            <label htmlFor="budget">
              Review budget <strong>{budget} items</strong>
            </label>
            <input
              id="budget"
              type="range"
              min="25"
              max={Math.max(100, report.benign_alerts + report.attack_alerts)}
              step="25"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
            />
          </div>
        </div>
        <div
          className="chart"
          role="img"
          aria-label={`Episode coverage chart. Utopia reaches full coverage after ${ut.items_at_100} items, severity baseline after ${b0.items_at_100}.`}
        >
          <ResponsiveContainer width="100%" height={320}>
            <LineChart
              data={all}
              margin={{ top: 18, right: 22, bottom: 10, left: 4 }}
            >
              <CartesianGrid stroke="#263041" vertical={false} />
              <XAxis
                dataKey="k"
                type="number"
                domain={[0, budget]}
                allowDataOverflow
                stroke="#8d99ac"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(x) => x + "%"}
                stroke="#8d99ac"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  background: "#111a28",
                  border: "1px solid #344055",
                  borderRadius: 8,
                }}
                labelFormatter={(l) => `${l} review items`}
                formatter={(v: any, n: any) => [
                  Number(v).toFixed(1) + "%",
                  report.methods.find((m: any) => m.id === n)?.name ?? n,
                ]}
              />
              <ReferenceLine
                x={25}
                stroke="#61718a"
                strokeDasharray="4 5"
                label={{
                  value: "K = 25",
                  fill: "#9ca8ba",
                  fontSize: 12,
                  position: "insideTopRight",
                }}
              />
              {report.methods.map((m: any, i: number) => (
                <Line
                  key={m.id}
                  type="stepAfter"
                  dataKey={m.id}
                  stroke={colors[i]}
                  strokeWidth={m.id === "UT" ? 3 : 1.6}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-legend">
          {report.methods.map((m: any, i: number) => (
            <span key={m.id}>
              <i style={{ background: colors[i] }} />
              {m.name}
            </span>
          ))}
        </div>
        <div className="flow-note">
          <Info size={14} />
          Queue size is a workload proxy; this does not measure analyst minutes
          or breach prevention.
        </div>
      </div>
      <div className="panel">
        <div className="panel-heading">
          <h2>Baseline comparison</h2>
          <span className="muted small-text">
            Identical input · deterministic ordering
          </span>
        </div>
        <div className="table-scroll">
          <table className="metrics-table">
            <thead>
              <tr>
                <th>METHOD</th>
                <th>QUEUE</th>
                <th>RECALL @10</th>
                <th>RECALL @25</th>
                <th>ITEMS @100%</th>
                <th>PAIR PRECISION</th>
                <th>PAIR RECALL</th>
                <th>PAIR F1</th>
              </tr>
            </thead>
            <tbody>
              {report.methods.map((m: any) => (
                <tr key={m.id} className={m.id === "UT" ? "highlight-row" : ""}>
                  <td>
                    <strong>{m.name}</strong>
                    <small className="muted">
                      {m.id === "UT"
                        ? "Graph + ATT&CK + contextual risk"
                        : m.id}
                    </small>
                  </td>
                  <td>{fmt(m.queue_size)}</td>
                  <td>{pct(m.recall_at_10)}</td>
                  <td>{pct(m.recall_at_25)}</td>
                  <td>{m.items_at_100 ?? "NR"}</td>
                  <td>{pct(m.pairwise_precision)}</td>
                  <td>{pct(m.pairwise_recall)}</td>
                  <td>{pct(m.pairwise_f1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flow-note">
          Pairwise positives are same-attack alert pairs. BENIGN is never
          treated as one shared episode. “—” means no predicted pairs.
        </div>
      </div>
      <div className="evaluation-grid">
        <div className="panel">
          <div className="panel-heading">
            <h2>Episode visibility</h2>
            <span className="muted small-text">First opened item rank</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>EPISODE / FAMILY</th>
                  <th>SEVERITY</th>
                  <th>UTOPIA</th>
                </tr>
              </thead>
              <tbody>
                {report.episodes.map((e: any) => (
                  <tr key={e.id}>
                    <td>
                      <strong>{e.family}</strong>
                      <small className="mono muted">
                        {e.id} · {e.alerts} alerts
                      </small>
                    </td>
                    <td>#{e.ranks.B0 ?? "NR"}</td>
                    <td className="mint-text">#{e.ranks.UT ?? "NR"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="panel limits-panel">
          <h2>What these results establish</h2>
          <p>
            On this synthetic batch, the curve measures how many attack episodes
            become visible as analysts open queue items.
          </p>
          <h3>Where the evidence stops</h3>
          {report.limitations.map((s: string) => (
            <div className="limit-item" key={s}>
              <Info size={15} />
              <span>{s}</span>
            </div>
          ))}
          <a
            className="button secondary"
            href="/benchmark-report.json"
            target="_blank"
          >
            Held-out benchmark report <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </>
  );
}
