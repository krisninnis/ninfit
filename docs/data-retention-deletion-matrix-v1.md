# NinFit Data Retention & Deletion Matrix v1

**Status:** Planning/checklist only. This document is not a legal opinion and does not set final statutory retention periods. Final retention rules must be derived from implemented data flows, provider contracts, platform rules, applicable law and actual product needs before public launch.

## Purpose

Define how each major NinFit data category should be treated over its lifecycle so that deletion, export, privacy, recovery and future cloud sync are designed deliberately rather than improvised later.

The key product rule is:

> Fitness history and precise location history should be separable wherever practical.

A user should be able to remove sensitive route/location evidence without automatically losing the fitness summary they reasonably expect to keep.

## Status vocabulary

- **Local now** — current product direction keeps this on-device.
- **Cloud planned** — future sync/account capability may store it remotely.
- **Provider copy** — an external provider may retain its own copy under separate terms.
- **Derived** — calculated from other data and potentially reproducible.
- **Source observation** — original imported/measured value that should not be silently rewritten.
- **Delete immediately** — user-facing record should disappear as soon as the destructive action completes successfully.
- **Delete asynchronously** — backend/provider cleanup may complete after the user-facing deletion, with that delay documented honestly.

## Core deletion principles

1. Destructive actions require deliberate confirmation appropriate to their impact.
2. Deleting precise route data should not automatically delete the Journey summary unless the user chooses to delete the whole Journey.
3. Deleting a Journey must also remove or detach dependent derived values that no longer have valid supporting evidence.
4. Imported source observations are not silently transformed into different source values before deletion/export.
5. Provider disconnection stops future sync but does not silently erase already-imported history unless the user explicitly requests deletion.
6. Duplicate/reconciliation links must not make one deletion unexpectedly destroy a distinct real-world Journey.
7. Backups, logs and third-party copies must not be described as "instantly and permanently deleted" unless that is actually true.
8. Sensitive data should not be retained "just in case" without a defined purpose.
9. Test/demo data should be separable from real-user data where cloud systems are introduced.
10. Retention periods must eventually have an owner, rationale and review date.

## Retention and deletion matrix

