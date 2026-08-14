# Visual design briefing

**Status:** audit and proposal. No source file has been changed.
**Direction:** premium fitness app normally, more colourful and game-like around
rewards, mascots, trophies and evolution moments.
**Measured against:** `src/styles.css` as it stands - 1,619 lines, 217 class rules,
34 custom properties, one file.

---

## 1. What the current UI and CSS already get right

Worth stating plainly, because the refactor should preserve all of it.

- **The token layer exists and is genuinely used.** 34 custom properties cover colour,
  spacing, radius, type, shadow and tap size. Radius tokens are used 35 times against
  only two escapees. Spacing tokens are used throughout.
- **Dark mode is complete, not bolted on.** Every semantic colour has a dark value, and
  `color-scheme: light dark` is declared, so form controls and scrollbars follow.
- **Reduced motion is handled globally and correctly.** One rule drops every animation
  and transition to 0.01ms, so all three keyframe animations are covered without any
  component needing to know.
- **The palette contains no red at all.** That was a deliberate constraint and it has
  held for seven steps. Incompleteness cannot read as failure because the colour that
  would let it does not exist in the file.
- **Amber is reserved.** One attention colour, used only for recorded symptom changes.
- **Contrast is largely sound.** Measured: body text 13.1:1 light and 14.4:1 dark;
  muted text 5.05:1; accent on background 4.84:1. All pass AA.
- **Tap targets are respected in principle.** `--ft-tap-min: 56px` exists and controls
  generally meet 44px+.
- **One font family, no external dependency.** A system stack, loading instantly.
- **Safe areas are handled** at the top of the scroll container and the bottom of the
  tab bar.

This is a better starting point than most prototypes. The work below is refinement,
not rescue.

## 2. Current visual inconsistencies

Every item here was measured, not guessed.

**Colour**

- **8 hardcoded hex values outside the token blocks**, all of them the trophy tiers
  (`.tier--bronze` and friends, plus their dark-mode overrides). These are the only
  colours in the file that cannot be themed, and they are the ones most likely to
  change when the game layer gets its visual pass.
- **`--ft-text-faint` fails AA on the page background** at 2.79:1. It is used for
  timestamps, sample counts, footnotes and the "Not recorded" state. Currently
  acceptable only because those are all supplementary, but it is the weakest point in
  the palette and should be lifted.
- **`--ft-flag` and a future Build Strength accent will collide.** Both are amber. See
  section 5; this needs a decision.

**Spacing and sizing**

- **Five different interactive heights**: `--ft-tap-min` (56px), 48px, 44px, 52px and
  60px, all hand-written. There is no reason for five. It reads as three intended
  sizes that drifted.
- **~50 raw pixel values.** Most are legitimate (1px borders, 20px icons), but the
  interactive heights and several paddings bypass the scale.
- **No spacing step above 32px**, so the larger rhythms in onboarding and reward
  moments have nowhere to go.

**Radius**

- Four tokens, plus `9px` on the toggle box and three `50%` circles. The `9px` is
  arbitrary; the circles are legitimate but should be a token.

**Depth**

- **Only two shadow tokens** (`card`, `bar`), so every card in the app has identical
  depth. There is currently no visual difference between a tracking card, an action
  card and a reward card - which is exactly the distinction the product direction asks
  for.

**Structure**

- **The card recipe is duplicated.** `.card` and `.weekday` repeat the same five
  declarations independently. `.activity`, `.notelist__item`, `.issues__item`,
  `.step__path` and `.confirm` are each an ad-hoc "sunken card" with slightly different
  padding and radius.
- **`.statrow` and `.stat` are two different stat presentations** that arrived in
  different steps and now sit on the same screens.
- **Screen-specific rules are interleaved with primitives** in one 1,619-line file.
  Finding "everything that affects the Week screen" means scrolling.

**Responsiveness**

- **Only three media queries, none of them width-based.** The entire responsive story
  is `max-width: 560px` on `.app`. On a tablet or desktop the app is a narrow column
  on a large empty field, with no use of the space and no adjustment to type or
  spacing.

**Typography**

- **Three line-heights and three font-weights across the whole app.** The type scale
  has seven sizes but no paired line-heights, so vertical rhythm is set per-rule.
- **No display treatment.** A level number, a stat value and a screen title are all the
  same family at the same tracking. Nothing signals "this is the moment".
- `font-variant-numeric: tabular-nums` is applied ad hoc in six places rather than
  being a typographic role.

---

## 3. Recommended design identity

**One sentence:** a calm, warm, grown-up fitness journal that briefly lights up when
you have earned something.

