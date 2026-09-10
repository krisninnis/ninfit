# NinFit Current State

A short live checkpoint for a human or agent picking the project up cold.

**Authority:** live Git, tests and repository contents outrank this file. If they disagree, believe Git and say so. See `skills/ninfit-handoff/SKILL.md`.

Last updated: **2026-09-05**

## Repository truth

| | |
|---|---|
| Remote | `https://github.com/krisninnis/ninfit.git` |
| `main` | `85ae0476f9286130ed6ff2c3cf7b47ea68716cef` |
| Latest merged PR | **#230 — reconcile privacy readiness with current launch truth** |
| Current phase | **Pre-beta hardening / provider + human acceptance** |
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

## Consolidated review build — #226

**PR #226 is a DRAFT REVIEW BUILD ONLY. DO NOT MERGE IT.**

Branch: `review/prebeta-consolidated-v1`
Head: `294d9248c4d99356f16d1d78fd296e179dee430c`

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

## Android acceptance APK signing identity

Verification Gate previously built `app-debug.apk` with the GitHub runner's own
generated debug keystore. That identity is regenerated per job, so two runs of the same
commit produced APKs signed by two different certificates and the Samsung refused every
update with *"App not installed as package conflicts with an existing package"*.

A dedicated **NinFit REVIEW/TEST** signing identity now signs that artifact. It is **not**
the production/release key and grants nothing on Play.

| | |
|---|---|
| Alias | `ninfit-review` |
| Certificate SHA-256 | `BD:3F:0C:72:A4:A3:92:CD:FE:24:C3:E6:40:46:F3:40:6B:BC:1F:3C:32:7C:73:CE:C7:B8:D9:F9:84:78:B4:D2` |
| Key | RSA 3072-bit |
| Validity | 10 Sep 2026 - 26 Jan 2054 |
| Where it lives | GitHub Actions repository secrets and Kris's machine. Never in Git. |

Rules that must not be relaxed:

- The keystore is reconstructed on the runner from `NINFIT_REVIEW_KEYSTORE_BASE64` into
  `$RUNNER_TEMP` only, and removed at the end of the job.
- Signing is **fail-closed**: a trusted, artifact-producing build whose signing secrets are
  unavailable fails. It never falls back to the runner's debug key.
- After `assembleDebug`, the workflow reads the APK's certificate back with `apksigner`
  (`keytool -printcert -jarfile` as fallback) and fails unless the SHA-256 equals the
  fingerprint above, exactly one signer is present, and the subject is not `CN=Android Debug`.
- `src/test/androidReviewSigningContract.test.ts` pins all of the above so a later workflow
  or Gradle edit cannot silently return the published APK to ephemeral signing.
- Release signing is untouched. Browser/PWA behaviour is unchanged.

**The existing Samsung install must not be uninstalled yet.** It holds a deliberately
stranded real-world Journey kept as a recovery/regression case, backed up as the installed
APK, the native Journey SQLite database (recovery SHA-256
`0627955449A83BF41C43DBB8ACD2D6C8085328F0EA895237315DE8B8C3C57E59`) and the WebView Local
Storage LevelDB. Because the signer changes, the first review-signed build still requires a
controlled migration/recovery, not an in-place update. That is a human step.

CI proves the APK's signing identity. **CI does not prove Samsung background GPS
acceptance**, and H-D/H-J remain open.

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

1. Restore exact Vercel access and obtain a successful deployment of **#226** at head `294d9248c4d99356f16d1d78fd296e179dee430c`; do not merge #226.
2. Configure support and intended PostHog deployment values without committing credentials.
3. Run the consolidated phone/device sessions from the merged runbook, recording exact build/device evidence.
4. Re-query PostHog for G12/G13 exact receipts after explicit diagnostics opt-in and deliberate test paths.
5. Merge individual #214–#219 only when each applicable human/provider gate is satisfied, re-verifying `main` between merges.
6. Rehearse rollback with explicit authorisation and reconcile/publish the final privacy notice.
7. Only then assemble the roughly 15–25 person private beta.

## Handoff checkpoint

```text
HANDOFF CHECKPOINT
main SHA: 85ae0476f9286130ed6ff2c3cf7b47ea68716cef
latest merged PR: #230 — reconcile privacy readiness with current launch truth
current phase: pre-beta hardening / provider + human acceptance
active launch PRs: #214, #215, #216, #217, #218, #219
review-only PR: #226 (draft, DO NOT MERGE), head 294d9248c4d99356f16d1d78fd296e179dee430c
superseded/closed: #194, #201, #202, #203, #205, #209, #210
#226 GitHub gate: Verification Gate #102 PASS
#226 Vercel: recorded failure was provider 100-deployments/24h limit; exact current preview inspection blocked by unavailable connector
OSMF: constrained direct-tile use approved for small invitation-only private beta under #228; public beta/production requires re-review
PostHog: Cloud EU technically suitable with conditions under #229; G12/G13 and collection approval remain open
Android offline: earlier functional H-F observation exists; formal exact-build/device evidence remains incomplete
Journey #211: merged; requested light/dark real-phone visual gate still outstanding
Tortoise: clean standing + idle only; rejected Pika wave absent; future clean wave requires human approval + asset gates
notes: remote GitHub truth authoritative; do not merge human-gated PRs on green CI alone
```
