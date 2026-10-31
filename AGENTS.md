## Agent skills

### Issue tracker

Issues and specs are tracked as local Markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Backlog

Deferred ideas live in root `BACKLOG.md` (committed, unlike `.scratch/`). Read it before writing a spec; add whatever a spec defers, tagged with the feature slug.

### Research

Cited findings from primary sources live in `docs/research/`, one file per topic (committed, unlike `.scratch/`). Read the matching file before changing how the app talks to a device; save `/research` output there and point specs at it instead of copying it.

### Triage labels

Use the five standard triage roles as status strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` and `docs/adr/`. Before exploring domain concepts or decisions, read `docs/agents/domain.md`.
