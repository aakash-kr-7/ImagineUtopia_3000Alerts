import type { Mapping } from "./contracts";
export const ATTACK_VERSION = "Enterprise ATT&CK v17.1";
const raw: Record<string, [string, string, string]> = {
  password_spray: ["T1110.003", "credential-access", "Password Spraying"],
  suspicious_login: ["T1078", "initial-access", "Valid Accounts"],
  phishing_attachment: [
    "T1566.001",
    "initial-access",
    "Spearphishing Attachment",
  ],
  powershell: ["T1059.001", "execution", "PowerShell"],
  credential_dump: ["T1003.001", "credential-access", "LSASS Memory"],
  remote_service: ["T1021.002", "lateral-movement", "SMB/Windows Admin Shares"],
  scheduled_task: ["T1053.005", "persistence", "Scheduled Task"],
  outbound_transfer: ["T1041", "exfiltration", "Exfiltration Over C2 Channel"],
  encryption_activity: ["T1486", "impact", "Data Encrypted for Impact"],
  dns_beacon: ["T1071.004", "command-and-control", "DNS"],
  discovery: ["T1087.002", "discovery", "Domain Account"],
};
export const MAPPINGS: Record<string, Mapping> = Object.assign(
  Object.create(null),
  Object.fromEntries(
    Object.entries(raw).map(([type, [technique, tactic, name]]) => [
      type,
      {
        type,
        technique,
        tactic,
        name,
        url:
          "https://attack.mitre.org/techniques/" +
          technique.replace(".", "/") +
          "/",
      },
    ]),
  ),
);
export const TACTIC_ORDER: Record<string, number> = {
  "initial-access": 0,
  execution: 1,
  persistence: 2,
  discovery: 3,
  "credential-access": 4,
  "lateral-movement": 5,
  "command-and-control": 6,
  exfiltration: 7,
  impact: 8,
};
