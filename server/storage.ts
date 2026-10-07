export interface Statement {
  sql: string;
  args?: unknown[];
}
export interface Store {
  all(sql: string, args?: unknown[]): Promise<any[]>;
  batch(statements: Statement[]): Promise<{ changes: number }[]>;
}
export function d1Store(db: D1Database): Store {
  return {
    async all(sql, args = []) {
      return (
        await db
          .prepare(sql)
          .bind(...args)
          .all()
      ).results;
    },
    async batch(s) {
      return (
        await db.batch(s.map((x) => db.prepare(x.sql).bind(...(x.args ?? []))))
      ).map((x) => ({ changes: x.meta.changes }));
    },
  };
}
export function chunkRows(
  run: string,
  kind: string,
  value: unknown,
  truth = false,
): Statement[] {
  const s = JSON.stringify(value),
    rows: Statement[] = [];
  for (let i = 0; i < s.length; i += 64000)
    rows.push({
      sql: truth
        ? "INSERT INTO sealed_truth_chunks(run_id,part,payload) VALUES(?,?,?)"
        : "INSERT INTO operational_chunks(run_id,kind,part,payload) VALUES(?,?,?,?)",
      args: truth
        ? [run, i / 64000, s.slice(i, i + 64000)]
        : [run, kind, i / 64000, s.slice(i, i + 64000)],
    });
  return rows;
}
export async function readChunk(store: Store, run: string, kind: string) {
  const rows = await store.all(
    "SELECT payload FROM operational_chunks WHERE run_id=? AND kind=? ORDER BY part",
    [run, kind],
  );
  return rows.length ? JSON.parse(rows.map((x) => x.payload).join("")) : null;
}
