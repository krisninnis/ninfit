# NinFit Current State

A short live checkpoint for a human or agent picking the project up cold.

**Authority:** live Git, tests and repository contents outrank this file. If they
disagree, believe Git and say so. See `skills/ninfit-handoff/SKILL.md`.

Last updated: **2026-08-30**

## Repository truth

| | |
|---|---|
| Remote | `https://github.com/krisninnis/ninfit.git` |
| `main` | `1350f032c55495f191bc19c4c4c477a74f587365` |
| Latest merged PR | **#76 — Settings & Navigation Reorganisation v1** |
| Latest verified runtime baseline | **88 files / 1902 tests** on PR #76; TypeScript passed, production Vite build passed, `git diff --check` clean |
| Node | `24.x` |
| Production | `https://ninfit.vercel.app` |
| Phone review workflow | GitHub PR → Vercel Preview → human phone review → merge → production PWA |

Verify live Git before acting. Branches are cut from verified `origin/main`, never
from a stale local checkout.

## Recently completed

Most recent first.

| PR | What landed |
|---|---|
| #76 | **Settings & Navigation Reorganisation v1** — Settings replaces Data in primary navigation; Data remains a secondary Settings destination; System/Light/Dark appearance is persisted through the existing theme engine |
| #75 | **Journey Map MapLibre Color Compatibility v1** — modern CSS theme colours are converted to MapLibre-compatible sRGB at the map boundary |
| #73 | **Tortoise Starter Clean Idle Runtime v1** — approved clean occasional idle, rest still, reduced-motion handling and desktop/tablet centring correction |
| #74 | **Living Fitness Adventure niche** — roadmap locks “Move in the real world. Explore with your companion. Build a history together.” plus Adventure Map, Mascot Memory, Journey Book, effort choices, non-FOMO quests and future community Adventures |

Earlier Journey work already merged into `main` includes Journey Home, active GPS
recording, truthful route points/distance, route privacy, completion/history/detail
presentation, postcards, backup/restore integrity and companion integration.

## Current product/architecture position

NinFit remains **fitness-first**. Fitness truth is authoritative; programme/game,
companion and narrative systems sit downstream.

Primary navigation is now:

```
Today · Week · Journey · Progress · Profile · Settings
```

Data remains available under Settings rather than competing for a permanent primary
navigation slot.

The current theme architecture supports:

- **System** — follows `prefers-color-scheme`
- **Light** — explicit light override
- **Dark** — explicit dark override

The semantic token system remains the single theme engine.

The Starter Tortoise presentation currently supports:

```
REST
→ occasional clean IDLE one-shot
→ REST

REST
→ user TAP
→ existing WAVE one-shot
→ REST
```

The old tap-wave asset still contains its known Pika/background artefact. Replacing it
is a separate T1B art/presentation slice; do not silently replace or destructively
edit it.

## Living Fitness Adventure direction

The roadmap now explicitly positions NinFit as a living fitness adventure for people
starting, restarting or struggling to stay active.

Core framing:

> Move in the real world. Explore with your companion. Build a history together.

Long-term pillars:

- Adventure Map
- Mascot Memory
- Journey Book / “Our Adventure” recap
- “What can I manage today?” effort choices
- real-world quests without permanent FOMO
- future community-created Adventures with later privacy/safety/moderation work

Fitness truth answers **what happened**. The companion/game layer supplies emotional
reasons to return and may never invent the underlying activity.

## Important current guarantees

- fitness and Journey truth are never fabricated by game, mascot, AI or presentation
- local fitness data remains authoritative
- Journey GPS, route points, distance and provenance stay in their existing truth layer
- imports/backups preserve current Journey integrity rules
- game settings cannot alter fitness records
- health/body data remains neutral information, never a verdict
- pre-hatch mascot secrecy remains intact
- reduced motion suppresses ambient idle motion
- MapLibre paint colours no longer receive unsupported OKLCH strings directly
- Data backup/export/import remains available despite Data leaving primary navigation
- Settings uses the existing theme engine rather than creating a second one
- no guilt, punishment, pay-to-win or fake completion/reward patterns

