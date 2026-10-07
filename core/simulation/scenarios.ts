import type { ScenarioState } from "./model";
export function initialState(family: string): ScenarioState {
  return {
    foothold: family === "Command and control",
    execution: false,
    credentials: false,
    persistence: false,
    discovery: false,
    remote: false,
    egress: false,
    impact: false,
  };
}
/** Preconditions model causal prerequisites, not a universal ATT&CK tactic order. */
export const TRANSITIONS: Record<
  string,
  { requires: (keyof ScenarioState)[]; grants: (keyof ScenarioState)[] }
> = {
  attachment_process: { requires: [], grants: ["foothold", "execution"] },
  auth_failures: { requires: [], grants: [] },
  authentication: { requires: [], grants: ["foothold"] },
  script_execution: { requires: ["foothold"], grants: ["execution"] },
  enumeration: { requires: ["foothold"], grants: ["discovery"] },
  memory_access: {
    requires: ["foothold"],
    grants: ["execution", "credentials"],
  },
  remote_execution: { requires: ["credentials"], grants: ["remote"] },
  task_registration: { requires: ["foothold"], grants: ["persistence"] },
  dns: { requires: ["execution"], grants: [] },
  egress: { requires: ["execution"], grants: ["egress"] },
  file_mutation: { requires: ["execution"], grants: ["impact"] },
};
export function advanceScenario(
  state: ScenarioState,
  behavior: string,
): ScenarioState {
  const transition = TRANSITIONS[behavior];
  if (!transition) throw new Error(`Unknown scenario behavior: ${behavior}`);
  const missing = transition.requires.filter((flag) => !state[flag]);
  if (missing.length)
    throw new Error(
      `${behavior} has unmet prerequisites: ${missing.join(", ")}`,
    );
  const next = { ...state };
  for (const flag of transition.grants) next[flag] = true;
  return next;
}
