# Local Data Deletion & Device-Loss Inventory v1

## Status

**Current-behaviour inventory. No delete-all runtime action is authorised by this
document.**

This records what NinFit currently lets a person remove, what remains local-only, and
what is still missing before a real pilot can claim complete deletion/recovery
coverage.

## Current data boundary

Current user-facing truth on the Data screen is:

- fitness records are stored on this device in browser storage
- NinFit ID does not currently contain fitness records
- data is not synced to the cloud
- this device is the only copy unless the user exports a backup
- browsers can clear storage
- JSON backup is the restorable format
- CSV is an analysis/export format, not a restorable backup

That wording is directionally correct and must remain explicit.

## Inventory

| Data | Current persistence | Current user removal path | Pilot status |
|---|---|---|---|
| Profile | local repository | no dedicated delete action | GAP |
| Health notes | local repository | editable through Profile; no whole-history deletion action | PARTIAL |
| Baseline | local repository | editable; no whole-history deletion action | PARTIAL |
| Measurements | local repository | no per-entry or global deletion action is currently exposed | GAP |
| DailyLogs | local repository, one key/day | no Data-screen whole-history clear action | GAP |
| WeeklyPlans | local repository | no user-facing global clear | GAP |
| MetricSamples | local repository | no user-facing global clear | GAP |
| Game state / progression | local repository | no user-facing reset-all action | GAP |
| Game settings | local repository | editable; no explicit delete/reset-all action | PARTIAL |
| Completed/imported Journey history | separate local Journey history key | Journey history supports single-Journey removal internally; whole-history UI not established | PARTIAL |
| Active Journey recovery snapshot | separate local key | lifecycle clears/restores through Journey runtime; no generic Data-screen control | INTERNAL |
| Quarantine copies | local quarantine keys | intentionally retained; no user-facing purge flow | GAP / NEEDS POLICY |
| Exported JSON/CSV files | outside app storage, controlled by browser/device | user manages files through device storage | OUTSIDE APP |
| NinFit ID | Supabase authentication boundary | account deletion ownership not yet established in current product evidence | CONDITIONAL GAP |

## Important distinction

"Clear cache", "remove the PWA", "clear browser storage", "delete fitness history", and
"delete NinFit ID" are **not** the same operation.

NinFit must never tell a user to clear browser/site data as an ordinary update
troubleshooting step.

## Current restore safety

Restore is already consequence-weighted:

- user chooses a JSON backup
- backup is validated before write
- current data is backed up first
- restore replaces rather than silently merges
- failed writes are reported
- Journey blocks are authoritative only when present
- old backups that predate Journey support do not wipe Journey history they could not
  have contained

This makes backup/restore the current recovery path for accidental local-data loss.

## Missing pilot decision — Delete all local NinFit data

Before implementing a delete-all action, product must explicitly decide whether it
means all of:

- profile
- health context
- baseline
- measurements
- WeeklyPlans
- DailyLogs
- MetricSamples
- game state
- game settings
- Journey history
- active Journey recovery snapshot
- quarantine copies

Recommended meaning for a future **Delete all local data** action:

> Remove all NinFit-owned local fitness, Journey, game and preference state from this
> browser/device, while leaving separately downloaded backup/export files untouched and
> leaving optional remote NinFit ID identity untouched unless the user separately
> chooses account deletion.

That wording keeps local deletion and remote identity deletion separate.

## Future delete-all safety contract

If authorised, the smallest safe v1 should require:

1. user opens Settings → Data & privacy
2. user enters a clearly destructive section
3. UI explains exactly what will be deleted
4. UI explains NinFit ID is separate
5. UI recommends/links JSON backup first
6. explicit confirmation step
7. no single accidental tap deletion
8. deletion is performed through a single owned application boundary
9. post-delete read verifies NinFit-owned keys are actually gone
10. app returns to a coherent first-run state

Do not rely on a browser-wide `localStorage.clear()` call. NinFit should delete only
its own keys so unrelated same-origin storage is not casually destroyed.

## Quarantine policy decision

Quarantine copies are deliberately retained today so corruption is not destroyed by
being read.

A future delete-all action should probably remove quarantine values too, because the
user explicitly asked to erase NinFit local data.

But normal repair/reinitialisation must continue to preserve quarantine data.

This needs to be locked in the delete-all implementation spec rather than inferred in
code.

## Single-record deletion

Where NinFit already supports deletion of an individual record, that action should
remain narrower than delete-all.

Examples:

- remove one Journey
- remove one measurement
- remove one daily record where a future UI offers that action

Deleting one source record also raises a future Living Adventure requirement:
downstream memories/map projections must no longer claim facts whose only provenance
was deleted.

That dependency does not exist in current runtime yet, but the architecture should
honour it when Adventure features arrive.

## Device loss

Current local-first truth:

If the phone/browser storage is lost and the user has no JSON backup, current
repository evidence does not establish another copy of fitness history.

Therefore pilot wording must not imply automatic recovery.

Recommended user-facing wording:

> NinFit currently keeps your fitness history on this device. Your NinFit ID does not
> back up fitness history yet. Export a JSON backup occasionally if the history matters
> to you, especially before clearing browser data, replacing your phone or removing the
> installed app.

Exact platform behaviour around removing a PWA varies, so avoid promising that uninstall
always does or does not delete browser data.

## Phone update troubleshooting

Safe order:

1. confirm production deployment is Ready
2. close/reopen NinFit while online
3. check Settings → About/build identity where available
4. if still stale, inspect PWA/service-worker state
5. export a JSON backup before any destructive browser-storage troubleshooting

Never begin with "clear app data."

## NinFit ID deletion

Authentication identity and local fitness history remain separate.

A future account-deletion feature must make clear whether it deletes:

- authentication account only
- profile metadata held remotely
- any future synced fitness data

Until that exists, local delete-all must not claim to delete the remote account.

## Pilot acceptance decision required

Gate F should remain **PARTIAL / BLOCKED FOR COMPLETE PILOT CLAIM** until the product
chooses and implements or explicitly accepts the absence of a user-facing delete-all
path.

Gate G device-loss wording can pass only after the final user-facing copy is verified
on the actual Data/Settings surfaces.

## Recommended next slice

After human approval of the semantics above:

**Delete All Local Data v1**

Scope should be deliberately small:

- one owned deletion function
- exact NinFit key inventory
- confirmation UI in Data & privacy
- backup-first warning
- read-back verification
- focused tests proving no unrelated keys are removed
- no Supabase account deletion
- no cloud-sync work
