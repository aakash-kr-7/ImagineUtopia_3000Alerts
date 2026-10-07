export const SOURCE_NAMES: Record<string, string> = {
  edr: "Endpoint detection and response",
  idp: "Identity provider",
  ids: "Network intrusion detection",
};

export const SOURCE_SHORT_NAMES: Record<string, string> = {
  edr: "EDR",
  idp: "IdP",
  ids: "IDS",
};

export function sourceLabel(source: string) {
  return SOURCE_NAMES[source] ?? source.toUpperCase();
}

export function sourceAbbreviation(source: string) {
  return SOURCE_SHORT_NAMES[source] ?? source.toUpperCase();
}
