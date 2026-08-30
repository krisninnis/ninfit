# Local-first Pilot Evidence Pack v1

## Status

**Acceptance plan / evidence ledger. This document does not claim the pilot gates are
complete.**

NinFit's production-readiness review identifies local recovery/privacy evidence as the
main blocker before a real local-first pilot. This pack turns that blocker into a
finite checklist that can be executed and signed off without prematurely building
cloud sync or new infrastructure.

## Principle

NinFit currently stores fitness truth locally.

That means pilot readiness depends more on:

- honest backup/restore
- recoverable corruption handling
- migration safety
- quota/write-failure behaviour
- clear deletion/device-loss communication

than on backend scale.

Do not solve a local-first evidence problem by introducing a cloud database.

## Current known capabilities

Repository evidence already establishes that NinFit has:

- versioned domain/storage data
- a `StorageAdapter` boundary
- localStorage-backed runtime persistence
- JSON backup/export
- JSON import/restore
- CSV export
- quarantine patterns for unreadable records
- conservative Journey history backup reads
- authoritative Journey restore rules
- Data screen controls
- optional NinFit ID separated from local fitness truth

These are capabilities. They are **not** the same as having completed the pilot drills
below.

# Gate A — Backup and restore rehearsal

## Objective

Prove that a realistic NinFit history can be exported and restored without losing or
inventing fitness/Journey/game truth.

## Test fixture must include

At minimum:

- user profile
- preferred display units
- baseline measurement
- several measurements
- multiple DailyLogs
- WeeklyPlans
- completed activities
- game state
- game settings
- awarded keys / rewards already earned
- pending reward delivery state where supported
- hatched Starter Tortoise state
- at least two completed Journeys
- trusted accepted route points
- Journey `segmentStarts`
- authoritative `distance_m` observations
- Journey provenance/source records
- Journey privacy settings
- one imported Journey if supported by existing fixtures

Do not use an empty or near-empty demo as the only proof.

## Procedure

1. create the realistic fixture through approved repository/app boundaries
2. export JSON backup
3. record backup schema/version
4. create a clean storage target
5. import/restore backup
6. compare restored authoritative state to source
7. restart/re-read from storage rather than trusting in-memory objects
8. inspect UI summary/Data/Journey history
9. export again from restored state
10. compare the second export for expected semantic equivalence

## Must prove

- no duplicate Journey history
- no duplicate rewards
- no lost accepted route points
- no invented route points
- authoritative distance unchanged
- provenance unchanged
- profile/measurement units remain semantically correct
- privacy settings remain intact
- game progression is not reset or re-awarded
- old backup behaviour remains backward-compatible where current import contract says
  it should

# Gate B — Schema migration N → N+1

## Objective

Prove the next persisted-schema change can be introduced without silently discarding
old local history.

This gate must be re-run for every real persisted-schema version increase.

## Before changing a schema

Record:

- old schema version
- new schema version
- migration function/owner
- fields added/removed/renamed
- defaulting rules
- whether migration is reversible
- how an interrupted migration behaves

## Required fixture classes

- minimal valid old record
- realistic old record
- old record with optional fields absent
- boundary values
- corrupted old record
- already-new record

## Pass conditions

- valid old data migrates deterministically
- new defaults do not fabricate fitness facts
- corrupted values quarantine/fail closed according to the owning boundary
- already-new data is not double-migrated
- repeated reads do not continue mutating storage
- export after migration reports the current schema
- migration does not grant XP/rewards merely because the app reread old history

# Gate C — Corruption and quarantine

## Objective

Prove unreadable local data does not become believable empty truth and is not
destructively overwritten merely by being read.

## Required cases

- malformed JSON
- wrong envelope shape
- wrong schema version
- Journey history not a list
- unreadable game reward-delivery queue
- invalid daily record shape/date-key mismatch where applicable
- partially corrupt state beside still-valid independent records

## Pass conditions

- affected read fails/degrades only within the documented boundary
- original unreadable payload is retained or quarantined where the current contract
  promises that
- unrelated valid records remain usable
- the UI does not tell the user "you have no history" when the real condition is
  "history could not be read" in a backup/destructive context
- backup must not export known-corrupt Journey history as authoritative empty history

# Gate D — Interrupted/failed import

## Objective

Prove a failed restore does not leave a plausible but silently partial new history.

Browser storage cannot make a multi-record replacement truly transactional, so the
accepted behaviour must be explicit.

## Failure injection points

Exercise failures:

- before validation completes
- after validation but before first write
- during a write
- after some records have been written
- while writing Journey history
- while writing game/progression state

Use a StorageAdapter test double that throws deterministically at selected operations.

## Evidence to record

For every injected point:

- original storage before import
- writes attempted
- storage after failure
- visible error returned to UI
- whether a backup/recovery path remains available
- whether retry is safe/idempotent

If partial replacement is possible, the product must communicate it honestly and the
recovery procedure must be documented before pilot.

Do not claim "transactional restore" unless the implementation actually provides it.

# Gate E — Quota/write failure

## Objective

Prove storage write failure is surfaced without pretending a save succeeded.

## Required cases

Simulate adapter throws for:

- DailyLog write
- profile/measurement write
- Journey completion/history write
- game-state write
- backup metadata write where applicable

## Pass conditions

- failure is observable
- app does not display a false "saved" state
- authoritative in-memory values are not treated as durably persisted unless they are
- existing stored history is not cleared as recovery
- no automatic destructive cleanup is attempted

