# Primary sources and provenance

- [MITRE ATT&CK Enterprise STIX v17.1](https://github.com/mitre-attack/attack-stix-data/blob/master/enterprise-attack/enterprise-attack-17.1.json). The eleven controlled techniques used by the simulator are extracted in `attack-reference.json`, including original STIX IDs, modification timestamps, tactic lists, revoked/deprecated flags, and the full downloaded bundle's SHA-256. The referenced version is intentionally pinned, not described as the latest release.
- [MITRE ATT&CK Password Spraying](https://attack.mitre.org/techniques/T1110/003/). Reference for the simulator's credential-access behavior. All scenarios are fictional approximations, not replicas of real attacks.
- [Microsoft Sentinel scheduled analytics rules](https://learn.microsoft.com/en-us/azure/sentinel/scheduled-rules-overview). Reference for documented alert/incident grouping concepts. Utopia baselines are not the commercial Sentinel implementation and no product superiority is claimed.
- [AIT Alert Data Set, Zenodo record 8263181](https://zenodo.org/records/8263181) and [official AIT adapter/generation repository](https://github.com/ait-aecid/alert-data-set). Public external-data candidate with heterogeneous alerts and phase labels. No external release data was used to produce the reported synthetic metrics.

The user's two PDFs provided the project requirements and evaluation design. Numerical vendor-survey and breach-cost claims appearing in those proposal slides are not reproduced as verified facts in the new pitch. All quantitative product results come from the included executable benchmark.

## Import schema research for v2

- [Microsoft Sentinel SecurityAlert schema](https://learn.microsoft.com/en-us/azure/sentinel/security-alert-schema): `TimeGenerated`, `SystemAlertId`, textual `AlertSeverity`, `Entities` and `CompromisedEntity` underpin the adapter.
- [Elastic ECS event fields](https://www.elastic.co/docs/reference/ecs/ecs-event): `event.severity` is source-specific, so the importer requires an explicit numerical scale instead of assuming 0–10.
- [Wazuh rule classification](https://documentation.wazuh.com/current/user-manual/ruleset/rules-classification.html): vendor levels 0–15 remain identifiable in provenance. Normalized 0–4 values are an ordinal UI mapping.
- [Suricata EVE JSON](https://docs.suricata.io/en/latest/output/eve/eve-json-format.html): explicit alert fields are used; no attack labels are inferred from description keywords.
- [Mozilla PDF.js](https://mozilla.github.io/pdf.js/): local browser text-layer extraction with page references; no external upload or claimed OCR.

External AIT validation uses the actual 96,202,946-byte official archive, published MD5 `43db6b1f0996e0024befd617706c50e9`, and records archive/member SHA-256 in `public/external-validation.json`. The downloadable archive is excluded from source control. Sample line numbers and deterministic reservoir seed strings make the check reproducible; the report does not expose organizational/private user uploads.
