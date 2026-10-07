import test from "node:test";
import assert from "node:assert/strict";
import { exportCSV, exportHTML } from "../server/export";
import { triage } from "../core/engine";
test("downloaded evidence neutralizes spreadsheet formulas and escapes untrusted HTML", () => {
  const result = triage([
    {
      alert_id: '=HYPERLINK("evil")',
      timestamp: "2026-01-01T00:00:00Z",
      source: "edr",
      alert_type: "<script>bad</script>",
      severity: 1,
      entities: ["host:x"],
      description: "Untrusted source",
    },
  ]);
  assert.match(exportCSV(result), /'=HYPERLINK/);
  const html = exportHTML(
    { id: "run", created: "now", manifest: {} },
    result,
    null,
  );
  assert.ok(html.includes("&lt;script&gt;bad&lt;/script&gt;"));
  assert.doesNotMatch(html, /<script>/);
});