| Data category | Examples | Current / expected location | Default retention direction | User deletion controls | What deletion must remove | What may remain | Key dependencies / notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Account identity | email, account ID, auth metadata | Future cloud/auth provider | While account exists; final operational/legal tail TBD | Delete account | Active account record, sessions/tokens, product linkage | Minimal security/audit records only if genuinely required and documented | Account deletion must propagate across processors where applicable |
| Profile | display name, units, preferences, birth year if collected | Local now; cloud planned | While account/profile exists | Edit fields; delete account | Stored profile values and cloud copies | Aggregated/non-identifying operational data only if truly non-identifying | Avoid collecting fields not needed by product |
| Health context / notes | user-entered health notes | Local now; cloud decision required | User-controlled; no arbitrary long-term cloud retention by default | Delete individual note; delete all health context; delete account | Note text, indexes/search copies, synced copies | Backup residue for bounded documented period if unavoidable | Sensitive; exclude from analytics/marketing payloads |
| Body measurements | weight, waist, RHR, HRV | Local now; cloud planned | User fitness history until user removes it | Delete measurement; delete metric history; delete account | Measurement values and derived references that depend solely on deleted value | Aggregate trends only if still mathematically valid and user-visible provenance remains honest | Imported vs manual provenance must be preserved |
| Daily activity / plan completion | activity completed, planned rest, adherence | Local now; cloud planned | Fitness history until user deletes/reset account | Delete day/history if feature offered; delete account | Stored completion history and dependent derived streak facts where invalidated | Game history only if it can remain truthful after deletion; otherwise recalc/remove | Never preserve fabricated streak/reward state after supporting activity is deleted |
| Journey summary | activity type, start/end, duration, distance, pace | Local now/planned; cloud later | User-owned fitness history | Delete Journey; potentially edit limited metadata | Summary, route links, source associations, derived stats tied to Journey | Independent imported observations only if they belong to another retained Journey/source record and product contract supports it | Whole-Journey delete is broader than route-only delete |
| Precise GPS route | latitude/longitude, timestamps, accuracy, raw/accepted points | Prototype/local; cloud sync requires separate consent/design | Keep only while user wants route history; no default indefinite cloud retention without explicit product decision | **Delete route only**; delete Journey; delete all location history | Raw points, accepted points, route geometry, privacy-zone transformed copies, caches under NinFit control | Journey summary such as distance/duration if product can retain it honestly without coordinates | Highly sensitive; deletion must include map-derived stored artifacts, not just hide UI |
| GPS quality/recovery snapshot | active recording state, last fix, pause state | Device/local | Short-lived; only while recording/recovery window is useful | Discard active recording; finish Journey; automatic expiry | Snapshot and incomplete route buffers after discard/expiry | Completed Journey data created through explicit finish/recovery choice | Must not become permanent shadow location history |
| Location privacy zones | user-defined sensitive areas | Prefer local/device; cloud only if explicitly justified | Until user removes them | Delete individual zone; delete all zones; delete account | Zone geometry/parameters and synced copies | Previously shared masked exports already outside NinFit control cannot necessarily be recalled | Do not infer/save "home" labels silently |
| Wearable workout observation | Fitbit/Health Connect/HealthKit workout record | Imported local/cloud planned; provider retains source copy | Fitness history while retained by user | Delete imported observation/Journey; disconnect provider for future sync | NinFit copy, reconciliation links, derived values that lose support | Provider's original copy remains under provider control unless separately deleted there | Disconnect is not deletion; explain distinction |
| Heart-rate / steps / other wearable metrics | HR samples, steps, activity metrics | Imported local/cloud planned | User fitness history; high-volume raw sample policy TBD | Delete metric/Journey/history; delete account | NinFit-held observations and dependent derived values | Provider copy may remain | Minimum scopes; source/device/transport lineage preserved |
| Provenance / source lineage | observedBy, transportedBy, importedBy, provider IDs | Stored alongside observation | As long as linked observation/Journey exists | Removed with owning observation/Journey unless required for audit integrity | Identifiers and mappings no longer needed | Minimal tombstone/hash only if required to prevent duplicate re-import and designed privacy-safely | Avoid retaining full sensitive payload merely for dedupe |
| Duplicate/reconciliation metadata | match confidence, canonical Journey link | Local/cloud with Journey system | As long as needed for retained activities | Removed/recalculated when source/Journey deleted | Match link and stale comparison data | Minimal import fingerprint may remain only if necessary to avoid accidental re-import, with bounded rationale | A deletion must not merge or mutate unrelated Journeys |
| Derived fitness values | pace, preferred distance, moving time, summaries | Local/cloud | Recomputable; retain with supporting Journey | Deleted/recomputed when source evidence changes | Derived field/cache | None if evidence no longer supports it | Derived values are not source measurements |
| PBs / achievements | fastest 5K, summit achievement | Local/cloud game/fitness state | While supporting evidence exists | Usually not directly deleted; recalculated after underlying history deletion | Achievement/PB if deleted evidence means it is no longer true | Permanent commemorative records only if explicitly designed to remain truthful after source deletion | No fake PBs/rewards after data deletion |
| XP / reward events | granted rewards, level progression | Local/cloud game state | Product-history decision; tied to verified events | Account reset/delete; possibly recalculation policy | Invalid duplicate rewards or rewards solely caused by deleted/fabricated evidence where product contract requires correction | Historical reward receipt may remain only if still truthful under locked game rules | Deduplication happens before reward evaluation |
| Mascot / Living Journey state | bond, species, legacy state, memories | Local/cloud planned | Long-term user game history | Account reset/delete; feature-specific controls later | Personal state when account deleted | Exported/shared screenshots outside NinFit control | Must not expose sensitive route/health details unnecessarily |
| Photos / Journey media | user photos attached to activity | Future local/cloud | Until user deletes | Delete photo; delete Journey; delete account | Original, thumbnails, transformed copies under NinFit control | Copies explicitly downloaded/shared by user may remain elsewhere | EXIF/location metadata requires explicit handling |
| Social posts / shared Journey cards | summaries, masked routes, captions | Future cloud/public surfaces | Until user deletes subject to moderation/legal constraints | Delete post/share; delete account | Public content under NinFit control, indexes/caches as practical | Recipients/screenshots/search caches may persist outside control | Shared route must already be privacy-safe before publication |
| Groups / messages | group membership, chat | Future cloud | Product-specific; define before launch | Leave group, delete message where supported, delete account | User-owned content per product rules | Other participants' copies/conversation context may require nuanced handling | Requires separate social safety/moderation policy |
| Notifications | push token, notification preferences/history | Future provider/cloud | Token while enabled; notification log minimal/short-lived | Disable notifications; sign out; delete account | Push tokens and provider mappings | OS notification already delivered to device may remain until user clears it | Avoid sensitive content on lock screen by default |
| Diagnostics / crash reports | stack traces, device metadata | Future monitoring provider | Short operational retention; exact duration provider-specific | Usually account/privacy request pathway rather than per-event UI delete | Identifiers/sensitive payload where linked and deletion required | Aggregated non-identifying reliability metrics | GPS/health payloads prohibited by default in logs/breadcrumbs |
| Application/server logs | request logs, security events | Hosting/backend providers | Minimum operational/security period | Account deletion should remove direct account linkage where feasible; formal request path later | Personal/sensitive fields not needed for retained security purpose | Necessary bounded security records if justified | Never log full precise routes by default |
| Analytics events | install, activation, feature use | Future analytics provider | Short/minimised; exact period TBD before provider selection | Consent/opt-out/delete controls depending implementation/jurisdiction | User/device-linked event history where required | Aggregated anonymous statistics if genuinely anonymous | No raw health metrics or precise GPS in marketing analytics |
| Marketing attribution | campaign/referral IDs | Future marketing tools | Minimum campaign measurement period | Opt-out/delete according to implementation | User/device-linked identifiers under NinFit/provider control | Aggregated campaign totals | Strict boundary from health/location datasets |
| Support correspondence | support email/ticket | Future support channel | Needed for issue handling plus bounded operational period | Privacy request can seek deletion where appropriate | Attachments and personal content no longer needed | Security/legal correspondence where legitimately required | Warn users not to send unnecessary health/location data |
| Export files | JSON/CSV/route export generated for user | Device/download or temporary server | Temporary server copies only if generation requires them | User deletes downloaded copy; NinFit expires server copies automatically | Temporary generated files under NinFit control | User's own downloaded copy | Exports may contain highly sensitive data; label clearly |
| Import staging data | uploaded/imported file before reconciliation | Local or temporary backend | Short-lived until validation/import completes | Cancel import; delete account | Temporary file and extracted staging records | Accepted source observations after explicit successful import | Do not retain failed uploads indefinitely |
| Backups | database/storage backups | Future infrastructure | Bounded rolling period, provider/architecture specific | Not necessarily immediate per-record physical purge; deletion must age out predictably | Primary/live record first, then backup copies through lifecycle | Encrypted backup copy until scheduled expiry if necessary | Public privacy wording must state reality, not "instant permanent deletion" if backups persist |
| Fraud/security tombstones | revoked tokens, abuse/security fingerprints | Future backend | Only if needed, tightly bounded/documented | Usually not normal UI deletion; governed operationally | Any excess personal data beyond security purpose | Minimal security evidence where legitimate | Must not become a hidden indefinite profile |
| Test/demo data | synthetic users/routes | Dev/preview | Remove regularly; never mix with production unintentionally | Developer/admin cleanup | Test data and credentials | None required | Never clone real sensitive data into dev casually |

