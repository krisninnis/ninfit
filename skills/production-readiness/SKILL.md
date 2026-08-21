# Production Readiness

## Purpose

Use this skill to decide what production engineering a project needs **now**, what
belongs **next**, what belongs **later**, and what does not apply at all.

Run it before a pilot, before a public launch, before any of the architecture
triggers in `maturity-model.md`, and after a serious incident. Do not run it after
every small change.

## Why this one has no project prefix

Every other skill in this repository is named `ninfit-*` because it encodes a
NinFit product or repository decision. This one is deliberately unprefixed: it is
project-agnostic. Everything except the sibling-skill list at the end ports to
another repository unchanged; that section is repository-local by nature and is
the one place to edit when porting.

The rule for this repository: **`ninfit-*` means project-specific, unprefixed means
portable.** Keep the project's own facts out of this skill. NinFit's assessment
lives in `docs/production-readiness.md`; the reusable method lives here.

## The governing question

**What production-engineering concerns matter for THIS project at ITS current
maturity — and which would be premature to build?**

Two failure modes, not one. This skill exists to prevent both:

1. **Under-engineering.** Shipping personal data, accounts or money without
   migration paths, recovery, privacy boundaries or a rollback plan.
2. **Over-engineering.** Adding Kubernetes, queues, replicas, tracing or
   autoscaling to something that has none of the problems they solve.

A review that only ever adds work has failed the second test. Rejecting
infrastructure with a reason is a finding, not an omission.

## Classification

Every concern gets exactly one status:

| Status | Meaning |
|---|---|
| `NOW` | Matters at the current architecture and maturity. |
| `NEXT` | Matters at the next planned milestone, not yet. |
| `LATER` | Real, but needs an architecture the project does not have. |
| `NOT APPLICABLE` | The thing it protects does not exist here. |
| `INVESTIGATE` | Cannot be classified without a fact nobody has established. |

`INVESTIGATE` is a first-class answer. Recording an unknown honestly beats
inventing a status to make the table look complete.

Every `NOW` concern additionally gets a gate:

- `BLOCKER BEFORE PILOT`
- `SHOULD COMPLETE BEFORE PUBLIC RELEASE`
- `NORMAL TECH-DEBT / FUTURE MILESTONE`

## The shape of a finding

Every finding carries all six. A finding missing evidence is an opinion.

1. **Status** and, for `NOW`, its gate.
2. **Why it matters** — the concrete failure, not the category name.
3. **Repository evidence** — file paths, scripts, configuration, tests. Cite what
   you actually read.
4. **Trigger** — the change that raises this concern's priority.
5. **Smallest sensible next action** — the least work that materially reduces the
   risk. Usually a check, a rehearsal or a written decision, not a system.
6. **Implement now?** — an explicit yes or no.

## Evidence over assumption

Classify from what the repository shows: source, tests, `package.json`, lockfile,
configuration, deployment files, and the project's own roadmap and architecture
documents.

Do not infer a database because an ORM is a transitive dependency. Do not infer
traffic. Do not infer users. Do not promote a concern because a checklist mentions
it. If the fact is not in the repository and nobody has stated it, the status is
`INVESTIGATE`.

## The premature-complexity rule

**Infrastructure earns its place by solving a problem the project currently has.**

Default the following to `NOT APPLICABLE` and promote only against evidence. State
the evidence that would promote each, so the answer is checkable rather than a
matter of taste.

| Capability | Promote only when |
|---|---|
| Docker | The runtime environment is genuinely hard to reproduce, or a server is being deployed. |
| Kubernetes | Multiple services need scheduling, and an ordinary host has been outgrown. |
| Terraform / Helm | Cloud resources exist and are being changed by hand often enough to drift. |
| Message queues / pub-sub | Durable asynchronous work exists that must survive a crash. |
| API gateway | Several backend services need one authenticated, rate-limited edge. |
| Distributed transactions / Saga | One user action must commit across two or more independent stores. |
| Read replicas / sharding | Measured read load or data volume exceeds one instance. |
| Distributed locks | Two or more processes contend for the same mutable resource. |
| Multi-region | Availability or latency requirements cannot be met from one region. |
| Chaos engineering | A distributed system exists whose failure modes are worth injecting. |
| Autoscaling | Measured load varies enough that fixed capacity is wrong. |
| Service mesh / discovery | Services are numerous enough that direct addressing has broken down. |

Never recommend one of these because it appears in this table.

## Review cadence

Run a **full** review before:

- the first pilot with real user data
- public launch
- adding remote or server infrastructure
- moving sensitive data off the device
- automatic external actions taken on a user's behalf
- payments
- a major scaling change

Run a full review **after** a serious production incident.

Run a **lighter** review after a major milestone, a persisted-schema change, an
authentication change, a deployment or configuration change, or a change in what
data leaves the device.

Do not require the full checklist after a routine code change.

## Standard output contract

A review reports these sections, in this order. Sections with nothing to say say
so explicitly rather than being dropped — an absent section reads as an oversight.

```
A. Project snapshot
B. Current maturity stage
C. NOW
D. NEXT
E. LATER
F. NOT APPLICABLE
G. Investigation required
H. Security / privacy blockers
I. Reliability blockers
J. Data / storage blockers
K. Deployment / observability blockers
L. Scaling assessment
M. Premature-complexity warning
N. Pilot readiness
O. Public-launch readiness
P. Recommended next engineering milestone
Q. Explicit things NOT to build yet
R. Re-review triggers
```

Sections M and Q are not padding. They are the half of the review that stops the
other half from being used as a shopping list.

Record the assessment date and the primary evidence read. A review with no
provenance cannot be re-run or challenged.

## Assessment is not authorisation

**A finding is a recommendation to consider, never permission to build.**

Producing a review changes no code, adds no dependency and creates no
infrastructure. Implementation happens only through a separately authorised task.

This matters most for `NOW` findings, which read as urgent. Urgent still means
"raise it", not "start it".

## What this skill does not own

It assesses. Other skills own the doing, and this one points rather than repeats:

- `ninfit-repository-workflow` — preflight, working-tree safety, verification
  environments, permission boundaries, reporting
- `ninfit-deployment-health` — build-time environment variables, secret handling,
  deployment diagnosis, asset failures
- `ninfit-ui-verification` — accessibility and responsive verification method
- `ninfit-fitness-truth` — data truth, provenance, health-data privacy
- `ninfit-product-guardrails` — product boundaries that a technical fix must not
  quietly cross

When a finding touches one of those, cite the skill instead of restating it.

## Companion files

- `checklist.md` — the concern categories A–K, with the default status for a
  local-first client and what promotes each.
- `maturity-model.md` — the stages, and the architecture triggers that promote
  whole groups of concerns at once.
