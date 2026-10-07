import { experimentProvenance } from "./provenance";
import { writeFileSync } from "node:fs";
import { simulate } from "../core/simulator";
import { triage } from "../core/engine";
import { canonical, sha256 } from "../core/contracts";
const samples: any[] = [],
  checkpointMinutes = 30,
  budget = 25;
for (const seed of [901, 902, 903, 904, 905]) {
  const s = simulate({ seed, count: 3000, episodes: 12 }),
    start = Date.parse(s.alerts[0].timestamp),
    end = Date.parse(s.alerts.at(-1)!.timestamp);
  const surfaced: Record<string, number> = {},
    checkpoints: any[] = [],
    first = Object.fromEntries(
      Object.entries(s.truth.episodes)
        .filter(([, e]) => e.alert_ids.length)
        .map(([id, e]) => [
          id,
          Math.min(
            ...s.alerts
              .filter((a) => e.alert_ids.includes(a.alert_id))
              .map((a) => Date.parse(a.timestamp)),
          ),
        ]),
    );
  for (
    let time = start + checkpointMinutes * 60000;
    time < end + checkpointMinutes * 60000;
    time += checkpointMinutes * 60000
  ) {
    const prefix = s.alerts.filter((a) => Date.parse(a.timestamp) <= time);
    if (!prefix.length) continue;
    const r = triage(prefix);
    const visible = new Set(
      r.incidents
        .slice(0, budget)
        .flatMap((i) => i.alert_ids.map((id) => s.truth.labels[id]))
        .filter((ep) => ep !== "BENIGN"),
    );
    for (const ep of visible) surfaced[ep] ??= time;
    checkpoints.push({
      timestamp: new Date(time).toISOString(),
      alerts: prefix.length,
      incidents: r.incidents.length,
      surfaced_episodes: Object.keys(surfaced).length,
      runtime_ms: r.runtime_ms,
    });
  }
  const episodes = Object.keys(s.truth.episodes).map((id) => ({
    id,
    first_observable: first[id] ? new Date(first[id]).toISOString() : null,
    first_top25_visibility: surfaced[id]
      ? new Date(surfaced[id]).toISOString()
      : null,
    delay_minutes:
      surfaced[id] && first[id] ? (surfaced[id] - first[id]) / 60000 : null,
  }));
  const delays = episodes
    .map((e) => e.delay_minutes)
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);
  samples.push({
    seed,
    input_sha256: await sha256(canonical(s.alerts)),
    observable: Object.keys(first).length,
    surfaced: Object.keys(surfaced).length,
    median_delay_minutes: delays.length
      ? delays.length % 2
        ? delays[(delays.length - 1) / 2]
        : (delays[delays.length / 2 - 1] + delays[delays.length / 2]) / 2
      : null,
    episodes,
    checkpoints,
  });
  console.log(
    `replay ${seed}: ${Object.keys(surfaced).length} visible / ${Object.keys(first).length} observable`,
  );
}
writeFileSync(
  "public/replay-report.json",
  JSON.stringify(
    {
      version: "2.0",
      provenance: await experimentProvenance(),
      checkpoint_minutes: checkpointMinutes,
      budget,
      samples,
      definition:
        "First snapshot when an episode alert occurs in a top-25 prefix-only incident; snapshots are 30 event-time minutes apart.",
      limitations: [
        "Event-time visibility delay is not analyst time-to-detect.",
        "Snapshot granularity contributes up to 30 minutes of delay.",
        "Each prefix recomputes IDF; ranks and incident membership may change as new evidence arrives.",
        "Unobservable or never-surfaced episodes retain null delay, rather than a fabricated finite value.",
      ],
    },
    null,
    2,
  ),
);
