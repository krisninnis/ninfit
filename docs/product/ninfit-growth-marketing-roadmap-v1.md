# NinFit Growth & Marketing Automation Roadmap v1

**Status:** FUTURE — product/growth direction only; not implemented.
**Scope:** Marketing, advertising, growth analytics, community, lifecycle messaging and agent-assisted operations.
**Repository:** `C:\Users\thoma\fitness-tracker`
**Product:** NinFit
**Version:** v1
**Last updated:** 23 August 2026

---

## 1. Purpose

This document records the proposed long-term growth and marketing operating model for NinFit so the idea does not depend on chat history.

The goal is to let a small team — potentially one founder plus software agents — operate a disciplined marketing function without turning NinFit into a spammy, manipulative or pay-to-win product.

This is **not** an implementation authorisation. Repository truth, `docs/DECISIONS.md`, product guardrails, privacy/security requirements and future legal review override stale detail here.

### Decision labels

- **LOCKED** — product principle already consistent with NinFit's direction.
- **DIRECTION** — agreed direction; implementation details remain open.
- **FUTURE** — deliberately postponed until the product is ready.
- **OPEN** — requires a later product/business decision.

---

## 2. Governing principle — LOCKED

**Agents should optimise for people who become retained, genuinely engaged NinFit users — not clicks, followers or installs.**

Marketing must not pressure people into unhealthy behaviour, fake achievement, guilt, streak anxiety or unnecessary spending.

The product remains fitness-first:

> Fitness is the product. The game is emotional reinforcement.

Marketing should reflect that truth rather than presenting NinFit as a casino, collectible shop or arcade.

---

## 3. Commercial guardrails — LOCKED / DIRECTION

### LOCKED

The following must never be purchasable shortcuts:

- XP already intended to represent genuine activity
- trophies
- Champion progression
- Secret Prestige
- challenge-exclusive mascots/forms
- world/location discovery mascots
- achievement-only prestige features
- fake PBs or fabricated fitness history

### DIRECTION

A future paid tier may reasonably contain convenience, analysis and customisation features, for example:

- deeper personal insights
- richer route/Journey analysis
- advanced personal segments/PBs
- route planning
- expanded wearable analysis
- additional personalisation/customisation
- advanced history/search/export convenience

The core personal fitness record, basic activity tracking and earned progression should not feel held hostage behind a subscription.

---

## 4. Proposed agent team — DIRECTION

The long-term model is a small virtual growth department made from specialised agents rather than one bot with broad authority.

### 4.1 Market Research Agent

Purpose:

- monitor competitor products and launches
- study public user reviews and recurring complaints
- track fitness, wearable and GPS trends
- monitor emerging search themes and communities
- identify underserved user groups and positioning opportunities

Likely comparison set includes products such as:

- Strava
- Nike Run Club
- adidas Running
- AllTrails
- Fitbit
- Garmin
- Apple Fitness / Apple Watch ecosystem

Output should be evidence and recommendations, not automatic product changes.

### 4.2 Content Agent

Purpose:

Turn real NinFit development and product value into useful content.

Potential outputs:

- product-development updates
- feature explainers
- GPS/Living Journey demonstrations
- mascot reveals
- short-form video scripts
- Instagram/TikTok/Reels captions
- Reddit drafts
- blog posts
- launch notes
- email copy

The agent drafts. Public posting authority should initially remain human-controlled.

### 4.3 Creative Agent

Purpose:

Generate multiple campaign concepts from approved NinFit positioning and approved assets.

Examples of themes to test:

- fitness without guilt
- calm gamification
- Living Journey
- private-by-default GPS
- beginner-friendly fitness
- mascot companionship
- personal progress over public competition

The Creative Agent should create variants, not invent unsupported health claims.

### 4.4 Advertising Agent

Purpose:

Operate paid acquisition experiments across suitable channels, potentially including:

- Meta
- TikTok
- Google / YouTube
- Apple Search Ads
- other relevant channels discovered later

Possible responsibilities:

- prepare campaign variants
- monitor CPM/CPC/CTR/conversion data
- identify clear underperformers
- recommend pausing or reallocating budget
- compare creative/audience combinations

**Budget increases and material spend changes require human approval initially.**

### 4.5 Growth Analyst Agent

Purpose:

Connect advertising performance to actual downstream product behaviour.

The key funnel is not merely:

`ad -> click -> install`

It should become:

`ad -> landing page -> install/signup -> first activity -> repeat activity -> retention -> paid conversion -> long-term value`

The Growth Analyst should answer questions such as:

- Which campaign creates users who actually complete a first activity?
- Which acquisition source produces the strongest 7-day and 30-day retention?
- Which product features correlate with healthy retention?
- Which paid users remain active rather than cancelling immediately?
- Which campaign has a higher click cost but better retained-user economics?

This is expected to be one of the highest-value agents.

### 4.6 Community Agent

