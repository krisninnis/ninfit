# Living Fitness Adventure Foundation Architecture v1

## Status

**Design only. No runtime implementation is authorised by this document.**

This document turns the locked Living Fitness Adventure direction in
`docs/ROADMAP.md` into a safe local-first architecture that can later be implemented
in small slices.

The product promise remains:

> Move in the real world. Explore with your companion. Build a history together.

Fitness truth answers **what happened**. Adventure, memory and narrative sit downstream
and may interpret trusted history without inventing it.

## Existing trusted foundation

NinFit already has authoritative Journey records.

Important current facts:

- `Journey.id` is the identity of one real Journey
- `Journey.status` distinguishes recording / paused / completed / imported
- trusted route geometry lives in `Journey.route.acceptedPoints`
- observed route continuity is preserved with `segmentStarts`
- authoritative distance is a Journey metric, not something presentation recalculates
- `JourneySource` preserves provenance
- completed/imported Journeys persist through `journeyHistory`
- route disclosure already has private / summary / masked / full-route modes
- precise route cloud sync is off by default
- start/end masking exists as a projection rather than destructive editing

Living Adventure systems must build **references and derived meaning** on top of those
records rather than duplicating or mutating them.

## Architectural rule

Use this direction:

```
trusted fitness / Journey records
        ↓
deterministic derived adventure facts
        ↓
stable IDs + provenance references
        ↓
private memory / map / book projections
        ↓
optional narration / presentation
```

Never reverse the dependency.

The Adventure layer may say:

> "You have walked this route three times."

only if deterministic trusted history proves three qualifying Journeys.

It may not say:

> "This is your favourite route."

because it sounds nice, unless a deterministic rule has actually established that
fact from history.

## Shared provenance shape

Future Adventure-derived records should carry enough provenance to explain themselves.

Recommended minimum:

```ts
interface AdventureProvenance {
  journeyIds: string[];
  derivedAt: ISODateTime;
  ruleId: string;
  ruleVersion: number;
}
```

Rules:

- `journeyIds` references existing Journey identity
- no copied GPS route is required merely to prove a memory
- `ruleId` names the deterministic rule
- `ruleVersion` lets future logic evolve without pretending old derivations were made
  under new rules
- derived records are rebuildable from trusted history where practical

If a memory depends on a non-Journey fact, provenance may later support another typed
source reference. Do not start with an untyped bag of arbitrary IDs.

# 1. Adventure Map

## Goal

Build a private personal geography of places where real movement actually occurred.

The Adventure Map is **not** a collectible map painted by fiction. It is a projection
of trusted route history and approved derived meaning.

## v1 derived place concepts

Start with a small deterministic vocabulary:

- `discovered_place`
- `familiar_route`
- `favourite_route`
- `meaningful_place`

Do not implement all four at once merely because they are named here.

### Discovered place

A coarse place area becomes discovered only because one or more trusted Journey route
points entered it.

Do not store another full-resolution copy of the route.

A future implementation should prefer a coarse stable spatial cell/region ID for map
history, not raw address strings or reverse-geocoded home locations.

### Familiar route

A route may become familiar only after repeated history passes an explicit similarity
rule.

Route similarity is a future algorithmic decision. It must be deterministic and must
not rely on an LLM deciding two routes "feel similar."

### Favourite route

Favourite should **emerge**, not be manually fabricated by narration.

Possible future deterministic factors:

- repeat count
- recency
- deliberate revisits
- duration of relationship with the route

Do not make "longest" automatically mean "favourite."

The first implementation should expose the rule in code/tests even if the exact product
formula is not shown in UI.

### Meaningful place

This should be reserved for a place attached to an actual meaningful event, such as a
first trusted distance milestone, PB, Champion memory or explicit user-marked memory.

Do not promote every GPS point into emotional meaning.

## Location retention

Privacy-first rule:

**The Adventure Map should reference trusted Journey history, not create a second raw
location database by default.**

Prefer:

- Journey IDs
- coarse spatial cells
- route-cluster IDs
- derived place labels created locally

Avoid unless explicitly needed:

- duplicate full-resolution acceptedPoints
- precise home/work labels
- long-lived third-party geocoding payloads
- cloud upload of raw route geometry

If a future feature needs a precise coordinate, justify that field separately.

## Deletion

If a Journey is deleted, downstream derived map facts referencing only that Journey
must no longer be presented as though the evidence still exists.

A later implementation needs either:

- rebuild-from-history projection, or
- deterministic invalidation by provenance reference

