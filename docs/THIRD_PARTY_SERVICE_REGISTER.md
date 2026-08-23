# NinFit Third-Party Service Register

Status: readiness register; not a statement of legal approval or production readiness.

## Purpose

This register gives NinFit one place to record external services, SDKs, APIs and infrastructure before they receive production data. It complements the privacy/security readiness checklist and should be updated whenever a third party is proposed, added, materially reconfigured or removed.

## Rules

1. No third party is production-approved merely because it appears here.
2. Record the minimum data needed for the feature; avoid sending data that is not required.
3. Precise location, health/wearable data, account identifiers and user-generated content require explicit review before production use.
4. Secrets and credentials must never be committed to the repository.
5. Development, preview and production credentials/configuration should be separated where the provider supports it.
6. A service should have an owner, purpose, data-flow description, deletion/retention understanding and exit plan before production launch.
7. Prefer derived facts over raw sensitive data when a feature does not require the raw data.
8. Marketing/analytics services must not receive precise GPS routes or health/wearable measurements by default.

## Status vocabulary

- **In use** — currently used by the project.
- **Planned** — intended direction but not yet integrated.
- **Candidate** — being evaluated; not selected.
- **Parked** — deliberately deferred.
- **Removed** — no longer used; retain the row long enough to document migration/deletion work.

Production approval is tracked separately from implementation status: **No / Pending review / Approved**.

## Current and planned services

| Service / ecosystem | Purpose | Status | Potential data involved | Sensitive-data notes | Production approval | Evidence / action before approval |
| --- | --- | --- | --- | --- | --- | --- |
| Vercel | Web hosting, previews and production deployment | In use | Web requests, deployment metadata, operational logs | Do not intentionally place health/location payloads in URLs or logs | Pending review | Confirm production logging, retention, access, environment-variable handling and privacy documentation before launch |
| Supabase | Planned backend/cloud capabilities | Planned | Account/profile data; potentially synced fitness data depending on final architecture | Precise routes and health data need separate explicit design/consent decisions | No | Define exact tables/data flows, region, auth model, access controls, backups, deletion and retention before production data |
| OpenStreetMap ecosystem | Base-map data attribution/source | In use in GPS prototype direction | Map tile requests may reveal approximate viewed geography/IP to the selected tile provider | Raw Journey route must not be uploaded merely to draw a map | Pending review | Select a production-suitable tile provider or hosting strategy; verify attribution, usage policy, caching, privacy and capacity terms |
| Browser/device Geolocation API | Phone GPS acquisition for Journey recording | Prototype / planned production capability | Precise latitude/longitude, timestamps, accuracy and route history | Highly sensitive; private by default; route deletion and permission handling required | No | Graduate prototype only through Living Journey architecture/privacy gates and real-device testing |
| Fitbit | Wearable/workout/health integration | Planned | Workout records, activity metrics, heart rate/steps and source metadata depending on granted scopes | Request minimum scopes; preserve provenance; prevent duplicate rewards | No | Verify current Fitbit developer/API terms, OAuth/scopes, retention/deletion requirements and permitted use before integration |
| Android Health Connect | Android health-data interoperability | Planned | Fitness/health records exposed under user-granted permissions | Treat transport/source lineage separately from original measuring device | No | Verify current Android permissions, data types, Play policy/declarations and deletion/revocation behaviour before implementation |
| Apple HealthKit / Apple Watch | iOS/watch fitness and health interoperability | Planned | Workout/health measurements under user-granted permissions | HealthKit restrictions and purpose strings must be reviewed before native release | No | Verify current Apple HealthKit/App Store rules, entitlements, permissions, disclosure and allowed data uses before implementation |
| GitHub | Source control, issues, pull requests and CI integration | In use | Source code, repository metadata, development discussions | No production user health/location data should be committed | Pending review | Keep secret scanning/repository permissions/dependency practices under review |
| Analytics provider | Product analytics | Candidate / not selected | Potential events, device/session identifiers | Must default to data minimisation; no precise route or health measurements without a separately justified design | No | Choose only after analytics requirements and consent/legal basis are defined |
| Error/crash monitoring | Runtime diagnostics | Candidate / not selected | Stack traces, device/app metadata; accidental payload capture risk | Scrub health/location/user content from breadcrumbs and payloads | No | Evaluate redaction, sampling, retention, access and data residency before adding SDK |
| Marketing/advertising platforms | Campaign measurement and acquisition | Planned strategy; providers not selected | Campaign/referral events and potentially identifiers | Keep advertising boundary separate from health and precise-location data | No | Provider-by-provider review; define event allowlist and prohibited fields before any SDK/pixel |
| Push notification provider | Journey reminders / product notifications if adopted | Candidate / not selected | Push token, notification content, device metadata | Notification text can expose sensitive fitness context on lock screens | No | Design privacy-safe notification content and token deletion/revocation before selection |

## Per-service production review template

Copy this section for any service approaching implementation or production use.

### Service

- Provider:
- Product/API/SDK:
- Feature owner:
- Implementation status:
- Production approval: No / Pending review / Approved
- Approval/review date:
- Reviewer/evidence links:

