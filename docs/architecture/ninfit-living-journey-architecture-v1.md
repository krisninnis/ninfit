# NinFit Living Journey Architecture v1

**Status:** Product/architecture specification — authored, not implemented.  
**Scope:** Permanent journey, GPS, wearable-source, provenance, privacy, recovery and duplicate-handling architecture.  
**Repository:** `krisninnis/ninfit`  
**Product:** NinFit  
**Version:** v1  
**Last updated:** 23 August 2026

---

## 1. Purpose

This document defines the durable contract for NinFit's future **Living Journey** system.
It turns the successful GPS recorder spike into a product architecture that can later support
phone GPS, Fitbit, Health Connect, Apple Watch, HealthKit and other evidence sources without
creating duplicate activities, corrupting fitness history, leaking precise location, or allowing
wearable imports to manufacture rewards.

The central rule is:

> **One real activity becomes one NinFit Journey. Every device contributes evidence; no device owns the truth.**

This is a product/architecture specification. It does not itself authorise runtime implementation,
package changes, native wrappers, production GPS persistence, Health Connect, Fitbit API work,
HealthKit, Apple Watch code, social sharing or reward changes.

---

## 2. Product principles

The Living Journey system must preserve NinFit's existing product direction:

- fitness truth before game presentation;
- calm-by-default interaction;
- no guilt, punishment, fake achievement or pay-to-win progression;
- local-first handling where practical;
- explicit provenance for imported or measured data;
- privacy by default;
- uncertainty must remain visible rather than being silently guessed away;
- achievements and rewards must be based on one real activity, not the number of devices that reported it.

The game layer may celebrate a Journey. It may never decide whether the Journey happened.

---

## 3. Definitions

### 3.1 Journey

A **Journey** is one real-world fitness activity such as a walk, run, hike or cycle.

A Journey may be:

- recorded directly by NinFit;
- imported from one external source;
- enriched by multiple sources;
- manually entered where the relevant feature explicitly allows it.

A Journey is the unit used for history, PB evaluation, achievements and reward evaluation.

### 3.2 Observation

An **Observation** is a measurement or fact supplied by one source, for example:

- Fitbit heart-rate samples;
- NinFit phone GPS points;
- Apple Watch workout duration;
- Health Connect step totals;
- a manually entered activity duration.

Observations are evidence. They are not automatically the preferred displayed value.

### 3.3 Source lineage

Source lineage records **who measured the data and how it arrived in NinFit**.

Conceptually:

```text
observedBy: Fitbit device
transportedBy: Health Connect
importedBy: NinFit Android
```

or:

```text
observedBy: Apple Watch
transportedBy: HealthKit
importedBy: NinFit iPhone
```

Health Connect and HealthKit are transports/data stores, not necessarily the original measuring device.

### 3.4 Derived value

A **Derived value** is calculated by NinFit from preserved observations, for example accepted-route distance,
moving time, average pace or a reconciled preferred metric.

A derived value must never be mislabelled as an original source measurement.

---

## 4. Canonical Journey shape

The exact TypeScript types are deferred to implementation, but the domain model must be capable of representing:

```text
Journey
├── identity
├── activity type
├── start/end time
├── elapsed time
├── moving time
├── explicit paused time
├── route
├── distance
├── pace/speed
├── elevation
├── heart rate
├── steps
├── source observations
├── source lineage
├── GPS quality
├── privacy policy
├── recorder/recovery state
└── provenance
```

Initial activity types should support at least:

- walk;
- run;
- hike;
- cycle;
- other.

Adding a new activity type must not require a new Journey architecture.

---

## 5. Provenance contract

Every externally supplied or directly measured metric must retain enough provenance to answer:

> **Where did this value come from?**

At minimum, an observation should be capable of recording:

- metric kind;
- value/unit;
- timestamp or interval where relevant;
- original measuring source;
- transport/import path where relevant;
- whether it is measured, imported, manual or derived;
- source-specific identifier when available;
- quality metadata where available.

NinFit must never silently rewrite an original source observation.

Example:

```text
Fitbit distance: 2.71 km
NinFit GPS distance: 2.84 km
Preferred Journey distance: 2.84 km
```

Both source observations remain preserved even if the UI currently prefers one.

---

## 6. One activity, multiple sources

One Journey may contain evidence from several sources.

Example:

```text
Journey: outdoor walk

Primary recording
└── NinFit Android
    ├── GPS route
    ├── elapsed time
    └── accepted-route distance

Supporting observations
├── Fitbit
│   ├── heart rate
│   ├── steps
│   └── workout classification
└── Health Connect
    └── Fitbit-derived workout record
```

The Health Connect copy must not create a second Journey when NinFit can establish that it represents the same real activity.

---

## 7. Metric-specific source preference

NinFit must not have a single global rule such as "Fitbit wins" or "phone wins".

Source preference is **metric-specific** and may evolve without deleting source observations.

Initial direction:

### Route

Prefer the strongest directly recorded usable GPS evidence, considering quality and completeness.

### Heart rate

Prefer a direct wearable or dedicated sensor measurement over inferred/manual values where provenance is trustworthy.

### Steps

Prefer a consistent pedometer/wearable source over manual values when available.

### Elapsed duration

Prefer the original recorder's start/end timeline unless that record is malformed or explicitly superseded.

### Distance

Prefer distance derived from a trustworthy accepted route when available; otherwise use the best supported source observation.

This section defines principles, not a permanent hard-coded ranking. Exact selection rules require focused implementation tests.

---

## 8. Duplicate and identity matching

Duplicate handling must happen **before** PB, achievement or reward evaluation.

When a new activity record arrives, NinFit compares it against plausible recent Journeys using multiple signals.

Signals may include:

- start-time proximity;
- end-time/duration similarity;
- activity-type compatibility;
- distance similarity;
- route similarity where available;
- source lineage;
- external source identifiers;
- evidence that one record was transported from another source.

Time overlap alone can never prove identity.

### 8.1 High-confidence match

If evidence strongly establishes that an incoming record belongs to an existing Journey, attach the new observations to that Journey.

Do not create another fitness activity. Do not award additional rewards.

### 8.2 Medium-confidence match

If the records may be the same but confidence is insufficient, do not silently merge or destroy either record.

The product may later offer a user decision such as:

```text
These may be the same walk.
[Combine] [Keep separate]
```

Until resolved, reward logic must avoid double-counting where identity remains materially uncertain.

### 8.3 Low-confidence match

Create a separate Journey.

### 8.4 Source-lineage shortcut

If an incoming Health Connect/HealthKit record carries trustworthy lineage proving it originated from an already-imported source record, that lineage is stronger evidence than simple timestamp similarity.

---

## 9. Reward protection

The required ordering is:

```text
incoming record
→ validate
→ establish source/provenance
→ identity / duplicate matching
→ create or enrich Journey
→ fitness calculations
→ PB / achievement evaluation
→ reward evaluation
→ presentation
```

Never:

```text
import
→ award reward
→ discover duplicate later
```

One real Journey may produce rewards only once for the same qualifying event.

Manual entries may participate in fitness history where the relevant feature allows them, but achievement classes may require stronger evidence.

Examples:

- history entry: manual may be allowed;
- weekly consistency: product rule may allow manual completion;
- GPS exploration: location evidence required;
- fastest measured route/5K: trustworthy measured timing/distance required;
- location-specific achievement: qualifying location evidence required.

Secret Prestige, Champion, trophies and other game systems remain governed by their own product contracts.

---

## 10. GPS evidence model

The permanent recorder must distinguish **raw GPS fixes** from **accepted route points**.

Conceptually:

```text
raw fix
→ quality evaluation
→ accepted / rejected
→ accepted route
→ derived distance / pace
```

A GPS fix should be capable of preserving:

- latitude;
- longitude;
- timestamp;
- reported accuracy;
- altitude where available;
- speed where available;
- heading where available;
- provider/source metadata where available.

Rejected points should be diagnosable during development rather than silently disappearing without reason.

---

## 11. GPS filtering principles

