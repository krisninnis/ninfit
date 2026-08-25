# NinFit Release Readiness Checklist

Status: operational checklist. This document does not itself prove a release is safe, compliant, production-ready, or store-ready. Each release must carry current evidence.

## Purpose

Use this checklist before promoting NinFit changes to production, publishing a public preview, or preparing a native/app-store release. It is intentionally broader than a test command: it covers repository truth, build health, mobile behaviour, PWA installation, privacy, permissions, deployment, rollback, and user-facing risk.

## Release classes

Choose the smallest class that accurately describes the release.

- **Docs-only** — no runtime, styles, tests, package, storage, deployment, permission, or user-facing behaviour changes.
- **Web product** — runtime/UI behaviour changes delivered through the web/PWA.
- **Sensitive-data** — GPS, health/wearable, account, cloud-sync, export/deletion, analytics, or social-data changes.
- **PWA/platform** — manifest, service worker, installability, caching, browser/platform metadata, or deployment behaviour changes.
- **Native/store** — Capacitor/native bridge, Android/iOS permissions, signing, Health Connect/HealthKit, store packaging, or store submission.

A release can belong to more than one class. Apply every relevant section.

---

## 1. Repository truth

- [ ] `git fetch origin` completed in the implementation environment.
- [ ] Current branch is the intended release branch.
- [ ] `HEAD` and `origin/main` are recorded.
- [ ] Working tree status is understood before changes are made.
- [ ] No unrelated dirty/untracked work is mixed into the release.
- [ ] The pull request base is current enough for meaningful verification.
- [ ] Changed files match the authorised slice.
- [ ] Forbidden/non-goal paths were not changed accidentally.
- [ ] Any merge/rebase conflict resolution has been reviewed semantically, not only mechanically.

Evidence to retain:

```text
branch:
HEAD:
origin/main:
changed files:
working tree verdict:
```

## 2. Specification and scope

- [ ] The change follows the canonical NinFit delivery loop.
- [ ] A durable spec exists when required by the delivery-loop trigger rules.
- [ ] Acceptance criteria are explicit.
- [ ] Non-goals are explicit.
- [ ] Any parked work discovered during implementation remains parked unless separately authorised.
- [ ] The task finishes in the same task class in which it started unless an explicit reclassification was approved.

## 3. Automated verification

For code-changing releases, run the repository-standard verification from a clean/reproducible checkout where practical.

- [ ] Focused tests for the changed behaviour pass.
- [ ] `npm test` passes.
- [ ] `npm run typecheck` passes, or equivalent repository-approved typecheck evidence exists.
- [ ] `npm run build` passes.
- [ ] `git diff --check` is clean.
- [ ] Source-scanning tests, if used, are understood as structural guards rather than runtime proof.
- [ ] New runtime behaviour has runtime-level coverage where the existing test environment can support it.
- [ ] If runtime/component coverage is not currently possible, the gap is recorded rather than hidden by a green source-scan test.

Record:

```text
focused tests:
full tests:
typecheck:
build:
diff --check:
```

## 4. Change review

- [ ] `git diff --stat` reviewed.
- [ ] `git diff --name-only` reviewed.
- [ ] Full diff reviewed.
- [ ] No generated noise or line-ending churn obscures the semantic change.
- [ ] New dependencies, scripts, configuration, environment variables, permissions, storage keys, or network calls are called out explicitly.
- [ ] Existing behaviour outside the slice is not weakened to make tests pass.

## 5. Mobile layout and accessibility

For user-facing releases:

- [ ] 360 px viewport checked.
- [ ] 390 px viewport checked.
- [ ] 430 px viewport checked.
- [ ] 768 px viewport checked where relevant.
- [ ] 1024 px viewport checked where relevant.
- [ ] No unintended horizontal overflow.
- [ ] Light mode checked.
- [ ] Dark mode checked.
- [ ] Reduced-motion behaviour checked where animation changed.
- [ ] Text remains readable at normal browser zoom.
- [ ] Touch targets are usable on a phone.
- [ ] Keyboard/focus behaviour checked where interactive controls changed.
- [ ] Meaning is not conveyed by colour alone where attention/safety status is involved.
- [ ] Safe-area behaviour checked on mobile where bottom/top fixed UI changed.

## 6. PWA/installability

For manifest/service-worker/platform changes:

- [ ] Manifest is reachable from the deployed origin.
- [ ] `name` and `short_name` are correct.
- [ ] `start_url` and `scope` are correct.
- [ ] `display` mode is intentional.
- [ ] 192x192 icon resolves.
- [ ] 512x512 icon resolves.
- [ ] Apple touch icon resolves.
- [ ] Theme colours are intentional.
- [ ] Service worker registers without console errors.
- [ ] Service-worker scope is correct.
- [ ] Service worker does not cache or expose sensitive data unintentionally.
- [ ] Navigation/offline behaviour matches the release claim.
- [ ] Upgrade from a previous service worker does not strand users on stale assets.
- [ ] Android/Chromium install path checked on a real device.
- [ ] App launches from the home-screen icon.
- [ ] Installed app opens in the intended standalone presentation.
- [ ] Closing and reopening the installed app works.
- [ ] iOS Add to Home Screen path is checked when iOS support is claimed.

Do not describe a PWA as a native APK/iOS app.

## 7. GPS and location gate

Required for any Journey/GPS/location change:

- [ ] Precise location remains private by default.
- [ ] Permission request is contextual and understandable.
- [ ] Recording does not begin before required permission/state is available.
- [ ] GPS quality/accuracy is surfaced or handled honestly.
- [ ] Weak/lost GPS is not presented as a perfect route.
- [ ] Raw and accepted route evidence remain distinguishable where the architecture requires it.
- [ ] Pause/resume semantics are preserved.
- [ ] Timing and distance do not accumulate incorrectly while explicitly paused.
- [ ] Refresh/interruption/recovery behaviour matches the product claim.
- [ ] No exact coordinates appear in URLs, analytics, marketing events, crash breadcrumbs, or ordinary logs by default.
- [ ] Route deletion behaviour is still possible under the architecture.
- [ ] Home/sensitive-place inference is not silently introduced.
- [ ] Real-device field testing completed before calling a GPS recorder production-ready.

Field-test evidence:

```text
device:
OS/browser/app shell:
route type:
permission result:
pause/resume:
GPS loss/weak signal observations:
distance plausibility:
recovery/interruption result:
issues found:
```

## 8. Wearable/health-data gate

For Fitbit, Health Connect, HealthKit/Apple Watch or health-data imports:

- [ ] Current provider/platform documentation checked at implementation time.
- [ ] Minimum permissions/scopes requested.
- [ ] Source lineage/provenance preserved.
- [ ] Transport source is not confused with measuring device.
- [ ] Duplicate/reconciliation logic runs before PB/achievement/reward evaluation.
- [ ] Uncertain duplicate matches fail safely.
- [ ] Imported observations do not silently overwrite original source values.
- [ ] Disconnect/revocation behaviour is tested.
- [ ] User can understand which source supplied important metrics.
- [ ] Provider branding/attribution requirements are satisfied.
- [ ] Deletion/export implications are understood.

## 9. Storage, migration and recovery

For persistence/schema/storage changes:

- [ ] Existing user data remains readable or has an explicit migration.
- [ ] Migration is deterministic and tested.
- [ ] Failure does not silently destroy previous data.
- [ ] Corrupt/unknown records fail safely.
- [ ] Export still works where relevant.
- [ ] Import still works where relevant.
- [ ] Delete/reset behaviour remains intentional.
- [ ] Active-recording recovery behaviour is tested if Journey persistence changed.
- [ ] Storage keys/schema versions are documented where required.
- [ ] Rollback implications for newly written data are understood.

## 10. Privacy and security

Apply the Privacy & Security Readiness checklist and Third-Party Service Register where relevant.

- [ ] Data-flow changes identified.
- [ ] New third-party service/SDK/API recorded before production use.
- [ ] No secrets committed.
- [ ] Environment variables are separated appropriately across dev/preview/production.
- [ ] Least privilege used for credentials/scopes.
- [ ] Sensitive values are redacted from logs and diagnostics.
- [ ] Account/session changes have appropriate invalidation/revocation behaviour.
- [ ] Export/deletion implications reviewed.
- [ ] Analytics/marketing do not receive precise routes or health measurements by default.
- [ ] User-facing copy does not overstate privacy, security, health, or legal guarantees.

## 11. Health and safety claims

- [ ] Fitness guidance is not presented as diagnosis or medical treatment.
- [ ] Health data is described accurately and with appropriate uncertainty.
- [ ] Derived estimates are not presented as directly measured facts.
- [ ] Wearable/source discrepancies are not hidden.
- [ ] The product does not punish or shame users for inactivity, missed goals, illness, disability, or recovery days.
- [ ] Game/reward presentation does not fabricate fitness evidence.

## 12. Rewards and game integrity

For reward/achievement/PB changes:

- [ ] Fitness truth is established before game/reward evaluation.
- [ ] Duplicate imports cannot create duplicate rewards.
- [ ] Manual/imported/measured evidence rules are explicit for affected achievements.
- [ ] No purchase path creates prestige, PBs, trophies, evolution, fitness history, or health evidence.
- [ ] Existing reward ordering and acknowledgement behaviour remains deterministic unless deliberately changed.
- [ ] No guilt/punishment regression introduced.

## 13. Third-party/network behaviour

- [ ] Every new external call has a documented purpose.
- [ ] Failure/timeout behaviour is understood.
- [ ] Provider outage does not corrupt local fitness truth.
- [ ] Attribution/licensing obligations are satisfied.
- [ ] API keys are restricted where supported.
- [ ] Rate limits/quotas are understood.
- [ ] User-facing behaviour remains reasonable when offline or when provider calls fail.

## 14. Preview deployment

- [ ] Pull-request preview deployment succeeds.
- [ ] Preview URL opens on desktop.
- [ ] Preview URL opens on a real phone where user-facing mobile behaviour changed.
- [ ] Browser console has no new errors/warnings attributable to the slice.
- [ ] Network panel shows no unexpected 4xx/5xx requests.
- [ ] Static assets/icons/backgrounds required by the slice resolve.
- [ ] Environment-specific behaviour matches preview expectations.
- [ ] Sensitive preview data is not exposed publicly by mistake.

Record preview URL and deployment ID/commit where practical.

## 15. Production promotion

Before merge/promotion:

- [ ] PR head SHA is the exact SHA that was reviewed and verified.
- [ ] Required checks are green.
- [ ] PR is mergeable.
- [ ] Scope summary is accurate.
- [ ] Known limitations are stated.
- [ ] Rollback path is understood.
- [ ] No unrelated draft/experimental branch is being promoted accidentally.

After merge:

- [ ] Confirm merge commit on live `main`.
- [ ] Confirm production deployment was triggered from that merge/main state.
- [ ] Confirm production deployment succeeds.
- [ ] Open production URL on desktop where practical.
- [ ] Open production URL on a real phone for user-facing/mobile releases.
- [ ] Confirm critical feature path once in production.
- [ ] Confirm console/runtime health when relevant.

## 16. Rollback plan

Every non-trivial runtime release should answer before shipping:

- [ ] What exact commit/PR introduced the change?
- [ ] Can the release be reverted cleanly?
- [ ] Did it write data that an older version cannot understand?
- [ ] Did it change external permissions/scopes or provider configuration?
- [ ] Did it migrate/delete data?
- [ ] Is feature-disable behaviour available if a full rollback is unsafe?
- [ ] Who/what evidence would trigger rollback?

A green deployment is not proof that rollback is safe.

## 17. Native/app-store additions

Required before any future Capacitor/native/store release:

- [ ] Package/bundle identifiers locked.
- [ ] Android/iOS signing material stored outside Git.
- [ ] Development and production signing separated appropriately.
- [ ] Required native permissions are minimal and justified.
- [ ] Background-location permission is requested only if the feature genuinely requires it.
- [ ] Health Connect/HealthKit entitlements and store declarations match actual use.
- [ ] Privacy labels/data-safety forms match actual data flows.
- [ ] Store screenshots/descriptions match the shipped behaviour.
- [ ] Support/privacy-policy links are live.
- [ ] Version/build numbers are intentional.
- [ ] Upgrade from prior installed build tested.
- [ ] Uninstall/reinstall behaviour understood.
- [ ] Real Android device tested.
- [ ] Real iOS device tested before claiming iOS readiness.

## 18. Release evidence pack

For meaningful releases, capture a compact record:

```text
Release / PR:
Release class:
Base SHA:
Head SHA:
Merge SHA:
Files changed:
Focused tests:
Full tests:
Typecheck:
Build:
Diff check:
Preview deployment:
Production deployment:
Phone/device tested:
PWA install tested:
Privacy/security review:
Known limitations:
Rollback path:
Verdict:
```

## 19. Release verdict vocabulary

Use one clear ending:

- **READY FOR PREVIEW** — implementation evidence is sufficient for a preview deployment; not yet authorised for production.
- **READY TO MERGE** — reviewed branch is suitable to merge, subject to explicit merge authorisation.
- **READY FOR PRODUCTION ACCEPTANCE** — merged production deployment is healthy and awaits/has begun real acceptance testing.
- **RELEASE ACCEPTED** — required post-deploy checks are complete for the stated release class.
- **NOT READY** — one or more required gates remain unresolved.

Do not collapse these into one vague “done”.

## 20. NinFit-specific release principle

A release is not successful merely because it builds. For NinFit, the release must preserve fitness truth, user agency, privacy, calm presentation, and recoverability while changing only what the authorised slice intended.
