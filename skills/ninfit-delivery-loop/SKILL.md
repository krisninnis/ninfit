# NinFit Delivery Loop

## Purpose

Use this skill to decide **what kind of task you are on, how big it is, what you are
allowed to touch, what proves it, and where you stop.**

Every other NinFit skill answers "how do I do this well". This one answers "which
piece of work is this, and what does done look like". It is the outer loop; the
others are called from inside it.

It exists because the expensive failures on this project have never been coding
failures. They have been: work started before the product decision was settled, a
five-line fix that arrived with a five-hundred-line specification, a branch cut from
a stale `main`, an unrelated fix folded into a feature diff, a discovery found for
the third time, and a session spent re-deriving how to run the test suite.

## What this skill does not own

It sequences; it does not restate. Cite these rather than repeating them:

| Concern | Owner |
|---|---|
| Session bootstrap, authority hierarchy, checkpoint format | `ninfit-handoff` |
| Preflight commands, working-tree safety, permission boundaries, whitespace-vs-semantic diagnosis | `ninfit-repository-workflow` |
| What may be built at all — the boundary list | `ninfit-product-guardrails` |
| Product philosophy, data truth, mascot architecture in depth | `ninfit-product-principles`, `ninfit-fitness-truth`, `ninfit-mascot-system` |
| Responsive and accessibility verification method | `ninfit-ui-verification` |
| Environment variables, deploy diagnosis | `ninfit-deployment-health` |
| Generated art becoming a production asset | `ninfit-visual-asset-pipeline` |
| What production engineering is due now | `production-readiness` |

If a rule appears both here and there, **there wins** and this file is the thing to
fix.

## The loop

```
TRUTH → SCOPE → SPEC WHEN NEEDED → BRANCH → IMPLEMENT
      → FOCUSED VERIFY → FULL VERIFY → BROWSER PROOF WHEN UI
      → HUMAN REVIEW → COMMIT → PUSH → PR → MERGE → CHECKPOINT → NEXT SLICE
```

No stage is skipped silently. A stage that does not apply is named and dismissed in
one line — "no UI surface changed, so no browser proof" — because an absent stage
reads as an oversight.

---

## 1. Task classes

Every task is exactly one of these. Say which one in the first line of the reply.
Classes do not blend: a discovery that starts editing files has become an
unauthorised implementation.

| Class | Input | Output | Never |
|---|---|---|---|
| **DISCOVERY** | A question about the repository | Evidence, file paths, a recommended boundary | Edits any file |
| **PRODUCT / SPEC** | An unsettled product behaviour | A durable contract under `docs/product/` or `docs/architecture/` | Touches runtime code |
| **IMPLEMENTATION** | One already-bounded slice | Verified, uncommitted changes | Starts the next slice |
| **COMMIT / PR** | Explicit human authorisation | Staged paths, commit, push, PR | Runs without that authorisation |
| **CHECKPOINT** | A merge that moved the project | Refreshed `docs/CURRENT_STATE.md`, roadmap status | Fires after every edit |
| **ART / ASSET** | An approved asset need | Canonical assets plus a manifest | Carries a product change alongside |
| **PRODUCTION READINESS** | A gate, a trigger, an incident | An assessment | Implements its own findings |

**Choosing.** Unsure what the code does → DISCOVERY. Unsure what the product should
do → PRODUCT / SPEC. Both settled → IMPLEMENTATION. Anything else is one of the
last four.

**The rule that makes the classes worth having:** a task ends in the class it
started in. Investigation does not drift into implementation, and implementation
does not drift into commit. Crossing a class boundary requires a new authorisation,
which means a new prompt.

---

## 2. Repository-truth protocol

Nothing is proposed before this runs. `ninfit-repository-workflow` owns the command
detail; this section owns the **verdict**, because the answer changes what is safe
to do next.

### The standard pre-task report

```
LIVE (GitHub)
  origin/main SHA:
  latest merged PR:
  latest merge commit:

LOCAL (C:\Users\thoma\fitness-tracker)
  branch:
  HEAD:
  origin/main ref:
  ahead / behind:
  working tree:        clean | N modified (real) | N modified (whitespace only)
  staged:
  untracked:
  local-only branches:

VERDICT: <one of the three below>
```

