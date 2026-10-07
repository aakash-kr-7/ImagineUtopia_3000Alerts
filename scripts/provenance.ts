import { readFileSync, readdirSync } from "node:fs";
import { canonical, sha256 } from "../core/contracts";
export async function experimentProvenance() {
  const files = readdirSync("core", { recursive: true })
    .filter((f): f is string => typeof f === "string" && f.endsWith(".ts"))
    .map((f) => "core/" + f)
    .sort();
  const sources = Object.fromEntries(
    await Promise.all(
      files.map(async (name) => [
        name,
        await sha256(readFileSync(name, "utf8")),
      ]),
    ),
  );
  return {
    source_fingerprint_sha256: await sha256(canonical(sources)),
    source_files: sources,
    lockfile_sha256: await sha256(readFileSync("package-lock.json", "utf8")),
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    generated_at: new Date().toISOString(),
  };
}
