import { MAPPINGS } from "../mapping";
export interface TextPage {
  page: number;
  text: string;
}
export interface ReportFinding {
  id: string;
  page: number;
  quote: string;
  techniques: string[];
  indicators: string[];
  severity_mentions: string[];
}
/** Extract evidence without inventing alerts, timestamps, confidence, or intent. */
export function assessDocument(
  pages: TextPage[],
  filename: string,
  sha256: string,
) {
  const findings: ReportFinding[] = [];
  for (const p of pages.slice(0, 100))
    for (const line of p.text
      .split(/\n|(?<=[.!?])\s+(?=[A-Z])/)
      .map((x) => x.trim())
      .filter(Boolean)) {
      const techniques = [
        ...new Set(line.match(/\bT\d{4}(?:\.\d{3})?\b/g) ?? []),
      ];
      const indicators = [
        ...new Set([
          ...(line.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) ?? []).filter((ip) =>
            ip.split(".").every((n) => Number(n) <= 255),
          ),
          ...(line.match(/\b[a-fA-F0-9]{64}\b/g) ?? []),
          ...(line.match(
            /\b(?:[a-zA-Z0-9-]+\.)+(?:com|net|org|io|xyz|ru|info)\b/g,
          ) ?? []),
        ]),
      ];
      const severity_mentions = [
        ...new Set(
          line.toLowerCase().match(/\b(?:critical|high|medium|low)\b/g) ?? [],
        ),
      ];
      if (findings.length >= 500) break;
      if (
        techniques.length ||
        indicators.length ||
        /credential|ransomware|exfiltrat|lateral movement|phishing|powershell|malware|brute.force/i.test(
          line,
        )
      )
        findings.push({
          id: `F-${p.page}-${findings.length + 1}`,
          page: p.page,
          quote: line.slice(0, 1500),
          techniques,
          indicators: indicators.slice(0, 30),
          severity_mentions,
        });
      if (findings.length >= 500) break;
    }
  const techniques = [...new Set(findings.flatMap((f) => f.techniques))];
  return {
    version: "2.0",
    kind: "document" as const,
    filename,
    sha256,
    pages: pages.length,
    extracted_characters: pages.reduce((s, p) => s + p.text.length, 0),
    findings,
    techniques: techniques.map((id) => ({
      id,
      mapping: Object.values(MAPPINGS).find((m) => m.technique === id) ?? null,
    })),
    indicators: [...new Set(findings.flatMap((f) => f.indicators))],
    limitations: [
      "Document assessment extracts evidence mentions and source quotes. It does not treat mentions as observed malicious events.",
      "No event-level recall, incident scoring, or alert counts are inferred from narrative text.",
      "Only 500 matching passages and 1,500 characters per quote are shown. Review the original report for context.",
      "Scanned images need an OCR/text export; documents are not sent to an external model.",
    ],
  };
}
export type DocumentAssessment = ReturnType<typeof assessDocument>;
