# NinFit Current State

A short live checkpoint for a human or agent picking the project up cold.

**Authority:** live Git, tests and repository contents outrank this file. If they disagree, believe Git and say so. See `skills/ninfit-handoff/SKILL.md`.

Last updated: **2026-09-05**

## Repository truth

| | |
|---|---|
| Remote | `https://github.com/krisninnis/ninfit.git` |
| `main` | `bf250f125392338e203960fc22fb6ebb1a8cd996` |
| Latest merged PR | **#211 — centre Journey Home and vertically stack Walk/Run, Cycle and Swim** |
| Open launch PRs | **#201 offline cold-start, #202 instrumentation, #203 launch-path trim, #205 support surface, #209 focus/tap targets, #210 Journey imagery failure** |
| Parked PR | **#194 deterministic Day 1 first-win selector** — stale base; do not merge now |
| Node | `24.x` |
| Current phase | **Pre-beta hardening / human acceptance** |

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
- **#211:** Journey Home now presents Walk/Run, Cycle and Swim as one centred vertical path. The PR was merged after green CI/Vercel before its requested real-phone light/dark visual gate was formally recorded, so that visual check remains outstanding.

## #201 — M3 offline cold-start

Current head: `a85dc42c1c75ce19e811024a1fdf832da173f3d8`.

Automated verification is green. The branch fixes optional-account preview crashes, stable artwork precaching, coherent cache generations, stale-root fallback and lazy-chunk survival across updates.

### Android real-device observation — 2026-09-05

A real Android installed-home-screen session on the final #201 preview was run online, then fully closed, then launched again with Airplane mode on and Wi-Fi off.

Observed:

- Today, Week, Journey, Progress, Profile and Settings opened;
- existing local state remained visible;
- Tortoise and Walk/Run, Cycle and Swim artwork loaded;
- Profile opened online and offline;
- no blank screen or broken artwork was observed.

This is recorded on PR #201 as a **functional Android H-F PASS observation**.

The canonical H-A→H-K matrix still requires exact device/build evidence fields before the formal ledger is considered complete. Do not weaken that evidence rule merely because the functional run looked good.

Still required before #201 may merge:

- **Android H-J:** Build A → Build B update without local-data loss, while a live old client and lazy screens remain safe;
- **iPhone H-F:** real installed offline cold start;
- **iPhone H-J:** real update-safety run.

Until #201 merges, canonical `main` still does not contain the new offline worker.

## Other open launch PRs — do not merge past their gates

### #202 — M4 privacy-safe instrumentation

Exactly six opt-in usage events plus scrubbed crash diagnostics. Default off. No fitness measurements, health notes, route points, free text, email or NinFit ID in usage events.

Remaining: real PostHog EU token, G12 deliberate scrubbed crash receipt, G13 six-event receipt, Settings visual acceptance.

### #203 — M5 two-path launch onboarding

New users may choose only Start moving or Return to fitness; permanent five-path/five-family architecture remains intact.

Remaining: human onboarding visual/flow acceptance. Do not expose Strength/Stamina/Balanced to new users.

### #205 — M7 support surface

Fail-closed Help & support surface. Beta decision remains a temporary personal support mailbox with the commitment **“We aim to reply within 3 working days.”** Keep deployment-configured, not hard-coded.

Remaining: configure deployment variables and visually verify the support surface + release-identity-only mail draft.

### #209 — visible focus and 44px quiet actions

Fixes the framed-number-field focus-ring cascade defect and makes quiet Clear/Sign in actions carry at least a 44px target without changing visual hierarchy.

Remaining: H-I VoiceOver/TalkBack and real-phone thumb check. Do not merge on CI alone.

### #210 — Journey imagery failure communication

Keeps the map mounted and route truth visible when base imagery fails, while showing honest imagery-unavailable copy after repeated tile failures.

Remaining: H-H real-GPU route-line proof, phone visual check in both themes, and the map-provider/privacy decision. The current default tile provider must not be treated as a settled public-beta production decision.

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

Today already retains dormant one-shot motion plumbing: when a future approved `motionSrc` exists, touch can play it once and return to the resting presentation. The hatch runtime also retains generic motion/fallback plumbing.

The desired future clean first-greeting sequence is:

**egg opens → Tortoise settles → looks toward user → one slow wave → idle**

and the same approved motion may support **tap Tortoise → one acknowledgement → idle**.

Do not fake this with the rejected asset or ship a new generated motion master before human approval and G9/G10/G11 pass.

## Remaining human/pre-beta gates

The authoritative ledger is `docs/pilot/device-accessibility-acceptance-matrix-v1.md`.

Still materially outstanding:

- H-A full hatch visual integrity;
- H-B reduced-motion hatch;
- H-C forced media-failure fallback;
- H-D/H-E 30-minute outdoor GPS + battery sessions on both platforms;
- H-F iPhone formal run and completion of exact evidence metadata;
- H-G backup → clear test data → restore/read-back;
- H-H real-GPU Adventure Map;
- H-I VoiceOver/TalkBack;
- H-J Android+iPhone update safety;
- H-K controlled three-week absence with no punishment.

Do not fabricate any of these from CI, desktop emulation or a different build.

## Legal / provider / operations

Before a stranger is invited into beta, still resolve and publish the real operator/privacy facts, provider/processor/retention/transfer truth, stable privacy notice URL, support deployment values, and the map provider decision. M10 production rollback rehearsal also remains NOT RUN and requires explicit human authorisation.

## Next execution order

1. Finish #201 H-J on Android and H-F/H-J on iPhone; merge only after exact-head verification and human evidence.
2. Human-review #209, #210 and the already-merged #211 Journey layout in one controlled phone session rather than interrupting development repeatedly.
3. Human-review #203 onboarding.
4. Configure/verify #205 support values.
5. Configure PostHog EU and close #202 G12/G13 + visual gate.
6. Run the remaining consolidated H-A→H-K device sweep, including GPS/battery and screen readers.
7. Rehearse rollback with explicit authorisation and reconcile/publish the final privacy notice.
8. Only then assemble the 15–25 person private beta.

## Handoff checkpoint

```text
HANDOFF CHECKPOINT
main SHA: bf250f125392338e203960fc22fb6ebb1a8cd996
latest merged PR: #211 — Journey Home central vertical launch stack
current phase: pre-beta hardening / human acceptance
open launch PRs: #201, #202, #203, #205, #209, #210
parked PR: #194
Android #201 H-F: functional real-device pass observed; formal ledger metadata still needs exact evidence fields
#201 remaining: Android H-J; iPhone H-F/H-J
Journey #211: merged; requested light/dark real-phone visual gate still needs formal recording
Tortoise: clean standing + idle only; rejected Pika wave absent; future clean wave requires human approval + asset gates
notes: remote GitHub truth authoritative; do not merge human-gated PRs on green CI alone
```
