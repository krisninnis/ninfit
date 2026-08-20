# NinFit Visual Asset Pipeline

## Purpose

Use this skill whenever generated artwork is about to become something the
application loads: mascots, backgrounds, environments, trophies, emblems,
cosmetics, effects or event art.

It exists to keep a generated image and a production asset firmly apart.

`docs/ROADMAP.md` phases 12 and 12A own the wider art direction. This skill is
the operating procedure.

## The core rule

**AI-generated artwork is source and reference material until a human has
reviewed it. Reviewed artwork becomes a canonical asset with a stable identity.
Only canonical assets are wired into runtime code.**

Reference material lives in `docs/`. Production art is served from `public/`.
Artwork existing is not a product decision.

## Never

- wire raw generated filenames into runtime code
- generate every mascot family blindly before one is proven
- reshape architecture to accommodate an asset
- bake UI, text, numbers or stats into decorative artwork
- ship unreviewed generated art
- scatter image URLs through screen components
- add a character to the path system because art for it happens to exist

## Pipeline

```
idea / brief
  ↓
generated source
  ↓
human visual approval
  ↓
canonical asset identity
  ↓
controlled conversion / crop
  ↓
performance check
  ↓
accessibility check
  ↓
preview in the real UI
  ↓
production asset
```

Do not skip the "preview in the real UI" step. An asset that reads well as a
file can still fail behind a card at 360px.

Each canonical asset should carry: a stable ID, category, intended use, light and
dark requirements, responsive requirements, and rarity plus unlock source where
applicable.

## Backgrounds — current production contract

- one central registry (`src/ui/backgrounds/registry.ts`); a screen names a
  region, never a file
- the registry is the only place a URL, focal point or veil strength is decided
- mobile 1080 × 1920, desktop 2880 × 1620
- target ≤ 250 KB per WebP
- every region declares a focal point so cropping is intentional
- decorative only, `aria-hidden`, never the sole source of meaning
- the contrast veil is part of the primitive, not a per-screen decision
- lazy loaded; nothing preloads regions the user is not standing in
- reduced-data aware

A region without art degrades to a token-derived wash. That is the intended
behaviour — no unrelated stock image ever stands in for missing art.

The 17-region production background set is complete. Do not regenerate it
without an explicit reason.

## Mascots

- prove one complete path mascot family end to end before generating the other
  four
- hold silhouette, eye style, proportions, lighting and rendering language
  constant across a family
- canonical sheets include the required poses and reactions, plus pickup/drag
  and settle poses for path mascots
- Opal stays visually and architecturally distinct from the five path families
  (see `ninfit-product-guardrails`)

Placeholder art in the codebase — code-drawn eggs, single-letter glyphs — is
marked temporary on purpose. Replace it; do not refine it.

## Accessibility and performance checks

Before an asset is production:

- text over it meets contrast in light and dark, with the veil applied
- it survives cropping to the declared focal point at every supported width
- it is within the size budget
- it does not become the only carrier of any meaning
- reduced motion is respected if it animates
