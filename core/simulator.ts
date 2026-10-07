import { initialState, advanceScenario } from "./simulation/scenarios";
// Generation/evaluation only. Operational engine has no access to this module.
import {
  simulationSchema,
  stableHash,
  type Alert,
  type SimulationConfig,
} from "./contracts";
import {
  inventory,
  rng,
  SCENARIOS,
  type SecurityEvent,
  type Episode,
} from "./simulation/model";
import { detect } from "./simulation/detectors";
import { validateSimulation } from "./simulation/validation";
export interface Truth {
  labels: Record<string, string>;
  episodes: Record<string, { family: string; alert_ids: string[] }>;
}
export function simulate(input: Partial<SimulationConfig> = {}) {
  const config = simulationSchema.parse(input);
  if (config.count < config.episodes * 15)
    throw new Error(
      "Batch size must allow at least 15 alerts per attack episode",
    );
  const random = rng(config.seed),
    topology = inventory();
  const pick = <T>(a: readonly T[]) => a[Math.floor(random() * a.length)];
  const base = Date.parse("2026-09-28T00:00:00Z"),
    duration = config.duration_hours * 3600_000;
  const events: SecurityEvent[] = [],
    alerts: Alert[] = [],
    eventLabels: Record<string, string> = {};
  const episodes: Record<string, Episode> = {},
    truth: Truth = { labels: {}, episodes: {} };
  let serial = 0;
  const event = (
    behavior: string,
    hostIndex: number,
    user: string,
    minute: number,
    label: string,
    peer?: string,
  ) => {
    const asset = topology.hosts[hostIndex];
    const sensor: Alert["source"] = [
      "auth_failures",
      "authentication",
    ].includes(behavior)
      ? "idp"
      : ["dns", "egress", "scan"].includes(behavior)
        ? "ids"
        : "edr";
    const id = "EV-" + stableHash(`${config.seed}:${++serial}:${random()}`);
    const e: SecurityEvent = {
      id,
      timestamp: new Date(base + minute * 60000).toISOString(),
      host: asset.id,
      user,
      ...(peer ? { peer } : {}),
      ip: config.hub_density === "high" ? "10.0.0.1" : asset.ip,
      behavior,
      sensor,
      fields: {},
    };
    // Values are drawn from behavior definitions, never from the hidden label.
    e.fields =
      behavior === "auth_failures"
        ? { count: pick([4, 18, 25]) }
        : behavior === "authentication"
          ? { unfamiliar: true }
          : behavior === "script_execution"
            ? { encoded: true }
            : behavior === "attachment_process"
              ? { attachment: true }
              : behavior === "memory_access"
                ? { target: "lsass.exe" }
                : behavior === "task_registration"
                  ? { off_hours: true }
                  : behavior === "egress"
                    ? { bytes: 80_000_000 + Math.floor(random() * 200_000_000) }
                    : behavior === "dns"
                      ? { periodicity: 0.95 }
                      : behavior === "file_mutation"
                        ? { extension_changes: 200 }
                        : { count: 50 };
    e.fields = {
      ...e.fields,
      ...(behavior === "script_execution"
        ? {
            process: "powershell.exe",
            parent_process: "cmd.exe",
            command_line: "powershell -EncodedCommand <synthetic-token>",
          }
        : behavior === "memory_access"
          ? { process: "memory-reader.exe", parent_process: "service.exe" }
          : behavior === "attachment_process"
            ? { process: "powershell.exe", parent_process: "winword.exe" }
            : behavior === "authentication"
              ? { auth_outcome: "success" }
              : behavior === "auth_failures"
                ? { auth_outcome: "failure" }
                : behavior === "remote_execution"
                  ? { protocol: "SMB", port: 445 }
                  : behavior === "dns"
                    ? { protocol: "DNS", port: 53 }
                    : behavior === "egress"
                      ? { protocol: "HTTPS", port: 443 }
                      : {}),
    };
    events.push(e);
    eventLabels[id] = label;
    return e;
  };
  const emit = (e: SecurityEvent, forceCoverage = false) => {
    const detection = detect(e);
    if (!detection || (!forceCoverage && random() > config.sensor_coverage))
      return;
    const asset = topology.hosts.find((h) => h.id === e.host)!;
    let severity = detection.severity;
    if (config.severity_quality === "weak" && random() < 0.5)
      severity = pick([0, 1, 2, 3, 4]);
    if (config.severity_quality === "misleading") severity = 4 - severity;
    const entities = [
      e.user,
      e.host,
      ...(e.peer ? [e.peer] : []),
      `ip:${e.ip}`,
    ].filter(() => random() >= config.missing);
    const alert_id = "AL-" + stableHash(`${config.seed}:${e.id}:${random()}`);
    const alert: Alert = {
      alert_id,
      timestamp: e.timestamp,
      source: e.sensor,
      ...detection,
      severity,
      entities: [...new Set(entities)],
      asset_criticality: asset.criticality,
      raw_reference: `synthetic://${e.id}`,
    };
    alerts.push(alert);
    truth.labels[alert_id] = eventLabels[e.id];
    if (eventLabels[e.id] !== "BENIGN")
      truth.episodes[eventLabels[e.id]].alert_ids.push(alert_id);
    if (random() < config.duplicate_rate && alerts.length < config.count) {
      const duplicate = {
        ...alert,
        alert_id: "AL-" + stableHash(`${alert_id}:duplicate`),
        timestamp: new Date(Date.parse(e.timestamp) + 1000).toISOString(),
      };
      alerts.push(duplicate);
      truth.labels[duplicate.alert_id] = eventLabels[e.id];
      if (eventLabels[e.id] !== "BENIGN")
        truth.episodes[eventLabels[e.id]].alert_ids.push(duplicate.alert_id);
    }
  };
  for (let n = 0; n < config.episodes; n++) {
    const scenario = SCENARIOS[n % SCENARIOS.length],
      id = `ATTACK-${String(n + 1).padStart(3, "0")}`;
    episodes[id] = {
      initial_state: initialState(scenario.name),
      family: scenario.name,
      event_ids: [],
      stages: [],
      alert_ids: [],
    };
    truth.episodes[id] = { family: scenario.name, alert_ids: [] };
    const hostIndex = (n * 7 + 27) % 90,
      user = topology.users[(n * 11 + 17) % 160];
    const span =
      config.timing === "stretched"
        ? Math.min(
            80,
            Math.max(1, (config.duration_hours * 60 - 10) / scenario.stages.length),
          )
        : 4;
    const maxStart = Math.max(
      1,
      duration / 60000 - scenario.stages.length * span - 10,
    );
    const start = config.attack_overlap
      ? 180 + (n % 3) * 8
      : 90 + (n / config.episodes) * (maxStart - 90) + random() * 30;
    let scenarioState = initialState(scenario.name);
    scenario.stages.forEach((behavior, i) => {
      const before = { ...scenarioState };
      scenarioState = advanceScenario(scenarioState, behavior);
      const minute = Math.min(maxStart, start) + i * span + random();
      const first = event(
        behavior,
        hostIndex,
        user,
        minute,
        id,
        i >= 3 ? topology.hosts[110 + (n % 10)].id : undefined,
      );
      episodes[id].stages.push({
        behavior,
        timestamp: first.timestamp,
        event_id: first.id,
        state_before: before,
        state_after: { ...scenarioState },
      });
      episodes[id].event_ids.push(first.id);
      emit(first);
      for (let repeat = 1; repeat < 3; repeat++) {
        const e = event(
          behavior,
          hostIndex,
          user,
          minute + repeat * 0.3,
          id,
          first.peer,
        );
        episodes[id].event_ids.push(e.id);
        emit(e);
      }
    });
  }
  const ordinary = ["auth_failures", "file_access", "installation", "scan"];
  const maintenance = [
    ["script_execution", "remote_execution", "task_registration"],
    ["file_access", "egress"],
    ["authentication", "enumeration"],
    ["memory_access", "file_mutation"],
    ["script_execution", "dns"],
  ];
  // Session-based activity: business-hour weighting and correlated maintenance/backup lookalikes.
  while (alerts.length < config.count) {
    const h = Math.floor(random() * 120),
      user = topology.users[h % 160];
    const day = Math.floor((random() * config.duration_hours) / 24);
    const hour =
      config.duration_hours <= 24
        ? random() * config.duration_hours
        : random() < 0.75
          ? 8 + random() * 10
          : random() * 24;
    const start = Math.min(
      Math.max(0, duration / 60000 - 4),
      day * 1440 + hour * 60,
    );
    const behaviors = random() < 0.22 ? pick(maintenance) : [pick(ordinary)];
    for (let j = 0; j < 4 && alerts.length < config.count; j++) {
      const behavior = behaviors[j % behaviors.length];
      const e = event(
        behavior,
        h,
        user,
        start + j * 0.4,
        "BENIGN",
        behavior === "remote_execution"
          ? topology.hosts[(h + 1) % 120].id
          : undefined,
      );
      // Benign filling explicitly conditions the final batch on alert count; it does not change scoring.
      emit(e, true);
    }
    const background = event("authentication", h, user, start + 2, "BENIGN");
    background.fields.unfamiliar = false; // routine successful authentication remains unalerted
  }
  if (alerts.length !== config.count)
    throw new Error("Generator exceeded requested alert budget");
  for (const [id, ep] of Object.entries(episodes))
    ep.alert_ids = truth.episodes[id].alert_ids;
  alerts.sort(
    (a, b) =>
      a.timestamp.localeCompare(b.timestamp) ||
      a.alert_id.localeCompare(b.alert_id),
  );
  events.sort(
    (a, b) =>
      a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id),
  );
  const output = {
    config,
    alerts,
    truth,
    events,
    eventLabels,
    episodes,
    inventory: {
      company: "Aster Financial · fictional",
      users: 160,
      hosts: 120,
      period_hours: config.duration_hours,
      assets: topology.hosts,
    },
    manifest: {
      seed: config.seed,
      alert_count: alerts.length,
      attack_alerts: Object.values(truth.labels).filter((x) => x !== "BENIGN")
        .length,
      episode_count: config.episodes,
      generator_version: "2.0-event-driven",
      synthetic: true,
      event_count: events.length,
      detector_version: "2.0",
      label_isolation:
        "Events contain no episode or intent field; identical detectors operate on all events.",
    },
  };
  const validation = validateSimulation(output);
  if (!validation.valid)
    throw new Error(
      `Simulation validation failed: ${validation.errors.join("; ")}`,
    );
  return { ...output, validation };
}
