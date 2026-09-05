# NinFit privacy notice — launch publication gate

**Status:** publication-readiness record, refreshed 5 September 2026. The existing `privacy-notice-skeleton-v1.md` remains the drafting source. This document records what can be stated from current repository/provider truth and what must still be resolved before a public notice is published.

This is not legal advice and does not claim UK GDPR compliance. It is deliberately fail-closed: unresolved facts stay visible rather than being replaced with guessed wording.

## 1. Current launch data-flow truth

### Local fitness and wellbeing data

The current product stores fitness/profile/game/Journey data locally in the browser storage architecture. Relevant categories include user-entered profile/preferences, DailyLogs, measurements, Journey history and accepted GPS route points.

NinFit must continue to distinguish local fitness data from external service data. A web host receiving an HTTP request is not the same thing as NinFit uploading the user's local fitness history.

### Account data

NinFit ID is optional. Supabase-backed account capability exists, but local fitness data remains authoritative and account identity must not be described as automatic cloud backup of local fitness history.

Before publication, the notice must name the actual account data sent to Supabase, its production region/retention/deletion behaviour and the operator's role relative to Supabase.

### GPS / Journey data

Journey can process precise latitude/longitude, timestamps and accuracy to record a route. The notice must state clearly that precise route points are sensitive location information, when collection starts/stops, and that route authority remains with the local Journey record unless a later reviewed sync feature explicitly changes that.

### Maps

Merged PR #228 records the current **private-beta-only** map-provider decision in `docs/pilot/private-beta-map-provider-decision-2026-09-05.md`.

For the planned small invitation-only private beta, NinFit may use the OpenStreetMap Foundation standard raster tile service for human-triggered viewed-area imagery under the documented attribution, caching, no-bulk/no-offline-map and reliability constraints. The renderer keeps the raw Journey route as a local GeoJSON source; it does not send the route payload to OSMF merely to draw the route line.

A tile request can nevertheless expose the viewed geography plus ordinary network/request metadata such as IP information to the tile service. The privacy notice must say so. Public-beta/production map-provider approval remains pending and requires re-review.

### Diagnostics / analytics

At canonical `main` (`fee710423960a800567cd626fb35ba299bc2d4e4`) the M4 runtime change is **not merged**. Current candidate PR #218 proposes optional, default-off PostHog Cloud EU diagnostics using a closed six-event vocabulary plus scrubbed crash diagnostics.

Merged PR #229 / `docs/pilot/posthog-private-beta-provider-review-2026-09-05.md` concludes that PostHog Cloud EU is **technically suitable with conditions** for that narrow private-beta role, but collection is not yet approved or proven.

Therefore:

- do not publish PostHog as a current shipped recipient until #218 is merged, configured and its declared gates pass;
- if #218 becomes the beta configuration, update the public notice and `THIRD_PARTY_SERVICE_REGISTER.md` from its exact merged implementation;
- state that diagnostics are off by default and can be controlled in Settings;
- keep fitness history, health/body measurements, precise routes, GPS points, notes, free text and account identity excluded from the event payload contract;
- confirm the intended EU project, provider/controller-processor terms, retention/deletion policy and any transfer implications before enabling collection;
- do not mark G12/G13 passed until the exact deployed candidate produces the required deliberate scrubbed crash receipt and all six real event receipts.

The currently connected PostHog project contains unrelated traffic and, on the 2026-09-05 schema recheck, still contained none of NinFit's six event names and no recent `$exception` receipt. Connection alone is not launch evidence.

## 2. Information the public notice must contain

Current ICO guidance on the right to be informed requires clear information, where applicable, including organisation/contact identity, purposes, lawful basis, recipients, international transfers, retention, individual rights, consent withdrawal, complaint route and automated decision-making.

The Data (Use and Access) Act 2025 is now fully in force. ICO lawful-basis guidance has been updated in stages during 2026, while detailed special-category guidance is still flagged by the ICO as under review. Re-check the live guidance at publication time.

If NinFit processes special-category health data, the ordinary lawful-basis requirement and the additional special-category condition are separate layers: an applicable Article 6 basis and an applicable Article 9 condition are both required. Do not select either by inference from product code.

The launch notice must therefore contain an evidenced table mapping each actual processing purpose to:

