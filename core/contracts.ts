import { z } from "zod";
export const alertSchema = z
  .object({
    alert_id: z.string().min(1).max(100),
    timestamp: z.iso.datetime({ offset: true }),
    source: z.enum(["edr", "idp", "ids"]),
    alert_type: z.string().min(1).max(80),
    severity: z.number().int().min(0).max(4),
    entities: z
      .array(z.string().regex(/^(user|host|ip):[^\s]{1,100}$/))
      .max(8)
      .refine(
        (a) => new Set(a).size === a.length,
        "Duplicate typed entities are not allowed",
      ),
    asset_criticality: z.number().int().min(1).max(4).optional(),
    description: z.string().max(2000),
    raw_reference: z.string().max(250).optional(),
    technique_ids: z
      .array(z.string().regex(/^T\d{4}(?:\.\d{3})?$/))
      .max(20)
      .optional(),
    provenance: z
      .object({
        file_sha256: z.string().regex(/^[a-f0-9]{64}$/),
        record: z.number().int().positive(),
        page: z.number().int().positive().optional(),
        adapter: z.string().max(80),
        original_severity: z.string().max(100),
        timestamp_basis: z.string().max(100),
        warnings: z.array(z.string().max(250)).max(20),
      })
      .strict()
      .optional(),
  })
  .strict();
export const batchSchema = z
  .array(alertSchema)
  .min(1)
  .max(10000)
  .superRefine((a, c) => {
    const ids = new Set<string>();
    for (let i = 0; i < a.length; i++) {
      if (ids.has(a[i].alert_id))
        c.addIssue({
          code: "custom",
          path: [i, "alert_id"],
          message: "Duplicate alert ID",
        });
      ids.add(a[i].alert_id);
    }
  });
export const simulationSchema = z
  .object({
    seed: z.number().int().min(0).max(2147483647).default(239),
    count: z.number().int().min(300).max(10000).default(3000),
    episodes: z.number().int().min(1).max(30).default(12),
    missing: z.number().min(0).max(0.5).default(0),
    hub_density: z.enum(["normal", "high"]).default("normal"),
    timing: z.enum(["normal", "stretched"]).default("normal"),
    severity_quality: z.enum(["aligned", "weak", "misleading"]).default("weak"),
    duration_hours: z.number().int().min(1).max(168).default(2),
    sensor_coverage: z.number().min(0.1).max(1).default(0.95),
    duplicate_rate: z.number().min(0).max(0.3).default(0.08),
    attack_overlap: z.boolean().default(false),
  })
  .strict();
export type Alert = z.infer<typeof alertSchema>;
export type SimulationConfig = z.infer<typeof simulationSchema>;
export type Disposition =
  "open" | "investigating" | "escalated" | "false_positive" | "closed";
export const actionSchema = z
  .object({
    incident_id: z.string().min(1).max(80),
    disposition: z.enum([
      "open",
      "investigating",
      "escalated",
      "false_positive",
      "closed",
    ]),
    reason: z.string().trim().min(8).max(1000),
    expected_version: z.number().int().nonnegative(),
    idempotency_key: z.string().min(8).max(100),
  })
  .strict();
export interface AlertGroup {
  id: string;
  alerts: Alert[];
  first: string;
  last: string;
  entities: string[];
  type: string;
}
export interface Edge {
  from: string;
  to: string;
  weight: number;
  threshold: number;
  reasons: {
    entity: string;
    gap_seconds: number;
    idf: number;
    weight: number;
  }[];
}
export interface Mapping {
  type: string;
  technique: string;
  tactic: string;
  name: string;
  url: string;
}
export interface Component {
  key: string;
  label: string;
  value: number;
  max: number;
  reason: string;
}
export interface Incident {
  id: string;
  title: string;
  category: string;
  score: number;
  tier: "critical" | "high" | "medium" | "low";
  alert_ids: string[];
  group_ids: string[];
  entities: string[];
  first: string;
  last: string;
  components: Component[];
  mappings: Mapping[];
  flags: string[];
  disposition: Disposition;
  version: number;
}
export interface TriageResult {
  config_version: string;
  alerts: Alert[];
  groups: AlertGroup[];
  edges: Edge[];
  incidents: Incident[];
  runtime_ms: number;
  diagnostics?: {
    candidate_comparisons: number;
    candidate_edges: number;
    blocked_edges: number;
    blocked_reasons: { span: number; size: number };
    blocked_examples: {
      from: string;
      to: string;
      reason: string;
      proposed_hours: number;
      proposed_groups: number;
    }[];
    largest_component: number;
    config: unknown;
  };
}
export const CONFIG_VERSION = "utopia-2.0-constrained";
export function stableHash(s: string) {
  let h = 2166136261,
    g = 2246822507;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    g = Math.imul(g ^ s.charCodeAt(i), 3266489909);
  }
  return (
    (h >>> 0).toString(16).padStart(8, "0") +
    (g >>> 0).toString(16).padStart(8, "0")
  );
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
