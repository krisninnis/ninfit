# NinFit Current State

A short live checkpoint for a human or agent picking the project up cold.

**Authority:** live Git, tests and repository contents outrank this file. If they disagree, believe Git and say so. See `skills/ninfit-handoff/SKILL.md`.

Last updated: **2026-09-08**

## Repository truth

| | |
|---|---|
| Remote | `https://github.com/krisninnis/ninfit.git` |
| `main` | `03b45242d49fd670bead16e03e47984076fc5b8c` |
| Latest merged PR | **#232 — GPS Walk milestone** |
| Current phase | **Installed-shell build-out / Journey stack awaiting one human gate** |
| Node | `24.x` |

Verify live Git before acting. Cut every new branch from current verified `origin/main`, never from a stale local checkout.

## Launch strategy

> **The first four weeks of starting again.**

NinFit is a calm, local-first fitness app for people starting or returning to movement. Launch scope remains intentionally narrow and free for the first public version. Target private beta is roughly **15–25 real users/pairs of hands** after P0 gates are satisfied.

Read `docs/LAUNCH_SUMMIT_2026-09-05.md` before changing launch scope.

## Completed summit and provider work on `main`

- **M1 / #199:** defective Tortoise wave removed from runtime. Do not reintroduce it.
- **M2 / #200:** G9/G10/G11 mascot asset contracts enforced.
- **M6 preparation / #204:** privacy and medical-purpose boundary docs merged; legal/publication work remains.
- **M8 preparation / #206:** H-A through H-K acceptance ledger merged.
- **M10 preparation / #207:** rollback rehearsal record merged; rehearsal itself remains NOT RUN.
- **#211:** Journey Home presents Walk/Run, Cycle and Swim as one centred vertical path. Its requested real-phone light/dark visual gate remains outstanding despite the merge.
- **#213:** current OSM tile-policy evidence recorded.
- **#220:** consolidated H-A→H-K real-device execution runbook merged.
- **#228:** direct OSMF tiles approved only for the planned small invitation-only private beta under constrained use: viewed-area imagery only, no background/bulk/offline-map prefetch, visible attribution preserved, local route truth remains independent, and `VITE_MAP_TILE_URL` remains the exit switch. Re-review is mandatory before public beta, materially higher traffic, policy change, proxy/custom fetch, offline maps or added location-provider features.
- **#229:** PostHog Cloud EU found technically suitable with conditions for narrow opt-in M4 diagnostics. Collection is still not approved until the intended EU project/deployment key, retention/legal processor facts, privacy notice, Settings review and real G12/G13 receipts are complete.
- **#232:** the GPS Walk milestone. Route continuity breaks honestly where GPS stopped observing, the screen is kept awake while recording, the wearable provider boundary exists and says plainly that nothing connects, and the completed-result experience landed. This is the current `main`.
- **#230:** privacy readiness reconciled with current launch truth. Viewed geography/network request metadata can reach the tile provider; raw Journey route truth remains local to the renderer. Article 6/Article 9, operator identity, retention, processor/DPA and publication facts remain human/legal decisions.

## Active launch candidates — do not merge past their gates

The old branches **#194, #201, #202, #203, #205, #209 and #210 are closed unmerged/superseded**. Do not revive or mechanically merge them.

### #214 — M7 support surface v2

Fail-closed Help & support configuration. Private-beta operational choice: `krisninnis@gmail.com`, with **reply within 3 working days** as the commitment. Values remain deployment-configured, not hard-coded.

Remaining: configure the actual deployment variables and visually verify Settings plus the release-identity-only mail draft.

### #215 — two-path launch onboarding v2

New users may choose only **Start Moving** or **Return to Fitness**. Permanent five-path/five-family architecture remains intact.

Automated verification is green. Remaining: human onboarding visual/flow acceptance. Do not expose Strength/Stamina/Balanced to new users.

### #216 — visible focus + 44px quiet actions v2

Automated verification is green. Fixes the framed-field focus-ring cascade and makes quiet Clear/Sign in actions carry at least a 44px target without changing visual hierarchy.

