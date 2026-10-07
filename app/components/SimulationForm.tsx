import {
  FileText,
  Network,
  Play,
  ShieldCheck,
  TriangleAlert,
  Users,
} from "lucide-react";
import { useState } from "react";
export function SimulationForm({
  busy,
  onSubmit,
  error,
  expanded = false,
}: {
  busy: boolean;
  onSubmit: (x: any) => void;
  error: string;
  expanded?: boolean;
}) {
  const [seed, setSeed] = useState(() =>
      Math.floor(Math.random() * 2_000_000_000),
    ),
    [count, setCount] = useState(0),
    [episodes, setEpisodes] = useState(5),
    [missing, setMissing] = useState(0),
    [hub, setHub] = useState("normal"),
    [timing, setTiming] = useState("normal"),
    [severity, setSeverity] = useState("weak"),
    [coverage, setCoverage] = useState(95),
    [duplicates, setDuplicates] = useState(8),
    [overlap, setOverlap] = useState(false),
    [duration, setDuration] = useState(0);
  return (
    <div className={expanded ? "simulation-layout" : ""}>
      <form
        className="simulation-form"
        onSubmit={(e) => {
          e.preventDefault();
          const actualCount = count || 450 + Math.floor(Math.random() * 451);
          const actualEpisodes = Math.min(
            episodes,
            Math.floor(actualCount / 15),
          );
          const actualDuration = duration || (Math.random() < 0.5 ? 1 : 2);
          onSubmit({
            seed,
            count: actualCount,
            episodes: actualEpisodes,
            missing: missing / 100,
            hub_density: hub,
            timing,
            severity_quality: severity,
            sensor_coverage: coverage / 100,
            duplicate_rate: duplicates / 100,
            attack_overlap: overlap,
            duration_hours: actualDuration,
          });
        }}
      >
        {!expanded && (
          <p className="simulation-quick-intro">
            A fictional one- or two-hour SOC shift with a randomized alert
            volume. The saved run replays in time order and opens on its
            incident groups.
          </p>
        )}
        {expanded && (
          <div className="panel-heading">
            <h2>Run configuration</h2>
            <span className="muted small-text">Seeded · randomized volume</span>
          </div>
        )}
        <details className="simulation-advanced">
          <summary>Adjust the demo (optional)</summary>
          <div className="form-grid">
            <label>
              Random seed
              <input
                type="number"
                min="0"
                max="2147483647"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value))}
                required
              />
            </label>
            <label>
              Alert volume
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              >
                <option value="0">Random · 450–900 alerts</option>
                <option value="500">500 alerts</option>
                <option value="750">750 alerts</option>
                <option value="900">900 alerts</option>
                <option value="1000">1,000 alerts</option>
              </select>
            </label>
            <label>
              Attack episodes
              <input
                type="number"
                min="1"
                max="30"
                value={episodes}
                onChange={(e) => setEpisodes(Number(e.target.value))}
                required
              />
            </label>
            <label>
              Severity quality
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
              >
                <option value="weak">Weak · mixed severity</option>
                <option value="aligned">Aligned with behavior</option>
                <option value="misleading">
                  Misleading · inverted detector severity
                </option>
              </select>
            </label>
            <label>
              Shared hub density
              <select value={hub} onChange={(e) => setHub(e.target.value)}>
                <option value="normal">Normal · distributed IPs</option>
                <option value="high">High · one shared NAT</option>
              </select>
            </label>
            <label>
              Attack step timing
              <select
                value={timing}
                onChange={(e) => setTiming(e.target.value)}
              >
                <option value="normal">Normal · 4-minute gaps</option>
                <option value="stretched">
                  Stretched · spread across the window
                </option>
              </select>
            </label>
            <label>
              Observation duration
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                <option value="0">Random · 1 or 2 hours</option>
                <option value="1">1 hour</option>
                <option value="2">2 hours</option>
              </select>
            </label>
            <label>
              Episode start overlap
              <select
                value={String(overlap)}
                onChange={(e) => setOverlap(e.target.value === "true")}
              >
                <option value="false">
                  Distributed across observation window
                </option>
                <option value="true">Concurrent campaigns</option>
              </select>
            </label>
          </div>
          <label className="range-label">
            Sensor coverage <strong>{coverage}%</strong>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={coverage}
              onChange={(e) => setCoverage(Number(e.target.value))}
            />
          </label>
          <label className="range-label">
            Duplicate notifications <strong>{duplicates}%</strong>
            <input
              type="range"
              min="0"
              max="30"
              step="2"
              value={duplicates}
              onChange={(e) => setDuplicates(Number(e.target.value))}
            />
          </label>
          <label className="range-label">
            Missing entity telemetry <strong>{missing}%</strong>
            <input
              type="range"
              min="0"
              max="50"
              step="5"
              value={missing}
              onChange={(e) => setMissing(Number(e.target.value))}
            />
          </label>
        </details>
        <div className="inline-note">
          <ShieldCheck size={17} />
          Fictional data for a safe demonstration. Labels are checked only after
          triage.
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button primary full-width"
          disabled={busy}
          type="submit"
        >
          <Play size={16} /> {busy ? "Preparing the demo…" : "Start demo"}
        </button>
      </form>
      {expanded && (
        <div className="scenario-panel">
          <h2>Four scenario families</h2>
          <p className="muted">
            Controlled ATT&CK mappings, plus legitimate maintenance lookalikes.
          </p>
          {[
            {
              title: "Phishing → exfiltration",
              tags: ["T1566.001", "T1003.001", "T1041"],
              steps:
                "Attachment · execution · credentials · lateral access · outbound transfer",
              icon: FileText,
            },
            {
              title: "Identity compromise",
              tags: ["T1110.003", "T1078", "T1021.002"],
              steps:
                "Password spray · sign-in · discovery · credentials · remote service",
              icon: Users,
            },
            {
              title: "Ransomware chain",
              tags: ["T1078", "T1053.005", "T1486"],
              steps: "Sign-in · persistence · execution · file encryption",
              icon: ShieldCheck,
            },
            {
              title: "Command & control",
              tags: ["T1059.001", "T1071.004", "T1041"],
              steps: "Execution · periodic DNS · outbound transfer",
              icon: Network,
            },
          ].map((s) => (
            <div className="scenario-card" key={s.title}>
              <div>
                <s.icon size={19} />
                <h3>{s.title}</h3>
              </div>
              <p>{s.steps}</p>
              <div className="citation-row">
                {s.tags.map((t) => (
                  <span key={t} className="citation">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <div className="warning-note">
            <TriangleAlert size={18} />
            <span>
              Try 50% missing entities with stretched timing. Episode coverage
              may remain high while grouping recall deteriorates.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
