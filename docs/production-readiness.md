# Production Readiness — NinFit

This profile applies the reusable `production-readiness` review to the repository as it exists. It is an assessment, not authorization to implement findings.

## A. Project snapshot

| Attribute | Current evidence-based state |
|---|---|
| Architecture | Local-first React, TypeScript, and Vite client with pure domain modules, a repository/storage boundary, deterministic fitness/game derivation, and browser-based UI. |
| Deployment | Client production build exists. Exact hosting environments, release ownership, production diagnostics, and rollback evidence are not established by this profile. |
| Storage | Versioned NinFit state in browser `localStorage` through `src/storage/StorageAdapter.ts`, `src/storage/repository.ts`, and `src/storage/localStorageAdapter.ts`; JSON export/import and CSV export exist. |
| Authentication | Optional Supabase email/password authentication boundary is implemented in `src/data/supabase/auth.ts` and the NinFit ID UI. Fitness data remains local. |
| Backend/network | A Supabase project/auth boundary exists, but no production fitness schema, cloud sync, social backend, or application data integration is authorized. See `docs/architecture/ninfit-supabase-backend-v1.md`. |
| Data sensitivity | Personal fitness, goals, activity, body/health-adjacent measurements, and future location/native health data. Current fitness truth is local to the device unless the user exports it. |
| Users/traffic | Not evidenced. Do not assume public scale or backend load. |
| Current safety constraint | Preserve local-first authority, deterministic derivation, visible source provenance, explicit privacy defaults, and no privileged Supabase credential in the client. |
| Future plans | Android/iOS, Health Connect/HealthKit, cloud backup/sync, game progression, social/groups, location features, secure messaging, and AI are staged future milestones rather than current infrastructure. |

## B. Current maturity stage

**Mixed stage: Stage 0/1 local-first client plus a narrow Stage 3 authentication boundary.** Core fitness data has no remote service dependency. Authentication creates a real remote trust boundary, but it does not make the planned Supabase data architecture current.

## C. NOW

| Concern | Gate | Why | Evidence | Trigger to raise/revisit | Smallest next action | Implement now? |
|---|---|---|---|---|---|---|
| Local schema migration, recovery, and restore evidence | BLOCKER BEFORE PILOT | A browser reset, quota/write failure, corrupt payload, or incompatible schema change can lose personal fitness history and progression. | `src/domain/schema.ts`, storage tests, `src/io/exportJson.ts`, and `src/io/importJson.ts` provide versioning and backup/import controls; browser storage cannot make a multi-step replace genuinely transactional. | Before a pilot relies on real history and before every persisted schema change. | Exercise synthetic old-version migration, export/import restore, corrupt-state quarantine/recovery, interrupted/failed import, quota failure, and clear-data behavior; record the accepted result. | Yes: verify/document; no new store in this task. |
| Local privacy, deletion, and device-loss communication | BLOCKER BEFORE PILOT | Fitness and health-adjacent data is sensitive, and local-only storage changes both exposure and recovery expectations. | `src/ui/screens/DataScreen.tsx` exposes data controls and describes local-only truth; JSON/CSV exports exist. | Before real-user pilot data; revisit before native health or cloud sync. | Confirm the user-facing data inventory, retention/deletion/export behavior, backup warning, and device-loss/reset expectations through acceptance checks. | Yes. |
| Supabase authentication security and recovery acceptance | SHOULD COMPLETE BEFORE PUBLIC RELEASE | Accounts promote session lifecycle, recovery, enumeration/abuse, rate limits, configuration, and privacy concerns even without fitness sync. | `src/data/supabase/env.ts`, `client.ts`, `auth.ts`, `src/ui/components/NinFitIdAuth.tsx`, and `src/test/supabaseAuth.test.ts`; public client configuration is intended, privileged service credentials are forbidden in the browser. | Before making NinFit ID required, before public account promotion, and before any account-owned fitness data. | Verify sign-up confirmation, sign-in/out, session expiry/refresh, recovery/resend, error privacy, abuse limits, redirect/environment behavior, and account deletion ownership against the configured auth service. | Yes if accounts are in the release; otherwise keep optional. |
| Privacy/data-flow boundary between identity and local fitness | SHOULD COMPLETE BEFORE PUBLIC RELEASE | Users may infer that signing in backs up fitness data when authentication and local data are separate. | NinFit ID UI states local behavior; backend architecture separates auth/profile foundation from later cloud backup/sync. | Before public account marketing or any fitness upload. | Acceptance-test the UI explanation and publish a concise data-flow statement: what Supabase receives now, what remains on-device, and what deletion/sign-out does to each. | Yes. |
| Reproducible release and rollback procedure | SHOULD COMPLETE BEFORE PUBLIC RELEASE | A harmful client or auth-boundary release needs a known-good build and recovery path. | `package.json` defines test/typecheck/build scripts and a lockfile is present; exact hosting/rollback evidence is unknown. | Before public launch and after deployment/config changes. | Record environment ownership, required public variables without secret values, release identity, production smoke checks, and rollback/redeploy steps; rehearse once outside production. | Yes: operational evidence. |
| Privacy-safe error visibility and accessibility/device acceptance | SHOULD COMPLETE BEFORE PUBLIC RELEASE | Client/storage/auth failures must be diagnosable without collecting health data; mobile use requires accessible, responsive journeys. | Automated tests exist; production monitoring, supported-device acceptance, and an end-to-end accessibility record are not evidenced here. | Before unsupervised public use or native app work. | Define a sensitive-data-safe diagnostic policy and run the critical Today/Data/NinFit ID journeys across the supported browser/device and accessibility matrix. | Yes: policy and acceptance first. |

