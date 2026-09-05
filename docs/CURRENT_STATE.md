# NinFit Current State

A short live checkpoint for a human or agent picking the project up cold.

**Authority:** live Git, tests and repository contents outrank this file. If they disagree, believe Git and say so. See `skills/ninfit-handoff/SKILL.md`.

Last updated: **2026-09-05**

## Repository truth

| | |
|---|---|
| Remote | `https://github.com/krisninnis/ninfit.git` |
| `main` | `61fc5ba7dfb9c1daea312d35f930c86c09fa4f12` |
| Latest merged PR | **#207 — rollback rehearsal record preparation** |
| Open launch PRs | **#201 offline cold-start, #202 instrumentation, #203 launch-path trim, #205 support surface** |
| Parked PR | **#194 deterministic Day 1 first-win selector** — stale base; do not merge now |
| Node | `24.x` |
| Current phase | **Pre-beta hardening / human acceptance preparation** |

Verify live Git before acting. Cut every new branch from current verified `origin/main`, never from a stale local checkout.

## Launch strategy

The launch wedge agreed at the 2026-09-05 summit is:

> **The first four weeks of starting again.**

NinFit is a calm, local-first fitness app for people starting or returning to movement. It is not trying to beat Strava at Strava. Launch scope is intentionally narrow and free for the first public version.

Target private beta: roughly **15–25 real users/pairs of hands** after the P0 gates below are satisfied.

Read `docs/LAUNCH_SUMMIT_2026-09-05.md` before changing launch scope.

## Recently completed on `main`

### M1 — defective Tortoise wave removed

PR **#199** removed the defective Tortoise wave lane from runtime while preserving standing/idle presentation, hatch truth, reduced motion, and media-failure fallback.

The removed wave had four verified faults: duplicate/overlapping Tortoises, visible Pika watermark, severe green matte spill, and truncation before the gesture completed.

Do **not** reintroduce that asset.

### M2 — mascot asset production contracts

PR **#200** added machine-enforced asset gates:

- committed provenance/approval manifest;
- rejected assets must be absent from shipped public assets;
- motion frame-0 alpha bbox must match its paired still;
- matte-spill threshold enforcement using the recovered alpha 16–239 definition;
- ffmpeg-backed verification in GitHub Actions.

Approved clean Tortoise idle remains production art. The defective wave and related proof/legacy assets were removed from `public/mascots`.

### M6 preparation — privacy and medical-purpose boundary

PR **#204** is merged.

Repository now contains:

- `docs/MEDICAL_DEVICE_BOUNDARY.md`
- `docs/PRIVACY_NOTICE_LAUNCH_READINESS.md`

These documents make M6 **prepared, not complete**. They deliberately do not invent legal/operator facts, lawful bases, Article 9 condition, provider retention, or a regulator determination.

M6 remains incomplete until the actual public privacy notice is reconciled with shipped production truth, reviewed with the required human/legal facts, hosted at a stable URL, and linked from the appropriate product/store surfaces.

### M8 preparation — human acceptance H-A through H-K

PR **#206** is merged.

`docs/pilot/device-accessibility-acceptance-matrix-v1.md` now contains explicit evidence rows for every launch-summit human gate H-A → H-K, separately for real iPhone and Android, with exact build/evidence fields.

Every new acceptance cell remains correctly **NOT RUN** until real-device evidence exists.

### M10 preparation — rollback rehearsal

PR **#207** is merged.

`docs/release/rollback-rehearsal-record-v1.md` now defines an auditable rollback rehearsal record and remains explicitly **NOT RUN**.

Production rollback itself remains human-authorised and has not been rehearsed yet.

## Open launch PRs — do not merge past their gates

### #201 — M3 offline cold-start

Branch/head last known:

- `fix/offline-cold-start-v1`
- `99e31f37a5b0034053a3c1368bff3a8d7f186ef5`

Implements build-manifest-driven offline boot with coherent hashed JS/CSS caching and no forced reload of a running document.

Automated verification is green.

**Remaining gate:** H-F on a real iPhone and a real Android: install/load the PR build online, fully close, enable airplane mode with Wi-Fi off, cold launch, and prove the React app plus existing local data render rather than a blank shell.

Until #201 is merged, canonical `main` still has the old shell-only service worker behaviour.

### #202 — M4 privacy-safe instrumentation