Do not use one arbitrary distance threshold as the entire filtering algorithm.

Point acceptance should consider a combination of:

- reported accuracy;
- elapsed time since previous accepted fix;
- plausible movement/speed;
- previous accepted position;
- repeated stationary behaviour;
- impossible teleport-like jumps;
- duplicate fixes;
- route continuity;
- device/provider quality where available.

The goal is to reduce stationary drift and impossible spikes without deleting genuine slow movement.

Slow walkers must not be treated as stationary merely because their speed is low.

The successful GPS spike exposed visible stationary drift; this specification treats that as useful evidence for the permanent recorder, not as proof of a particular filtering constant.

---

## 12. Time semantics

The Journey model must distinguish:

- **elapsed time** — time from start to finish;
- **explicit paused time** — user-requested pause intervals;
- **moving time** — derived time associated with accepted movement, when supported.

Explicit pause must stop distance accumulation and moving-time accumulation for the recorder.

Initial production implementation should not silently introduce auto-pause. Auto-pause may be evaluated later as an optional behaviour because it can misclassify slow movement.

---

## 13. Recorder state machine

The permanent recorder should be designed around explicit states rather than scattered booleans.

Core flow:

```text
READY
  ↓
ACQUIRING_GPS
  ↓
RECORDING
  ↕
PAUSED
  ↓
FINISHING
  ↓
COMPLETED
```

Recoverable conditions may include:

```text
GPS_WEAK
GPS_LOST
APP_BACKGROUND
INTERRUPTED
RECOVERY_PENDING
```

These conditions must not automatically mean the Journey failed.

---

## 14. GPS loss and gaps

Loss of reliable GPS does not equal loss of the Journey.

During a GPS gap, NinFit should:

- preserve elapsed time;
- retain the last valid accepted fix;
- mark that a location gap occurred;
- avoid inventing intermediate coordinates;
- resume collecting accepted route points when trustworthy fixes return;
- preserve enough quality metadata to explain that part of the route was uncertain or absent.

The UI may later communicate weak/no GPS honestly.

NinFit must not manufacture a perfect route through an interval it did not measure.

---

## 15. Minimum active-recording snapshot

A permanent active Journey must persist enough state to recover safely after interruption.

The minimum snapshot should be capable of retaining:

- Journey ID;
- activity type;
- recorder state;
- start time;
- last state-transition time;
- accumulated explicit paused time;
- accepted GPS points so far;
- last valid GPS fix;
- current derived distance or sufficient data to recompute it;
- source/provenance metadata;
- GPS-quality summary;
- Journey privacy settings;
- last successful persistence timestamp.

Transient presentation state such as map zoom, open panels or animation state does not belong in this snapshot.

---

## 16. Recovery behaviour

On application startup, a valid active-recording snapshot should permit a recovery flow such as:

```text
Active Journey found
→ validate snapshot
→ offer recovery
→ Resume / Finish / Discard
```

Implementation must define safe rules for stale or malformed snapshots before shipping.

A malformed snapshot must not be converted into a fabricated completed Journey.

Recovery actions that delete data are consequential and must remain explicit.

---

## 17. Privacy contract

Every Journey is **private by default**.

Privacy must be represented in the Journey architecture rather than added only when social features arrive.

Storage precision and sharing precision are separate concepts.

A user may keep exact route evidence for their own fitness calculations while exposing only a masked or summary representation elsewhere.

---

## 18. Route visibility levels

The future sharing model should support at least these concepts:

| Visibility | Meaning |
|---|---|
| Private | Only the user can access the Journey route. |
| Summary only | Fitness summary may be shared; no route geometry is exposed. |
| Masked route | A privacy-transformed route may be shared. |
| Full route | Exact route sharing requires explicit opt-in. |

Default: **Private**.

No social feature may silently promote a route from private to shared.

---

## 19. Sensitive-location protection

NinFit should support user-defined privacy zones for sensitive locations such as home, work, school or care locations.

The product should not silently label a recurring location as "home" and permanently store that semantic label without user action.

A future prompt may offer:

> You often start journeys near here. Add a privacy zone?