Do not leave orphaned emotional memories after their only trusted source has been
removed.

# 2. Mascot Memory

## Goal

Let the companion remember sparse, meaningful, truthful moments.

Memory is not chat history and not an AI diary.

## Recommended record

```ts
type MascotMemoryKind =
  | 'first_distance'
  | 'longest_journey'
  | 'favourite_activity'
  | 'route_return'
  | 'meaningful_return'
  | 'place_first'
  | 'milestone';

interface MascotMemory {
  id: string;
  kind: MascotMemoryKind;
  occurredAt: ISODateTime;
  provenance: AdventureProvenance;
  facts: Record<string, string | number | boolean>;
}
```

The real implementation should replace the generic example `facts` bag with typed
per-kind payloads. It is shown only to illustrate the separation between deterministic
facts and narration.

## Stable memory IDs

A memory ID should be deterministic from:

```
memory kind
+ rule version
+ stable source identity / threshold
```

This prevents duplicate memories when the app reloads or rebuilds projections.

Example concept:

```
first_distance:v1:5000m
```

Do not use random IDs for memories that are logically the same derived fact.

## Favourite activity

Favourite activity should emerge from shared history.

Possible future deterministic inputs:

- count of completed trusted Journeys per activity type
- total active time
- recency
- repeat tendency

Exact weighting may stay hidden from the user, but the implementation must still be
deterministic and testable.

No memory should be generated merely because the user selected an activity preference
during onboarding.

## Meaningful return after a break

A return memory must not create guilt about the break.

It may recognise:

> "Good to be back here together."

It must not imply:

- streak loss
- failure
- punishment
- "you disappeared"
- medical/mental-health conclusions

The break is a temporal fact; the emotional framing remains gentle.

## AI narration boundary

AI may later turn:

```json
{
  "kind": "route_return",
  "routeVisitCount": 5,
  "daysSinceLastVisit": 87
}
```

into a short companion line.

AI may not decide:

- whether the route was actually visited
- the visit count
- whether the route is a favourite
- whether a PB happened
- distance
- milestone qualification

Those remain deterministic.

# 3. Journey Book

## Goal

A chronological private story layer over real fitness history.

The Journey Book should reference truth rather than duplicate it.

## Event model

Recommended future event categories:

- `mascot_hatched`
- `journey_completed`
- `distance_milestone`
- `new_place`
- `favourite_route`
- `personal_best`
- `mascot_evolved`
- `secret_discovered`
- `champion_moment`
- `legacy_memory`
- `meaningful_return`

Each book entry should contain:

- stable event ID
- event kind
- timestamp
- provenance/source references
- minimal immutable snapshot text/data only where required for historical meaning

Do not copy full Journey objects into every Journey Book row.

## Reference vs snapshot

Reference current truth when current truth is what matters.

Snapshot only when history would become misleading if the source later changed.

Examples:

- Journey ID should reference the Journey
- a user-authored caption may need its own persisted snapshot
- a generated yearly narrative may need to record the exact approved source facts used
  for that recap

This distinction should be explicit per event type.

## Photos

Photos are later work.

When added:

- local-first by default
- explicit user action
- no automatic camera-roll scanning
- metadata/privacy policy must be designed before cloud sync
- a photo must not become fitness proof by itself

## Annual “Our Adventure” recap

The recap should be derived from trusted annual facts:

- Journey count
- trusted distance totals
- activity mix
- places/routes established by deterministic Adventure rules
- approved Mascot Memories
- real milestones

AI may narrate the recap after those facts are fixed.

It may not invent a missing "best day," "favourite place" or relationship milestone.

# 4. “What can I manage today?”

## Goal

Give a person valid effort choices without making one full workout the only successful
outcome.

This belongs to programme logic, not to the Adventure Map or mascot memory layer.

## Principle

A smaller genuine effort remains smaller in fitness truth.

Example:

```
planned 20-minute session
→ user chooses a 5-minute manageable option
→ truth records the real 5-minute activity
→ emotional layer may still respond positively
```

Never rewrite the 5-minute effort into completion of the original 20-minute plan.

## Candidate future choice model

Programme logic may later expose:

- `tiny`
- `short`
- `planned`
- `optional_more`

The names are provisional. The architecture point is that they are **programme-owned
options**, not reward hacks.

Each option must have:

- explicit real activity prescription
- safety constraints
- honest completion criteria
- no fake XP/PB/trophy path

## Safety

