# NinFit Decisions

A durable index of the decisions that outlive any one implementation slice.

**This is an index, not an encyclopedia.** Each entry says what was decided and
points at the document that holds the detail. If a decision and its authoritative
document ever disagree, the document wins and this index is the thing to fix.

Change this file only when a durable product or architecture decision changes. Do
not rewrite it for implementation detail — that belongs in the code, its tests, or
`docs/CURRENT_STATE.md`.

Statuses used here:

| | |
|---|---|
| `LOCKED` | Settled. Reopening needs explicit authorisation, not a good argument. |
| `ACTIVE` | Settled in current code and guarded by tests, but still evolving. |
| `PROVISIONAL` | Working assumption. Expected to change; do not build hard on it. |
| `FUTURE` | Direction agreed, implementation not started. |

---

## Product north star

**Status:** `LOCKED`

**Authoritative detail:** `skills/ninfit-product-principles/SKILL.md`,
`docs/ROADMAP.md` (NORTH-STAR PRODUCT RULE)

**Key decisions**

- Fitness is the product. The game is the emotional reinforcement layer.
- Calm by default. Energy earned. Showing up celebrated.
- One obvious next action per screen.
- Personal progress outranks comparison with others. Social is optional.

**Revisit trigger:** A change to what NinFit fundamentally is. Nothing smaller.

---

## Game ethics

**Status:** `LOCKED`

**Authoritative detail:** `skills/ninfit-product-guardrails/SKILL.md` (Hard nos),
`skills/ninfit-product-principles/SKILL.md`

**Key decisions**

- No guilt, shame, punishment or broken-streak pressure.
- No daily completion score, ring, percentage or "complete your day".
- Permanent mascot progress is never removed through absence. Mascots never suffer
  because the user did not exercise.
- Planned rest is successful adherence, not an empty day. Partial counts.
- No pay-to-win, paid loot boxes or paid random eggs. Cosmetics never affect
  progression.

**Revisit trigger:** None foreseen. These are the product's ethical floor.

---

## Fitness truth

**Status:** `LOCKED`

**Authoritative detail:** `skills/ninfit-fitness-truth/SKILL.md`

**Key decisions**

- Fitness data is the truth layer. Game and AI sit downstream and consume it; they
  never manufacture it.
- Never fabricate a health, fitness, activity, nutrition or sensor value. Missing
  data stays missing.
- Preserve provenance. Never diagnose.
- Health data is private by default and is never exposed socially without an
  explicit per-item choice.

**Revisit trigger:** Never for the principle. The *mechanics* change when a native
health source or a cloud boundary arrives — see the maturity rule below.

---

## Mascot family and hatch identity

**Status:** `LOCKED`

**Authoritative detail:** `docs/ROADMAP.md` (CORE PATH MASCOT ARCHITECTURE — LOCKED,
MYSTERY EGG — LOCKED, HATCH TRIGGER — LOCKED), `skills/ninfit-mascot-system/SKILL.md`

**Key decisions**

- Exactly five path mascot families, one per fitness path: Tortoise, Bear, Fox,
  Otter, Wolf. The set is closed — a sixth family means a sixth fitness path.
- The egg hatches at the **end of onboarding**, on an explicit "Start my journey"
  action. This supersedes the earlier six-qualifying-days rule.
- Hatching grants no XP, level or trophy. It is a journey-start event, not a reward.
- Once hatched, the companion's species is **permanent**. Re-running onboarding may
  change the programme path; it never transforms an established companion.

**Guarded by:** `src/domain/game/mascot.ts`, `src/domain/game/defaults.ts`,
`src/test/eggState.test.ts`

**Revisit trigger:** Adding a sixth fitness path, which is itself a locked-set change.

---

## Opal separation

**Status:** `LOCKED`

**Authoritative detail:** `docs/ROADMAP.md` (OPAL ARCHITECTURE — LOCKED),
`skills/ninfit-product-guardrails/SKILL.md`

**Key decisions**

- Opal is the universal NinFit guide: not selected, not earned, not hatched, the same
  for every user from first launch.
- Opal is not one of the five path families, is never path-tinted, and does not
  replace or merge with the path mascot journey.
- Opal must not become a second permanent character card of equal visual weight.
- In code, `CompanionId` and `MascotFamilyId` share no members and the compiler
  enforces it. Do not merge the unions to simplify an implementation.

**Revisit trigger:** None. This boundary is the one agents cross most often by
accident.

---

## Prestige and progression

**Status:** `FUTURE` — direction `LOCKED`

**Authoritative detail:** `docs/ROADMAP.md` (PHASE 10G Champion + Living Legacy,
PHASE 10H Secret Prestige), `skills/ninfit-mascot-system/SKILL.md`

**Key decisions**

- Prestige represents consistency, personal improvement, long-term engagement and
  meaningful milestones — not raw athletic performance alone.
- Prestige is earned, never purchased.
- Champion and Legacy are the long-horizon progression, downstream of real fitness.

**Revisit trigger:** Starting Phase 10G or 10H. The direction is settled; the
mechanics are not built.

---

## Week journey trail

