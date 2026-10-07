import { Activity, Pause, Play, Radio, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Alert } from "../../core/contracts";
import { api, fmt, time } from "../lib/api";

export function SimulationTheater({
  runId,
  onInspect,
}: {
  runId: string;
  onInspect: (alertId: string) => void;
}) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setCursor(0);
    setPlaying(true);
    async function load() {
      const first = await api(`runs/${runId}/alerts?offset=0&limit=200`);
      const pages = Math.ceil(first.total / 200);
      const rest = await Promise.all(
        Array.from({ length: Math.max(0, pages - 1) }, (_, index) =>
          api(`runs/${runId}/alerts?offset=${(index + 1) * 200}&limit=200`),
        ),
      );
      if (live) {
        setAlerts(
          [...first.items, ...rest.flatMap((page) => page.items)].sort(
            (a, b) => a.timestamp.localeCompare(b.timestamp) || a.alert_id.localeCompare(b.alert_id),
          ),
        );
        setLoading(false);
      }
    }
    void load().catch(() => live && setLoading(false));
    return () => { live = false; };
  }, [runId]);

  useEffect(() => {
    if (!playing || loading || cursor >= alerts.length) return;
    const timer = window.setInterval(
      () => setCursor((current) => Math.min(alerts.length, current + 1)),
      Math.max(8, Math.round(32 / speed)),
    );
    return () => window.clearInterval(timer);
  }, [playing, loading, cursor, alerts.length, speed]);

  const visible = useMemo(
    () => alerts.slice(Math.max(0, cursor - 10), cursor).reverse(),
    [alerts, cursor],
  );
  const active = cursor > 0 && cursor < alerts.length;

  return (
    <section className="panel theater" aria-label="Chronological SOC alert replay">
      <div className="theater-heading">
        <div>
          <span className="eyebrow">SOC FLOOR · CHRONOLOGICAL REPLAY</span>
          <h2><Radio size={19} className={active ? "signal-live" : ""} /> {loading ? "Loading recorded telemetry" : cursor >= alerts.length ? "Replay complete" : "Alert stream in progress"}</h2>
          <p>{loading ? "Reading the saved source records…" : "One to two hours of simulation time, compressed into a fast reviewable stream."}</p>
        </div>
        <div className="theater-controls">
          <label>Replay speed<select aria-label="Replay speed" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}><option value="1">1× · 30/sec</option><option value="2">2× · 60/sec</option><option value="4">4× · 120/sec</option></select></label>
          <button className="button secondary" disabled={loading || cursor >= alerts.length} onClick={() => setPlaying((value) => !value)}>{playing ? <Pause size={15} /> : <Play size={15} />}{playing ? "Pause" : "Resume"}</button>
          <button className="button secondary" disabled={loading} onClick={() => { setCursor(0); setPlaying(true); }}><RotateCcw size={15} />Restart</button>
        </div>
      </div>
      <div className="theater-progress"><span style={{ width: `${alerts.length ? (cursor / alerts.length) * 100 : 0}%` }} /></div>
      <div className="theater-metrics"><div><strong>{fmt(cursor)}</strong><span>alerts observed</span></div><div><strong>{fmt(alerts.length - cursor)}</strong><span>in replay buffer</span></div><div><strong>{active ? "STREAMING" : cursor >= alerts.length && alerts.length ? "COMPLETE" : "READY"}</strong><span>replay state</span></div><div><strong>{cursor ? time(alerts[cursor - 1].timestamp) : "—"}</strong><span>simulated UTC time</span></div></div>
      <div className="theater-feed" aria-live="polite">
        {visible.map((alert: Alert, index) => (
          <button className="theater-alert" key={alert.alert_id} onClick={() => onInspect(alert.alert_id)} style={{ animationDelay: `${index * 18}ms` }}>
            <span className={`severity level${alert.severity}`}>{alert.severity}/4</span>
            <span className={`source-tag ${alert.source}`}>{alert.source.toUpperCase()}</span>
            <span className="theater-alert-main"><strong>{alert.alert_type.replaceAll("_", " ")}</strong><small>{alert.entities.slice(0, 2).join(" · ") || "No entity telemetry"}</small></span>
            <span className="mono theater-time">{time(alert.timestamp)}</span>
            <Activity size={15} />
          </button>
        ))}
        {!loading && !visible.length && <div className="theater-empty">Waiting for first source alert…</div>}
      </div>
      <div className="flow-note"><Activity size={15} />Replay uses the stored alerts in event-time order. Click any row to inspect its incident assignment, ranking, score factors and correlation links.</div>
    </section>
  );
}