Purpose:

- summarise app-store reviews and social comments
- cluster recurring feature requests
- identify testimonials and positive stories
- draft responses
- surface potential abuse/safety issues
- escalate sensitive situations to a human

The Community Agent must not automatically delete criticism or engage in arguments.

### 4.7 Lifecycle Agent

Purpose:

Manage opt-in communication after signup or install.

Possible lifecycle moments:

- welcome
- first activity
- first saved Journey
- first PB
- return after inactivity
- trial onboarding
- subscription conversion
- cancellation/win-back

Messages must obey NinFit's calm product philosophy.

Do not send manipulative messages such as:

- "You're losing your streak"
- "Don't disappoint your mascot"
- shame-based inactivity messages
- artificial countdown pressure

---

## 5. The NinFit Growth Brain — FUTURE

The long-term opportunity is a shared growth dataset that allows agents to learn what marketing produces retained users rather than vanity metrics.

A future schema may include concepts such as:

- campaign
- creative
- audience
- channel
- spend
- impressions
- clicks
- landing-page visits
- installs
- signups
- first activity
- first Journey
- day-1/day-7/day-30 retention
- subscription start
- revenue
- cancellation
- feature usage
- acquisition source

The exact data model is **OPEN** and must be designed with privacy/data-minimisation requirements before implementation.

---

## 6. Example daily growth brief — DIRECTION

A mature system could produce one concise founder report rather than dozens of dashboards.

Example:

```text
NINFIT GROWTH — TODAY

Yesterday
£41.20 ad spend
126 landing-page visits
34 installs
21 first activities
8 returning users

BEST CAMPAIGN
"Fitness without the guilt."
Strongest activated-user cost

WEAK CAMPAIGN
"Collect fitness mascots."
High traffic, weak activation
Recommendation: pause

USER SIGNALS
• Apple Watch requests increasing
• private GPS routes praised
• Fitbit requests recurring
• onboarding confusion reported

PROPOSED ACTION
Move a small test budget from weak campaign C to campaign A.
Human approval required.
```

The final implementation must use real metrics and statistical care rather than misleading conclusions from tiny samples.

---

## 7. Positioning experiments — DIRECTION

Rather than deciding NinFit's final marketing message by intuition alone, test multiple truthful product angles.

Candidate positioning themes:

### A. Calm / anti-pressure

"Fitness without the guilt."

### B. Gamified fitness

"Your real activity grows your companion."

### C. Living Journey

"Your fitness app shouldn't just track where you went. It should remember where your journey happened."

### D. Privacy

"Track your routes without having to broadcast your life."

### E. Beginner-friendly

"You don't need to be an athlete to start."

Success should be judged on retained healthy product usage, not merely click-through rate.

---

## 8. Automation authority model — LOCKED / DIRECTION

Automation must grow gradually.

### Safe to automate early — DIRECTION

- competitor/review monitoring
- keyword/trend research
- summarisation
- draft content
- draft ad variants
- performance reporting
- anomaly detection
- identifying obvious low-performing campaigns
- preparing recommended actions

### Human approval required initially — LOCKED

- increasing advertising budgets
- material spend reallocation
- final campaign launch
- sensitive public responses
- controversial community moderation
- health-related claims
- pricing changes
- influencer/partner agreements
- deletion of user/public content
- anything with legal/privacy implications

### Future conditional autonomy — OPEN

After sufficient evidence and guardrails, narrowly bounded agents may be allowed to perform low-risk actions automatically, such as pausing a campaign that breaches predefined loss limits.

Any such authority must have:

- hard spend caps
- audit logs
- rollback
- human override
- clear allowed actions
- clear denied actions

---

## 9. Security and privacy guardrails — LOCKED

Marketing automation must not weaken NinFit's privacy model.

Agents must never receive unrestricted access to data simply because it would improve targeting.

Future implementation should use the minimum data necessary and must consider:

- UK GDPR / applicable privacy law
- health/fitness data sensitivity
- location data sensitivity
- purpose limitation
- consent/marketing preferences
- opt-out/unsubscribe handling
- retention
- processor/vendor contracts
- ad-platform data sharing
- analytics minimisation
- pseudonymisation/aggregation where practical

Do not upload raw GPS routes, health notes, heart-rate history or similar sensitive records into advertising platforms merely to optimise campaigns.

---

## 10. Health-claim guardrails — LOCKED

Agents and advertisements must not invent or imply unsupported medical outcomes.

Do not automatically publish claims such as:

- diagnosing illness
- treating medical conditions
- guaranteed weight loss
- guaranteed cardiovascular improvement
- guaranteed mental-health outcomes

NinFit marketing should describe actual product capabilities and genuine fitness/wellness support.

Any material health claim requires deliberate human/legal review.

---

## 11. Community and social guardrails — LOCKED

Marketing automation must not:

- manufacture fake testimonials
- impersonate users
- create fake grassroots conversations
- spam communities
- mass-post repetitive promotional content
- conceal commercial relationships where disclosure is required
- buy fake reviews/followers

Community presence should be useful and transparent.

---

## 12. Rollout roadmap

### Stage 0 — Now

**Status: FUTURE / planning only**

Do not build a large marketing automation platform while the core product is still proving GPS, activity, data-safety and architecture foundations.

Allowed work:

- preserve this roadmap
- gather market evidence
- develop positioning hypotheses
- collect early feedback
- build launch asset inventory gradually

### Stage 1 — Research Agent

Trigger:

NinFit has a stable testable product proposition and needs structured market feedback.

Build:

- competitor monitoring
- review synthesis
- feature-request clustering
- weekly opportunity report

No ad spending automation.

### Stage 2 — Content Agent

Trigger:

There is a steady stream of real product progress worth showing publicly.

Build:

- approved content templates
- development-to-content workflow
- draft social/blog/email content
- human publishing approval

### Stage 3 — Early analytics foundation

Trigger:

NinFit has external testers/users.

Build only what is necessary to understand:

- acquisition source
- activation
- first activity
- retention
- conversion

Privacy review is required before analytics collection expands.

### Stage 4 — Growth Analyst Agent

Trigger:

Enough real user data exists for meaningful comparison.

Build:

- funnel reporting
- cohort retention
- campaign-to-activation analysis
- campaign-to-retention analysis
- cancellation/reason synthesis

### Stage 5 — Controlled paid acquisition

Trigger:

NinFit shows organic activation/retention strong enough to justify paid testing.

Start with small capped experiments.

Advertising Agent may:

- prepare campaigns
- monitor them
- recommend changes

Human approves spend and launches.

### Stage 6 — Community Agent

Trigger:

Public user/review volume justifies dedicated monitoring.

Build:

- review/comment aggregation
- sentiment/theme grouping
- response drafting
- escalation workflow

### Stage 7 — Lifecycle Agent

Trigger:

Messaging permissions, privacy rules and lifecycle events are mature.

Build calm, opt-in lifecycle communication around genuine product moments.

### Stage 8 — Limited autonomous optimisation

Trigger:

Only after sustained evidence that agent recommendations are reliable.

Potentially allow tightly bounded automatic actions such as:

- pausing a campaign above a predefined loss threshold
- rotating already-approved creative
- lowering spend within predefined rules

Never grant unrestricted advertising-account authority.

---

## 13. Initial three-agent priority — DIRECTION

If NinFit eventually starts small, build these first:

1. **Market Research Agent** — understand what users and the market actually want.
2. **Content Agent** — turn genuine NinFit progress into consistent marketing.
3. **Growth Analyst Agent** — identify what acquisition produces retained users.

The Advertising Agent should come **after** there is enough evidence to spend money intelligently.

---

## 14. Metrics hierarchy — DIRECTION

Prefer metrics in this order:

### Tier 1 — Product value

- first meaningful activity
- repeat activity
- retained active user
- long-term fitness engagement

### Tier 2 — Business value

- trial-to-paid conversion
- paid retention
- churn
- customer acquisition cost
- lifetime value, once measurable responsibly

### Tier 3 — Acquisition efficiency

- cost per activated user
- cost per retained user
- landing-page conversion

### Tier 4 — Diagnostic / vanity metrics

- impressions
- clicks
- followers
- likes

Tier 4 is useful diagnostically but must never become the primary success definition.

---

## 15. Important anti-goals — LOCKED

Do not build a growth system that optimises for:

- addictive screen time
- compulsive checking
- guilt-driven exercise
- streak anxiety
- fake scarcity
- fake user activity
- deceptive urgency
- pay-to-win progression
- selling achievement
- dark-pattern subscription retention

NinFit should succeed because people value using it, not because automation pressures them into staying.

---

## 16. Future implementation questions — OPEN

Resolve before any major implementation:

1. Which analytics events are genuinely necessary?
2. What lawful/privacy basis applies to each analytics/marketing data flow?
3. Which advertising platforms are worth supporting?
4. What marketing budget may agents ever control?
5. What spend ceilings and rollback rules apply?
6. Which content may publish automatically, if any?
7. How should health/location data be excluded from ad-platform targeting?
8. Which metrics define an "activated" NinFit user?
9. Which retention window best reflects real user value?
10. What monetisation model will exist at launch?
11. What marketing claims require manual legal review?
12. How should experiments be documented so failed tests are not repeated indefinitely?

---

## 17. Long-term outcome

The target is not "AI runs our social media."

The target is a disciplined, measurable growth operation where agents do repetitive research, drafting, monitoring and analysis while humans retain control over money, sensitive claims, ethics, privacy and major brand decisions.

The system should ultimately answer one question better than conventional ad dashboards:

> Which marketing brings people who actually find lasting value in NinFit?
