# NinFit Phone-Work Checkpoint — 2026-08-25

**Status:** Handoff/checkpoint only. This file does not replace `docs/CURRENT_STATE.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, or merged architecture specifications.

**Purpose:** Preserve the work completed or prepared while working from the phone so the laptop session can resume without losing implementation direction.

## 1. Merged during the phone session

- **PR #16 — Growth & Marketing Automation Roadmap**
- **PR #17 — Living Journey & Wearable Architecture**
- **PR #19 — Privacy & Security Readiness**
- **PR #20 — Third-Party Service Register**
- **PR #21 — Installable NinFit PWA**
- **PR #22 — Release Readiness Checklist**
- **PR #23 — Privacy Notice Skeleton**
- **PR #24 — Data Retention & Deletion Matrix**
- **PR #25 — Environment & Secrets Register**
- **PR #26 — App Store Package**

Together these establish the product, privacy, deployment and release guardrails needed before GPS/wearable work expands.

The PWA has been recognised by Android Chrome as installable. This does **not** mean NinFit is a native APK/iOS app, has background GPS, or has Health Connect/HealthKit support.

## 2. Remaining production-code foundation

**PR #18 — Living Journey domain foundation** remains the production-code PR requiring deliberate review before merge.

Its intended bounded scope is:

- canonical Journey activity/status/source/provenance/metric/route/privacy/pause types;
- raw GPS evidence kept separate from accepted route points;
- private-by-default Journey privacy constants;
- pure elapsed/paused/active time helpers;
- source-lineage lookup and source-id integrity helpers;
- focused domain tests;
- no persistence, UI, GPS filtering, wearable integration, rewards or spike promotion.

Do not merge it merely because the docs stack is settled. Verify its diff and checks independently.

## 3. GPS / Living Journey prototype truth

A local GPS spike was built and field-tested before this checkpoint. It must remain separate from production until deliberately graduated through the Living Journey architecture.

Known prototype capability:

- live phone geolocation;
- map route display;
- start / pause / resume / finish flow;
- synthetic browser verification;
- real phone access through the local HTTPS development server;
- unfinished activity intentionally memory-only, so refresh could lose it.

Do **not** treat the spike as production GPS, background location, durable persistence, Health Connect or native capability.

## 4. Next product milestone

> Start a real walk in NinFit, see the live route, finish it, close/reopen NinFit, and still have the Journey saved correctly and privately.

Recommended graduation sequence:

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

Locked working rule:

> **Study broadly. Reimplement deliberately. Copy only when the licence has been checked and the reuse is explicitly documented.**

### OpenTracks

Primary engineering reference for GPS/Living Journey topics such as recording, background behaviour, pause/resume, local-first storage, sensor handling, route export, recovery and privacy-oriented tracking.

Before direct code reuse, verify the current licence and document attribution/reuse obligations.

### wger

Primary broader fitness-platform reference for workout/routine modelling, exercise libraries, progress/measurements, nutrition concepts, API design and multi-user patterns.

Treat direct source reuse more cautiously; prefer independent implementation of concepts unless reuse has been explicitly reviewed against the current licence.

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

For every project record the repository, what it does well, current licence, reuse status, patterns worth independently implementing, and the exact NinFit slice where it is useful.

## 6. Product principles reinforced during phone work

- Private by default.
- One real activity should not become multiple rewarding Journeys because several sources reported it.
- Precise route data is more sensitive than an ordinary workout summary.
- Delete-route-only should remain possible independently of deleting the whole Journey where practical.
- Disconnecting a provider is not automatically the same as deleting historical imported data.
- Deleted provider records must not silently reappear without defined behaviour.
- Marketing/analytics must not receive raw GPS routes or health streams by default.
- Game/reward systems consume verified fitness facts; they do not decide whether activity happened.
- PWA installability is not native capability.

## 7. Laptop restart order

1. establish live repository truth and local working-tree truth;
2. verify installed-PWA behaviour on the phone and record any acceptance issues;
3. inspect/fix/verify PR #18 rather than merging blindly;
4. locate and preserve the exact local GPS spike branch/diff;
5. create the Open-Source Reference Register before or alongside GPS graduation research;
6. begin the next bounded Living Journey slice: active-recording persistence/recovery foundation;
7. keep reward/Phase 8 expansion separate from Journey correctness work.

## 8. Do not accidentally claim

Until independently verified, do not claim that NinFit already has:

- production background GPS;
- durable Journey recovery;
- Health Connect sync;
- direct Fitbit sync;
- HealthKit / Apple Watch sync;
- native app-store packaging;
- production social route sharing;
- final privacy/legal compliance;
- production approval for planned third-party services.

## 9. Handoff summary

The phone session moved NinFit beyond planning-only work: the installable PWA is merged, and the Living Journey architecture plus its privacy/release support documents are now in `main`. The next engineering focus is to settle the Journey domain foundation and then graduate the already-working GPS prototype into a persisted, recoverable Journey in controlled slices.