import type { TriageResult } from "./contracts";
import { baseline } from "./evaluation";
/** Observable comparisons need no hidden labels and cannot claim attack accuracy. */
export function workloadComparison(result: TriageResult) {
  const raw = result.alerts.length;
  const methods = [
    {
      id: "B0",
      name: "Individual alert review",
      items: result.alerts.map((a) => ({ alert_ids: [a.alert_id] })),
    },
    {
      id: "B1",
      name: "Host / 30-minute buckets",
      items: baseline(result.alerts, "host"),
    },
    {
      id: "B2",
      name: "Typed entity / time buckets",
      items: baseline(result.alerts, "entity"),
    },
    { id: "UT", name: "Utopia contextual graph", items: result.incidents },
  ];
  return {
    kind: "unlabeled",
    alerts: raw,
    methods: methods.map((m) => ({
      id: m.id,
      name: m.name,
      queue_size: m.items.length,
      row_reduction: 1 - m.items.length / raw,
      largest_item: Math.max(...m.items.map((i) => i.alert_ids.length)),
      mean_alerts_per_item: raw / m.items.length,
      accuracy: null,
    })),
    diagnostics: result.diagnostics,
    limitations: [
      "Queue reduction is an observable workload proxy, not measured analyst time.",
      "Grouping correctness, precision and attack recall are unavailable without independently annotated event labels.",
      "Larger groups can hide unrelated evidence. Inspect graph links and original source rows.",
    ],
  };
}