Branch/head last known:

- `feat/privacy-safe-instrumentation-v1`
- `af019c2ce0eb61c5c468e7a4da36073f4e78fda3`

Implements exactly six opt-in usage events plus scrubbed crash diagnostics using direct PostHog EU capture calls, without loading the browser analytics SDK.

Default is **off**. Event payloads exclude health measurements, health notes, GPS points/routes, free text, email and NinFit ID.

Automated verification is green.

**Remaining gates:**

- configure a real PostHog EU project token in the intended deployment;
- G13: confirm receipt of all six core events;
- G12: deliberately throw a test error and confirm scrubbed crash receipt;
- human visual acceptance of Settings → Data & privacy.

Do not update the third-party register from candidate to active until the provider is actually configured/used in the selected environment.

### #203 — M5 launch path trim

Branch/head last known:

- `feat/launch-path-trim-v1`
- `e345012aad3cb77b7d98ebe37b50da143e915eb0`

New onboarding offers only:

- Start moving (`start_moving`)
- Return to fitness (`return_to_fitness`)

The permanent five-path/five-family domain remains intact for old data and future programmes. Bear/Fox/Otter families and hidden path IDs must not be deleted merely because they are not launch-selectable.

Automated verification is green.

**Remaining gate:** human onboarding flow/visual review proving no new user is offered Strength/Stamina/Balanced and existing hidden-path data remains usable.

### #205 — M7 support surface

Branch/head last known:

- `feat/support-surface-v1`
- `e10ff46838bb2a83509c264f69840e2dc4f86504`

Adds fail-closed support configuration and Settings → Help & support.

Private-beta operational decision recorded on the PR:

- support address: `krisninnis@gmail.com`
- response commitment: **We aim to reply within 3 working days.**

These are public deployment values, not source-code constants. Keep them configurable so a future dedicated NinFit address (preferably a domain address such as `support@ninfit.app`) can replace the temporary mailbox without a code rewrite.

**Remaining gate:** configure the two deployment variables and visually verify the Settings surface + generated mail draft. The mail draft must contain release identity only, never fitness/health/location data.

## Product truth that must not regress

- Fitness is the product; companion/game systems are reinforcement.
- Calm by default. No guilt, punishment, broken-streak pressure, catch-up debt, decay or pay-to-win.
- Fitness truth is never manufactured by game, analytics or AI.
- Planned rest is valid adherence; absence does not remove permanent progress.
- Shared Journey Bond can grow only from genuine history and never decays.
- Exactly five path mascot families remain a durable architecture.
- Hatched species is permanent.
- Hatching grants no XP/trophy and must never leak species before the break.
- A started hatch commits exactly once; early unmount cannot cancel truth.
- Reduced-motion presentation must remain meaningful.
- Health/body data is neutral information, never diagnosis or verdict.
- Local fitness data is authoritative. NinFit ID is optional identity, not cloud fitness backup/sync.
- Generated visual assets require human approval before production runtime use.
- Human visual/device evidence outranks green CI for visual correctness.

## Premium egg / Tortoise art

The premium egg art gate is **closed**.

PRs #195/#196 provide the reviewed six-stage production egg set derived from one canonical master and wired into the hatch runtime. `EggArt`'s code-drawn shell is fallback only.

Do not reopen the egg art work while addressing unrelated companion motion.

Current Tortoise production presentation is standing + approved clean idle. The rejected Pika wave is intentionally absent.

A future clean wave may re-land only after human review and the M2 asset contracts pass.

## PWA / offline truth

On canonical `main` at this checkpoint, offline launch remains the old shell-only behaviour.

PR #201 contains the fix and has automated proof, but the product must not claim full offline cold-start until H-F passes on both real-device platforms and #201 is merged.

Network-dependent account/map/service features are not automatically promised offline even after M3.

## Journey / GPS truth

Journey records real GPS truth. Do not fabricate location points or distance to make a test pass.

Still required before private beta:

- H-D: 30-minute real outdoor walk with screen locked, route/distance checked on iPhone + Android;
- H-E: battery drain measured across the same sessions;
- H-H: Adventure Map route line visibly proven on real GPUs;
- lifecycle/permission behaviour observed rather than inferred from desktop emulation.

## Data safety truth

JSON is the restorable backup. CSV is not a backup.