Do not infer what somebody "can manage" from health data with unsupported medical
confidence.

The user remains in control.

# 5. Real-world quests without FOMO

## Goal

Turn real movement into optional discovery while preserving safety and autonomy.

## Safe quest shape

A future quest definition should separate:

```
eligibility
+ real-world requirement
+ evidence rule
+ optional presentation reward
```

The evidence rule must use trusted Journey/activity facts.

## Safe examples

- visit a new coarse map cell during a real Journey
- revisit an established route
- complete several distinct real routes over time
- complete a woodland/waterside category only where a trusted safe source can support
  that classification later

## Never

- pressure somebody to go out in dangerous weather
- pressure late-night activity
- reveal sensitive precise locations publicly
- create expiring content that permanently punishes non-participation
- require unsafe trespass
- imply a route is safe merely because another user completed it
- let secret content override fitness/GPS truth

A secret may be downstream of a genuine activity. It may never fabricate the activity.

# 6. Community-created Adventures — future boundary

Do not build this in the local-first foundation phase.

Before launch, it requires separate design for:

- route safety
- privacy
- start/end masking
- moderation
- abuse/reporting
- route-quality confidence
- age/safeguarding implications where applicable
- public/private identity
- content licensing
- deletion and takedown
- precise-location disclosure

The existing `JourneyRoutePrivacy` model is useful groundwork but is not by itself a
community safety system.

# Storage strategy

## Prefer derived/rebuildable records

For Adventure Map and Mascot Memory v1, prefer records that can be rebuilt from trusted
history.

Advantages:

- less duplicated truth
- safer schema migration
- deletion/invalidation is tractable
- backup size remains bounded
- a changed derivation rule can be versioned and re-run

## When persistence is justified

Persist when at least one is true:

- the user authored something
- a one-time historical reveal must remain part of their story
- rebuilding would change a legitimately locked historical meaning
- performance makes projection impractical and the cache is explicitly rebuildable

Do not persist merely because rendering from history is slightly inconvenient.

# Backup and restore

Any future persisted Adventure records must be covered by the same conservative backup
philosophy as Journey history:

- do not silently export corrupted state as empty truth
- schema-version persisted envelopes
- quarantine unreadable data rather than destroying it
- references to Journey IDs must remain valid or degrade explicitly
- old backups without Adventure records must remain non-destructive

Do not extend the backup schema until a concrete runtime slice requires persistence.

# First implementation sequence

Recommended narrow order:

1. **Discovery-only derivation**
   - derive coarse "new place" facts from completed trusted Journey history
   - no persistence
   - no UI beyond tests/dev proof

2. **Adventure Map private projection**
   - minimal private map layer
   - coarse cells / visited places
   - no public sharing

3. **First deterministic Mascot Memories**
   - one or two kinds only
   - stable IDs + provenance
   - no AI required

4. **Journey Book projection**
   - compose existing Journey and approved memory events

5. **Manageable-effort programme slice**
   - separate programme feature, not coupled to map/history

6. **Safe quest framework**
   - only after location/privacy rules are proven

Do not begin community-created Adventures inside these slices.

# Required tests for future runtime slices

At minimum:

- same trusted history derives the same facts every time
- duplicate Journey reads do not duplicate memory IDs
- missing/deleted source Journey removes or invalidates dependent projection
- private Journey route does not leak coordinates through Adventure output
- authoritative Journey distance is never recalculated by Adventure code
- imported Journey provenance remains distinguishable
- no active/recording Journey is prematurely treated as completed history
- AI/narration cannot establish underlying facts
- old backups without Adventure state remain valid
- no reward/XP/progression mutation occurs from reading Adventure projections

# Non-goals

This document does not authorise:

- cloud sync
- public leaderboards
- public route sharing
- social graph
- community route marketplace
- AI-generated fitness truth
- automatic medical coaching
- a new reward economy
- a second Journey recorder
- duplicate raw GPS storage
- new mascot species
- new progression formulas

# Decision summary

Locked architectural direction:

1. **Journey remains truth.**
2. **Adventure facts are deterministic projections.**
3. **Memories carry stable IDs and provenance.**
4. **Narration is downstream of facts.**
5. **Location remains private by default.**
6. **Raw GPS is not duplicated merely to power emotional features.**
7. **Journey Book references truth rather than cloning it.**
8. **Manageable effort stays honest in fitness truth.**
9. **Quests cannot create FOMO or unsafe pressure.**
10. **Community Adventures require a separate safety/privacy/moderation phase.**
