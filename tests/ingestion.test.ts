import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalize,
  extractRecords,
  IMPORT_DEFAULTS,
} from "../core/ingestion/normalize";
import { assessDocument } from "../core/ingestion/assessment";
const hash = "a".repeat(64);
const base = {
  alert_id: "a",
  timestamp: "2026-01-01T00:00:00Z",
  source: "edr",
  alert_type: "powershell",
  severity: 2,
  entities: ["host:x"],
  description: "Observed behavior",
};
test("canonical upload preserves validated values and provenance; evaluation fields cannot enter engine", () => {
  const r = normalize(
    extractRecords([{ ...base, episode: "PRIVATE" }]),
    "a.json",
    hash,
  );
  assert.equal(r.alerts.length, 1);
  assert.equal("episode" in r.alerts[0], false);
  assert.equal(r.alerts[0].provenance?.record, 1);
  assert.equal(r.alerts[0].provenance?.file_sha256, hash);
});
test("Sentinel value wrapper and JSON entities normalize without inventing criticality", () => {
  const r = normalize(
    extractRecords(
      JSON.parse(readFileSync("public/examples/sentinel-alerts.json", "utf8")),
    ),
    "sentinel.json",
    hash,
  );
  assert.equal(r.alerts.length, 2);
  assert.deepEqual(r.alerts[0].entities, ["host:WS-007", "user:analyst"]);
  assert.equal(r.alerts[1].severity, 3);
  assert.equal(r.alerts[1].asset_criticality, undefined);
  assert.equal(r.alerts[1].alert_type, "credential_dump");
});
test("numeric ECS severity requires explicit source scale", () => {
  const records = extractRecords([
    {
      "@timestamp": base.timestamp,
      event: { kind: "alert", severity: 70, action: "unknown" },
      host: { name: "x" },
    },
  ]);
  assert.equal(normalize(records, "ecs.json", hash).report.rejected, 1);
  const r = normalize(records, "ecs.json", hash, {
    ...IMPORT_DEFAULTS,
    severityScale: "percent",
  });
  assert.equal(r.alerts[0].severity, 3);
});
test("naive timestamps need confirmation; malformed dates remain rejected", () => {
  const records = extractRecords([
    { ...base, timestamp: "2026-01-01T05:30:00" },
    { ...base, alert_id: "b", timestamp: "yesterday" },
  ]);
  assert.equal(normalize(records, "a.json", hash).report.accepted, 0);
  const r = normalize(records, "a.json", hash, {
    ...IMPORT_DEFAULTS,
    timezone: "UTC",
  });
  assert.equal(r.alerts.length, 1);
  assert.equal(r.alerts[0].provenance?.timestamp_basis, "user-confirmed UTC");
});
test("Wazuh / Suricata use explicit scales with inverse IDS severity and known techniques", () => {
  const w = normalize(
    extractRecords([
      {
        "@timestamp": base.timestamp,
        rule: { level: 12, description: "Alert", mitre: { id: ["T1003.001"] } },
        predecoder: { hostname: "mail" },
        agent: { name: "collector" },
        data: { srcuser: "admin", srcip: "10.0.0.8" },
      },
    ]),
    "w.json",
    hash,
  );
  assert.equal(w.alerts[0].severity, 3);
  assert.ok(w.alerts[0].entities.includes("host:mail"));
  assert.equal(w.alerts[0].alert_type, "credential_dump");
  const s = normalize(
    extractRecords([
      {
        timestamp: base.timestamp,
        event_type: "alert",
        src_ip: "10.0.0.1",
        dest_ip: "198.51.100.8",
        alert: { signature: "unknown", severity: 1 },
      },
    ]),
    "s.json",
    hash,
  );
  assert.equal(s.alerts[0].severity, 3);
  assert.equal(s.alerts[0].source, "ids");
  assert.equal(s.alerts[0].entities.length, 2);
});
test("Azure column tables and Elastic _source hits use their original records", () => {
  assert.deepEqual(
    extractRecords({
      tables: [{ columns: [{ name: "a" }, { name: "b" }], rows: [[1, 2]] }],
    })[0].value,
    { a: 1, b: 2 },
  );
  assert.equal(
    extractRecords({
      hits: { hits: [{ _id: "x", _source: { timestamp: "t" } }] },
    })[0].value._id,
    "x",
  );
});
test("repeated vendor identifiers get distinct source-row IDs; rejected rows are accounted", () => {
  const r = normalize(
    extractRecords([base, base, { ...base, severity: 12 }]),
    "a.json",
    hash,
  );
  assert.equal(r.report.accepted, 2);
  assert.equal(r.report.rejected, 1);
  assert.notEqual(r.alerts[0].alert_id, r.alerts[1].alert_id);
  assert.ok(r.report.issues.some((i) => i.message.includes("Repeated")));
});
test("narrative evidence retains quotes/pages and never invents event timestamps or attack accuracy", () => {
  const r = assessDocument(
    [
      {
        page: 3,
        text: "High severity credential access T1003.001 mentioned 203.0.113.8. A malformed address 999.0.0.1.",
      },
    ],
    "report.pdf",
    hash,
  );
  assert.equal(r.findings[0].page, 3);
  assert.ok(r.indicators.includes("203.0.113.8"));
  assert.ok(!r.indicators.includes("999.0.0.1"));
  assert.equal("alerts" in r, false);
  assert.equal("recall" in r, false);
  assert.equal("timestamp" in r.findings[0], false);
});
