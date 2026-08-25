# NinFit Environment & Secrets Register v1

**Status:** Planning/readiness documentation only. This file must never contain real secret values.

## Purpose

Provide one durable place to record NinFit's environments, client-visible configuration, server secrets, user OAuth tokens, signing credentials, storage locations, rotation/revocation ownership, and release gates.

This complements the privacy/security, third-party service, release-readiness and data-retention work. It does not claim any planned provider is configured or approved for production.

## Current repository hygiene

The repository currently ignores `*.local` and `.vercel`, alongside build outputs/logs. That is consistent with keeping local environment files and Vercel project metadata outside source control.

## Environments

| Environment | Purpose | Real user data? | Credential rule |
| --- | --- | --- | --- |
| Local development | laptop development/tests | No by default | dev-only config in ignored local tooling/files |
| Automated test | deterministic tests | No | fake/test values only |
| Preview | PR/branch validation | No production data by default | preview-scoped credentials |
| Production | public NinFit service | Yes once approved | production-scoped secrets/config |
| Native dev | Android/iOS development | No by default | dev app config/signing |
| Native production | Play/App Store releases | Yes | protected release/signing credentials |

**Rule:** do not copy production secrets into Local or Preview simply for convenience.

## Classification vocabulary

### Public client config
Safe to ship in the browser/native bundle by provider design. Project URLs, publishable identifiers or non-secret OAuth client IDs may fall here.

**Important:** `VITE_*` values are client-visible in a Vite application. Never put a secret in a `VITE_*` variable.

### Server secret
Privileged service-role keys, private API keys, OAuth client secrets and webhook secrets. Never expose these to browser code, client bundles, logs or Git.

### User token
OAuth access/refresh tokens representing delegated user access. Treat as sensitive account data; use least privilege; define expiry and revocation; never log them.

### Signing/release secret
Android/iOS signing keys, certificates, private release credentials and similar integrity-sensitive material. Keep outside ordinary repo/environment files.

### Non-secret build config
Ordinary IDs, flags and capabilities that authenticate nothing. These may be versioned when appropriate.

## Planned register

No values are stored here. Status is **In use / Planned / Candidate / Not required / Retired**.

| System | Credential/config | Class | Environments | Status | Storage expectation | Gate |
| --- | --- | --- | --- | --- | --- | --- |
| Vercel | project/team metadata | non-secret | local/preview/prod | In use | `.vercel` locally, ignored; Vercel account remotely | keep `.vercel` out of Git |
| Vercel | environment variables | mixed | preview/prod | In use when required | Vercel environment settings | classify every variable before adding |
| Supabase | project URL | public client config | preview/prod if adopted | Planned | environment config | provider/project verified at implementation |
| Supabase | publishable/anon client key | public client config only if provider design confirms | preview/prod | Planned | environment config | RLS/ownership remains the security boundary |
| Supabase | service-role/privileged key | server secret | server only | Planned | server secret store | never expose to browser/Vite bundle |
| Fitbit | OAuth client ID | public identifier unless docs say otherwise | dev/preview/prod | Planned | env/native config | verify current Fitbit docs |
| Fitbit | OAuth client secret | server secret | backend only | Planned | server secret store | never ship in PWA/native client |
| Fitbit | access token | user token | per user | Planned | approved secure backend/token store | minimum scopes, expiry/revocation defined |
| Fitbit | refresh token | user token | per user | Planned | approved secure backend/token store | treat as long-lived sensitive credential |
| Health Connect | package identity/permissions | non-secret config | native dev/prod | Planned | native project config | permissions reviewed at implementation |
| Android signing | upload/release signing material | signing secret | native production | Planned | Play App Signing/secure release storage | never commit keystore/passwords |
| HealthKit | bundle ID/entitlements | non-secret config | native dev/prod | Planned | native/Apple config | capabilities are not secrets |
| Apple developer | certificates/private keys/API keys | signing secret | native production | Planned | Apple/CI secure storage | document expiry/revocation |
| Map provider | map token/key if selected | provider-dependent | preview/prod | Candidate | restricted env config | restrict origins/apps/scopes |
| OpenStreetMap tiles | direct public tile access | N/A/provider-dependent | prototype | In use in prototype direction | N/A | production tile strategy still requires review |
| Error monitoring | DSN/project identifier | usually public/provider-dependent | preview/prod | Candidate | environment config | redact GPS/health payloads |
| Error monitoring | admin/ingestion token | server secret | CI/server only | Candidate | secret store | no client exposure |
| Analytics | client/project identifier | public if adopted | preview/prod | Candidate | environment config | no precise GPS/raw health events by default |
| Marketing | campaign/pixel IDs | generally public | production | Candidate | environment config | explicit event allowlist |
| Marketing automation | API/admin token | server secret | backend/automation | Candidate | secret store | least privilege and spend/action controls |
| Push notifications | send credential | server secret | backend | Candidate | secret store | never bundle in client |
| AI provider | API key | server secret | backend only | Candidate | secret store | define permitted user data first |

## Naming rules

- Use `VITE_*` only for deliberately public client-visible values.
- Server secrets must not use `VITE_`.
- Include the provider/system in the variable name.
- Never include a secret value, token fragment or user data in the variable name.

Example categories only:

```text
VITE_<PROVIDER>_PUBLIC_URL
VITE_<PROVIDER>_PUBLIC_CLIENT_ID
<PROVIDER>_CLIENT_SECRET
<PROVIDER>_WEBHOOK_SECRET
<PROVIDER>_SERVICE_ROLE_KEY
```

## Local-development rules

- Keep real secrets in ignored local files or secure local tooling.
- Never commit `.env.local`.
- Prefer non-production provider credentials.
- Do not use production health/GPS data as development fixtures.
- Never paste a secret into source code "temporarily".
- If a secret is accidentally committed, rotate/revoke it; deleting the latest copy is not sufficient.

## Preview rules

Preview deployments are externally reachable and must be treated as potentially public.

- No production database/service-role credential by default.
- Preview callbacks/redirect URLs must be explicitly allowlisted.
- Preview must not silently write to production user data.
- Debug logs still must exclude secrets, precise routes and raw health payloads.
- Temporary branches do not justify admin/debug exposure.

## Production credential gate

Before introducing a production credential:

- [ ] Integration exists in the third-party service register.
- [ ] Purpose and minimum scope are documented.
- [ ] Storage location is known.
- [ ] Client-visible vs server-only classification is verified.
- [ ] Dev/Preview/Production separation is verified.
- [ ] Rotation/revocation method is known.
- [ ] Owner is identified by role.
- [ ] Logging/redaction has been checked.
- [ ] Provider outage behaviour is understood.
- [ ] User deletion/disconnection implications are understood where relevant.
- [ ] Rollback does not depend on an unknown old secret state.

## OAuth and wearable tokens

For Fitbit or future direct wearable APIs:

1. Request minimum scopes.
2. Keep client secrets server-side.
3. Associate access/refresh tokens with the correct NinFit user.
4. Never log tokens.
5. Treat disconnect as revoking future access where supported.
6. Provider disconnect is not automatically the same as deleting imported history.
7. Deleted imported records must not silently reappear without a defined re-import policy.
8. Expiry/re-auth should be a recoverable connection state, not data loss.

## GPS and map keys

A map key does not make precise route data safe.

- Restrict keys by origin/app/package where supported.
- Do not upload a whole Journey route merely to draw base-map tiles.
- Do not place coordinates in analytics URLs, logs or crash breadcrumbs.
- Add routing/geocoding providers separately because they may receive exact coordinates.

## Backend boundary

If Supabase remains the backend direction:

- public browser credentials are not authorisation controls;
- Row Level Security/server ownership rules protect user data;
- service-role credentials remain server-only;
- consider separate dev/preview/prod projects before real user data;
- privileged migration tooling must not require committing secrets;
- route, health and wearable data must not become exposed merely because a client SDK can query a table.

This is readiness guidance only; it does not claim the final backend schema/security model exists.

## Native signing

### Android

- Prefer Play App Signing for production.
- Keep upload keystore/private key/password outside Git.
- Separate debug from release signing.
- Record recovery/access ownership.

### Apple

- Keep certificates/private keys/App Store Connect API keys outside Git.
- Record Developer Team ownership.
- Track expiry where applicable.
- Bundle identifiers/entitlements may be versioned when non-secret; private key material may not.

## Exposure/rotation procedure

If a credential may be exposed:

1. Treat it as compromised until proven otherwise.
2. Revoke/rotate it at the provider.
3. Replace it in the correct environments.
4. Redeploy/restart affected services if required.
5. Verify the old credential no longer works.
6. Search repo history, CI/Vercel logs, PRs/issues and shared transcripts for exposure.
7. Redact discoverable copies where possible; redaction does not replace rotation.
8. Assess whether user data could have been accessed and follow the incident process if needed.
9. Record the incident without recording the credential value.

## Retiring a provider

- revoke app credentials;
- remove environment variables from all environments;
- disable webhooks/callbacks;
- remove unused OAuth redirects;
- remove obsolete SDK/config;
- verify provider-held data/token deletion obligations;
- update privacy/third-party/retention registers.

## Repository guardrails

- [ ] GitHub secret-scanning/settings reviewed.
- [ ] `.gitignore` continues to exclude local secret files.
- [ ] Examples/tests contain fake values only.
- [ ] Build output checked for accidental server-secret inclusion when providers are added.
- [ ] `VITE_*` variables explicitly treated as public.
- [ ] Copied provider tutorials reviewed before use; examples often place credentials in unsafe client locations.

## Change triggers

Update this register when a provider is selected, environment variable is introduced, OAuth scope changes, backend architecture changes, map/routing provider changes, native signing begins, CI gains release privileges, marketing automation gains new permissions, a credential is rotated after an incident, or an integration is retired.

## Release evidence

For any release adding a credential/integration, retain evidence of:

1. credential/config **name/category only**, never its value;
2. classification (public, server secret, user token, signing secret);
3. environments receiving it;
4. why it is needed;
5. who can rotate/revoke it;
6. whether it can appear in browser bundles/logs;
7. Preview vs Production separation;
8. provider callback/origin/scope restrictions;
9. safe behaviour when the credential is missing or revoked.

## Current disposition

NinFit already has basic repository hygiene for local `*.local` files and `.vercel` metadata to remain outside Git. This document does not assert that planned Fitbit, Health Connect, HealthKit, Supabase, analytics, marketing or AI credentials exist. Future implementation must update this register from actual evidence rather than guesswork.
