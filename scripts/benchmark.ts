import { experimentProvenance } from "./provenance";
import { writeFileSync, readFileSync } from "node:fs";
import { simulate } from "../core/simulator";
import { triage, ENGINE_DEFAULTS, type EngineOptions } from "../core/engine";
import { evaluate, measure } from "../core/evaluation";
import { CONFIG_VERSION, canonical, sha256 } from "../core/contracts";
import { rng } from "../core/simulation/model";
const protocol = JSON.parse(readFileSync("experiments/protocol.json", "utf8"));
const samples: any[] = [],
  sweeps: any[] = [],
  ablations: any[] = [];
const summarize = (e: ReturnType<typeof evaluate>) =>
  e.methods.map(({ curve, episode_ranks, ...m }) => m);
for (const count of protocol.counts)
  for (const seed of protocol.held_out_seeds) {
    const s = simulate({ seed, count, episodes: protocol.episodes }),
      before = process.memoryUsage().heapUsed,
      r = triage(s.alerts),
      e = evaluate(r, s.truth);
    samples.push({
      seed,
      count,
      attack_alerts: e.attack_alerts,
      runtime_ms: r.runtime_ms,
      heap_delta_bytes: Math.max(0, process.memoryUsage().heapUsed - before),
      input_sha256: await sha256(canonical(s.alerts)),
      truth_sha256: await sha256(canonical(s.truth)),
      validation: s.validation,
      diagnostics: r.diagnostics,
      methods: summarize(e),
    });
    console.log(
      `holdout ${seed} / ${count}: ${r.incidents.length} rows, ${r.runtime_ms} ms`,
    );
  }
for (const condition of protocol.stress_conditions)
  for (const seed of protocol.stress_seeds) {
    const s = simulate({ seed, count: 3000, episodes: 12, ...condition });
    try {
      const r = triage(s.alerts);
      sweeps.push({
        condition,
        seed,
        status: "ok",
        runtime_ms: r.runtime_ms,
        validation: s.validation,
        methods: summarize(evaluate(r, s.truth)),
      });
    } catch (error) {
      sweeps.push({
        condition,
        seed,
        status: "unavailable",
        error: error instanceof Error ? error.message : "Unknown",
      });
    }
  }
const variants: Record<string, Partial<EngineOptions>> = {
  "severity-ranking": { contextual_scoring: false },
  "no-idf": { use_idf: false },
  "no-deduplication": { dedup_seconds: 0 },
  "unbounded-components": {
    max_component_groups: 10000,
    max_component_hours: 168,
  },
};
for (const seed of protocol.held_out_seeds) {
  const s = simulate({ seed, count: 3000, episodes: 12 });
  for (const [variant, config] of Object.entries(variants)) {
    try {
      const r = triage(s.alerts, config),
        { curve, episode_ranks, ...metric } = measure(
          r.incidents,
          s.truth,
          variant,
          variant,
          s.alerts.length,
        );
      ablations.push({
        seed,
        variant,
        status: "ok",
        runtime_ms: r.runtime_ms,
        metric,
      });
    } catch (error) {
      ablations.push({
        seed,
        variant,
        status: "unavailable",
        error: error instanceof Error ? error.message : "Unknown",
      });
    }
  }
}
const mean = (v: number[]) =>
  v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
function interval(values: number[], seed: number) {
  if (!values.length)
    return { n: 0, mean: null, sd: null, min: null, max: null, ci95: null };
  const random = rng(seed),
    means = Array.from({ length: protocol.bootstrap_replicates }, () =>
      mean(values.map(() => values[Math.floor(random() * values.length)]))!,
    ).sort((a, b) => a - b),
    m = mean(values)!;
  return {
    n: values.length,
    mean: m,
    sd:
      values.length > 1
        ? Math.sqrt(
            values.reduce((s, x) => s + (x - m) ** 2, 0) / (values.length - 1),
          )
        : null,
    min: Math.min(...values),
    max: Math.max(...values),
    ci95: [
      means[Math.floor(means.length * 0.025)],
      means[Math.floor(means.length * 0.975)],
    ],
  };
}
const metrics = [
  "recall_at_25",
  "pairwise_f1",
  "benign_contamination",
  "items_at_100",
  "queue_size",
  "alerts_reviewed_at_25",
  "episode_completeness",
];
const aggregates = protocol.counts.map((count: number) => ({
  count,
  n: protocol.held_out_seeds.length,
  methods: ["B0", "B1", "B2", "B3", "UT"].map((id) => ({
    id,
    metrics: Object.fromEntries(
      metrics.map((key) => [
        key,
        interval(
          samples
            .filter((s) => s.count === count)
            .map((s) => s.methods.find((m: any) => m.id === id)[key])
            .filter((n: any) => typeof n === "number"),
          protocol.bootstrap_seed,
        ),
      ]),
    ),
  })),
}));
const paired = protocol.counts.flatMap((count: number) =>
  ["B0", "B1", "B2", "B3"].map((baseline) => ({
    count,
    baseline,
    metric: "recall_at_25",
    difference: "UT minus baseline; paired per seed",
    ...interval(
      samples
        .filter((s) => s.count === count)
        .map(
          (s) =>
            s.methods.find((m: any) => m.id === "UT").recall_at_25 -
            s.methods.find((m: any) => m.id === baseline).recall_at_25,
        ),
      protocol.bootstrap_seed,
    ),
  })),
);
const report = {
  provenance: await experimentProvenance(),
  generated_at: new Date().toISOString(),
  config_version: CONFIG_VERSION,
  configuration: ENGINE_DEFAULTS,
  protocol,
  protocol_sha256: await sha256(canonical(protocol)),
  generator_version: "2.0-event-driven",
  no_weight_tuning_performed: true,
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
  },
  synthetic_only: true,
  held_out_seeds: protocol.held_out_seeds,
  samples,
  aggregates,
  sweeps,
  ablations,
  paired,
  limitations: [
    "Bootstrap intervals describe variation across seeded simulations, not generalization to real SOCs.",
    "Repeated scenario families create dependence; 20 seeds do not represent 20 organizations.",
    "Recall counts all planned episodes, including unobservable ones; surfacing one alert is not complete reconstruction.",
    "Review rows and source-alert counts are workload proxies. Analyst time was not measured.",
    "Ablations that exceed resource budgets are marked unavailable, not dropped from summaries.",
  ],
  public_dataset: {
    dataset: "AIT-ADS",
    source: "https://zenodo.org/records/8263181",
    report: "/external-validation.json",
    status:
      "Separate external ingestion validation; no gold episode accuracy claims",
  },
};
writeFileSync("public/benchmark-report.json", JSON.stringify(report, null, 2));
const demo = simulate({ seed: 239, count: 3000, episodes: 12 });
writeFileSync(
  "docs/demo-evaluation.json",
  JSON.stringify(evaluate(triage(demo.alerts), demo.truth), null, 2),
);
console.log(
  `Saved ${samples.length} holdouts, ${sweeps.length} stress runs and ${ablations.length} ablations`,
);
