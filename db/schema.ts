import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const runs = sqliteTable(
  "runs",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    created: text("created").notNull(),
    seed: integer("seed"),
    count: integer("count").notNull(),
    manifest: text("manifest").notNull(),
  },
  (t) => [index("idx_runs_owner_created").on(t.owner, t.created)],
);
export const chunks = sqliteTable(
  "operational_chunks",
  {
    run_id: text("run_id").notNull(),
    kind: text("kind").notNull(),
    part: integer("part").notNull(),
    payload: text("payload").notNull(),
  },
  (t) => [primaryKey({ columns: [t.run_id, t.kind, t.part] })],
);
export const truthChunks = sqliteTable(
  "sealed_truth_chunks",
  {
    run_id: text("run_id").notNull(),
    part: integer("part").notNull(),
    payload: text("payload").notNull(),
  },
  (t) => [primaryKey({ columns: [t.run_id, t.part] })],
);
export const states = sqliteTable(
  "incident_states",
  {
    run_id: text("run_id").notNull(),
    incident_id: text("incident_id").notNull(),
    disposition: text("disposition").notNull(),
    version: integer("version").notNull(),
  },
  (t) => [primaryKey({ columns: [t.run_id, t.incident_id] })],
);
export const audit = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    run_id: text("run_id").notNull(),
    sequence: integer("sequence").notNull(),
    incident_id: text("incident_id").notNull(),
    actor: text("actor").notNull(),
    timestamp: text("timestamp").notNull(),
    disposition: text("disposition").notNull(),
    reason: text("reason").notNull(),
    previous_hash: text("previous_hash").notNull(),
    hash: text("hash").notNull(),
    version: integer("version").notNull(),
    idempotency_key: text("idempotency_key").notNull(),
  },
  (t) => [
    uniqueIndex("idx_audit_run_sequence").on(t.run_id, t.sequence),
    uniqueIndex("idx_audit_run_idempotency").on(t.run_id, t.idempotency_key),
  ],
);
