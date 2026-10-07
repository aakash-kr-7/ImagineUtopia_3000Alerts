import { initialState, advanceScenario } from "./scenarios";
import { canonical } from "../contracts";
import { batchSchema, type Alert } from "../contracts";
import { detect } from "./detectors";
import type { Asset, Episode, SecurityEvent } from "./model";
interface Dataset {
  config: { count: number; episodes: number };
  alerts: Alert[];
  events: SecurityEvent[];
  eventLabels: Record<string, string>;
  truth: {
    labels: Record<string, string>;
    episodes: Record<string, { alert_ids: string[] }>;
  };
  episodes: Record<string, Episode>;
  inventory: { assets: Asset[] };
}
export function validateSimulation(s: Dataset) {
  const errors: string[] = [],
    warnings: string[] = [];
  if (!batchSchema.safeParse(s.alerts).success)
    errors.push("Alert contract failed");
  if (s.alerts.length !== s.config.count)
    errors.push("Requested alert count mismatch");
  const eventMap = new Map(s.events.map((e) => [e.id, e])),
    assets = new Map(s.inventory.assets.map((a) => [a.id, a]));
  if (eventMap.size !== s.events.length) errors.push("Duplicate event IDs");
  if (Object.keys(s.truth.labels).length !== s.alerts.length)
    errors.push("Label count mismatch");
  if (Object.keys(s.episodes).length !== s.config.episodes)
    errors.push("Episode count mismatch");
  let duplicates = 0,
    unobservable = 0;
  const references = new Set<string>();
  for (const a of s.alerts) {
    const e = eventMap.get(a.raw_reference?.replace("synthetic://", "") ?? "");
    if (!e) {
      errors.push("Broken alert-event provenance");
      continue;
    }
    if (references.has(e.id)) duplicates++;
    references.add(e.id);
    if (!detect(e)) errors.push("Alert emitted without a satisfied detector");
    if (a.asset_criticality !== assets.get(e.host)?.criticality)
      errors.push("Asset criticality differs from inventory");
    if (s.truth.labels[a.alert_id] !== s.eventLabels[e.id])
      errors.push("Alert label disagrees with event provenance");
    if (Math.abs(Date.parse(a.timestamp) - Date.parse(e.timestamp)) > 1000)
      errors.push("Alert timestamp differs from event");
  }
  for (const [id, ep] of Object.entries(s.episodes)) {
    if (!ep.alert_ids.length) {
      unobservable++;
      warnings.push(
        `${id}: no alerts observed; retained in recall denominator`,
      );
    }
    let state = initialState(ep.family);
    if (canonical(state) !== canonical(ep.initial_state))
      errors.push("Invalid initial scenario state");
    for (let i = 0; i < ep.stages.length; i++) {
      const stage = ep.stages[i],
        e = eventMap.get(stage.event_id);
      try {
        if (canonical(state) !== canonical(stage.state_before))
          errors.push("Broken scenario precondition trace");
        state = advanceScenario(state, stage.behavior);
        if (canonical(state) !== canonical(stage.state_after))
          errors.push("Broken scenario transition trace");
      } catch {
        errors.push("Unmet scenario prerequisite");
      }
      if (
        !e ||
        e.behavior !== stage.behavior ||
        e.timestamp !== stage.timestamp
      )
        errors.push("Broken scenario stage");
      if (i && stage.timestamp <= ep.stages[i - 1].timestamp)
        errors.push("Scenario stage order violated");
    }
    if (ep.alert_ids.some((a) => s.truth.labels[a] !== id))
      errors.push("Episode membership mismatch");
    if (
      JSON.stringify(ep.alert_ids) !==
      JSON.stringify(s.truth.episodes[id]?.alert_ids)
    )
      errors.push("Truth episode list differs");
  }
  const attackTypes = new Set(
    s.alerts
      .filter((a) => s.truth.labels[a.alert_id] !== "BENIGN")
      .map((a) => a.alert_type),
  );
  const lookalikes = s.alerts.filter(
    (a) =>
      s.truth.labels[a.alert_id] === "BENIGN" && attackTypes.has(a.alert_type),
  ).length;
  if (!lookalikes)
    warnings.push("No benign detection lookalikes in this batch");
  const severity = Object.fromEntries(
    ["BENIGN", "ATTACK"].map((kind) => [
      kind,
      Array.from(
        { length: 5 },
        (_, level) =>
          s.alerts.filter(
            (a) =>
              a.severity === level &&
              (s.truth.labels[a.alert_id] === "BENIGN") === (kind === "BENIGN"),
          ).length,
      ),
    ]),
  );
  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)],
    warnings,
    checks: [
      "schema",
      "exact count",
      "unique event IDs",
      "label cardinality",
      "detector provenance",
      "inventory criticality",
      "scenario ordering",
      "causal state transitions",
      "episode membership",
    ],
    diagnostics: {
      raw_events: s.events.length,
      unalerted_events: s.events.length - references.size,
      duplicate_alerts: duplicates,
      benign_lookalikes: lookalikes,
      missing_entity_alerts: s.alerts.filter((a) => !a.entities.length).length,
      unobservable_episodes: unobservable,
      severity_histograms: severity,
    },
    caveats: [
      "Structural validation is not proof of production representativeness.",
      "Fixed alert-count sampling conditions benign activity volume.",
      "Simulator produces telemetry only; it never runs exploits or contacts targets.",
    ],
  };
}
