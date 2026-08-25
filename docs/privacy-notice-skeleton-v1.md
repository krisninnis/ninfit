# NinFit Privacy Notice Skeleton v1

**Status:** Draft structure only. This is not legal advice, not a final privacy notice, and must not be published as a claim of compliance without being reconciled against the product's real data flows, jurisdictions, processors and launch configuration.

## Purpose

This document gives NinFit a durable privacy-notice structure to fill in as the product moves from a local-first PWA toward GPS recording, wearable sync, accounts, cloud features and eventual native distribution.

It must stay aligned with:

- `docs/privacy-security-readiness-v1.md`
- the Living Journey / wearable architecture
- the third-party service register when merged
- the actual implementation in production

The final public notice must describe what the product actually does, not what the roadmap hopes it will do.

---

# Public-facing notice structure

## 1. Who we are

**Draft placeholder**

NinFit is a personal fitness and wellbeing product designed to help people record activity, understand progress and build a longer-term fitness journey.

Before publication, fill in:

- legal/operator name;
- trading name if different;
- country of establishment;
- contact email/address appropriate for privacy requests;
- company/registration details if applicable;
- data-controller identity and any representative details if required.

Do not publish a vague contact route that nobody monitors.

## 2. The short version

A future plain-language summary should explain, in a few sentences:

- NinFit is private by default;
- some information may stay only on the user's device;
- cloud sync, wearable imports and social features may involve third parties when enabled;
- precise GPS routes and health/wearable data receive stronger treatment than ordinary app preferences;
- users should be able to understand, export and delete their data according to the implemented product controls.

Do not say "your data never leaves your device" once any feature, hosting/logging, sync, analytics or provider integration makes that untrue.

## 3. Information you provide directly

Potential categories, to retain only if actually implemented:

### Account information

Examples:

- email address;
- account identifier;
- display name;
- authentication/account-recovery information handled through the chosen account provider.

State whether an account is optional or required.

### Profile and preferences

Examples:

- unit preferences;
- activity preferences;
- goals;
- profile settings;
- optional display/profile information.

### Fitness and wellbeing information

Potential examples:

- weight;
- waist measurement;
- resting heart rate;
- heart-rate variability;
- steps;
- sleep entries;
- water/check-in entries;
- activity completion;
- health notes entered by the user.

The final notice must distinguish data a user types manually from measurements imported from a device/provider.

### User-generated content

If introduced later, examples might include:

- photos;
- notes;
- group content;
- messages;
- profile content.

Do not include this section in a final notice until the relevant features exist.

## 4. Information collected while using NinFit

### Journey and workout information

Potential examples:

- activity type;
- start/end time;
- duration;
- moving/paused time;
- distance;
- pace/speed;
- elevation where available;
- workout source/device;
- derived fitness facts and PB/achievement outcomes.

### Precise location and route data

If GPS Journey recording is enabled, NinFit may process:

- latitude/longitude;
- timestamp;
- GPS accuracy;
- route points;
- derived distance;
- optional altitude/speed/heading where supplied and used.

The final notice should clearly state:

- when location is collected;
- whether foreground or background permission is used;
- whether raw/accepted route points are stored;
- whether precise routes remain local or can sync;
- how long they are retained;
- whether route-only deletion exists;
- how privacy zones/masking work if implemented;
- what happens when permission is denied or revoked.

Precise route data should not be buried inside a generic "usage data" paragraph.

### Wearable and health-platform information

If integrations are enabled, identify the actual sources in use, for example:

- Fitbit;
- Android Health Connect;
- Apple HealthKit / Apple Watch;
- future supported devices/providers.

Potential observations include:

- workout records;
- heart rate;
- steps;
- distance;
- duration;
- source/device metadata;
- other specifically authorised fitness data types.

The final notice must explain that health platforms can transport records originating from another device/provider and that NinFit preserves source/provenance where practical.

### Technical and diagnostic information

