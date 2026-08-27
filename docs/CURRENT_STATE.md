# NinFit Current State

A short live checkpoint for a human or agent picking the project up cold.

**Authority:** live Git, tests and repository contents outrank this file. If they
disagree, believe Git and say so. See `skills/ninfit-handoff/SKILL.md`.

Last updated: **2026-08-27**

## Repository truth

| | |
|---|---|
| Remote | `https://github.com/krisninnis/ninfit.git` |
| `main` | `925fc8a38cf90a549ed9d19c385c2ce1c8d1dda1` |
| Latest merged PR | **#59 — Journey Home Companion Integration v1** |
| Latest verified product baseline | **79 test files / 1599 tests**, TypeScript passed, production Vite build passed, `git diff --check` clean |
| Node | `24.x` |
| Deployment evidence | PR #59 head `689c145696b9b3743650f99ba622016645fd573a` had a successful Vercel status before merge. Post-merge production deployment was not independently re-verified from the Vercel connector. |

Verify live Git before acting. Branches are cut from verified `origin/main`, never
from a stale local `main`.

## Recently completed

Most recent first.

| PR | Merge | What landed |
|---|---|---|
| #59 | `925fc8a` | **Journey Home Companion Integration v1** — path companion presence driven only by existing active/history Journey truth |
| #58 | `7912414` | **Companion Moment Lifetime v1** — transient completion/trophy emphasis expires and does not replay from stale history |
| #57 | `1994f98` | **Companion Reaction Presentation v1** — deterministic companion contexts gain restrained visual treatments |
| #56 | `0ca69d5` | **Fitness → Companion Reaction Boundary v1** — presentation consumes derived fitness facts without owning fitness truth |
| #55 | `5eccb39` | **Profile Living Interface v1** |
| #54 | `d402c14` | **Week Living Interface v1** |
| #53 | `1fbe7b5` | **Progress Living Interface v1** |
| #52 | `ff1c48c` | **Passport v1** |
| #51 | `92afa54` | **Today Living Interface v1** |
| #50 | `489cb91` | **Shared Living Interface scrim primitive** |

Earlier Journey work already merged into `main` includes truthful route segmentation,
live map presentation, route privacy, completion/detail presentation and Journey
postcards. Read live history rather than reconstructing those slices from conversation
memory.

## Current product/architecture position

NinFit remains **fitness-first**. Fitness truth is authoritative; programme/game and
companion systems sit downstream.

The first Living Interface sweep is now present across:

- Today
- Week
- Progress
- Profile
- Passport
- Journey Home companion presence

The companion pipeline now has explicit boundaries:

```
trusted fitness/Journey truth
→ deterministic derived facts/context
→ presentation mapping
→ bounded or standing companion treatment
→ UI
```

Important current guarantees:

- companion presentation does not fabricate activity, completion, distance, PBs,
  trophies, XP, rewards or health meaning
- Today completion/trophy emphasis is transient and freshness-gated
- Journey history is standing truth, **not** a fresh completion event
- Journey Home adds no GPS, route, distance, duration, reward or persistence logic
- Opal remains separate from the user's path mascot
- historical data never becomes a celebration merely because it exists

## Current phase

**Phase 8 reinforcement / Living Interface integration is active.**

The recent slices established the safe fitness-to-companion boundary and then reused
it across Today and Journey without moving fitness/Journey truth into presentation.

## Next exact action

### DISCOVERY — multi-`useGame` / shared game-state and reward-delivery correctness

This remains the highest-priority unresolved correctness question before expanding
reinforcement further.

**Read-only investigation. Do not refactor during discovery.**

Prove or disprove, against current `main` and runtime evidence:

1. whether multiple independent `useGame()` instances can consume newly granted
   `RewardEvent`s before the intended acknowledgement surface sees them
2. whether rewards granted away from Today can be persisted without ever being
   acknowledged
3. whether cold-load / import / other-tab reward events are lost to presentation
4. whether App-level path/accent state can remain stale after Profile switches path
5. whether redundant `syncGame` derivations occur
6. what the **smallest runtime/component test** is that exposes any proven failure

