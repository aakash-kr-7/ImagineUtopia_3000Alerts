# Judge questions

**What did you build?** An end-to-end analyst evidence workbench: validated event simulation, multi-format imports, inspectable correlation and scores, human decisions, audit, exported dossiers and a reproducible comparison lab. We do not claim to invent correlation.

**Is the simulator cherry-picked?** It uses explicit scenario prerequisites, raw observations and shared detector rules. Benign maintenance includes the same suspicious behaviors. Severity noise is label-independent, asset criticality is inventory-driven and IDs are opaque. Holdouts, stress seeds and replay are separated. The fixed-count background sampling is disclosed; realism is structurally validated, not asserted as production truth.

**What are the actual results?** At 3k alerts, mean UT recall@25 is 80.0% versus B0 16.7%; grouping F1 is 25.6% and contamination 3.7%. At 10k, UT recall@25 drops to 48.8%. The dashboard shows per-seed values, uncertainty and misses, not only the best demo seed.

**Why is F1 modest?** Surfacing one alert from each episode is sufficient for visibility. Pairwise reconstruction also penalizes legitimate benign sessions grouped together and partial attack chains. These are different goals.

**Can I upload any SOC report?** Supported structured exports normalize into telemetry; searchable narrative PDF/DOCX/TXT produces cited evidence mentions. Mapping, severity, timezone, accepted/rejected counts and provenance are explicit. Scanned PDFs need OCR and complex PDF tables should export CSV. We do not invent event times or incident recall from prose.

**Does the engine see truth?** Its strict operational contract and import closure exclude simulator/evaluation labels. Truth is stored separately. Imported annotations are evaluated after triage, and tests prove they leave membership/risk unchanged. An administrator still controls the process/database; this is logical separation, not encrypted isolation from an administrator.

**Where is the AI?** Deterministic graph/context algorithms control grouping and risk. Verified templates explain a controlled facts packet. An optional model provider adapter exists with bounded retries and fallback, but the live app makes no model calls. No LLM autonomously blocks or escalates.

**What did the external dataset prove?** Only a concrete ingestion/structural check: published archive checksum verified, 3,000 sampled Wazuh records accepted, 400 unsupported AMiner records rejected, environment namespaces preserved, workload measured. Phase intervals are not gold per-alert episodes. No external attack accuracy or vendor superiority is claimed.

**Is replay time-to-detect?** No. It measures event-time delay until the first episode alert becomes visible in a top-25 prefix queue at 30-minute snapshots. It includes misses and excludes human response timing.

**Can others use it safely?** The hosted interface is public; reports are scoped to a random browser capability or trusted signed-in user. Anonymous browsers never share an owner. Raw files remain local; accepted evidence is stored. Origin checks, quotas, deletion and lazy expiration are tested. Clearing a guest cookie loses access; deliberate identity rotation is beyond the per-session quota design.

**Is the audit immutable?** App-level append, atomic writes, versions, unique indexes, idempotency and verification guard the workflow. An administrator can rewrite an entirely unanchored chain. External anchoring is future work.

**Why TypeScript?** One security engine runs locally, in the hosted Worker and through FastAPI/Pydantic. It avoids diverging scoring implementations. Explicit graph code replaces a NetworkX dependency while retaining inspectable formulas and budgets.

**What comes next?** Independently annotated real SOC episodes, analyst-task studies, source-specific severity calibration, production streaming/monitoring, organizational authentication/retention policy and stronger global abuse controls. Current synthetic accuracy and external ingestion checks do not prove production efficacy.
