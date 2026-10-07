import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { canonical, sha256 } from "../core/contracts";
const raw = readFileSync(0, "utf8"),
  input = JSON.parse(raw);
try {
  let output: unknown;
  if (input.command === "triage")
    output = (await import("../core/engine")).triage(input.alerts);
  else if (input.command === "simulate") {
    const s = (await import("../core/simulator")).simulate(input.config);
    if (input.output_dir) {
      mkdirSync(input.output_dir, { recursive: true });
      writeFileSync(
        input.output_dir + "/alerts.jsonl",
        s.alerts.map((a) => JSON.stringify(a)).join("\n") + "\n",
      );
      writeFileSync(
        input.output_dir + "/events.jsonl",
        s.events.map((e) => JSON.stringify(e)).join("\n") + "\n",
      );
      writeFileSync(
        input.output_dir + "/scenarios.json",
        JSON.stringify(
          { episodes: s.episodes, event_labels: s.eventLabels },
          null,
          2,
        ),
      );
      writeFileSync(
        input.output_dir + "/validation.json",
        JSON.stringify(s.validation, null, 2),
      );
      writeFileSync(
        input.output_dir + "/inventory.json",
        JSON.stringify(s.inventory, null, 2),
      );
      writeFileSync(
        input.output_dir + "/truth.json",
        JSON.stringify(s.truth, null, 2),
      );
      writeFileSync(
        input.output_dir + "/run_manifest.json",
        JSON.stringify(
          {
            ...s.manifest,
            config: s.config,
            input_sha256: await sha256(canonical(s.alerts)),
            truth_sha256: await sha256(canonical(s.truth)),
          },
          null,
          2,
        ),
      );
      output = { written: input.output_dir, manifest: s.manifest };
    } else output = s;
  } else if (input.command === "evaluate")
    output = (await import("../core/evaluation")).evaluate(
      input.result,
      input.truth,
    );
  else if (input.command === "brief")
    output = (await import("../core/brief")).templateBrief(
      input.incident,
      input.alerts,
    );
  else throw new Error("Unknown command");
  process.stdout.write(JSON.stringify(output));
} catch (e) {
  process.stderr.write(
    JSON.stringify({ error: e instanceof Error ? e.message : "Invalid input" }),
  );
  process.exitCode = 1;
}