### Purpose and necessity

- User-facing purpose:
- Why a third party is required:
- Lower-data/self-hosted alternative considered:
- Consequence if the service is unavailable:

### Data flow

- Data sent to provider:
- Data received from provider:
- Precise location involved: Yes / No
- Health/wearable data involved: Yes / No
- Account/contact data involved: Yes / No
- User-generated content involved: Yes / No
- Device/advertising identifiers involved: Yes / No
- Derived facts sufficient instead of raw data: Yes / No / N/A

### Permissions and consent

- User permission/scopes requested:
- Why each permission is necessary:
- Default behaviour before consent:
- Revocation behaviour:
- Re-consent trigger after scope change:

### Storage, retention and deletion

- Provider retention understood:
- NinFit retention understood:
- User deletion propagation:
- Account deletion propagation:
- Backups/logs covered:
- Provider-side deletion mechanism documented:

### Security

- Authentication method:
- Secret/token storage:
- Token rotation/revocation:
- Least privilege confirmed:
- Dev/preview/prod separation:
- Webhook/signature verification if applicable:
- Sensitive-data logging/redaction checked:

### Legal/policy/contract checks

- Terms/API policy reviewed:
- Privacy/DPA/processor role reviewed where applicable:
- Data residency/transfer implications reviewed:
- Platform-specific policy reviewed:
- Attribution/licensing obligations recorded:
- Age/child-user implications reviewed if relevant:

### Exit plan

- Export/migration path:
- How integration can be disabled:
- How provider-held data is deleted:
- User impact if provider is removed:

## Data-boundary guardrails

### Precise Journey location

Allowed only where required for Journey recording, route display, user-authorised sync or a specifically reviewed feature. Do not place exact coordinates in analytics events, marketing pixels, public URLs, crash breadcrumbs or support logs by default.

### Health and wearable observations

Preserve source provenance. Health Connect and HealthKit can transport records originating elsewhere; they must not automatically be treated as the measuring device. Third-party observations must not silently overwrite originals.

### Rewards and achievements

External workout data must pass identity/deduplication/reconciliation before PB, achievement or reward evaluation. A duplicate import must not create duplicate rewards.

### Marketing boundary

Marketing automation may use privacy-safe product events such as landing-page conversion or campaign attribution once reviewed. It must not be given raw GPS routes, heart-rate streams, health notes or other sensitive fitness content simply because those values exist in NinFit.

### AI services

If an external AI provider is later proposed for coaching, support or content generation, add it to this register before production integration. Define exactly what user data leaves NinFit; prefer minimised/derived context; do not send health/location history by default.

## Map-provider checklist

Before the GPS prototype becomes a production recorder:

- [ ] Production map/tile source selected explicitly.
- [ ] Usage policy permits expected app traffic.
- [ ] Required attribution is visible and correct.
- [ ] Tile/request privacy implications documented.
- [ ] API keys, if any, are appropriately restricted.
- [ ] Offline/cache behaviour is permitted and understood.
- [ ] Rate limits and failure behaviour are understood.
- [ ] A provider outage cannot corrupt the underlying Journey record.
- [ ] Route data is not sent to the map provider unless the chosen feature actually requires it and has been reviewed.

## Wearable integration checklist

For Fitbit, Health Connect, HealthKit/Apple Watch or future devices:

- [ ] Current platform/API documentation rechecked at implementation time.
- [ ] Minimum data permissions/scopes requested.
- [ ] Source lineage preserved.
- [ ] Duplicate path documented (for example Fitbit -> Health Connect -> NinFit).
- [ ] Revocation and disconnect behaviour tested.
- [ ] Token/credential storage reviewed.
- [ ] Import does not reward before reconciliation.
- [ ] User can understand which source supplied a measurement.
- [ ] Deletion/export behaviour is defined.
- [ ] Provider-specific branding/attribution requirements are satisfied.

## Change triggers

Re-review a service when any of the following occurs:

- a new sensitive data category is sent;
- permissions/scopes expand;
- a new SDK replaces a server/API integration or vice versa;
- data starts leaving the device when it previously stayed local;
- cloud sync becomes enabled;
- social sharing is introduced;
- analytics/advertising begins;
- retention or deletion behaviour changes;
- provider terms/platform policy materially change;
- NinFit launches in a new jurisdiction or store channel;
- the provider suffers a relevant security incident;
- the integration becomes unnecessary.

## Launch evidence

Before calling a third party production-approved, retain enough evidence to answer:

1. What feature needs it?
2. What exact data does it receive?
3. What permission did the user grant?
4. Where is the data stored and for how long?
5. How can the user revoke access or delete data?
6. How do we prevent secrets or sensitive payloads leaking into logs?
7. What happens if the provider disappears?
8. Which current provider/platform terms and policies were reviewed?
9. Who approved the production use and when?

## Current disposition

This register is intentionally conservative. Existing development tooling and prototype dependencies are documented without being retroactively labelled production-approved. Planned Fitbit, Health Connect, HealthKit/Apple Watch, analytics, notifications and marketing integrations remain gated until their implementation slices perform current provider-specific review.