Only describe what is actually collected, such as:

- app/browser version;
- device/platform information;
- crash/error information;
- deployment/runtime diagnostics;
- security logs;
- IP/network information incidentally processed by hosting or service providers.

Do not imply diagnostics are anonymous unless that has been established.

## 5. Where information comes from

Potential sources:

- directly from the user;
- the user's phone sensors;
- Fitbit;
- Health Connect;
- HealthKit / Apple Watch;
- another user-authorised fitness source;
- NinFit's own calculations/derived data;
- hosting/security/diagnostic services where applicable.

The final notice should distinguish:

**Observed data** — measured or reported by a source.

**Transported data** — carried through a platform such as Health Connect/HealthKit.

**Derived data** — calculated by NinFit from underlying observations.

## 6. Why we use information

Map each purpose to real implemented data categories before publication.

Potential purposes include:

- provide daily fitness tracking;
- record and display Journeys;
- calculate distance, duration, pace and progress;
- import authorised wearable records;
- reconcile duplicate workout records;
- calculate PBs, achievements and fitness milestones;
- maintain mascot/game progression based on verified fitness facts;
- sync or back up data when the user enables cloud features;
- provide account/security functionality;
- diagnose faults and protect the service;
- respond to support/privacy requests;
- deliver notifications the user has enabled;
- measure product performance using a deliberately limited analytics event set if introduced.

Avoid open-ended wording such as "for any business purpose".

## 7. Legal bases / lawful grounds

**Must be completed before launch with appropriate legal review for target jurisdictions.**

Create a table in the final notice linking each processing purpose to the applicable lawful basis/ground.

Potential concepts requiring review may include:

- performance of a user-requested service;
- consent for optional permissions/features;
- explicit consent or other applicable condition for special-category health data where required;
- legitimate interests for tightly bounded security/operational processing where appropriate;
- legal obligations where genuinely applicable.

Do not copy these labels into production without confirming which apply to each actual data flow.

## 8. Health and sensitive data

The final notice should give health/wellbeing data dedicated treatment rather than hiding it in a generic data list.

Explain:

- what health-related information NinFit processes;
- whether it is manually entered, measured or imported;
- why it is needed;
- which optional permissions control access;
- whether cloud storage is enabled;
- whether it is ever used for advertising or audience targeting.

Current product direction: raw health metrics and precise route data must not be fed into advertising/marketing payloads by default.

## 9. GPS privacy and location sharing

Before any social route sharing exists, this section should explain implemented choices such as:

- Private;
- Summary only;
- Masked route;
- Full route (explicit opt-in).

Also explain privacy-zone behaviour if implemented.

The product should not claim a route is masked unless every representation exposed to others is genuinely privacy-safe.

## 10. Wearable source reconciliation

A final notice does not need implementation-level algorithm detail, but it should be transparent that NinFit may:

- receive the same real-world activity through more than one source;
- compare source/time/activity evidence to identify likely duplicates;
- preserve underlying observations;
- choose a preferred/derived value for display where appropriate;
- avoid issuing duplicate rewards/PBs for the same Journey.

Do not state that different records are automatically merged in all cases if uncertain matches require user review.

## 11. Local storage and cloud sync

The final notice must accurately separate:

### Data stored on this device

List categories actually stored locally.

### Data synced to the cloud

List categories actually synced when enabled.

### Precise-route sync

If precise routes have a separate sync control, explain it independently from ordinary fitness-summary sync.

Do not describe the current product as fully local-only once account/cloud functionality is introduced.

## 12. Who we share information with

Derive this section from the actual third-party service register at launch time.

Possible categories may include:

- hosting/deployment provider;
- authentication/database provider;
- map/tile provider;
- wearable/health platform providers;
- crash/error monitoring provider;
- product analytics provider;
- email/push provider;
- payment provider;
- professional/legal/security providers when required.

For each relevant provider/category explain enough for a user to understand:

- what it does;
- what categories of data it receives;
- why that sharing is required;
- whether precise location or health data is involved.

Do not list planned providers as if they are already receiving user data.

## 13. Maps and OpenStreetMap-related services

If NinFit uses OpenStreetMap data or a third-party tile provider, explain the actual production arrangement.

The base map being visible does not necessarily mean the user's complete Journey route is sent to the map provider. The final notice should accurately describe what requests are made and what the provider can receive.

Keep required map attribution separate from the privacy explanation.

## 14. Analytics and marketing

If analytics or marketing tools are introduced, state:

- provider(s);
- event categories;
- identifiers used;
- consent/choice mechanisms where required;
- retention;
- whether advertising profiling is used.

NinFit's current boundary should be retained unless deliberately changed and reviewed:

- no raw heart-rate/health streams in advertising payloads by default;
- no precise Journey routes in marketing events by default;
- no secret expansion from basic product analytics into broad behavioural tracking.

## 15. Automated decisions and AI

If future AI coaching or automated recommendations process personal data, disclose the implemented use accurately.

Potential questions to answer:

- what data is sent to an AI service, if any;
- whether raw health/location history leaves NinFit;
- what output is generated;
- whether a user can choose not to use the feature;
- whether outputs are advisory/fitness guidance rather than clinical diagnosis;
- whether any decision has a significant effect on the user.

Do not include generic "we may use AI" language without a defined feature/data flow.

## 16. Retention

Before publication, create a retention table for actual categories.

Example structure:

| Category | Where stored | Default retention | User deletion option | Backup/log handling |
| --- | --- | --- | --- | --- |
| Account | TBD | TBD | Delete account | TBD |
| Fitness summaries | TBD | TBD | Delete Journey/data | TBD |
| Precise routes | TBD | TBD | Route-only delete + Journey delete | TBD |
| Wearable observations | TBD | TBD | TBD | TBD |
| Diagnostics | TBD | TBD | Not necessarily user-facing | TBD |
| Marketing/analytics events | TBD | TBD | TBD | TBD |

Never promise "deleted immediately/permanently" unless processor, backup and log behaviour supports that wording.

## 17. Your controls and choices

Depending on the final product/jurisdiction, explain implemented controls for:

- editing profile information;
- exporting data;
- deleting a Journey;
- deleting a precise route only;
- deleting an account;
- disconnecting a wearable provider;
- revoking location permission;
- controlling precise-route cloud sync;
- changing route/social visibility;
- changing marketing/analytics preferences where applicable;
- notification settings.

Keep product controls separate from statutory privacy rights.

## 18. Privacy rights

**Jurisdiction-specific legal drafting required before publication.**

The final notice may need to explain rights such as access, correction, deletion, restriction, objection, portability, withdrawal of consent and complaint routes, depending on where NinFit operates and the user's location.

Do not promise rights/processes the operation cannot actually fulfil.

Add:

- how to submit a request;
- identity-verification approach proportionate to the request;
- expected response route/timing appropriate to applicable law;
- regulator/complaint information where required.

## 19. International data transfers

Before launch, identify where each production provider stores/processes data.

If data can leave the user's country/region, explain the actual transfer arrangement and safeguards required by applicable law.

Do not assume a provider's headquarters determines every processing location.

## 20. Security

Use plain wording describing reasonable organisational/technical measures actually implemented.

Potential subjects:

- encrypted transport;
- access controls;
- credential/secret management;
- separation of development/production configuration;
- limited logging of sensitive payloads;
- backups/recovery where applicable.

Never promise "100% secure", "unhackable" or equivalent.

## 21. Children / age boundary

This must be an explicit product/legal decision before public release, especially before social functionality.

The final notice should state:

- intended minimum age;
- whether minors are knowingly accepted;
- any parental/guardian consent requirements if applicable;
- whether social/location features have different restrictions.

Do not infer an age policy from app-store ratings alone.

