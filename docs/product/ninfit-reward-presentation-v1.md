# NinFit Reward Presentation v1

**Status:** Specification — authored, not implemented. No production file has been changed.
**Scope:** Phase 8 reward presentation. Phase 8.1 — Reward Acknowledgement Foundation is the first bounded slice.
**Repository:** `C:\Users\thoma\fitness-tracker`
**Product:** NinFit
**Version:** v1
**Last updated:** 21 August 2026

---

## 1. Purpose and status

This document is the durable product and implementation contract for how NinFit
acknowledges rewards the user has just earned.

It exists so the work does not depend on chat history. It is written against the
repository as it actually stands, not against an intended design.

### Decision labels

Same vocabulary as `docs/product/ninfit-mascot-game-system-v1.md`:

- **LOCKED** — decided. Do not casually change during implementation.
- **DIRECTION** — agreed concept, implementation detail still open.
- **FUTURE** — deliberately outside the current slice.
- **OPEN** — needs a product decision before implementation.

Repository truth always overrides stale detail in this document.

### Scope of Phase 8.1

Phase 8.1 presents reward information NinFit **already generates**. It adds no
reward, changes no rule, and touches no domain, app or storage file.

---

## 2. Repository truth at authoring — LOCKED

| | |
|---|---|
| Authoritative commit | `482977d3d9845335677ff1e65c2557399e3563be` (`main`, PR #11) |
| Verified baseline | 42 test files / **1227 tests** passing, `npm run typecheck` exit 0, `npm run build` exit 0 |
| Working tree at authoring | clean |

Every file path, symbol and quotation below was read at that commit. Re-verify before
implementing — see `skills/ninfit-handoff/SKILL.md`.

---

## 3. Problem statement — LOCKED

The domain already computes a precise record of what was just earned, and the
interface throws almost all of it away.

`grantRewards` returns `{ state, granted: RewardEvent[] }`, where `granted` is the
true newly-earned delta, and each event carries a reviewed, domain-authored `label`.
Today:

- `src/ui/components/GameHeader.tsx` takes `granted[granted.length - 1]` and renders
  `+N XP` — the **last event only**, with **no label**.
- `src/ui/screens/TodayScreen.tsx` takes `granted.map(e => e.kind)` to choose a
  companion message.

So a completion that earns an activity, a session, a consistency milestone and a
trophy tells the user "+150 XP" and nothing about what happened. Labels such as
"Rest day followed" and "Three sessions of consistency" are produced, tested, and
rendered nowhere.

**Phase 8.1 fixes the presentation, not the model.**

---

## 4. Existing architecture being reused — LOCKED

Nothing in this list is created by Phase 8.1. All of it exists at `482977d`.

| Asset | Location | Reused for |
|---|---|---|
| `RewardEvent` | `src/domain/game/types.ts` | the event payload |
| `RewardKind` | `src/domain/game/types.ts` | the tier mapping key |
| `grantRewards` → `granted` | `src/domain/game/rewards.ts` | the newly-earned delta |
| `awardedKeys` idempotency | `src/domain/game/rewards.ts` | guarantees no repeat acknowledgement |
| `GameHook.granted` | `src/ui/hooks/useGame.ts` | delivery to the UI |
| `--ft-motion-standard` / `--ft-motion-reward` | `src/styles/tokens/scales.css` | enter and leave motion |
| `--ft-ease-standard` / `--ft-ease-reward` | `src/styles/tokens/scales.css` | easing |
| `.card--reward` | `src/styles/components/card.css` | the reward-tier surface |
| global reduced-motion rule | `src/styles/motion.css` | motion safety |

`RewardEvent` fields: `id`, `key`, `kind`, `xp`, `skillXp`, `label`, `date?`,
`awardedAt`.

Two reused guarantees worth stating plainly:

**Idempotency already prevents repeat acknowledgement.** `rewards.ts` states the rule:
*"Rewards are DERIVED FROM PERSISTED STATE, never from a click, a callback or a
render… A reload re-derives the identical set of keys and therefore grants nothing."*
Phase 8.1 therefore needs no "already shown" bookkeeping of its own.

**The motion tiers already exist and are unused.** `scales.css` declares four
durations with the comment *"The intensity of a transition is proportional to how
rare the moment is."* `--ft-motion-reward` and `--ft-ease-reward` have no consumer
anywhere in the repository. Phase 8.1 is their first legitimate use.

---

## 5. Locked NinFit reward principles — LOCKED

Inherited, not invented here. Authoritative detail in
`skills/ninfit-product-principles/SKILL.md` and
`skills/ninfit-product-guardrails/SKILL.md`.

- Fitness is the product. The game is the emotional reinforcement layer.
- **Reward frequency may be high. Reward intensity must be graduated.**
- Ordinary activity never receives maximum celebration.
- Calm by default. Energy earned. Showing up celebrated.
- No guilt, shame, punishment, fake urgency or lost-streak language.
- No score, grade, percentage or daily-completion ring.
- Partial work earns real XP. Planned rest is participation, not a gap.
- Consistency is **not a daily streak**. `consistency.ts` states: *"There is no
  `broken`, no `failed`, no `lost`."*

**The domain owns the words.** Every visible reward phrase comes from
`RewardEvent.label`. The interface may arrange, order and style; it may never
compose, rewrite or embellish reward wording.

---

## 6. Exact RewardKind inventory — LOCKED

Seven members, verbatim from `src/domain/game/types.ts`:

```ts
export type RewardKind =
  | 'activity_completed'
  | 'session_completed'
  | 'first_programme_day'
  | 'rest_day_observed'
  | 'first_measurement'
  /** Three or seven planned activity occasions that went well. Never a daily streak. */
  | 'consistency_milestone'
  | 'trophy_unlocked';
```

No new kind is added by Phase 8.1.

---

## 7. Presentation-tier mapping — LOCKED

| RewardKind | Tier | Why |
|---|---|---|
| `activity_completed` | `standard` | The most frequent event in the product |
| `session_completed` | `standard` | Routine, expected, several times a week |
| `rest_day_observed` | `standard` | Participation, deliberately equal to activity |
| `first_measurement` | `standard` | Once, but ordinary in feel |
| `first_programme_day` | `reward` | Happens once; the journey beginning |
| `consistency_milestone` | `reward` | Rare and earned across many occasions |
| `trophy_unlocked` | `reward` | The existing achievement vocabulary |

**No `RewardKind` maps to `cinematic` in Phase 8.1.** Cinematic remains reserved for
hatch, evolution, Champion, gold and platinum moments, and Secret Prestige — none of
which currently emits a `RewardEvent` at all.

### Where the mapping lives — LOCKED

**The UI layer, not `src/domain/game`.**

`rewards.ts` is pure and clock-free, and the game domain must stay
presentation-agnostic. A tier is a statement about motion intensity, which is a
presentation concern; placing it in the domain would make the reward model depend on
a motion vocabulary it must never know about.

The mapping must be **exhaustive by construction** — a `Record<RewardKind, Tier>`, so
that adding an eighth `RewardKind` fails to compile rather than falling silently
through a `default` into the calmest tier.

---

## 8. Single-event behaviour — LOCKED

When one reward is granted, the acknowledgement shows one line:

```
Easy walk done · +20 XP
```

- The phrase left of the separator is `RewardEvent.label`, unmodified.
- The value right of it is `RewardEvent.xp`.
- No other text. No exclamation marks, no adjectives, no praise the domain did not
  author.

A `standard` event uses the plain acknowledgement surface. A `reward` event uses
`.card--reward`.

---

## 9. Multiple-event behaviour — LOCKED

A single completion can grant several events at once. **Every granted event is
represented. Nothing is dropped, collapsed or replaced by a count.**

```
Consistency Starter · +25 XP
Three sessions of consistency · +30 XP
Easy walk done · +20 XP
Session complete · +30 XP
```

Rules:

- **One container, not one card per reward.** A single acknowledgement block with one
  line per event.
- The container takes the **highest tier present**. If any `reward`-tier event is in
  the batch, the container is a `.card--reward`; otherwise it is the plain surface.
- No `"+2 more"`, no truncation, no "see all". A label the domain produced is a label
  the user sees.
- The container grows naturally with the batch. It never scrolls internally, never
  becomes modal, and never covers the plan.

If a batch ever grows large enough to dominate the screen, that is a signal about
reward density in the domain, not a reason to hide labels. Raise it as a product
question rather than truncating.

---

## 10. Ordering rules — LOCKED

1. **`reward`-tier events first**, then `standard`-tier events.
2. **Within a tier, preserve the domain's order** exactly as it appears in `granted`.

The domain's order is deterministic and already tested; the UI must not re-sort by
XP, alphabetically, or by recency. Ordering by tier answers "what is the most
meaningful thing that just happened" without hiding anything beneath it.

---

## 11. Dwell behaviour — LOCKED

The acknowledgement **auto-dismisses**. A permanent acknowledgement of an ordinary
walk becomes furniture — precisely the mistake Phase 6 corrected when it demoted the
game header out of the reward surface.

**Dwell is not animation duration**, so it does not belong in the CSS motion scale.
It is a UI constant:

```ts
/** Base dwell, inherited from the retired .xpfloat, which held for 2.2s. */
const REWARD_ACKNOWLEDGEMENT_DWELL_MS = 2200;

/** Each additional line needs reading time. */
const DWELL_PER_EXTRA_EVENT_MS = 600;

/** Bounded, so a large batch never becomes a notification that loiters. */
const MAX_DWELL_MS = 4400;
```

Effective dwell = `min(BASE + (count - 1) * PER_EXTRA, MAX)`.

| Events | Dwell |
|---|---|
| 1 | 2200ms |
| 2 | 2800ms |
| 3 | 3400ms |
| 4 | 4000ms |
| 5+ | 4400ms (capped) |

Naming may follow repository conventions at implementation time; the values and the
bound are the contract.

Dwell restarts when a new batch arrives. Dwell must **not** depend on animation
having played.

---

## 12. Motion behaviour — LOCKED

Enter and leave only. Nothing loops, pulses, bounces or sparkles.

| Tier | Duration token | Easing token | Movement |
|---|---|---|---|
| `standard` | `--ft-motion-standard` | `--ft-ease-standard` | fade in, slight rise |
| `reward` | `--ft-motion-reward` | `--ft-ease-reward` | fade in, slight rise, `--ft-shadow-reward` |

**No new duration or easing token may be created.** If a value seems to be missing,
that is evidence the design is wrong, not that the scale is incomplete.

No cinematic treatment. No `--ft-motion-cinematic` consumer in this slice.

### Placement

The acknowledgement renders **in Today's normal flow, directly below the companion
strip and above the plan**. It is never fixed, floating, overlaid or modal, and it
never blocks input — no element in Today is modal today, and Phase 8.1 does not
introduce the first one.

Consequence, accepted deliberately: the plan shifts down once when the
acknowledgement appears and back when it leaves. An overlay would avoid the shift but
would obscure the fitness task, which the product rules forbid. One honest shift is
the better trade.

---

## 13. Reduced-motion behaviour — LOCKED

`src/styles/motion.css` already neutralises every animation and transition app-wide
under `prefers-reduced-motion: reduce`, with `!important`, in the `motion` layer. The
acknowledgement inherits that protection and needs **no CSS opt-out of its own**.

The critical rule:

> **The JS dwell timer controls dwell only. It must never be shortened, skipped or
> tied to animation completion.** A reduced-motion user sees the acknowledgement
> appear instantly, remain legible for the full dwell, and disappear. They lose the
> movement; they never lose the message.

**No `usePrefersReducedMotion` hook is extracted in Phase 8.1** — DEFERRED. The
duplicated inline `matchMedia` predicates in `src/ui/screens/StartupCinematic.tsx`
and `src/ui/hooks/useHatchCinematic.ts` are pinned by source-scanning assertions in
`src/test/startupCinematic.test.ts` and `src/test/todayVisual.test.ts`. Extracting
them here would create unrelated churn in tests this slice has no business touching.

---

## 14. Accessibility requirements — LOCKED

The acknowledgement must be completely understandable with **no motion, no colour, no
sound and no haptics**.

- **Text carries the meaning.** The label and the XP value are the message; styling
  is emphasis only.
- **Tier is never carried by colour alone.** This follows the existing rule in
  `src/styles/tokens/tiers.css`: *"Tier is NEVER carried by colour alone. Every
  presentation prints the tier name alongside the chip."* Reward-tier events must
  remain distinguishable in greyscale — through the surface, the border and the
  order, not the hue.
- **Announced once, politely.** The container carries `role="status"` (an implicit
  `aria-live="polite"`), matching the existing pattern in
  `src/ui/screens/DataScreen.tsx`. It must not interrupt, and must not re-announce on
  re-render.
- **Not focus-stealing.** No autofocus, no focus trap, no keyboard interruption.
- **No interactive control** is introduced, so there is no new keyboard path and no
  touch-target requirement.
- **No dependency on sound or haptics.** Both settings exist and are unwired; Phase
  8.1 must not read either.

---

## 15. Component and API proposal — DIRECTION

```tsx
export type RewardTier = 'standard' | 'reward';

/** Exhaustive by construction: an eighth RewardKind will not compile. */
const REWARD_TIER: Readonly<Record<RewardKind, RewardTier>> = { /* section 7 */ };

export function rewardTier(kind: RewardKind): RewardTier;

interface RewardAcknowledgementProps {
  /** The newly granted delta, straight from GameHook.granted. */
  granted: readonly RewardEvent[];
}

export function RewardAcknowledgement({ granted }: RewardAcknowledgementProps): JSX.Element | null;
```

Behaviour:

- Renders `null` when `granted` is empty.
- Keys the batch on the events' `id`s so a repeat render does not restart dwell.
- Orders per section 10, dwells per section 11, styles per sections 7 and 12.
- Reads nothing from the repository, mutates nothing, and imports only types from the
  domain.

---

## 16. CSS and taxonomy rules — LOCKED

`.card--reward` is defined in `src/styles/components/card.css` as *"a game moment; the
only card allowed a tint"*, and `src/test/cardTaxonomy.test.ts` reserves it: *"it
stays reserved in the taxonomy for actual reward moments, which Phase 8 builds."*

- **`reward`-tier acknowledgements may use `.card--reward`.** This is its first
  legitimate consumer and does not violate the taxonomy.
- **`standard`-tier acknowledgements must not.** A completed walk is not a game
  moment, and spending the tint on routine work is exactly what the taxonomy comment
  guards against.
- No red, no `danger`, no `destructive` — the palette has none, and
  `cardTaxonomy.test.ts` enforces it.
- New rules live in `src/styles/components/reward.css`, inside the `components`
  layer, imported from `src/styles/index.css` in layer order.

### `.xpfloat` — retire completely

`.xpfloat` has exactly two references: `src/ui/components/GameHeader.tsx` and
`src/styles/screens/game.css`. No test pins it. Its behaviour — showing the last
event's XP — is wholly superseded, so it is removed rather than left alongside.

`GameHeader` otherwise **stays as it is**: the level, XP bar, companion message and
stage line are permanent furniture and are not part of this slice.

---

## 17. Expected implementation boundary — DIRECTION

**New**

```
src/ui/components/RewardAcknowledgement.tsx
src/styles/components/reward.css
```

The tier map may live beside the component or in a small UI-side module if separation
proves useful at implementation time.

**Modified**

```
src/ui/screens/TodayScreen.tsx        render the acknowledgement
src/ui/components/GameHeader.tsx      remove the .xpfloat
src/styles/index.css                  import reward.css
src/styles/screens/game.css           remove .xpfloat rules
src/test/cardTaxonomy.test.ts         first legitimate .card--reward consumer
```

**Must not be modified**

```
src/domain/**      src/app/**      src/storage/**
docs/ROADMAP.md    docs/DECISIONS.md
package.json       package-lock.json
```

If implementation discovers that any file under `src/domain`, `src/app` or
`src/storage` genuinely must change, **stop and report** rather than expanding scope.
No such requirement is known: `granted` already reaches the UI with everything needed.

---

## 18. Test plan — LOCKED

Source-scanning tests must strip comments before any forbidding assertion, following
the established `code(source)` idiom — this component's own docstring will necessarily
name the words it forbids.

| # | Test | Proves |
|---|---|---|
| 1 | every event in `granted` is represented | nothing is dropped |
| 2 | a 4-event batch renders 4 lines | not reduced to the last event |
| 3 | rendered text comes from `RewardEvent.label` | domain owns the wording |
| 4 | no reward phrasing is composed in the UI | no label reconstruction |
| 5 | `REWARD_TIER` is exhaustive over `RewardKind` | an eighth kind fails to compile |
| 6 | routine kinds do not render `.card--reward` | taxonomy respected |
| 7 | a batch containing a reward-tier event may use `.card--reward` | first legitimate consumer |
| 8 | no `--ft-motion-cinematic` consumer | no cinematic for routine work |
| 9 | reward-tier events precede standard, domain order kept within tier | ordering rule |
| 10 | dwell scales with count and is capped | bounded and calm |
| 11 | reduced motion leaves the acknowledgement legible for full dwell | accessibility |
| 12 | no reference to `soundEnabled` / `hapticsEnabled` / `navigator.vibrate` / `Audio` | no sound or haptic dependency |
| 13 | forbidden language absent: `streak`, `perfect`, `failed`, `broken`, `score` | tone rules |
| 14 | `.xpfloat` no longer appears in source or CSS | superseded and removed |
| 15 | no import of mascot art, `EggArt`, `Opal` or `GameHeader` | no art dependency |
| 16 | component imports only types from `src/domain` | layering |

Existing suites must stay green with **additions only**. No existing assertion may be
weakened to accommodate this slice.

---

## 19. Non-goals — LOCKED

Phase 8.1 does **not** include: XP, trophy, consistency or PB rule changes; PB
implementation; a `RewardKind` for level-up; new persistence or schema; game-state
redesign; the multi-`useGame` race fix; sound; haptics; hatch redesign; evolution or
Champion cinematics; Secret Prestige; cosmetic drops; Progress-screen trophy work;
GPS; social; leaderboards; world mascot discovery; new mascot artwork; extraction of a
shared reduced-motion hook.

---

## 20. Acceptance criteria — LOCKED

1. Every newly granted `RewardEvent` is visible with its domain-supplied label.
2. A multi-event batch shows every line, in tier-then-domain order, in one container.
3. `reward`-tier batches use `.card--reward`; routine batches do not.
4. Only existing motion tokens are used; no new duration or easing token exists.
5. Dwell follows section 11 exactly, including the cap.
6. Under reduced motion the acknowledgement is legible for the full dwell.
7. Nothing is modal; nothing blocks input; the plan is never obscured.
8. `.xpfloat` is gone from both source and CSS.
9. No file under `src/domain`, `src/app` or `src/storage` is modified.
10. Full suite green with additions only; typecheck and build exit 0;
    `git diff --check` clean.
11. Verified in a browser at 360 / 390 / 430 / 768 / 1024, light and dark, reduced
    motion on and off — per `skills/ninfit-ui-verification/SKILL.md`.

---

## 21. Rollback and failure considerations — DIRECTION

The slice is presentation-only and additive, so rollback is reverting the commit. No
migration, no persisted state, no reward is created or destroyed by it.

Failure modes to watch during implementation:

- **Dwell tied to animation.** If the timer is started from a transition callback,
  reduced-motion users lose the message. Start it on mount, always.
- **Re-render restarting dwell.** Key on event ids, not on render count.
- **Batch identity.** Two consecutive batches with overlapping ids must not merge into
  one long-lived acknowledgement.
- **Layout shift.** The container must occupy no space when absent.
- **Tier leakage.** If a future kind is added and the map is not a `Record`, it would
  silently take the calm tier. The exhaustive type is the guard.

---

## 22. Known deferred issues — LOCKED

Recorded so they survive a change of thread. None is authorised work.

| Issue | Detail |
|---|---|
| **Multi-`useGame` cold-sync race** | `useGame()` is instantiated independently at four sites. `App.tsx` mounts first, so on a cold load carrying unsynced rewards — after a JSON import, or logs changed in another tab — App's instance grants and persists them and Today's later sync returns `granted: []`. **Phase 8.1 guarantees the normal in-session completion path only.** Cold-load, import and other-tab acknowledgements may still be lost. Fixing it means a single shared game context across App, Today and Profile: a separate architecture slice. |
| **Level-up has no `RewardKind`** | Derived from XP totals, so it cannot be detected as a discrete event. The bar simply moves. Presenting a level-up requires a domain change and is out of scope. |
| **`recentEvents` persisted but unread** | `GameState.recentEvents` is written and capped at 20, typed *"Used only to show what just happened"*, and read by nothing. It is the natural foundation for a durable reward queue that would also fix the race above. |
| **PB system absent** | No PB type, key, field or UI exists anywhere. Roadmap Phase 18. |
| **Sound setting unwired** | `soundEnabled` persists and defaults `false`; nothing reads it. |
| **Haptics setting unwired** | `hapticsEnabled` persists and defaults `false`; nothing reads it. No `navigator.vibrate` anywhere. |
| **Cinematic reward presentation** | Hatch, evolution, Champion, gold/platinum trophy and Secret Prestige. `--ft-motion-cinematic` remains unused. Later Phase 8 slices, most blocked on mascot art. |
| **Progress trophy/PB tension** | `docs/ROADMAP.md` PHASE 7 lists "recent trophies" and a "PB area" under Progress, while Phase 7B deliberately kept the game layer off that screen. Unresolved, not settled. |
| **Final mascot artwork pipeline** | `EggArt` is code-drawn and `family.glyph` is a single letter; both are marked temporary and must be replaced rather than refined. Phase 8.1 depends on neither. |

---

## 23. Open questions

None blocking. Spec location, dwell duration and the multiple-reward rule were
resolved before authoring and are recorded above as LOCKED.
