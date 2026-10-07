import { exportCSV, exportHTML } from "./export";
import {
  importReportSchema,
  documentSubmissionSchema,
  truthSubmissionSchema,
} from "../core/ingestion/report-contract";
import { MAPPINGS } from "../core/mapping";
import { workloadComparison } from "../core/comparison";
import {
  actionSchema,
  batchSchema,
  canonical,
  sha256,
  simulationSchema,
  CONFIG_VERSION,
  type TriageResult,
} from "../core/contracts";
import { triage, CORRELATION, CorrelationLimitError } from "../core/engine";
import { simulate } from "../core/simulator";
import { evaluate } from "../core/evaluation";
import { templateBrief, factsPacket } from "../core/brief";
import { ATTACK_VERSION } from "../core/mapping";
import { chunkRows, readChunk, type Store } from "./storage";
const json = (x: unknown, status = 200) =>
  new Response(JSON.stringify(x), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function body(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 5_000_000)
    throw new ApiError(413, "Input exceeds 5 MB");
  const text = await request.text();
  if (new TextEncoder().encode(text).length > 5_000_000)
    throw new ApiError(413, "Input exceeds 5 MB");
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "Provide valid JSON");
  }
}
async function saveRun(
  store: Store,
  owner: string,
  config: unknown,
  uploaded?: unknown,
  importReport?: unknown,
) {
  const id = "RUN-" + crypto.randomUUID().slice(0, 12),
    created = new Date().toISOString();
  const simulation = uploaded ? null : simulate(simulationSchema.parse(config));
  const result = triage(uploaded ?? simulation!.alerts);
  const evaluation = simulation ? evaluate(result, simulation.truth) : null;
  const inputHash = await sha256(canonical(result.alerts)),
    truthHash = simulation ? await sha256(canonical(simulation.truth)) : null;
  const manifest = {
    ...(simulation?.manifest ?? {
      synthetic: false,
      alert_count: result.alerts.length,
      episode_count: null,
    }),
    config: simulation?.config ?? null,
    input_sha256: inputHash,
    truth_sha256: truthHash,
    config_version: CONFIG_VERSION,
    engine_config_sha256: await sha256(canonical(result.diagnostics?.config)),
    attack_version: ATTACK_VERSION,
    runtime_ms: result.runtime_ms,
    inventory: simulation?.inventory ?? null,
    correlation: CORRELATION,
    simulation_validation: simulation?.validation ?? null,
    diagnostics: result.diagnostics,
    import_report: importReport ?? null,
  };
  const statements = [
    ...chunkRows(id, "result", result),
    ...chunkRows(id, "comparison", workloadComparison(result)),
    ...(evaluation ? chunkRows(id, "evaluation", evaluation) : []),
    ...(simulation
      ? chunkRows(
          id,
          "truth",
          {
            truth: simulation.truth,
            events: simulation.events,
            event_labels: simulation.eventLabels,
            alert_sources: simulation.alerts.map((alert) => ({
              alert_id: alert.alert_id,
              event_id: alert.raw_reference?.replace("synthetic://", "") ?? "",
              severity: alert.severity,
              source: alert.source,
            })),
            episodes: simulation.episodes,
            inventory: simulation.inventory,
            validation: simulation.validation,
          },
          true,
        )
      : []),
  ];
  for (let i = 0; i < statements.length; i += 80)
    await store.batch(statements.slice(i, i + 80));
  await store.batch([
    {
      sql: "INSERT INTO runs(id,owner,created,seed,count,manifest) VALUES(?,?,?,?,?,?)",
      args: [
        id,
        owner,
        created,
        simulation?.config.seed ?? null,
        result.alerts.length,
        JSON.stringify(manifest),
      ],
    },
  ]);
  return {
    id,
    created,
    seed: simulation?.config.seed ?? null,
    count: result.alerts.length,
    manifest,
  };
}
async function owned(store: Store, id: string, owner: string) {
  const rows = await store.all("SELECT * FROM runs WHERE id=? AND owner=?", [
    id,
    owner,
  ]);
  if (!rows.length) throw new ApiError(404, "Run not found");
  return { ...rows[0], manifest: JSON.parse(rows[0].manifest) };
}
async function stateResult(store: Store, id: string): Promise<TriageResult> {
  const result = await readChunk(store, id, "result");
  if (!result) throw new ApiError(503, "Run data is unavailable");
  const states = await store.all(
    "SELECT * FROM incident_states WHERE run_id=?",
    [id],
  );
  for (const s of states) {
    const i = result.incidents.find((i: any) => i.id === s.incident_id);
    if (i) {
      i.disposition = s.disposition;
      i.version = s.version;
    }
  }
  return result;
}
const hashPayload = (a: any) => ({
  run_id: a.run_id,
  sequence: a.sequence,
  incident_id: a.incident_id,
  actor: a.actor,
  timestamp: a.timestamp,
  disposition: a.disposition,
  reason: a.reason,
  previous_hash: a.previous_hash,
  version: a.version,
  idempotency_key: a.idempotency_key,
});
async function auditState(store: Store, id: string) {
  const records = await store.all(
    "SELECT * FROM audit_log WHERE run_id=? ORDER BY sequence",
    [id],
  );
  let previous = "0".repeat(64),
    valid = true;
  for (let i = 0; i < records.length; i++) {
    const a = records[i];
    if (
      a.sequence !== i + 1 ||
      a.previous_hash !== previous ||
      (await sha256(canonical(hashPayload(a)))) !== a.hash
    )
      valid = false;
    previous = a.hash;
  }
  return { records, valid, head: previous, anchored_externally: false };
}
export async function handleApi(
  request: Request,
  store: Store,
  owner: string,
): Promise<Response> {
  try {
    const url = new URL(request.url),
      path = url.pathname.split("/").filter(Boolean),
      method = request.method;
    if (!["GET", "POST", "DELETE"].includes(method))
      throw new ApiError(405, "Method not allowed");
    if (method === "POST" || method === "DELETE") {
      const origin = request.headers.get("origin");
      if (origin && origin !== url.origin)
        throw new ApiError(403, "Cross-origin writes are not allowed");
    }
    if (path.join("/") === "api/session")
      return json({
        mode: owner.startsWith("guest:")
          ? "private browser workspace"
          : owner === "local-analyst"
            ? "local workspace"
            : "signed-in workspace",
        retention_days: 30,
        signin: "/signin-with-chatgpt?return_to=/",
      });
    if (path.join("/") === "api/health")
      return json({ ok: true, config_version: CONFIG_VERSION });
    if (path.join("/") === "api/bootstrap" && method === "GET") {
      const expired = await store.all(
        "SELECT id FROM runs WHERE created<? LIMIT 20",
        [new Date(Date.now() - 30 * 86400000).toISOString()],
      );
      for (const r of expired)
        await store.batch(
          [
            "audit_log",
            "incident_states",
            "operational_chunks",
            "sealed_truth_chunks",
          ]
            .map((table) => ({
              sql: `DELETE FROM ${table} WHERE run_id=?`,
              args: [r.id],
            }))
            .concat([{ sql: "DELETE FROM runs WHERE id=?", args: [r.id] }]),
        );
      let runs = await store.all(
        "SELECT id,created,seed,count,manifest FROM runs WHERE owner=? ORDER BY created DESC LIMIT 20",
        [owner],
      );
      return json({
        runs: runs.map((r) => ({ ...r, manifest: JSON.parse(r.manifest) })),
        config_version: CONFIG_VERSION,
        attack_version: ATTACK_VERSION,
        mode: "synthetic research prototype",
      });
    }
    if (path.join("/") === "api/runs" && method === "POST") {
      const raw = await body(request);
      const existing = await store.all(
        "SELECT COUNT(*) AS n FROM runs WHERE owner=?",
        [owner],
      );
      const recent = await store.all(
        "SELECT COUNT(*) AS n FROM runs WHERE owner=? AND created>?",
        [owner, new Date(Date.now() - 3600000).toISOString()],
      );
      if (recent[0].n >= 12)
        throw new ApiError(
          429,
          "Limit of 12 analyses per hour reached in this workspace",
        );
      if (existing[0].n >= 30)
        throw new ApiError(
          429,
          "This research workspace has reached its 30-run storage limit; delete older runs to continue",
        );
      if (raw && typeof raw === "object" && "alerts" in raw) {
        if (
          Object.keys(raw).some((k) => !["alerts", "import_report"].includes(k))
        )
          throw new ApiError(
            422,
            "Upload accepts only alerts; labels are forbidden",
          );
        const alerts = batchSchema.parse(raw.alerts),
          report = raw.import_report
            ? importReportSchema.parse(raw.import_report)
            : null;
        if (
          report &&
          (report.accepted !== alerts.length ||
            alerts.some((a) => a.provenance?.file_sha256 !== report.sha256))
        )
          throw new ApiError(
            422,
            "Import provenance or accepted counts disagree",
          );
        return json(await saveRun(store, owner, null, alerts, report), 201);
      }
      const config = simulationSchema.parse(raw);
      if (config.count < config.episodes * 15)
        throw new ApiError(422, "Use at least 15 alerts per attack episode");
      return json(await saveRun(store, owner, config), 201);
    }
    if (path.join("/") === "api/documents" && method === "POST") {
      const data = documentSubmissionSchema.parse(await body(request));
      const recentDocuments = await store.all(
        "SELECT COUNT(*) AS n FROM runs WHERE owner=? AND created>?",
        [owner, new Date(Date.now() - 3600000).toISOString()],
      );
      if (recentDocuments[0].n >= 12)
        throw new ApiError(
          429,
          "Limit of 12 analyses per hour reached in this workspace",
        );
      const existing = await store.all(
        "SELECT COUNT(*) AS n FROM runs WHERE owner=?",
        [owner],
      );
      if (existing[0].n >= 30)
        throw new ApiError(429, "30-run limit reached; delete older analyses");
      const techniques = [
          ...new Set(data.findings.flatMap((f) => f.techniques)),
        ],
        document = {
          ...data,
          version: "2.0",
          kind: "document",
          techniques: techniques.map((id) => ({
            id,
            mapping:
              Object.values(MAPPINGS).find((m) => m.technique === id) ?? null,
          })),
          indicators: [...new Set(data.findings.flatMap((f) => f.indicators))],
          limitations: [
            "Document mentions are evidence for review, not verified malicious events.",
            "No event timestamps, attack recall, or incident risk are inferred from narrative content.",
            "Extraction is browser-side and may omit images or complex layouts.",
          ],
        };
      const id = "DOC-" + crypto.randomUUID().slice(0, 12),
        created = new Date().toISOString(),
        manifest = {
          kind: "document",
          synthetic: false,
          filename: data.filename,
          input_sha256: data.sha256,
          pages: data.pages,
        };
      await store.batch([
        ...chunkRows(id, "document", document),
        {
          sql: "INSERT INTO runs(id,owner,created,seed,count,manifest) VALUES(?,?,?,?,?,?)",
          args: [id, owner, created, null, 0, JSON.stringify(manifest)],
        },
      ]);
      return json({ id, created, count: 0, seed: null, manifest }, 201);
    }
    if (path[0] !== "api" || path[1] !== "runs" || !path[2])
      throw new ApiError(404, "Endpoint not found");
    const id = path[2],
      run = await owned(store, id, owner);
    if (path.length === 3 && method === "DELETE") {
      await store.batch(
        [
          "audit_log",
          "incident_states",
          "operational_chunks",
          "sealed_truth_chunks",
        ]
          .map((table) => ({
            sql: `DELETE FROM ${table} WHERE run_id=?`,
            args: [id],
          }))
          .concat([
            {
              sql: "DELETE FROM runs WHERE id=? AND owner=?",
              args: [id, owner],
            },
          ]),
      );
      return json({ deleted: id });
    }
    if (run.manifest.kind === "document") {
      const document = await readChunk(store, id, "document");
      if (method === "GET" && (path.length === 3 || path[3] === "export"))
        return json({
          run,
          document,
          incidents: [],
          stats: {
            alerts: 0,
            groups: 0,
            incidents: 0,
            edges: 0,
            critical: 0,
            high: 0,
            runtime_ms: 0,
            sources: { edr: 0, idp: 0, ids: 0 },
          },
        });
      throw new ApiError(
        422,
        "Document assessment has no event-level queue; import telemetry to correlate incidents",
      );
    }
    const result = await stateResult(store, id);
    if (path[3] === "truth" && method === "GET") {
      const truthParts = await store.all(
        "SELECT payload FROM sealed_truth_chunks WHERE run_id=? ORDER BY part",
        [id],
      );
      const sealed = truthParts.length
        ? JSON.parse(truthParts.map((part) => part.payload).join(""))
        : null;
      if (!sealed) throw new ApiError(404, "This run has no evaluation truth");
      const source = sealed.truth ? sealed : { truth: sealed };
      return json({
        source,
        disclosed_after_triage: true,
        truth_sha256: run.manifest.truth_sha256 ?? null,
        source_ledger_sha256: await sha256(canonical(source)),
      });
    }
    if (path[3] === "comparison" && method === "GET")
      return json(
        (await readChunk(store, id, "comparison")) ??
          workloadComparison(result),
      );
    if (path[3] === "labels" && method === "POST") {
      if (run.manifest.synthetic)
        throw new ApiError(422, "Synthetic truth is already sealed");
      const truth = truthSubmissionSchema.parse(await body(request)),
        ids = new Set(result.alerts.map((a) => a.alert_id));
      if (
        Object.keys(truth.labels).length !== ids.size ||
        Object.keys(truth.labels).some((id) => !ids.has(id))
      )
        throw new ApiError(
          422,
          "Labels must cover exactly every accepted alert ID",
        );
      if (Object.keys(truth.episodes).includes("BENIGN"))
        throw new ApiError(422, "BENIGN is not an attack episode");
      const memberships = new Set<string>();
      for (const [ep, v] of Object.entries(truth.episodes))
        for (const id of v.alert_ids) {
          if (!ids.has(id) || truth.labels[id] !== ep || memberships.has(id))
            throw new ApiError(422, "Episode membership is inconsistent");
          memberships.add(id);
        }
      if (
        Object.entries(truth.labels).some(
          ([id, ep]) =>
            ep !== "BENIGN" && (!truth.episodes[ep] || !memberships.has(id)),
        )
      )
        throw new ApiError(
          422,
          "Every attack label needs exactly one episode membership",
        );
      const evaluated = evaluate(result, truth),
        hash = await sha256(canonical(truth));
      await store.batch([
        { sql: "DELETE FROM sealed_truth_chunks WHERE run_id=?", args: [id] },
        {
          sql: "DELETE FROM operational_chunks WHERE run_id=? AND kind='evaluation'",
          args: [id],
        },
        ...chunkRows(id, "truth", truth, true),
        ...chunkRows(id, "evaluation", {
          ...evaluated,
          label_source: "user supplied independent annotations",
          truth_sha256: hash,
        }),
      ]);
      return json({ evaluated: true, truth_sha256: hash });
    }
    if (path.length === 3 && method === "GET")
      return json({
        run,
        incidents: result.incidents,
        stats: {
          alerts: result.alerts.length,
          groups: result.groups.length,
          incidents: result.incidents.length,
          edges: result.edges.length,
          critical: result.incidents.filter((i) => i.tier === "critical")
            .length,
          high: result.incidents.filter((i) => i.tier === "high").length,
          runtime_ms: result.runtime_ms,
          sources: Object.fromEntries(
            ["edr", "idp", "ids"].map((s) => [
              s,
              result.alerts.filter((a) => a.source === s).length,
            ]),
          ),
        },
      });
    if (path[3] === "evaluation" && method === "GET")
      return json(await readChunk(store, id, "evaluation"));
    if (path[3] === "alerts" && method === "GET") {
      const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0)),
        limit = Math.min(
          200,
          Math.max(1, Number(url.searchParams.get("limit") ?? 100)),
        ),
        q = (url.searchParams.get("q") ?? "").toLowerCase(),
        importance = url.searchParams.get("importance") ?? "all";
      const incidentByAlert = new Map<string, (typeof result.incidents)[number]>();
      for (const incident of result.incidents)
        for (const alertId of incident.alert_ids) incidentByAlert.set(alertId, incident);
      const rankedIds = new Set(result.incidents.slice(0, 25).flatMap((incident) => incident.alert_ids));
      const filtered = result.alerts.filter(
        (a) => {
          const incident = incidentByAlert.get(a.alert_id);
          const matchesImportance =
            importance === "all" ||
            (importance === "top25" && rankedIds.has(a.alert_id)) ||
            (importance === "high" && !!incident && ["critical", "high"].includes(incident.tier)) ||
            (importance === "review" && ((incident?.score ?? 0) >= 35 || a.severity >= 3));
          return matchesImportance && (!q || canonical(a).toLowerCase().includes(q));
        },
      );
      return json({
        items: filtered.slice(offset, offset + limit),
        total: filtered.length,
      });
    }
    if (path[3] === "alert" && path[4] && method === "GET") {
      const alert = result.alerts.find((a) => a.alert_id === path[4]);
      if (!alert) throw new ApiError(404, "Alert not found");
      const group = result.groups.find((g) =>
          g.alerts.some((a) => a.alert_id === alert.alert_id),
        ),
        incident = group
          ? result.incidents.find((i) => i.group_ids.includes(group.id))
          : undefined,
        rank = incident
          ? result.incidents.findIndex((i) => i.id === incident.id) + 1
          : null;
      return json({
        alert,
        group,
        incident: incident ?? null,
        queue_rank: rank,
        prioritized: rank !== null && rank <= 25,
        linked_edges: group
          ? result.edges.filter(
              (e) => e.from === group.id || e.to === group.id,
            )
          : [],
        rationale: incident
          ? {
              priority: `Rank ${rank} of ${result.incidents.length} review items; ${incident.tier} tier at ${incident.score}/100.`,
              components: incident.components,
              mapping: incident.mappings,
              flags: incident.flags,
              grouping:
                (group?.alerts.length ?? 0) > 1
                  ? `Retained in ${group?.id} with ${group?.alerts.length} source alerts after deduplication.`
                  : "Kept as a singleton group because no duplicate alert matched.",
            }
          : {
              priority: "This alert has no incident assignment in the current result.",
              components: [],
              mapping: [],
              flags: [],
              grouping: "No group membership was found.",
            },
      });
    }
    if (path[3] === "export" && method === "GET") {
      const evaluation = await readChunk(store, id, "evaluation"),
        format = url.searchParams.get("format");
      if (format === "csv")
        return new Response(exportCSV(result), {
          headers: {
            "content-type": "text/csv; charset=utf-8",
            "content-disposition": `attachment; filename="utopia-${id}.csv"`,
          },
        });
      if (format === "html")
        return new Response(exportHTML(run, result, evaluation), {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "content-disposition": `attachment; filename="utopia-${id}.html"`,
            "content-security-policy":
              "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'",
          },
        });
      const data = {
        export_schema_version: "2.0",
        manifest: run.manifest,
        alerts: result.alerts,
        incidents: result.incidents,
        edges: result.edges,
        diagnostics: result.diagnostics,
        evaluation,
        comparison: await readChunk(store, id, "comparison"),
        audit: await auditState(store, id),
      };
      return new Response(JSON.stringify(data, null, 2), {
        headers: {
          "content-type": "application/json",
          "content-disposition": `attachment; filename="utopia-${id}.json"`,
        },
      });
    }
    if (path[3] === "audit" && method === "GET")
      return json(await auditState(store, id));
    if (path[3] === "actions" && method === "POST") {
      const a = actionSchema.parse(await body(request)),
        incident = result.incidents.find((i) => i.id === a.incident_id);
      if (!incident) throw new ApiError(404, "Incident not found");
      const existing = await store.all(
        "SELECT * FROM audit_log WHERE run_id=? AND idempotency_key=?",
        [id, a.idempotency_key],
      );
      if (existing.length) return json({ record: existing[0], replayed: true });
      if (incident.version !== a.expected_version)
        throw new ApiError(409, "Incident changed. Refresh and try again.");
      const audit = await auditState(store, id);
      if (!audit.valid)
        throw new ApiError(
          409,
          "Audit chain failed verification; writes are paused.",
        );
      const entry = {
        run_id: id,
        sequence: audit.records.length + 1,
        incident_id: a.incident_id,
        actor: owner,
        timestamp: new Date().toISOString(),
        disposition: a.disposition,
        reason: a.reason,
        previous_hash: audit.head,
        version: incident.version + 1,
        idempotency_key: a.idempotency_key,
      };
      const hash = await sha256(canonical(entry)),
        entryId = crypto.randomUUID();
      const operations = await store.batch([
        {
          sql: "INSERT INTO audit_log(id,run_id,sequence,incident_id,actor,timestamp,disposition,reason,previous_hash,hash,version,idempotency_key) SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE COALESCE((SELECT version FROM incident_states WHERE run_id=? AND incident_id=?),0)=? AND COALESCE((SELECT hash FROM audit_log WHERE run_id=? ORDER BY sequence DESC LIMIT 1),?)=?",
          args: [
            entryId,
            id,
            entry.sequence,
            a.incident_id,
            owner,
            entry.timestamp,
            a.disposition,
            a.reason,
            entry.previous_hash,
            hash,
            entry.version,
            a.idempotency_key,
            id,
            a.incident_id,
            a.expected_version,
            id,
            "0".repeat(64),
            audit.head,
          ],
        },
        {
          sql: "INSERT INTO incident_states(run_id,incident_id,disposition,version) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM audit_log WHERE id=?) ON CONFLICT(run_id,incident_id) DO UPDATE SET disposition=excluded.disposition,version=excluded.version WHERE incident_states.version=?",
          args: [
            id,
            a.incident_id,
            a.disposition,
            entry.version,
            entryId,
            a.expected_version,
          ],
        },
      ]);
      if (!operations[0].changes)
        throw new ApiError(
          409,
          "Another analyst updated this run. Refresh and retry.",
        );
      return json(
        { record: { id: entryId, ...entry, hash }, replayed: false },
        201,
      );
    }
    if (path[3] === "incidents" && path[4] && method === "GET") {
      const incident = result.incidents.find((i) => i.id === path[4]);
      if (!incident) throw new ApiError(404, "Incident not found");
      const groups = result.groups.filter((g) =>
          incident.group_ids.includes(g.id),
        ),
        alerts = groups
          .flatMap((g) => g.alerts)
          .sort(
            (a, b) =>
              a.timestamp.localeCompare(b.timestamp) ||
              a.alert_id.localeCompare(b.alert_id),
          );
      return json({
        incident,
        alerts,
        groups,
        edges: result.edges.filter(
          (e) =>
            incident.group_ids.includes(e.from) &&
            incident.group_ids.includes(e.to),
        ),
        brief: templateBrief(incident, alerts),
        facts: factsPacket(incident, alerts),
      });
    }
    throw new ApiError(404, "Endpoint not found");
  } catch (e) {
    if (e && typeof e === "object" && "issues" in e)
      return json(
        { error: "Validation failed", fields: (e as any).issues },
        422,
      );
    if (e instanceof CorrelationLimitError)
      return json({ error: e.message }, 422);
    if (e instanceof ApiError) return json({ error: e.message }, e.status);
    console.error("API failure", e instanceof Error ? e.message : "Unknown");
    return json(
      { error: "The request could not be completed. Please retry." },
      503,
    );
  }
}