## Deletion actions the product should eventually expose

### 1. Delete route only

Purpose: remove precise location while preserving useful fitness history.

Expected effect:

- remove raw GPS points;
- remove accepted/filtered GPS points;
- remove stored route geometry/polyline;
- remove cached route-derived visual artifacts under NinFit control;
- remove precise location metadata not required for the retained summary;
- retain activity type, duration and distance only if those values can remain truthful and the product clearly understands their provenance;
- retain heart-rate/steps/wearable evidence only if the user has not requested those deleted too;
- re-evaluate location-dependent achievements if the locked product rules require the underlying evidence to remain stored.

### 2. Delete Journey

Expected effect:

- remove Journey summary;
- remove attached route;
- remove Journey-specific source observations where they are not independently retained by design;
- remove pause/recovery data;
- remove photos/notes attached solely to that Journey;
- recalculate PBs, achievements, streaks and derived summaries that depended on it;
- ensure reward/game state remains truthful under the product's locked rules.

### 3. Delete all location history

Expected effect:

- remove precise route data across all Journeys;
- remove stored raw/accepted coordinates;
- remove privacy-zone data if user chooses that option;
- preserve non-location fitness summaries where feasible and truthful;
- do not remove unrelated profile/health/wearable data unless explicitly requested.

### 4. Disconnect wearable/provider

Expected effect:

- revoke/delete NinFit-held access and refresh tokens;
- stop future sync;
- retain already-imported history by default unless the user separately chooses deletion;
- explain that the provider may still retain its original data;
- allow the user to delete imported history separately.

### 5. Delete wearable/imported history

Expected effect:

- remove selected provider observations held by NinFit;
- reconcile affected Journeys;
- recalculate derived values/PBs/achievements where evidence changes;
- prevent deleted provider history from silently reappearing on the next sync unless the user has deliberately re-enabled import and the product defines how re-import works.

### 6. Delete account

Expected effect:

- stop active sessions;
- revoke provider tokens;
- remove cloud account/profile data;
- remove Journey/route/health/game data held by NinFit according to the account-deletion contract;
- queue processor/subprocessor deletion where necessary;
- record only the minimum operational/security evidence that has a justified retention reason;
- provide honest wording about backup expiry and external copies.

## Reward and achievement integrity after deletion

Deletion cannot leave the game layer asserting fitness facts that are no longer supportable.

