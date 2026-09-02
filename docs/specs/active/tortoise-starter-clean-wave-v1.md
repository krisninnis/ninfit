# T1B — Starter Clean Interactive Wave v1

## Status

**Production brief / human asset gate. Runtime replacement is NOT authorised by this
document alone.**

T1B replaces the temporary branded Starter Tortoise tap-wave only after a new clean
wave master has passed human visual review and production conversion.

## Outcome

One reviewed, clean Starter Tortoise greeting that preserves the existing interaction:

```
REST
  ↓ user taps
CLEAN WAVE — one shot, muted, never loops
  ↓ motion completes
REST
```

Ambient idle remains a separate T1A behaviour and asset.

## Why this slice exists

The current production interaction is structurally correct but uses temporary proof
art:

```
/mascots/tortoise/tortoise-starter-wave-v1.webm
```

The Tortoise production scaffold explicitly records that wave as Pika-watermarked
temporary proof artwork. It is not the clean production master.

The current registry entry is:

```ts
'tortoise:starter': {
  src: '/mascots/tortoise/tortoise-starter-idle-v1.png',
  idleSrc: '/mascots/tortoise/tortoise-starter-idle-v1.webm',
  motionSrc: '/mascots/tortoise/tortoise-starter-wave-v1.webm',
}
```

T1B changes only the reviewed `motionSrc` asset behind that presentation boundary.
It does not invent a new interaction, progression rule or mascot state.

## Locked product contract

### Rest

- uses the approved T1A resting still
- no visible jump before motion begins
- no size, baseline or horizontal-position change
- remains the state before and after the wave

### Wave

- user initiated only
- one shot
- never loops
- muted/no audio
- no autoplay on page load
- user tap has priority over ambient idle
- returns cleanly to rest after completion
- visibly friendly and recognisably the same Starter Tortoise

### Ambient idle

Unchanged from T1A:

- occasional one shot
- calm by default
- separate from the explicit wave
- never converted into a permanent loop

### Reduced motion

T1B must preserve the current reduced-motion contract. The user must retain the
complete companion experience without requiring animation.

Do not weaken reduced-motion behaviour merely because the new asset is cleaner.

### Pre-hatch secrecy

Unchanged:

- no visible companion
- no species disclosure
- no wave control that reveals the species
- no unnecessary request for the wave asset

## Identity anchor

The new wave must visibly be the same individual as the approved Starter Tortoise.

Authoritative visual references:

- `docs/brand/reference/mascots/tortoise/tortoise-starter-master-v1.jpg`
- `docs/brand/reference/mascots/tortoise/tortoise-starter-transparent-reference-v1.png`
- `docs/brand/reference/mascots/tortoise/tortoise-starter-idle-reference-v1.png`
- `docs/brand/reference/mascots/tortoise/tortoise-starter-idle-master-v1.webm`

Hold constant:

- face and eye design
- head/body proportions
- shell geometry and markings
- skin/shell colour language
- vest/clothing language
- rendering/lighting language
- personality
- overall silhouette

Do not treat a "similar cartoon tortoise" as acceptable continuity.

## Existing motion reference

The temporary production wave remains useful as a motion/framing reference only.

Current production facts:

| Property | Current temporary wave |
|---|---|
| File | `public/mascots/tortoise/tortoise-starter-wave-v1.webm` |
| Canvas | 608 × 608 |
| Frame rate | 30 fps |
| Duration | approximately 5.03 s |
| File size | approximately 638 KB |
| Audio | none |
| Behaviour | explicit one-shot |
| Runtime role | `motionSrc` |
| Status | temporary proof art; branded/contaminated |

Previous asset inspection established that the current wave keeps a stable feet
baseline and framing through the greeting. That continuity is worth preserving even
though the visual source itself is not a clean master.

Do **not** trim arbitrary branded frames from the old video to manufacture the final
asset. The production scaffold forbids that when it would remove meaningful motion
or create visible jumps.

## New source generation brief

Generate a clean motion source from the canonical Starter Tortoise identity.

### Preferred source framing

- square canvas
- character fully visible
- neutral transparent or easily keyable background
- no camera movement
- no zoom
- no reframing during motion
- feet planted on a stable baseline
- character horizontally centred
- enough transparent breathing room around shell/head/hand
- pose begins and ends in the same resting stance used by T1A

### Motion

A restrained friendly greeting:

1. begin at natural neutral rest
2. brief anticipation
3. raise one hand/foreleg
4. perform a small friendly wave
5. optional natural blink/smile during the greeting
6. lower hand
7. settle back to the exact neutral rest

The wave should feel warm and companion-like, not manic, childishly exaggerated or
game-show celebratory.

Target motion length: roughly **3–5 seconds**. Matching the current ~5.03 s is
acceptable if the motion remains calm.

### Must not appear

- Pika logo
- generator branding
- text
- watermark
- UI
- captions
- particles implying rewards/XP
- trophy/confetti
- scenery baked into the asset
- extra objects
- new clothing/accessories not in the approved identity
- changed shell markings
- changed species proportions
- camera pans/zooms
- green/black rectangular matte in the production render

## External generation prompt

Use the approved Starter Tortoise reference image(s) as visual identity input.

Copy/paste brief:

```text
Animate this exact NinFit Starter Tortoise character. Preserve the character's
identity exactly: same face, eyes, head and body proportions, shell geometry and
markings, skin and shell colours, green vest/clothing, lighting style and friendly
personality.

Create one calm, friendly greeting animation on a fixed square camera.

Start in a natural neutral standing/rest pose. Keep both feet planted on a stable
baseline and keep the character centred at the same scale for the entire shot.
After a short natural anticipation, raise one hand/foreleg and give a small friendly
wave. A natural blink or gentle smile is welcome. Lower the hand and finish back in
the same neutral resting pose used at the start.

The animation should feel warm, premium and restrained — a companion greeting, not
an exaggerated cartoon celebration.

No camera movement. No zoom. No crop changes. No repositioning. No scene/background
art. No text. No logo. No watermark. No generator branding. No UI. No particles,
confetti, trophies, XP effects or reward effects. Do not change the shell markings,
clothing, colours, proportions or character design.

Target duration approximately 3–5 seconds at 30 fps. Output the cleanest possible
source with transparent background if supported. If transparency is not supported,
use a perfectly flat chroma background that does not overlap any colour used by the
character and contains no shadows or branding.
```

If the generation tool offers motion-strength controls, prefer restrained motion over
large body movement. Identity continuity is more important than spectacle.

## Human source review gate

Before conversion, a human must explicitly confirm:

- "This is the same NinFit Starter Tortoise."
- face/eyes are correct
- shell markings are correct
- vest/clothing is correct
- proportions are correct
- no unwanted extra limb/object
- wave reads clearly
- motion is calm enough for NinFit
- start and end pose are suitable for transition to rest
- no branding/watermark is visible
- no important body part is clipped

If any of these fail, regenerate. Do not repair identity drift with CSS.

## Canonical filenames

Once a source passes human review:

### Reference/master

```
docs/brand/reference/mascots/tortoise/
  tortoise-starter-wave-master-v1.<source-extension>
  tortoise-starter-wave-reference-v1.png
```

The reference PNG should be a representative clean frame used for human identity
comparison, not a separately redrawn character.

### Production

```
public/mascots/tortoise/
  tortoise-starter-wave-v2.webm
```

Use `v2` rather than silently overwriting the temporary `v1` proof file. Keeping
the old blob available during review makes rollback and exact comparison possible.

Do not change `motionSrc` until `v2` passes the production checks below.

## Production conversion contract

Preferred output:

- WebM with working alpha
- 608 × 608 canvas unless human review establishes a deliberate reason to change the
  family contract
- 30 fps
- one video track
- no audio
- stable geometry
- transparent corners
- no matte rectangle
- no watermark residue
- suitable compression without destroying face/eye/shell detail

The first and final frames should visually match the approved T1A rest presentation
closely enough that the transition does not pop.

A separately drawn rest still must **not** be introduced to solve a mismatch. The
registry contract explicitly rejects CSS compensation and mismatched still/motion
geometry.

## Automated asset audit

Before runtime wiring, verify the converted WebM across the full frame sequence:

- expected dimensions
- expected fps
- expected duration/frame count
- alpha plane is real and usable
- character remains coherent/opaque
- no detached branding/watermark islands
- no accidental matte/background
- feet baseline is stable
- horizontal centre is stable
- no crop/scale drift
- motion is genuinely animated, not frozen
- first/end transition back to rest is acceptable

Programmatic checks support the human review; they do not replace it.

## Runtime implementation slice

Only after the production asset is approved:

1. add the reviewed master/reference to `docs/brand/reference/mascots/tortoise/`
2. add `tortoise-starter-wave-v2.webm` to `public/mascots/tortoise/`
3. change only the Starter `motionSrc` in `src/ui/mascotStageArt.ts`
4. update focused asset/contract tests
5. preserve all T1A idle behaviour
6. preserve current user-wave priority
7. preserve reduced motion
8. preserve pre-hatch secrecy
9. do not delete v1 until a separately authorised cleanup proves it is no longer
   required by history/tests/docs

## Browser proof

Verify at:

- 360
- 390
- 430
- 768
- 1024
- 1440

Check at minimum:

- rest before interaction
- tap → clean wave
- wave → rest
- tap during/near idle prioritises explicit wave
- no layout shift
- no size/position jump
- no clipping
- transparent background in light theme
- transparent background in dark theme
- reduced-motion behaviour
- pre-hatch secrecy/no wave asset request
- console clean for this slice

Human visual review must inspect the actual Vercel Preview, not only extracted frames.

## Verification gates

Runtime replacement PR must pass:

- focused `tortoiseStageArt` / Today companion tests
- relevant adjacent mascot/presentation tests
- full Vitest
- TypeScript
- production Vite build
- `git diff --check`
- semantic diff review
- Vercel Preview
- real phone/desktop visual review

## Non-goals

T1B does not authorise:

- Growing Tortoise
- another mascot species
- happy/proud/rest reactions
- progression changes
- XP/reward changes
- evolution changes
- fitness truth changes
- Journey/GPS changes
- health-data changes
- new social behaviour
- audio
- background art

## Stop condition

**STOP after producing the clean candidate asset and evidence.**

The next status must be one of:

- **READY FOR HUMAN ASSET REVIEW**
- **ASSET REJECTED — REGENERATION/CONVERSION REQUIRED**

Only explicit human approval advances the candidate into the runtime replacement
slice.
