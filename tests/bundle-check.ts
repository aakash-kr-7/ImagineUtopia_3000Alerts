/** Test the actual deployable Worker artifact, including static MIME and guest capabilities. */
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const worker = (
  await import(pathToFileURL(process.cwd() + "/dist/server/index.js").href)
).default;
const db = new DatabaseSync(":memory:");
for (const file of readdirSync("drizzle")
  .filter((f) => f.endsWith(".sql"))
  .sort())
  db.exec(readFileSync("drizzle/" + file, "utf8"));
const DB = {
  prepare(sql: string) {
    return {
      bind(...args: any[]) {
        return {
          sql,
          args,
          async all() {
            return { results: db.prepare(sql).all(...args) };
          },
        };
      },
    };
  },
  async batch(items: { sql: string; args: any[] }[]) {
    db.exec("BEGIN");
    try {
      const results = items.map((i) => ({
        meta: { changes: Number(db.prepare(i.sql).run(...i.args).changes) },
      }));
      db.exec("COMMIT");
      return results;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  },
};
async function request(
  path: string,
  cookie?: string,
  method = "GET",
  payload?: unknown,
) {
  return worker.fetch(
    new Request("https://test.local" + path, {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(method !== "GET"
          ? { origin: "https://test.local", "content-type": "application/json" }
          : {}),
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    }),
    { DB },
  );
}
const a = await request("/api/bootstrap"),
  b = await request("/api/bootstrap");
assert.equal(a.status, 200);
assert.equal(b.status, 200);
const cookieA = a.headers.get("set-cookie")!.split(";")[0],
  cookieB = b.headers.get("set-cookie")!.split(";")[0];
assert.notEqual(cookieA, cookieB);
const runA = (await a.json()).runs[0].id,
  runB = (await b.json()).runs[0].id;
assert.notEqual(runA, runB);
assert.equal((await request("/api/runs/" + runA, cookieB)).status, 404);
assert.equal((await request("/api/runs/" + runA, cookieA)).status, 200);
const html = await request("/");
assert.equal(html.status, 200);
assert.match(html.headers.get("content-type"), /text\/html/);
assert.match(html.headers.get("content-security-policy"), /worker-src/);
const assets = readdirSync("dist/client/assets"),
  module = assets.find((f) => f.endsWith(".mjs"))!;
assert.match(
  (await request("/assets/" + module)).headers.get("content-type"),
  /application\/javascript/,
);
const cross = await worker.fetch(
  new Request("https://test.local/api/runs/" + runA, {
    method: "DELETE",
    headers: { cookie: cookieA, origin: "https://evil.local" },
  }),
  { DB },
);
assert.equal(cross.status, 403);
await request("/api/runs/" + runA, cookieA, "DELETE");
assert.equal((await request("/api/runs/" + runA, cookieA)).status, 404);
db.close();
console.log(
  "Deployable Worker: static modules, CSP, separate guest workspaces, private reads, CSRF protection and deletion verified.",
);
