# NinFit Privacy & Security Readiness v1

**Status:** Planning/checklist only. This document is not a legal opinion and does not claim NinFit is compliant, certified or launch-ready.

**Purpose:** Keep the boring-but-important privacy, security, data-governance and app-store work visible as the product moves from a local-first prototype toward GPS, wearable sync, accounts, cloud features and eventual public release.

## 1. Product principles to preserve

- Private by default.
- Local-first where practical.
- Collect only data NinFit actually needs.
- Preserve provenance for imported health and activity data.
- Never silently turn an imported record into a different source's measurement.
- Precise location deserves stronger handling than ordinary fitness summaries.
- Fitness history and precise route history must be separable where possible.
- Users must be able to understand what leaves their device and why.
- No health diagnosis or unsupported medical claims.
- No pay-to-win or paid fabrication of achievements, PBs, trophies, XP, prestige or fitness evidence.
- Human approval remains required for sensitive public claims, destructive data actions and meaningful marketing-spend changes.

## 2. Data inventory

Before public launch, maintain an explicit inventory covering each data category below.

| Data category | Example | Current/future source | Precise/sensitive? | Local/cloud decision required |
|---|---|---|---|---|
| Account identity | email, user ID | account system | yes | yes |
| Profile | display name, birth year, units | user | yes | yes |
| Health context | health notes | user | sensitive | yes |
| Measurements | weight, waist, RHR, HRV | user/device | sensitive | yes |
| Daily activity | completion, plan participation | NinFit | personal | yes |
| Journey summary | distance, duration, pace | NinFit/device | personal | yes |
| Precise route | GPS coordinates | phone/watch | highly sensitive | yes, separately |
| Wearable observations | HR, steps, workout data | Fitbit/Health Connect/HealthKit | sensitive | yes |
| Source lineage | device/provider/transport | imported data | personal | yes |
| Rewards/game state | XP, achievements, mascot state | NinFit | personal | yes |
| Diagnostics | errors, build/runtime diagnostics | app/platform | may contain personal data | yes |
| Marketing analytics | campaign/install/activation events | future analytics stack | personal/pseudonymous | yes |

For every category eventually record:

- purpose;
- source;
- storage location;
- retention period;
- processors/subprocessors involved;
- export behaviour;
- deletion behaviour;
- whether it is required or optional;
- whether consent/permission is separate;
- whether it can reveal health status, routine, home/work location or identity.

## 3. GPS and location gate

Before precise route data is persisted or synced beyond the current prototype:

- [ ] Exact route is private by default.
- [ ] Location permission request explains the immediate purpose.
- [ ] Background-location behaviour, if introduced, has its own explicit UX and platform justification.
- [ ] Raw GPS points and accepted/filtered route points remain distinguishable.
- [ ] GPS gaps are represented honestly rather than invented.
- [ ] Home/sensitive-location masking is designed before social route sharing.
- [ ] Route visibility supports at least private, summary-only, masked-route and explicit full-route choices before social launch.
- [ ] Sharing a masked route cannot expose exact coordinates through visible metadata or an alternate representation.
- [ ] A user can remove precise route data without necessarily deleting the fitness summary.
- [ ] Precise-route cloud sync can be controlled separately from ordinary fitness-summary sync.
- [ ] Location-derived achievements can retain the achievement fact without requiring public exposure of the raw route.

## 4. Wearable and health-data gate

Before Health Connect, Fitbit, HealthKit or Apple Watch data reaches production:

- [ ] Every imported observation has provenance.
- [ ] Source lineage distinguishes observer/device from transport/import layer.
- [ ] One real activity cannot create multiple rewards merely because several sources report it.
- [ ] Duplicate/reconciliation logic runs before PB, achievement and reward evaluation.
- [ ] Uncertain duplicate matches are not destructively auto-merged.
- [ ] Original imported values are retained rather than silently rewritten.
- [ ] Derived NinFit values are labelled internally as derived.
- [ ] Permissions request only required data types.
- [ ] Revoking a provider permission has a defined effect on future sync and already-imported data.
- [ ] Provider disconnection does not silently destroy existing user history.
- [ ] Manual entries are provenance-labelled and cannot satisfy achievements that explicitly require measured/GPS evidence unless the product contract says so.

## 5. Accounts, authentication and sessions

Before account/cloud features are considered production-ready:

- [ ] Email/authentication flows do not reveal whether another person's account exists unnecessarily.
- [ ] Authentication secrets/tokens are never committed to Git.
- [ ] Browser/client code contains only publishable/public credentials where appropriate.
- [ ] Server-only secrets are kept server-side.
- [ ] Session expiry and sign-out behaviour are defined.
- [ ] Password-reset/account-recovery flows are verified end-to-end.
- [ ] OAuth callback/redirect allowlists are restricted to intended environments.
- [ ] Development/preview URLs cannot accidentally become trusted production callbacks without review.
- [ ] Destructive account actions require deliberate user confirmation.
- [ ] Account deletion has a documented data-deletion lifecycle.

## 6. Storage, export and deletion

Before public launch:

- [ ] User-visible export includes the data users reasonably expect to own.
- [ ] Import does not overwrite unrelated data silently.
- [ ] Schema migrations have backup/recovery expectations.
- [ ] Local unreadable/corrupt data continues to fail safely rather than disappear silently.
- [ ] Delete Journey is defined.
- [ ] Delete route only is defined for precise-location history.
- [ ] Delete account is defined.
- [ ] Delete all cloud data is defined.
- [ ] Deletion across processors/backups has a documented policy before claims such as "deleted permanently" are made.
- [ ] Retention periods are explicit rather than accidental.
- [ ] Test/demo data is kept separate from real-user data where appropriate.

## 7. Security engineering checklist

As NinFit gains cloud/native capability:

- [ ] Dependency updates are reviewed regularly.
- [ ] Secret scanning is enabled where practical.
- [ ] Production and preview environments use separate configuration where needed.
- [ ] Error logs avoid unnecessary health/location payloads.
- [ ] Logging of full GPS coordinates is prohibited by default unless a bounded diagnostic explicitly requires it.
- [ ] User identifiers are minimised in logs.
- [ ] API access is authenticated and authorised per user rather than merely hidden in the UI.
- [ ] Server-side ownership checks exist for every user-owned cloud object.
- [ ] Rate limits/abuse controls are considered before public writable endpoints.
- [ ] File uploads, if introduced, have type/size/storage boundaries.
- [ ] Third-party webhooks, if introduced, verify authenticity.
- [ ] Production backups and restore testing are defined before cloud data becomes irreplaceable.
- [ ] Security incidents have a simple owner/process rather than relying on ad-hoc discovery.

## 8. Third-party register

Maintain a simple register before launch. Each entry should state what is shared and why.

Candidate/future categories include:

- hosting/deployment;
- authentication/database;
- map tile provider;
- Android health/wearable transport;
- Apple health/wearable transport;
- Fitbit or other direct provider API;
- crash/error monitoring;
- product analytics;
- email/push delivery;
- payment/subscription processor;
- marketing/ad platforms.

For each provider capture:

- provider name;
- purpose;
- categories of data sent;
- whether precise route or health data is involved;
- region/storage considerations where relevant;
- user-facing disclosure location;
- deletion/disconnection behaviour;
- contract/DPA or equivalent review status where required.

## 9. Privacy notice readiness

Before a public/privacy notice is treated as final, it must be derived from actual implemented data flows rather than aspirational architecture.

It should clearly explain, in plain language:

- what NinFit collects;
- what remains only on-device;
- what is synced;
- why each category is used;
- health/wearable imports;
- precise location and routes;
- third-party providers;
- retention/deletion;
- export/access choices;
- account deletion;
- contact route for privacy questions;
- material changes to the notice.

Do not copy another fitness app's privacy notice and substitute the NinFit name.

## 10. Health-claim guardrail

NinFit is a fitness/wellbeing product unless a future deliberate regulatory decision changes that boundary.

Before publishing product or marketing copy:

- [ ] Avoid diagnosis claims.
- [ ] Avoid claiming NinFit treats, prevents or cures a medical condition unless formally supported and authorised.
- [ ] Distinguish user-entered health context from clinical information.
- [ ] Do not present inferred metrics as clinical facts.
- [ ] Avoid unsupported precision in calories, fitness scores or health predictions.
- [ ] Mark estimates/derived values appropriately in the product model.
- [ ] Review health-related advertising separately from ordinary brand copy.

## 11. Social/community safety gate

Before social routes, groups or messaging launch:

- [ ] Private is the default.
- [ ] Precise home/work start points are not exposed by default.
- [ ] Block/report controls exist where user-to-user interaction exists.
- [ ] Visibility choices are understandable and reversible.
- [ ] Minor-user policy/age boundary is explicitly decided before accepting minors into social functionality.
- [ ] Public profile fields are minimised.
- [ ] Location sharing is never required for participation in ordinary fitness tracking.
- [ ] Group/leaderboard design does not leak private health/location information.
- [ ] Moderation and abuse-report handling have an owner.

## 12. Marketing and analytics gate

Before installing advertising/marketing SDKs or broad behavioural analytics:

- [ ] Define the minimum events actually needed.
- [ ] Keep precise route coordinates out of marketing analytics.
- [ ] Keep raw health metrics out of advertising audience payloads.
- [ ] Document any cross-service identifiers.
- [ ] Separate product analytics from advertising where possible.
- [ ] Provide consent/choice where required by the chosen implementation and jurisdiction.
- [ ] Do not optimise advertising against sensitive health/location attributes without a specific review.
- [ ] Agents may recommend campaigns, but sensitive claims and meaningful spend changes remain human-approved.

## 13. App-store / distribution readiness

Before Play Store, App Store, TestFlight or equivalent public distribution:

- [ ] App permissions match actual functionality.
- [ ] Store privacy/data-safety disclosures match actual production behaviour.
- [ ] Screenshots/descriptions do not overclaim features that are not shipped.
- [ ] Health/location permission descriptions are specific and understandable.
- [ ] Privacy-policy URL is stable and public when required.
- [ ] Support/contact route exists.
- [ ] Version/build identifiers are controlled.
- [ ] Signing keys/certificates are backed up and access-controlled.
- [ ] Production signing material is not committed to Git.
- [ ] Release rollback/emergency-fix process exists.

## 14. PWA/demo distribution checklist

For the near-term installable demonstration build:

- [ ] Web app manifest exists and reflects NinFit branding.
- [ ] 192px and 512px icons render correctly.
- [ ] Standalone display mode is tested on Android.
- [ ] iOS Add to Home Screen is tested separately.
- [ ] Service-worker behaviour is deliberately minimal until offline/data-consistency behaviour is specified.
- [ ] No stale application shell hides a newly deployed critical fix.
- [ ] The demo clearly distinguishes prototype GPS behaviour from production-ready background recording.
- [ ] Browser permission denial/revocation produces understandable behaviour.

## 15. Native/mobile distribution checklist

When NinFit moves to Capacitor/native packaging:

- [ ] Android package/application ID locked before wider distribution.
- [ ] iOS bundle identifier locked before wider distribution.
- [ ] Native permission strings reviewed.
- [ ] Background GPS is implemented only with explicit product need and platform-compliant behaviour.
- [ ] Health Connect/HealthKit capabilities are minimal and justified.
- [ ] Native secure-storage needs are assessed for tokens/secrets.
- [ ] GitHub Actions/native build pipeline does not expose signing secrets in logs.
- [ ] Debug builds cannot accidentally point at production destructive endpoints without review.

## 16. Launch evidence pack

Before calling NinFit "launch ready", collect evidence rather than relying on memory:

- current architecture/data-flow diagram;
- current third-party register;
- production environment/configuration inventory;
- permissions inventory;
- privacy notice version;
- deletion/export test evidence;
- auth/security verification evidence;
- GPS privacy test evidence;
- wearable deduplication test evidence;
- app-store disclosure snapshot;
- production backup/restore evidence where applicable;
- known risks explicitly accepted/deferred.

## 17. Trigger points

Re-open this checklist whenever a slice introduces any of:

- precise location;
- background recording;
- a new wearable/provider;
- cloud persistence;
- a new account/auth path;
- social sharing;
- messaging/groups;
- payments/subscriptions;
- marketing/analytics SDKs;
- file/photo uploads;
- AI processing of user health/location content;
- a new third-party processor;
- public app-store distribution.

## 18. Current status

This document is deliberately a **readiness register**, not a claim that every item is due now.

At the time of writing:

- NinFit remains under active development.
- The Living Journey architecture is documented, but its permanent GPS/wearable implementation is still being built in bounded slices.
- The local GPS recorder spike must not be mistaken for production background-location support.
- Future PWA/native distribution work should use this checklist as a gate, not as permission to implement unrelated product changes.

The rule is simple:

> Build the smallest useful product now, but never let convenience make sensitive data handling accidental.