On the Windows checkout, read state with `git --no-optional-locks` — a plain
`git status` leaves an `index.lock` behind that the bridge cannot delete.

### The three verdicts

| Verdict | Means | Then |
|---|---|---|
| **SAFE TO WORK LOCALLY** | The local `origin/main` ref equals live `origin/main`, and the working tree holds nothing unrelated. | Cut the branch and proceed. |
| **SAFE TO INVESTIGATE AGAINST CLOUD ONLY** | The bridge cannot reach GitHub, or the local refs lag. The cloud clone is authoritative for reading and verifying; the Windows tree is authoritative for what the human has. | Report both states separately, labelled. Do not write to the Windows tree from a stale picture. |
| **HUMAN POWERSHELL UPDATE REQUIRED** | The local checkout must move — a fetch, a pull, a branch switch, a lock to clear — and doing it through the bridge is unsafe. | Stop. Give the exact commands to run. Do not improvise around it. |

**Local `main` is not `origin/main`.** They routinely differ by several merges because
the bridge does not fetch on its own. Every branch is cut from `origin/main`, verified
by SHA, never from whatever the local `main` label happens to point at.

### Never, to make the state look current

reset · restore · stash · clean · force · rebase · delete a branch · normalise
unrelated line endings. A stale state reported honestly costs one message. A
destroyed working tree costs a day.

### The cloud verification clone

The mounted Windows folder **cannot run the suite**: vitest over the mount takes
minutes per file against ~11 seconds for all 43 in the cloud, and the bridge shell is
capped at ~45 seconds per call with no process surviving between calls. Clone
instead — the repository is public and its branches match.

```bash
git clone https://github.com/krisninnis/ninfit.git && cd ninfit && npm ci

# Required, or authCallback.test.ts fails to import. Placeholders only:
# the real .env.local is gitignored and stays on the user's machine.
printf 'VITE_SUPABASE_URL=https://placeholder.supabase.co\n' >  .env.local
printf 'VITE_SUPABASE_PUBLISHABLE_KEY=placeholder\n'         >> .env.local

node node_modules/vitest/vitest.mjs run --reporter=dot
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vite/bin/vite.js build
```

Call the binaries through `node`. `npm test` and `npx` are refused by the sandbox in
the Cowork container; the failure looks like a broken repository and is not one.

A verification clone is **never** a commit or push source. Its `origin` is the same
remote, so a careless push there sends the user work they have never seen. Changes
proven in it are written back to the Windows tree, and the Windows tree is
re-inspected, before anything is reported as done.

---

## 3. Slice size

**ONE SLICE = ONE CLEAR PRODUCT OUTCOME.**

A slice is the right size when all five hold:

1. Its purpose fits in one paragraph without the word "and also".
2. Its diff reads coherently in one sitting.
3. Rollback is reverting one commit.
4. Its verification is specific — you can name the tests before writing them.
5. It has explicit non-goals.

Prefer one branch, one conceptual change, one reviewable commit, a small file
boundary.

**When unrelated work appears: PARK IT.** Record it (section 10) and carry on. Fix it
in the same slice only if it genuinely blocks the authorised work — and say so
explicitly in the report, in its own line, rather than letting it arrive unannounced
inside the diff.

The cost of parking is one entry in a table. The cost of not parking is a diff nobody
can review, a revert that takes the fix with it, and a phase whose scope no longer
matches what it says it did.

---

## 4. When a spec is required

A durable specification is expensive and worth it exactly when the alternative is
deciding product behaviour inside an implementation, where it will not survive the
thread.

### Write a spec when the slice changes any of

- product behaviour a user could describe
- user-visible reward rules, or what counts as earned
- persistence, schema, or migration
- domain architecture, or a layering boundary
- safety, privacy, or what leaves the device
- auth or the cloud boundary
- social or sharing rules
- GPS and location behaviour
- achievement, trophy or PB logic
- mascot progression, evolution, Champion or Legacy rules
- destructive data behaviour — delete, replace, restore
- behaviour that spans more than one screen

### Do not write a spec for

