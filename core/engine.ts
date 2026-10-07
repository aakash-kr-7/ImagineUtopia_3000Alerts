// Operational module. Never import the simulator, evaluation code, or truth files.
import {
  batchSchema,
  CONFIG_VERSION,
  stableHash,
  type Alert,
  type AlertGroup,
  type Edge,
  type Incident,
  type TriageResult,
} from "./contracts";
import { MAPPINGS, TACTIC_ORDER } from "./mapping";
export const CORRELATION = {
  threshold: 0.52,
  dedup_seconds: 120,
  window_seconds: { host: 1800, user: 2400, ip: 600 },
  tau_seconds: { host: 1800, user: 1800, ip: 600 },
  base: { host: 1.15, user: 1.2, ip: 0.45 },
};
export interface EngineOptions {
  threshold: number;
  dedup_seconds: number;
  max_component_hours: number;
  max_component_groups: number;
  use_idf: boolean;
  contextual_scoring: boolean;
}
export const ENGINE_DEFAULTS: EngineOptions = {
  threshold: 0.52,
  dedup_seconds: 120,
  max_component_hours: 4,
  max_component_groups: 120,
  use_idf: true,
  contextual_scoring: true,
};
export class CorrelationLimitError extends Error {}
const seconds = (a: string, b: string) =>
  Math.abs(Date.parse(a) - Date.parse(b)) / 1000;