Three registers, and the rule that governs which applies:

| Register | Where | Treatment |
|---|---|---|
| **Quiet** | Tracking, symptoms, measurements, Data | Neutral surfaces, one accent for state only, flat-to-subtle depth, no motion beyond 120ms feedback |
| **Warm** | Today's plan, Week, Progress, level and XP | Accent used structurally, raised cards, 220ms transitions, small satisfying feedback |
| **Bright** | Hatch, evolution, Gold and Platinum trophies, milestones | Full accent colour, gradient and glow, layered depth, 400-900ms choreography |

**The governing rule:** the intensity of the visual treatment is proportional to how
rare the moment is. Logging water is not rare. Hatching is.

The mascot is the only element allowed to carry personality on a normal screen, and
it does so at small size. Everything else earns its colour.

---

## 4. Colour system

### 4.1 Three layers, not one

The current file has semantic tokens sitting directly on hex values. Recommend
inserting a palette layer beneath them:

```
palette tokens      raw ramps, never used by a component
   |                --palette-sage-10 ... --palette-sage-90
semantic tokens     what a component asks for
   |                --surface, --text, --border, --accent
component tokens    local overrides where a component genuinely differs
                    --card-bg, --card-shadow
```

The benefit is concrete: five path accents times light and dark times five roles each
is 50 values. Generated from ramps, that is five ramp definitions. Hand-written, it is
50 chances to get one wrong.

### 4.2 Use OKLCH for the ramps

Recommend defining palette ramps in `oklch()`. Two reasons that matter here, not
fashion:

1. **Perceptually even lightness.** An OKLCH ramp at fixed lightness has genuinely
   equal apparent brightness across hues, so mint at L=55 and indigo at L=55 read as
   the same weight. In hex or HSL they do not, which is why hand-picked multi-hue
   palettes always have one colour that looks heavier than the rest.
2. **Predictable dark-mode pairs.** A dark variant is the same hue and chroma at a
   different lightness, rather than a fresh guess.

Combined with `color-mix()` for the soft tints, this removes every reason a
preprocessor would have been needed for colour work. Browser support for both is
universal in current releases.

### 4.3 Semantic token set

Grouped by role, with the current gaps filled:

**Surfaces** - `--surface-page`, `--surface-raised`, `--surface-sunken`,
`--surface-overlay` (new, for confirm dialogs and future modals), `--surface-inverse`
(new, for the reward register).

**Text** - `--text-primary`, `--text-secondary`, `--text-tertiary` (renamed from
"faint" and **lifted to at least 4.5:1**), `--text-on-accent`, `--text-disabled` (new,
currently borrowed from faint).

**Lines** - `--border-subtle`, `--border-strong`, `--divider` (new; currently
`--ft-border` is doing double duty as both card edge and list divider, which is why
`.statrow` borders look heavier than intended).

**Accent** - `--accent`, `--accent-strong`, `--accent-soft`, `--accent-ring` (new, for
focus), `--on-accent`.

**Attention** - `--attention`, `--attention-soft`. Reserved for recorded symptom
changes. **Never used for incompleteness, and never as a path accent.**

**Still no red, and no error colour.** Persistence failures and import problems use
`--attention` plus explicit wording. This has worked for seven steps and should be
written into the token file as a comment so nobody adds one later.

### 4.4 Trophy tiers

Move the eight hardcoded values into tokens, and give each tier three:
`--tier-{name}-base`, `--tier-{name}-sheen`, `--tier-{name}-ink`.

Metallic treatment comes from a two-stop linear gradient between base and sheen at
about 145deg, plus a 1px rim in a slightly darker base. That reads as metal at 20px
without any image asset.

Measured contrast on the current chips is fine (5.17 to 6.37:1). Preserve those ink
values when converting.

**Tier must never be carried by colour alone.** It currently is not - the chip prints
the tier name - and that should be locked in: name, or an icon with an accessible
label, on every tier presentation including the future Trophy Room.

---

## 5. Path accent strategy

The proposed families are a good instinct. Three problems need resolving before they
are implemented.

### Problem 1: Build Strength collides with the attention colour

Burnt orange/amber is the same family as `--ft-flag`, which is reserved for "toe
sensation recorded as worse". On the Build Strength path, the app's own accent would
be the colour that elsewhere means "a symptom changed". That is a genuine safety-of-
meaning problem, not a taste one.

**Recommended resolution:** move Build Strength to a **deep terracotta / rust** -
noticeably lower lightness and lower chroma than the attention amber - and separately
tighten the attention treatment so it is always a chip with an icon, never a bare
colour. Two changes, and the collision stops mattering.

