# NinFit Current State

A short live checkpoint for a human or agent picking the project up cold.

**Authority:** live Git, tests and repository contents outrank this file. If they
disagree, believe Git and say so. See `skills/ninfit-handoff/SKILL.md`.

Last updated: **2026-08-30**

## Repository truth

| | |
|---|---|
| Remote | `https://github.com/krisninnis/ninfit.git` |
| `main` | `87c613b6905a793c5f32da05333393874b470fad` |
| Latest merged PR | **#75 — Journey Map MapLibre Color Compatibility v1** |
| Latest verified product baseline | **87 test files / 1895 tests**, TypeScript passed, production Vite build passed, `git diff --check` clean |
| Node | `24.x` |
| Deployment evidence | GitHub records a successful production deployment for `87c613b` on 2026-08-30. The canonical production HTML, manifest and service worker were independently observed returning HTTP 200 from `https://ninfit.vercel.app/`. |

Verify live Git before acting. Branches are cut from verified `origin/main`, never
from a stale local `main`.

## Recently completed

Most recent first. These are merged facts, not planned work.

| PR | Merge | What landed |
|---|---|---|
| #75 | `87c613b` | **Journey Map MapLibre Color Compatibility v1** — presentation-only conversion of computed CSS colours to classic RGB before they reach MapLibre |
| #73 | `80f9cbe` | **Tortoise Starter Clean Idle Runtime v1** — reviewed occasional Starter idle, reduced-motion/static fallback and desktop/tablet centring correction |
| #74 | `ccd244e` | **Living Fitness Adventure niche** — roadmap direction centred on real-world movement, companion history and long-term Adventure systems |
| #72 | `3fcb79d` | **Tortoise Starter Visual Integration v1** — approved Starter presentation integrated into Today and Journey through existing registries/boundaries |
| #71 | `8cf1fe0` | **Tortoise production scaffold v1** — staged identity/activity/reaction asset conveyor and human-review rules |
| #70 | `c6420e8` | **Tortoise complete v1** — Starter still art and temporary interactive wave proof; the wave remains explicitly non-final |
| #69 | `f633961` | **Tortoise Swim Medallion + Launch v1** |
| #68 | `839d9bb` | **Tortoise Cycle Medallion + Launch v1** |
| #67 | `2a9879f` | **Journey Completion Experience v1** |
| #66 | `dc9984d` | **Walk/Run medallion on Journey Home v1** |
| #65 | `ba7e6da` | **Tortoise Walk/Run Journey artwork v1** |
| #64 | `2a34ff7` | **Journey Activity Spaces + Walk/Run Launch v1** |
| #63 | `737c09e` | **Durable Reward Presenter Wiring v1** |
| #62 | `3d2ad90` | **Durable Reward Queue Foundation v1** |
| #61 | `5477e72` | **Durable Reward Delivery Architecture v1** |

Earlier merged work includes the complete first Living Interface sweep, Passport,
truthful Journey recording/recovery/privacy/detail/postcard slices and the bounded
fitness-to-companion presentation pipeline. Read live history rather than
reconstructing those slices from conversation memory.

## Current product and architecture position

NinFit remains **fitness-first**. Fitness and Journey truth are authoritative;
programme, reward, game, companion and AI presentation remain downstream.

The previously recorded shared reward-delivery discovery is no longer the next
action. PRs #61–#63 established the architecture, durable queue and single presenter
path now present on `main`.

Current merged product surfaces include:

- Today, Week, Progress, Profile and Passport Living Interface treatments;
- Journey Home, Walk/Run, Cycle and Swim activity spaces;
- live/recoverable Journey recording and truthful completion/history presentation;
- durable reward delivery and acknowledgement;
- the approved Starter Tortoise identity across Today and Journey;
- reviewed occasional Starter idle with a static reduced-motion path;
- presentation-safe MapLibre colours in light/dark/path-accent contexts.

Important current guarantees:

- companion presentation does not fabricate activity, completion, distance, PBs,
  trophies, XP, rewards or health meaning;
- durable reward presentation consumes persisted reward events rather than deriving
  new fitness truth;
- Journey map colour conversion is presentation-only and does not mutate Journey or
  GPS evidence;
- the Starter idle does not autoplay continuously and reduced motion stays static;
- the Tortoise remains one recognisable individual and later stages/species are not
  authorised by the completed Starter work;
- local fitness data remains authoritative; NinFit ID is optional identity only.

## Current phase

**Starter Tortoise production refinement / Phase 8 Living Interface reinforcement.**

The first clean-motion slice is complete. In the T1 sequencing used for handoff:

- **T1A — Starter clean occasional idle: COMPLETE on `main` via PR #73**;
- **T1B — Starter clean interactive wave: NOT COMPLETE**.

The roadmap now also records the longer-term Living Fitness Adventure niche:

> Move in the real world. Explore with your companion. Build a history together.

That direction does not reorder the near-term production work or authorise broad
Adventure Map, Mascot Memory, Journey Book, quest, cloud or social implementation.