The user decides whether to create it.

Shareable route generation should apply privacy transformation before content reaches a social/share surface.

---

## 20. Route representations

The architecture should allow distinct representations:

```text
raw GPS evidence
→ accepted private route
→ privacy-transformed route
→ shareable representation
```

Changing a privacy zone should permit regeneration of the shareable representation without corrupting the user's original fitness record.

---

## 21. Deletion controls

The data model must allow future product controls for:

### Delete route only

Remove precise route/location data while retaining non-location fitness facts where technically and legally appropriate, for example:

- duration;
- distance summary where retained by user choice;
- heart rate;
- steps;
- eligible non-location achievements.

### Delete entire Journey

Remove the Journey and its associated data according to the product's deletion contract.

### Delete location history

A future bulk location deletion control must be possible without requiring the entire fitness account/history to be destroyed.

Exact deletion semantics require their own destructive-data specification before implementation.

---

## 22. Cloud sync boundary

Precise route sync must not be bundled invisibly into generic account/cloud sync.

The architecture must permit separate consent such as:

```text
Sync fitness summaries       ON
Sync precise journey routes  OFF
```

This document does not authorise cloud route storage.

Any future cloud implementation must undergo privacy/security review and define retention, encryption, access, deletion and export behaviour before precise routes leave the device.

---

## 23. Achievement privacy

Location evidence may establish an achievement without making precise coordinates social data.

Conceptually:

```text
precise GPS evidence
→ qualifying rule
→ achievement fact
→ mascot/reward presentation
```

The game layer should receive only the evidence/result it needs.

Example: qualifying for a named summit achievement does not automatically publish the user's route, timestamp or homeward path.

---

## 24. Living Journey product layer

Once fitness truth is established, NinFit may build a calmer narrative layer over Journey history.

Possible future derived concepts include:

- first visit to an area;
- familiar route;
- repeated local journey;
- personal route history;
- fastest/longest verified journey;
- exploration milestones;
- mascot shared-history memories;
- location achievements where product rules explicitly allow them.

Illustrative presentation:

```text
FAMILIAR JOURNEY
You've walked this way 12 times.
```

or:

```text
YOUR JOURNEY
First walked: 14 September 2026
Times visited: 23
Longest: 4.8 km
Fastest: 12:42 / km
```

These are future product possibilities, not implementation requirements for the first permanent Journey slice.

---

## 25. Wearable integration direction

The architecture must permit these source paths without redesigning Journey identity:

```text
NinFit phone GPS
Fitbit → Health Connect → NinFit Android
Fitbit API → NinFit (if later justified)
Android wearable → Health Connect → NinFit
Apple Watch → HealthKit → NinFit iPhone
Manual activity → NinFit
```

Which integrations are actually implemented must be decided through separate discovery/spec slices based on current platform capabilities, permissions, policy and user value.

This document intentionally does not promise that every device exposes every metric.

---

## 26. Initial implementation sequence

Subject to repository discovery and the delivery loop, the recommended sequence is:

1. Journey domain model;
2. source/provenance model;
3. GPS quality/filtering domain logic;
4. local active-Journey persistence and recovery model;
5. graduate the phone GPS recorder from spike to bounded production slice;
6. completed Journey persistence/history;
7. Journey completion/history UI;
8. Android Health Connect discovery and importer contract;
9. duplicate/reconciliation implementation;
10. Fitbit real-device integration testing;
11. HealthKit/Apple Watch discovery and implementation;
12. Living Journey intelligence;
13. mascot/reward integrations that consume verified Journey facts.

This sequence is directional. Each implementation slice still requires repository truth, a bounded change boundary and focused verification.

---

## 27. First production slice boundary

The first implementation slice after this architecture is approved should be deliberately small.

Recommended target:

> **Create the pure Journey/provenance domain foundation without UI, native APIs, wearable imports, route persistence or reward changes.**

Expected characteristics:

- pure TypeScript domain types/helpers;
- explicit provenance/source-lineage representation;
- no Health Connect/HealthKit package choice yet;
- no native permissions;
- no schema migration unless separately specified;
- focused domain tests;
- no GPS UI changes;
- no reward changes.