### Problem 2: three of the five hues are adjacent

Mint green, teal/turquoise and energetic blue sit close together. Under deuteranopia
(the most common form, ~6% of men), mint and teal become very hard to separate.

**Recommended resolution:** separate the five on **two axes, not one**. Keep the hue
families, but give each path a distinct lightness and chroma signature so they differ
even in greyscale:

| Path | Hue family | Relative lightness | Relative chroma |
|---|---|---|---|
| Start Moving | warm green, pushed yellow | lightest | low - it is the calm path |
| Build Strength | terracotta / rust | dark | medium |
| Build Stamina | blue, pushed cyan | mid | high - the energetic one |
| Balanced Fitness | teal, pushed green-blue | mid-light | medium |
| Return to Fitness | indigo | darkest | medium |

Verify with a greyscale render: if two paths are indistinguishable with colour
removed, the pair has failed.

### Problem 3: accent as the only signal

**Recommended rule, and the most important one in this section:** the path accent is
**decoration and active-state emphasis only**. It never carries meaning by itself.
Every place a path appears - onboarding alternatives, Profile, a future path switcher
- prints the path name. The core app stays neutral; only the accent token changes.

### Implementation

One attribute on the app root, set from `GameState.pathId`:

```
<div class="app" data-path="build_stamina">
```

with `[data-path='build_stamina'] { --accent: ...; --accent-soft: ...; }`. Every
component already consumes `--accent`, so **no component CSS changes at all** to
support five paths. This is the single highest-leverage decision in the document.

**Where the accent may be used:** active nav item, XP bar fill, primary buttons,
selected option borders, sparkline stroke, focus ring.
**Where it may not:** body text, tracking card backgrounds, chart gridlines, anything
on the Data screen, anything conveying a symptom.

---

## 6. Typography

**System stack is sufficient for body text and should stay.** It loads instantly, it
is what the OS renders best, and on a personal daily-use app the loading cost of a
webfont is a real tax for a small gain.

**Add a display role, not a display font.** The distinctive treatment comes from
tracking, weight and size rather than a second family:

| Role | Size | Weight | Line height | Tracking | Notes |
|---|---|---|---|---|---|
| Display | 2.25rem | 700 | 1.1 | -0.03em | Reward moments, level-up, hatch only |
| Title | 1.75rem | 600 | 1.2 | -0.02em | Screen titles |
| Heading | 1.25rem | 600 | 1.3 | -0.01em | Card and section headings |
| Body | 1rem | 400 | 1.5 | 0 | Default |
| Body strong | 1rem | 500 | 1.5 | 0 | Labels |
| Small | 0.875rem | 400 | 1.45 | 0 | Supporting text |
| Caption | 0.75rem | 500 | 1.4 | 0.01em | Chips, units, counts |
| Stat | 1.5rem | 600 | 1.1 | -0.02em | **tabular-nums**, for any changing number |

Two things this fixes: every size gets a paired line-height token (so vertical rhythm
stops being per-rule), and `tabular-nums` becomes a typographic role rather than six
scattered declarations. Numbers that change - XP, steps, weight - must not reflow
their neighbours as digits change width.

**Optional future work, not now:** one variable display face for headings and reward
moments only, self-hosted, subset, `font-display: swap`, body text untouched. It would
sharpen the brand meaningfully. It is not needed to reach "polished".

---

## 7. Spacing scale

Keep the existing names, fill the gaps at both ends:

| Token | Value | Typical use |
|---|---|---|
| `--space-0` | 2px | Icon nudges, chip inner |
| `--space-1` | 4px | Tight label/value pairs |
| `--space-2` | 8px | Within a control |
| `--space-3` | 12px | Between related controls |
| `--space-4` | 16px | Card padding, default gap |
| `--space-5` | 24px | Between cards |
| `--space-6` | 32px | Between sections |
| `--space-7` | 48px | Screen top/bottom, onboarding rhythm |
| `--space-8` | 64px | Reward moments, empty states |

**Applied rules:**

- Screen gutters: 16px at 390px, 24px from 600px, 32px from 900px.
- Card padding: 16px tracking, 20px action, 24px reward.
- Between cards: 12px in a list, 24px between sections.
- **Tap target minimum 44px, standard control height 48px, primary action 56px.**
  Three sizes, tokenised, replacing the current five hand-written ones.
- Max content width: 560px phone-to-tablet, 720px from 900px. Not wider - a fitness
  journal read at arm's length gets worse past ~75 characters.
