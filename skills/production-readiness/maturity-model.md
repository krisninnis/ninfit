# Maturity Model and Promotion Triggers

Companion to `SKILL.md`. Use it to place a project on a stage, then to promote
concerns as the architecture actually changes.

A project is not a single stage. A local-first client with an optional hosted
login is Stage 1 for its data and Stage 3 for its identity boundary at the same
time. Say so. A single averaged stage hides the one boundary that carries risk.

## Stages

**Stage 0 — Local prototype.** Runs on one machine. No users but the author. No
persisted data anyone would miss.
Live: reproducible build, dependency hygiene.
Everything else: `LATER` or `NOT APPLICABLE`.

**Stage 1 — Local-first client with real data.** Shipped to real people, but data
lives on the device. No server owns anything.
Live: schema versioning and migration, backup/export/import, corruption and quota
recovery, deletion and device-loss expectations, release reproducibility and
rollback, accessibility, privacy-safe diagnostics.
Not live: databases, queues, replicas, tracing, autoscaling.

**Stage 2 — Client plus a managed third-party boundary.** Authentication, crash
reporting, analytics or similar. The vendor holds something, the project still
holds no server.
Adds: public-versus-secret configuration, session lifecycle, account recovery,
abuse and rate limits, and an explicit statement of what the vendor receives.

**Stage 3 — Own server or remote data.** The project stores or processes user data
remotely.
Adds: migrations with a tested rollback, backups with a rehearsed restore, access
control per user, transport and at-rest encryption, timeouts, retries,
idempotency, health checks, structured logs, metrics, alerting, and incident
ownership.

**Stage 4 — Multiple services or significant scale.** Measured load, or more than
one deployable talking to another.
Adds: tracing, circuit breakers, connection pooling, caching, indexing strategy,
load testing, P95/P99 objectives, cost monitoring, capacity planning.

**Stage 5 — Distributed at scale.** Genuine partition, region or volume pressure.
Adds: replicas, sharding, multi-region, distributed locks and transactions,
chaos engineering.

Most projects never reach Stage 4. Reaching Stage 3 is not a reason to adopt
Stage 4 practices in advance.

## Promotion triggers

Each trigger is a change in architecture, not a change in ambition. Planning a
feature promotes nothing. Merging it does.

**IF user accounts exist** — promote authentication strength, session lifecycle
and expiry, credential recovery, account enumeration resistance, abuse and rate
limiting, audit of security-relevant events, and account deletion including what
deletion means for data the account does not hold.

**IF a server API appears** — promote rate limiting, timeouts, retries with
backoff, idempotency for anything that mutates, health and readiness checks, API
error contracts, request logging without sensitive payloads, secret management,
and API-level monitoring.

**IF a remote database appears** — promote migrations with a tested rollback,
backups with a **rehearsed restore**, indexing for real query patterns, connection
management and pooling, encryption in transit and at rest, least-privilege access
control, and data retention.

A backup nobody has restored is not a backup.

**IF sensitive local data moves to the cloud** — promote a written data-flow model
(what leaves the device, to whom, for what, for how long), encryption, per-user
access control, retention and deletion, export, consent and revocation, breach and
incident planning, and jurisdiction. Verify the current platform and regulatory
rules at the trigger rather than trusting a stale summary.

**IF automatic external actions appear** — sending, posting, paying or otherwise
acting on a user's behalf — promote idempotency keys, retry safety, rate limiting,
an audit log of what was done and why, a queue only where durability genuinely
requires it, and an explicit human-control boundary: what the user approves, what
they can cancel, and what they can undo.

**IF payments appear** — promote payment-provider security requirements,
idempotent charge handling, reconciliation against the provider's record, refunds
and chargebacks, fraud controls, signed webhook validation, and the compliance
obligations of the chosen model.

**IF traffic materially rises** — promote caching, indexing, connection pooling,
CDN use, load testing, P95/P99 objectives, cost monitoring, and autoscaling only
where measurement justifies it. Measure first: a slow query fixed by an index is
cheaper than any capacity change.

**IF multiple backend services appear** — promote distributed tracing, circuit
breakers, per-service health, timeout budgets across calls, and explicit handling
of partial failure.

## Demotion

Triggers work in both directions. If a service is retired, a vendor dropped or a
feature removed, the concerns it promoted return to `NOT APPLICABLE` and the
tooling it justified should be removed rather than maintained out of habit.