## D. NEXT

| Concern | Why / evidence | Trigger | Smallest next action | Implement now? |
|---|---|---|---|---|
| Health Connect/HealthKit permission and provenance design | Native health sources introduce regulated platform permissions, revocation, deduplication, units, corrections, and source conflicts. | Before the first native health integration. | Specify minimum scopes, explicit consent/revocation, provenance, stable source IDs, unit/time-zone rules, deduplication, conflict handling, deletion, and offline behavior; verify current platform policies then. | No. Design at trigger. |
| Cloud fitness schema and safe sync | Remote sensitive data promotes migrations, RLS, least privilege, backup/restore, deletion, conflict rules, outbox/idempotency, and observability. | Before backend milestone B2/B3 or any fitness upload. | Turn the architecture document into a separately approved threat/data-flow model and minimal schema; test RLS per user, migrations, restore, account deletion, offline replay, and conflict behavior before integration. | No cloud implementation now. |
| Social/community safety | Profiles, friends, crews, leaderboards, media, and location change privacy and abuse risk. | Before social milestone B5 or any shared content. | Require auth/authz, private defaults, audience rules, block/report/moderation, abuse/rate limits, deletion, auditability, and location redaction acceptance before exposure. | No. Trigger-gated. |
| Remote backend observability and operations | Once sync exists, failures need health, privacy-safe logs, metrics, alerts, restore ownership, and support escalation. | Before the first remote data pilot. | Define service owners, health signals, sync failure diagnostics, backup ownership, incident response, and a modest recovery objective. | No remote tooling now. |

## E. LATER

- Caching, CDN changes beyond normal static assets, database indexes/pooling, load testing, P95/P99, autoscaling, and cost monitoring: promote only with measured remote traffic and queries.
- Queues, pub/sub, dead-letter handling, circuit breakers, and distributed tracing: promote only when durable asynchronous work or multiple backend services exist.
- Multi-region deployment, replicas, sharding, distributed locks/transactions, Saga patterns, CAP/partition design, and chaos engineering: promote only after genuine distributed scale.
- AI access controls, memory governance, and cost controls: promote before an approved AI platform milestone and keep raw health/location access minimized.

## F. NOT APPLICABLE

- Current fitness database indexing, N+1 optimization, connection pooling, backup replication, and query tuning: no production fitness database exists.
- Payment security, reconciliation, fraud controls, and payment webhooks: no payment flow exists.
- Automatic email/message/action idempotency and delivery queues: no automatic external action exists.
- Kubernetes, Helm, service discovery, leader election, and service-mesh concerns: no containerized multi-service platform exists.

