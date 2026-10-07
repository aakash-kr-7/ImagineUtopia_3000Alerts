import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { createServer as createViteServer } from "vite";
import { handleApi } from "./api";
import type { Store } from "./storage";
mkdirSync("runtime", { recursive: true });
const db = new DatabaseSync(
  process.env.UTOPIA_DATABASE ?? "runtime/utopia.sqlite",
);
db.exec("PRAGMA journal_mode=WAL;");
db.exec("CREATE TABLE IF NOT EXISTS local_migrations(name TEXT PRIMARY KEY)");
for (const file of readdirSync("drizzle")
  .filter((x) => x.endsWith(".sql"))
  .sort()) {
  if (!db.prepare("SELECT name FROM local_migrations WHERE name=?").get(file)) {
    db.exec(readFileSync("drizzle/" + file, "utf8"));
    db.prepare("INSERT INTO local_migrations(name) VALUES(?)").run(file);
  }
}
const store: Store = {
  async all(sql, args = []) {
    return db.prepare(sql).all(...(args as any[])) as any[];
  },
  async batch(statements) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map((s) => ({
        changes: Number(
          db.prepare(s.sql).run(...((s.args ?? []) as any[])).changes,
        ),
      }));
      db.exec("COMMIT");
      return results;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  },
};
const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: "spa",
});
const server = createServer(async (req, res) => {
  if (!req.url?.startsWith("/api/")) {
    vite.middlewares(req, res);
    return;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 5_000_000) {
      res.writeHead(413);
      res.end("Input too large");
      return;
    }
    chunks.push(chunk);
  }
  const request = new Request("http://127.0.0.1:5173" + req.url, {
    method: req.method,
    headers: req.headers as Record<string, string>,
    ...(req.method !== "GET" && req.method !== "HEAD"
      ? { body: Buffer.concat(chunks) }
      : {}),
  });
  const response = await handleApi(request, store, "local-analyst");
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
});
server.listen(5173, "127.0.0.1", () =>
  console.log("Utopia SOC ready: http://127.0.0.1:5173"),
);
process.on("SIGTERM", async () => {
  server.close();
  await vite.close();
  db.close();
  process.exit(0);
});
