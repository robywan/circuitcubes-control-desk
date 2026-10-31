# Domain Docs

How engineering skills consume this repo's domain documentation.

## Before exploring, read these

- `GLOSSARY.md` at the repo root.
- Relevant ADRs under `docs/adr/`.

If these files or directories do not exist, proceed silently. The
`/domain-modeling` skill creates them lazily when terms or decisions
are resolved.

## File structure

This is a single-context repo:

- `GLOSSARY.md`: shared domain vocabulary.
- `docs/adr/`: architectural decision records.

## Use the glossary's vocabulary

When naming domain concepts in issues, proposals, hypotheses, or tests,
use the terms defined in `GLOSSARY.md`, rather than synonyms it avoids.

If a needed concept is missing, reconsider whether the project uses it
or note the gap for `/domain-modeling`.

## Flag ADR conflicts

If a proposal contradicts an existing ADR, surface the conflict explicitly
rather than silently overriding the decision. Name the ADR and explain
why reopening it may be worthwhile.