- Bottom nav: content padding must reserve nav height plus
  `env(safe-area-inset-bottom)`. **Also add left/right insets**, currently missing, for
  landscape on notched phones.

## 8. Radius scale

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 8px | Chips, inline tags, small inputs |
| `--radius-md` | 12px | Controls, list items, sunken panels |
| `--radius-lg` | 18px | Cards |
| `--radius-xl` | 24px | Reward cards, onboarding panels, modals |
| `--radius-pill` | 999px | Bars, chips, stepper |
| `--radius-circle` | 50% | Avatars, mascot frame, dots |

Five plus a circle. This absorbs the `9px` escapee and the three bare `50%` values.
`--radius-xl` is new and exists specifically so reward surfaces can differ from
tracking surfaces without inventing a value at the call site.

## 9. Shadow and depth scale

Currently two tokens. Recommend five, since depth is one of the two main tools for
separating the registers.

| Token | Elevation | Where |
|---|---|---|
| `--shadow-none` | flat | Sunken panels, list items inside cards |
| `--shadow-card` | 1 | Tracking cards - barely there, current value |
| `--shadow-raised` | 2 | Action cards, today's plan, primary buttons |
| `--shadow-reward` | 3 | Reward cards, trophy tiles, hatch panel |
| `--shadow-overlay` | 4 | Confirm dialogs, future modals |

**Dark mode does not get shadows.** Shadow is nearly invisible on a dark surface and
tends to muddy it. Depth in dark mode comes from surface lightness stepping instead -
each elevation is a slightly lighter surface. The current file already zeroes
`--ft-shadow-card` in dark mode, which is the right instinct; formalise it as the rule.

The reward level may add a soft accent-tinted glow (`0 0 24px accent/18%`). That is the
only place glow is permitted.

## 10. Motion scale

| Token | Duration | Easing | Use |
|---|---|---|---|
| `--motion-instant` | 120ms | ease-out | Press feedback, toggle, focus ring |
| `--motion-standard` | 220ms | cubic-bezier(.2,0,0,1) | Section expand, tab change, bar fill |
| `--motion-reward` | 420ms | cubic-bezier(.2,.8,.2,1) | XP pop, badge, mascot reaction |
| `--motion-cinematic` | 900ms | multi-stage | Hatch, evolution, Gold, Platinum |

**Hierarchy rule:** normal navigation stays at instant or standard. Reward is a
noticeable but short beat. Cinematic is choreographed, happens a handful of times per
year, and is the only tier allowed to hold attention.

Every tier remains inside the existing global reduced-motion rule, which already
neutralises all of it. For cinematic moments, reduced motion should still show the
**outcome** - a cross-fade to the hatched mascot rather than nothing at all. An
animation being suppressed must never mean the user misses the event.

**No animation library.** The four tiers above are CSS transitions and keyframes.
Revisit only if a genuinely choreographed multi-element hatch sequence proves
unmanageable, and even then consider a single Lottie file for that one moment rather
than a library for the whole app.

## 11. Light / dark token strategy

Recommend a three-way switch that the current structure supports with one addition:

```
:root                          light values (default)
@media (prefers-color-scheme: dark)   dark values, when no explicit choice
[data-theme='light']           forced light
[data-theme='dark']            forced dark
```

Setting `data-theme` on the root element lets a future Settings offer System / Light /
Dark **without touching a single component**. Until that setting exists, the attribute
is simply absent and behaviour is exactly as today.

Rules to hold to:

- No component may hardcode a colour. The trophy tiers are the current exception and
  should be fixed in the first phase.
- `color-scheme` must stay declared so native controls, the date picker and scrollbars
  follow the theme.
- Dark elevation is surface lightness, not shadow.
- Path accents need a dark variant each - typically higher lightness, slightly lower
  chroma, since saturated colour on dark reads as glowing.
- Every accent needs contrast verification **in both themes**. Measured now:
  accent-on-background is 4.84:1 light and 7.91:1 dark. That gap is normal and fine;
  what matters is that neither drops below 4.5:1 for text or 3:1 for a boundary.

---

## 12. Onboarding screen design

The highest-value screen for perceived quality, because it is the first thing seen.

**Vertical structure at 390px:**

```
  safe area
  egg              72px, centred, persistent across every stage
  progress bar     4px, full width, accent fill
  ~24px
  question         Title size, max two lines, left aligned
  supporting text  Small, secondary, one line where possible
  ~24px
  options          full-width cards, 60px tall, 12px gap
  flex spacer      pushes navigation down
  Back | Continue  Back auto-width, Continue fills remainder, 56px
  safe area
```

