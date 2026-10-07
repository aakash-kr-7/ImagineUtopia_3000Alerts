import { Activity, ShieldCheck } from "lucide-react";
export function SimulationQuality({ manifest }: { manifest: any }) {
  const v = manifest?.simulation_validation;
  if (!v) return null;
  return (
    <div className="panel simulation-quality">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">SIMULATION CHECKS</span>
          <h2>
            <ShieldCheck size={20} />{" "}
            {v.valid ? "Structural checks passed" : "Validation failed"}
          </h2>
          <p>
            Synthetic source events are kept separate from the alerts used for
            triage.
          </p>
        </div>
        <span
          className="verified"
          title="Automated structural consistency checks"
        >
          {v.checks.length} checks passed
        </span>
      </div>
      <div className="quality-grid">
        {[
          ["Raw events", v.diagnostics.raw_events],
          ["Routine unalerted events", v.diagnostics.unalerted_events],
          ["Duplicate notifications", v.diagnostics.duplicate_alerts],
          [
            "Legitimate activity that looks suspicious",
            v.diagnostics.benign_lookalikes,
          ],
          [
            "Campaigns with too little visible evidence",
            v.diagnostics.unobservable_episodes,
          ],
          ["Weak links excluded", manifest.diagnostics?.blocked_edges ?? 0],
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