function deduplicate(alerts: Alert[], options: EngineOptions): AlertGroup[] {
  const last = new Map<string, AlertGroup>(),
    groups: AlertGroup[] = [];
  for (const a of [...alerts].sort(
    (a, b) =>
      a.timestamp.localeCompare(b.timestamp) ||
      a.alert_id.localeCompare(b.alert_id),
  )) {
    const key = [
      a.source,
      a.alert_type,
      a.asset_criticality ?? "",
      ...a.entities.slice().sort(),
    ].join("|");
    const old = last.get(key);
    if (old && seconds(old.first, a.timestamp) <= options.dedup_seconds) {
      old.alerts.push(a);
      old.last = a.timestamp;
    } else {
      const g = {
        id: "G-" + stableHash(a.alert_id),
        alerts: [a],
        first: a.timestamp,
        last: a.timestamp,
        entities: [...new Set(a.entities)].sort(),
        type: a.alert_type,
      };
      groups.push(g);
      last.set(key, g);
    }
  }
  return groups;
}
export function scoreIncident(groups: AlertGroup[]): Incident {
  const alerts = groups
    .flatMap((g) => g.alerts)
    .sort(
      (a, b) =>
        a.timestamp.localeCompare(b.timestamp) ||
        a.alert_id.localeCompare(b.alert_id),
    );
  const entities = [...new Set(alerts.flatMap((a) => a.entities))].sort();
  const mappings = [
    ...new Map(
      alerts
        .flatMap((a) => [
          ...(MAPPINGS[a.alert_type] ? [MAPPINGS[a.alert_type]] : []),
          ...Object.values(MAPPINGS).filter((m) =>
            a.technique_ids?.includes(m.technique),
          ),
        ])
        .map((m) => [m.technique, m]),
    ).values(),
  ];
  const tactics = [...new Set(mappings.map((m) => m.tactic))];
  let progression = false,
    priorMinimum = Infinity;
  // Time-batched scan enforces strict chronology and avoids quadratic work on repeated detections.
  for (let cursor = 0; cursor < alerts.length && !progression;) {
    const timestamp = alerts[cursor].timestamp;
    let batchMinimum = Infinity;
    while (cursor < alerts.length && alerts[cursor].timestamp === timestamp) {
      const a = alerts[cursor++];
      const observed = [
        ...(MAPPINGS[a.alert_type] ? [MAPPINGS[a.alert_type]] : []),
        ...Object.values(MAPPINGS).filter((m) =>
          a.technique_ids?.includes(m.technique),
        ),
      ];
      for (const m of observed) {
        const rank = TACTIC_ORDER[m.tactic];
        if (rank > priorMinimum) progression = true;
        batchMinimum = Math.min(batchMinimum, rank);
      }
    }
    priorMinimum = Math.min(priorMinimum, batchMinimum);
  }
  const severity = Math.max(...alerts.map((a) => a.severity)),
    criticality = Math.max(0, ...alerts.map((a) => a.asset_criticality ?? 0));
  const spread = entities.filter(
    (e) => e.startsWith("host:") || e.startsWith("user:"),
  ).length;
  const sensitive = tactics.some((t) =>
    ["credential-access", "exfiltration", "impact"].includes(t),
  );
  const components = [
    {
      key: "severity",
      label: "Alert severity",
      value: (severity / 4) * 25,
      max: 25,
      reason: `Highest normalized severity ${severity}/4`,
    },
    {
      key: "asset",
      label: "Asset criticality",
      value: (criticality / 4) * 25,
      max: 25,
      reason: criticality
        ? `Highest inventory criticality ${criticality}/4`
        : "Inventory unknown; no credit",
    },
    {
      key: "progression",
      label: "Tactic progression",
      value: Math.min(25, tactics.length * 4 + (progression ? 9 : 0)),
      max: 25,
      reason: `${tactics.length} distinct tactics; ${progression ? "observed ordered progression" : "no ordered progression"}`,
    },
    {
      key: "accumulation",
      label: "Accumulation",
      value: Math.min(10, Math.max(0, groups.length - 1) * 2),
      max: 10,
      reason: `${groups.length} deduplicated groups`,
    },
    {
      key: "spread",
      label: "Entity spread",
      value: Math.min(10, Math.max(0, spread - 2) * 2),
      max: 10,
      reason: `${spread} distinct hosts and users`,
    },
    {
      key: "sensitive",
      label: "Sensitive behavior",
      value: sensitive ? 5 : 0,
      max: 5,
      reason: sensitive
        ? "Credential access, exfiltration, or impact evidence"
        : "No sensitive behavior mapped",
    },
  ];
  const score =
    Math.round(components.reduce((s, c) => s + c.value, 0) * 100) / 100;
  let category = "Unclassified";
  if (tactics.includes("impact")) category = "Potential ransomware activity";
  else if (
    tactics.includes("credential-access") &&
    tactics.includes("lateral-movement")
  )
    category = "Credential compromise with lateral movement";
  else if (tactics.includes("exfiltration"))
    category = "Potential data exfiltration";
  else if (tactics.includes("initial-access") && tactics.includes("execution"))
    category = "Initial access with execution";
  else if (tactics.includes("credential-access"))
    category = "Credential access activity";
  else if (tactics.includes("command-and-control"))
    category = "Potential command and control";
  else if (tactics.length) category = "Mapped behavior for review";
  const title =
    category === "Unclassified"
      ? `${alerts[0].alert_type.replaceAll("_", " ")} on ${entities.find((e) => e.startsWith("host:"))?.slice(5) ?? "unknown asset"}`
      : category;
  return {
    id:
      "INC-" +
      stableHash(
        alerts
          .map((a) => a.alert_id)
          .sort()
          .join("|"),
      ),
    title,
    category,
    score,
    tier:
      score >= 80
        ? "critical"
        : score >= 60
          ? "high"
          : score >= 35
            ? "medium"
            : "low",
    alert_ids: alerts.map((a) => a.alert_id),
    group_ids: groups.map((g) => g.id),
    entities,
    first: alerts[0].timestamp,
    last: alerts.at(-1)!.timestamp,
    components,
    mappings,
    flags: [
      ...(groups.length > 100
        ? ["Large component: review possible over-grouping"]
        : []),
      ...(alerts.some((a) => !a.entities.length)
        ? ["Missing entity telemetry"]
        : []),
    ],
    disposition: "open",
    version: 0,
  };
}
export function triage(
  input: unknown,
  overrides: Partial<EngineOptions> = {},
): TriageResult {
  const options = { ...ENGINE_DEFAULTS, ...overrides };
  if (
    !Number.isFinite(options.threshold) ||
    options.threshold < 0.1 ||
    options.threshold > 3 ||
    !Number.isFinite(options.max_component_hours) ||
    options.max_component_hours < 0.1 ||
    options.max_component_hours > 168 ||
    !Number.isInteger(options.max_component_groups) ||
    options.max_component_groups < 1 ||
    options.max_component_groups > 10000 ||
    !Number.isFinite(options.dedup_seconds) ||
    options.dedup_seconds < 0 ||
    options.dedup_seconds > 600
  )
    throw new Error("Invalid engine configuration");
  const start = performance.now(),
    alerts = batchSchema
      .parse(input)
      .map((a) => ({ ...a, timestamp: new Date(a.timestamp).toISOString() })),
    groups = deduplicate(alerts, options),
    n = groups.length;
  const index = new Map<string, number[]>();
  groups.forEach((g, i) =>
    g.entities.forEach((e) => {
      const entries = index.get(e);
      if (entries) entries.push(i);
      else index.set(e, [i]);
    }),
  );
  const idfs = new Map(
    [...index].map(([e, list]) => [
      e,
      options.use_idf ? Math.log(1 + n / list.length) / Math.log(1 + n) : 1,
    ]),
  );
  const maximum = groups.map((g) =>
    g.entities.reduce(
      (sum, e) =>
        sum +
        CORRELATION.base[e.split(":")[0] as "host" | "user" | "ip"] *
          idfs.get(e)!,
      0,
    ),
  );
  const pairs = new Map<string, Edge>(),
    parent = groups.map((_, i) => i);
  let comparisons = 0;
  const root = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  for (const [entity, indices] of index) {
    const type = entity.split(":")[0] as "host" | "user" | "ip",
      idf = options.use_idf
        ? Math.log(1 + n / indices.length) / Math.log(1 + n)
        : 1;
    const sorted = indices
      .filter((i) => maximum[i] >= options.threshold)
      .sort((a, b) => groups[a].first.localeCompare(groups[b].first));
    for (let a = 0; a < sorted.length; a++)
      for (let b = a + 1; b < sorted.length; b++) {
        const i = sorted[a],
          j = sorted[b],
          gap = seconds(groups[i].first, groups[j].first);
        if (gap > CORRELATION.window_seconds[type]) break;
        if (++comparisons > 500000)
          throw new CorrelationLimitError(
            "Correlation budget exceeded: split this dense batch into smaller time ranges.",
          );
        const possible = groups[i].entities
          .filter((e) => groups[j].entities.includes(e))
          .reduce(
            (sum, e) =>
              sum +
              CORRELATION.base[e.split(":")[0] as "host" | "user" | "ip"] *
                idfs.get(e)!,
            0,
          );
        if (possible < options.threshold) continue;
        const weight =
          CORRELATION.base[type] *
          idf *
          Math.exp(-gap / CORRELATION.tau_seconds[type]);
        const key = Math.min(i, j) + ":" + Math.max(i, j),
          edge = pairs.get(key) ?? {
            from: groups[i].id,
            to: groups[j].id,
            weight: 0,
            threshold: options.threshold,
            reasons: [],
          };
        edge.weight += weight;
        edge.reasons.push({ entity, gap_seconds: gap, idf, weight });
        pairs.set(key, edge);
        if (pairs.size > 40000)
          throw new CorrelationLimitError(
            "Correlation graph exceeds its 40,000-candidate safety bound: split the batch.",
          );
      }
  }
  // Highest-evidence links win first. Bounding the total component span prevents transitive day-long chains.
  const minimum = groups.map((g) => Date.parse(g.first)),
    maximumTime = groups.map((g) => Date.parse(g.last)),
    sizes = groups.map(() => 1);
  let blocked = 0;
  const blockedReasons = { span: 0, size: 0 };
  const blockedExamples: {
    from: string;
    to: string;
    reason: string;
    proposed_hours: number;
    proposed_groups: number;
  }[] = [];
  const edges: Edge[] = [];
  const candidates = [...pairs.entries()]
    .filter(([, e]) => e.weight >= options.threshold)
    .sort(
      (a, b) =>
        b[1].weight - a[1].weight ||
        a[1].from.localeCompare(b[1].from) ||
        a[1].to.localeCompare(b[1].to),
    );
  for (const [key, e] of candidates) {
    const [a, b] = key.split(":").map(Number),
      ra = root(a),
      rb = root(b);
    if (ra !== rb) {
      const lo = Math.min(minimum[ra], minimum[rb]),
        hi = Math.max(maximumTime[ra], maximumTime[rb]);
      if (
        hi - lo > options.max_component_hours * 3600000 ||
        sizes[ra] + sizes[rb] > options.max_component_groups
      ) {
        blocked++;
        const reason =
          hi - lo > options.max_component_hours * 3600000 ? "span" : "size";
        blockedReasons[reason]++;
        if (blockedExamples.length < 50)
          blockedExamples.push({
            from: e.from,
            to: e.to,
            reason,
            proposed_hours: (hi - lo) / 3600000,
            proposed_groups: sizes[ra] + sizes[rb],
          });
        continue;
      }
      parent[rb] = ra;
      minimum[ra] = lo;
      maximumTime[ra] = hi;
      sizes[ra] += sizes[rb];
    }
    edges.push({ ...e, weight: Math.round(e.weight * 10000) / 10000 });
  }
  const components = new Map<number, AlertGroup[]>();
  groups.forEach((g, i) => {
    const r = root(i);
    components.set(r, [...(components.get(r) ?? []), g]);
  });
  const incidents = [...components.values()]
    .map((g) => {
      const i = scoreIncident(g);
      if (!options.contextual_scoring) {
        i.score =
          (Math.max(...g.flatMap((x) => x.alerts.map((a) => a.severity))) / 4) *
          100;
        i.tier =
          i.score >= 80
            ? "critical"
            : i.score >= 60
              ? "high"
              : i.score >= 35
                ? "medium"
                : "low";
        i.components = [
          {
            key: "severity",
            label: "Severity-only ablation",
            value: i.score,
            max: 100,
            reason: "Contextual scoring disabled for this experiment",
          },
        ];
      }
      return i;
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.first.localeCompare(b.first) ||
        a.id.localeCompare(b.id),
    );
  return {
    config_version: CONFIG_VERSION,
    alerts,
    groups,
    edges,
    incidents,
    runtime_ms: Math.round((performance.now() - start) * 100) / 100,
    diagnostics: {
      candidate_comparisons: comparisons,
      candidate_edges: pairs.size,
      blocked_edges: blocked,
      blocked_reasons: blockedReasons,
      blocked_examples: blockedExamples,
      largest_component: Math.max(...incidents.map((i) => i.group_ids.length)),
      config: options,
    },
  };
}