Five options at 60px plus gaps is 348px; with the header around 200px, a five-option
question fits 390x780 without scrolling. Six or more options scroll, which is
acceptable and rare.

**The egg.** Small, quiet, always in the same place. It is a narrative thread rather
than a feature: the same object travels the whole flow and then follows the user into
Today. It must not gain colour, shape or detail that hints at the animal - a gentle
scale or opacity shift between stages is the limit.

**Option cards.** Full width, generous padding, name plus tick. Selection is carried by
**border weight, background tint and a tick mark** - three signals, so colour alone is
never load-bearing. A pressed state at 120ms.

**Background.** Two fixed radial gradients on a pseudo-element behind the content,
driven by a single custom property:

```
.step { --energy: 0; }        /* welcome */
.step { --energy: 0.6; }      /* mid-flow */
.step { --energy: 1; }        /* recommendation */
```

with the gradients' alpha and blur interpolated from `--energy` and the whole thing
transitioned at `--motion-standard`. That gives the "gradually gains energy" effect in
about fifteen lines of plain CSS, with no JavaScript animation and no library.

**Critical constraint:** `--energy` may change **saturation and brightness only, never
hue**, before the recommendation stage. If the background drifted toward the path's
hue mid-flow it would spoil both the recommendation and the egg. At the recommendation
stage the accent may finally appear, because the path is being named on that screen
anyway. The mascot stays secret regardless.

**Responsive.**

- Small Android (360px): options 56px, gutters 12px.
- Standard phone (390-430px): as specified.
- Tablet (768px+): centred column at 480px, egg 96px, more vertical breathing room.
- Desktop (1024px+): same centred column, background gradient allowed to spread wider.
  Do not go two-column - one question per screen is the whole point.

## 13. Today redesign

Order, matching the agreed hierarchy:

1. **Mascot / egg + level + XP** - one card, mascot ~64px on the left, level and XP bar
   right. Currently 84px, which is slightly too much; the plan should be first by
   weight even though the mascot is first by position.
2. **Mascot message** - one line, secondary text, inside the same card. Absent entirely
   on Quiet personality, which should collapse the space rather than leave a gap.
3. **Today's plan** - the **action card**: raised shadow, 20px padding, larger heading,
   activity rows with generous tap targets, the video link as a full-width accent
   button. This is the most important element on the screen and should look it.
4. **Quick check-in** - only when data exists. See below.
5. **Tracking cards** - collapsible, quiet register.
6. **Footer** - completion line and the standing disclaimer, tertiary text.

**Quick check-in.** Not a row of tiny numbers. A single horizontally scrollable strip
of chips, each ~44px tall, one metric per chip:

```
[ Energy 7 ]  [ Water 4 ]  [ Steps 3,200 ]  [ Back 4 ]
```

Each chip is a button that expands the matching tracking card and moves focus into it,
so the strip is a shortcut rather than a readout. Chips appear only for metrics that
have a value, so an empty day shows no strip at all rather than four dashes.

**Tracking cards.**

- **Default open:** Exercise (how it went), Back and symptoms. These are the ones tied
  to today's session.
- **Default collapsed:** Food, Water, Sleep and recovery.
- **Header:** icon, name, and a summary of what is recorded when collapsed
  (`Water - 4 glasses`), chevron right-aligned. The whole header is the tap target at
  48px minimum.
- **A card with data gets a subtle filled dot** beside its name - not a tick, which
  would imply a target, and not a colour change, which would fail colour-independence.
- Editing state is the card being open. No separate edit mode.

## 14. Week redesign

Keep the vertical day cards exactly as they are - they are the substance of the screen
and they work.

**Journey trail (design only, not to build yet).** A slim horizontal band above the
cards, roughly 72px tall:

- Seven nodes on a track, evenly spaced.
- **State by shape and fill, not colour:** complete = filled circle with tick, partial
  = half-filled ring, not-yet = hollow ring, rest = a small diamond, future = hollow
  ring at reduced opacity.
- Today marked by a ring around the node plus the egg or mascot sitting on it at
  ~28px.
- The connecting track fills up to the current day in accent.
- Tapping a node scrolls to that day's card.

It must stay visually lighter than the cards below it - no shadow, no card background,
just the track on the page surface. If it starts competing with the records, it has
failed.

## 15. Progress redesign

Order: factual metrics, then milestones, then trophies. Trophies must not compete with
health data.

