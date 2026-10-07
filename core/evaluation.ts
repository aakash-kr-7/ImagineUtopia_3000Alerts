// Labels enter here only, after methods have finished producing their queues.
import { scoreIncident } from "./engine";
import type { Alert, TriageResult } from "./contracts";
import type { Truth } from "./simulator";
export interface ReviewItem {
  id: string;
  alert_ids: string[];
  score: number;
  first: string;
}
export interface MethodMetrics {
  id: string;
  name: string;
  queue_size: number;
  recall_at_10: number;
  recall_at_25: number;
  items_at_80: number | null;
  items_at_100: number | null;
  compression_at_100: number | null;
  pairwise_precision: number | null;
  pairwise_recall: number;
  pairwise_f1: number;
  benign_contamination: number;
  attack_alerts_in_attack_items: number;
  benign_alerts_in_attack_items: number;
  curve: { k: number; recall: number }[];
  episode_ranks: Record<string, number>;
  alerts_reviewed_at_25: number;
  episode_completeness: number;
  mean_episode_fragments: number;
}
const choose2 = (n: number) => (n * (n - 1)) / 2;
function severityItems(alerts: Alert[]): ReviewItem[] {
  return [...alerts]
    .sort(
      (a, b) =>
        b.severity - a.severity ||
        a.timestamp.localeCompare(b.timestamp) ||
        a.alert_id.localeCompare(b.alert_id),
    )
    .map((a) => ({
      id: a.alert_id,
      alert_ids: [a.alert_id],
      score: a.severity,
      first: a.timestamp,
    }));
}
export function baseline(
  alerts: Alert[],
  kind: "host" | "entity",
): ReviewItem[] {
  const groups = new Map<string, Alert[]>();
  for (const a of alerts) {
    const entity =
      kind === "host"
        ? a.entities.find((e) => e.startsWith("host:"))
        : a.entities
            .filter((e) => e.startsWith("host:") || e.startsWith("user:"))
            .sort()
            .join("|");
    const key =
      (entity || a.alert_id) +
      "|" +
      Math.floor(Date.parse(a.timestamp) / (30 * 60000));
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  return [...groups.entries()]
    .map(([id, a]) => ({
      id,
      alert_ids: a.map((x) => x.alert_id),
      score: Math.max(...a.map((x) => x.severity)),
      first: a.map((x) => x.timestamp).sort()[0],
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.first.localeCompare(b.first) ||
        a.id.localeCompare(b.id),
    );
}
export function measure(
  items: ReviewItem[],
  truth: Truth,
  id: string,
  name: string,
  rawCount: number,
): MethodMetrics {
  const episodes = Object.keys(truth.episodes),
    seen = new Set<string>(),
    ranks: Record<string, number> = Object.create(null),
    curve = [{ k: 0, recall: 0 }];
  let tp = 0,
    predicted = 0,
    benign = 0,
    attack = 0;
  for (let i = 0; i < items.length; i++) {
    const counts: Record<string, number> = Object.create(null);
    for (const alertId of items[i].alert_ids) {
      const ep = truth.labels[alertId];
      if (ep === undefined) throw new Error("Incomplete evaluation labels");
      counts[ep] = (counts[ep] ?? 0) + 1;
      if (ep !== "BENIGN") {
        seen.add(ep);
        ranks[ep] ??= i + 1;
      }
    }
    predicted += choose2(items[i].alert_ids.length);
    for (const [ep, n] of Object.entries(counts))
      if (ep !== "BENIGN") tp += choose2(n);
    if (Object.keys(counts).some((e) => e !== "BENIGN")) {
      benign += counts.BENIGN ?? 0;
      attack += Object.entries(counts)
        .filter(([e]) => e !== "BENIGN")
        .reduce((s, [, n]) => s + n, 0);
    }
    curve.push({
      k: i + 1,
      recall: episodes.length ? seen.size / episodes.length : 0,
    });
  }
  const positives = episodes.reduce(
      (s, e) => s + choose2(truth.episodes[e].alert_ids.length),
      0,
    ),
    p = predicted ? tp / predicted : null,
    r = positives ? tp / positives : 0;
  const at = (k: number) => curve[Math.min(k, items.length)].recall,
    target = (v: number) =>
      episodes.length ? (curve.find((x) => x.recall >= v)?.k ?? null) : null;
  const full = target(1);
  const sizes = Object.fromEntries(
    episodes.map((ep) => [
      ep,
      items
        .map(
          (item) =>
            item.alert_ids.filter((id) => truth.labels[id] === ep).length,
        )
        .filter((n) => n > 0),
    ]),
  );
  const completeness = episodes.length
    ? episodes.reduce(
        (sum, ep) =>
          sum +
          (truth.episodes[ep].alert_ids.length
            ? Math.max(0, ...sizes[ep]) / truth.episodes[ep].alert_ids.length
            : 0),
        0,
      ) / episodes.length
    : 0;
  return {
    alerts_reviewed_at_25: items
      .slice(0, 25)
      .reduce((sum, item) => sum + item.alert_ids.length, 0),
    episode_completeness: completeness,
    mean_episode_fragments: episodes.length
      ? episodes.reduce((sum, ep) => sum + sizes[ep].length, 0) /
        episodes.length
      : 0,
    id,
    name,
    queue_size: items.length,
    recall_at_10: at(10),
    recall_at_25: at(25),
    items_at_80: target(0.8),
    items_at_100: full,
    compression_at_100: full ? rawCount / full : null,
    pairwise_precision: p,
    pairwise_recall: r,
    pairwise_f1: p !== null && p + r ? (2 * p * r) / (p + r) : 0,
    benign_contamination: attack + benign ? benign / (attack + benign) : 0,
    attack_alerts_in_attack_items: attack,
    benign_alerts_in_attack_items: benign,
    curve,
    episode_ranks: ranks,
  };
}
export function evaluate(result: TriageResult, truth: Truth) {
  const methods = [
    measure(
      severityItems(result.alerts),
      truth,
      "B0",
      "Severity only",
      result.alerts.length,
    ),
    measure(
      baseline(result.alerts, "host"),
      truth,
      "B1",
      "Host / 30-minute buckets",
      result.alerts.length,
    ),
    measure(
      baseline(result.alerts, "entity"),
      truth,
      "B2",
      "Typed entity / time buckets",
      result.alerts.length,
    ),
    measure(
      result.alerts
        .map((a) =>
          scoreIncident([
            {
              id: a.alert_id,
              alerts: [a],
              first: a.timestamp,
              last: a.timestamp,
              entities: a.entities,
              type: a.alert_type,
            },
          ]),
        )
        .sort(
          (a, b) =>
            b.score - a.score ||
            a.first.localeCompare(b.first) ||
            a.id.localeCompare(b.id),
        ),
      truth,
      "B3",
      "Contextual per-alert ranking",
      result.alerts.length,
    ),
    measure(
      result.incidents,
      truth,
      "UT",
      "Utopia contextual graph",
      result.alerts.length,
    ),
  ];
  return {
    episode_count: Object.keys(truth.episodes).length,
    attack_alerts: Object.values(truth.labels).filter((x) => x !== "BENIGN")
      .length,
    benign_alerts: Object.values(truth.labels).filter((x) => x === "BENIGN")
      .length,
    methods,
    limitations: [
      "Synthetic evaluation; external validity is not established.",
      "One opened row is a workload proxy. Incidents require different review effort.",
      "ATT&CK mapping indicates observed behavior, not malicious intent.",
      "Episode surfaced means at least one of its alerts is visible; it does not imply complete reconstruction.",
      "Baseline methods are educational implementations, not vendor products.",
    ],
    episodes: Object.entries(truth.episodes).map(([id, e]) => ({
      id,
      family: e.family,
      alerts: e.alert_ids.length,
      ranks: Object.fromEntries(
        methods.map((m) => [m.id, m.episode_ranks[id] ?? null]),
      ),
    })),
  };
}
