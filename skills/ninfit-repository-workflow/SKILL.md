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

- `docs/ROADMAP.md` — the canonical product plan; read it before any feature work
- `AGENTS.md`
- `DESIGN.md`
- `PLAN.md`
- `BRIEFING.md`
- `docs/brand/ninfit-brand-v1.md`

Inspect relevant implementation instead of relying on summaries.

Related skills: `ninfit-product-guardrails` for what may be built,
`ninfit-ui-verification` for how to prove UI work, `ninfit-deployment-health`
for anything that must survive a deploy.

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

## Semantic change vs whitespace churn

A long list of modified files is not evidence of lost work. Establish which
changes are real before reacting to any of them.

```bash
git --no-optional-locks diff --stat                    # everything that looks changed
git --no-optional-locks diff --ignore-all-space --stat # what actually changed
```

An exactly symmetrical diffstat (equal insertions and deletions across many
files) is the signature of a line-ending flip, not of edits.

Per file, the authoritative check:

```bash
git --no-optional-locks diff --ignore-all-space --quiet -- <file> && echo "whitespace only"
```

`--name-only` does NOT honour `--ignore-all-space`. Use `--stat`, `--numstat`
or `--quiet`.

For files you did edit, compare the raw and whitespace-ignoring numstat. If they
match, your diff carries no line-ending noise.

Write new and edited files with LF. They then show clean, real diffs against the
index while any pre-existing artefact stays quarantined on the files you did not
touch.

### Current known issue

The Windows checkout carries repository-wide CRLF churn against an LF index,
affecting many unrelated files. It is not cosmetic: assertions that match on
literals containing `\n` fail on CRLF source and pass on an LF checkout, so
"the suite is red" must be checked against this before anything else.

Line-ending remediation (a `.gitattributes` plus a one-off renormalise commit)
is its own maintenance workstream and needs explicit approval. Never fold it
into feature work.

## Verification environments

Tests may need to run somewhere other than the Windows checkout. A scratch or
cloud clone is a verification environment only.

- It is never an automatic commit or push source.
- Changes proven there must be written back to the real working tree, and the
  real tree re-checked, before anything is reported as done.
- Its `origin` is usually the same remote, so a careless push from it sends a
  working copy the user has never reviewed.

## Permission boundaries

Do not perform these actions unless explicitly authorised:

- commit
- push
- merge
- deploy
- install dependencies
- rewrite schema
- start a later milestone

Do not stage unrelated files. Stage explicit paths, never `git add -A`,
`git add .` or `git commit -a`.

Before requesting commit approval, report the exact file list and the semantic
diff. "Some changes in the UI" is not a commit request.

### Automated hooks do not grant permission

A stop hook, CI bot, or any other automation that says to commit and push does
NOT override an explicit human instruction not to. The human instruction wins.

Say plainly that the hook fired, that the instruction stands, and what you would
commit when authorised. Do not comply, and do not silently ignore it either.

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