- a tiny visual correction
- an isolated regression fix
- a documentation or status change
- test hardening where behaviour does not change
- a mechanical refactor with invariant behaviour
- the obvious implementation of an already-locked contract

### The tiebreak

If the slice needs a spec, ask instead: **is there already a locked contract that
answers every open question?** If yes, cite it and write a slice contract. If one
question is genuinely open, the answer belongs in a document before code, not in a
commit message afterwards.

### The slice contract

For everything that does not need a spec. Eight lines, agreed before implementation,
restated in the final report so the two can be compared.

```
SLICE:        <branch-shaped name>
CLASS:        <task class>
OUTCOME:      <one paragraph — what is true afterwards that is not true now>
NON-GOALS:    <the nearby things this deliberately does not do>
NEW:          <expected new files>
MODIFIED:     <expected modified files>
FORBIDDEN:    <paths this must not touch>
VERIFY:       <levels; widths and themes if UI>
STOP AT:      <named stop point from section 8>
```

`docs/product/ninfit-reward-presentation-v1.md` is the reference shape for a full
spec — in particular §17 boundary, §18 test plan, §19 non-goals, §20 acceptance
criteria, §22 deferred issues. A new spec follows that structure rather than
inventing one.

---

## 5. Change boundary

The slice contract's `NEW` / `MODIFIED` / `FORBIDDEN` lines are a commitment, not an
estimate.

**If implementation needs to cross a forbidden boundary: STOP and report.** Do not
expand scope quietly and explain it afterwards. The report says what was needed, why,
and what it would cost — and waits.

Standing forbidden paths for any non-infrastructure slice unless the contract names
them explicitly:

```
package.json  package-lock.json      dependency changes are their own decision
docs/ROADMAP.md  docs/DECISIONS.md   sequencing and locked decisions move deliberately
.gitattributes                       line-ending policy is settled
```

Standing forbidden paths for a presentation slice:

```
src/domain/**   src/app/**   src/storage/**
```

Verify the boundary held before reporting:

```bash
git --no-optional-locks status --porcelain=v1 -uall
git --no-optional-locks diff --name-only
```

Every path in that output appears in the contract, or the slice is over its boundary.
An exactly symmetrical diffstat across many files is a line-ending flip, not edits —
`ninfit-repository-workflow` owns that diagnosis.

---

## 6. Branch conventions

Every branch: `<prefix>/<short-kebab-description>-v1`. The `-v1` suffix is the
existing convention and is kept.

| Prefix | Use for | Example |
|---|---|---|
| `phaseN/`, `phaseN-M/` | A roadmap product slice | `phase8-2/inspirational-reinforcement-v1` |
| `ui/` | Presentation work not owned by one roadmap phase | `ui/ninfit-journey-card-v1` |
| `fix/` | One isolated regression | `fix/sparkline-aspect-ratio-v1` |
| `test/` | Test hardening, behaviour unchanged | `test/reward-guard-mutation-v1` |
| `docs/` | Specs, checkpoints, roadmap status | `docs/checkpoint-phase8-1-v1` |
| `infra/` | Workflow, repository hygiene, tooling | `infra/development-workflow-v1` |
| `art/` | Asset production — see section 11 | `art/tortoise-champion-v1` |
| `future/` | Unfinished exploration, parked deliberately | `future/ornate-mystery-egg-v1` |
| `preserve/` | Reference only. **Never merged.** | `preserve/journey-home-mobile-background-v1` |

Rules:

- Every implementation branch is cut from **verified `origin/main`**, by SHA.
- Never stack new product work on an unmerged feature branch without saying so. If a
  slice genuinely depends on an unmerged one, that dependency is stated in the
  contract and the branch is named for it.
- `future/` and `preserve/` branches are often **local-only on the original machine**.
  Their absence from a fresh clone is not evidence they do not exist — check
  `docs/CURRENT_STATE.md`.

---

## 7. Verification levels

Three levels. A slice names which it ran and what each proved.

### Level 1 — FOCUSED

The tests directly touching the slice, run first and run often.

```bash
node node_modules/vitest/vitest.mjs run src/test/<file>.test.ts
```

### Level 2 — FULL