## G. Investigation required

- Confirm the intended pilot/public audience, supported devices/browsers, and expected traffic.
- Confirm the current deployment provider, environment separation, production-access owner, release identity, and rollback mechanism.
- Confirm whether local migration/restore/corruption drills and accessibility acceptance are recorded outside the repository.
- Confirm whether NinFit ID is enabled in the current deployed build and what provider-side recovery, abuse, email, and deletion settings are active.
- Confirm the approved privacy notice/data-flow wording for the distinction between Supabase identity data and local fitness data.

## H. Security/privacy blockers

A local-only pilot needs clear local-data privacy, deletion, export, and device-loss behavior. Any pilot that includes NinFit ID additionally needs the auth lifecycle and identity-versus-fitness data boundary accepted. Cloud fitness and social features remain blocked on separate RLS, data-flow, abuse, and deletion designs.

## I. Reliability blockers

Before pilot reliance on real history, exercise schema upgrade, backup/restore, corruption, interrupted import, quota, and recovery paths. Remote retry, circuit-breaker, and health concerns are not current fitness-runtime blockers.

## J. Data/storage blockers

Local recovery evidence is the current blocker. Before cloud sync, promote versioned database migrations, integrity/RLS, encrypted transport/storage responsibilities, backup/restore, account deletion, outbox/idempotency, deduplication, and explicit conflict resolution.

## K. Deployment/observability blockers

Public launch needs an identified release/rollback path, production configuration ownership, device/accessibility evidence, and privacy-safe client/auth diagnostics. Full backend telemetry is premature until a backend handles fitness data.

## L. Scaling assessment

There is no evidenced remote fitness workload or traffic requirement. Local correctness, recovery, privacy, and the narrow auth boundary dominate current risk. Static-host and Supabase managed-service capacity should be measured before adding scaling controls.

## M. Premature-complexity warning

Do not apply the planned backend schema, add cloud sync, queues, microservices, containers, Kubernetes, Terraform, replicas, sharding, multi-region deployment, or broad health-data telemetry merely to satisfy this review. The architecture document is a staged plan, not current implementation authority.

## N. Pilot readiness

**Conditionally not ready on repository evidence.** A local-only pilot can proceed after the two BLOCKER BEFORE PILOT data/privacy findings have recorded acceptance evidence. If NinFit ID is part of the pilot, include auth lifecycle, recovery, and clear data-boundary acceptance.

## O. Public-launch readiness

**Not ready on available evidence.** Complete local recovery/privacy acceptance, auth-boundary validation if enabled, release/rollback, device/accessibility coverage, and privacy-safe diagnostics. This does not require implementing the future cloud architecture.

## P. Recommended next engineering milestone

Complete a **local-first pilot evidence pack**: schema migration and recovery matrix, export/import restore drill, corrupt/quota/clear-data checks, local privacy/device-loss wording, supported-device/accessibility acceptance, and—only if enabled—Supabase auth lifecycle and identity-data-boundary acceptance.

## Q. Explicit things NOT to build yet

- A production fitness database or cloud sync before the separately approved B2/B3 milestone.
- Social, crew, leaderboard, messaging, media, or live-location backend features.
- Health Connect/HealthKit ingestion before native permission/provenance design.
- Queues, microservices, Kubernetes, Terraform, sharding, replicas, multi-region infrastructure, or distributed transactions.
- Monitoring that captures raw fitness, health, route, location, or user-generated content.

## R. Re-review triggers

Run a full review before the first pilot, public launch, native health integration, fitness cloud sync, social/community exposure, location sharing, automatic external action, payments, major traffic/scaling changes, and after a serious incident. Run a lighter review after persisted-schema, auth, deployment, or sensitive-data changes.

## Review provenance

Initial assessment date: 2026-08-21. Primary evidence: `package.json`, `docs/ROADMAP.md`, `docs/architecture/ninfit-supabase-backend-v1.md`, domain schema/storage/import-export boundaries, Supabase environment/client/auth modules and tests, and the Data/NinFit ID UI. Unknown operational facts remain INVESTIGATE rather than assumptions.
