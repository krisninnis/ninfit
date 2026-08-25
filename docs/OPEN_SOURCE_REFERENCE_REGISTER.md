# NinFit Open-Source Reference Register

Status: engineering research register, not a dependency approval list.

## Rule

**Study broadly. Reimplement deliberately. Copy only when the licence has been checked and the reuse is explicitly documented.**

This register exists to stop NinFit reinventing mature fitness engineering while also preventing accidental licence contamination. A project appearing here does not approve copying its source into NinFit.

## Priority references

| Project | Best NinFit use | Licence posture | Default reuse posture |
| --- | --- | --- | --- |
| OpenTracks | GPS recording, offline-first journeys, sensors, track lifecycle, exports | Apache-2.0 | Strong reference. Direct reuse still requires attribution/licence review. |
| wger | Workout/routine modelling, exercise/nutrition data concepts, API boundaries, multi-user fitness platform ideas | AGPL-3.0-or-later application code | Study concepts; independently implement by default. Do not copy application code without explicit licence decision. |
| wger Flutter | Mobile fitness UX and client/API separation | AGPL-3.0-or-later with app-store exception | Study architecture/UX; independently implement by default. |
| FitoTrack | Workout recording UX, route/map presentation, pace/speed/statistics | GPL-3.0 | Study behaviour and tests; independently implement by default. |
| RunnerUp | Android run tracking, workout recording, sensors and activity history | Verify before use | Research reference only until licence and current repository are verified. |
| Gadgetbridge | Wearable interoperability, device capability boundaries, local-first/privacy patterns | Verify per component before use | Research reference only; particularly useful for wearable edge cases. |

## OpenTracks — primary Living Journey reference

Repository moved from GitHub to Codeberg; the archived GitHub project identifies the code as Apache-2.0 and describes a privacy/offline-focused Android sports tracker.

Study for:

- location sample acceptance and rejection;
- GPS lifecycle and interruption handling;
- recording while the UI is not foregrounded;
- pause/resume semantics;
- distance and track statistics derivation;
- SQLite/local persistence patterns;
- Bluetooth LE heart-rate sensor boundaries;
- GPX/KML/KMZ-style export concepts;
- avoiding unnecessary analytics/cloud dependencies;
- recovery after process/app interruption.

NinFit must not assume OpenTracks thresholds or algorithms are automatically correct for our product. Extract the problem, evidence and edge cases, then implement against NinFit's Journey domain and tests.

## wger — primary broader fitness-platform reference

wger is a self-hostable fitness/workout, nutrition and weight platform with a REST API. Its application code is AGPL-3.0-or-later.

Study for:

- routine/workout modelling;
- exercise-library organisation;
- measurements and progress concepts;
- nutrition-domain boundaries;
- API resource design;
- separation of public reference data from user-owned data;
- multi-user/account concepts;
- mobile-client/API boundaries.

Because of the AGPL posture, NinFit's default is clean independent implementation of useful concepts rather than source copying.

## FitoTrack — secondary GPS/workout UX reference

FitoTrack is an open-source Android workout logger covering running, cycling, hiking and other sports. Its public repository identifies GPL-3.0 licensing.

Study for:

- start/record/finish workout UX;
- map + live-stat hierarchy;
- workout history presentation;
- pace, speed and distance presentation;
- route review after completion;
- privacy-friendly no-ad/no-tracking product expectations.

Default: independent implementation.

## Research queue

Before a project can influence production code, record its current canonical repository, licence file, maintenance status and exact NinFit question being investigated.

Priority queue:

1. OpenTracks — GPS sample filtering and distance derivation.
2. OpenTracks — persistence/recovery/background recording lifecycle.
3. FitoTrack — recorder and completed-workout UX.
4. RunnerUp — GPS/sensor/workout edge cases after repository/licence verification.
5. Gadgetbridge — wearable provenance, reconnects, duplicate samples and local-first patterns after component/licence verification.
6. wger — routines/exercises/progress/API modelling.
7. wger Flutter — mobile client/API and offline/error UX.
8. Health Connect sample/reference implementations — Android permission, provenance and deduplication patterns.
9. Apple HealthKit sample/reference implementations — iOS permission/query/provenance patterns.
10. GPX/map libraries — import/export and route-rendering boundaries, each licence checked separately.

## Living Journey research questions

These are the questions to answer before graduating the GPS spike:

### Sample acceptance

- What accuracy values should cause a point to be rejected, accepted or marked uncertain?
- How are impossible jumps and implausible speeds detected?
- How are stale timestamps, duplicate timestamps and out-of-order samples handled?
- Does altitude need independent accuracy/filtering?
- What happens after a long GPS gap?
- When should a new segment begin rather than connecting two points?

### Distance

- Is distance derived only from accepted consecutive samples?
- How are pause boundaries handled?
- How are GPS gaps handled without drawing false straight-line distance?
- Is raw distance preserved separately from user-facing/filtered distance?
- How is recomputation versioned when algorithms improve?

### Recovery/background lifecycle

- What state must be persisted after each accepted sample?
- What is recoverable after browser refresh, process death and device reboot?
- What requires native Android/iOS background capability rather than PWA behaviour?
- How does NinFit avoid silently claiming continuous recording when the OS stopped location delivery?

### Provenance

- Every derived metric must remain traceable to its source observations and algorithm/version where practical.
- Imported wearable distance must not silently overwrite phone-GPS distance.
- Conflicting sources should be reconciled explicitly rather than averaged by accident.

## Licence gate

Before copying or adapting source rather than merely learning from behaviour/design:

1. Open the canonical project's licence file at the exact revision being considered.
2. Record the file/function being considered and why reuse is preferable to independent implementation.
3. Check attribution, notice, source-disclosure, redistribution and app-store implications.
4. Prefer permissive components where equivalent choices exist.
5. For GPL/AGPL or uncertain licensing, stop direct reuse until an explicit project-level decision is recorded.
6. Preserve third-party notices required by approved dependencies/reuse.

This is an engineering guardrail, not legal advice.

## Immediate decision for Phase 8

For the next production slice, OpenTracks is the first reference to investigate for **GPS acceptance/filtering and distance derivation**. NinFit should then implement its own small, pure, tested acceptance contract in the Journey domain rather than importing an Android tracker wholesale.

The target sequence remains:

`reference research -> GPS acceptance/filtering -> distance derivation -> recorder integration -> recovery wiring -> completed Journey persistence -> production map -> route privacy -> completion -> PB/achievement handoff -> Android field acceptance`
