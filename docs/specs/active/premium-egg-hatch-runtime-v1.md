# Premium Egg Hatch Runtime v1

Issue #134, the wiring half. The approved production assets (PR #195) become what the
hatch runtime actually shows, and the Starter Tortoise ceremony is proved end to end.

Status: **built and verified, awaiting human visual approval of the ceremony.** Stacked
on PR #195; not merged.

## What changed, and what deliberately did not

The artwork replaced the drawing. **It did not replace the API.** `crackStage: 0-5`,
`useHatchCinematic`, the 4,200 ms ceremony, the 1,450 ms break, the reduced-motion
path, Skip, `hatchEgg` and every domain contract are untouched. The diff is one new
registry, one component branch, some CSS, and the two defects the visual proof found.

| | |
| --- | --- |
| `src/ui/eggStageArt.ts` | new central registry: stage -> reviewed asset |
| `src/ui/components/EggArt.tsx` | resolves through the registry; code drawing demoted to fallback |
| `src/styles/components/egg.css` | the stacked, cross-faded stage layer |
| `src/styles/screens/onboarding.css`, `game.css` | resting sizes no longer win during the ceremony |
| `src/ui/screens/OnboardingScreen.tsx` | the standing companion takes the slot after the ceremony |

`useHatchCinematic.ts`, `GameHeader.tsx`, `TodayScreen.tsx`, `src/domain/**` — unchanged.

## Decisions

### Its own registry, not a row in the mascot one

`MASCOT_STAGE_ART` is keyed by `family:stage`. The egg has no family and must never
acquire one: a lookup that took a family would be a lookup somebody could one day pass
a real family to, and the answer would leak the species. `eggStageArt` takes a number
between 0 and 5 and there is nothing else to give it.

### All six stages mounted at once, cross-faded

Two reasons, both about the same 1,450 ms. Swapping one element's `src` shows a decode
gap, and that gap would land on the break — the single frame that has to be perfect.
Mounting them together also means the ceremony never waits on a request it could have
made during the questionnaire. The whole set is ~69 KB, which is exactly what the
budget in `premium-egg-production-assets-v1.md` was set for.

### The code drawing stays, demoted

`docs/CURRENT_STATE.md` requires that a failed asset still leaves the authoritative
hatched companion reachable — never a reroll, never a trap, never a lost answer. The
hatch mutation lives in the hook and the domain and is independent of any media, so an
image that 404s costs polish and nothing else. Deleting the drawing would turn a 404
into a blank square in the middle of the one moment the product exists for.

One failure sends the **whole** presentation back to the drawing. A shell that changed
rendering language halfway through the questionnaire would read as a bug even though
every individual asset was fine.

## Two defects the visual proof found

Both predate this branch — they shipped with the #192 ceremony — and both were
invisible while the egg was a placeholder drawing.

**1. The full-viewport ceremony was drawing a 36–58 px egg.** `styles/index.css`
declares `screens` after `components`, so `.step__egg .egg { height: 72px }` and
`.game__art .egg { height: 44px }` beat the ceremony's own `min(56vmin, 420px)` —
layer order wins over specificity, so the components layer could not have won at any
specificity. Fixed by scoping each screen's rule to the resting case
(`:not([class*='egg-hatch--'])`), which puts the boundary between "the screen's size"
and "the ceremony's size" in one readable place instead of leaving it to layer order.

**2. Onboarding kept the egg after the ceremony ended.** The only companion element in
that slot was the ceremony's, which is `opacity: 0` outside a running ceremony — so the
reveal panel read "Your companion / Tortoise" above a picture of an egg. Fixed by
mirroring `GameHeader`'s `family === undefined || hatch.isRunning` exactly, so the two
hosts are one behaviour rather than two that resemble each other.

## Proof

`src/test/premiumEggHatchProof.dom.test.tsx` — 16 tests, running the real ceremony in a
DOM with real timers stepped by hand and the real domain mutation wired to the real
component. It drives Today's recovery route beat by beat, and walks the actual
onboarding questionnaire for the handover.

- no species anywhere in the rendered tree at 0, 400, 850, 1,200 and 1,449 ms
- the commit lands at 1,450 ms, exactly once, with the ceremony still running over an
  already-hatched domain
- the reviewed Starter Tortoise appears only after the break, through emerging,
  settling and landing
- the ceremony ends at 4,200 ms and hands over to the normal standing companion
- reduced motion gives three states, commits at 700 ms, and reveals nothing earlier
- Skip commits once and preserves the authoritative result
- a failed asset falls back to the drawing and still hatches, still reveals
- only `mascot` changes: no XP, trophy, reward key, event, skill, cosmetic or fitness
  stage moves, and no geolocation call is made

Mutation-tested against eight regressions: commit moved off the break, companion
mounted early, fallback removed, reduced motion collapsed to an instant hatch, ceremony
shortened, Skip abandoning the hatch, only the visible stage mounted, and the ceremony
granting XP. Each is rejected.

Visual proof at 360, 390, 430, 768, 1024 and 1440, captured from the production build:
`docs/brand/reference/egg/hatch-proof-mobile-v1.png` and `hatch-proof-wide-v1.png`.

## Verification

| | |
| --- | --- |
| Base | PR #195 head `ccea5a7`, itself cut from `origin/main` `857819c` |
| Tests | 105 files / 2,010 -> **106 / 2,030** |
| TypeScript, production build, `git diff --check` | clean |

## The gate

Human visual approval of the ceremony on a real device: premium egg, cumulative
cracking, shell opening and light, Tortoise reveal, settling, normal companion state.
A green run is not that.

## Not in this slice

Starter families 2-5. The Tortoise proof is the gate they wait behind, exactly as
`docs/CURRENT_STATE.md` requires.
