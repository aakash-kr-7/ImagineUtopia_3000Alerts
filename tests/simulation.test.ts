import test from "node:test";
import assert from "node:assert/strict";
import { simulate } from "../core/simulator";
import { validateSimulation } from "../core/simulation/validation";
import { detect } from "../core/simulation/detectors";
import { triage } from "../core/engine";
import { canonical } from "../core/contracts";
const s = simulate({ seed: 105, count: 1000, episodes: 8 });
test("event detector cannot see intent and identical event telemetry produces identical detections", () => {
  for (const event of s.events) {
    assert.equal("episode" in event, false);
    assert.equal("label" in event, false);
  }
  const event = s.events.find((e) => e.behavior === "memory_access")!;
  assert.deepEqual(detect(event), detect({ ...event, id: "different" }));
  assert.ok(s.validation.diagnostics.benign_lookalikes > 0);
  assert.ok(s.validation.diagnostics.unalerted_events > 0);
});
test("negative simulator validation catches broken topology, event reference and scenario order", () => {
  for (const mutate of [
    (v: typeof s) => {
      v.alerts[0].asset_criticality = 1;
    },
    (v: typeof s) => {
      v.alerts[0].raw_reference = "synthetic://missing";
    },
    (v: typeof s) => {
      const ep = Object.values(v.episodes)[0];
      ep.stages[1].timestamp = ep.stages[0].timestamp;
    },
    (v: typeof s) => {
      delete v.truth.labels[v.alerts[0].alert_id];
    },
  ]) {
    const copy = structuredClone(s);
    mutate(copy);
    assert.equal(validateSimulation(copy).valid, false);
  }
});
test("inventory criticality is stable for legitimate and attack detections on the same asset", () => {
  const byHost = new Map(s.inventory.assets.map((a) => [a.id, a.criticality]));
  const eventMap = new Map(s.events.map((e) => [e.id, e]));
  for (const a of s.alerts)
    assert.equal(
      a.asset_criticality,
      byHost.get(eventMap.get(a.raw_reference!.slice(12))!.host),
    );
});
test("sensor dropout retains planned episodes and deterministic generation", () => {
  const low = simulate({
    seed: 107,
    count: 1000,
    episodes: 8,
    sensor_coverage: 0.1,
  });
  assert.equal(Object.keys(low.truth.episodes).length, 8);
  assert.equal(low.alerts.length, 1000);
  assert.equal(canonical(low), canonical(simulate(low.config)));
});
test("constrained union prevents transitive span growth without dropping any evidence", () => {
  const a = s.alerts[0],
    alerts = Array.from({ length: 12 }, (_, i) => ({
      ...a,
      alert_id: `chain-${i}`,
      timestamp: new Date(
        Date.parse("2026-01-01T00:00:00Z") + i * 20 * 60000,
      ).toISOString(),
      alert_type: `unique-${i}`,
      entities: ["host:chain", "user:chain"],
    }));
  const r = triage(alerts, {
    use_idf: false,
    threshold: 0.2,
    max_component_hours: 1,
  });
  assert.ok(r.incidents.length > 1);
  assert.ok(r.diagnostics!.blocked_edges > 0);
  assert.equal(r.incidents.flatMap((i) => i.alert_ids).length, alerts.length);
  for (const i of r.incidents)
    assert.ok(Date.parse(i.last) - Date.parse(i.first) <= 3600000);
});
test("dedup severity changes preserve evidence but do not inflate accumulation", () => {
  const a = s.alerts[0],
    r = triage([
      { ...a, alert_id: "one", severity: 1 },
      { ...a, alert_id: "two", severity: 4 },
    ]);
  assert.equal(r.groups.length, 1);
  assert.equal(
    r.incidents[0].components.find((c) => c.key === "severity")?.value,
    25,
  );
  assert.equal(
    r.incidents[0].components.find((c) => c.key === "accumulation")?.value,
    0,
  );
});
test("scenario transition prerequisites and state trace are validated", async () => {
  const { advanceScenario, initialState } =
    await import("../core/simulation/scenarios");
  assert.throws(
    () =>
      advanceScenario(
        initialState("Phishing to exfiltration"),
        "remote_execution",
      ),
    /prerequisites/,
  );
  const copy = structuredClone(s);
  Object.values(copy.episodes)[0].stages[1].state_before.foothold = false;
  assert.equal(validateSimulation(copy).valid, false);
});
test("tactic progression requires strictly later event time and remains efficient for duplicate bursts", () => {
  const a = s.alerts[0],
    two = [
      {
        ...a,
        alert_id: "initial",
        alert_type: "suspicious_login",
        timestamp: "2026-01-01T00:00:00Z",
      },
      {
        ...a,
        alert_id: "later",
        alert_type: "credential_dump",
        timestamp: "2026-01-01T00:00:00Z",
      },
    ];
  const same = triage(two),
    later = triage([two[0], { ...two[1], timestamp: "2026-01-01T00:00:01Z" }]);
  assert.match(
    same.incidents[0].components.find((c) => c.key === "progression")!.reason,
    /no ordered/,
  );
  assert.match(
    later.incidents[0].components.find((c) => c.key === "progression")!.reason,
    /observed ordered/,
  );
  const burst = triage(
    Array.from({ length: 10000 }, (_, i) => ({
      ...a,
      alert_id: `burst-${i}`,
      alert_type: "credential_dump",
      timestamp: "2026-01-01T00:00:00Z",
    })),
  );
  assert.equal(burst.groups.length, 1);
  assert.equal(burst.incidents[0].alert_ids.length, 10000);
});
