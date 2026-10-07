# Event-driven simulation contract

The simulator produces observations. It does not run exploits, contact hosts, or execute response actions. It is an offline telemetry testbed, not a claim to replicate an enterprise SOC's full distribution.

## Stages and label boundary

1. Create a stable 120-asset inventory: 90 workstations (criticality 2), 20 applications (3), 10 databases (4), two sites and assigned IPs. Create 160 opaque employee users.
2. Instantiate four stage sequences: phishing→execution→LSASS→remote service→egress; identity→discovery→credentials→remote service; sign-in→persistence→execution→encryption; execution→periodic DNS→egress. Strict event-time order is enforced with jitter. Concurrent starts and 80-minute gaps are independent stress controls.
3. Generate raw `SecurityEvent` records with telemetry fields, sensor, host, user, peer and timestamp. Events contain **no label or intent field**. A separate event-ID map holds episode membership.
4. Detector predicates inspect event fields: failure counts, encoded commands, LSASS target, remote peer, extension modifications, transfer bytes, unfamiliar sign-ins and DNS periodicity. Legitimate maintenance/backup/security-tool sessions use the same behavior generators and detectors, including sensitive lookalikes.
5. Apply label-independent detector-severity noise, inventory-based criticality, sensor coverage, entity omission and duplicate notifications. IDs are seeded opaque hashes independent of episode names. Source references point back to raw event IDs.
6. Fill to the requested alert count with benign sessions. This deliberately conditions benign volume on the target count. Routine successful authentication events remain unalerted. Attack truth is populated from the separate event map only after a detector emits an alert.
7. Validate before returning. A planned episode with zero observed alerts remains in truth and the recall denominator. The engine receives only strict `Alert[]`.

Sensors are probabilistically omitted for campaign events; the benign fill uses coverage-conditioned sampling to reach an exact alert budget. Thus the sensor-coverage sweep measures campaign observability under a fixed background alert count, not an unbiased uniform outage of all telemetry. Business-hour weighting and session bursts are realism assumptions, not fitted estimates. Every generated dataset includes these caveats.

## Validation and adversarial checks

- Exact alert count, strict schemas and unique event IDs.
- Label cardinality and episode count.
- Every alert references a real event with a satisfied detector.
- Inventory criticality remains identical for attack and benign activity on the same asset.
- Alert timestamps differ from event time by at most the one-second duplicate offset.
- Scenario stages reference the correct behavior/time and increase strictly.
- Episode membership and truth lists agree.
- Diagnostic counts: routine unalerted events, duplicates, missing entities, benign lookalikes, unobservable episodes and severity histograms for attack/benign populations.

Negative tests corrupt provenance, topology, ordering and label cardinality and require validation failure. `npm run validate:simulation` measures 105 seed/scale/condition combinations. Determinism checks compare the entire canonical dataset, including events and validation output. Structural realism checks do not establish external validity.

## Reproducibility

The PRNG is an explicit 32-bit LCG. A fixed UTC base date ensures deterministic wall-clock-independent output. Scenario, detector, generator and engine versions are recorded. Export the raw event stream, inventory, scenario stage records, validation report and truth separately. `events.jsonl` and `alerts.jsonl` contain no episode labels; `scenarios.json` and `truth.json` are evaluation-only artifacts.
