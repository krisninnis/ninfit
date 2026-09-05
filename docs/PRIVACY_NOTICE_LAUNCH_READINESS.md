# NinFit privacy notice — launch publication gate

**Status:** publication-readiness record, 5 September 2026. The existing `privacy-notice-skeleton-v1.md` remains the drafting source. This document records what can be stated from repository truth now and what must be resolved before a public notice is published.

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

Map rendering and map-data requests are separate from the authoritative Journey record. Before publication, the production tile/source arrangement must be confirmed in `THIRD_PARTY_SERVICE_REGISTER.md`; do not imply that an entire raw route is uploaded merely because a map is displayed.

### Diagnostics / analytics

At canonical `main` (`f6dc0601a93fa258a06f86708372c97287b213f6`) the launch analytics change is **not merged**. PR #202 proposes an optional, default-off PostHog Cloud EU integration using a closed six-event vocabulary plus scrubbed crash diagnostics.

Therefore:

- do not publish PostHog as a current production recipient until #202 is merged and configured;
- if #202 becomes launch configuration, update the public notice and `THIRD_PARTY_SERVICE_REGISTER.md` from its exact merged implementation;
- state that opting out is available in Settings and that fitness history, measurements, precise routes, GPS points and notes are excluded from the event payloads;
- verify provider retention, processing location, controller/processor terms and deletion implications before production approval.

## 2. Information the public notice must contain

Current ICO guidance on the right to be informed requires, where applicable, clear information including the organisation/contact identity, purposes, lawful basis, recipients, international transfers, retention, individual rights, consent withdrawal, complaint route and automated decision-making. Health information may be special category data, which requires an Article 6 lawful basis **and** an applicable Article 9 condition.

The launch notice must therefore contain an evidenced table mapping each actual processing purpose to:

| Processing purpose | Data category | Where processed | Recipient | Article 6 basis | Article 9 condition if needed | Retention | User control |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Local fitness journal | TBD from final inventory | Device | None for local record | **Human/legal decision required** | **Human/legal decision required for health data** | Local until user deletes/resets, subject to verified product behaviour | Existing data controls |
| Journey GPS recording | Precise location + Journey facts | Primarily device | Map/network provider only as verified | **Human/legal decision required** | N/A unless combined processing makes health special-category analysis applicable | Verify against local deletion/backup behaviour | Location permission + Journey/data controls |
| Optional NinFit ID | Account/auth data | Supabase + device | Supabase | **Human/legal decision required** | Usually N/A unless account flow later carries health data | Verify provider/account lifecycle | Account controls |
| Optional beta diagnostics | Closed usage events + scrubbed crash diagnostics | PostHog EU if #202 lands | PostHog | **Human/legal decision required** | Must not contain health data under the #202 contract | Provider retention must be set/recorded | Default-off Settings toggle |

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
8. Final retention periods/criteria for provider-side data and logs.
9. Confirmed complaint/contact wording appropriate to launch jurisdiction.
10. Confirmation that all privacy controls described in the notice exist in the shipped UI.

## 4. Product facts that must be re-verified immediately before publication

- Exact `main` SHA and deployed build.
- Whether PR #201 offline cold-start has passed H-F and merged.
- Whether PR #202 diagnostics has passed provider receipt + human visual gates and merged.
- Whether PR #203 two-path launch onboarding has passed human visual/flow review and merged.
- Supabase production configuration and account deletion/recovery behaviour.
- Production map/tile provider and request behaviour.
- Current local data inventory, export/backup/restore/delete behaviour.
- GPS permission/start/stop behaviour on real iPhone and Android.
- No wearable integration described as live before it actually ships.

## 5. Plain-language launch summary — draft only

Once the blockers above are filled with evidence, the public notice should lead with a short explanation substantially like this:

> NinFit is designed to keep your fitness history local to your device unless you choose a feature that needs an external service. Journey can use your phone's location while you record an activity. An optional NinFit ID uses an account provider, but it is not automatic cloud backup of your local fitness history. Optional basic diagnostics, if enabled in Settings, are kept separate from your fitness history and do not include your health measurements, notes or precise route points.

This paragraph is **not publishable yet** because external-service configuration and operator/legal fields remain unresolved.

## 6. Current regulatory guidance reviewed

Primary guidance checked on 5 September 2026:

- ICO, *What privacy information should we provide?*: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/
- ICO, *What are the rules on special category data?*: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-are-the-rules-on-special-category-data/

The ICO currently notes that parts of its guidance are under review following the Data (Use and Access) Act. Re-check the live guidance at the actual publication date rather than treating this 5 September 2026 review as permanent.

## 7. M6 acceptance

M6 may be described as **prepared** when:

- `MEDICAL_DEVICE_BOUNDARY.md` is reviewed against the actual product/marketing;
- this privacy publication gate is reconciled with current production truth;
- the final public notice is filled with the human/legal facts above;
- the third-party register is current;
- the public notice is actually hosted at a stable user-accessible location.

M6 may be described as **complete** only after that public notice is published and its URL is reachable from the shipped product/store listing as required. Repository documentation alone is not publication.
