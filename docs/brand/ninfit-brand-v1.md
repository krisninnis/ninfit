# NinFit brand — Variant 1

Version 1, **locked**. Reconstructed as deterministic vector geometry from the approved
Variant 1 reference board, then refined through an A/B/C review of the diagonal weight
and a wordmark weight pass. This document is the specification; the SVGs in
`src/assets/brand/` are the masters.

Every asset — SVG, app icon, and all seven PNG sizes — is generated from one
construction by `.verify/brand/build_brand.py`. Nothing is drawn twice, so the 16px
favicon is the same shape as the 1024px store icon rather than a redrawing of it.

The production masters were verified path-for-path against the reviewed and approved
candidates: the mark matches review candidate B exactly, and the wordmark matches the
approved refined version exactly.

---

## 1. Canonical monogram

The NF is drawn on a **148 × 100** grid. Height is the unit of reference.

| Element | Value | Notes |
|---|---|---|
| Mark box | 148 × 100 | aspect 1.48 |
| Stem weight `S` | 18 | both verticals, and the clear-space unit |
| Shared stem | x 76 → 94 | the N's right stroke **is** the F's stem |
| Diagonal weight | 20.70 | perpendicular, **1.15 × `S`** (locked candidate B) |
| Diagonal angle | 30.1° from vertical | from the left stem's top to the shared stem's foot |
| Outer corner radius | 6 | soft outside, sharp inside |
| Arm sweep | 11 | angled cut on the outer end of each F arm |
| Top arm | to x 148 | the long one |
| Middle arm | to x 126 | the short one, top edge at y 44 |
| Diagonal horizontal thickness | 23.93 | at 30.1° |
| Diagonal reaches the F stem at | y 58.7 | the N → F join |
| Accent stripe | y 43.7 → 73.7 | a 30-unit slice of the diagonal, centred on the join |
| Seam overlap | 0.5 | shared edges overlap so they cannot antialias to a hairline |

**Construction.** The N is dominant: a full-height left stem, a full-height diagonal,
and a full-height right stem. The F is integrated rather than adjacent — it has no
stem of its own, it borrows the N's right vertical. Two arms spring from that shared
stem: a long one at the cap line and a shorter one at mid-height, each cut at an angle
on its outer end so the silhouette stays upright while the inner detail stays dynamic.

**The accent** is a 30-unit slice of the diagonal itself, cut by two horizontal lines
centred on the point where the diagonal reaches the F stem. It is *derived*, never
placed: it sits on the diagonal by construction, so it cannot drift out of register,
and changing the diagonal's weight moves the stripe to match automatically.

---

## 2. Wordmark

**NinFit** — capital N, capital F, everything else lowercase.

Advance 341 units at cap height 100 (aspect 3.41). **Stroke weight 18 — exactly
0.18 × cap, the same stem-to-height ratio as the monogram**, which is what makes the
wordmark sit as an equal beside the mark rather than looking lighter than it. X-height
74, n shoulder 33, i dot radius 10.

Sidebearings are **per-pair**, not uniform: `N|i 10, i|n 10, n|F 13, F|i 6, i|t 8`. The
F's overhanging top arm and the t's overhanging crossbar need less space in front of
them than any other pair, and one gap value cannot express that.

Built from the same vocabulary as the monogram: the N repeats the monogram's two
stems and full-height diagonal, and the F repeats the long-arm/short-arm pair with the
same swept cuts. **Both lowercase i dots are Opal Green.**

**No font is embedded, referenced or required.** Every glyph is explicit path
geometry, so there is no licence to honour, no webfont to ship and no rendering
difference between machines.

---

## 3. App icon

Rounded square, 1024 × 1024, corner radius 224. Deep Ink field, white NF, Opal Green
transition. The mark occupies 64% of the canvas width and is optically centred, which
leaves enough margin to survive both iOS's superellipse and Android's adaptive-icon
mask. No text. No baked-in drop shadow.

---

## 4. Colour

| Name | Hex | RGB | Role |
|---|---|---|---|
| Deep Ink | `#0A1020` | 10, 16, 32 | primary; icon field, mark on light |
| Opal Green | `#00E0B5` | 0, 224, 181 | accent; the NF transition and the i dots |
| Opal Deep | `#00B89A` | 0, 184, 154 | the dark end of the accent gradient only |
| Mist | `#E6E9EE` | 230, 233, 238 | light neutral background |
| White | `#FFFFFF` | 255, 255, 255 | mark on dark |

**Accent gradient:** `#00B89A → #00E0B5`, applied only across the NF transition
stripe. The logo as a whole is never a gradient.

