# NinFit mascot activity artwork

Production artwork for a path mascot on a Journey activity door. One folder per
mascot family, named for its `MascotFamilyId` in `src/domain/game/paths.ts`.

## Where a file goes

```
public/mascots/<familyId>/<familyId>-journey-<activityFamily>.webp
```

`<familyId>` is one of `tortoise`, `bear`, `fox`, `otter`, `wolf`.
`<activityFamily>` is one of `walk-run`, `cycle`, `swim` — the ids in
`src/ui/journeyActivityFamilies.ts`.

So the tortoise's Walk/Run artwork is:

```
public/mascots/tortoise/tortoise-journey-walk-run.webp
```

`mascotActivityArtPath()` in `src/ui/mascotActivityArt.ts` builds exactly that
string, and a test pins it.

## Placing a file is not enough

Nothing loads from this folder by scanning it. A file becomes visible only when
it is declared in the `MASCOT_ACTIVITY_ART` manifest in
`src/ui/mascotActivityArt.ts`:

```ts
export const MASCOT_ACTIVITY_ART: MascotActivityArtManifest = {
  'tortoise:walk-run': {
    src: '/mascots/tortoise/tortoise-journey-walk-run.webp',
    alt: 'Tortoise, ready to head out',
  },
};
```

That is deliberate. An entry here is a statement that a real, reviewed file
exists at that URL, so declaring one before the file lands would show every user
of that species a broken image. Until an entry exists the screens fall back to
the temporary letter, which is ugly but honest.

## Why URLs and not imports

The same reason the backgrounds registry gives: five families times three
activity families is fifteen images, and a user has one species. An `import`
would put all fifteen in the bundle. A URL fetches the one on screen.

## Before an asset is production

See `skills/ninfit-visual-asset-pipeline/SKILL.md`. Generated artwork is
reference material until a human has reviewed it, and reference material lives
in `docs/`, not here. `docs/brand/reference/mascots/` currently holds a tortoise
reference PNG — that is source material and must not be wired into runtime code.

## Current status

Two reviewed assets:

- `tortoise/tortoise-journey-walk-run.webp`, declared in the manifest and shown
  on the Walk/Run launch screen. Its reviewed source sheet is kept at
  `docs/brand/reference/mascots/ninfit-tortoise-journey-walk-run-reference-v1.png`.
- `tortoise/tortoise-starter-idle-v1.webm` (the approved Starter clean idle
  master) with its resting still `tortoise-starter-idle-v1.png`, declared in
  `MASCOT_STAGE_ART` and shown on the Today companion. The approved master is
  preserved as reference at
  `docs/brand/reference/mascots/tortoise/tortoise-starter-idle-master-v1.webm`.

Reference material lives in `docs/` and must never be referenced by runtime
code.

Everything else is still undeclared — four species, and Cycle and Swim for the
tortoise — and those all fall back to the temporary letter. That is the normal
state, not a gap: fourteen of the fifteen keys have no reviewed art, so the
`undefined` path is the common one and must stay correct.
