# SOC import contract

Raw file bytes are read in the browser and hashed with SHA-256. They are not uploaded. The user previews normalized telemetry or cited document findings before submitting. The server independently validates the submitted contract, accepted count and per-alert provenance hash. It cannot independently recompute the hash of a file it never receives: provenance ties rows to the user-provided file identity, not a server attestation of original file content.

| Input | Supported behavior | Limits / explicit exclusions |
| --- | --- | --- |
| JSON / JSONL | Canonical arrays, alerts/value/results wrappers, Azure column tables, Elastic hits | 10k records; malformed line/object fails parsing |
| CSV / TSV | Header table, quoted fields, editable mappings | Structural column mismatches fail; numeric severities need explicit source scale |
| XLSX | Worksheet header tables, shared/inline strings, cached values, recognized date formats | No formula execution; ISO export required for Excel 1904 dates; max 256 columns; timezone must be confirmed |
| PDF | Searchable text, page-cited evidence assessment | Max 100 pages; scanned/encrypted/problematic PDFs require OCR/searchable export; complex tables should export CSV |
| DOCX | Paragraph text evidence assessment | Word pagination not reconstructed; page 1 denotes document; no embedded-image OCR |
| TXT / LOG | JSON lines if every line is an object; otherwise text assessment | Arbitrary syslog/CEF is not falsely advertised as normalized telemetry |

File cap: 12 MB. Office central-directory count and total declared inflation are checked before decompression (2,000 entries / 32 MB); encrypted/ZIP64 files and unsupported XML document types fail explicitly. PDF extraction uses a local module worker. The API accepts at most 5 MB of normalized JSON; large provenance-rich exports may need splitting even below 10k rows.

## Normalization

Required: a real event timestamp, source/sensor category, behavior key, normalized severity 0–4, entity array and description. Unknown entities are permitted; the alert is retained standalone. Missing asset criticality contributes zero inventory score. Explicit techniques outside the eleven pinned mappings remain in evidence but receive no fabricated tactic credit.

Known adapters: canonical, Sentinel, Defender, Wazuh, Suricata, ECS and generic mapped exports. Sentinel `Entities` strings are decoded. Wazuh host preference uses predecoder hostname before collector agent name. Host/user/IP fields have typed prefixes. Repeated vendor IDs receive distinct row IDs, preserving both records. Optional vendor labels are ignored and reported, never forwarded into the operational contract.

Severity is ordinal: canonical 0–4; Wazuh 0–15 maps linearly with rounding; Suricata 1–3 reverses to 3–1; syslog 0–7 reverses to 4–0. Textual informational/low/medium/high/critical maps 0/1/2/3/4. ECS numerical values are source-specific and therefore require user-selected 0–10, 0–100 or another supported explicit scale. No severity mapping is claimed to be probability calibration.

ISO offsets normalize to UTC. Unix seconds/milliseconds are explicit epoch values. Unzoned strings are rejected until the user confirms UTC; the confirmation appears in provenance. Narrative publication dates are never substituted for event time.

Every accepted row records file hash, source row/page where available, adapter, original severity, timestamp basis and warnings. The report reconciles accepted + rejected = total, exposes unknown inventory/mappings and requires acknowledgment before analyzing a rejected subset. Preview issue lists are bounded while totals remain complete.

## Narrative assessment

Technique IDs, IP/domain/hash mentions and security-behavior passages are extracted with page/quote references. Indicator presence is not proof of maliciousness; a report may discuss a ruled-out hypothesis. The assessment deliberately has no invented alert IDs, event timestamps, compromise probabilities or attack recall. It is an evidence-reading aid and searchable handoff, not an automated incident reconstruction or a full language-model summary.

## Independent annotations

`POST /api/runs/:id/labels` accepts a separate complete map from accepted alert IDs to an episode or `BENIGN`, plus episode family/member lists. It rejects missing/extra IDs, duplicate memberships and inconsistencies. It computes evaluation only from the already-stored operational result; membership, scores and ranking remain unchanged. These are user-supplied labels, not independently certified truth. Synthetic truth is sealed at generation.