If existing persistence/schema constraints make this impossible, discovery must report that before implementation expands scope.

---

## 28. Verification contract for later implementation

Future implementation must prove the behaviour at the layer being changed.

Minimum classes of tests expected across the programme include:

- Journey identity and validation;
- provenance preservation;
- source lineage;
- duplicate matching edge cases;
- no duplicate reward eligibility;
- GPS point acceptance/rejection;
- stationary drift cases;
- impossible jump cases;
- slow legitimate movement;
- pause/resume semantics;
- GPS loss/gap handling;
- active snapshot recovery;
- malformed recovery fail-closed behaviour;
- route-only deletion when implemented;
- privacy transformation when implemented;
- real-device field tests before calling GPS behaviour production-ready.

A passing synthetic test suite does not replace a real-world GPS field test.

---

## 29. Non-goals of this specification

This document does **not** define or authorise:

- immediate production integration of the current GPS spike;
- exact GPS filtering constants;
- exact duplicate confidence percentages;
- Fitbit API credentials or OAuth;
- Health Connect implementation packages;
- HealthKit/Apple Watch native code;
- automatic cloud upload of routes;
- social feeds;
- public leaderboards;
- location sharing defaults other than private-by-default;
- automatic home detection;
- auto-pause;
- calorie algorithms;
- medical interpretation of wearable data;
- new XP amounts;
- new reward kinds;
- PB formulas;
- Champion/Prestige rules;
- background-location permission prompts;
- pricing or subscription gates.

Each requires its own appropriate discovery, product or implementation slice.

---

## 30. Decisions intentionally deferred

The following questions remain open for later evidence-based slices:

- exact Journey persistence/schema shape;
- whether accepted raw GPS evidence is retained indefinitely or compacted after validation;
- GPS quality scoring and thresholds by platform;
- exact duplicate-confidence model;
- how unresolved possible duplicates affect user-visible history;
- whether Fitbit direct API access adds enough value beyond platform health stores;
- precise Android background-recording architecture;
- precise iOS background-recording architecture;
- route simplification strategy;
- map tile/provider production policy and offline-map behaviour;
- privacy-zone radius/shape and user controls;
- cloud route encryption/retention model if cloud sync is authorised later;
- sharing UX;
- Living Journey geographic clustering logic;
- which achievements require which evidence classes.

Deferred means **not decided**, not permission to decide silently during implementation.

---

## 31. Acceptance criteria for this architecture

This specification is successful when future NinFit work can answer all of the following without reinventing the model:

- What is the unit of one real activity? **Journey.**
- Can several devices contribute to it? **Yes.**
- Are original measurements preserved? **Yes.**
- Does Health Connect/HealthKit automatically become the measuring source? **No; lineage is retained.**
- Can duplicate imports create multiple rewards? **No.**
- Can uncertain duplicate matches be silently destroyed/merged? **No.**
- Does a GPS outage mean the Journey failed? **No.**
- May NinFit invent missing GPS coordinates? **No.**
- Is precise route sharing on by default? **No.**
- Can route privacy differ from fitness-history retention? **The architecture must allow it.**
- Can precise location prove an achievement without becoming social data? **Yes.**
- Does the mascot/game layer establish fitness truth? **No.**

---

## 32. Architecture summary

The permanent architecture is:

```text
REAL ACTIVITY
     ↓
SOURCE OBSERVATIONS
(phone / wearable / health store / manual)
     ↓
VALIDATION + PROVENANCE
     ↓
JOURNEY IDENTITY / DUPLICATE RESOLUTION
     ↓
ONE NINFIT JOURNEY
     ↓
METRIC RECONCILIATION + DERIVED FITNESS FACTS
     ↓
PRIVATE FITNESS HISTORY
     ↓
PB / ACHIEVEMENT / LIVING JOURNEY FACTS
     ↓
MASCOT + REWARD PRESENTATION
```

**One real activity becomes one NinFit Journey. Every device contributes evidence; no device owns the truth.**
