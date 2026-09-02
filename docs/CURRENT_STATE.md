# NinFit Current State

A short live checkpoint for a human or agent picking the project up cold.

**Authority:** live Git, tests and repository contents outrank this file. If they
disagree, believe Git and say so. See `skills/ninfit-handoff/SKILL.md`.

Last updated: **2026-09-02**

## Repository truth

| | |
|---|---|
| Remote | `https://github.com/krisninnis/ninfit.git` |
| `main` | `7b2edd7c528ee9691f0df2b63332ee2899a747a6` |
| Latest merged PR | **#182 — Hatch timing contract tests** |
| Verified baseline | **101 test files / 1976 tests** at the PR2 checkpoint; PR3 typecheck/build passed and PR4 Vercel passed. Full local suite requires the configured Supabase test environment. |
| Node | `24.x` (baseline above independently re-verified on Node 22.22 from a clean clone of this SHA) |
| Deployment | GitHub/Vercel reported the post-merge `main` deployment green. Vercel runs `npm run build` only — see *CI gap* below. |

Verify live Git before acting. Branches are cut from verified `origin/main`, never
from a stale local `main`.

## Recently completed

The P0 runtime train, most recent first. Everything below is merged and present in the
SHA above.

| PR | Merge | What landed |
|---|---|---|
| #79 | `5035d37` | **Adventure Map v1** — a projection of durable Journey history onto one private map |
| #181 | `69c2523` | **Reduced-motion hatch ceremony** — three still states, real commit beat, accessible status copy and Skip control |
| #182 | `7b2edd7` | **Hatch timing contract tests** — expectations aligned with the reduced-motion ceremony |
| #81 | `145e4dd` | **Settings Build Identification** — version, channel and build fingerprint in Settings → About |
| #80 | `815576e` | **Mobile Demo Update Reliability** — installed launches prefer the live deployment; the offline shell fallback stays current |
| #77 | — | **Closed as superseded, not merged.** Its one unique behaviour (refreshing the cached offline root after a successful online navigation) and its executable service-worker harness were carried onto #80 before that merge |
| #76 | `1350f03` | **Settings & Navigation Reorganisation** — Settings owns Appearance, App preferences, Privacy, Data |
| #75 | `87c613b` | **MapLibre colour compatibility** — OKLCH theme tokens converted to RGB at the map paint boundary |
| #73 | `80f9cbe` | **Tortoise starter clean idle runtime** |

Earlier Journey work already in `main` includes truthful route segmentation, the live
map, route privacy, completion/detail presentation and Journey postcards. Read live
history rather than reconstructing those slices from conversation memory.

## Current product/architecture position

NinFit remains **fitness-first**. Fitness truth is authoritative; programme/game and
companion systems sit downstream.

### Living Adventure

The Adventure Map is the first Living Fitness Adventure surface. It is a **projection,
not a second store**:

- it reads `loadJourneyHistory` and admits only `completed` / `imported` Journeys, so
  an active Journey is never drawn as history
- it reuses `journeyTrustedRouteSegments`; runs from different Journeys are never
  joined, and a Journey with no segmentation evidence draws nothing rather than an
  invented line
- it computes no distance. Authoritative distance stays the `distance_m` metric
- it writes nothing and persists nothing
- being an on-device private view, it draws trusted segments raw. The disclosure
  projection (`projectJourneyRouteForDisclosure`) remains reserved for the Journey
  Postcard, the one artefact intended to leave the device

### Settings

Settings owns Appearance (System / Light / Dark, persisted), App preferences, Privacy
and participation, Data & privacy, and About. About reports version, channel and a
build fingerprint taken from the **entry** assets at start-up, so the same deployment
reads identically on every phone regardless of which screens the session has opened.

### PWA / phone demo

`docs/PHONE_DEMO.md` is the install and update walkthrough. Current merged behaviour:

- the worker registers with `updateViaCache: 'none'`; it is re-checked on load, when
  the app returns to the foreground, and when the device comes back online
- navigation is network-first with `cache: 'no-store'`, so relaunching the installed
  app loads the current deployment
- the cached root is rewritten after every successful online navigation, so an offline
  launch shows the most recent build rather than the first one ever installed
- **no automatic reload.** A new build never replaces the running document, so a live
  Journey is not interrupted
- activation retires only `ninfit-shell-*` caches; caches belonging to anything else
  are left alone

## Current phase

**Phase 9 mascot onboarding integration.** The P0 safety/runtime train is merged,
the Tortoise starter foundation is present, and the egg crack/full/reduced-motion
hatch ceremonies are implemented.

## Next exact action

**Add the real GitHub Actions verification gate, then build the Day 1 First Win
post-hatch movement experience.**

