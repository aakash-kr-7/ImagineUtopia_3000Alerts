# Contributing

Thanks for helping improve the Utopia SOC evidence workbench. Keep changes reproducible, explainable, and aligned with the evidence the project can support.

## Development setup

Use Node.js 24 and Python 3.12 for the same runtime versions configured in CI.

```bash
npm ci
python -m pip install -r requirements.txt
npm run dev
```

The local app is at `http://127.0.0.1:5173`. The optional FastAPI adapter can be run with `make demo` at `http://127.0.0.1:8000`.

## Before opening a change

Run the same core checks as CI when practical:

```bash
npm run format:check
npm run check
npm test
python -m pytest -q
npm run build
npm run test:bundle
npx playwright install chromium
npm run test:e2e
```

For simulator changes, run `npm run validate:simulation`. For benchmark changes, preserve the fixed protocol and regenerate the relevant report with the repository scripts. Record the command and output in the pull request; do not infer benchmark improvements from one seed.

## Invariants to preserve

- The operational triage engine must not read simulator truth or evaluation labels.
- The simulator records synthetic ground truth separately and reveals it only after the run completes.
- ATT&CK mappings describe observed behavior; they do not prove intent or calibrated risk.
- Metrics must use the documented denominators and shared protocol. Do not present queue compression as analyst time saved.
- Imported reports and generated artifacts must not add user-provided telemetry, credentials, or local runtime databases to Git.
- Keep provider credentials server-side and optional. The default demonstration should work without a model key.
- Preserve explicit handling for unsupported formats, unknown fields, missing timestamps, and rejected rows.

## Documentation expectations

Update the relevant contract in `docs/` when behavior, supported formats, metric definitions, or limitations change. Add reproducible evidence for quantitative claims and label assumptions. Keep the root README concise and link to the deeper contract instead of maintaining duplicate explanations.

## Pull requests

Describe the user-visible change, implementation boundary, checks run, and any unverified behavior. Include screenshots for visual changes and list any benchmark protocol or source-data changes. Do not claim production readiness or commercial superiority from this prototype's current evidence.
