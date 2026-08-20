# NinFit UI Verification

## Purpose

Use this skill for any change that alters what a user sees: screens, components,
layout, copy in the interface, stylesheets or design tokens.

It exists to stop "looks fine on my screen" from counting as verification.

## Widths to check

Check intentionally at each, not just the one you developed in:

- 360px — small phone, the hardest case
- 390px — standard phone, the primary target
- 430px — large phone
- 768px — tablet
- 1024px+ — desktop
- wider desktop where relevant

Mobile stays first-class. Desktop uses the deliberate desktop composition
(persistent side rail, wider canvas), never a stretched phone layout.

## What to verify

- no horizontal overflow
- no clipped content that cannot be reached
- touch targets at or above 44px
- a working keyboard path, and visible focus
- meaningful accessible names, not just visible labels
- light mode and dark mode
- reduced motion respected
- text remains readable over background artwork
- layout hierarchy still says what the screen is for
- no critical content hidden behind mascot or decorative art

## Use the shared primitives

Check for an existing primitive before inventing a screen-specific one — cards,
buttons, stat parts, fields, sections, the backdrop. A one-off variant needs a
strong reason and should be stated as such.

New rules belong inside the declared `@layer`. Colour comes from tokens; raw
colour values do not belong in component or screen stylesheets.

## Verification sequence

```
focused tests
  ↓
full relevant tests
  ↓
npx tsc --noEmit
  ↓
npm run build
  ↓
manual / browser UI verification
```

Do not report a UI change as done before the last step.

## When measurement and eyes disagree

**Investigate. Do not pick the answer you prefer.**

A measurement can be technically true and completely misleading. A real example
from this repository: a companion strip reported `scrollWidth === clientWidth`,
which reads as "not truncated". The element was in fact 498px wide inside a 328px
container — the grid track had grown to `min-content`, so the text was never too
wide for its own box, ran past the strip, and was clipped by an ancestor scroll
container with no ellipsis. The check said healthy; the layout was broken.

If a metric and the screenshot disagree, measure something else — element widths
against their container, computed styles, the ancestor chain — until the two
accounts reconcile.

## Source-reading tests

Several suites assert against component source. When a test forbids wording,
strip comments before searching:

```ts
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
```

The comment explaining a rule necessarily quotes the wording the rule forbids.
Searching raw source matches the explanation and reports the opposite of the
truth. This has caught people out more than once.

Also note these tests match literals containing `\n`, so they fail on a CRLF
working tree — see `ninfit-repository-workflow` before concluding the suite is
genuinely red.

## Guarding hierarchy

Pin the decisions that would undo a phase — order on the page, one primary
action, tracking staying collapsed, a companion staying small. Do not pin
cosmetics: tests that count lines or fix colours fail on every honest edit and
teach people to re-bless them without reading.
