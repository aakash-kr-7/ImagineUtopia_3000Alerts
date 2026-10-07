import { experimentProvenance } from "./provenance";
import { writeFileSync } from "node:fs";
import { simulate } from "../core/simulator";
const cases = [
  {},
  { missing: 0.5 },
  { sensor_coverage: 0.1 },
  { attack_overlap: true },
  { timing: "stretched" as const },
  { hub_density: "high" as const },
  { duplicate_rate: 0.3 },
];
const results = [];
for (const config of cases)
  for (const seed of [101, 102, 103, 701, 702])
    for (const count of [1000, 3000, 10000]) {
      const s = simulate({ seed, count, episodes: 12, ...config });
      results.push({ seed, count, config, validation: s.validation });
    }
writeFileSync(
  "public/simulation-validation.json",
  JSON.stringify(
    {
      version: "2.0",
      provenance: await experimentProvenance(),
      cases: results.length,
      passed: results.filter((r) => r.validation.valid).length,
      results,
    },
    null,
    2,
  ),
);
console.log(`Validated ${results.length} simulations`);
