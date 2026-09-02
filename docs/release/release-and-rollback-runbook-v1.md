# NinFit Release & Rollback Runbook v1

## Status

Operational runbook for the current GitHub + Vercel delivery model.

This document does not grant merge authority. Human review remains the release gate.

## Current delivery model

```
feature/docs branch
      ↓
GitHub pull request
      ↓
GitHub/Vercel checks
      ↓
Vercel Preview
      ↓
human review
      ↓
merge to main
      ↓
Vercel production deployment
      ↓
installed PWA receives current production build on a fresh online launch/update check
```

Canonical repository:

```
https://github.com/krisninnis/ninfit
```

Canonical production site:

```
https://ninfit.vercel.app
```

GitHub `main` is release truth. Never treat a local checkout or preview branch as the
production source of truth.

## Release prerequisites

Before merging any runtime/UI PR:

- branch is based on current verified `origin/main`
- diff is scoped to the approved slice
- focused tests pass
- relevant adjacent tests pass
- full appropriate Vitest passes, or a known environment-only failure is independently
  reproduced on clean current main
- TypeScript passes
- production build passes
- `git diff --check` passes
- semantic diff is reviewed
- Vercel Preview is Ready
- human visual review is complete when presentation changed
- no known blocker is hidden behind "pre-existing"

Documentation-only PRs may not need a visual preview, but must still be scoped and
reviewed.

## Phone-first human review

For a UI/runtime PR:

1. open the GitHub PR on the phone
2. open the Vercel Preview URL
3. inspect the exact changed flow
4. test light/dark where relevant
5. test mobile navigation
6. check for obvious console/runtime failures if available
7. only then merge

Do not install a PR Preview as the long-lived NinFit app. Preview URLs belong to one
branch/deployment and are for review.

## Production release

After merge:

1. verify the PR is actually merged into `main`
2. record the new merge SHA
3. verify Vercel production deployment reaches Ready
4. open the canonical production URL
5. smoke-test the changed flow
6. on an installed PWA, fully close and reopen while online
7. verify the current build identity in Settings/About where available
8. if the change affects Journey, perform only the safe bounded smoke test appropriate
   to that slice

Never assume "merge succeeded" means production is healthy until the deployment is
Ready.

## Minimum production smoke checks

For ordinary UI/settings releases:

- app launches
- Today renders
- primary navigation works
- Settings opens
- light/dark/system behaviour works if touched
- Data remains reachable
- no obvious horizontal overflow

For Journey releases:

- Journey Home opens
- map mounts
- no known MapLibre colour errors
- start/recording flows are only exercised when real-device permission testing is
  appropriate
- do not fabricate GPS data in production merely to make a smoke test pass

For PWA/update releases:

- production URL launches online
- installed app can reopen
- no surprise forced reload
- offline fallback remains available where practical
- local data is preserved

## Rollback principle

Rollback is a release action, not a data migration strategy.

If a bad client release ships, the preferred first recovery is to redeploy a known-good
production commit through Vercel/GitHub tooling.

Do not "fix" a bad release by deleting browser storage.

## When rollback is appropriate

Rollback is appropriate when:

- production fails to load
- a newly deployed UI blocks critical use
- a new client regression affects data entry or restore safety
- a Journey/GPS regression risks corrupting truth
- a PWA release prevents reliable launch/update
- a presentation change creates a severe unusable state and cannot be corrected faster
  with a tiny safe hotfix

## When rollback is NOT enough

Rollback alone is insufficient when:

- a persisted schema migration already changed local data irreversibly
- a bad import already replaced user data
- data was deleted
- an external service mutation occurred
- account/auth state changed remotely

Those require a specific recovery plan for the affected state.

## Rollback procedure

1. identify the last known-good production commit
2. verify it is genuinely known-good for the affected flow
3. redeploy/revert through the normal repository/deployment mechanism
4. confirm production reaches Ready
5. smoke-test the affected flow
6. verify installed PWA launch/update behaviour
7. record the incident and the bad/good SHAs
8. only then begin root-cause correction

Do not force-push `main`.

Prefer a normal revert commit/PR or Vercel redeployment of a known-good commit, according
to the exact incident.

## Data-safety rule during rollback

Never ask users to clear site data as part of rollback.

If troubleshooting appears to require destructive browser storage actions:

1. export JSON backup first
2. explain what may be lost
3. distinguish local fitness history from NinFit ID
4. proceed only with explicit human/user intent

## Environment/configuration

Client-exposed Vite/Supabase variables are configuration, not secrets, but privileged
service credentials must never be committed to the browser bundle.

Before changing production environment variables:

- document the variable
- identify owner/purpose
- confirm whether a preview environment differs
- test the affected flow in preview where possible
- avoid exposing privileged credentials client-side

## Auth-specific release caution

NinFit ID currently authenticates identity only; it does not mean fitness cloud backup.

Any auth change must preserve that distinction.

Before promoting auth changes:

- sign-up/sign-in/out paths must be checked
- redirect/callback configuration must match the deployment
- password recovery ownership/status must be known
- client error wording must not falsely promise fitness sync

## Incident record template

```
INCIDENT
date/time:
production SHA:
bad PR/commit:
affected flow:
user-data risk:
rollback/hotfix decision:
known-good SHA:
production Ready at:
smoke checks:
follow-up PR:
data recovery required: yes/no
notes:
```

## Release record template

```
RELEASE
PR:
merge SHA:
production deployment:
Vercel status:
human reviewer:
phone/device checked:
critical flow checked:
known limitations:
rollback target:
```

## Non-goals

This runbook does not authorise:

- automatic merges
- automatic production rollback without human approval
- deleting user local data
- privileged credential changes
- cloud fitness sync
- database migrations
- social/location backend changes