**If the risk is proven:** stop with evidence and scope the smallest shared-state or
single-reward-delivery correction as its own architecture/spec slice.

**If disproven:** record the evidence here and return to Phase 8 sequencing.

## Locked decisions relevant now

The complete index is `docs/DECISIONS.md`. Do not reopen these casually:

- Fitness is the product; game/companion is reinforcement.
- No guilt, punishment, broken-streak pressure, score, daily completion percentage or
  generic failure framing.
- Fitness truth is never manufactured by game or AI.
- Planned rest is valid adherence; partial completion counts.
- Exactly five path mascot families; a sixth family requires a sixth fitness path.
- Opal is the universal guide and does not replace the path mascot.
- Hatching happens at the end of onboarding and grants no XP/trophy.
- A hatched companion's species is permanent.
- Health/body data remains neutral information, never a verdict.
- Local fitness data remains authoritative; NinFit ID is optional identity only.

## Parked work — do not merge

These were previously recorded as local-only work on the original machine. Their
absence from a fresh clone is not evidence they never existed.

| Branch | SHA | Why parked |
|---|---|---|
| `preserve/journey-home-mobile-background-v1` | `c984009dd437694b4459b1f4f48b7a449e88d2bc` | Journey Home mobile scenery prototype; reference only |
| `future/ornate-mystery-egg-v1` | `25dcfad80fbe6a189c0627443d2502dbbc851f5e` | Ornate Mystery Egg art route unfinished |

The user's original checkout also currently contains helper/untracked folders created
during delivery work (for example `ninfit-pr42/` and
`ninfit-journey-home-companion-v1/`). Do not clean, delete, stash or repurpose them
from an agent session without explicit human instruction.

## Known blockers / follow-up

### Shared game state / reward delivery

Still unresolved; this is the **next exact action** above. The earlier checkpoint
recorded a candidate correctness risk around multiple independent `useGame()`
instances. Recent Journey work deliberately avoided adding another instance by reading
game state/settings without syncing.

### Runtime test coverage

The suite is extensive but is still dominated by pure-domain and source-boundary
coverage. A shared-state/reward-delivery failure is likely to need a real runtime
component test layer. Do not add jsdom, Testing Library or another renderer until the
discovery proves what must be exercised.

### Data safety before a real pilot

Still outstanding from `docs/production-readiness.md`:

- exercise schema migration N → N+1
- rehearse real-history backup/restore
- decide browser quota / interrupted-write recovery behaviour
- provide or explicitly accept a delete-all path

### Account maturity

Password recovery remains a known gap before account promotion. Optional NinFit ID
must not be described as cloud fitness backup/sync until that feature actually exists.

### Art lane

Production mascot/trophy art remains a separate lane. Placeholder glyphs are temporary
presentation infrastructure, not canonical mascot assets.

### Documentation hygiene

Older workflow/deployment/UI-verification skill text still contains some stale
instructions identified by the earlier workflow audit. Correct those in a separate
documentation slice rather than mixing them into product work.

`docs/ROADMAP.md` also has its own line-ending housekeeping note; do not hide that
inside a content edit.

## Handoff checkpoint

```
HANDOFF CHECKPOINT
main SHA: 925fc8a38cf90a549ed9d19c385c2ce1c8d1dda1
latest merged PR: #59 — Journey Home Companion Integration v1
test baseline: 79 files / 1599 tests; TypeScript + production build passed
completed: Journey Home path-companion integration on top of bounded companion reaction architecture
current phase: Phase 8 reinforcement / Living Interface integration
next exact action: DISCOVERY — multi-useGame / shared game-state and reward-delivery correctness
parked branches/work: preserve/journey-home-mobile-background-v1; future/ornate-mystery-egg-v1
known blockers: shared game-state correctness unresolved; runtime integration coverage gap; pilot data-safety items
new locked decisions: none
deployment state: PR #59 candidate had successful Vercel status; post-merge production not independently re-verified
notes for next agent: live Git wins; do discovery before any shared-state refactor
```

Read `docs/ROADMAP.md` for *what to build*, `docs/DECISIONS.md` for durable
decisions, and `skills/ninfit-delivery-loop/SKILL.md` for *how work is done*.
