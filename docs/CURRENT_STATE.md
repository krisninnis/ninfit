# NinFit Current State

A short live checkpoint for a human or agent picking the project up cold.

**Authority:** live Git, tests and repository contents outrank this file. If they disagree, believe Git and say so. See `skills/ninfit-handoff/SKILL.md`.

Last updated: **2026-09-05**

## Repository truth

| | |
|---|---|
| Remote | `https://github.com/krisninnis/ninfit.git` |
| `main` | `d86da1f43ceb7d649e4230515509717c0e33bf41` |
| Latest merged PR | **#220 — consolidated pre-beta real-device runbook** |
| Current phase | **Pre-beta hardening / provider + human acceptance** |
| Node | `24.x` |

Verify live Git before acting. Cut every new branch from current verified `origin/main`, never from a stale local checkout.

## Launch strategy

> **The first four weeks of starting again.**

NinFit is a calm, local-first fitness app for people starting or returning to movement. Launch scope remains intentionally narrow and free for the first public version. Target private beta is roughly **15–25 real users/pairs of hands** after P0 gates are satisfied.

Read `docs/LAUNCH_SUMMIT_2026-09-05.md` before changing launch scope.

## Completed summit work on `main`

- **M1 / #199:** defective Tortoise wave removed from runtime. Do not reintroduce it.
- **M2 / #200:** G9/G10/G11 mascot asset contracts enforced.
- **M6 preparation / #204:** privacy and medical-purpose boundary docs merged; legal/publication work remains.
- **M8 preparation / #206:** H-A through H-K acceptance ledger merged.
- **M10 preparation / #207:** rollback rehearsal record merged; rehearsal itself remains NOT RUN.
- **#211:** Journey Home presents Walk/Run, Cycle and Swim as one centred vertical path. Its requested real-phone light/dark visual gate remains outstanding despite the merge.
- **#213:** current OSM tile-policy evidence recorded. Normal interactive viewing is not categorically forbidden, but production provider/privacy/capacity approval remains pending and bulk/offline prefetch is prohibited by the public tile policy.
- **#220:** consolidated H-A→H-K real-device execution runbook merged at current `main`.

## Active launch candidates — do not merge past their gates

The old branches **#194, #201, #202, #203, #205, #209 and #210 are closed unmerged/superseded**. Do not revive or mechanically merge them.

### #214 — M7 support surface v2

Fail-closed Help & support configuration. The beta operational choice is the temporary support address already agreed by the owner, with **reply within 3 working days** as the commitment. Values remain deployment-configured, not hard-coded.

Remaining: configure the actual deployment variables and visually verify Settings plus the release-identity-only mail draft. The currently connected Vercel tooling does not expose environment-variable writes.

### #215 — two-path launch onboarding v2

New users may choose only **Start Moving** or **Return to Fitness**. Permanent five-path/five-family architecture remains intact.

Automated verification is green. Remaining: human onboarding visual/flow acceptance. Do not expose Strength/Stamina/Balanced to new users.

### #216 — visible focus + 44px quiet actions v2

Automated verification is green. Fixes the framed-field focus-ring cascade and makes quiet Clear/Sign in actions carry at least a 44px target without changing visual hierarchy.

Remaining: real-phone thumb/keyboard check. H-I VoiceOver/TalkBack remains a separate real-device gate.

### #217 — Journey imagery failure communication v2

Automated verification is green. Keeps the map mounted and route truth available while base imagery fails, shows an honest imagery-unavailable note after repeated failures, and clears that note when imagery succeeds.

Remaining: H-H real-GPU route-line proof and phone visual review in both themes. Map-provider/privacy/capacity approval is still pending.

### #218 — M4 privacy-safe instrumentation v2

Automated verification is green. Exactly six opt-in usage events plus scrubbed crash diagnostics; default off. No health measurements, route points, notes, free text, account email or NinFit ID are part of the usage-event contract.

Intended six events:

1. `onboarding_completed`
2. `hatch_completed`
3. `first_activity_recorded`
4. `activity_recorded` with coarse `{type,is_rest}` only
5. `journey_completed`
6. `app_opened_after_gap` with a coarse gap bucket

Connected PostHog discovery on 2026-09-05 found one accessible EU organization (`claw apps`) and one project (`Default project`, id `145242`). That project has existing unrelated traffic, but **none of the six NinFit events are present and no recent deliberate `$exception` receipt exists**.

Therefore **G12 and G13 remain NOT PASSED**. Connection/access alone is not receipt evidence. Remaining: configure the intended deployment token without committing it, opt in through NinFit Settings, exercise all six event paths and a deliberate scrubbed crash, then re-query PostHog for exact receipts plus human Settings visual acceptance.

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

The Vercel status for that head currently points to the team **build-rate limit**, not an application build failure. Treat the preview as unavailable until a real deployment succeeds. Do not transfer human evidence from another build.

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

Before a stranger is invited into beta, still resolve and publish the real operator/privacy facts, provider/processor/retention/transfer truth, stable privacy notice URL, deployed support values, PostHog G12/G13 receipts and the map-provider decision. M10 production rollback rehearsal remains NOT RUN and requires explicit human authorisation.

Vercel provider state on 2026-09-05:

- GitHub status for #226 is blocked by the team preview build-rate limit rather than a NinFit build error;
- the connected Vercel API currently returns a scope-authorization error for `krisninnis-projects` and needs re-authentication for that team before deployment inspection can resume;
- no available connector action can write deployment environment variables.

## Next execution order

1. Let the provider preview quota/access issue clear, then deploy **#226** as the single identified review candidate; do not merge it.
2. Configure support and PostHog deployment values without committing credentials.
3. Run the consolidated phone/device sessions from the merged runbook, recording exact build/device evidence.
4. Re-query PostHog for G12/G13 exact receipts after explicit diagnostics opt-in and deliberate test paths.
5. Merge individual #214–#219 only when each applicable human/provider gate is satisfied, re-verifying `main` between merges.
6. Rehearse rollback with explicit authorisation and reconcile/publish the final privacy notice.
7. Only then assemble the roughly 15–25 person private beta.

## Handoff checkpoint

```text
HANDOFF CHECKPOINT
main SHA: d86da1f43ceb7d649e4230515509717c0e33bf41
latest merged PR: #220 — consolidated pre-beta real-device runbook
current phase: pre-beta hardening / provider + human acceptance
active launch PRs: #214, #215, #216, #217, #218, #219
review-only PR: #226 (draft, DO NOT MERGE), head 294d9248c4d99356f16d1d78fd296e179dee430c
superseded/closed: #194, #201, #202, #203, #205, #209, #210
#226 GitHub gate: Verification Gate #102 PASS
#226 Vercel: provider build-rate limited; not a NinFit runtime failure
PostHog: connected EU project exists; G12/G13 remain NOT PASSED because six NinFit events + deliberate crash receipt are absent
Android offline: earlier functional H-F observation exists; formal exact-build/device evidence remains incomplete
Journey #211: merged; requested light/dark real-phone visual gate still outstanding
Tortoise: clean standing + idle only; rejected Pika wave absent; future clean wave requires human approval + asset gates
notes: remote GitHub truth authoritative; do not merge human-gated PRs on green CI alone
```
