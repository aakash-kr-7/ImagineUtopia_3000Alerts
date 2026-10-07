# Supplied-document implementation map · v2

| Requirement | Concrete implementation | Evidence / boundary |
| --- | --- | --- |
| Seeded enterprise and attack chains | Inventory, raw events, causal prerequisites, detector predicates, four families, benign lookalikes | Deterministic whole-dataset checks; 105 structural validation runs |
| Separated operational alerts / truth | Strict schema, label-free event detectors and engine, evaluation-only tables and CLI files | Import-closure, extra-field and post-triage annotation tests |
| Validation / input limits | Zod + Pydantic, browser format bounds, normalization quality preview | Rejected rows accounted; 5 MB API / 10k alerts |
| Dedup retains IDs | First-to-last 120-second group span, severity-independent key | All source IDs retained exactly once; max severity preserved |
| Explainable graph | IDF, entity windows, decay, strongest-edge constrained union | Link reasons, blocked reasons/examples, comparison/pair safety budgets |
| Map / classify / score | Pinned eleven active ATT&CK v17.1 techniques, controlled imported IDs | Official STIX reference test, unknown mappings get no invented credit |
| Transparent risk | Six capped components and tier thresholds | Reproducible score summation; risk is ordinal |
| Human workflow / audit | Reasons, statuses, expected versions, idempotent keys, transactional chain | Concurrency, tampering, owner isolation and persistence tests |
| Brief consistency | Facts packet, objective verifier, optional provider + template fallback | Live templates; model service, caching/token dashboard deferred |
| Analyst dashboard | Queue, source timeline/provenance, graph, score, audit | Browser-flow tests; responsive layout |
| SOC report uploads | JSON/JSONL, CSV/TSV, XLSX; searchable PDF/DOCX/TXT cited assessment | No scanned OCR or universal arbitrary-PDF telemetry claim |
| Shared methods / curves | B0/B1/B2/B3/UT, recall, reconstruction and contamination | Identical inputs, common metric definitions |
| Multiple seeds / uncertainty | 60 holdouts, paired bootstrap intervals, 40 stress runs | Protocol/source/input/truth fingerprints; no holdout tuning |
| Algorithm ablations | 80 intervention runs | Valid/unavailable counts explicit |
| Time-to-surface | Prefix-only 30-minute temporal replay, 5 independent seeds | Event-time visibility delay; no human detection-time claim |
| External dataset | Checksum-verified AIT reservoir, 3k accepted / 400 unsupported | Structural/workload validation only; no fabricated phase-derived truth |
| Public usable deployment | Sites Worker + D1, isolated browser/signed-user workspaces | Actual built Worker isolation/module/CSP checks and terminal deployment status |
| Python / Docker / scripts | Shared-core FastAPI adapter, non-root local container, localhost Compose, CI | No duplicate Python scoring; container/local appliance single analyst |
| Presentation | Editable pitch, PDF, demo script, Q&A, primary sources | Quantitative claims generated from committed v2 artifacts |

Deferred: production streaming ingestion, universal OCR/proprietary format parsing, external gold-label accuracy, live provider/caching metrics, organizational compliance controls, independent audit anchoring and human-time study. No autonomous response or matched commercial comparison is claimed.