The pilot acceptance may choose a limited user-facing recovery experience for v1, but
the limitation must be explicit.

# Gate F — Clear/delete behaviour

## Objective

Define exactly what the user can delete and what each action means.

Before pilot, document whether NinFit provides:

- delete one DailyLog
- delete one measurement
- delete one Journey
- clear local fitness history
- clear game/progression state
- clear all local NinFit data
- delete optional remote NinFit ID account

These are not equivalent operations.

## Safety rule

A future "Delete all local data" action must:

- clearly state that local fitness history will be removed
- distinguish local data from optional remote identity
- require deliberate confirmation
- not be disguised as a cache/update fix
- not silently delete exported backup files
- not claim to delete Supabase identity unless that action genuinely does so

Do not add the button merely to satisfy this document; design/implement it as its own
reviewed slice if the current product lacks it.

# Gate G — Device loss / browser reset wording

## Required user-facing truth

NinFit must say plainly:

- fitness history is currently stored on this device/browser
- signing into NinFit ID does not currently mean fitness cloud backup
- clearing browser/site storage can delete local history
- uninstalling/removing an installed PWA may affect local data depending on platform
- exporting a JSON backup is the current portable recovery mechanism

Avoid vague promises such as "your data is safe" without naming where it is stored.

## Phone-update interaction

The mobile/PWA update workflow must never instruct users to clear site data as a
routine way to obtain the latest build.

Update troubleshooting order should be:

1. verify production deployment is Ready
2. close/reopen installed app while online
3. verify build/version identifier where available
4. only consider destructive browser-storage steps after exporting a backup

# Gate H — Supported-device acceptance

For the first supervised pilot, record the actually tested matrix rather than claiming
generic web support.

Recommended minimum:

- Android Chrome browser
- Android installed PWA
- iPhone Safari
- iPhone Add to Home Screen PWA where available
- narrow mobile width ~360
- mainstream mobile width ~390/430
- tablet ~768
- desktop

For each, verify:

- launch
- navigation
- theme
- Today
- Week
- Journey Home
- active Journey permissions/behaviour where real device testing is authorised
- Progress
- Profile
- Settings
- Data backup export
- backup file selection/import UI
- offline/online PWA behaviour where applicable
- no horizontal overflow
- reduced motion where practical

Do not state that native Health Connect/HealthKit is covered; those integrations are
future work.

# Gate I — Accessibility acceptance

Minimum pilot evidence:

- keyboard navigation on desktop
- visible focus
- screen-reader-labelled controls for critical forms
- text zoom/reflow
- contrast in light/dark
- reduced motion
- touch target usability
- error messages understandable without colour alone

Automated checks can support this gate but do not replace human interaction testing.

# Gate J — Optional NinFit ID boundary

If NinFit ID is included in the pilot:

Verify:

- sign up
- email confirmation
- sign in
- sign out
- session restore/expiry
- resend
- password recovery ownership/status
- error privacy
- redirect correctness
- account deletion ownership/status

The UI must preserve the distinction:

```
NinFit ID = identity/authentication
local fitness history = this device
```

Do not describe authentication as fitness backup/sync.

If recovery/account deletion are not ready, keep NinFit ID explicitly optional and
record the limitation.

# Evidence table

Use this table during execution.

| Gate | Status | Evidence | Human sign-off |
|---|---|---|---|
| A Backup/restore realistic history | NOT RUN | — | — |
| B N→N+1 migration | NOT RUN | — | — |
| C Corruption/quarantine | NOT RUN | — | — |
| D Interrupted import | NOT RUN | — | — |
| E Quota/write failure | NOT RUN | — | — |
| F Clear/delete behaviour | NEEDS INVENTORY | — | — |
| G Device-loss wording | NEEDS REVIEW | — | — |
| H Device matrix | NOT RUN | — | — |
| I Accessibility | NOT RUN | — | — |
| J NinFit ID lifecycle | CONDITIONAL | — | — |

Allowed statuses:

- `NOT RUN`
- `IN PROGRESS`
- `PASS`
- `PASS WITH ACCEPTED LIMITATION`
- `FAIL`
- `BLOCKED`
- `NOT APPLICABLE`

Never mark PASS from code inspection alone when the gate requires a real drill.

# Recommended implementation sequence

1. add deterministic test fixtures for realistic local history
2. automate Gate A backup/restore comparison
3. automate Gate C corruption/quarantine matrix
4. add StorageAdapter failure-injection harness for Gates D/E
5. inventory Gate F deletion behaviour
6. review/update user-facing Gate G wording
7. perform phone/browser Gate H acceptance
8. perform Gate I accessibility acceptance
9. include Gate J only if NinFit ID is being piloted
10. update this ledger with evidence links/commit SHAs

# Pilot stop rule

NinFit is not "pilot ready" merely because the app looks complete.

For a local-only real-history pilot, at minimum the production-readiness blockers must
have recorded accepted evidence for:

- migration/recovery/restore
- local privacy/deletion/device-loss communication

If a failure is accepted rather than fixed, record exactly:

- what can fail
- what the user sees
- what data may be affected
- recovery steps
- why the limitation is acceptable for the pilot population

# Explicit non-goals

This evidence pack does not authorise:

- cloud fitness sync
- production fitness database
- social/community backend
- location sharing
- Health Connect/HealthKit
- queues/microservices
- monitoring that uploads raw health/location data
- automatic destructive recovery
- clearing user data to solve deployment caching
