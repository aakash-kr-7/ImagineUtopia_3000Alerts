# Public Wazuh example data

## What this file is

[`public/examples/ait-wazuh-demo.csv`](../public/examples/ait-wazuh-demo.csv) is a compact, import-ready 500-row example made from the public [AIT Alert Data Set sample on Zenodo](https://zenodo.org/records/19691904). The dataset record describes Wazuh alerts collected from a controlled cyber range and is distributed under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/).

The repository copy keeps event time, Wazuh rule level and description, a pseudonymized host, and the sensor category. It deliberately omits raw log text, user and network identifiers, ATT&CK labels, and evaluation labels. The original sample file checksum was verified against the Zenodo record before creating this subset. Repository sample SHA-256: `3acb6bba417aae967cb171aab47c2dcee879912f04e1503bf79b1f309457c6df`.

## How to use it

1. Choose **Import data**.
2. Download or select `ait-wazuh-demo.csv`.
3. Confirm the automatically detected Wazuh severity scale and preview accepted rows.
4. Analyze the file, then inspect the resulting incident groups and individual alert evidence.

The data contains 500 source alerts across 15 pseudonymized hosts. It demonstrates ingestion, grouping, prioritization, and evidence review. The file does **not** carry attack ground truth, so results from it are not an accuracy score or a measure of attack detection. Use the separately documented synthetic holdout for controlled evaluation.

## Attribution

Emad Sherif, “Task-specific dataset for Structural Leakage in Host Intrusion Alert Corpora: A Grouped Evaluation Framework for ATT&CK-Aligned Cyber Risk Mapping,” Zenodo, 2026, [record 19691904](https://zenodo.org/records/19691904), licensed CC BY 4.0. This project distributes a reduced and transformed example: source host names are replaced with stable demo pseudonyms, and fields not needed for the import walkthrough are removed. The source author does not endorse this application or its analysis.
