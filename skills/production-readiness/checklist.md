# Concern Checklist

Companion to `SKILL.md`. Eleven categories. Work through all of them — the value
is as much in the ones you mark `NOT APPLICABLE` as in the ones you raise.

The "default" column is the starting status for a **local-first client with real
user data** (Stage 1). Adjust from the actual stage, then promote against the
triggers in `maturity-model.md`. A default is a starting point, never a verdict.

## A. Reliability

| Concern | Default | Promote when |
|---|---|---|
| Graceful failure of the critical path | `NOW` | Always live. |
| Recovery from corrupt or unreadable state | `NOW` | Always live where data persists. |
| Storage write failure and quota exhaustion | `NOW` | Any client-side persistence. |
| Timeouts, retries, backoff | `NOT APPLICABLE` | A network call the user waits on. |
| Idempotency of mutating operations | `NOT APPLICABLE` | A retryable remote write appears. |
| Circuit breakers, bulkheads | `NOT APPLICABLE` | Multiple services. |
| Availability objective | `INVESTIGATE` | Someone depends on uptime. |

## B. Data and storage

| Concern | Default | Promote when |
|---|---|---|
| Schema versioning | `NOW` | Any persisted user data. |
| A migration path that has actually been run | `NOW` | The first schema change ships. |
| Export and import as a real backup route | `NOW` | Data the user would miss. |
| Restore rehearsed, not just implemented | `NOW` | Same. |
| Quarantine of bad data rather than deletion | `NOW` | Any parse of stored data. |
| Deletion and what it truly removes | `NOW` | Any personal data. |
| Backups of a remote store | `NOT APPLICABLE` | A remote store exists. |
| Indexing, pooling, query tuning | `NOT APPLICABLE` | A remote database exists. |
| Conflict resolution across devices | `NOT APPLICABLE` | Sync appears. |

A migration path that has never been exercised is untested code on the most
dangerous path in the product.

## C. Security

| Concern | Default | Promote when |
|---|---|---|
| No privileged credential in client code | `NOW` | Any client. |
| Public versus secret configuration understood | `NOW` | Any build-time variable. |
| Dependency vulnerability posture | `NOW` | Any dependency. |
| Untrusted input treated as untrusted | `NOW` | Any import or paste path. |
| Session lifecycle, expiry, refresh | `NEXT` | Accounts exist. |
| Credential recovery and enumeration resistance | `NEXT` | Accounts exist. |
| Authorisation per user | `NOT APPLICABLE` | Remote data exists. |
| Secret rotation | `NOT APPLICABLE` | A server holds secrets. |

## D. Privacy and governance

| Concern | Default | Promote when |
|---|---|---|
| What data exists, and where it lives | `NOW` | Any personal data. |
| Private by default | `NOW` | Any sensitive category. |
| The user can see, export and delete their data | `NOW` | Same. |
| Device loss and reset expectations stated plainly | `NOW` | Local-only data. |
| Diagnostics that cannot capture sensitive data | `NOW` | Any error reporting. |
| Consent, revocation, retention | `NEXT` | Data leaves the device. |
| Jurisdiction and regulatory obligations | `INVESTIGATE` | Data leaves the device. |
| Breach and incident planning | `NOT APPLICABLE` | Someone else holds the data. |

Sensitive means health, biometric, location, financial, communications, and
anything about a child. Verify the applicable rules at the trigger; do not rely on
a summary written earlier.

## E. Observability

| Concern | Default | Promote when |
|---|---|---|
| Failures are diagnosable without user data | `NOW` | Always. |
| Release identity visible in a running build | `NOW` | Anything deployed. |
| Structured logs | `NOT APPLICABLE` | A server exists. |
| Metrics and alerting | `NOT APPLICABLE` | Someone is on call. |
| Distributed tracing | `NOT APPLICABLE` | Multiple services. |

## F. Deployment and delivery

| Concern | Default | Promote when |
|---|---|---|
| Reproducible build from a clean checkout | `NOW` | Always. |
| Lockfile committed, runtime version pinned | `NOW` | Always. |
| Environment configuration documented by name | `NOW` | Any environment variable. |
| A known-good version to roll back to | `NOW` | Anything deployed. |
| Rollback rehearsed | `NOW` | Before public launch. |
| Environment separation | `NEXT` | More than one audience. |
| Automated pipeline | `INVESTIGATE` | Manual release becomes the bottleneck or the risk. |

Do not add a pipeline because pipelines are good practice. Add one when a human
step is the thing failing.

## G. Performance

| Concern | Default | Promote when |
|---|---|---|
| Startup and interaction responsiveness on target devices | `NOW` | Any shipped UI. |
| Bundle size and what pulls it up | `NOW` | Any web client. |
| Behaviour with realistic data volume | `NOW` | Data accumulates over time. |
| Caching and CDN beyond ordinary static assets | `LATER` | Measured load. |
| Load testing, P95/P99 | `LATER` | A server under real traffic. |

Measure before optimising, and record the measurement so the next review can tell
whether anything changed.

## H. Scaling and distributed systems

| Concern | Default | Promote when |
|---|---|---|
| Horizontal scaling | `NOT APPLICABLE` | A server exists and is loaded. |
| Replicas, sharding, partitioning | `NOT APPLICABLE` | Volume exceeds one instance. |
| Distributed locks and transactions | `NOT APPLICABLE` | Two stores must agree. |
| Multi-region | `NOT APPLICABLE` | Availability or latency requires it. |
| Chaos engineering | `NOT APPLICABLE` | A distributed system exists. |

If this whole section is `NOT APPLICABLE`, say so and move on. That is the correct
result for most projects, and stating it is what stops it being raised again next
quarter.

## I. Network and API design

| Concern | Default | Promote when |
|---|---|---|
| Error contract the client can act on | `NOT APPLICABLE` | An API exists. |
| Versioning and compatibility | `NOT APPLICABLE` | An external consumer exists. |
| Rate limiting and abuse control | `NOT APPLICABLE` | A public endpoint exists. |
| Payload size and pagination | `NOT APPLICABLE` | Collections are returned. |
| Offline and reconnection behaviour | `NEXT` | The client depends on the network. |

## J. Operations

| Concern | Default | Promote when |
|---|---|---|
| Who owns production access | `INVESTIGATE` | Anything is deployed. |
| Support path when a user loses data | `NOW` | Real users hold real data. |
| Runbook for the top failure | `NEXT` | Before pilot. |
| On-call and escalation | `NOT APPLICABLE` | A service can page someone. |
| Recovery objectives (RPO/RTO) | `NOT APPLICABLE` | Someone else holds the data. |

## K. Containers and infrastructure

| Concern | Default | Promote when |
|---|---|---|
| Reproducible local environment | `NOW` | Always — a pinned runtime often suffices. |
| Containerisation | `NOT APPLICABLE` | A server is deployed, or the environment is genuinely hard to reproduce. |
| Orchestration | `NOT APPLICABLE` | Multiple services need scheduling. |
| Infrastructure as code | `NOT APPLICABLE` | Cloud resources exist and drift. |
| Service mesh, discovery, leader election | `NOT APPLICABLE` | Many services address each other. |

See the promotion table in `SKILL.md`. Nothing here is promoted by appearing here.

## Closing the review

Before writing the report, check three things:

1. Every category has an entry, including the ones that are entirely
   `NOT APPLICABLE`.
2. Every `NOW` has evidence and a smallest next action that is genuinely small.
3. The report says what **not** to build, and why, in as much detail as it says
   what to do.
