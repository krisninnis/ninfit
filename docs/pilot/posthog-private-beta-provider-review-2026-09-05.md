# PostHog private-beta provider review — 2026-09-05

Status: **technically suitable with conditions for the NinFit private beta; provider/legal/receipt gates remain open.**

This record does not approve telemetry by itself, does not establish a lawful basis, does not claim a DPA has been accepted, and does not satisfy G12/G13. It narrows the technical/provider questions so the remaining human and deployment work is explicit.

Reviewed against:

- exact repository `main` `661f9b64b3a23e40fb3d5098a1fa05e3f307a97d`;
- current M4 candidate PR #218 (`feat/privacy-safe-instrumentation-v2`);
- the connected PostHog project schema on 2026-09-05;
- PostHog privacy, GDPR and data-storage documentation rechecked 2026-09-05.

## Proposed private-beta role

PostHog Cloud EU may be used as NinFit's **optional product-usage diagnostics processor** for the narrow M4 event contract if every condition below is met.

NinFit must not treat PostHog as fitness truth, account storage, Journey storage, health-data storage or a session-replay service.

The M4 candidate is deliberately designed around six coarse usage events plus scrubbed crash diagnostics, with collection disabled by default and enabled only through an explicit Settings choice.

## Current M4 transport boundary

PR #218's telemetry candidate:

- sends directly to the PostHog EU capture endpoint;
- does not include the PostHog browser SDK;
- does not enable autocapture, automatic pageviews or session replay;
- sets person-profile processing off;
- creates a random device-only analytics identifier only after opt-in and removes it on opt-out;
- keeps analytics consent outside backup/restore;
- treats provider/network failure as non-authoritative and unable to block the user's product action;
- limits ordinary usage events to the approved six-event taxonomy;
- limits crash diagnostics to a scrubbed error class/stack contract rather than raw user content.

The project API key used by a browser/client capture integration is a public project identifier, not a server secret. It still belongs in deployment configuration rather than source so environments can be separated and rotated without code changes. Secure/private PostHog keys must never be shipped in the frontend.

## EU hosting

PostHog's current documentation recommends **PostHog Cloud EU** for robust GDPR-oriented EU data residency and states that the managed EU service is hosted on servers in Frankfurt, Germany.

The M4 candidate targets the EU ingestion host. Before enabling collection, the selected PostHog project must be confirmed to be an EU Cloud project; merely having a connected PostHog account is insufficient evidence.

## Data minimisation conditions

For private beta, keep the source contract at or narrower than the current M4 candidate:

1. No weight, waist, RHR, HRV, sleep, medical note, health note or other body/health measurement.
2. No GPS coordinate, Journey route point, map viewport, home/work location or precise location.
3. No free text.
4. No email address, NinFit ID, authentication identifier or contact detail.
5. No activity duration, distance, pace or other fitness-performance measurement in the product-usage event stream unless separately reviewed later.
6. No DOM autocapture, session replay, heatmap recording or automatic page/screen tracking.
7. `activity_recorded` remains coarse activity type plus `is_rest` only.
8. `app_opened_after_gap` remains a coarse gap bucket rather than exact historical timestamps.
9. Crash diagnostics remain scrubbed and must not include raw error messages when those messages could contain user input or URLs.

Any widening of this contract requires a fresh privacy/provider review before deployment.

## Consent and control

PostHog's current GDPR guidance states that the application owner remains responsible for deciding what is collected, communicating that use, and establishing the relevant legal basis. NinFit therefore retains its stronger launch contract:

- diagnostics are **off by default**;
- a user must make an explicit Settings choice before the random analytics ID or network collection exists;
- opt-out must stop future collection and remove the local analytics identifier;
- backup/restore must not silently opt a user back in;
- the public privacy notice must identify the diagnostics purpose and provider before strangers are invited.

This record is a technical/provider review, not legal advice or a conclusion on UK GDPR Article 6/Article 9 applicability.

## Storage, deletion and retention

PostHog documents EU storage location controls, processing/redaction before storage, access controls and data-deletion tools. Those capabilities are useful but do **not** choose NinFit's retention policy for it.

A fixed automatic event-retention period suitable for NinFit was not established from the reviewed provider documentation. Therefore the private-beta retention period remains a **human/legal product decision**, and the privacy notice must not invent one.

Before beta collection is enabled:

- decide and document the intended retention period for NinFit diagnostics;
- confirm how deletion requests will be mapped from NinFit's device-only identifier when a user can provide that identifier;
- restrict PostHog project access to people who genuinely need it;
- confirm any required DPA/subprocessor/transfer documentation through the provider account and legal/privacy review.

Because M4 uses a random device-only ID and deliberately avoids account identity, deletion workflows must not pretend the operator can locate a person's telemetry by name or email if NinFit never sent that mapping.

## Connected project evidence

The currently connected PostHog account exposes an EU project, but its event taxonomy already contains unrelated traffic such as `landing_page_view`, `pricing_viewed` and `onboarding_started`.

A schema recheck on 2026-09-05 still found **none** of NinFit's six intended events:

- `onboarding_completed`
- `hatch_completed`
- `first_activity_recorded`
- `activity_recorded`
- `journey_completed`
- `app_opened_after_gap`

The schema also reports `$exception` as not seen in the last 30 days.

Therefore the connected project is **not evidence that NinFit telemetry is configured or working**, and G12/G13 remain NOT PASSED.

Before using this existing project for NinFit, the owner should either confirm it is intentionally shared and that separation is acceptable, or choose a dedicated NinFit project. This connector does not currently expose project creation, so that choice cannot be completed automatically here.

## G12 / G13 receipt gate

After an exact beta candidate is successfully deployed with the intended EU project key:

1. Confirm diagnostics are off on a fresh/default state and no NinFit event is emitted.
2. Opt in through NinFit Settings.
3. Exercise each of the six genuine product paths.
4. Trigger the deliberate safe crash-test path required by the release gate; do not use real user data in the error.
5. Re-query PostHog and capture evidence that all six event names arrived with only their allowed properties.
6. Verify the deliberate crash receipt contains only the scrubbed diagnostic contract.
7. Opt out and verify subsequent product actions do not create new NinFit events.

Only then may G12/G13 be recorded as passed.

## Private-beta decision

**Provider technology: CONDITIONALLY SUITABLE.**

**Collection enabled for users: NOT YET APPROVED.**

Remaining blockers are concrete rather than architectural:

- confirm/select the intended EU project;
- configure its public project key in the exact beta deployment without committing it;
- decide diagnostics retention and complete provider/legal processor checks;
- publish the truthful privacy notice;
- perform Settings visual acceptance;
- obtain real G12/G13 receipts from the exact candidate.

No runtime PR should be merged merely because this provider review exists.

## Re-review triggers

Re-review before widening telemetry to include health/fitness measurements, location, free text, account identity, automatic capture, replay, advertising attribution, third-party destinations, additional processors, or a non-EU ingestion/storage region.

## Provider documentation reviewed

- PostHog Privacy compliance: `https://posthog.com/docs/privacy`
- PostHog GDPR compliance: `https://posthog.com/docs/privacy/gdpr-compliance`
- PostHog Controlling data storage: `https://posthog.com/docs/privacy/data-storage`
- PostHog feature-flag client/server key guidance confirming project API keys are public client identifiers while secure keys are not for frontends: `https://posthog.com/docs/feature-flags/local-evaluation`