## Next exact action

### T1B — prepare and human-review a clean Starter interactive wave master

Keep the runtime behaviour bounded:

```text
REST -> explicit user tap -> clean wave one-shot -> REST
```

Required next evidence:

1. a precise production brief derived from the current approved Starter identity,
   canvas, framing, baseline, motion duration and frame rate;
2. a clean source with no Pika branding/background artefact;
3. human visual confirmation that identity, shell, face, proportions and framing are
   still the approved Starter Tortoise;
4. production conversion and registry wiring only after that approval;
5. focused/full tests, TypeScript, build, responsive browser proof and reduced-motion
   proof before replacing the current wave.

Do **not** crop, trim or transform the current watermarked wave into apparent approval
if doing so damages motion, identity, framing or feet baseline. Do not begin Growing
Tortoise or another species.

## Open review work — not in `main`

These PRs were open when this checkpoint was written. They must not be described as
merged product behaviour until live Git says otherwise.

| PR | Branch | Review state at checkpoint |
|---|---|---|
| #76 — Settings & Navigation Reorganisation v1 | `feat/settings-navigation-v1` | Open; local/full checks and Vercel status green |
| #77 — Mobile Demo Readiness v1 | `fix/mobile-demo-readiness-v1` | Open; local/full checks and Vercel status green |

PR #76 proposes Settings as the primary destination with Data nested beneath it. PR
#77 proposes a refreshed installed-app offline fallback and `docs/PHONE_DEMO.md`.
Neither is part of `87c613b`.

## Parked work — do not merge

These were previously recorded as local-only work on the original machine. Their
absence from a fresh clone is not evidence they never existed.

| Branch | SHA | Why parked |
|---|---|---|
| `preserve/journey-home-mobile-background-v1` | `c984009dd437694b4459b1f4f48b7a449e88d2bc` | Journey Home mobile scenery prototype; reference only |
| `future/ornate-mystery-egg-v1` | `25dcfad80fbe6a189c0627443d2502dbbc851f5e` | Ornate Mystery Egg art route unfinished |

The user's original checkout also contains helper/untracked delivery directories.
Do not clean, delete, stash or repurpose them from an agent session without explicit
human instruction.

## Known blockers and follow-up

### T1B clean wave source

The production replacement asset does not yet exist in verified merged reality. The
current tap wave contains the known Pika branding/background artefact and remains
temporary proof. A human must approve a clean replacement before runtime wiring.

### Real-device PWA acceptance

The installable web app exists, but Android Chrome and iPhone Safari install/update/
relaunch behaviour still requires current real-device evidence. PWA installability is
not native background GPS, Health Connect, HealthKit or app-store packaging.

### Data safety before a real pilot

Still outstanding from `docs/production-readiness.md`:

- exercise schema migration N -> N+1;
- rehearse real-history backup/restore;
- decide browser quota / interrupted-write recovery behaviour;
- provide or explicitly accept a delete-all path.

### Account maturity

Password recovery remains a known gap before account promotion. Optional NinFit ID
must not be described as cloud fitness backup/sync until that feature actually exists.

### Runtime coverage

The suite is extensive but still contains structural/source guards where the current
Node-only test environment cannot exercise a mounted React/browser runtime. Record
that limitation rather than treating every structural guard as behavioural proof.

## Historical handoffs

`docs/PHONE_WORK_CHECKPOINT_2026-08-25.md` is intentionally retained as a dated
historical record. It no longer describes the current next action and must not be used
instead of this file plus live Git.

## Handoff checkpoint

```text
HANDOFF CHECKPOINT
main SHA: 87c613b6905a793c5f32da05333393874b470fad
latest merged PR: #75 — Journey Map MapLibre Color Compatibility v1
test baseline: 87 files / 1895 tests; TypeScript + production build passed
completed: durable reward delivery; Journey activity/completion expansion; Starter Tortoise integration; clean occasional idle; desktop/tablet centring correction; Living Fitness Adventure niche; MapLibre colour compatibility
current phase: Starter Tortoise production refinement / Phase 8 reinforcement
next exact action: T1B — prepare and human-review a clean Starter interactive wave master
parked branches/work: preserve/journey-home-mobile-background-v1; future/ornate-mystery-egg-v1
known blockers: clean T1B source and human visual approval; real-device PWA acceptance; pilot data-safety items
new locked direction: real-world movement + companion exploration + shared history; no broad implementation authorised yet
deployment state: successful production deployment recorded and canonical origin returned HTTP 200 for main 87c613b
open review only, not merged: PR #76 Settings & Navigation; PR #77 Mobile Demo Readiness
notes for next agent: live Git wins; do not replace the temporary wave before a clean source passes visual review
```

Read `docs/ROADMAP.md` for *what to build*, `docs/DECISIONS.md` for durable
decisions, and `skills/ninfit-delivery-loop/SKILL.md` for *how work is done*.
