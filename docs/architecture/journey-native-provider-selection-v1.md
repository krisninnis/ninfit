# NinFit Journey Native Location Provider Selection v1

**Status:** evaluation complete; decisions taken 2026-09-08 (see §7).
**Evaluated:** 2026-09-08, against live registry and vendor documentation, not archived notes.
**Supersedes:** the provisional candidate language in `docs/architecture/journey-native-background-location-v1.md` §"Native technology decision".

## 1. Why this document exists

`journey-native-background-location-v1.md` lists ten acceptance criteria for a background
location provider. Criterion 6 is the one that decides this: *native buffering must not lose
the route when JavaScript is temporarily suspended.* NinFit has already built the JavaScript
half of that contract — `NativeJourneyDurablePositionQueue`, ordered replay, at-least-once
acknowledgement, duplicate-safe reconciliation and durable-safe completion. What remains is a
provider that can actually hold fixes on disk while the WebView is not running.

That single criterion separates the two candidates cleanly, and it is not visible from feature
lists. It had to be read out of the plugins' own documentation.

## 2. Shell

Capacitor 8 is current stable: `@capacitor/core@8.5.1`, published 2026-08-31. A 9.x line exists
in the registry but is not tagged `latest`. Capacitor 8 is therefore the right shell target, as
planned. `@capacitor/cli` requires Node >= 22; the repository already runs Node 22/24.

## 3. Candidate A — `@capgo/background-geolocation` 8.4.3 (MPL-2.0, free)

Published 2026-08-20. Peer dependency `@capacitor/core >= 8.0.0`. Actively maintained; the
plugin's major version tracks Capacitor's.

What it does well: Android foreground service with the required persistent notification, the
Android 13+ `POST_NOTIFICATIONS` runtime flow, configurable notification channel/icon, iOS
background location, and a sticky Android service that survives the app being swiped away.

**Why it fails criterion 6.** Its own API documentation, on `StartOptions.url`, states that
native delivery is by HTTP POST and that *"Delivery is best-effort: there is no on-disk queue
and no automatic retry. Failed POSTs are logged and dropped... points are not persisted across
process death."* The only durable path it offers is uploading each fix to a server.

For NinFit that is a double failure. It cannot satisfy the durable-buffer criterion, and the
mechanism it offers instead — POSTing raw route points to a remote endpoint — is precisely what
the product contract forbids ("no route upload", "precise route data remains local"). Turning
the option on to gain durability would break the privacy contract; leaving it off means fixes
collected while the WebView is suspended are held only in memory.

Adopting it would mean writing NinFit's own Android SQLite persistence layer inside a forked or
wrapped plugin. That is a real engineering project on the critical path, in Kotlin, with no test
coverage in this repository, before any of the existing replay work can be proven on a phone.

## 4. Candidate B — `@transistorsoft/capacitor-background-geolocation` 9.5.0 (commercial)

Published 2026-09-07 — the day before this evaluation. Peer dependency `@capacitor/core ^8.0.0`.

It persists every recorded location to an on-device SQLite database as its normal mode of
operation, and exposes that database directly:

| NinFit queue contract | SDK method |
|---|---|
| `readPending(journeyId)` | `getLocations()`, filtered by the `extras` stamped at Journey start |
| `acknowledgeThrough(journeyId, sequence)` | `destroyLocation(uuid)` per acknowledged record |
| `clear(journeyId)` | `destroyLocations()` |

Local-only operation is a supported configuration, not a workaround: omit `url`, set
`autoSync: false`, and no HTTP request is ever made. `maxRecordsToPersist` and
`maxDaysToPersist` bound the database — both need deliberate values, because `maxDaysToPersist`
defaults to 1 day.

**Adapter mismatch to record honestly.** NinFit's queue uses contiguous integer sequence numbers
and treats a gap as a stop condition. The SDK gives each record a `uuid` and a `timestamp`, not a
sequence. The adapter must assign sequence numbers over the timestamp-ordered read and hold the
uuid mapping for acknowledgement — which means the existing `sequence_gap` guard degrades to
"no gap is detectable from the SDK's records". Route truth is still protected by the trusted-GPS
acceptance gates and by replay idempotence; the guard simply stops being the thing that protects
it. This must be written into the adapter's contract rather than left as a silent weakening.

**Cost.** Perpetual licence, one app identifier, both platforms, unlimited users and devices:
STARTER $399, VENTURE $599 (5 apps), PRO $749 (25 apps), STUDIO $999 (100 apps); one year of
updates included, and licences do not carry across major versions (a v8 key does not open v9).
`DEBUG` builds are fully functional with no licence, and a free 30-day trial licence is
available. Only Android **release** builds require a key — so the entire Samsung acceptance run
in §6 of the background-location document can be executed on a debug build, before any money is
spent.

## 5. Android version facts

For a location foreground service started by a user action while the app is in the foreground:

- **Android 14 (API 34):** the service must declare `android:foregroundServiceType="location"`,
  and the app must hold `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION` and
  `ACCESS_FINE_LOCATION`. A missing type permission is a `SecurityException`, not a warning.
- **Android 15 (API 35):** new runtime duration limits apply to `dataSync` services. Location
  services started from a foreground user action are not further restricted.
- **Android 16 (API 36):** no new restrictions for this case.
- **Android 13+ (API 33):** `POST_NOTIFICATIONS` is a runtime permission, and the ongoing
  Journey notification does not appear without it.

The one Android 16 failure report against the Transistorsoft plugin (issue #378, Pixel 8,
targetSdk 35) was a missing `FOREGROUND_SERVICE_LOCATION` declaration in the app, not an SDK
defect; it was closed without a code change. It is a checklist item for our manifest, not a
mark against the provider.

## 6. Recommendation

**Transistorsoft, evaluated on a debug build first.**

The reasoning is not that it is better software. It is that NinFit has already committed to an
architecture whose whole point is that fixes survive a suspended WebView, and exactly one of the
two candidates can do that without uploading a route to a server. Capgo would require us to
build that layer ourselves, in the least-tested language in the project, on the critical path to
a private beta.

The cost is also sequenced favourably: nothing is payable until an Android release build is
needed, which is after the Samsung acceptance gates. If the SDK fails those gates on real
hardware, no licence has been bought.

Capgo remains a sound fallback for a future variant of the product that is willing to run its
own ingest endpoint. That is a different product.

## 7. Decisions taken — 2026-09-08

1. **Provider: Transistorsoft.** Evaluated on debug builds; no licence is bought until an
   Android release build is actually needed, which is after the Samsung acceptance gates.
2. **Android application ID: `app.ninfit.mobile`.** Permanent. The Play listing and the
   Transistorsoft licence key are both bound to it, so it is not to be changed once a licence
   is issued against it.
3. **Acceptance platform: Android 15 (API 35).** The manifest and permission flow are proven
   against Android 15 first. Exact Samsung model still to be recorded in the acceptance ledger
   at run time — the ledger requires the exact device string, and a version alone is not
   evidence.

## 8. Non-goals

This document does not add a dependency, does not generate the Android project and does not
change any runtime code. It records what is true on 2026-09-08 so the shell slice can be built
from current facts rather than from the provisional note written before the provider boundary
existed.
