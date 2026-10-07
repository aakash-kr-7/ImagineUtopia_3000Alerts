import { test, expect } from "@playwright/test";
import { zipSync, strToU8 } from "fflate";
import { readFileSync } from "node:fs";
test("queue evidence, simulation controls, benchmark exploration, and responsive layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.request.post("/api/runs", {
    data: { seed: 239, count: 3000, episodes: 12 },
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Incident queue", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".queue-table tbody tr").first()).toBeVisible();
  await page.locator(".incident-link").first().click();
  await expect(page.locator("dialog.incident-dialog")).toBeVisible();
  await page.getByRole("tab", { name: "Correlation", exact: true }).click();
  await expect(page.locator(".graph-container")).toBeVisible();
  await page.getByRole("button", { name: "Close investigation" }).click();
  await page
    .getByRole("button", { name: "Simulation lab", exact: true })
    .click();
  await expect(
    page.locator("#main").getByText("Sensor coverage"),
  ).toBeVisible();
  await expect(
    page.locator("#main .simulation-form").getByText("Duplicate notifications"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Benchmark lab", exact: true })
    .click();
  await expect(
    page.getByText("Method comparison with uncertainty"),
  ).toBeVisible();
  await page.getByLabel("Batch", { exact: true }).selectOption("10000");
  await page.getByLabel("Metric", { exact: true }).selectOption("pairwise_f1");
  await expect(
    page.getByText("Robustness and failure conditions"),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    )
    .toBe(true);
  expect(errors).toEqual([]);
});
test("Sentinel import creates evidence queue, observable comparisons and private-label evaluation", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Import reports", exact: true })
    .click();
  await page.getByLabel("Choose SOC report").setInputFiles({
    name: "sentinel.json",
    mimeType: "application/json",
    buffer: readFileSync("public/examples/sentinel-alerts.json"),
  });
  await expect(page.getByText("Accepted evidence preview")).toBeVisible();
  await page.getByRole("button", { name: "Analyze 2 accepted events" }).click();
  await expect(page.locator(".queue-table tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Evaluation", exact: true }).click();
  await expect(
    page.getByText("Measure workload without inventing accuracy."),
  ).toBeVisible();
  await page.getByLabel("Upload independent ground truth").setInputFiles({
    name: "truth.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        labels: { "SENT-001": "ATTACK", "SENT-002": "ATTACK" },
        episodes: {
          ATTACK: {
            family: "Browser annotation fixture",
            alert_ids: ["SENT-001", "SENT-002"],
          },
        },
      }),
    ),
  });
  await expect(page.getByText("Episode visibility")).toBeVisible();
  await expect(page.getByText("Browser annotation fixture")).toBeVisible();
});
test("CSV and XLSX normalize, DOCX and searchable PDF produce page-cited assessments", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Import reports", exact: true })
    .click();
  const input = page.getByLabel("Choose SOC report");
  await input.setInputFiles({
    name: "alerts.csv",
    mimeType: "text/csv",
    buffer: readFileSync("public/examples/alerts.csv"),
  });
  await expect(
    page.getByRole("button", { name: "Analyze 3 accepted events" }),
  ).toBeEnabled();
  const xlsx = zipSync({
    "xl/worksheets/sheet1.xml": strToU8(
      '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>timestamp</t></is></c><c r="B1" t="inlineStr"><is><t>severity</t></is></c><c r="C1" t="inlineStr"><is><t>host</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>2026-01-01T00:00:00Z</t></is></c><c r="B2" t="inlineStr"><is><t>high</t></is></c><c r="C2" t="inlineStr"><is><t>server</t></is></c></row></sheetData></worksheet>',
    ),
  });
  await input.setInputFiles({
    name: "alerts.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(xlsx),
  });
  await expect(
    page.getByRole("button", { name: "Analyze 1 accepted events" }),
  ).toBeEnabled();
  const docx = zipSync({
    "word/document.xml": strToU8(
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Credential access T1003.001 observed. Address 203.0.113.8 mentioned.</w:t></w:r></w:p></w:body></w:document>',
    ),
  });
  await input.setInputFiles({
    name: "report.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: Buffer.from(docx),
  });
  await expect(page.getByText("Evidence passages")).toBeVisible();
  await expect(page.getByText("T1003.001 · LSASS Memory")).toBeVisible();
  const pdfPage = await browser.newPage();
  await pdfPage.setContent(
    "<h1>SOC Report</h1><p>Credential access T1003.001 and malicious PowerShell were investigated. Address 203.0.113.27 is mentioned.</p>",
  );
  const pdf = await pdfPage.pdf();
  await pdfPage.close();
  await input.setInputFiles({
    name: "report.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  await expect(
    page.getByText("PDF text extraction preserves page references.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByText("Evidence passages")).toBeVisible();
  await expect(page.locator(".document-finding").first()).toContainText(
    "page 1",
  );
  await page.getByRole("button", { name: "Save document assessment" }).click();
  await expect(page.getByText("Document assessment saved")).toBeVisible();
  await expect(page.locator(".document-assessment")).toBeVisible();
});
test("partial imports require review; unsupported numeric severity does not receive silent defaults", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Import reports", exact: true })
    .click();
  const rows = [
    { timestamp: "2026-01-01T00:00:00Z", severity: "high", host: "x" },
    { severity: "low", host: "y" },
  ];
  await page.getByLabel("Choose SOC report").setInputFiles({
    name: "partial.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(rows)),
  });
  await expect(
    page.getByRole("button", { name: "Analyze 1 accepted events" }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await expect(
    page.getByRole("button", { name: "Analyze 1 accepted events" }),
  ).toBeEnabled();
  await page.getByLabel("Choose SOC report").setInputFiles({
    name: "ecs.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify([
        {
          "@timestamp": "2026-01-01T00:00:00Z",
          event: { kind: "alert", severity: 70 },
        },
      ]),
    ),
  });
  await expect(
    page.getByRole("button", { name: "Analyze 0 accepted events" }),
  ).toBeDisabled();
  await page.getByLabel("Severity scale").selectOption("percent");
  await expect(
    page.getByRole("button", { name: "Analyze 1 accepted events" }),
  ).toBeEnabled();
});
