# Tortoise Production Scaffold v1

## Purpose

Tortoise is NinFit's first complete path-mascot family and the master production
template for every later species. Finish and learn from Tortoise before producing
the next family.

This document records the asset slots, iteration order and delivery rules so a
Cowork/agent run can take one small slice at a time without inventing architecture
or progression rules.

## Product rules

- Tortoise remains the same recognisable individual through every growth stage.
- Growth stages are visual progression, not replacement characters.
- Mascot art is presentation only. It never decides fitness truth, XP, evolution,
  Journey state, rewards or health data.
- Missing artwork falls back safely. Never borrow another stage/species asset.
- Raw/generated artwork remains reference material until human visual approval.
- Runtime code uses canonical assets through the existing mascot art registries;
  screens do not own file paths.
- Calm by default: motion is occasional and meaningful, not constant.
- Reduced-motion users must retain a complete experience.
- The existing Pika-watermarked Starter wave is TEMPORARY proof artwork. Do not
  treat it as the clean production master.

## Stage ladder

| Runtime ID | Product label | Visual direction |
| --- | --- | --- |
| starter | Starter | Friendly beginning; capable but clearly early in the journey |
| growing | Growing | Slightly stronger posture and confidence |
| capable | Active | Clearly active and experienced |
| advanced | Athletic | Athletic confidence and more developed kit |
| elite | Champion | Mature, prestigious and unmistakably accomplished |

Do not rename stored runtime IDs merely to match labels.

## Canonical identity anchor

Before later-stage generation, preserve an approved Tortoise master reference for:

- face and eye style
- shell geometry and markings
- head/body proportions
- skin and shell colour language
- rendering and lighting language
- clothing/equipment language
- personality and silhouette

Every later stage must visibly be the same Tortoise.

## Required asset slots per stage

Build each stage in three passes rather than generating everything at once.

### A. Identity

- standing/rest pose
- idle motion (subtle breathing/blink)
- wave/greeting

### B. Activity

- Walk / Run Journey art
- Cycle Journey art
- Swim Journey art

### C. Life / reactions

- happy: ordinary completed activity
- proud: meaningful achievement
- rest/recovery
- stage-transition/evolution moment where applicable

Champion may additionally require ceremony, trophy/PB, secret-discovery and
passport/portrait assets. Those are later scoped slices, not permission to add
gameplay rules.

## Iteration roadmap

### T0 — Starter visual integration

**Status: COMPLETE on `main` via PR #72.**

Use the completed Starter Tortoise to establish the production presentation
language before generating another species.

1. Improve Today companion presentation so the character feels integrated rather
   than like a portrait placed in a stark box.
2. Replace the Journey companion-strip `T` placeholder with reviewed Tortoise art
   through the existing presentation boundary.
3. Standardise mascot sizing, crop, whitespace, border/shadow treatment and
   responsive behaviour.
4. Verify desktop and mobile before expanding the asset set.

### T1 — Starter clean motion

**Status: IN PROGRESS.**

- **T1A — clean occasional idle: COMPLETE on `main` via PR #73.** The
  desktop/tablet centring correction is included in that merged delivery.
- **T1B — clean interactive wave: NEXT.** The current tap wave remains temporary
  proof and must not be promoted as the clean master.

1. Preserve the current wave only as temporary proof.
2. Preserve the reviewed clean idle master and its occasional, non-looping runtime
   contract.
3. Produce a clean wave master without generator branding/watermark.
4. Add happy, proud and rest only as separately reviewed slices.

Do not delete arbitrary video frames merely to hide a watermark: if branded frames
occur during character motion, frame removal can create visible jumps. Trimming is
acceptable only when the affected frames are safely outside meaningful motion.
Otherwise regenerate/re-render from the approved character reference.

### T2 — Growing

Identity -> Journey activity set -> life/reactions -> Starter-to-Growing transition.

### T3 — Active

Identity -> Journey activity set -> life/reactions -> Growing-to-Active transition.

### T4 — Athletic

Identity -> Journey activity set -> life/reactions -> Active-to-Athletic transition.

### T5 — Champion

Identity -> Journey activity set -> life/reactions -> Athletic-to-Champion reveal,
then separately scoped Champion ceremony/passport/prestige presentation.

## Per-asset delivery conveyor

Every asset or tightly related asset set follows this order:

1. **Source** — generate/derive from the canonical Tortoise reference.
2. **Human visual review** — confirm it is still NinFit's Tortoise.
3. **Canonicalise** — preserve approved source/reference with stable identity.
4. **Production conversion** — crop, transparency, dimensions, compression and
   motion format as appropriate.
5. **Registry** — declare only reviewed production assets through the central
   mascot presentation boundary.
6. **Focused verification** — asset existence, correct species/stage/activity and
   safe fallback behaviour.
7. **Full verification** — full tests, TypeScript and production build.
8. **Real UI proof** — 360, 390, 430, 768 and desktop; light/dark and reduced
   motion where relevant.
9. **Human visual review** — inspect the actual rendered result.
10. **Merge/checkpoint** — only then move to the next slice.

## Cowork slice template

Give Cowork one bounded slice at a time:

```text
SLICE: <tortoise-slice-name>
CLASS: ART / ASSET / PRESENTATION

OUTCOME:
<one visible result>

AUTHORITATIVE BASE:
Fresh GitHub main. Do not use an old local checkout as truth.

IN SCOPE:
<exact assets/files/behaviour>

NON-GOALS:
No progression, XP, rewards, health truth, Journey recording, GPS, schema or
unrelated screen changes unless the slice explicitly requires them.

PROTECTED:
Historical worktrees and untracked delivery directories must not be cleaned,
moved, pruned or reused as scratch space.

ASSET RULE:
Generated source is not production. Human approval -> canonical asset ->
conversion -> registry -> UI proof.

VERIFY:
Focused tests -> full tests -> TypeScript -> production build -> responsive
browser proof -> human review.

STOP:
Stop for human review before broadening the slice.
```

## Species sequencing

Do not begin the next species merely because an older roadmap lists one. First
finish the Tortoise production system and then explicitly choose the path-family
animal ladder so the species communicate the intended progression from gentler/
slower movement toward faster/more athletic fitness.

That choice is a product decision, separate from cross-species evolution: a user
does not evolve from Tortoise into another species.
