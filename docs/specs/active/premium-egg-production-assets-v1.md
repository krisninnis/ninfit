# Premium Egg Production Assets v1

Issue #134 — *Premium Egg Progression + Surprise Mascot Hatch v2*, the production-art
half. The runtime ceremony (state, timing, durability, accessibility) already merged
through #192. This document covers the artwork that replaces the temporary drawing.

Status: **assets built, awaiting human visual approval.** Not wired into the runtime.

## The problem this set exists to solve

Every previous attempt produced *six unrelated eggs*: the same brief run six times,
each result with its own silhouette, its own light and its own idea of what the object
was. #134 asks for the opposite — "one continuous object becoming increasingly alive,
not a sequence of unrelated low-quality crack images."

So the unit of work here is not six pictures. It is **one master and five additive
overlays**, and the guard suite proves that is what shipped.

## Approved art direction

Signed off by human review before this slice began:

- pearl / ivory shell
- restrained, elegant gold spiral and band detailing
- warm internal golden light
- premium, calm, painterly / 3D-fantasy NinFit feel
- species-neutral before hatch
- the same silhouette, camera, scale and lighting through the whole progression
- no species colour, anatomy, silhouette, text, filename or other pre-hatch leak

The earlier generated concept boards are **reference artwork only**. They are not
production SVGs and were not canonical runtime assets.

## Stages

The art vocabulary is the domain's `crackStage: 0–5` (`src/domain/game/egg.ts`),
unchanged. Nothing in this slice touches that contract.

| Stage | Intent | What is added |
| --- | --- | --- |
| 0 | `pristine` | The master alone. No fracture, no bloom. |
| 1 | `hairline` | One hairline, deliberately off the vertical axis. |
| 2 | `branching` | It forks unevenly — one long branch, one short, one whisker. |
| 3 | `fracture` | Branches travel around the flanks; the network spreads laterally. |
| 4 | `separating` | The network crosses the gold band; the first gaps show warm light. |
| 5 | `hatch-ready` | A seam has closed around the crown, plates have parted, the light is loud. |

Cracks are **cumulative by construction**: stage *n* renders fracture layers `0..n`
from one array, so a crack present at stage 2 is the same crack, in the same place, at
stage 5. It is not six drawings in which the cracks happen to grow.

## Decisions locked by this slice

### Vector, not raster

Six raster stages are six full re-renders and six chances for the shell to drift. In
vector the shell is one string emitted six times, byte-identical, and
`src/test/eggProductionArt.test.ts` checks exactly that. `.gitattributes` already
states that SVG "belongs under the text rule, and it should diff as text", so a future
change to the egg arrives in review as a readable diff rather than an opaque binary
swap. The whole six-stage set is **~70 KB** — smaller than one background WebP.

This supersedes the earlier WebP proposal for this asset, which predated the decision
to derive the stages from a single shared geometry.

### `public/egg/`, never `public/mascots/<family>/`

A family name in the asset path leaks the species through the URL before the reveal —
the one leak vector that survives every DOM-level precaution. Filenames are
`egg-stage-<n>-v1.svg`: no family, no path, no species.

### Canvas and viewBox

`viewBox="0 0 80 100"` — `EggArt`'s viewBox, exactly, so the eventual swap causes no
layout shift and needs no compensating transform. Intrinsic size 1024 × 1280 (4:5) is
the same box, sized for the 420px ceremony presentation at 2×.

### Payload budget

**90 KB per stage, 450 KB for the set.** Tighter than the 250 KB background allowance
on purpose: all six stages load during one questionnaire on mobile data, whereas only
one background is on screen at a time.

### What the gold inlay must never come to mean

Not a path. Not rarity. Not Secret Prestige. Not XP. Not an achievement. Not anything
purchasable. It is the material the egg is made of, identical for everybody.

## Where the artwork lives

| | |
| --- | --- |
| Canonical master (source of truth) | `src/art/egg/eggMaster.ts` |
| Production stages | `public/egg/egg-stage-0..5-v1.svg` |
| Generator | `scripts/build-egg-art.ts` |
| Guard | `src/test/eggProductionArt.test.ts` |
| Review sheet | `docs/brand/reference/egg/egg-stage-contact-sheet-v1.{html,png}` |

The generator is a convenience, not the contract: the guard regenerates the same
strings in memory and compares them to what is committed, so a hand-edited SVG fails
the suite whether or not anybody remembers to run the script.

`src/art/egg/eggMaster.ts` is art source. It is imported by the generator and the
guard and by nothing the application runs — a test asserts that.

## What is guarded automatically

- the committed files are byte-for-byte what the master generates
- the master block appears verbatim in all six stages
- the silhouette path count is identical across the set, and the fracture group is
  clipped to the shell, so no stage can move the outline even with wrong coordinates
- viewBox, canvas and lighting gradients are identical across the set
- fracture layers are strictly cumulative, and stage *n* contains stage *n−1*'s
  fractures verbatim
- escaping light is monotonic in the stage
- no species or anatomy vocabulary, in markup, ids or asset paths
- no `<text>`, `<title>`, `<desc>`, `<metadata>`, `aria-label`, external reference or
  script in any asset
- the set is within the per-stage and whole-set payload budgets
- the assets animate nothing, so reduced motion has nothing to switch off
- no runtime module imports the master or names `/egg/`, and `EggArt` is untouched

The suite was mutation-tested: a hand-edited coordinate, a changed silhouette in one
stage, an injected species `<title>`, a dropped cumulative layer, a runtime import of
the master, a stage where the light dims, an injected event handler, a seventh stage
file, and a removed fracture clip are each rejected; the conforming state passes.

## What is NOT guarded, and is the next gate

A green test run is not visual approval. These are human judgements and this slice
stops in front of them:

1. Does the set read as one premium object becoming alive, in the app, on a phone?
2. Do the cracks feel cumulative rather than merely additive?
3. Does stage 5 read as *about to open* without disclosing anything?
4. Does the gold read as restrained rather than decorative or purchasable?
5. Does the set hold up on the real light and dark page surfaces at 360px?

`docs/brand/reference/egg/egg-stage-contact-sheet-v1.png` exists for exactly this
review: all six stages on both surfaces, at the 68 × 85 onboarding header size and at
the 201 × 251 ceremony size a 360px viewport actually produces.

## Deferred to the next slice, after approval

Runtime integration is mechanical when it comes and is deliberately not in this
branch:

- an `EGG_ART` registry alongside `MASCOT_STAGE_ART`, resolving stage → asset
- `EggArt` falling back to today's inline drawing when an entry is absent, so a failed
  asset can never trap or reroll anybody — the authoritative hatch is independent of
  presentation media and must stay that way
- no change to the `crackStage: 0–5` contract, the ceremony timing, or the
  reduced-motion path
- then the Starter Tortoise end-to-end proof, and only then families 2–5

## Contracts preserved

Calm by default. Fitness-first. No guilt, no punishment, no pay-to-win, no fake
fitness truth. No species leak before hatch. Reduced-motion support. Authoritative
hatch state integrity.
