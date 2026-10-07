# Evaluation protocol v2

`experiments/protocol.json` fixes configuration and seeds before execution. Engine version: `utopia-2.0-constrained`. Development seeds 101–105; 20 holdouts 701–720 at 1,000 / 3,000 / 10,000 alerts; five stress seeds 801–805 per eight conditions. Twelve planned episodes per batch. Default demo seed 239. No per-test-seed tuning is performed.

## Common input and workload

All methods receive the same normalized alerts. Labels enter only after a method constructs its queue. One opened row is a workload unit; all evidence in that row is considered visible. Because rows differ in evidence size, `alerts_reviewed_at_25` reports source-alert volume alongside row counts. Neither quantity measures human minutes.

B0: severity-only single alerts. B1: first observed host / fixed UTC 30-minute bucket. B2: exact observed host/user set / fixed time bucket. B3: contextual score on singleton alerts, testing context without graph grouping. UT: dedup, typed/time graph, constrained union and contextual risk. Educational implementations do not constitute a commercial vendor comparison.

## Metrics

- Episode recall@K: planned episodes with at least one alert in the first K opened items / all planned episodes. Unobservable episodes stay in the denominator.
- Items@80/100%: earliest discrete rank reaching the target; null means unreached/unavailable, never interpolated. Aggregates show the number of finite values explicitly to avoid hiding censored misses.
- Compression@100%: raw count / items needed to reach full coverage, separate from total queue row reduction.
- Pairwise positives: unordered source-alert pairs in one item. Correct pairs share the same non-benign episode. Benign pairs and mixed-episode pairs are penalized. BENIGN is not treated as one episode. No predicted pairs gives null precision; no positive truth pairs gives zero recall and zero F1.
- Benign contamination: benign alerts / all alerts **inside attack-containing items**; numerator/denominator are reported. It is not a false-positive rate.
- Episode completeness: mean largest same-episode cluster fraction, with zero for an unobservable episode. Fragmentation: mean number of items containing each episode. Visibility and complete reconstruction are different goals.

All queues use deterministic score/time/ID tie-breaks. Tests cover denominators, unattainable coverage and singleton precision.

## Uncertainty and interventions

Sixty holdout runs report raw per-seed metrics, mean, SD, range and percentile bootstrap 95% intervals with 2,000 resamples and seeded RNG. Paired differences subtract a baseline from UT **within the same seed**, then bootstrap those differences. Intervals quantify simulator-seed variability; shared scenario families mean they do not estimate cross-organization uncertainty.

Forty stress runs vary missing telemetry, shared NAT, stretched timing, inverted detector severity, low sensor coverage, simultaneous campaigns and duplicate rate. Eighty ablations vary severity-only ranking, removal of IDF, removal of dedup and unbounded component union. Resource failures are recorded as unavailable, not silently dropped. Ablations diagnose design effects; they do not retune the submitted engine.

Every artifact records input/truth hashes, core-source fingerprints, dependency-lock hash, runtime and fixed protocol hash where applicable. Runtime excludes generation/evaluation/storage and human effort. Heap delta is not peak memory.

## Temporal replay

Five independent seeds 901–905 replay chronological prefixes at 30-minute event-time snapshots. Each snapshot recalculates IDF and triage only from alerts already visible. First top-25 episode visibility minus its first observable alert time is a **visibility delay**, not analyst detection time. Snapshot quantization adds up to 30 minutes. Membership/ranks can change as evidence arrives. Never surfaced and unobservable episodes retain null delays. This is a replay experiment, not a production streaming service.

## Separate external-data check

AIT-ADS archive MD5 is verified against official Zenodo metadata. A bounded uniform reservoir samples each archive member, retaining source lines and member hashes. The check normalizes 3,000 Wazuh records, rejects 400 AMiner records without a supported severity contract, namespaces independent environments, and measures observable queue/evidence properties only. Dataset phase labels are not per-alert episode gold truth. No external accuracy is claimed and these values are never pooled with synthetic holdouts.