Before beta, H-G must prove on both devices:

1. create/export a valid JSON backup;
2. preserve that backup outside the storage being cleared;
3. clear the test app/site data deliberately;
4. restore;
5. verify read-back/history returns.

Do not use site-data clearing as routine troubleshooting or rollback recovery.

## Accessibility / real-device gates

The full H-A → H-K ledger now lives in `docs/pilot/device-accessibility-acceptance-matrix-v1.md`.

Important remaining evidence includes:

- H-A hatch visual integrity on both themes/devices;
- H-B reduced-motion hatch;
- H-C forced media-failure fallback;
- H-I VoiceOver/TalkBack on Today, Week, Journey start/stop, Settings → Data;
- H-J install/home-screen/update without data loss;
- H-K simulated three-week absence with no punishment anywhere.

Desktop width checks and CI do not substitute for these real-device rows.

## Legal / support / operations

Privacy/operator/legal facts must not be invented from source code.

Still needed before a stranger is invited into the beta:

- final operator/controller identity decision;
- privacy contact details;
- launch jurisdiction/age boundary decisions;
- Article 6 lawful basis and Article 9 condition where applicable;
- final provider/processor/retention/transfer review;
- published stable privacy notice URL;
- #205 support variables configured and visually checked.

M10 rollback rehearsal also remains **NOT RUN** even though its record template is merged.

## Accounts

NinFit ID remains optional and must not be promoted as fitness sync/backup.

Password recovery remains a gap before account promotion.

## Parked work

| Branch / PR | Why parked |
|---|---|
| PR #194 / `feat/day1-first-win-selector-v1` | Domain-only selector on a stale base. Known duration-schema truth issue; do not merge during launch hardening. |
| `preserve/journey-home-mobile-background-v1` | Journey Home scenery prototype; reference only. |
| `future/ornate-mystery-egg-v1` | Unfinished alternate egg direction; not the approved production egg master. |

Do not resurrect stale historical branches merely because code is absent from a local checkout.

## Next execution order

The useful next work is no longer another speculative feature branch. It is to close the human/provider gates in a controlled session:

1. #201 H-F offline cold-start on real Android + iPhone.
2. #203 onboarding visual/flow acceptance.
3. #205 configure beta support deployment values and visually verify support/mail draft.
4. #202 configure PostHog EU and prove G12/G13 + Settings visual acceptance.
5. Run the consolidated H-A → H-K device sweep, including H-D/H-E 30-minute walks and H-I screen-reader checks.
6. Rehearse M10 rollback under the merged runbook/record with explicit human authorisation.
7. Publish/reconcile the final privacy notice when the actual production provider/configuration truth is known.
8. Only then assemble the 15–25 person private beta.

Do not merge #201/#202/#203/#205 solely because automated checks are green.

## Handoff checkpoint

```text
HANDOFF CHECKPOINT
main SHA: 61fc5ba7dfb9c1daea312d35f930c86c09fa4f12
latest merged PR: #207 — rollback rehearsal record preparation
current phase: pre-beta hardening / human acceptance preparation
merged summit work: M1 #199, M2 #200, M6-prep #204, M8-prep #206, M10-prep #207
open launch PRs: #201 offline cold-start; #202 instrumentation; #203 two-path launch onboarding; #205 support surface
parked PR: #194 deterministic Day 1 first-win selector
support beta decision: krisninnis@gmail.com; aim to reply within 3 working days; deployment-configured, not hard-coded
privacy status: boundary/readiness docs merged; public notice not yet published
human evidence status: H-A → H-K ledger merged; required real-device rows remain NOT RUN
rollback status: rehearsal record merged; rehearsal itself NOT RUN
primary blockers: #201 H-F; #202 real provider G12/G13 + visual; #203 visual flow; #205 deployment config + visual; H-D/H-E GPS+battery; H-I screen readers; final privacy/operator/legal publication facts
art status: premium egg approved; defective Tortoise wave removed; asset contracts enforced; clean idle remains approved production motion
notes: remote GitHub truth is authoritative; generated visual assets require human approval; do not merge visible changes on CI alone
```

Read `docs/LAUNCH_SUMMIT_2026-09-05.md`, `docs/DECISIONS.md`, the privacy/medical boundary docs, device acceptance matrix, and release/rollback runbook before consequential launch work.