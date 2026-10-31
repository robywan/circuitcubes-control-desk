# Issue tracker: Local Markdown

Issues and specs for this repo live as Markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`.
- The spec is `.scratch/<feature-slug>/spec.md`.
- Implementation issues are one file per ticket at
  `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`,
  never a single combined tickets file.
- Triage state is recorded as a `Status:` line near the top of each
  issue file; see `triage-labels.md` for the role strings.
- Comments and conversation history append to the bottom of the file
  under a `## Comments` heading.

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/`, creating the
directory if needed.

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass
the path or issue number directly.

## Wayfinding operations

Used by `/wayfinder`. The map is a file with one child file per ticket.

- Map: `.scratch/<effort>/map.md`, containing Notes, Decisions-so-far,
  and Fog.
- Child ticket: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from
  `01`, with the question in the body. A `Type:` line records
  `research`, `prototype`, `grilling`, or `task`.
- Wayfinding tickets use workflow statuses rather than triage roles:
  `open`, `claimed`, and `resolved`.
- Blocking: a `Blocked by: NN, NN` line near the top. A ticket is
  unblocked when every listed ticket is `resolved`.
- Frontier: scan the issue directory for open, unblocked, unclaimed
  tickets; first by number wins.
- Claim: set `Status: claimed` and save before any work.
- Resolve: append the answer under an `## Answer` heading, set
  `Status: resolved`, then append a gist and link to Decisions-so-far
  in the map.
