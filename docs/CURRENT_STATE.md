# NinFit Current State

A short live checkpoint for a human or agent picking the project up cold.

**Authority:** live Git, tests and repository contents outrank this file. If they
disagree, believe Git and say so. See `skills/ninfit-handoff/SKILL.md`.

Last updated: **2026-09-05**

## Repository truth

| | |
|---|---|
| Remote | `https://github.com/krisninnis/ninfit.git` |
| `main` | `95c9ccabb454f723e527bc08b371e25c56f3bda1` |
| Latest merged PR | **#197 — Staged egg shake and Tortoise hatch wave motion** |
| Open PRs at checkpoint | **1 — #194 (`feat/day1-first-win-selector-v1`, deterministic Day 1 first-win selector)** |
| Open issues | **46** (#101–#144, #146, #147). None closed. |
| Verified baseline | **107 test files / 2,035 tests**, TypeScript, production build, `npm audit` (0 vulnerabilities) and `git diff --check` all passed on `95c9cca` in a clean clone on 2026-09-05. |
| Node | `24.x` |
| Deployment | GitHub Actions Verification Gate passed for each merged PR in the #193–#197 train. |

Verify live Git before acting. Branches are cut from verified `origin/main`, never
from a stale local `main`.

## Recently completed

The current P0/P1 train, most recent first. Everything below is merged and present in
the SHA above.

| PR | What landed |
|---|---|
| #197 | **Staged egg shake and Tortoise hatch wave motion** — per-stage crack shake, and the Starter Tortoise wave played during the post-break reveal. **See the defect record below: this slice is due to be reverted.** |
| #196 | **Premium egg stages wired into the hatch runtime** (#134) |
| #195 | **Premium egg production stages derived from one canonical master** (#134) |
| #193 | **Current-state checkpoint** after the full-motion hatch |
| #192 | **Full-motion hatch presentation** — held, break, emergence, settling and landing across onboarding and Today recovery; revealed companion art is requested only after the authoritative hatch |
| #191 | **Optional Supabase startup** — the local-first app remains usable when optional NinFit ID configuration is absent |
| #190 | **Current-state refresh** after verification work |
| #189 | **Minimal DOM component test lane** — jsdom/Testing Library opt-in for rendered TSX behaviour |
| #188 | **Hatch commit durability** — a started ceremony commits exactly once even if its host unmounts before the break timer |
| #187 | **Real PR whitespace gate** — Actions compares the actual base/head or before/after range |
| #186 | **Today heading entity fix** |
| #185 | **Day 1 First Win** — calm first-step guidance around the existing authoritative activity action |
| #184 | **GitHub verification gate** — full tests, typecheck, production build and diff validation on Node 24 |
| #182 | **Hatch timing contract tests** aligned with the reduced-motion ceremony |
| #181 | **Reduced-motion hatch ceremony** — three still states, real commit beat, accessible status copy and Skip control |
| #180 | **Break-point hatch commit** — authoritative mutation at 1,450 ms while the presentation continues to 4.2 s |
| #179 | **Six-stage crack fidelity** — deterministic cumulative crack presentation over the shared temporary egg |
| #178 | **P0 pilot evidence and compatibility coverage v2** — rebuilt useful evidence from stale #86/#87/#91/#92/#93 on current main |
| #177 | **Restore read-back integrity v2** — semantic verification before restore success is reported |
| #148 | **Data backup & restore transparency** — rebuilt #94/#95/#96 presentation intent for Settings → Data |
| #176 | **P0 pilot documentation integration** — rebuilt useful documentation from stale #83/#84/#85/#88/#89/#90 |
| #150 | **Fail-closed complete backup integrity** — rebuilt #97/#98/#99 safety intent coherently on current main |
| #79 | **Adventure Map v1** — a projection of durable Journey history onto one private map |
| #81 | **Settings Build Identification** |
| #80 | **Mobile Demo Update Reliability** |
| #76 | **Settings & Navigation Reorganisation** — Settings owns Appearance, App preferences, Privacy and Data |
| #73 | **Tortoise starter clean idle runtime** |

The original #83–#100 branches are now **closed unmerged**. Their accepted intent was
recreated through #176, #148, #150, #177 and #178; do not resurrect those stale
siblings mechanically.

## Current product/architecture position

NinFit remains **fitness-first**. Fitness truth is authoritative; programme/game and
companion systems sit downstream.

### P0 data/integration train

The P0 cleanup requested by #142/#143 is complete in current `main`:

- pilot documentation was reconciled rather than stale-merged
- realistic backup/restore, interruption, corruption, write-failure and compatibility
  evidence is present
- Settings → Data explains Journey inclusion, active recovery, old/pre-Journey files,
  app/schema metadata and device-loss risk without using metadata as a trust shortcut
- supposedly complete backups fail closed when authoritative local/Journey data cannot
  be read safely
- restore read-back verification distinguishes backup/write/verify failure and does not
  claim localStorage transactionality
- legitimate old backups remain supported and do not destructively infer missing
  Journey history

### Premium egg and hatch

The runtime ceremony from #134 is now substantially implemented:

- questionnaire progress maps deterministically to six visual egg states
- cracks are cumulative and species-neutral
- the real hatch mutation happens at the break point, not at the end of presentation
- a started hatch commits exactly once even if the host unmounts early
- full motion runs for **4.2 seconds** through cracking, held, flash, emergence,
  settling and landing
- reduced motion uses three still states with opacity-only treatment and a Skip path
- the selected companion asset is not inserted until after the authoritative hatch, so
  pre-break asset requests cannot disclose species
- onboarding and Today recovery share the same hatch hook
- the normal reviewed standing mascot presentation takes over after the ceremony

The remaining visual gap is important: `EggArt` and its SVG fracture paths are still
explicitly **temporary presentation infrastructure**. There is no approved premium
master egg / derived production crack-stage asset set yet. #192 also deliberately added
no new generated hatch art.

### Living Adventure

The Adventure Map remains a projection, not a second store:

- it reads durable Journey history and admits only completed/imported Journeys
- trusted route segmentation is reused; gaps and separate Journeys are never joined
- authoritative distance remains the stored `distance_m` metric
- the map writes and persists nothing
- exact route geometry remains private; disclosure surfaces use the separate privacy
  projection

### Settings and data

Settings remains the owner of Appearance (System / Light / Dark), app preferences,
Privacy and participation, Data & privacy, and About. Data is not a primary navigation
item. JSON is the restorable backup; CSV is explicitly non-restorable.

### PWA / phone demo

`docs/PHONE_DEMO.md` remains the install/update walkthrough. Installed launches prefer
the current online deployment without automatically reloading a running document, so
an active Journey is not interrupted. Offline support remains shell-only; do not claim
that the full app works offline.

## Current phase

**Pre-beta hardening, as agreed at the 2026-09-05 launch summit.**

The premium egg master and its derived stages landed in #195/#196, so the #134 art gate
is closed for the egg. The phase now is not new capability: it is removing the four
hatch-wave defects recorded below, closing the offline-start gap, adding the first
measurement, and getting the product into fifteen to twenty-five real pairs of hands.

`docs/LAUNCH_SUMMIT_2026-09-05.md` is the agreed scope, release gate and roadmap.

## Next exact action

**Revert the Tortoise wave from the hatch presentation and from Today's tap-to-wave**
(summit M1), keeping the standing and idle presentation and the media-failure fallback
exactly as they are, and re-point `src/test/tortoiseHatchWaveShake.dom.test.tsx` to
assert that the wave is not mounted.

Then add the asset-contract tests (summit M2) so a still can never again be paired with
a motion master that is not its own, and so a watermarked or poorly-matted asset cannot
reach `main`. Only after both are in place should a clean T1B wave master be produced
and re-landed.

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
- Generated artwork is reference/source material until human approved; only canonical
  reviewed assets are wired into runtime code.

## Parked work — do not merge

| Branch | SHA | Why parked |
|---|---|---|
| `preserve/journey-home-mobile-background-v1` | `c984009dd437694b4459b1f4f48b7a449e88d2bc` | Journey Home mobile scenery prototype; reference only |
| `future/ornate-mystery-egg-v1` | `25dcfad80fbe6a189c0627443d2502dbbc851f5e` | Ornate Mystery Egg art route unfinished; do not treat it as the approved #134 master |

The user's checkout may also carry helper/untracked delivery folders created during
delivery work. Do not clean, delete, stash or repurpose them from an agent session
without explicit human instruction.

## Known blockers / follow-up

### Production egg/hatch art

This is the immediate #134 gate. The runtime currently uses the code-drawn egg and
existing reviewed standing mascot art. The temporary egg must be **replaced**, not
polished into a de-facto production asset. One master, derived stages, then Tortoise
proof and human mobile review.

### Hatch wave motion — four defects on current `main`

Recorded by the 2026-09-05 launch summit
(`docs/LAUNCH_SUMMIT_2026-09-05.md`, section 2.2), which holds the full evidence and
the reproduction commands. Human device testing reported overlapping Tortoises during
the reveal; inspection of current `main` found four separate faults, all of which pass
CI:

1. **Two companions render at once.** `HatchCompanionMedia` keeps the standing still
   mounted at `opacity: 1` beneath the wave video, and the still it uses is frame 0 of
   the **idle** master (bbox 308x478) while the video is the **wave** master (bbox
   320x492). The silhouettes do not coincide, so the standing figure protrudes around
   the animated one. `public/mascots/tortoise/tortoise-starter-wave-rest-v1.png` is the
   wave master's own frame 0 and is referenced nowhere in `src/`.
2. **A Pika watermark is visible during the reveal**, from roughly t=1.6s to t=3.4s.
   `docs/specs/active/tortoise-production-scaffold-v1.md` already forbids treating this
   asset as production art.
3. **Green matte spill** on the wave master: 11,272 semi-transparent edge pixels with a
   mean green excess of +53.8 (max +116). The idle master measures 0 on the same test.
4. **The wave never finishes.** The master is 5.03s; the ceremony mounts it for 2.5s.

The agreed action is to **revert the wave from the hatch and from Today's tap-to-wave**
and to re-land it only behind machine-checkable asset contracts. The reduced-motion
path, the no-motion path and the media-failure fallback are all correct and unaffected.

### Runtime media/art failure fallback

The hatch mutation itself is independent of presentation media and therefore cannot be
lost because an animation fails. When production hatch/egg assets are introduced,
explicitly prove that a failed asset still leaves the authoritative hatched companion
reachable using its reviewed standing fallback; never reroll or trap the user.

### Shared game state / reward delivery

Still unresolved. The earlier checkpoint recorded a candidate correctness risk around
multiple independent `useGame()` instances consuming newly granted `RewardEvent`s
before the intended acknowledgement surface sees them. Durable reward delivery reduced
the presentation-loss risk, but the shared-state discovery itself remains owed. Extend
the DOM lane where rendered behaviour is required.

### Offline support is shell-only

The precache holds the shell/manifest/icons, not the application JS/CSS bundle. An
offline launch can paint the shell without booting the full app. This is a deliberate
current limitation.

### Map rendering proof

Automated headless software WebGL does not provide reliable pixel proof for the drawn
route line. Wiring/camera/paint conversion are covered; the actual route line still
needs human proof on a real device.

### Data safety before a real pilot

The P0 integrity/evidence train is substantially stronger, but
`docs/production-readiness.md` still owns any remaining real-device pilot acceptance,
including schema N → N+1 and deletion-path decisions. Do not infer those gates passed
merely because unit evidence exists.

### Account maturity

Password recovery remains a gap before account promotion. Optional NinFit ID must not
be described as cloud fitness backup/sync until that feature exists.

## Verified mobile/responsive baseline

The established app baseline has been checked at 360, 390, 430, 768, 1024 and 1440
across Today, Week, Journey, Adventure Map, Progress, Profile, Settings and Settings →
Data. #192 is a visible hatch change and therefore still needs human real-device visual
acceptance for the final production-art proof; passing CI/Vercel is not a substitute for
art approval.

## Handoff checkpoint

```
HANDOFF CHECKPOINT
main SHA: 95c9ccabb454f723e527bc08b371e25c56f3bda1
latest merged PR: #197 — Staged egg shake and Tortoise hatch wave motion
open PRs: #194 (deterministic Day 1 first-win selector)
test baseline: 107 files / 2035 tests; TypeScript + production build + npm audit (0 vulns) + diff check passed on 95c9cca
completed: P0 #83–#100 intent rebuilt on current main; six-stage cracks; full/reduced hatch timing; break commit; early-unmount durability; Day 1 First Win; optional-Supabase startup; verification gate
current phase: Phase 9 mascot onboarding integration — production-art proof
next exact action: create/review one premium species-neutral master egg, derive consistent crack stages, then prove Tortoise end-to-end before families 2–5
parked branches/work: preserve/journey-home-mobile-background-v1; future/ornate-mystery-egg-v1
known blockers: hatch wave carries four art defects on main and is due to be reverted; offline start is shell-only and now treated as a launch blocker; no analytics or crash reporting exists; NinFit ID has no password recovery; shared game-state discovery unresolved; pilot real-device/data-safety follow-up remains
new locked decisions: see docs/LAUNCH_SUMMIT_2026-09-05.md section 18 (D-01 to D-19)
deployment state: #192 Verification Gate and Vercel passed before merge; current-main Vercel status success
notes for next agent: cut from live origin/main; do not resurrect #83–#100; temporary EggArt is not production art; generated assets require human review before runtime wiring
```

Read `docs/LAUNCH_SUMMIT_2026-09-05.md` for the agreed launch scope, release gate and
roadmap from 2026-09-05 forward, `docs/ROADMAP.md` for the long-horizon product vision, `docs/DECISIONS.md` for durable
decisions, `skills/ninfit-visual-asset-pipeline/SKILL.md` for the art gate, and
`skills/ninfit-delivery-loop/SKILL.md` for *how work is done*.
