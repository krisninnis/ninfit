# NinFit Handoff

## Purpose

Use this skill at the **start** of any NinFit development session and at the **end**
of any milestone. It is how the project survives a change of thread, tool or agent.

The problem it solves: conversational memory is not a source of truth. A fresh
ChatGPT thread, Cowork session, Codex session or future agent has none of it, and a
long-running one has a version of it that has quietly drifted. The repository has to
carry enough state that anyone can pick NinFit up cold and act safely.

## Authority hierarchy

When two sources disagree, the higher one wins:

1. **Live Git, tests and repository contents**
2. `docs/CURRENT_STATE.md`
3. `docs/DECISIONS.md`
4. `docs/ROADMAP.md`
5. `skills/*`
6. architecture and reference documents under `docs/`
7. conversation memory

Git wins if documentation is stale, and documentation *will* go stale — that is
expected, not a fault. What is a fault is proceeding on a stale claim without saying
so.

## Fresh-thread bootstrap

A new conversation should need nothing more than:

> Take over NinFit. Read `skills/ninfit-handoff/SKILL.md` and
> `docs/CURRENT_STATE.md`, verify live Git truth, then continue the next exact action.

If that is not enough to reconstruct the immediate state, `docs/CURRENT_STATE.md` is
the thing to fix.

## Start-of-session protocol

### 1. Read

- `docs/CURRENT_STATE.md` — where things stand
- `docs/DECISIONS.md` — what is settled and must not be relitigated
- the relevant section of `docs/ROADMAP.md` — what to build
- the skills that own the active workstream

`ninfit-delivery-loop` is the canonical development workflow: task classes, slice
size, when a specification is required, branch conventions, the repository-truth
verdicts, the three verification levels, and where every task is allowed to stop.
Read it once the state above is established, before proposing any work.

`ninfit-repository-workflow` owns preflight and working-tree safety in detail. Read
it before touching anything.

### 2. Verify live Git

```
git branch --show-current
git rev-parse HEAD
git rev-parse origin/main
git status -sb
git diff --cached --name-status
```

### 3. Compare, and say so out loud

Compare what Git reports against `docs/CURRENT_STATE.md`.

If they disagree:

- **Git wins.** Always.
- Say explicitly that `CURRENT_STATE.md` is stale, and in what respect.
- Do not silently proceed on the stale claim, and do not silently "fix" the document
  mid-task to make the mismatch disappear.

A mismatch is information. It usually means a milestone landed without the checkpoint
being updated, which is itself worth reporting.

### 4. Establish the working picture

Before proposing anything, know:

- the current phase and the **one** exact next task
- which branches are parked and must not be merged
- which locked decisions constrain this work
- the current validation baseline (test count, typecheck, build)

Some parked branches are **local-only on the original machine** and absent from a
fresh clone. Their absence is not evidence they do not exist — check
`docs/CURRENT_STATE.md`.

### 5. Do not reopen settled architecture

A decision marked `LOCKED` in `docs/DECISIONS.md` reopens on evidence or explicit
authorisation, not on a fresh agent's preference. If a locked decision looks wrong,
say why and ask. Do not route around it.

## End-of-milestone protocol

Update `docs/CURRENT_STATE.md` when a milestone is **merged, verified and `main` is
synced** — not before, and not after every edit.

A milestone is:

- a PR merge
- a phase or slice completion
- a durable architecture decision
- a new backend or data boundary
- a production-readiness gate
- a release

A milestone is **not** a file save, a passing test run, or a review comment.

When updating, refresh:

- the `main` SHA and the latest merged PR
- what moved from *current work* to *completed*
- the current phase and the next exact action
- the test baseline, if it changed
- new blockers or follow-ups
- any change to parked work
- the deployment state, if evidence changed

Keep it short. `docs/CURRENT_STATE.md` is a checkpoint, not a second roadmap. If it
starts growing past a couple of hundred lines, the detail belongs in the roadmap, a
skill, or an architecture document — and the checkpoint should link to it.

## Decision update rule

`docs/DECISIONS.md` changes **only** when a durable human, product or architecture
decision changes. Not for implementation detail, refactors or bug fixes.

When it does change:

- keep the entry short and point at the authoritative document
- do not copy the authoritative content into the index
- do not label something `LOCKED` that is merely current. `ACTIVE` and `PROVISIONAL`
  exist so that a working assumption can be recorded honestly

An index that overstates certainty is worse than no index, because the next agent
believes it.

## Standard handoff block

Return this at a milestone boundary. Compact, factual, no narrative.

```
HANDOFF CHECKPOINT
main SHA:
latest merged PR:
test baseline:
completed:
current phase:
next exact action:
parked branches/work:
known blockers:
new locked decisions:
deployment state:
notes for next agent:
```

Every line is a fact from Git, the test run or an authorised decision. If a line is
unknown, write `unknown` rather than a guess — the next agent cannot tell the
difference between a confident line and a fabricated one.

## What this skill does not own

It routes; it does not restate. Cite these rather than repeating them:

- `ninfit-delivery-loop` — the canonical development loop: task classes, slice size,
  the spec-required rule, change boundaries, branch conventions, repository-truth
  verdicts, verification levels, stop points, the parked-work register
- `ninfit-repository-workflow` — preflight, working-tree safety, verification
  environments, permission boundaries, reporting
- `ninfit-product-guardrails` — the fast pre-implementation boundary check
- `ninfit-product-principles`, `ninfit-fitness-truth`, `ninfit-mascot-system` — the
  product and data rules in depth
- `ninfit-ui-verification` — responsive and accessibility verification method
- `ninfit-deployment-health` — environment configuration and deployment diagnosis
- `production-readiness` — what production engineering this project needs now
