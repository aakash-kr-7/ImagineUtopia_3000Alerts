/** Event telemetry contains observations only. Episode labels live in a separate map. */
export interface Asset {
  id: string;
  role: "workstation" | "application" | "database";
  criticality: number;
  ip: string;
  site: string;
}
export interface SecurityEvent {
  id: string;
  timestamp: string;
  host: string;
  user: string;
  peer?: string;
  ip: string;
  behavior: string;
  sensor: "edr" | "idp" | "ids";
  fields: {
    process?: string;
    parent_process?: string;
    command_line?: string;
    auth_outcome?: string;
    protocol?: string;
    port?: number;
    count?: number;
    encoded?: boolean;
    unfamiliar?: boolean;
    target?: string;
    bytes?: number;
    periodicity?: number;
    extension_changes?: number;
    attachment?: boolean;
    off_hours?: boolean;
  };
}
export interface ScenarioState {
  foothold: boolean;
  execution: boolean;
  credentials: boolean;
  persistence: boolean;
  discovery: boolean;
  remote: boolean;
  egress: boolean;
  impact: boolean;
}
export interface Episode {
  initial_state: ScenarioState;
  family: string;
  event_ids: string[];
  stages: {
    behavior: string;
    timestamp: string;
    event_id: string;
    state_before: ScenarioState;
    state_after: ScenarioState;
  }[];
  alert_ids: string[];
}
export function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
export const SCENARIOS = [
  {
    name: "Phishing to exfiltration",
    stages: [
      "attachment_process",
      "script_execution",
      "memory_access",
      "remote_execution",
      "egress",
    ],
  },
  {
    name: "Identity compromise",
    stages: [
      "auth_failures",
      "authentication",
      "enumeration",
      "memory_access",
      "remote_execution",
    ],
  },
  {
    name: "Ransomware chain",
    stages: [
      "authentication",
      "task_registration",
      "script_execution",
      "file_mutation",
    ],
  },
  {
    name: "Command and control",
    stages: ["script_execution", "dns", "egress"],
  },
] as const;
export function inventory() {
  const hosts: Asset[] = Array.from({ length: 120 }, (_, i) => ({
    id: `host:${i < 90 ? "WS" : i < 110 ? "APP" : "DB"}-${String(i + 1).padStart(3, "0")}`,
    role: i < 90 ? "workstation" : i < 110 ? "application" : "database",
    criticality: i < 90 ? 2 : i < 110 ? 3 : 4,
    ip: `10.20.${Math.floor(i / 30)}.${(i % 30) + 10}`,
    site: i < 60 ? "north" : "south",
  }));
  const users = Array.from(
    { length: 160 },
    (_, i) => `user:employee-${String(i + 1).padStart(3, "0")}`,
  );
  return { hosts, users };
}