| Processing purpose | Data category | Where processed | Recipient | Article 6 basis | Article 9 condition if needed | Retention | User control |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Local fitness journal | TBD from final inventory | Device | None for local record | **Human/legal decision required** | **Human/legal decision required for health data** | Local until user deletes/resets, subject to verified product behaviour | Existing data controls |
| Journey GPS recording | Precise location + Journey facts | Primarily device | Map/network provider only as verified | **Human/legal decision required** | N/A unless combined processing makes health special-category analysis applicable | Verify against local deletion/backup behaviour | Location permission + Journey/data controls |
| Optional NinFit ID | Account/auth data | Supabase + device | Supabase | **Human/legal decision required** | Usually N/A unless account flow later carries health data | Verify provider/account lifecycle | Account controls |
| Optional beta diagnostics | Closed usage events + scrubbed crash diagnostics | PostHog Cloud EU if #218 lands and is configured | PostHog | **Human/legal decision required** | Must not contain health data under the #218 contract | **Human/legal retention decision still required** | Default-off Settings toggle |

Do not fill the lawful-basis columns by inference. That decision must be made by the launch operator with appropriate legal review.

## 3. Human facts required before publication

The following cannot be derived safely from source code and are **publication blockers**:

1. Legal/operator identity of NinFit.
2. Monitored privacy contact email and, where required, postal/company details.
3. Confirmed launch jurisdiction(s) and intended user age boundary.
4. Article 6 lawful basis for each processing purpose.
5. Article 9 condition for any special-category health data processing.
6. Whether a DPO or UK/EU representative is required.
7. Final processor roles, DPAs/terms, data locations and transfer safeguards.
8. Final retention periods/criteria for provider-side data and logs, including the diagnostics retention decision if #218 lands.
9. Confirmed complaint/contact wording appropriate to launch jurisdiction.
10. Confirmation that every privacy control described in the notice exists in the exact shipped UI.

## 4. Product facts that must be re-verified immediately before publication

- Exact `main` SHA and deployed build.
- Whether PR #219 offline cold-start has passed its Android/iPhone H-F/H-J evidence and merged.
- Whether PR #218 diagnostics has passed provider receipt + human visual gates and merged.
- Whether PR #215 two-path launch onboarding has passed human visual/flow review and merged.
- Whether #214 support configuration is present in the exact beta deployment.
- Supabase production configuration and account deletion/recovery behaviour.
- Map/tile provider decision appropriate to the actual release stage; #228 is private-beta-only, not public-beta approval.
- Current local data inventory, export/backup/restore/delete behaviour.
- GPS permission/start/stop behaviour on real iPhone and Android.
- No wearable integration described as live before it actually ships.

## 5. Plain-language launch summary — draft only

Once the blockers above are filled with evidence, the public notice should lead with a short explanation substantially like this:

> NinFit is designed to keep your fitness history local to your device unless you choose a feature that needs an external service. Journey can use your phone's location while you record an activity. Viewing Journey maps can request map imagery for the area you are viewing from a map provider, but NinFit does not upload your raw Journey route merely to draw the route line. An optional NinFit ID uses an account provider, but it is not automatic cloud backup of your local fitness history. Optional basic diagnostics, if enabled in Settings, are kept separate from your fitness history and do not include your health measurements, notes or precise route points.

This paragraph is **not publishable yet** because external-service configuration and operator/legal fields remain unresolved.

## 6. Current regulatory/provider guidance reviewed

Primary guidance rechecked on 5 September 2026:

- ICO, *What is the right to be informed and why is it important?*: `https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-is-the-right-to-be-informed-and-why-is-it-important/`
- ICO, *Special category data*: `https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/`
- ICO, *What are the rules on special category data?*: `https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-are-the-rules-on-special-category-data/`
- ICO, *The Data Use and Access Act 2025 — what does it mean for organisations?*: `https://ico.org.uk/about-the-ico/what-we-do/legislation-we-cover/data-use-and-access-act-2025/the-data-use-and-access-act-2025-what-does-it-mean-for-organisations/`
- PostHog privacy/GDPR/data-storage documentation, recorded in `docs/pilot/posthog-private-beta-provider-review-2026-09-05.md`.
- OSMF Tile Usage Policy, recorded in `docs/pilot/private-beta-map-provider-decision-2026-09-05.md`.

The ICO states that all data-protection provisions of the Data (Use and Access) Act 2025 are now in force. Some detailed special-category guidance is still under review, so re-check the live ICO material at the actual publication date rather than treating this 5 September 2026 record as permanent.

## 7. M6 acceptance

M6 may be described as **prepared** when:

- `MEDICAL_DEVICE_BOUNDARY.md` is reviewed against the actual product/marketing;
- this privacy publication gate is reconciled with current release truth;
- the final public notice is filled with the human/legal facts above;
- the third-party register is current;
- the public notice is actually hosted at a stable user-accessible location.

M6 may be described as **complete** only after that public notice is published and its URL is reachable from the shipped product/store listing as required. Repository documentation alone is not publication.
