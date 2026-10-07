import { strFromU8, unzipSync } from "fflate";
import Papa from "papaparse";
import type { TextPage } from "../../core/ingestion/assessment";
import {
  extractRecords,
  type SourceRecord,
} from "../../core/ingestion/normalize";
export interface ParsedFile {
  filename: string;
  sha256: string;
  records: SourceRecord[];
  pages: TextPage[];
  format: string;
  notes: string[];
}
const MAX_BYTES = 12 * 1024 * 1024,
  MAX_INFLATED = 32 * 1024 * 1024;
function xml(text: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(text))
    throw new Error("Office XML contains an unsupported document type");
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("Invalid Office XML");
  return doc;
}
function zipEntries(bytes: Uint8Array) {
  // Inspect central directory before decompression: per-entry and total declared sizes are bounded.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) throw new Error("Invalid Office ZIP directory");
  const count = view.getUint16(end + 10, true),
    offset = view.getUint32(end + 16, true);
  if (count > 2000 || offset >= bytes.length)
    throw new Error("Office archive has too many entries");
  if (count === 65535 || offset === 0xffffffff)
    throw new Error("ZIP64 Office archives are not supported");
  let position = offset,
    total = 0;
  for (let i = 0; i < count; i++) {
    if (
      position + 46 > bytes.length ||
      view.getUint32(position, true) !== 0x02014b50
    )
      throw new Error("Invalid Office archive");
    if (view.getUint16(position + 8, true) & 1)
      throw new Error("Encrypted Office files are not supported");
    total += view.getUint32(position + 24, true);
    if (total > MAX_INFLATED)
      throw new Error("Expanded Office archive exceeds 32 MB");
    position +=
      46 +
      view.getUint16(position + 28, true) +
      view.getUint16(position + 30, true) +
      view.getUint16(position + 32, true);
  }
  const entries = unzipSync(bytes, {
    filter: (entry) =>
      /^(?:xl\/(?:worksheets\/sheet\d+\.xml|sharedStrings\.xml|styles\.xml|workbook\.xml)|word\/document\.xml)$/.test(
        entry.name,
      ) && entry.originalSize <= MAX_INFLATED,
  });
  if (Object.values(entries).reduce((n, b) => n + b.length, 0) > MAX_INFLATED)
    throw new Error("Expanded content exceeds limit");
  return entries;
}
function spreadsheet(entries: Record<string, Uint8Array>): SourceRecord[] {
  const workbook = entries["xl/workbook.xml"]
    ? xml(strFromU8(entries["xl/workbook.xml"]))
    : null;
  if (
    ["1", "true"].includes(
      workbook
        ?.getElementsByTagName("workbookPr")[0]
        ?.getAttribute("date1904") ?? "",
    )
  )
    throw new Error("Excel 1904 date system requires an ISO-date CSV export");
  const shared = entries["xl/sharedStrings.xml"]
    ? Array.from(
        xml(strFromU8(entries["xl/sharedStrings.xml"])).getElementsByTagName(
          "si",
        ),
      ).map((si) =>
        Array.from(si.getElementsByTagName("t"))
          .map((t) => t.textContent ?? "")
          .join(""),
      )
    : [];
  const styles = entries["xl/styles.xml"]
    ? xml(strFromU8(entries["xl/styles.xml"]))
    : null;
  const custom = new Map(
    Array.from(styles?.getElementsByTagName("numFmt") ?? []).map((e) => [
      Number(e.getAttribute("numFmtId")),
      e.getAttribute("formatCode") ?? "",
    ]),
  );
  const formats = Array.from(
    styles?.getElementsByTagName("cellXfs")[0]?.getElementsByTagName("xf") ??
      [],
  ).map((e) => Number(e.getAttribute("numFmtId")));
  const records: SourceRecord[] = [];
  for (const [name, bytes] of Object.entries(entries)
    .filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort()) {
    const rows = Array.from(xml(strFromU8(bytes)).getElementsByTagName("row"));
    let headers: string[] = [];
    for (const row of rows) {
      const cells: Record<number, unknown> = {};
      for (const cell of Array.from(row.getElementsByTagName("c"))) {
        const ref = cell.getAttribute("r") ?? "A1",
          letters = ref.match(/^[A-Z]+/)?.[0] ?? "A";
        const index =
          [...letters].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
        if (index > 255) throw new Error("Workbook has more than 256 columns");
        const type = cell.getAttribute("t"),
          value = cell.getElementsByTagName("v")[0]?.textContent ?? "";
        let resolved: unknown =
          type === "s"
            ? (shared[Number(value)] ?? "")
            : type === "inlineStr"
              ? Array.from(cell.getElementsByTagName("t"))
                  .map((t) => t.textContent)
                  .join("")
              : type === "b"
                ? value === "1"
                : value;
        const fmt = formats[Number(cell.getAttribute("s") ?? 0)];
        if (
          value &&
          !type &&
          ((fmt >= 14 && fmt <= 22) ||
            /[yd]/i.test(
              (custom.get(fmt) ?? "").replace(/"[^"]*"|\[[^\]]*\]/g, ""),
            ))
        ) {
          const serial = Number(value);
          if (Number.isFinite(serial))
            resolved = new Date((serial - 25569) * 86400000)
              .toISOString()
              .replace(/Z$/, ""); // Excel dates have no timezone; user must confirm.
        }
        cells[index] = resolved;
      }
      if (!headers.length) {
        headers = Array.from(
          { length: Math.max(0, ...Object.keys(cells).map(Number)) + 1 },
          (_, i) => String(cells[i] ?? `column_${i + 1}`).trim(),
        );
        if (new Set(headers).size !== headers.length)
          throw new Error("Workbook has duplicate headers");
        continue;
      }
      if (Object.values(cells).some((v) => v !== ""))
        records.push({
          row: records.length + 1,
          value: Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""])),
        });
      if (records.length > 10000)
        throw new Error("Workbook exceeds 10,000 records");
    }
  }
  return records;
}
export async function readFile(file: File): Promise<ParsedFile> {
  if (file.size > MAX_BYTES)
    throw new Error("File exceeds 12 MB. Export a smaller time range.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const format = file.name.split(".").at(-1)?.toLowerCase() ?? "",
    notes: string[] = [];
  let records: SourceRecord[] = [],
    pages: TextPage[] = [];
  if (format === "json")
    records = extractRecords(JSON.parse(new TextDecoder().decode(bytes)));
  else if (["jsonl", "ndjson"].includes(format))
    records = extractRecords(
      new TextDecoder()
        .decode(bytes)
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .map((line, i) => {
          try {
            return JSON.parse(line);
          } catch {
            throw new Error(`Invalid JSON on line ${i + 1}`);
          }
        }),
    );
  else if (["csv", "tsv"].includes(format)) {
    const result = Papa.parse<Record<string, unknown>>(
      new TextDecoder().decode(bytes),
      {
        header: true,
        skipEmptyLines: "greedy",
        delimiter: format === "tsv" ? "\t" : "",
        transformHeader: (h) => h.trim().replace(/^\uFEFF/, ""),
      },
    );
    if (result.errors.length)
      throw new Error(
        `CSV structure error: ${result.errors[0].message} at row ${(result.errors[0].row ?? 0) + 1}`,
      );
    records = extractRecords(result.data);
  } else if (format === "xlsx") {
    records = spreadsheet(zipEntries(bytes));
    notes.push(
      "All worksheet header tables imported; dates require explicit timezone confirmation. Formulas use stored cached values only.",
    );
  } else if (format === "docx") {
    const entry = zipEntries(bytes)["word/document.xml"];
    if (!entry) throw new Error("No Word document text found");
    const doc = xml(strFromU8(entry));
    pages = [
      {
        page: 1,
        text: Array.from(doc.getElementsByTagName("w:p"))
          .map((p) =>
            Array.from(p.getElementsByTagName("w:t"))
              .map((t) => t.textContent)
              .join(""),
          )
          .join("\n"),
      },
    ];
    notes.push(
      "DOCX references use extracted paragraph order; page 1 denotes the document, because Word pagination is layout-dependent.",
    );
  } else if (format === "pdf") {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).href;
    const document = await pdfjs.getDocument({ data: bytes }).promise;
    try {
      if (document.numPages > 100)
        throw new Error("PDF exceeds 100 pages; split the report");
      for (let n = 1; n <= document.numPages; n++) {
        const page = await document.getPage(n),
          content = await page.getTextContent();
        pages.push({
          page: n,
          text: content.items
            .map((item: any) =>
              item.str ? item.str + (item.hasEOL ? "\n" : " ") : "",
            )
            .join(""),
        });
      }
    } finally {
      await document.destroy();
    }
    if (pages.reduce((n, p) => n + p.text.trim().length, 0) < 30)
      throw new Error(
        "This PDF has no usable text layer. Run OCR or export searchable PDF/CSV.",
      );
    notes.push(
      "PDF text extraction preserves page references. Layout and tables can require a CSV export for event-level analysis.",
    );
  } else if (["txt", "log"].includes(format)) {
    const text = new TextDecoder().decode(bytes),
      lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length && lines.every((line) => line.trim().startsWith("{")))
      records = extractRecords(lines.map((line) => JSON.parse(line)));
    else pages = [{ page: 1, text }];
  } else
    throw new Error(
      "Supported: JSON/JSONL, CSV/TSV, XLSX, searchable PDF, DOCX, TXT/LOG. Export proprietary archives first.",
    );
  if (!records.length && !pages.length)
    throw new Error("The file contains no usable records or text");
  return { filename: file.name, sha256, records, pages, format, notes };
}