**Status:** `ACTIVE`

**Authoritative detail:** `src/domain/week.ts`, `src/test/week.test.ts`,
`docs/ROADMAP.md` (PHASE 7, Week)

**Key decisions**

- The trail is an orientation device. It stays visually secondary to the day records.
- `not_yet` and `unplanned` both draw as the same neutral node. The only inference
  available from separating them is blame.
- `isToday` is a position, not a state. A finished day stays finished on the day it
  happens.
- The trail is decorative and `aria-hidden`; every fact it draws is stated in words
  on the card beneath it.
- No count, fraction, percentage, score, streak or perfect-week framing.
- **No mascot marker yet.** The roadmap allows one; the only art available is a
  placeholder and spreading it to a second screen was rejected.

**Revisit trigger:** Real mascot artwork existing, which unblocks the marker.

---

## Progress health-data neutrality

**Status:** `ACTIVE` — resting on the `LOCKED` fitness-truth principle

**Authoritative detail:** `skills/ninfit-fitness-truth/SKILL.md`,
`src/test/progressScreen.test.ts`, `src/test/progress.test.ts`

**Key decisions**

- Progress answers "how is my fitness changing over time", not "am I winning".
- Every number is either something the user entered or a plain count of those
  entries. No score, target, population comparison or grade.
- Weight, waist, resting heart rate and HRV get neutral treatment. The screen states
  what was recorded and the span it covers; it never says better, worse, improving or
  on track.
- No goal, percentage or streak is invented. Where data is insufficient the screen
  says so rather than filling the gap.

**Open question, not settled:** `docs/ROADMAP.md` PHASE 7 lists a "meaningful PB
area", "milestone highlights" and "recent trophies" under Progress, while the
Phase 7B brief excluded the game layer from this screen. Raise it before building
either way.

**Revisit trigger:** An authorised decision on the roadmap's Progress game elements.

---

## Local-first data authority

**Status:** `LOCKED`

**Authoritative detail:** `docs/production-readiness.md`,
`docs/architecture/ninfit-supabase-backend-v1.md`, `src/storage/repository.ts`

**Key decisions**

- Fitness truth lives on the device. The app works with no account.
- NinFit ID (Supabase email/password) is an **optional identity boundary**. It does
  not back up, sync or own fitness data today.
- The client holds only publishable configuration —
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. No privileged credential
  ever reaches the browser.
- Corrupt stored values are **quarantined, never deleted**, and the condition is
  surfaced rather than hidden.
- Schema is versioned from v0.1 so that migration is possible before it is needed.

**Revisit trigger:** Backend milestone B2 (Cloud Backup/Sync) or B3 (Fitness Sync).
Either promotes a large block of production concerns — see the maturity rule.

---

## Background and world architecture

**Status:** `ACTIVE`

**Authoritative detail:** `skills/ninfit-visual-asset-pipeline/SKILL.md`,
`src/ui/backgrounds/registry.ts`

**Key decisions**

- One central registry. A screen names a region; it never names a file.
- The registry is the only place a URL, focal point or veil strength is decided.
- Backgrounds are decorative, `aria-hidden`, and never the sole carrier of meaning.
- A region with no art degrades to a token-derived wash. No stock image stands in.
- Generated artwork is source material until a human approves it. Only canonical
  assets are wired into runtime code.
- The 17-region production set is complete. Do not regenerate without a reason.

**Revisit trigger:** Phase 10 mascot art pipeline, or a new world region.

---

## Production-readiness maturity rule

**Status:** `ACTIVE`

**Authoritative detail:** `skills/production-readiness/SKILL.md`,
`skills/production-readiness/maturity-model.md`, `docs/production-readiness.md`

**Key decisions**

- Production concerns are classified `NOW` / `NEXT` / `LATER` / `NOT APPLICABLE` /
  `INVESTIGATE`, against repository evidence rather than ambition.
- Planning a feature promotes nothing. Merging it does.
- Infrastructure earns its place by solving a problem the project currently has.
  Docker, Kubernetes, Terraform, queues, replicas, sharding, multi-region and service
  meshes are `NOT APPLICABLE` until stated evidence promotes them.
- An assessment is never authorisation to implement.

**Revisit trigger:** Any of the architecture triggers in `maturity-model.md` — user
accounts becoming required, a server API, a remote database, sensitive data leaving
the device, automatic external actions, payments, or a material rise in traffic.

---

## Repository and workflow rules

**Status:** `LOCKED`

**Authoritative detail:** `skills/ninfit-repository-workflow/SKILL.md`,
`.gitattributes`

**Key decisions**

- Line endings are LF everywhere, enforced by `.gitattributes` (`* text=auto eol=lf`).
  Several suites assert against source containing `\n` literals and cannot match CRLF.
- Never renormalise unrelated files, and never let a line-ending pass hide a semantic
  change.
- Product discussion is not authorisation. A decision becomes implementation only
  through an explicitly authorised milestone.
- When a decision is locked, put a guard where someone would go to break it — a test,
  or a comment at the exact call site. Guard the rule, not the current implementation.

**Revisit trigger:** None foreseen.
