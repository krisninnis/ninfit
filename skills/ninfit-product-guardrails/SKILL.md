# NinFit Product Guardrails

## Purpose

Use this skill as the fast pre-implementation check on any NinFit feature, copy
change, reward, UI surface or character decision.

It is a one-page boundary list, deliberately short so it actually gets read. It
does not restate the product philosophy — three existing skills already own that
in depth, and this one points at them rather than duplicating them:

- `ninfit-product-principles` — engagement design, return-after-absence, prestige
- `ninfit-fitness-truth` — data truth, provenance, fabrication, PBs, privacy
- `ninfit-mascot-system` — stages, evolution, Champion, Legacy, cosmetics, rarity

`docs/ROADMAP.md` remains the canonical product plan. Read it for what to build.
Read this for what must never be true of whatever you build.

## The one rule underneath all of it

**NinFit rewards showing up. It never punishes being human.**

If a change makes a missed day, a short session, a rest week, an illness or a
holiday feel like a failure, it is wrong regardless of how well it is built.

## Fitness truth first

- Real fitness records are authoritative.
- Game systems consume truth. They never manufacture it.
- The programme proposes; the user decides.
- Partial activity stays truthful and counts as a win.
- Planned rest is successful adherence, not an empty day.
- Missing data stays missing. Never fabricate a plausible value.

See `ninfit-fitness-truth` before touching data, provenance or derived facts.

## Hard nos

Reject these at design time, not at review time:

- guilt, shame, punishment, disappointment at inactivity
- broken-streak pressure, or anything the user could feel they are about to lose
- loss of permanent mascot progress through absence
- a daily completion score, ring, percentage, or "complete your day"
- fake XP, PBs, trophies, evolution, Champion or Prestige
- rewards that incentivise unsafe or excessive activity
- pay-to-win, paid loot boxes, paid random eggs
- cosmetics that affect fitness or game progression
- medical diagnosis, or app reasoning presented as clinical judgement
- health data exposed socially without an explicit per-item user choice
- required social features

Social is optional. Health data is private by default.

## Character architecture — LOCKED

This is the boundary agents cross most often, so it is stated operationally here.
The full architecture record lives in `docs/ROADMAP.md` under
`CORE PATH MASCOT ARCHITECTURE — LOCKED` and `OPAL ARCHITECTURE — LOCKED`,
and in `ninfit-mascot-system`.

**Path mascots.** Exactly five, one per fitness path:

Tortoise · Bear · Fox · Otter · Wolf

The set is closed. A sixth family means a sixth fitness path. The path mascot
owns the user's own journey: Mystery Egg → hatch → growth → evolution →
Champion → Legacy. It is the permanent character presence attached to that
journey.

**Opal.** The universal NinFit guide and companion. Opal is:

- not selected, not earned, not hatched
- the same for every user from first launch
- not one of the five path mascot families
- never path-dependent, and never tinted by a path accent

Opal does not replace, merge with, or compete with the path mascot progression
journey. Opal may appear where there is a meaningful reason to speak —
contextual guidance, encouragement, hints, explanations, drop hints, secrets —
and must not become a second permanent character card of equal visual weight.

In code, `CompanionId` and `MascotFamilyId` share no members, and the compiler
enforces it. Do not merge the unions to simplify an implementation.

## Before implementing, ask

1. Does this help the user sustain real fitness?
2. Does it preserve truth and provenance?
3. Could it pressure someone into unsafe activity?
4. Could it make inactivity feel like failure?
5. Does the game reinforce fitness rather than compete with it for attention?
6. Is the next action obvious?

A "no" is a redesign, not a caveat in the PR description.

## Scope discipline

Product discussion is not authorisation. A decision becomes implementation only
through an explicitly authorised milestone.

New ideas go into the owning roadmap phase rather than interrupting the current
workstream. Do not start a later milestone automatically.

## Encoding locked decisions

When a product decision is locked, put a guard where someone would go to break
it — a test, or a comment at the exact call site. This repository does this
consistently; follow it rather than relying on memory.

Guard the rule, not the current implementation. A test that forbids a future
authorised direction is a bug in the test.