**Chart cards.** Quiet register. Label and current value as a stat, sparkline below,
first and last date beneath at caption size. Accent stroke, 2px, round caps. Dots at
every real reading - this is already the behaviour and it should be preserved because
it is what makes gaps visible. Grid lines: at most one, at the midpoint, at
`--border-subtle`. No axis boxes.

**Empty states.** A chart with no data shows a dashed baseline and "No readings
recorded" at tertiary text, in the same card at the same height. Cards must not resize
when data arrives, or the screen jumps as the week fills in.

**Milestones** - a compact list: personal bests, longest streak of *turning up* (never
framed as a streak to protect), first time at each level.

**Trophies on Progress** - the three most recent as small tiles in a single row, with a
link through to the future Trophy Room. Not the full collection.

## 16. Profile redesign

Group into four clear sections with a visible heading each:

1. **You** - name, birth year, sex, height, units.
2. **Your programme** - start date, path, current stage.
3. **Where you started** - baseline. Presented as a historical record, with a plain
   line saying so.
4. **Your notes** - self-reported health context.
5. **Game** - mascot personality, sound, haptics, social, challenges, trophies.

**The health notes must not look like a medical record.** Concretely: no monospace, no
table, no clinical iconography, no coded labels, no red or blue. They should look like
notes in a journal - the sunken panel treatment already used, plain sentence-case text,
the user's own words, with the "self-reported" line kept visible.

## 17. Data redesign

**The least game-like screen in the app, deliberately.** Rules:

- Quiet register throughout. No accent-filled buttons except the primary export.
- No celebratory feedback on export success - a plain confirmation line is right.
- The destructive path (import/replace) uses the **attention** treatment, not a red or
  alarming one: amber-tinted panel, clear wording, two clearly differentiated buttons
  with the safe option first.
- Storage issues use the same attention treatment. Never alarming, never technical.
- Privacy text at caption size, tertiary colour, always visible rather than hidden
  behind a disclosure.

If the Data screen ever looks fun, something has gone wrong.

## 18. Bottom navigation

Keep icons plus short labels - correct for five destinations.

**Active state carried by four signals, not one:** filled icon variant (vs outline),
accent colour, a 3px indicator bar at the top edge of the item, and label weight 600 vs
500. Three of the four survive greyscale.

**Inline SVG icons, no dependency.** Already the case, and it should stay: five icons
in two variants each is ten small paths, and an icon library would add weight and a
supply-chain surface for something already solved. If the set grows past ~20, revisit.

Height 56px plus `env(safe-area-inset-bottom)`. Each item at least 44px wide - at 390px
five items give 78px each, comfortably clear.

**Not a HUD.** No XP bar, no level badge, no notification dots in the nav. The game
lives on Today.

## 19. Reward styling

| Moment | Register | Motion | Treatment |
|---|---|---|---|
| Activity ticked | Quiet | instant | Tick draws in, row settles |
| XP granted | Warm | reward | `+20 XP` chip rises and fades, mascot bobs once |
| Section completed | Warm | reward | Subtle sparkle behind the card heading |
| Bronze / Silver trophy | Warm | reward | Tile scales in with tier sheen sweeping once |
| Level up | Bright | reward | XP bar fills, overfills, resets at new level; number counts up |
| **Egg hatch** | Bright | cinematic | Full-width takeover, egg rocks, cracks, light burst, mascot revealed at display size |
| **Evolution** | Bright | cinematic | Cross-fade with scale and glow between stages |
| **Gold / Platinum** | Bright | cinematic | Full-card metallic sweep, particle burst, held beat |

Firm limits: no sound without an explicit setting (already modelled and default off);
no full-screen takeover for anything below cinematic; no reward animation may block
input - every one is dismissible by tapping through.

## 20. Mascot asset container

Design the container now so no screen needs redesigning when real art arrives.

- **Fixed aspect ratio box**, 1:1, with `aspect-ratio` and a defined size per context:
  onboarding 72px, Today 64px, Week trail 28px, hatch takeover `min(60vw, 280px)`.
- **`overflow: hidden` with a radius**, so an oversized or oddly-cropped asset cannot
  break the layout.
- **`object-fit: contain` and centred**, so a PNG, an animated WebP and a video frame
  all sit identically.
- **A background inside the frame** - a soft radial tint in the accent - so a
  transparent asset never floats on a bare surface.
- **The frame renders before the asset loads** at the same dimensions, so nothing
  reflows.
- Format-agnostic: `<img>`, `<video>` and a Lottie canvas all fill the same box. Only
  the inner element changes.

This means swapping placeholder for final art, or static for animated, is a one-file
change.

## 21. Trophy Room future compatibility