## 22. Social/community features

Only include once implemented.

Explain:

- public/profile visibility;
- route visibility;
- group/leaderboard exposure;
- user-generated content;
- blocking/reporting;
- deletion visibility/retention;
- moderation where relevant.

Private must remain the default for precise location unless a later deliberate decision changes that boundary.

## 23. Notifications

If push/email notifications are introduced, explain:

- what categories can be sent;
- provider used;
- how to turn them off;
- whether notification text may appear on a lock screen.

Sensitive health/location detail should not be exposed unnecessarily in lock-screen notification copy.

## 24. App installation and platform permissions

For PWA/native releases, explain relevant platform permissions separately from the privacy notice where the OS provides its own permission prompts.

Potential permissions:

- location;
- background location (future, if justified);
- health/wearable access;
- notifications;
- camera/photos if later introduced.

A platform permission prompt does not replace the need for an understandable privacy notice.

## 25. Changes to this notice

The final policy should state:

- effective date;
- last updated date;
- how material changes are communicated;
- where historical versions can be found if NinFit chooses to retain them.

Do not silently broaden sensitive-data use under an unchanged notice.

## 26. Contact

Before publication provide a monitored privacy contact route.

Placeholder:

**Privacy contact:** [TO BE DECIDED]

Include postal/company details where applicable.

---

# Pre-publication evidence checklist

The privacy notice is not ready to publish until all relevant boxes can be evidenced.

## Product truth

- [ ] Every described feature exists or is clearly labelled as not yet applicable.
- [ ] Current production data inventory completed.
- [ ] Local vs cloud storage verified from implementation.
- [ ] GPS collection/storage behaviour verified on real devices.
- [ ] Background-location behaviour verified if ever introduced.
- [ ] Wearable permissions/data types verified provider by provider.
- [ ] Duplicate/reconciliation behaviour accurately described.
- [ ] Route-only deletion behaviour verified if claimed.
- [ ] Account deletion lifecycle verified if claimed.

## Third parties

- [ ] Production provider register complete.
- [ ] Providers listed in notice match actual production network/data flows.
- [ ] Precise-location sharing checked.
- [ ] Health-data sharing checked.
- [ ] Analytics/marketing payload allowlist checked.
- [ ] Retention/deletion with processors understood.
- [ ] International processing/transfer locations understood to the required level.

## Legal/policy review

- [ ] Controller/operator identity confirmed.
- [ ] Target launch jurisdictions confirmed.
- [ ] Lawful grounds mapped per purpose.
- [ ] Special-category/health-data condition reviewed where required.
- [ ] Consent/permission wording reviewed.
- [ ] Rights/complaint wording matches applicable law.
- [ ] Children/minimum-age decision made.
- [ ] App Store / Play / Health Connect / HealthKit / Fitbit disclosure requirements checked at launch time.

## UX truth

- [ ] Privacy choices described in policy actually exist in UI.
- [ ] Permission prompts explain immediate purpose.
- [ ] Disconnect/revoke paths are discoverable.
- [ ] Deletion/export paths are discoverable.
- [ ] Private-by-default behaviour verified.
- [ ] Shared/masked route does not leak precise location through another representation.

# Change triggers

Re-open this skeleton whenever NinFit adds or changes:

- account/cloud sync;
- precise GPS persistence;
- background location;
- Fitbit;
- Health Connect;
- HealthKit / Apple Watch;
- analytics;
- advertising/marketing SDKs;
- AI coaching using personal data;
- social/community features;
- payments/subscriptions;
- photos/uploads;
- notifications;
- a new production provider;
- a new launch jurisdiction;
- a new native/app-store release channel.

# Current disposition

This file is intentionally a **skeleton**, not a public legal document. Its value is to prevent NinFit reaching launch with privacy wording improvised at the last minute.

The final notice must be generated from verified production behaviour, the production third-party register and appropriate jurisdiction-specific review.
