# NinFit page backgrounds

Production artwork for the world layer. One folder per region, named for its
`BackdropId` in `src/ui/backgrounds/registry.ts`.

## Why these live in `public/` and not `src/assets/`

They are referenced by URL from the registry and never `import`ed. That is
deliberate:

- an `import` puts every region's artwork into the module graph, and gives the
  bundler a reason to preload scenery for fifteen places the user is not standing
  in;
- a URL means the browser fetches exactly the one backdrop on screen, caches it
  normally, and the JavaScript bundle does not grow by a single byte.

`src/assets/` holds artwork that genuinely is part of the component tree — mascots,
trophies, reward and item icons.

## Current status

**No production background artwork exists yet.** Every region currently renders the
placeholder wash built from existing theme tokens (see
`src/styles/components/backdrop.css`). This is a normal state, not a broken one:
nothing is fetched, nothing is missing, and no unrelated image stands in for art
that has not been drawn.

The concept sheet in `docs/brand/reference/ninfit-page-backgrounds-concept-v1.png`
is **reference only**. Each tile on it is roughly 384×256 with its title and icon
burned into the image, so it cannot be cropped into production assets: the
resolution is far below what a phone backdrop needs, and text inside artwork cannot
be translated, themed, or read by a screen reader.

## What each region needs

Two files per region, then set `art` on that region's registry entry:

| File | Size | Notes |
|---|---|---|
| `<id>-mobile.webp` | 1080 × 1920 | Portrait. Focal point per the registry. |
| `<id>-desktop.webp` | 2880 × 1620 | Landscape, 16:9. Sides may be quiet — the content column covers the middle 720px. |

Guidelines:

- **No text in the image.** Titles, straplines and icons are rendered by the app.
- **No mascot in the backdrop.** Opal is a foreground character with her own
  presentation rules; baking her into scenery fixes her pose and stage forever.
- **Keep the focal band clear.** The registry's `focal` point is the part that must
  survive cropping on a narrow screen.
- **Quiet where the content sits.** The middle third carries cards. Detail belongs
  around the edges.
- **WebP, under ~250 kB each.** Provide AVIF too if convenient.
- **No path colours.** A backdrop says which region you are in; the accent says
  which fitness path you chose. Scenery tinted like a path would fight it.

Regions, and the atmosphere each one is briefed for, are listed with their focal
points and veil strengths in `src/ui/backgrounds/registry.ts` — that file is the
source of truth, not this README.
