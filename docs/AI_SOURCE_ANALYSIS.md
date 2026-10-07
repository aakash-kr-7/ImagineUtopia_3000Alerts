# AI-assisted project-report analysis

The [judge brief](../public/judge-brief.md) includes a Groq-assisted synthesis of four team reports: problem relevance, proposed technical approach, originality, and impact/scalability. The final judge-facing text was checked and edited against the current implementation and committed evaluation artifacts. The analysis is presentation support, not a fresh external fact-check.

## What the model did

The Groq `openai/gpt-oss-120b` model summarized each report separately, then synthesized the four summaries with a short, explicit current-implementation fact sheet. The prompts treated report contents as source data, not instructions, and required distinctions between current behavior, proposal-era design, and future recommendations. Source SHA-256 values are recorded in the judge brief.

The model output was not used as-is. The final brief removes claims that existing security platforms generally lack explanations, narrows the originality claim to this project's inspectable evaluation workflow, corrects a proposal-era baseline description, and keeps synthetic metrics separate from real-world impact claims.

## Regenerate the draft

The four source Markdown files are maintained in the team's separate `Evaluation Source Archive`; they are not copied into this repository. If those files are available locally, provide `GROQ_API_KEY` through a secure shell environment or secret manager and pass the four paths in this order:

1. Problem Understanding and Relevance
2. Technical Approach and Feasibility
3. Solution and Innovation Originality Audit
4. Impact, Evaluation, and Scalability

```powershell
node scripts/analyze-hackathon-context.mjs <problem.md> <solution.md> <originality.md> <impact.md>
```

The generator sends the report contents to Groq, makes paced per-document calls, and writes `docs/HACKATHON_ANALYSIS_DRAFT.md`. That draft is ignored by Git. Review its facts and wording before updating `public/judge-brief.md`; never commit the provider key. The application does not make model calls for user-uploaded reports, and its incident briefs remain deterministic templates.