Remaining: real-phone thumb/keyboard check. H-I VoiceOver/TalkBack remains a separate real-device gate.

### #217 — Journey imagery failure communication v2

Automated verification is green. Keeps the map mounted and route truth available while base imagery fails, shows an honest imagery-unavailable note after repeated failures, and clears that note when imagery succeeds.

Private-beta map-provider suitability is now resolved by #228 under its strict constraints. Remaining: H-H real-GPU route-line proof and phone visual review in both themes, including a slow-connection case.

### #218 — M4 privacy-safe instrumentation v2

Automated verification is green. Exactly six opt-in usage events plus scrubbed crash diagnostics; default off. No health measurements, route points, notes, free text, account email or NinFit ID are part of the usage-event contract.

Intended six events:

1. `onboarding_completed`
2. `hatch_completed`
3. `first_activity_recorded`
4. `activity_recorded` with coarse `{type,is_rest}` only
5. `journey_completed`
6. `app_opened_after_gap` with a coarse gap bucket

Connected PostHog discovery on 2026-09-05 found one accessible EU organization (`claw apps`) and one project (`Default project`, id `145242`). That project contains unrelated traffic and no NinFit acceptance receipts.

Therefore **G12 and G13 remain NOT PASSED**. #229 establishes technical suitability only; it does not approve collection or establish lawful basis/DPA/retention truth. Remaining: intended EU project/deployment configuration, legal/privacy facts, explicit Settings opt-in, exact six usage receipts, one deliberate scrubbed crash receipt and human Settings visual acceptance.

### #219 — M3 offline cold-start v2

Automated verification is green. This is the current replacement for old #201 and preserves coherent service-worker cache generations, approved stable-art precaching, optional-account/Profile containment, current-generation root lookup and old-client/lazy-chunk update safety.

Historical Android evidence: a real installed-home-screen online→Airplane-mode cold start functionally passed on the former final #201 candidate. Formal ledger completion still needs exact evidence metadata and must not be transferred to a different build without rerunning affected behaviour.

Remaining before #219 may merge:

- Android H-J Build A → Build B update safety;
- iPhone H-F real installed offline cold start;
- iPhone H-J update safety;
- exact device/build evidence fields.

Until #219 merges, canonical `main` still does not contain the new offline worker.

## Journey native stack — #237 → #238 → #240

Three stacked drafts, all `mergeable_state: clean`, held by exactly one piece of missing human
evidence. `docs/pilot/prebeta-landing-plan-v1.md` is the authoritative landing order.

- **#237** `feat/journey-map-lock-reward-v1`, head `773bfbbc7c18`, based on `main`. Vector
  basemap with a local trusted-route fallback, recording control lock, first-walk runners
  reward, Journey naming. Automated gate PASS, preview READY. **Blocked on the human Samsung
  route-map gate**: a route-bearing Journey must show map detail plus the trusted route line and
  start/end markers, or the explicit local fallback. A blank rectangle fails; a zero-distance
  Journey is not evidence. Preview:
  `https://ninfit-git-feat-journey-map-lock-reward-v1-krisninnis-projects.vercel.app`
  (behind Vercel Authentication — sign in on the phone or disable preview protection).
- **#238** `feat/journey-native-background-autopause-v1`, head `1653a79c409f`, based on #237.
  Trusted-GPS stationary auto-pause after 5 seconds, conservative auto-resume, fail-closed
  manual/automatic pause provenance, the platform-neutral `JourneyLocationProvider` boundary.
  Automated gate PASS. Blocked only by #237.
- **#240** `feat/journey-native-provider-prep-v1`, based on #238. The native provider boundary,
  startup bridge injection, the durable Journey-scoped native queue with ordered sequences and
  at-least-once replay, control protection on background, the replay coordinator, and
  durable-safe completion. Blocked by #238.

Finish now routes through `completeJourneyAfterNativeReconciliation`, sharing the screen's replay
coordinator so startup, foreground and Finish cannot race the same queue. A replay, clear or
persistence failure persists nothing, clears nothing and leaves the Journey recoverable.

