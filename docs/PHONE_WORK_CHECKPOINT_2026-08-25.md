# NinFit Phone-Work Checkpoint — 2026-08-25

**Status:** Handoff/checkpoint only. This file is not a second canonical backlog and does not replace `docs/CURRENT_STATE.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, or merged architecture specifications.

**Purpose:** Preserve the work completed or prepared while working from the phone so the laptop session can resume without losing ideas, PR context, or implementation direction.

## 1. What was completed from the phone

### Merged into `main`

- **PR #17 — Living Journey & Wearable Architecture**
  - defines one real activity = one Journey;
  - preserves source provenance;
  - requires duplicate/reconciliation before PBs, achievements and rewards;
  - separates raw vs accepted GPS evidence;
  - defines pause/time semantics, recovery direction and private-by-default route handling;
  - records Fitbit / Health Connect / Apple HealthKit direction without implementing them.

- **PR #19 — Privacy & Security Readiness**
  - records GPS/location, wearable/health, storage/deletion, security, social and marketing gates.

- **PR #21 — Installable NinFit PWA**
  - adds `manifest.webmanifest`;
  - uses existing generated NinFit icons;
  - adds conservative service-worker registration;
  - Android Chrome recognises NinFit as installable;
  - production Vercel deployment for the merged PWA was verified green.

### Existing earlier merged phone-session work

- **PR #16 — Growth & Marketing Automation Roadmap**
  - preserves the future agent/bot strategy for research, content, creative, paid acquisition, lifecycle and growth analytics.

## 2. Open work prepared from the phone

These are intentionally still draft/open and must be reviewed/merged deliberately rather than assumed complete.

- **PR #18 — Living Journey domain foundation**
  - canonical Journey types, provenance, route evidence, privacy defaults and pure time/source helpers;
  - previously had a deployment/build issue and must be re-verified on laptop before merge.

- **PR #20 — Third-Party Service Register**
  - Vercel, Supabase, maps/OpenStreetMap, GPS, Fitbit, Health Connect, HealthKit/Apple Watch and future analytics/marketing/monitoring providers.

- **PR #22 — Release Readiness Checklist**
  - repository truth, automated checks, mobile/PWA, GPS/privacy, storage/recovery, deployment and rollback gates.

- **PR #23 — Privacy Notice Skeleton**
  - structure only; not a final legal policy or compliance claim.

- **PR #24 — Data Retention & Deletion Matrix**
  - route-only deletion vs whole-Journey deletion;
  - provider disconnect vs deleting imported history;
  - re-import protection;
  - effects of deletion on PB/achievement/reward truth.

- **PR #25 — Environment & Secrets Register**
  - local/test/preview/production/native separation;
  - `VITE_*` values are client-visible;
  - future Fitbit OAuth, Supabase, maps, monitoring, analytics, push and native signing credential boundaries.

- **PR #26 — App Store Package**
  - store copy, screenshot plan, privacy-safe capture rules, permission wording, Play Data Safety / Apple privacy-label preparation and feature-availability guardrails.

## 3. GPS / Living Journey prototype truth

A local GPS spike was built and field-tested before this checkpoint. It must remain separate from production until deliberately graduated through the merged Living Journey architecture.

Known prototype capability from the prior laptop/OpenCode session:

- live phone geolocation;
- map route display;
- start / pause / resume / finish flow;
- synthetic browser verification;
- real phone access through the local HTTPS development server;
- unfinished activity was intentionally memory-only in the spike and refresh could lose it.

Do **not** treat the spike as production GPS, background location, durable persistence, Health Connect or native capability.

## 4. Next product milestone

The target milestone after returning to the laptop is:

> Start a real walk in NinFit, see the live route, finish it, close/reopen NinFit, and still have the completed Journey saved correctly and privately.

Recommended sequence remains:

1. settle and merge the Journey domain foundation;
2. minimum persisted active-recording snapshot;
3. recorder state machine and recovery;
4. GPS quality/filtering contract;
5. route privacy/deletion behaviour;
6. graduate the existing map/GPS spike into the production architecture;
7. real-world phone field testing;
8. Health Connect integration;
9. source deduplication/reconciliation;
10. Fitbit integration;
11. HealthKit / Apple Watch integration.

Do not collapse this sequence into one broad GPS refactor.

## 5. Open-source engineering reference strategy

A useful idea from the phone session should be preserved for future implementation work:

> **Study broadly. Reimplement deliberately. Copy only when the licence has been checked and the reuse is explicitly documented.**

### Primary references to investigate

#### OpenTracks

Use primarily as an engineering reference for:

- GPS recording;
- background recording behaviour;
- pause/resume semantics;
- local/offline-first storage;
- sensor handling;
- route export;
- recovery and failure behaviour;
- privacy-oriented activity tracking.

OpenTracks is expected to be the first reference for Living Journey/GPS engineering. Before copying any code, verify the current licence and document attribution/reuse obligations.

#### wger

Use primarily as a product/data-model reference for:

- workout/routine modelling;
- exercise libraries;
- measurements and progress;
- nutrition concepts;
- API design;
- multi-user fitness platform patterns.

Treat direct source reuse more cautiously. Verify its current licence before any code incorporation; prefer independent implementation of useful concepts unless reuse has been explicitly reviewed.

### Follow-up research task

Create a **NinFit Open-Source Reference Register** covering roughly 10–15 relevant projects across:

- GPS/activity recording;
- mapping/GPX;
- workouts and exercise libraries;
- Android Health Connect;
- Apple HealthKit/watch integration;
- wearable imports;
- activity deduplication;
- charts/progress;
- nutrition;
- offline/local-first storage.

For every project record:

- project/repository;
- what it does especially well;
- current licence;
- whether direct code reuse is acceptable, conditional or unsuitable;
- patterns worth independently implementing in NinFit;
- exact NinFit slice where the reference is useful.

This register should be a reference library, not an excuse for copying architectures wholesale.

## 6. Product principles reinforced during phone work

- Private by default.
- One real-world activity should not become multiple rewarding Journeys because several sources reported it.
- Precise route data is more sensitive than an ordinary workout summary.
- Fitness facts can be derived from precise location without precise location becoming social/public data.
- Delete-route-only should remain possible independently of deleting the whole Journey where architecture permits.
- Disconnecting Fitbit/Health Connect/HealthKit is not automatically the same as deleting historical imported data.
- Deleted/revoked provider records must not silently reappear without defined behaviour.
- Marketing/analytics must not receive raw GPS routes or health streams by default.
- PWA installability is not the same as native APK/iOS capability.
- Background GPS, Health Connect and Apple Watch remain future native/mobile work.

## 7. Laptop restart order

When back at the laptop:

1. establish live repository truth and local working-tree truth;
2. verify PWA installation behaviour on the phone and note any acceptance issues;
3. inspect/fix/verify PR #18 rather than merging blindly;
4. review the docs-only PRs #20 and #22–#26 for merge suitability;
5. locate the local GPS spike and preserve its exact branch/diff;
6. create the Open-Source Reference Register before or alongside GPS graduation research;
7. continue with the next bounded Living Journey implementation slice;
8. keep Phase 8 expansion/reward work separate from Journey correctness work.

## 8. Do not accidentally claim

Until independently verified in the repository/runtime, do not claim that NinFit already has:

- production background GPS;
- durable Journey recovery;
- Health Connect sync;
- direct Fitbit sync;
- HealthKit / Apple Watch sync;
- app-store-native packaging;
- production social route sharing;
- final privacy/legal compliance;
- production approval for planned third-party services.

## 9. Handoff summary

The phone session produced more than documentation: it established the installable PWA shell and durable architecture/privacy direction for Living Journey. The next laptop session should therefore focus on turning the already-working GPS prototype into a correctly persisted, recoverable Journey in controlled slices rather than restarting discovery.