## Active phone-first delivery work

Two independent PRs are currently under review and are **not merged**:

- **#80 — Mobile Demo Update Reliability v1**
  - safer/eager PWA update checks
  - online launch prefers current deployment
  - cached shell remains offline fallback
  - no forced reload that could interrupt an active Journey
  - adds `docs/PHONE_DEMO.md`

- **#81 — Settings Build Identification v1**
  - Settings/About displays app version, deployment channel and a compact loaded-build fingerprint
  - intended to make stale/mobile-deployment diagnosis obvious during phone demos

Treat these as review candidates, not current product truth, until merged.

## Next exact actions

### 1. Finish phone-demo reliability

Human-review PR #80 on a real phone. Confirm:

- installability remains intact
- a fresh online launch uses the latest production deployment
- offline fallback still opens
- coming back online does not erase local data
- no surprise reload occurs during an active Journey

### 2. Finish build identification

Human-review PR #81. Confirm Settings → About is readable on mobile and that production
and preview deployments show distinguishable build/channel information.

### 3. T1B — Starter Clean Interactive Wave v1

Prepare/approve a clean replacement for the current tap-wave asset.

Locked behaviour:

```
REST → user tap → clean wave one-shot → REST
```

Ambient idle remains separate. No autoplay. No loop. Reduced-motion rules remain
appropriate. The replacement must preserve Starter Tortoise identity and framing and
must pass human visual review before production wiring.

### 4. Living Fitness Adventure foundation design

After the current mobile/reliability and art lane reach safe stops, continue the
roadmap with local-first architecture for Adventure Map, deterministic Mascot Memory,
Journey Book, manageable-effort choices and safe non-FOMO quests.

## Known blockers / follow-up

### PWA/mobile update reliability

PR #80 is the active correction. Until it merges and is verified on production,
installed-app freshness is still a review item rather than a closed issue.

### Build/version visibility

PR #81 provides an About/build fingerprint, but it is not current product truth until
merged.

### Starter tap wave

The old tap-wave asset remains intentionally unchanged and is known to contain a Pika
background/watermark artefact. T1B requires a clean human-approved asset.

### Runtime test coverage

The suite is extensive but still relies heavily on pure/source-boundary tests. Add
heavier browser/runtime infrastructure only when a proven failure requires it.

### Data safety before a real pilot

Still outstanding from `docs/production-readiness.md`:

- exercise schema migration N → N+1
- rehearse real-history backup/restore
- decide browser quota / interrupted-write recovery behaviour
- provide or explicitly accept a delete-all path

### Account maturity

Password recovery remains a known gap before account promotion. Optional NinFit ID
must not be described as cloud fitness backup/sync until that feature actually exists.

## Protected historical state

Older local-only delivery/worktree folders may still exist on the original Windows
machine. Their absence from a cloud clone is not evidence they never existed.

Do not clean, reset, stash, restore, prune, delete or repurpose the protected historical
checkout merely to make it look tidy.

## Handoff checkpoint

```
HANDOFF CHECKPOINT
main SHA: 1350f032c55495f191bc19c4c4c477a74f587365
latest merged PR: #76 — Settings & Navigation Reorganisation v1
latest verified runtime baseline: 88 files / 1902 tests; TypeScript + production build passed
completed: #73 T1A clean idle, #74 living-adventure niche, #75 MapLibre colour compatibility, #76 Settings/navigation
open review work: #80 mobile update reliability; #81 Settings build identification
current phase: phone-first reliability + Starter presentation hardening
next exact action: human phone review of #80/#81, then T1B clean wave preparation
known blockers: clean T1B wave asset still required; pilot data-safety items remain
deployment workflow: GitHub PR → Vercel Preview → human phone review → merge → production PWA
notes for next agent: live Git wins; do not treat open PRs as merged truth
```

Read `docs/ROADMAP.md` for *what to build*, `docs/DECISIONS.md` for durable
decisions, and `skills/ninfit-delivery-loop/SKILL.md` for *how work is done*.
