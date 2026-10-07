import { alertSchema, stableHash, type Alert } from "../contracts";
import { MAPPINGS } from "../mapping";
export type SeverityScale =
  "auto" | "normalized" | "wazuh" | "syslog" | "ten" | "percent" | "words";
export interface ImportOptions {
  severityScale: SeverityScale;
  timezone: "require" | "UTC";
  fields: Partial<
    Record<
      | "id"
      | "timestamp"
      | "severity"
      | "type"
      | "host"
      | "user"
      | "ip"
      | "description"
      | "source"
      | "criticality",
      string
    >
  >;
}
export const IMPORT_DEFAULTS: ImportOptions = {
  severityScale: "auto",
  timezone: "require",
  fields: {},
};
export interface SourceRecord {
  value: Record<string, unknown>;
  row: number;
  page?: number;
}
export interface ImportIssue {
  record: number;
  field: string;
  message: string;
  level: "error" | "warning";
}
export interface ImportReport {
  version: "2.0";
  filename: string;
  sha256: string;
  kind: "telemetry";
  records: number;
  accepted: number;
  rejected: number;
  issues: ImportIssue[];
  adapters: Record<string, number>;
  options: ImportOptions;
  missing: { entities: number; criticality: number; techniques: number };
  warnings: string[];
}
export function flatten(
  value: unknown,
  prefix = "",
  out: Record<string, unknown> = {},
) {
  if (value && typeof value === "object" && !Array.isArray(value))
    for (const [key, v] of Object.entries(value))
      flatten(v, prefix ? `${prefix}.${key}` : key, out);
  else out[prefix] = value;
  return out;
}
function parseEmbedded(value: unknown) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {}
  }
  return value;
}
export function extractRecords(input: unknown): SourceRecord[] {
  let rows: unknown = input;
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const x = input as any;
    if (x.tables?.[0]?.columns && x.tables[0].rows)
      rows = x.tables.flatMap((table: any) =>
        table.rows.map((row: any[]) =>
          Object.fromEntries(
            table.columns.map((c: any, i: number) => [c.name, row[i]]),
          ),
        ),
      );
    else
      rows = x.alerts ??
        x.value ??
        x.results ??
        x.hits?.hits?.map((h: any) => ({ _id: h._id, ...h._source })) ?? [
          input,
        ];
  }
  if (!Array.isArray(rows))
    throw new Error(
      "Expected records, an alerts/value/results array, Elastic hits, or Azure table export",
    );
  if (rows.length > 10000)
    throw new Error(
      "Import exceeds 10,000 records. Split the export by time range.",
    );
  return rows.map((value, i) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error(`Record ${i + 1} is not an object`);
    return { value: value as Record<string, unknown>, row: i + 1 };
  });
}
export function adapterOf(v: Record<string, unknown>) {
  if ("alert_id" in v && Array.isArray(v.entities)) return "canonical";
  if (v["rule.level"] !== undefined || v["rule.description"] !== undefined)
    return "wazuh";
  if (v["alert.signature"] !== undefined || v.event_type === "alert")
    return "suricata";
  if (v.SystemAlertId !== undefined || v.AlertSeverity !== undefined)
    return "sentinel";
  if (
    v["event.kind"] !== undefined ||
    v["event.severity"] !== undefined ||
    v["@timestamp"] !== undefined
  )
    return "ecs";
  if (
    v.AlertId !== undefined ||
    (v.Title !== undefined && v.Severity !== undefined)
  )
    return "defender";
  return "mapped";
}
const aliases = {
  id: ["alert_id", "SystemAlertId", "AlertId", "id", "_id", "event.id"],
  timestamp: [
    "timestamp",
    "@timestamp",
    "TimeGenerated",
    "StartTime",
    "Timestamp",
    "time",
    "_time",
    "event.start",
    "date",
  ],
  severity: [
    "severity",
    "AlertSeverity",
    "Severity",
    "rule.level",
    "alert.severity",
    "event.severity",
    "log.syslog.severity.code",
    "risk_score",
  ],
  type: [
    "alert_type",
    "AlertName",
    "Title",
    "rule.name",
    "rule.description",
    "alert.signature",
    "event.action",
    "type",
    "name",
  ],
  host: [
    "host",
    "hostname",
    "host.name",
    "predecoder.hostname",
    "agent.name",
    "Computer",
    "CompromisedEntity",
    "DeviceName",
    "dest_host",
  ],
  user: [
    "user",
    "username",
    "user.name",
    "account",
    "AccountName",
    "src_user",
    "data.srcuser",
    "data.dstuser",
  ],
  ip: [
    "ip",
    "src_ip",
    "source.ip",
    "ClientIP",
    "SourceIP",
    "src",
    "data.srcip",
    "data.dstip",
    "agent.ip",
  ],
  description: [
    "description",
    "Description",
    "rule.description",
    "message",
    "alert.signature",
    "full_log",
  ],
  source: [
    "source",
    "ProviderName",
    "ProductName",
    "event.module",
    "event.dataset",
    "sourcetype",
  ],
  criticality: ["asset_criticality", "asset.criticality"],
} as const;
export function suggestedFields(records: SourceRecord[]) {
  const keys = new Set(
    records.slice(0, 20).flatMap((r) => Object.keys(flatten(r.value))),
  );
  return Object.fromEntries(
    Object.entries(aliases).map(([k, candidates]) => [
      k,
      candidates.find((c) => keys.has(c)) ?? "",
    ]),
  );
}
function normalizedSeverity(
  value: unknown,
  scale: SeverityScale,
  adapter: string,
  field: string,
): number {
  const word = String(value ?? "")
    .trim()
    .toLowerCase();
  const words: Record<string, number> = {
    informational: 0,
    information: 0,
    info: 0,
    low: 1,
    medium: 2,
    moderate: 2,
    high: 3,
    critical: 4,
    severe: 4,
  };
  if (word in words) return words[word];
  let selected = scale;
  if (scale === "auto")
    selected =
      adapter === "canonical"
        ? "normalized"
        : adapter === "wazuh"
          ? "wazuh"
          : adapter === "suricata"
            ? "syslog"
            : field === "log.syslog.severity.code"
              ? "syslog"
              : "auto";
  if (selected === "auto")
    throw new Error(
      "Numeric severity needs an explicit scale; ECS severity is source-specific",
    );
  const n = typeof value === "number" ? value : word ? Number(word) : NaN;
  if (!Number.isFinite(n)) throw new Error("Severity is missing or invalid");
  if (adapter === "suricata" && scale === "auto") {
    if (n < 1 || n > 3) throw new Error("Suricata severity must be 1–3");
    return 4 - n;
  }
  const maximum =
    selected === "normalized"
      ? 4
      : selected === "wazuh"
        ? 15
        : selected === "syslog"
          ? 7
          : selected === "ten"
            ? 10
            : selected === "percent"
              ? 100
              : -1;
  if (n < 0 || n > maximum)
    throw new Error(`Severity outside ${selected} scale`);
  return selected === "syslog"
    ? Math.round(((7 - n) / 7) * 4)
    : Math.round((n / maximum) * 4);
}
export function normalize(
  records: SourceRecord[],
  filename: string,
  hash: string,
  options: ImportOptions = IMPORT_DEFAULTS,
) {
  const alerts: Alert[] = [],
    issues: ImportIssue[] = [],
    adapters: Record<string, number> = {},
    seen = new Set<string>();
  for (const record of records) {
    const v = flatten(record.value),
      adapter = adapterOf(v),
      warnings: string[] = [];
    const field = (key: keyof typeof aliases) =>
      options.fields[key] || aliases[key].find((k) => v[k] !== undefined);
    const get = (key: keyof typeof aliases) => {
      const k = field(key);
      return k ? v[k] : undefined;
    };
    try {
      for (const banned of [
        "episode",
        "label",
        "truth",
        "attack_label",
        "malicious",
      ])
        if (banned in v)
          warnings.push(`Ignored evaluation-only field: ${banned}`);
      const rawTime = get("timestamp");
      let timestamp: string,
        basis = "explicit offset";
      if (
        typeof rawTime === "number" ||
        (typeof rawTime === "string" &&
          /^\d{10}(?:\.\d+)?$|^\d{13}$/.test(rawTime))
      ) {
        const n = Number(rawTime);
        timestamp = new Date(n < 1e12 ? n * 1000 : n).toISOString();
        basis = "Unix epoch";
      } else {
        let value = String(rawTime ?? "").trim();
        if (!value)
          throw new Error(
            "Event timestamp is required; report publication date is not event time",
          );
        if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) {
          if (options.timezone !== "UTC")
            throw new Error(
              "Timestamp has no timezone; confirm UTC or export ISO timestamps",
            );
          value += "Z";
          basis = "user-confirmed UTC";
          warnings.push("Timestamp interpreted as UTC");
        }
        const ms = Date.parse(value);
        if (!Number.isFinite(ms))
          throw new Error("Timestamp could not be parsed");
        timestamp = new Date(ms).toISOString();
      }
      const severity = normalizedSeverity(
        get("severity"),
        options.severityScale,
        adapter,
        field("severity") ?? "",
      );
      let entities: string[] = [];
      if (adapter === "canonical") entities = record.value.entities as string[];
      else {
        for (const kind of ["host", "user", "ip"] as const) {
          const raw = get(kind);
          if (raw !== undefined && String(raw).trim())
            entities.push(
              `${kind}:${String(raw).trim().replace(/\s+/g, "_").slice(0, 100)}`,
            );
        }
        const sentinel = parseEmbedded(record.value.Entities);
        if (Array.isArray(sentinel))
          for (const e of sentinel) {
            const kind = e.Type?.toLowerCase();
            const val =
              kind === "host"
                ? e.HostName
                : kind === "account"
                  ? e.Name
                  : kind === "ip"
                    ? e.Address
                    : null;
            if (val)
              entities.push(
                `${kind === "account" ? "user" : kind}:${String(val).replace(/\s+/g, "_").slice(0, 100)}`,
              );
          }
        if (v["destination.ip"] || v.dest_ip)
          entities.push(`ip:${String(v["destination.ip"] ?? v.dest_ip)}`);
      }
      entities = [...new Set(entities)].slice(0, 8);
      if (!entities.length)
        warnings.push("No typed entities; retained as standalone evidence");
      const rawType = String(get("type") ?? "unmapped").slice(0, 80);
      const techniqueInput =
        record.value.technique_ids ??
        v["rule.mitre.id"] ??
        v["threat.technique.id"] ??
        record.value.Techniques ??
        [];
      const technique_ids = [
        ...new Set(
          (Array.isArray(techniqueInput)
            ? techniqueInput.map((x) => String(x))
            : String(techniqueInput).split(/[;,\s]+/)
          ).filter((x) => /^T\d{4}(?:\.\d{3})?$/.test(x)),
        ),
      ].slice(0, 20);
      const known = Object.values(MAPPINGS).filter((m) =>
        technique_ids.includes(m.technique),
      );
      if (technique_ids.some((id) => !known.some((m) => m.technique === id)))
        warnings.push(
          "Technique outside the controlled mapping; retained without tactic credit",
        );
      const alert_type = MAPPINGS[rawType]
        ? rawType
        : known.length === 1
          ? known[0].type
          : rawType;
      const sourceText = String(get("source") ?? adapter).toLowerCase();
      const source: Alert["source"] = ["edr", "idp", "ids"].includes(sourceText)
        ? (sourceText as Alert["source"])
        : adapter === "suricata" || /network|suricata|zeek|ids/.test(sourceText)
          ? "ids"
          : /identity|azuread|entra|okta|idp/.test(sourceText)
            ? "idp"
            : "edr";
      if (!["edr", "idp", "ids"].includes(sourceText))
        warnings.push(
          `Sensor category inferred from ${sourceText}; confirm export metadata`,
        );
      const id = String(
        get("id") ?? `IMP-${hash.slice(0, 8)}-${record.row}`,
      ).slice(0, 100);
      let alert_id = id;
      if (seen.has(alert_id)) {
        alert_id = `${id.slice(0, 75)}-${stableHash(String(record.row))}`;
        warnings.push("Repeated vendor ID assigned a distinct source-row ID");
      }
      const critical = get("criticality");
      const alert = alertSchema.parse({
        alert_id,
        timestamp,
        source,
        alert_type,
        severity,
        entities,
        description: String(get("description") ?? rawType).slice(0, 2000),
        ...(critical !== undefined && critical !== ""
          ? { asset_criticality: Number(critical) }
          : {}),
        ...(technique_ids.length ? { technique_ids } : {}),
        raw_reference: `upload://${hash}/record/${record.row}`,
        provenance: {
          file_sha256: hash,
          record: record.row,
          ...(record.page ? { page: record.page } : {}),
          adapter,
          original_severity: String(get("severity") ?? "").slice(0, 100),
          timestamp_basis: basis,
          warnings,
        },
      });
      seen.add(alert_id);
      alerts.push(alert);
      adapters[adapter] = (adapters[adapter] ?? 0) + 1;
      for (const message of warnings)
        issues.push({
          record: record.row,
          field: "normalization",
          message,
          level: "warning",
        });
    } catch (error) {
      issues.push({
        record: record.row,
        field: "record",
        message: error instanceof Error ? error.message : "Invalid record",
        level: "error",
      });
    }
  }
  const report: ImportReport = {
    version: "2.0",
    filename,
    sha256: hash,
    kind: "telemetry",
    records: records.length,
    accepted: alerts.length,
    rejected: records.length - alerts.length,
    issues: issues.slice(0, 2000),
    adapters,
    options,
    missing: {
      entities: alerts.filter((a) => !a.entities.length).length,
      criticality: alerts.filter((a) => a.asset_criticality === undefined)
        .length,
      techniques: alerts.filter(
        (a) => !a.technique_ids?.length && !MAPPINGS[a.alert_type],
      ).length,
    },
    warnings: [
      "Original file bytes stay in this browser; normalized accepted rows and provenance are saved when you analyze.",
      "Severity conversion is a documented ordinal mapping, not a calibrated probability.",
      ...(issues.length > 2000
        ? [
            "Issue preview truncated to 2,000 entries; rejected total is complete.",
          ]
        : []),
    ],
  };
  return { alerts, report };
}
