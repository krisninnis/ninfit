# NinFit Repository Workflow

## Purpose

Use this skill for any repository task in NinFit.

Repository:

`C:\Users\thoma\fitness-tracker`

Remote:

`https://github.com/krisninnis/ninfit`

The repository is the primary source of truth.

## Mandatory preflight

Before proposing or modifying code, establish repository truth.

Run:

```powershell
git branch --show-current
git log --oneline -10
git --no-optional-locks status --short
git remote -v
Test-Path .git\index.lock
```

Read relevant project documentation before implementation, including as applicable:

- `AGENTS.md`
- `DESIGN.md`
- `PLAN.md`
- `BRIEFING.md`
- `docs/brand/ninfit-brand-v1.md`

Inspect relevant implementation instead of relying on summaries.

## Working-tree safety

Never destroy or overwrite work merely to make the repository match a briefing.

Do not:
- reset
- restore
- stash
- clean
- rebase
- delete unrelated work
- normalise unrelated line endings
- overwrite local modifications

If an unrelated dirty file exists, preserve it and keep it out of the task diff.

Known recurring example:
- `vite.config.ts` may appear modified due to a CRLF-only artefact.

Do not touch it unless the current task genuinely requires it.

## Permission boundaries

Do not perform these actions unless explicitly authorised:

- commit
- push
- merge
- deploy
- install dependencies
- rewrite schema
- start a later milestone

Do not stage unrelated files.

## Implementation discipline

Prefer small vertical milestones.

For each milestone:

1. Establish repository truth.
2. Read the relevant domain and tests.
3. Confirm the intended boundary.
4. Implement only the authorised scope.
5. Add focused tests.
6. Run targeted tests.
7. Run the full test suite.
8. Run typecheck.
9. Run build.
10. Inspect the final diff.
11. Report exact repository state.
12. Stop before commit/push unless authorised.

## Investigation-first rule

If architecture, persistence, migrations, safety boundaries, or data semantics are unclear, investigate before coding.

An investigation should identify:
- current data model
- persistence
- mutation points
- consumers
- existing tests
- invariants
- migration impact
- safety risks
- recommended implementation boundary

## Final report

For implementation tasks, report:

### Repository state
- branch
- HEAD
- working-tree state
- index lock

### Implementation
- files added
- files changed
- behaviour implemented

### Safety/invariants
- what is preserved
- what cannot happen
- data/progression guarantees

### Verification
- targeted tests
- full tests
- typecheck
- build

### Diff scope
- unrelated files untouched
- accidental changes absent

### Verdict
Use a clear status such as:
- `READY FOR REVIEW`
- `BLOCKED — NEEDS HUMAN DECISION`

## Milestone isolation

Never begin the next roadmap milestone automatically.

Stop at the authorised boundary.
