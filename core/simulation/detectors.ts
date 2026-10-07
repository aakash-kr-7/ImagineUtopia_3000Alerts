import type { Alert } from "../contracts";
import type { SecurityEvent } from "./model";
/** Identical rules and severities apply to attack and legitimate events. No truth argument. */
export const RULES = [
  {
    behavior: "auth_failures",
    type: "password_spray",
    severity: 2,
    predicate: (e: SecurityEvent) => (e.fields.count ?? 0) >= 12,
  },
  {
    behavior: "authentication",
    type: "suspicious_login",
    severity: 2,
    predicate: (e: SecurityEvent) => !!e.fields.unfamiliar,
  },
  {
    behavior: "attachment_process",
    type: "phishing_attachment",
    severity: 2,
    predicate: (e: SecurityEvent) => !!e.fields.attachment,
  },
  {
    behavior: "script_execution",
    type: "powershell",
    severity: 2,
    predicate: (e: SecurityEvent) => !!e.fields.encoded,
  },
  {
    behavior: "memory_access",
    type: "credential_dump",
    severity: 4,
    predicate: (e: SecurityEvent) => e.fields.target === "lsass.exe",
  },
  {
    behavior: "remote_execution",
    type: "remote_service",
    severity: 2,
    predicate: (e: SecurityEvent) => !!e.peer,
  },
  {
    behavior: "task_registration",
    type: "scheduled_task",
    severity: 2,
    predicate: (e: SecurityEvent) => !!e.fields.off_hours,
  },
  {
    behavior: "egress",
    type: "outbound_transfer",
    severity: 3,
    predicate: (e: SecurityEvent) => (e.fields.bytes ?? 0) > 50_000_000,
  },
  {
    behavior: "file_mutation",
    type: "encryption_activity",
    severity: 4,
    predicate: (e: SecurityEvent) => (e.fields.extension_changes ?? 0) >= 100,
  },
  {
    behavior: "dns",
    type: "dns_beacon",
    severity: 2,
    predicate: (e: SecurityEvent) => (e.fields.periodicity ?? 0) >= 0.9,
  },
  {
    behavior: "enumeration",
    type: "discovery",
    severity: 1,
    predicate: (e: SecurityEvent) => (e.fields.count ?? 0) > 20,
  },
  {
    behavior: "auth_failures",
    type: "login_failure",
    severity: 1,
    predicate: (e: SecurityEvent) =>
      (e.fields.count ?? 0) < 12 && (e.fields.count ?? 0) > 0,
  },
  {
    behavior: "file_access",
    type: "file_access",
    severity: 1,
    predicate: (e: SecurityEvent) => (e.fields.count ?? 0) > 10,
  },
  {
    behavior: "installation",
    type: "software_update",
    severity: 1,
    predicate: (_: SecurityEvent) => true,
  },
  {
    behavior: "scan",
    type: "network_scan",
    severity: 2,
    predicate: (e: SecurityEvent) => (e.fields.count ?? 0) > 30,
  },
];
export function detect(
  event: SecurityEvent,
): Pick<Alert, "alert_type" | "severity" | "description"> | null {
  const rule = RULES.find(
    (r) => r.behavior === event.behavior && r.predicate(event),
  );
  return rule
    ? {
        alert_type: rule.type,
        severity: rule.severity,
        description: `${rule.type.replaceAll("_", " ")} detection on observed ${event.behavior}; rule threshold satisfied. Legitimate activity may also trigger this rule.`,
      }
    : null;
}
