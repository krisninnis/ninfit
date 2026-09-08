# NinFit Private-Beta Landing Plan v1

**Written:** 2026-09-08, against live remote truth, not a stale checkpoint.
**`origin/main`:** `03b45242d49fd670bead16e03e47984076fc5b8c` (merge of #232, the GPS Walk milestone).

This document exists because eleven PRs are open, seven of them can be merged by CI alone, and
merging any of them on that basis would be wrong. It records what each one is actually waiting
for, and the order in which they can land without inventing evidence.

## 1. The finding that reorders everything

**PR #226 is obsolete as the consolidated acceptance candidate.** It and all six of #214–#219
were cut from `23830f41` and are **19 commits behind `main`**. `main` has since taken the GPS
Walk milestone (#232), and the Journey map, auto-pause and native-provider work is stacked above
it in #237 → #238 → #240.

So the "one exact fingerprint" #226 was built to provide is a fingerprint of an app that no
longer exists: no vector basemap, no route fallback, no recording lock, no auto-pause, no native
boundary. Human evidence collected against it could not be transferred to the real beta build
without rerunning every affected gate — which is the exact rule `docs/CURRENT_STATE.md` already
states about transferring evidence between builds.

**Therefore: do not run the consolidated device session against #226.** Rebuild the consolidated
candidate on top of the landed stack, and run one session against that. #226 stays open as a
record and is closed unmerged when its replacement exists.

## 2. The stack, exactly as it stands

| PR | Branch | Base | Head | Automated | Blocked by |
|---|---|---|---|---|---|
| #237 | `feat/journey-map-lock-reward-v1` | `main` | `773bfbbc7c18` | Gate PASS, preview READY | **Human Samsung route-map gate** |
| #238 | `feat/journey-native-background-autopause-v1` | #237 | `1653a79c409f` | Gate PASS (via review PR #239) | #237 only |
| #240 | `feat/journey-native-provider-prep-v1` | #238 | `d84398cc52c0` → new head after the Finish slice | Gate PASS on the review head | #238, then its own review head |

`mergeable_state` is `clean` for all three. Nothing is conflicted; the stack is held entirely by
one piece of missing human evidence.

**#237's gate, stated exactly.** On the same real Samsung device that produced the original blank
map, a Journey that actually bears a route must show either vector map detail with the trusted
route line and start/end markers, **or** the explicit local route fallback. A blank rectangle is
a fail. A zero-distance Journey is not evidence either way.

Preview for that gate:
`https://ninfit-git-feat-journey-map-lock-reward-v1-krisninnis-projects.vercel.app`
It currently 302s to `vercel.com/login`, so it is behind Vercel Authentication — open it on the
phone while signed in to Vercel, or turn protection off for preview deployments first.

## 3. Landing order

Each step re-verifies `main` before the next begins.

1. **#237** — record the Samsung route-map evidence, then merge to `main`.
2. **#238** — retarget to `main`, re-run the gate on the exact retargeted head, merge.
3. **#240** — retarget to `main`, re-run the gate on the exact retargeted head, merge.
4. **`docs/journey-native-provider-selection-v1`** — mergeable now; docs only.
5. **`infra/capacitor-android-shell-v1`** — merge once the first Gradle build has been done by a
   human and the app has been seen to launch on the Samsung.
6. **Provider slice** — Transistorsoft adapter, foreground service, permissions, and the queue
   adapter that satisfies `NativeJourneyDurablePositionQueue`.
7. **Pause-drain slice** — the gap parked in
   `docs/architecture/journey-native-background-location-v1.md`: a manual Pause stops the motion
   session outright, so fixes already buffered natively are left unreplayed. Unreachable until a
   shell injects a queue, and it must land **before** the Samsung acceptance run, not after.
8. **Rebuild the consolidated candidate** from the new `main` plus #214–#219, and run one device
   session against that single fingerprint.
9. **#214–#219** — merge individually as their gates pass, re-verifying `main` between merges.

Retargeting #238 and #240 must not be done blindly: a retargeted head is a **new** head, and the
Verification Gate is only evidence for the head it ran on.

## 4. Consequence of the provider decision for #240

#240 contains a Capgo v8 adapter, a Capgo permission guard and a guarded Capgo bridge factory,
and its PR body names Capgo as the first Android candidate with Transistorsoft as fallback. The
evaluation in `docs/architecture/journey-native-provider-selection-v1.md` reverses that on
evidence: Capgo's own documentation states it has no on-disk queue and does not persist points
across process death, and its only durable path is an HTTP POST of route points — which the
privacy contract forbids.

The vendor-neutral boundary means no runtime code has to change. What must change is the claim:
**#240's PR body should be corrected when it is next pushed**, so the repository does not carry a
stated direction that the decision record contradicts. The Capgo adapter itself is kept for now —
it is small, tested, and documents the fallback — and whether to delete it is a decision for the
provider slice, not a silent cleanup.

## 5. The launch PRs, and what is actually left

All six are automated-green and 19 commits behind `main`. Their remaining gates are unchanged
from `docs/CURRENT_STATE.md` and are grouped here by the session that can clear them, because
grouping is the whole point of one consolidated run:

**Installed-app session (needs the Android shell):** H-J Android update safety (#219), locked-screen
Journey GPS, foreground-service notification, battery over 30–60 minutes.

**Phone-browser session (can run today):** #237 route map; #216 thumb/keyboard reach; #217 imagery
fallback in both themes including a slow connection; #215 onboarding visual/flow; #211's
outstanding Journey Home light/dark evidence.

**Configuration, not device:** #214 deployment support values; #218 the intended PostHog EU
project key, the privacy notice, the Settings opt-in, and then the six real usage receipts plus
one deliberate scrubbed crash (G12/G13).

**iPhone session:** H-F offline cold start, H-J update safety, VoiceOver.

## 6. What must not happen

- No merge of #237, #238 or #240 on green CI alone.
- No transfer of human evidence between build fingerprints.
- No merge of #240 before #238, or #238 before #237.
- No device session against #226.
- No claim of background GPS until an installed build has proven it on hardware.