Required before any slice is reported complete.

```bash
node node_modules/vitest/vitest.mjs run --reporter=dot   # npm test
node node_modules/typescript/bin/tsc --noEmit            # npm run typecheck
node node_modules/vite/bin/vite.js build                 # npm run build
git --no-optional-locks diff --check
```

`npm run build` already runs `tsc --noEmit` first, so a green build subsumes
typecheck. Run both anyway when reporting a baseline — a separate typecheck line
localises the failure.

Report the counts, not an adjective: **N files / M tests**, and whether that moved
the baseline in `docs/CURRENT_STATE.md`.

### Level 3 — EXPERIENCE

Required for anything a user can see. Method is owned by `ninfit-ui-verification`;
this is the contract for when it must happen.

Widths: **360 · 390 · 430 · 768 · 1024**. Light and dark where the change touches
colour. Reduced motion on and off where the change touches motion.

A UI slice is not done before this runs. A browser harness is a one-off: build it
under the gitignored `.verify/` directory and do not commit it. Chromium and
Playwright are available in the cloud container.

### Behavioural guards

**A test that has never been seen fail is not trusted.** For every guard that
protects a locked decision, mutation-test it once:

1. Break the thing it guards, in the working tree only.
2. Confirm the test goes red — and that it fails for the stated reason, not an
   unrelated import error.
3. Restore.
4. Confirm green.
5. Report the guard as *seen to fail*.

### Source-scanning tests

Several suites assert against component source. They are powerful and they fail
vacuously in characteristic ways:

- **Strip comments before any negative assertion.** The comment explaining a rule
  necessarily quotes the wording the rule forbids, so a raw search matches the
  explanation and reports the opposite of the truth. `ninfit-ui-verification` holds
  the `code(source)` idiom — use it, do not re-derive it.
- **Do not depend on quote style.** `'x'`, `"x"` and `` `x` `` are the same code.
- **Use word boundaries.** A bare `/score/` matches `scoreboard`, `underscore` and a
  variable called `scoreCard`.
- **Never accept a vacuous CSS read.** Asserting that a stylesheet "contains" a
  selector passes on a commented-out rule and on an empty block. Assert the
  declaration that carries the behaviour.
- **Assert absence and presence together.** A test that only forbids passes on an
  empty file.

Pin the decisions that would undo a phase. Do not pin cosmetics — tests that count
lines or fix colours fail on every honest edit and teach people to re-bless them
without reading.

---

## 8. Stop points

Every task ends at one deliberate, named state. The name is the last line of the
report, and nothing follows it.

```
READY FOR HUMAN SPEC REVIEW
READY TO AUTHORISE IMPLEMENTATION
READY TO COMMIT <slice>
READY TO OPEN PR
READY FOR CHECKPOINT
NOT READY — <reason>
```

Never drift past a stop point. Investigation does not become implementation because
the fix looked obvious; implementation does not become a commit because the tests
went green.

**Automation does not grant permission.** A stop hook or CI bot that says to commit
and push does not override a human instruction not to. Say plainly that it fired,
that the instruction stands, and what would be committed when authorised. Do not
comply, and do not silently ignore it.

---

## 9. Standard implementation report

Same ten sections, same order, every time. Predictable structure is what lets the
next thread read a report in thirty seconds instead of three minutes.

```
A. REPOSITORY TRUTH     the section 2 block, plus the verdict
B. FILES CHANGED        exact paths, new vs modified
C. BEHAVIOUR            what is now true that was not, in plain language
D. TESTS                new and changed tests; which guards were seen to fail
E. BROWSER PROOF        widths, themes, motion — or why not applicable
F. FULL VERIFICATION    N files / M tests, typecheck, build, diff --check
G. SCOPE CHECK          contract vs actual; forbidden paths untouched
H. DEFERRED             discoveries parked, not fixed
I. GIT STATUS           branch, HEAD, staged, unstaged, untracked
J. VERDICT              one stop point from section 8
```

Every line is a fact from Git, a test run, or an authorised decision. If a line is
unknown, write `unknown` — the next agent cannot tell a confident line from an
invented one.

---

## 10. Parked work