**The master brand palette is Deep Ink + Opal Green. The five fitness-path colours are
a separate system and must never recolour the corporate logo** — a Build Strength user
does not get a terracotta NF.

---

## 5. Clear space

> **x = the stem weight = 0.18 × mark height.**
>
> Keep at least **x** clear on all four sides of the mark or the wordmark.

Derived from the geometry rather than picked, so it scales automatically: at a 100px
mark the clear space is 18px; at 24px it is 4.3px.

---

## 6. Minimum sizes

| Asset | Minimum | Why |
|---|---|---|
| Mark, with accent | 24px high | below this the stripe falls under 2px |
| Mark, monochrome | 16px high | no accent to lose |
| App icon | 16px | uses the simplified master (see §7) |
| Wordmark | 96px wide | keeps the i dots above 2px |

---

## 7. Small-size optical correction

Below 48px the accent stripe is narrower than one pixel and antialiases into a grey
smudge that muddies exactly the join it is meant to celebrate. **The 16px and 32px
favicons therefore render `ninfit-app-icon-small.svg`: identical geometry, accent
omitted.**

This is the only place any asset differs, and it is a subtraction rather than a
redrawing. The mark is still the mark; it stops trying to show a detail the pixel grid
cannot hold.

---

## 8. Usage

**On light backgrounds** — `ninfit-mark-light.svg`, Deep Ink mark with the Opal accent.
White and Mist are both approved fields.

**On dark backgrounds** — `ninfit-mark-dark.svg`, white mark with the Opal accent.
Deep Ink is the reference field.

**Monochrome and one-colour print** — `ninfit-mark-mono-black.svg` and
`ninfit-mark-mono-white.svg`. Recognition never depends on the accent: the NF is
fully legible as a single solid colour, which is what the mono masters prove.

---

## 9. Forbidden

- Stretching, squashing or rotating
- Recolouring with any fitness-path colour
- Using the attention amber
- Introducing red anywhere
- Adding mascot or egg imagery inside the logo
- Glow, bevel, or a drop shadow as part of the canonical geometry
- Arbitrary gradients, or gradients across the whole mark
- Changing the F's arm proportions, or the long/short relationship
- Separating the N and the F, or giving the F its own stem
- Reconstructing the mark from a screenshot of the reference board

---

## 10. Accessibility

| Pairing | Ratio |
|---|---|
| White mark on Deep Ink | 18.96:1 |
| Deep Ink mark on white | 18.96:1 |
| Deep Ink mark on Mist | 15.57:1 |
| Opal accent on Deep Ink | 11.13:1 |
| Opal accent against a white mark | 1.70:1 |

That last row is the one to respect: **Opal Green must never sit directly on white.**
Inside the mark it never does — the stripe is enclosed by the mark's own strokes above
and below — but the accent must not be lifted out and used as a standalone element on
a light field.

In greyscale the accent sits at Y = 0.57 against Deep Ink at 0.005 and white at 1.0, so
it stays visible as a tonal step rather than disappearing when hue is removed.

---

## 11. Departures from the reference board

The reference is an AI-generated raster and carries generation artefacts that cannot
be reproduced consistently. Each departure below is deliberate.

1. **Diagonal weight.** The reference's diagonal measures roughly 1.37 × the stem
   weight. Set to **1.15 ×** after a side-by-side review of 1.06 / 1.15 / 1.20 at hero
   size, at 64px and as an app icon — heavy enough to keep the diagonal's energy,
   light enough not to crowd the N's counter where it passes the middle arm.
2. **Accent definition.** The reference's accent has no self-consistent geometric
   definition — measured across its height it implies a band of near-zero thickness,
   which is impossible. It is redefined as a 30-unit slice of the diagonal centred on
   the N → F join. Visually equivalent, and reproducible.
3. **Accent position.** Follows from the derivation rather than from the reference. An
   earlier draft hardcoded it to y 46–64, which sat on the stem but *not* on the
   diagonal, since the diagonal does not reach the stem until y 58.7; it only looked
   correct. Taking the literal diagonal ∩ stem intersection instead is registered but
   renders as a triangular wedge in the bottom corner. The slice is both.
4. **Corner treatment.** The reference softens corners inconsistently. Here, outer
   corners take a uniform 6-unit radius and inner corners stay sharp, per the approved
   direction.
5. **Wordmark.** Reconstructed rather than traced. The reference's letterforms are
   font-like but not internally consistent; these are built from the monogram's own
   stem weight and swept cuts, at 0.18 × cap so the two sit as equals.
6. **No background effects.** The reference board renders the icon with a soft
   gradient field and ambient glow. The canonical icon is flat Deep Ink — glow is a
   presentation choice, not part of the mark.
