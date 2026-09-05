# Pre-beta consolidated real-device runbook v1

Status: **execution guide only — it does not mark any H-gate passed.**

Use this alongside `device-accessibility-acceptance-matrix-v1.md`. The matrix remains the authoritative evidence ledger. This runbook exists so the outstanding phone checks can be performed in a small number of controlled sessions rather than as disconnected one-off tests.

## Build rule

Run acceptance only against a deliberately identified candidate build. Before beginning, record from Settings → About:

- NinFit version
- channel
- build fingerprint
- deployment/preview used

If the candidate changes during the session, stop and record which checks belong to which build. Do not transfer a PASS from one build to another without rerunning the affected behaviour.

## Evidence rule

For every device record make/model, OS/version, browser engine/version where visible, installed-PWA/Add-to-Home-Screen state, exact build fingerprint, reviewer and date. Keep screenshots/screen recordings/battery screenshots where they materially prove the result.

Do not turn an observation into a formal PASS when the matrix-required metadata is missing.

## Session A — visual, onboarding, support and interaction

Run on Android and iPhone, in both light and dark themes where the gate requires it.

1. Open Journey Home and verify the centred vertical Walk/Run → Cycle → Swim stack has no clipping/overflow and retains correct artwork.
2. Run fresh onboarding and confirm only **Start Moving** and **Return to Fitness** are offered to a new user. Confirm Strength, Stamina and Balanced are absent from the new-user choice/recommendation/alternate-path UI. Existing saved hidden-path data must remain loadable on a suitable test profile.
3. Run the full hatch ceremony and record H-A: one companion only, no ghost/double render, no generator watermark and no cut-off gesture. Current clean production behaviour may settle directly to standing/idle; do not expect or resurrect the rejected wave asset.
4. Enable reduced motion and record H-B: meaningful still-state progression, Skip works, companion arrives.
5. Exercise the controlled companion-motion failure case and record H-C: standing fallback remains reachable and the user is never trapped.
6. Open Settings → Help & support on a build where the beta support environment is actually configured. Verify the shown address/response commitment are the intended operational values and inspect the generated mail draft. It may contain release identity (version/channel/build) but no stored fitness, health, route or account payload.
7. Check the Profile `Clear` and NinFit ID `Sign in` quiet actions with a thumb. They should remain visually quiet but be comfortably hittable. Check framed fields with keyboard/switch input where available: visible focus must remain obvious.
8. Review the Journey imagery-unavailable note in light and dark themes. It must explain missing map imagery without implying that the Journey record itself was lost. On a slow connection, the note must clear when imagery successfully arrives.

Record failures rather than compensating for them during the run.

## Session B — screen reader / H-I

Use TalkBack on Android and VoiceOver on iPhone.

At minimum traverse and operate:

- Today
- Week
- Journey start and stop controls
- Settings → Data

Critical controls need understandable accessible names and task order. A visible Chromium focus ring is useful evidence for keyboard access but is **not** evidence that H-I passed.

## Session C — installed app, offline and update / H-F + H-J

Run separately on Android and iPhone.

### Build A baseline

1. Install/add NinFit to the home screen.
2. Launch from the home-screen icon while online.
3. Open primary destinations and Profile.
4. Create or verify harmless local test state that can be recognised after the update.
5. Record Build A fingerprint.

### Offline H-F

1. Allow the current worker/build to settle while online.
2. Fully close the installed app.
3. Turn Airplane mode on and Wi-Fi off.
4. Cold launch from the home-screen icon.
5. Verify Today, Week, Journey, Progress, Profile and Settings.
6. Verify existing local state is still present.
7. Verify approved mascot and Walk/Run, Cycle and Swim artwork is not broken.
8. Record H-F evidence.

The Android 2026-09-05 session is already a functional H-F observation, but the formal ledger still needs its exact device/build metadata. Do not use that observation as iPhone evidence or as H-J evidence.

### Build A → Build B H-J

1. Return online.
2. Keep an old Build A client alive while Build B becomes available through the real update path.
3. Confirm activation of Build B does not break the running Build A document.
4. Open lazy-loaded regions/screens after the update.
5. Relaunch from the home-screen icon on Build B.
6. Verify the recognisable local test state remains.
7. Record Build B fingerprint and H-J evidence.

Do not clear site data as update troubleshooting. Clearing local data is a separate controlled H-G drill.

## Session D — backup/restore / H-G

Use disposable test state, not the sole copy of valuable history.

1. Create a JSON backup.
2. Verify the backup file exists outside storage that will be cleared.
3. Record representative history/state before deletion.
4. Clear the intended site/app data.
5. Restore the JSON backup.
6. Re-open representative history and verify by read-back, not merely by an “import successful” message.
7. Record H-G.

## Session E — 30-minute outdoor Journey / H-D + H-E + H-H

Run once per device; collect H-D, H-E and H-H from the same real session.

Before starting record battery %, exact build fingerprint and start time. Begin a real outdoor Journey, permit GPS as required, and lock the screen for the required interval(s). After roughly 30 minutes record end battery %, finish time, recorded duration and recorded distance.

Verify:

- route is drawn
- distance is sane for the actual walk
- no unexplained GPS gaps
- Adventure Map route line is visibly drawn on the real device GPU
- Journey controls/state survived the locked-screen interval

Publish the observed battery percentage-point delta first. Do not present a percentage-per-hour extrapolation as the primary result.

## Session F — controlled three-week absence / H-K

Use a disposable test profile/device state.

1. Record original device date/time settings and current earned progress.
2. Move the controlled device clock/date forward by roughly three weeks.
3. Re-open relevant NinFit surfaces.
4. Confirm there is no punishment, decay, catch-up debt, loss of earned progress or shaming copy.
5. Restore automatic date/time immediately.
6. Record H-K evidence.

Do not rewrite historical fitness truth to make the UI look favourable.

## Merge / release rule

Green CI, Vercel Ready, responsive emulation, browser screenshots or another device's evidence do not replace these human gates. Merge a human-gated runtime PR only after the evidence relevant to that PR has been recorded and accepted against the exact build being merged.