What the design system should provide now so the room can be built later without
rework:

- **Tier tokens** (section 4.4) rather than the current hardcoded values.
- **A trophy tile component** that works in a grid and in a display case: fixed aspect
  ratio, tier treatment, name, and a state.
- **Four states designed up front:** unlocked (full tier treatment), locked (grey,
  name and description visible), secret (grey, name hidden, description replaced by a
  hint), and newly-unlocked (a temporary highlight ring).
- **A rarity slot** in the tile layout - unused for now, so adding "12% of days" later
  does not reflow the tile.
- **The grid is the fallback and must always work.** The room is a presentation layer
  over the same tiles; if the room is unavailable or motion is reduced, the grid is a
  complete experience on its own.

## 22. Accessibility recommendations

Findings and requirements, measured where possible:

- **Lift `--text-faint` to at least 4.5:1.** Currently 2.79:1 on the page background.
  It is the only measured failure.
- **Consolidate to three interactive heights** (44 / 48 / 56). Five is drift, and the
  44px entries are at the floor rather than comfortably above it.
- **Keep every state on two or more channels.** Currently good - selection uses border
  plus tint plus tick, symptom flags use colour plus text. Formalise it as a rule so
  new components inherit it.
- **Focus must be visible on every surface.** The global `:focus-visible` ring is
  correct; add `--accent-ring` so it stays visible on accent-coloured buttons where the
  current ring would disappear.
- **Reduced motion must preserve outcomes**, not just remove animation (section 10).
- **Text scaling:** everything in `rem`, and no fixed heights on text containers. The
  current fixed control heights are fine because they are targets, but card heights
  must remain content-driven.
- **Keyboard:** the onboarding stepper, tab bar and collapsible headers are all real
  buttons already. Maintain that; no `div` with an onClick.
- **Add left/right safe-area insets** for landscape on notched devices.
- **Heading hierarchy:** one `h1` per screen, `h2` per card. Mostly true now; the
  Progress screen has stat labels in `span`s that should probably be headings.
- **Charts need a text equivalent** - the sparkline has an `aria-label`, and the first
  and last values are printed, which is the right pattern. Keep it.

## 23. CSS architecture recommendation

1,619 lines and 217 rules in one file is past the point where a single file helps.
Recommended structure:

```
src/styles/
  index.css          @layer declaration + imports, the only file imported by main.tsx
  tokens/
    palette.css      raw OKLCH ramps - never referenced by components
    semantic.css     surfaces, text, borders, accent, attention
    paths.css        the five [data-path] accent overrides
    tiers.css        trophy tier tokens
    scales.css       spacing, radius, shadow, motion, type
  base.css           reset, element defaults, typography roles, focus
  layout.css         app shell, screen scaffold, safe areas, breakpoints
  components/
    card.css         all five card kinds in one place
    button.css
    field.css        toggle, stepper, scale, choice, number, select, note
    chip.css         chips, tiers, flags, stats
    nav.css
    chart.css        sparkline, bars
    mascot.css       the asset container
  screens/
    onboarding.css
    today.css
    week.css
    progress.css
    profile.css
    data.css
  motion.css         keyframes and the reduced-motion rule, last
```

**Use `@layer`** to make precedence explicit rather than order-dependent:

```
@layer tokens, base, layout, components, screens, overrides;
```

This ends the whole class of bug where a screen rule accidentally loses to a component
rule because of import order. Support is universal in current browsers.

Vite bundles plain `@import` at build time, so this costs nothing at runtime.

**Naming:** the existing `block__element--modifier` convention is used consistently and
should stay. It is doing its job.

## 24. Plain CSS or SCSS

### **STAY WITH PLAIN CSS.**

The honest test is not "is SCSS nice" but "does this project need something modern CSS
cannot do". Going through the actual reasons a project reaches for SCSS:

| Reason for SCSS | Status here |
|---|---|
| Variables | Custom properties are already in use, and unlike SCSS variables they are runtime-themeable - which is exactly what `[data-path]` and `[data-theme]` depend on. SCSS variables would make theming **harder**. |
| Nesting | Native CSS nesting is supported in all current browsers. |
| Colour functions | `oklch()`, `color-mix()` and relative colour syntax cover generating tints, shades and dark variants natively. |
| Partials and imports | Recommended in section 23, and Vite bundles them at build time. |
| Mixins | The repeated patterns here are card recipes and control heights. Both are better solved by a shared class and a token than by a mixin, which would duplicate the declarations at every call site. |
| Loops for scales | The scales are 5-9 values each, written once. A loop would save perhaps 30 lines and cost a build dependency. |
| Maths | `calc()`, `clamp()` and `min()`/`max()` cover it. |