**`docs/CURRENT_STATE.md` is the register. Do not create a second backlog.**

It already carries *Parked work — do not merge* for branches and *Known follow-up*
for discoveries. Those are the only two homes.

Where entries come from, and where they go:

| Source | Rule |
|---|---|
| A spec's deferred-issues section (e.g. reward presentation §22) | The birthplace. It stays there as the record of what that slice knowingly excluded. |
| Anything still live once that slice merges | The checkpoint absorbs it into *Known follow-up*. Do not leave a live item reachable only through a merged spec. |
| A discovery made mid-slice | Straight into *Known follow-up* at the next checkpoint. Never fixed inside the slice. |
| Something that becomes authorised work | Leaves the register and enters `docs/ROADMAP.md`. It does not live in both. |

A parked entry needs three things: what it is, the repository evidence, and why it is
not being done now. An entry without evidence is a worry, not a finding, and will be
re-investigated by someone who does not trust it.

Being in the register is **not** authorisation. It is the opposite: it is the record
that something was seen, judged, and deliberately not done.

---

## 11. Art lane

Art production is a separate lane from product infrastructure and the two do not
share a branch. `ninfit-visual-asset-pipeline` owns how a generated image becomes a
production asset; this is the lane rule.

- Art work gets its own `art/` branch, its own asset manifest and naming, and its own
  verification. **No unrelated product change rides along.**
- **Missing production art never blocks infrastructure that can use a placeholder.**
  Placeholder art in the codebase is marked temporary on purpose — it is replaced,
  not refined.
- **Prove one canonical end-to-end pipeline before generating a family.** One mascot
  family, one trophy, one animation — approved, converted, in-budget, previewed in
  the real UI — before the other four exist as files.
- Artwork existing is not a product decision. A character does not enter the path
  system because art for it happens to exist.

Do not restart parked art production inside a product slice. What is currently parked
is recorded in `docs/CURRENT_STATE.md`; the art state itself is tracked there and in
the pipeline skill, not here.

---

## 12. Who does what

| | Does | Does not |
|---|---|---|
| **Cowork** | Investigate the repository · implement one bounded slice · run focused and full verification · browser proof · mutation-test guards · write the report | Commit, push, merge, deploy, install dependencies, or start the next slice — unless explicitly authorised in that task |
| **Human PowerShell** | Fetch and pull when the bridge cannot reach GitHub · commit · push · open the PR · merge · recover a branch or clear a lock where bridge file-locking makes Cowork unsafe | — |
| **Product thread** | Decide product behaviour · set scope · approve specs · interpret reports · decide what gets parked · issue the next bounded prompt | — |

Cowork prepares Git publication — exact paths, the semantic diff, the proposed commit
message — and stops. "Some changes in the UI" is not a commit request. Stage explicit
paths; never `git add -A`, `git add .` or `git commit -a`.

---

## 13. Which document wins

`ninfit-handoff` owns the full authority hierarchy. In short, and in order:

1. **The repository itself** — live Git, the source, a test run
2. `docs/CURRENT_STATE.md` — where things stand
3. `docs/DECISIONS.md` — what is locked
4. the active product or architecture contract under `docs/product/` or
   `docs/architecture/` — how the current system behaves
5. `docs/ROADMAP.md` — what to build and in what order
6. `skills/*` — how to do it
7. conversation memory — last, always

Responsibilities, so the same fact is not written twice:

| Document | Owns | Never |
|---|---|---|
| `docs/ROADMAP.md` | What we intend to build, and the sequence | Live status, or a branch name that moves |
| `docs/DECISIONS.md` | A short index of durable locked decisions, pointing at the detail | The detail itself |
| `docs/CURRENT_STATE.md` | The verified current checkpoint, parked work, the next exact action | Becoming a second roadmap |
| `docs/product/*`, `docs/architecture/*` | Substantial contracts for one system | Repeating the roadmap |
| `skills/*` | Repeatable operating procedures | Project status |

Documentation goes stale — that is expected, not a fault. Proceeding on a stale claim
without saying so is the fault. When Git and a document disagree, believe Git, say
which document is stale and in what respect, and fix it on its own documentation
commit rather than quietly inside other work.
