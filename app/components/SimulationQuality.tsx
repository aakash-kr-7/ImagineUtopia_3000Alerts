import { Activity, ShieldCheck } from "lucide-react";
export function SimulationQuality({ manifest }: { manifest: any }) {
  const v = manifest?.simulation_validation;
  if (!v) return null;
  return (
    <div className="panel simulation-quality">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">VALIDATED EVENT-LEVEL DATASET</span>
          <h2>
            <ShieldCheck size={20} />{" "}
            {v.valid ? "Structural checks passed" : "Validation failed"}
          </h2>
          <p>
            {manifest.generator_version} · detector {manifest.detector_version}
          </p>
        </div>
        <span className="verified">{v.checks.length} invariants</span>
      </div>
      <div className="quality-grid">
        {[
          ["Raw events", v.diagnostics.raw_events],
          ["Routine unalerted events", v.diagnostics.unalerted_events],
          ["Duplicate notifications", v.diagnostics.duplicate_alerts],
          ["Benign lookalikes", v.diagnostics.benign_lookalikes],
          ["Unobservable episodes", v.diagnostics.unobservable_episodes],
          ["Blocked graph links", manifest.diagnostics?.blocked_edges ?? 0],
        ].map(([k, n]) => (
          <div key={k as string}>
            <span>{k}</span>
            <strong>{Number(n).toLocaleString()}</strong>
          </div>
        ))}
      </div>
      <div className="flow-note">
        <Activity size={15} />
        Sensors generate alerts from events. Labels stay outside the operational
        engine. {v.caveats[0]}
      </div>
      {v.warnings.map((w: string) => (
        <p className="inline-note" key={w}>
          {w}
        </p>
      ))}
    </div>
  );
}
