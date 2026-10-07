# Five-minute judge demonstration

Open the app in a fresh browser. A new workspace opens on the measured project briefing, without auto-generating a fixed 3,000-alert run. Start a randomized 450–900 alert simulation across one or two simulated hours, or import a reviewer-provided CSV/XLSX. The selected count and seed are recorded in the run.

**0:00 — The operational problem.** Start with the 3,000-alert held-out comparison: mean Recall@25 is 80.0% for Utopia and 16.7% for the severity-only baseline across 20 fixed synthetic seeds. Explain that a smaller review queue can help surface evidence but does not imply equal analyst effort.

**0:40 — Explain one decision.** Open the highest-ranked incident. Read its original evidence IDs, six score contributions and controlled ATT&CK mappings. Select Correlation, inspect a link's typed entity, gap, IDF, temporal contribution and threshold. Record “investigating” with a concrete reason. Open Audit trail and verify the hash chain.

**1:30 — Bring your own evidence.** Open Import reports. Download and upload the Sentinel example. Show automatic adapter selection, accepted rows, original-to-normalized severity, unknown inventory, source hash and warnings. Analyze it, then inspect source-row provenance. Evaluation shows observable workload rather than invented accuracy. Explain that complete independently annotated labels can be imported separately after scoring.

**2:20 — A real report is not always telemetry.** Upload the narrative example or a searchable PDF. Show quoted behavior/technique/indicator mentions with source references. Explain the distinction between a cited mention and an observed alert. Scanned reports need OCR; publication dates are not event timestamps. Save/export the document assessment.

**3:00 — Validate the experiment.** Simulation lab shows raw event count, routine unalerted activity, legitimate lookalikes, duplicates and validation checks. Raw Alerts opens a fast chronological replay of the saved one/two-hour source stream. Pause or change speed, click any alert for its rank, incident assignment, score components, ATT&CK mappings and link evidence, then use the priority filters. The event generator never executes attacks.

**3:45 — Let the evidence speak.** Evaluation shows episode Recall@K, grouping F1, contamination and the full coverage/workload curve. Then Source of truth explicitly reveals the event ledger and synthetic labels after triage; inspect missed/unalerted episode stages and export the JSON ledger. Benchmark lab covers holdouts, stress runs, ablations and temporal replay. State that external gold-label accuracy has not been established.

**4:40 — Hand over something real.** Export JSON/CSV and the printable HTML dossier. Show the source repository, CI checks, locally runnable container, architecture contracts and editable pitch. Close with the next validation step: independent SOC episode annotations and measured human review effort.

## Offline fallback

`npm ci && npm run dev`, or `docker compose up --build`. Browser examples and benchmark artifacts are bundled; no model service is required. Do not promise the local single-analyst appliance provides the hosted multi-user isolation.
