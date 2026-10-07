import { z } from "zod";
export const importReportSchema = z
  .object({
    version: z.literal("2.0"),
    filename: z.string().min(1).max(250),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    kind: z.literal("telemetry"),
    records: z.number().int().min(1).max(10000),
    accepted: z.number().int().min(1).max(10000),
    rejected: z.number().int().min(0).max(10000),
    issues: z
      .array(
        z
          .object({
            record: z.number().int().positive(),
            field: z.string().max(100),
            message: z.string().max(4000),
            level: z.enum(["error", "warning"]),
          })
          .strict(),
      )
      .max(2000),
    adapters: z.record(z.string().max(80), z.number().int().nonnegative()),
    options: z
      .object({
        severityScale: z.enum([
          "auto",
          "normalized",
          "wazuh",
          "syslog",
          "ten",
          "percent",
          "words",
        ]),
        timezone: z.enum(["require", "UTC"]),
        fields: z.record(z.string().max(80), z.string().max(200)),
      })
      .strict(),
    missing: z
      .object({
        entities: z.number().int().nonnegative(),
        criticality: z.number().int().nonnegative(),
        techniques: z.number().int().nonnegative(),
      })
      .strict(),
    warnings: z.array(z.string().max(1000)).max(20),
  })
  .strict()
  .refine(
    (r) => r.records === r.accepted + r.rejected,
    "Record totals disagree",
  );
const finding = z
  .object({
    id: z.string().max(100),
    page: z.number().int().min(1).max(100),
    quote: z.string().max(1500),
    techniques: z.array(z.string().regex(/^T\d{4}(?:\.\d{3})?$/)).max(30),
    indicators: z.array(z.string().max(300)).max(30),
    severity_mentions: z.array(z.string().max(20)).max(10),
  })
  .strict();
export const documentSubmissionSchema = z
  .object({
    filename: z.string().min(1).max(250),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    pages: z.number().int().min(1).max(100),
    extracted_characters: z.number().int().nonnegative().max(20000000),
    findings: z.array(finding).max(500),
  })
  .strict();
export const truthSubmissionSchema = z
  .object({
    labels: z.record(z.string().max(100), z.string().min(1).max(100)),
    episodes: z.record(
      z.string().max(100),
      z
        .object({
          family: z.string().min(1).max(200),
          alert_ids: z.array(z.string().max(100)).max(10000),
        })
        .strict(),
    ),
  })
  .strict();
