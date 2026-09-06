# NinFit Wearable Integration Boundary v1

**Status:** Architecture specification — boundary implemented, no provider implemented.
**Scope:** How any wearable or health store enters NinFit; what it may and may not change; what human-only setup stands between today and a working connection.
**Repository:** `krisninnis/ninfit`
**Version:** v1
**Last updated:** 6 September 2026

Extends `docs/architecture/ninfit-living-journey-architecture-v1.md` §25 (wearable integration direction) and §8 (duplicate and identity matching). Where the two disagree, the Living Journey architecture is the parent and this document is the detail.

---

## 1. The one rule

> **One real activity becomes one NinFit Journey. Every device contributes evidence; no device owns the truth.**

Everything below is a consequence of that sentence.

---

## 2. What was found before anything was designed

The obvious plan — "add Fitbit" — does not survive contact with the current state of Fitbit's developer platform.

| Fact | Consequence for NinFit |
|---|---|
| Google is turning down the legacy **Fitbit Web API in September 2026**, after which it stops syncing data. | An integration written against it today has a known end date measured in weeks. |
| **New Fitbit developer accounts are no longer being issued.** | NinFit cannot obtain Fitbit Web API credentials at all, so there is no shortcut and no "just for the owner's own account" version. |
| The replacement is the **Google Health API**, which aggregates Fitbit, Health Connect and Google Fit data. | A Fitbit watch is still reachable — through Google, not through Fitbit. |
| Google Health uses **standard Google OAuth 2.0**; existing Fitbit tokens do not transfer. | The token architecture is Google's, not Fitbit's. Any prior Fitbit OAuth design is discarded. |
| **All Google Health API scopes are Restricted**, requiring a privacy and security review before production access. | The critical path is an approval queue, not code. This is human-only work. |

**Therefore:** NinFit does not implement a `FitbitWearableProvider`. Fitbit appears in the provider registry as `retired`, with a status line pointing a Fitbit owner at Google Health, and `google_health` is the first concrete provider NinFit intends to implement once access exists.

Sources are recorded in §12.

---

## 3. The boundary

```text
provider account
  → authentication (server-side)
  → capability discovery
  → sync (incremental, idempotent)
  → normalisation to NinFit observations
  → reconciliation against existing Journeys
  → enrichment or a new Journey
  → provenance retained
  → fitness truth
  → presentation
```

The seam is `src/domain/wearable/`. Nothing outside that folder may know what any provider's response looks like.

### Implemented in this slice

| File | Holds |
|---|---|
| `src/domain/wearable/provider.ts` | Provider ids, capability vocabulary, availability, the registry, connection-state model |
| `src/domain/wearable/reconciliation.ts` | External activity summary shape, match confidence, reconciliation verdicts, metric-authority decisions |
| `src/ui/screens/SettingsScreen.tsx` | The Connected devices list — read-only, action-free |
| `src/test/wearableBoundary.test.ts` | The guards below |

### Deliberately not implemented

No HTTP client, no OAuth flow, no token storage, no sync scheduler, no persisted reconciliation verdict, no `Journey` schema change. Each is named in §10 with what it needs first.

---

## 4. Credentials

**No secret may exist client-side. Ever.**

- No client secret, access token, refresh token or authorisation code in the bundle, in `localStorage`, in a backup file, in an export, in a log line, in an analytics event, or in a screenshot.
- `WearableConnectionRecord` — the only wearable state NinFit stores locally — is structurally incapable of holding one. It carries a provider id, a state, a last-sync time, granted capabilities and an opaque sync cursor.
- A test walks every file in `src/domain/wearable/` and fails on the appearance of any credential-shaped identifier, and on any `fetch`, environment read or storage access.

OAuth completion and refresh belong on a server NinFit does not yet have for this purpose. Until it does, the honest product state is "not connected", which is exactly what Settings says.

**`authorising` is not `connected`.** A started authorisation never renders as a connection. A Settings row that turns green when a browser tab opens is a row that lies about where somebody's data is.

---

## 5. Reconciliation — the walk that two devices watched

The owner's first real walk is the exact case this exists for: NinFit records the route, a watch records the same twenty minutes, and two honest records of one afternoon arrive.

Counted naively that is twice the distance in a daily total, two history entries, two efforts on a personal ranking, and a week that looks like it contained a walk that never happened.

**Order is fixed: identify, then count.** Reconciliation runs before totals, before rankings, before public eligibility, and before anything a reward could read.

### Evidence, in order of strength

1. **Provider record id already attached to a Journey** → `already_imported`. Lineage beats every heuristic; this is what makes re-syncing a week idempotent.
2. **Activity type** → a mismatch scores zero outright. A cycle is not a walk however neatly the clocks agree.
3. **Time overlap**, measured against the shorter record so a four-hour record cannot swallow a twenty-minute one.
4. **Duration agreement.**
5. **Distance agreement**, measured against the smaller value so a record claiming 70% more distance scores 0.3 rather than 0.59.

Weights: overlap 0.40, duration 0.25, distance 0.35. With no distance to compare the remaining signals total 0.65 — deliberately below the attach threshold, so a summary-only record can never be attached silently on timing alone.

### Verdicts

| Verdict | Confidence | Behaviour |
|---|---|---|
| `already_imported` | — | Do nothing. |
| `same_activity` | ≥ 0.80 | Attach the observations to the existing Journey. Create nothing. |
| `possible_duplicate` | ≥ 0.45 | **Keep both records. Keep both out of every aggregate** until a person resolves it. |
| `separate_activity` | < 0.45 | A new Journey. |

