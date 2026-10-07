import { experimentProvenance } from "./provenance";
import { readFileSync, writeFileSync } from "node:fs";
import { normalize, IMPORT_DEFAULTS } from "../core/ingestion/normalize";
import { batchSchema, sha256, canonical } from "../core/contracts";
import { triage } from "../core/engine";
import { workloadComparison } from "../core/comparison";
const sample = JSON.parse(
  readFileSync(
    process.argv[2] ?? "/workspace/datasets/ait-sample.json",
    "utf8",
  ),
);
if (sample.archive_md5 !== "43db6b1f0996e0024befd617706c50e9")
  throw new Error("Unverified archive");
const sources: any[] = [],
  alerts = [];
for (const file of sample.files) {
  const normalized = normalize(
    file.records,
    file.member,
    file.sha256,
    IMPORT_DEFAULTS,
  );
  const namespace = file.member.replace(/_(?:wazuh|aminer)\.json$/, "");
  const scoped = normalized.alerts.map((a) => ({
    ...a,
    alert_id: `${namespace}:${a.alert_id}`.slice(0, 100),
    entities: a.entities.map((e) =>
      e.startsWith("host:") || e.startsWith("user:")
        ? e.split(":")[0] +
          ":" +
          namespace +
          "/" +
          e.split(":").slice(1).join(":")
        : e,
    ),
  }));
  alerts.push(...scoped);
  sources.push({
    member: file.member,
    source_rows: file.rows,
    source_sha256: file.sha256,
    sampled: file.records.length,
    accepted: scoped.length,
    rejected: file.records.length - scoped.length,
    missing: normalized.report.missing,
    adapters: normalized.report.adapters,
    rejected_reasons: [
      ...new Set(
        normalized.report.issues
          .filter((i) => i.level === "error")
          .map((i) => i.message),
      ),
    ],
    sampled_line_numbers: file.records.map((r: any) => r.row),
  });
}
const checked = batchSchema.parse(alerts),
  result = triage(checked);
const report = {
  provenance: await experimentProvenance(),
  dataset: "AIT-ADS",
  record: "https://zenodo.org/records/8263181",
  archive_md5: sample.archive_md5,
  archive_sha256: sample.archive_sha256,
  verified_checksum: true,
  sample_method: sample.method,
  sample_records: sample.files.reduce(
    (sum: number, f: any) => sum + f.records.length,
    0,
  ),
  accepted: checked.length,
  rejected: sources.reduce((sum, s) => sum + s.rejected, 0),
  normalized_sha256: await sha256(canonical(checked)),
  sources,
  transformations: [
    "Independent environment namespace added to host/user entities and vendor IDs; IP entities retained unchanged.",
    "Wazuh level 0–15 converted to normalized ordinal 0–4; vendor MITRE IDs used only through controlled mappings.",
    "AMiner has no supported severity contract and is rejected explicitly. No numeric severity is fabricated.",
  ],
  comparison: workloadComparison(result),
  runtime_ms: result.runtime_ms,
  label_policy:
    "Attack-phase intervals are not per-alert episode truth. Accuracy and recall are unavailable and are not inferred.",
  limitations: [
    "Reservoir sample across time is an ingestion check, not a chronological full-dataset attack benchmark.",
    "AIT-ADS is itself testbed data and does not establish production representativeness.",
    "AMiner export needs a configured severity adapter; its sample is intentionally excluded.",
    "No inventory supplied: all asset criticality remains unknown.",
  ],
};
writeFileSync(
  "public/external-validation.json",
  JSON.stringify(report, null, 2),
);
console.log(
  `External check: ${report.accepted} accepted / ${report.rejected} rejected; ${result.incidents.length} review items`,
);
