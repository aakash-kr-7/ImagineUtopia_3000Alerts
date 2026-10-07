import { build } from "esbuild";
import {
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";
const assets = {};
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".pdf": "application/pdf",
  ".woff2": "font/woff2",
};
function visit(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) visit(p);
    else {
      const name = "/" + p.replace("dist/client/", ""),
        ext = name.slice(name.lastIndexOf("."));
      assets[name] = {
        body: readFileSync(p).toString("base64"),
        type: types[ext] ?? "application/octet-stream",
      };
    }
  }
}
visit("dist/client");
assets["/"] = assets["/index.html"];
mkdirSync("dist/server", { recursive: true });
await build({
  entryPoints: ["server/worker.ts"],
  outfile: "dist/server/index.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  define: { __STATIC_ASSETS__: JSON.stringify(assets) },
  metafile: true,
});
writeFileSync(
  "dist/server/wrangler.json",
  JSON.stringify(
    {
      name: "utopia-soc",
      main: "index.js",
      compatibility_date: "2026-09-01",
      compatibility_flags: ["nodejs_compat"],
      d1_databases: [
        {
          binding: "DB",
          database_name: "utopia-soc",
          database_id: "00000000-0000-0000-0000-000000000000",
          migrations_dir: "../../drizzle",
        },
      ],
    },
    null,
    2,
  ),
);
console.log(
  "Built Cloudflare Worker with fetch handler and embedded public assets.",
);