`reconciliationMayCountTowardTotals` returns true only for `separate_activity`. An unresolved maybe counted into a weekly total is a number nobody can untangle later; the cost of leaving it out is one slightly low total the person can see and explain.

---

## 6. Metric authority

A Journey whose distance was derived from a NinFit-recorded route **keeps that distance**. A watch reporting 1.49 km against NinFit's 1.52 km has not found an error — it measured the same walk a different way, and swapping one for the other rewrites a route's own arithmetic with a number that has no route behind it.

| Metric | External record may supply it when |
|---|---|
| `distance_m` | The Journey has no distance, or its distance came from a non-GPS source |
| `heart_rate_bpm` | Always — a phone in a pocket could not see it |
| `steps` | Always |
| `elevation_gain_m` | Always |
| anything else | Never, until NinFit has somewhere honest to put it |

So a completed Journey can truthfully read:

```text
Route      NinFit GPS
Distance   1.52 km      NinFit GPS
Heart rate 104 bpm      Google Health
Steps      1,980        Google Health
```

Original observations are never overwritten. A preferred value and the values it was preferred over both survive.

---

## 7. Leaderboard eligibility

An imported activity does not become competitive merely because it has a distance and a time. `journeyCompetitiveIntegrity` already requires a route NinFit's own phone GPS recorded, so a summary-only wearable record fails it — by construction, not by a special case.

A summary-only import is valid for personal history, daily totals and wellbeing insight. It is not valid for a route leaderboard. **Fail closed.**

Connecting a device and sharing a Journey are separate consent decisions. A watch adding heart rate to a Journey does not make that Journey public, and nothing in this boundary can change a Journey's visibility.

---

## 8. Sync behaviour (contract for the implementation slice)

- First connection sync, manual "Sync now", and incremental later syncs are the same code path with a different cursor.
- Re-syncing an overlapping range imports nothing twice — guaranteed by external record id, not by a date window.
- A failed sync never erases previously synced data and never clears the cursor.
- A partial provider outage leaves existing state intact.
- Last successful sync time is stored and shown; a stale connection says so.
- Token expiry is a visible state (`authorisation_expired`), not a silent failure.
- No uncontrolled polling. Sync is user-initiated or on a bounded schedule.

---

## 9. Privacy

- Least-privilege scopes only. NinFit asks for the categories it displays, and no others.
- Explicit consent per connection; disconnect and revoke are first-class.
- No automatic public sharing of anything, ever.
- An imported activity never causes route publication.
- No raw health data in logs, analytics or error messages. The M4 usage-event contract (six events, coarse fields only) is unchanged by this document and must stay that way.

---

## 10. Human-only work before a connection can exist

Nothing in this list can be done by an agent, and none of it is code.

1. **Register a Google Cloud project** for NinFit and enable the Google Health API.
2. **Apply for Restricted scope access** — a privacy and security review, with a queue. This is the critical path.
3. **Decide and document the lawful basis** for processing health data, with the same rigour the existing privacy readiness work applies to Journeys.
4. **Stand up a server-side OAuth completion and refresh endpoint.** The existing Supabase architecture is the obvious host; it needs its own review before it holds health tokens.
5. **Add the provider secrets to deployment configuration**, never to the repository. Record them in `docs/environment-secrets-register-v1.md` as names only.
6. **Decide retention** for imported health data, and how "disconnect" interacts with data already imported.
7. **Update the privacy notice** before a single byte is requested.

**Until all seven are complete, NinFit cannot connect to Fitbit or to any other wearable, and this slice does not claim otherwise.**

---

## 11. Test plan

Implemented in `src/test/wearableBoundary.test.ts`:

- no provider is connectable today, and each carries a plain-language status with no roadmap promise;
- Fitbit is `retired` with no planned capabilities, and names Google Health as the route to a Fitbit watch;
- `authorising` never reads as connected;
- no file under `src/domain/wearable/` contains a credential-shaped identifier, a network call, an environment read or a storage access;
- one walk seen by NinFit and a watch reconciles to one activity;
- activity-type mismatch never matches;
- a long record cannot swallow a short one on overlap alone;
- a wildly different distance is held open as a possible duplicate rather than attached;
- a summary-only record is never attached on timing alone;
- re-syncing the same record imports nothing twice;
- lineage beats timing;
- the verdict does not depend on the order history is read in;
- an unresolved maybe counts toward nothing;
- a NinFit-recorded route's distance cannot be replaced;
- heart rate, steps and elevation may enrich; nothing else may;
- Settings renders the registry, offers no action, and claims no sync.

---

## 12. Sources

- Google Health API overview — https://developers.google.com/health/about
- Fitbit Web API sunset and migration guidance — https://sahha.ai/blog/fitbit-api-sunset-migration/
- Fitbit integration status summary — https://openwearables.io/integrations/fitbit
- Strava segment leaderboard guidelines (comparison basis and eligibility patterns) — https://support.strava.com/hc/en-us/articles/216919507-Segment-Leaderboard-Guidelines

Provider facts were current on 6 September 2026 and must be re-checked before implementation begins.

---

## 13. Deferred, and deliberately not decided here

- Persisted reconciliation state and the `Journey` schema change it needs.
- The UI for resolving a possible duplicate ("These may be the same walk").
- Whether NinFit ships a native Android or iOS app, which is what Health Connect and HealthKit actually require.
- Sleep and HRV presentation — NinFit has nowhere honest to put them yet.
- Retention and deletion semantics for imported health data.
- Whether an imported activity may ever contribute to a reward.

Deferred means not decided, not permission to decide silently during implementation.