**Parked, and required before Samsung acceptance:** a manual Pause stops the motion session
outright, so fixes already buffered natively are left unreplayed. Unreachable until a shell
injects a queue. See `docs/architecture/journey-native-background-location-v1.md`.

## Installed Android shell

Capacitor 8 with the Android project generated and configured; application id
**`app.ninfit.mobile`**, permanent. Android Auto Backup and Android 12+ device-to-device transfer
are both excluded, because they would otherwise copy precise Journey routes to Google Drive with
no NinFit consent step — a beta user changing phone must export first.

**The Android project has never been compiled.** No agent environment can reach the Android SDK.
The first Gradle build is a human step in Android Studio.

Background-location provider decision, taken 2026-09-08 on current facts:
**Transistorsoft**, not Capgo. Capgo's own documentation states it has no on-disk queue, does not
persist points across process death, and offers durability only by POSTing route points to a
server — which the privacy contract forbids. Transistorsoft persists to on-device SQLite and runs
local-only with `url` omitted and `autoSync: false`. Debug builds need no licence, so the whole
Samsung acceptance run costs nothing; only an Android release build requires a key ($399
perpetual, bound to one application id). See
`docs/architecture/journey-native-provider-selection-v1.md` and
`docs/architecture/ninfit-android-shell-v1.md`. **#240's PR body still names Capgo as the first
candidate and must be corrected when next pushed.**

## Consolidated review build — #226

**PR #226 is a DRAFT REVIEW BUILD ONLY. DO NOT MERGE IT.**

Branch: `review/prebeta-consolidated-v1`
Head: `294d9248c4d99356f16d1d78fd296e179dee430c`

**It is now stale.** #226 and all six of #214–#219 were cut from `23830f41` and are **19 commits
behind `main`**: they contain neither the GPS Walk milestone nor any of the Journey map,
auto-pause or native work. Evidence collected against #226 could not be transferred to the real
beta build. Do not run the consolidated device session against it; rebuild the candidate on the
new `main` once the Journey stack has landed, and close #226 unmerged when its replacement exists.

It deliberately combines #214, #215, #216, #217, #218 and #219 so the remaining human/device evidence can be collected against one exact fingerprint instead of six unrelated previews. Overlapping M3/M4/M7 code was reconciled deliberately on this integration branch.

GitHub **Verification Gate #102 passed** on the exact head: full tests, mascot asset contracts, TypeScript and production build were green.

The recorded Vercel failure for that head was the team **100 deployments / 24 hours** free-plan limit, not an application build/runtime failure. Do not transfer human evidence from another build. The ChatGPT Vercel app is currently unavailable to this session, so exact deployment inspection cannot resume until provider/tool access is restored.

## Product truth that must not regress

- Fitness first; game/companion systems reinforce but never author fitness truth.
- Calm by default: no guilt, punishment, broken-streak pressure, catch-up debt, decay or pay-to-win.
- Shared Journey Bond grows only from genuine history and never decays.
- Exactly five path mascot families remain durable architecture; hatched species is permanent.
- Hatching grants no XP/trophy, leaks no species before the break, commits exactly once and remains meaningful under reduced motion.
- Health/body data is neutral information, never diagnosis or verdict.
- Local fitness data is authoritative; NinFit ID is optional identity, not fitness backup/sync.
- Generated visual assets require human approval before production runtime use.
- Human visual/device evidence outranks green CI for visual correctness.

## Tortoise motion status

Current production Tortoise presentation is standing + approved clean idle. The rejected Pika wave is absent.

Dormant one-shot motion plumbing remains available for a future approved asset. Desired future clean greeting:

**egg opens → Tortoise settles → looks toward user → one slow wave → idle**

The same approved motion may later support **tap Tortoise → one acknowledgement → idle**.

Do not fake this with the rejected asset or ship a generated motion master before human approval and G9/G10/G11 pass.

## Remaining human/pre-beta gates

The authoritative ledger is `docs/pilot/device-accessibility-acceptance-matrix-v1.md`; the execution guide is `docs/pilot/prebeta-consolidated-device-runbook-v1.md`.