The hatch implementation is now in `useHatchCinematic`, `EggArt`, `GameHeader` and
`OnboardingScreen`. Keep the ceremony presentation-only: hatching happens at the end
of onboarding, grants no XP or trophy, is never automatic, and a hatched companion's
species is permanent. Issue #144 remains the verification-gate blocker.

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

| Branch | SHA | Why parked |
|---|---|---|
| `preserve/journey-home-mobile-background-v1` | `c984009dd437694b4459b1f4f48b7a449e88d2bc` | Journey Home mobile scenery prototype; reference only |
| `future/ornate-mystery-egg-v1` | `25dcfad80fbe6a189c0627443d2502dbbc851f5e` | Ornate Mystery Egg art route unfinished |

The user's checkout also carries helper/untracked delivery folders created during
delivery work. Do not clean, delete, stash or repurpose them from an agent session
without explicit human instruction.

## Known blockers / follow-up

### CI gap — tracked as issue #144

There is no `.github/workflows`. The only PR status check is Vercel, which runs
`npm run build` (`tsc --noEmit && vite build`) and **never runs Vitest**. A green PR
means "it compiles". PR #79 was green on GitHub while failing
`src/test/journeyCompanion.test.ts` against `main`; it was caught only by running the
suite by hand. Until #144 lands, treat "mergeable and green" accordingly and verify
every candidate locally.

### Offline support is shell-only

The precache holds `/`, the manifest and two icons — no JS or CSS. An offline launch
paints the shell but the app does not boot. This is a deliberate current limit, not a
regression; do not describe NinFit as working offline.

### Shared game state / reward delivery

Still unresolved. The earlier checkpoint recorded a candidate correctness risk around
multiple independent `useGame()` instances consuming newly granted `RewardEvent`s
before the intended acknowledgement surface sees them. Recent Journey work
deliberately avoided adding another instance. This discovery is still owed.

### Runtime test coverage

The suite is dominated by pure-domain and source-boundary coverage.
`src/test/serviceWorkerUpdate.test.ts` is the first test that executes a real runtime
artefact (`public/sw.js`). A shared-state/reward-delivery failure will still need a
real component test layer; do not add jsdom or a renderer until discovery proves what
must be exercised.

### Map rendering proof

MapLibre creates its canvas without `preserveDrawingBuffer` and `map.loaded()` does not
resolve under headless software WebGL, so **automated pixel proof of drawn route lines
is not obtainable**. Wiring, camera fit, paint-colour conversion and the absence of map
errors are all verified; the drawn line itself needs a human on a real device.

### Data safety before a real pilot

Still outstanding from `docs/production-readiness.md`: exercise schema migration
N → N+1; rehearse real-history backup/restore; decide browser quota / interrupted-write
recovery behaviour; provide or explicitly accept a delete-all path.

### Account maturity

Password recovery remains a gap before account promotion. Optional NinFit ID must not
be described as cloud fitness backup/sync until that feature exists.

### Art lane

Production mascot/trophy art remains a separate lane. Placeholder glyphs are temporary
presentation infrastructure, not canonical mascot assets.

## Verified mobile/responsive baseline

Checked at 360, 390, 430, 768, 1024 and 1440 across Today, Week, Journey, Adventure
Map, Progress, Profile, Settings and Settings → Data: no horizontal overflow, every
screen renders, navigation usable, no console or page errors beyond blocked map tiles
in a sandbox without network.

## Handoff checkpoint

```
HANDOFF CHECKPOINT
main SHA: 5035d37d501bf7fe1f2136b6d80c3ea348531d10
latest merged PR: #79 — Adventure Map v1
test baseline: 91 files / 1918 tests; TypeScript + production build passed; diff --check clean
completed: P0 runtime train — #80 mobile update reliability (carrying #77's offline-shell refresh), #81 settings build identification, #79 Adventure Map v1; #77 closed as superseded
current phase: Phase 8 reinforcement / Living Interface integration
next exact action: premium egg / hatch implementation — not started
parked branches/work: preserve/journey-home-mobile-background-v1; future/ornate-mystery-egg-v1
known blockers: no test CI (issue #144); offline is shell-only; shared game-state correctness unresolved; runtime coverage gap; pilot data-safety items
new locked decisions: none
deployment state: post-merge main deployment reported green by Vercel; Vercel runs build/typecheck only
notes for next agent: a green PR does not mean the suite passes until #144 lands — run it yourself
```

Read `docs/ROADMAP.md` for *what to build*, `docs/DECISIONS.md` for durable
decisions, and `skills/ninfit-delivery-loop/SKILL.md` for *how work is done*.
