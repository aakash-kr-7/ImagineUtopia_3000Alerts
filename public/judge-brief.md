# Utopia Signal · Team 239

## From alert volume to a reviewable decision

Utopia Signal is an inspectable alert-triage workbench. It groups related alerts into ranked investigations, shows the evidence behind those decisions, and measures the result against simple baselines on the same synthetic data.

The project does **not** claim to invent alert correlation. Its defensible contribution is the combination of a deterministic, traceable workflow with a seeded evaluation harness that keeps the answer key out of triage and makes coverage-versus-review-workload visible.

## Why this problem matters

Analysts review signals emitted by endpoint, identity, network, and other security tools. An individual alert may be incomplete; related activity can be separated across entities and time. The workflow question is whether an analyst can find and inspect the useful thread without treating severity as the only ranking signal.

Existing security platforms already offer alert grouping, prioritization, and investigation features. Utopia is a focused research prototype for examining one part of that workflow. It is not a replacement for those products, a claim that they all lack explanation, or a commercial-product comparison.

## What the judge can verify

1. Start a randomized **450–900 alert** simulation spanning **one or two simulated hours**. The 3,000-alert experiment below is a separate held-out benchmark, not the live demo batch size.
2. Watch saved alerts replay in event-time order. Open any alert to inspect its score, grouping evidence, incident assignment, rank, and ATT&CK mapping.
3. Filter the queue for review priority and high-importance items. Inspect the full incident evidence and record a human disposition.
4. After triage, reveal the separate simulation ledger: source events, alert mappings, labels, scenario stages, inventory, validation, and hashes.
5. Open Evaluation to compare the queue against fixed strategy baselines using episode coverage, grouping quality, contamination, and review-item workload.

The triage engine receives operational alerts. Synthetic labels are stored separately and used by evaluation only after triage. MITRE ATT&CK v17.1 mappings give taxonomy context for observed behavior; they do not prove malicious intent.

## Current measured evidence

These are synthetic, fixed-seed results from the committed protocol. Recall@25 is the fraction of planned attack episodes surfaced in the first 25 ranked review items. A review item is a workload proxy, not a fixed amount of analyst time.

|      Run size | Utopia episode Recall@25 |
| ------------: | -----------------------: |
|  1,000 alerts |                    93.8% |
|  3,000 alerts |                    80.0% |
| 10,000 alerts |                    48.8% |

At 3,000 alerts, the severity-only baseline reached **16.7% Recall@25** across 20 held-out seeds. Utopia's grouping F1 was **25.6%** and benign contamination was **3.7%**, as defined in the evaluation protocol. The 10,000-alert result is an important limit: episode coverage falls as the workload grows. It should not be presented as evidence of production-scale throughput or generalization.

A separate AIT-ADS check accepted 3,000 supported Wazuh records and rejected 400 unsupported AMiner records. That verifies a bounded ingestion/workload path; it does not establish external attack accuracy because the available labels are not per-alert episode ground truth.

## Impact and scale: what follows from the evidence

The current evidence supports a narrow statement: **on these synthetic holdout runs, the ranked queue surfaced more attack episodes within the first 25 review items than the severity-only baseline.** It does not measure analyst minutes saved. A large grouped incident may take longer to review than a small one, and queue position alone does not capture human decisions.

The next meaningful validation is a pilot with independently annotated episodes from a real SOC dataset, followed by a human review study that records investigation time, analyst overrides, misses, and incident complexity. Larger or streaming deployments would also need measured throughput, peak resource use, operational monitoring, access controls, and tenant isolation. Those are future validation steps, not current capabilities.

## Defensible originality answer

> Alert grouping and contextual prioritization are established capabilities. Our contribution is making a compact triage experiment inspectable end to end: the judge can trace a ranked investigation to its alerts and links, then compare coverage and grouping against shared baselines while the synthetic answer key stays outside the triage path. We report the limits alongside the result; this is a research prototype, not a vendor replacement.

## 45-second presentation

“Security teams already have tools that group and prioritize alerts. Our question is narrower: can we show exactly why these alerts became this ranked investigation, and measure what reaches the first 25 review items? On 20 held-out synthetic seeds at 3,000 alerts, Utopia surfaced 80% of planned episodes in that queue prefix, versus 16.7% for severity-only. You can inspect the evidence and reveal the separate answer key after triage. This measures queue coverage, not analyst time saved or real-world SOC accuracy. The next step is validation with independently labelled SOC data and analysts.”

## What to emphasize—and what to avoid

- Emphasize evidence links, deterministic decisions, the sealed post-run ledger, and the shared comparison protocol.
- Describe ATT&CK mappings as behavior labels, not proof of compromise.
- Call the metrics synthetic episode coverage and review-item workload.
- Do not claim novel correlation, universal accuracy, breach prevention, regulatory compliance, analyst-time savings, or superiority to Microsoft, Splunk, or another commercial platform.
- Use the live simulation to demonstrate the workflow; use the fixed 3,000-alert experiment only when explaining the benchmark.

## Source analysis trail

This brief synthesizes the four team reports below. Groq's `openai/gpt-oss-120b` model produced a source-by-source analysis; the user-facing claims here were then checked and edited against the current implementation and committed evaluation artifacts. The original documents remain in the team's Evaluation Source Archive and are not copied into this repository.

| Source                                                                      | Main contribution to this brief                                                                | SHA-256 of analyzed source                                         |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `Why SOC Alert Triage Needs to Exist_ Problem Understanding & Relevance.md` | Operational problem, intended user, and boundaries around existing platforms and breach claims | `d25d985c45a7d9e909f006c32b838f6fa63e1d7792f05538e7c0892f43d34a33` |
| `proposed solution analysis.md`                                             | Proposed pipeline, demo flow, and distinction between current implementation and roadmap       | `a485f8855cb07620df4cdeb1915981d8014068c99c6f7808475b42b76a7486c2` |
| `Solution & Innovation_ An Honest Originality Audit.md`                     | Honest originality framing and common-unit evaluation design                                   | `1db96e1e02dd7c4f47e064c85d5b41879a06dfedcfe56d9bcdf94aaa2263aecc` |
| `Imagine_Utopia_Impact_and_Scalability_10_Marks.md`                         | Workload-proxy definition, human-impact boundary, and realistic validation path                | `bd15b17c4287b6a16977403da24a8da785dd0810d46eee4f76086ec5634612e7` |

This synthesis is presentation support, not an independent fact-check of statistics in the source reports. Project performance claims above point to the repository's [evaluation protocol](https://github.com/aakash-kr-7/ImagineUtopia_3000Alerts/blob/main/docs/EVALUATION_PROTOCOL.md) and [committed benchmark report](https://github.com/aakash-kr-7/ImagineUtopia_3000Alerts/blob/main/public/benchmark-report.json).