Before production, define deterministic behaviour for:

- deleting a Journey that established a PB;
- deleting one of several equivalent measurements supporting a PB;
- deleting the GPS evidence behind a location-specific achievement;
- deleting a duplicate source while keeping the canonical Journey;
- deleting an imported workout that caused a consistency milestone;
- deleting a Journey after XP/reward delivery;
- full account-history reset.

Do not invent this behaviour implicitly inside UI code. It belongs in the relevant domain/product contract before implementation.

## Re-import protection after deletion

Wearable/provider deletion creates a subtle problem: the same activity may be offered again by the provider on the next sync.

Before provider integration, choose and document one of these behaviours per deletion type:

- **Delete from NinFit but allow future re-import** — clear and reversible, but the record may return.
- **Delete and suppress this specific source record** — requires a minimal tombstone/import fingerprint.
- **Disconnect provider and delete** — no re-import while disconnected.

If tombstones are used, store the minimum identifier/fingerprint needed. Do not keep the deleted health/location payload merely to remember that it was deleted.

## Backup and asynchronous deletion contract

Before cloud launch, document for every storage provider:

- live-record deletion latency;
- cache/CDN invalidation behaviour;
- backup frequency;
- backup retention period;
- whether per-record deletion from backups is possible;
- when deleted records naturally age out of backups;
- restore procedure and how it avoids resurrecting records that were already deleted;
- provider/subprocessor deletion mechanisms.

User-facing language must match the actual implementation.

## Export relationship

Deletion and export should use the same data inventory so users do not discover hidden categories that are deletable but not exportable, or exported but impossible to control.

A future export should distinguish where practical:

- Journey summaries;
- precise routes;
- health/body measurements;
- wearable source observations;
- provenance/source lineage;
- derived metrics;
- rewards/achievements/game state;
- profile/preferences.

Highly sensitive exports should be clearly labelled so users understand that downloaded files leave NinFit's protection boundary.

## Provider deletion register

Before production, add provider-specific rows for all selected services.

| Provider | NinFit data held | Deletion API/process | Typical completion time | Backup tail | User-visible limitation | Verified date |
| --- | --- | --- | --- | --- | --- | --- |
| Vercel | TBD from actual production logging/config | TBD | TBD | TBD | TBD | — |
| Supabase | TBD from final schema/auth/storage | TBD | TBD | TBD | TBD | — |
| Fitbit | NinFit tokens/imported copy vs provider original must be distinguished | TBD from current API | TBD | Provider-controlled | NinFit cannot imply deleting the original Fitbit account/data | — |
| Health Connect | Device-mediated records/permissions; exact NinFit copy depends on implementation | TBD | TBD | Device/platform dependent | Permission revocation is not automatically deletion of NinFit-imported data | — |
| HealthKit / Apple Health | Permission/source behaviour depends on native implementation | TBD | TBD | Platform dependent | NinFit must not claim to delete Apple Health's own source record unless it actually can | — |
| Analytics provider | Not selected | — | — | — | No provider approved yet | — |
| Crash monitoring provider | Not selected | — | — | — | No provider approved yet | — |

## Retention decision template

For every category before public launch, fill in:

- Data category:
- Product purpose:
- Required or optional:
- Local storage location:
- Cloud/provider storage location:
- Default retention period:
- Retention rationale:
- User deletion control:
- Backup expiry:
- Processor deletion path:
- Exported to user: Yes / No / Partial
- Sensitive/precise classification:
- Owner:
- Review date:
- Evidence links:

## Acceptance checklist before public launch

- [ ] Every production data category appears in the inventory.
- [ ] Every cloud/provider copy has a retention owner and rationale.
- [ ] Precise GPS routes have a route-only deletion path.
- [ ] Delete Journey is implemented and tested.
- [ ] Delete account lifecycle is documented and tested.
- [ ] Provider disconnect and provider-history deletion are distinct concepts in UI/logic.
- [ ] Re-import behaviour after deletion is deterministic.
- [ ] PB/achievement/reward behaviour after history deletion is deterministic.
- [ ] Backups cannot silently resurrect user-deleted live records after restore.
- [ ] Privacy notice wording matches actual deletion latency and backup behaviour.
- [ ] Logs/diagnostics do not become an undeclared copy of sensitive route/health data.
- [ ] Export categories align with deletion categories.
- [ ] Social/shared copies and limitations are explained honestly before social launch.
- [ ] Data-retention periods are reviewed rather than left indefinitely as TBD.

## Current disposition

This matrix establishes design requirements, not final durations. NinFit remains intentionally conservative: precise location is treated separately from ordinary fitness history, wearable originals remain distinguishable from NinFit copies, and future cloud/provider retention must be verified before public claims are made.
