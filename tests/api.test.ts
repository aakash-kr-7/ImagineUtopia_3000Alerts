import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { handleApi } from "../server/api";
import type { Store } from "../server/storage";
function setup() {
  const db = new DatabaseSync(":memory:");
  for (const file of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    db.exec(readFileSync("drizzle/" + file, "utf8"));
  const store: Store = {
    async all(sql, args = []) {
      return db.prepare(sql).all(...(args as any[])) as any[];
    },
    async batch(statements) {
      db.exec("BEGIN");
      try {
        const r = statements.map((s) => ({
          changes: Number(
            db.prepare(s.sql).run(...((s.args ?? []) as any[])).changes,
          ),
        }));
        db.exec("COMMIT");
        return r;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
  return { db, store };
}
async function request(
  store: Store,
  path: string,
  method = "GET",
  body?: unknown,
  owner = "analyst-a",
) {
  return handleApi(
    new Request("https://test.local/api/" + path, {
      method,
      headers: { "content-type": "application/json" },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
    store,
    owner,
  );
}
test("API preserves data across reads, isolates owners, and never returns truth labels", async () => {
  const { db, store } = setup();
  const created: any = await (
    await request(store, "runs", "POST", {
      seed: 101,
      count: 1000,
      episodes: 8,
    })
  ).json();
  assert.ok(created.id);
  const response = await request(store, "runs/" + created.id);
  assert.equal(response.status, 200);
  const data: any = await response.json();
  assert.equal(data.stats.alerts, 1000);
  assert.ok(data.incidents.length < 1000);
  assert.equal("labels" in data, false);
  assert.equal("truth" in data, false);
  assert.equal(
    (await request(store, "runs/" + created.id, "GET", undefined, "analyst-b"))
      .status,
    404,
  );
  db.close();
});
test("audit decisions persist, idempotent retries do not duplicate, stale versions conflict", async () => {
  const { db, store } = setup();
  const run: any = await (
    await request(store, "runs", "POST", {
      seed: 102,
      count: 1000,
      episodes: 8,
    })
  ).json();
  const data: any = await (await request(store, "runs/" + run.id)).json();
  const id = data.incidents[0].id,
    action = {
      incident_id: id,
      disposition: "escalated",
      reason: "Credential evidence requires escalation.",
      expected_version: 0,
      idempotency_key: "test-action-001",
    };
  assert.equal(
    (await request(store, `runs/${run.id}/actions`, "POST", action)).status,
    201,
  );
  assert.equal(
    (await request(store, `runs/${run.id}/actions`, "POST", action)).status,
    200,
  );
  assert.equal(
    (
      await request(store, `runs/${run.id}/actions`, "POST", {
        ...action,
        idempotency_key: "test-action-002",
      })
    ).status,
    409,
  );
  const state: any = await (
    await request(store, `runs/${run.id}/audit`)
  ).json();
  assert.equal(state.valid, true);
  assert.equal(state.records.length, 1);
  const detail: any = await (
    await request(store, `runs/${run.id}/incidents/${id}`)
  ).json();
  assert.equal(detail.incident.version, 1);
  assert.equal(detail.incident.disposition, "escalated");
  db.prepare("UPDATE audit_log SET reason=?").run("Modified reason");
  const tampered: any = await (
    await request(store, `runs/${run.id}/audit`)
  ).json();
  assert.equal(tampered.valid, false);
  assert.equal(
    (
      await request(store, `runs/${run.id}/actions`, "POST", {
        ...action,
        expected_version: 1,
        idempotency_key: "test-action-003",
      })
    ).status,
    409,
  );
  db.close();
});
test("import forbids labels, malformed batches, and cross-origin writes; unlabeled evaluation is null", async () => {
  const { db, store } = setup();
  const alert = {
    alert_id: "IMPORT-1",
    timestamp: "2026-01-01T00:00:00Z",
    source: "edr",
    alert_type: "unknown",
    severity: 1,
    entities: [],
    description: "Imported event",
  };
  assert.equal(
    (await request(store, "runs", "POST", { alerts: [alert], truth: {} }))
      .status,
    422,
  );
  assert.equal(
    (
      await request(store, "runs", "POST", {
        alerts: [{ ...alert, episode: "secret" }],
      })
    ).status,
    422,
  );
  const cross = await handleApi(
    new Request("https://test.local/api/runs", {
      method: "POST",
      headers: { origin: "https://evil.invalid" },
      body: JSON.stringify({ alerts: [alert] }),
    }),
    store,
    "a",
  );
  assert.equal(cross.status, 403);
  const run: any = await (
    await request(store, "runs", "POST", { alerts: [alert] })
  ).json();
  assert.equal(
    await (await request(store, `runs/${run.id}/evaluation`)).json(),
    null,
  );
  db.close();
});
test("competing decisions cannot create a branched audit chain", async () => {
  const { db, store } = setup();
  const run: any = await (
    await request(store, "runs", "POST", {
      seed: 103,
      count: 1000,
      episodes: 8,
    })
  ).json();
  const data: any = await (await request(store, "runs/" + run.id)).json(),
    id = data.incidents[0].id;
  const a = {
    incident_id: id,
    disposition: "investigating",
    reason: "Inspecting related endpoint events.",
    expected_version: 0,
    idempotency_key: "concurrency-001",
  };
  const result = await Promise.all([
    request(store, `runs/${run.id}/actions`, "POST", a),
    request(store, `runs/${run.id}/actions`, "POST", {
      ...a,
      idempotency_key: "concurrency-002",
    }),
  ]);
  assert.deepEqual(result.map((r) => r.status).sort(), [201, 409]);
  const audit: any = await (
    await request(store, `runs/${run.id}/audit`)
  ).json();
  assert.equal(audit.valid, true);
  assert.equal(audit.records.length, 1);
  db.close();
});
test("independent labels change evaluation only; cross-owner annotation and deletion are denied", async () => {
  const { db, store } = setup();
  const alerts = [
    {
      alert_id: "one",
      timestamp: "2026-01-01T00:00:00Z",
      source: "edr",
      alert_type: "powershell",
      severity: 2,
      entities: ["host:test"],
      description: "Observation",
    },
    {
      alert_id: "two",
      timestamp: "2026-01-01T00:03:00Z",
      source: "edr",
      alert_type: "credential_dump",
      severity: 3,
      entities: ["host:test"],
      description: "Observation",
    },
  ];
  const run: any = await (
    await request(store, "runs", "POST", { alerts })
  ).json();
  const before: any = await (await request(store, `runs/${run.id}`)).json();
  const truth = {
    labels: { one: "attack", two: "BENIGN" },
    episodes: {
      attack: { family: "Independent annotation", alert_ids: ["one"] },
    },
  };
  assert.equal(
    (
      await request(
        store,
        `runs/${run.id}/labels`,
        "POST",
        truth,
        "different-owner",
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await request(store, `runs/${run.id}/labels`, "POST", {
        ...truth,
        labels: { one: "attack" },
      })
    ).status,
    422,
  );
  assert.equal(
    (await request(store, `runs/${run.id}/labels`, "POST", truth)).status,
    200,
  );
  const after: any = await (await request(store, `runs/${run.id}`)).json();
  assert.deepEqual(before.incidents, after.incidents);
  const evaluation: any = await (
    await request(store, `runs/${run.id}/evaluation`)
  ).json();
  assert.equal(evaluation.episode_count, 1);
  assert.equal(
    evaluation.label_source,
    "user supplied independent annotations",
  );
  assert.equal(
    (
      await request(
        store,
        `runs/${run.id}`,
        "DELETE",
        undefined,
        "different-owner",
      )
    ).status,
    404,
  );
  assert.equal((await request(store, `runs/${run.id}`, "DELETE")).status, 200);
  assert.equal((await request(store, `runs/${run.id}`)).status, 404);
  assert.equal(
    db
      .prepare("SELECT COUNT(*) n FROM operational_chunks WHERE run_id=?")
      .get(run.id)?.n,
    0,
  );
  db.close();
});
test("document assessment is isolated, persists quotes, and cannot masquerade as telemetry", async () => {
  const { db, store } = setup();
  const doc = {
    filename: "report.pdf",
    sha256: "a".repeat(64),
    pages: 3,
    extracted_characters: 70,
    findings: [
      {
        id: "F-1",
        page: 2,
        quote: "Memory access T1003.001 was mentioned.",
        techniques: ["T1003.001"],
        indicators: [],
        severity_mentions: [],
      },
    ],
  };
  const response = await request(store, "documents", "POST", doc);
  assert.equal(response.status, 201);
  const run: any = await response.json();
  const data: any = await (await request(store, `runs/${run.id}`)).json();
  assert.equal(data.document.findings[0].page, 2);
  assert.equal(data.stats.alerts, 0);
  assert.equal(data.document.techniques[0].mapping.technique, "T1003.001");
  assert.equal(
    (await request(store, `runs/${run.id}`, "GET", undefined, "other")).status,
    404,
  );
  assert.equal((await request(store, `runs/${run.id}/evaluation`)).status, 422);
  db.close();
});