Not one reason survives. Against that, SCSS would add a dependency, a compile step in
front of the styles, a second syntax for future contributors, and - most importantly -
a temptation to use compile-time variables for colours, which would actively break the
runtime path-accent and theme switching that this whole design depends on.

**Revisit only if** the project later needs generated utility classes at scale, or a
component library arrives with its own build requirements. Neither is on the roadmap.

## 25. Implementation order for the design pass

Sequenced so that each phase is independently shippable and the app is never mid-
refactor at the end of a session.

**Phase 1 - Token foundation.** Split `styles.css` into the structure above, introduce
`@layer`, add the palette layer, move the trophy tiers into tokens, fill the scale gaps
(spacing 0/7/8, radius xl/circle, five shadows, four motion tokens, type roles with
line heights). Lift `--text-faint`. Consolidate the five interactive heights to three.
*No visual change intended beyond the contrast lift - this is the safety net for
everything after.*

**Phase 2 - Card taxonomy and primitives.** Implement the five card kinds, dedupe
`.card`/`.weekday`/the ad-hoc sunken panels, unify `.stat`/`.statrow`. First visible
polish: the plan card starts looking like the most important thing on Today.

**Phase 3 - Typography and layout.** Apply the type roles, add width breakpoints for
tablet and desktop, add left/right safe areas, set the content max-widths.

**Phase 4 - Path accents and theming.** `[data-path]` on the root, `[data-theme]` hook,
five accent families, contrast verification in both themes and in greyscale.

**Phase 5 - Onboarding.** The energy background, the persistent egg, option cards,
navigation. Highest perceived-quality gain per hour of work.

**Phase 6 - Today.** Hierarchy, plan card, quick check-in strip, collapsible headers
with summaries.

**Phase 7 - Week, Progress, Profile, Data.** Chart cards, empty states, section
grouping, calm Data treatment.

**Phase 8 - Reward motion.** XP pop, level up, trophy tiles, and the mascot container.
Hatch and evolution choreography last, since they depend on real art.

Phases 1-4 are infrastructure with modest visual payoff; 5-8 are where it starts
looking like a product. If the order needs compressing, 1, 2, 5 and 6 deliver most of
the perceived improvement.

## 26. Risks and decisions needing approval

**Needs your decision before Phase 4:**

1. **The Build Strength / attention amber collision.** My recommendation is deep
   terracotta for the path plus an icon on every attention chip. Confirm, or pick a
   different family for Build Strength.
2. **Path hue separation.** Mint, teal and blue are adjacent, and mint/teal are hard to
   separate under deuteranopia. My recommendation is to separate on lightness and
   chroma as well as hue, and verify in greyscale. Confirm this is worth the constraint
   on the palette.
3. **Desktop max width of 720px.** Wider looks emptier rather than more premium for
   this content, but it is a taste call.

**Needs your decision before Phase 8:**

4. **Whether hatch and evolution justify a Lottie file** for those two moments only.
   My recommendation is to attempt CSS first and revisit with real art in hand.
5. **Optional custom display font.** Not needed for polish; would sharpen the brand.
   Cost is a self-hosted subset and a small loading consideration.

**Risks:**

- **Phase 1 is a large diff with no visible payoff**, which is exactly when mistakes go
  unnoticed. It should land on its own, be manually checked at 390px against the
  current build, and not be mixed with any other phase.
- **The 610 tests are behaviour tests, not visual ones.** They will not catch a
  styling regression. Manual checking at 390px after each phase is the only safety net,
  and phases are sized accordingly.
- **Five accent families is five times the contrast verification.** Worth doing
  properly once, in Phase 4, rather than discovering a failure per path later.
- **Real mascot art may not fit the reserved sizes.** The container in section 20 is
  designed to absorb that, but art direction should be given the exact box dimensions
  before it is commissioned.
- **Scope creep into features.** This pass touches CSS, class names and markup
  structure only. No behaviour, no domain, no storage, no new screens.

---

## Verdict

**READY WITH DESIGN CHANGES TO APPROVE**

The foundations are sound - tokens exist, dark mode is complete, reduced motion is
handled, contrast is nearly all passing, and there is no red in the palette. The work
is refinement plus three genuine gaps: no depth hierarchy, no responsive story above
560px, and no display typography.

Three decisions need you before implementation starts: the Build Strength amber
collision, the path hue separation, and the desktop width. Everything else in this
document I would proceed with as written.