Still materially outstanding:

- H-A full hatch visual integrity;
- H-B reduced-motion hatch;
- H-C forced media-failure fallback;
- H-D/H-E 30-minute outdoor GPS + battery sessions on both platforms;
- H-F iPhone formal run and exact evidence metadata;
- H-G backup → clear disposable test data → restore/read-back;
- H-H real-GPU Adventure Map;
- H-I VoiceOver/TalkBack;
- H-J Android+iPhone update safety;
- H-K controlled three-week absence with no punishment;
- already-merged #211 Journey Home light/dark real-phone visual evidence.

Do not fabricate any of these from CI, desktop emulation or a different build.

## Legal / provider / operations

Before a stranger is invited into beta, still resolve and publish the real operator/privacy facts, lawful-basis decisions as applicable, provider/processor/retention/transfer truth, stable privacy notice URL, deployed support values, PostHog G12/G13 receipts and human Settings/device gates.

Current provider boundaries:

- OSMF direct tiles: approved for small invitation-only private beta only under #228 constraints; public beta/production needs re-review.
- PostHog Cloud EU: technically suitable with conditions under #229; collection remains unapproved until config/legal/receipt/Settings gates pass.
- Vercel: #226's recorded deployment failure was provider quota, not NinFit code. Connected Vercel tooling is currently unavailable in this ChatGPT session, so no exact preview inspection or deployment configuration can be claimed.
- M10 production rollback rehearsal remains NOT RUN and requires explicit human authorisation.

## Next execution order

`docs/pilot/prebeta-landing-plan-v1.md` holds the full reasoning; this is the order.

1. Record the **#237 Samsung route-map evidence** on the phone browser. This is the single item
   holding the whole Journey stack, and it needs no Android build.
2. Merge #237; retarget #238 to `main`, re-run the gate on the exact retargeted head, merge;
   repeat for #240.
3. Merge the provider-selection docs branch. Build the Android shell in Android Studio, see it
   launch on the Samsung, then merge the shell branch.
4. Implement the Transistorsoft provider slice, then the parked pause-drain slice.
5. Rebuild the consolidated review candidate from the new `main` plus #214–#219 and run **one**
   real-device acceptance session against that fingerprint.
6. Configure support and intended PostHog deployment values without committing credentials, then
   re-query PostHog for exact G12/G13 receipts.
7. Merge #214–#219 individually as each gate passes, re-verifying `main` between merges.
8. Rehearse rollback with explicit authorisation and reconcile/publish the final privacy notice.
9. Only then assemble the roughly 15–25 person private beta.

## Handoff checkpoint

```text
HANDOFF CHECKPOINT
main SHA: 03b45242d49fd670bead16e03e47984076fc5b8c
latest merged PR: #232 - GPS Walk milestone
current phase: installed-shell build-out / Journey stack awaiting one human gate
Journey stack: #237 (main) -> #238 -> #240, all mergeable_state clean
blocking item: #237 Samsung route-map human gate; nothing else holds the stack
#237 preview: https://ninfit-git-feat-journey-map-lock-reward-v1-krisninnis-projects.vercel.app (Vercel Authentication on)
native completion: Finish routes through completeJourneyAfterNativeReconciliation, sharing the replay coordinator
parked: manual-Pause durable drain, required before Samsung acceptance
Android shell: Capacitor 8 generated, appId app.ninfit.mobile, NEVER COMPILED by any agent
provider decision: Transistorsoft (Capgo has no on-disk queue and only uploads); licence only for release builds
#240 PR body: still names Capgo as first candidate - correct on next push
#226 and #214-#219: 19 commits behind main; #226 is stale as an acceptance candidate
launch PRs: #214, #215, #216, #217, #218, #219 - automated green, human/config gates open
OSMF: constrained direct-tile use approved for small invitation-only private beta under #228
PostHog: Cloud EU technically suitable under #229; G12/G13 and collection approval remain open
agent push access: none. Branches are delivered as git bundles and pushed from Kris's terminal.
notes: remote GitHub truth authoritative; do not merge human-gated PRs on green CI alone
```
