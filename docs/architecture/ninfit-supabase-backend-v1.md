# NinFit — Supabase Backend Architecture v1

**Status:** Design specification
**Backend platform:** Supabase
**Supabase project:** `ninfit`
**Project ref:** `hhpmmrxjtvvjjznehhxi`
**Region:** London / `eu-west-2`

This document defines how NinFit should use Supabase while preserving the existing local-first application architecture.

No database schema should be treated as final merely because it appears in this document.

Implementation should happen through explicit backend milestones and migrations.

---

# 1. CORE PRINCIPLE

NinFit remains:

> **LOCAL FIRST. CLOUD ENHANCED.**

The cloud must not become a requirement for basic fitness use.

Core functions should continue to work offline where practical:

* view today's programme
* complete activities
* acknowledge rest
* record manual fitness information
* update local game progress
* view cached mascot state
* record GPS activity when native support exists
* queue changes for later synchronisation

Supabase provides:

* identity
* cloud backup
* multi-device sync
* social features
* Crews
* Journey Wall
* Adventure Vault
* segments
* leaderboards
* messaging infrastructure
* media storage
* server-side validation
* future AI/server functions

---

# 2. SOURCE-OF-TRUTH MODEL

Not all NinFit data should have the same authority.

Use four broad layers.

## A. Device-originated trusted data

Examples:

* manual activity completion
* phone-recorded GPS activity
* Health Connect import
* HealthKit import
* wearable data
* user-entered measurements

Store provenance.

Example:

```text
source = manual
source = health_connect
source = healthkit
source = gps_recorder
source = wearable
source = imported
```

---

## B. Deterministically derived NinFit facts

Examples:

* XP
* personal best eligibility
* trophy eligibility
* mascot progression
* consistency rewards
* egg progression
* Champion eligibility
* Adventure verification result

These must be derived from trusted evidence.

AI must never be authoritative for these states.

---

## C. AI-generated interpretation

Examples:

* progress summary
* mascot dialogue
* meal estimate
* Journey Review
* personalised explanation
* AI Adventure Photo

AI-generated information must remain distinguishable from measured or verified data.

---

## D. Social/user-generated content

Examples:

* Journey Wall posts
* comments
* reactions
* Crew messages
* profile bio
* photos
* community Adventures

This requires moderation/privacy rules separate from fitness truth.

---

# 3. DATA CLASSIFICATION

Every NinFit data type should be assigned a cloud category.

## CLASS 1 — CLOUD ESSENTIAL

Needed for account-based functionality.

Examples:

* account identity
* profile
* privacy preferences
* friend relationships
* Crew membership
* Adventure Vault ownership
* public profile choices
* cloud backup metadata

---

## CLASS 2 — CLOUD SYNCED

Useful across devices but still cached locally.

Examples:

* programme
* activity records
* mascot state
* XP/reward history
* trophies
* passports
* Legacy Tree
* settings
* Journey memories

---

## CLASS 3 — CLOUD OPTIONAL / SENSITIVE

User may choose whether detailed data is synced.

Examples:

* heart rate
* HRV
* sleep
* weight
* detailed nutrition
* health-condition notes
* detailed GPS history

Cloud use should be explicit and transparent.

---

## CLASS 4 — EPHEMERAL

Prefer not to retain after the task is complete.

Examples:

* temporary Adventure live-location sharing
* raw GPS verification buffers
* temporary AI image inputs
* Safety Mode sharing state
* intermediate AI prompts
* temporary upload processing

Delete as soon as reasonably possible after use.

---

# 4. AUTHENTICATION

Use:

> **Supabase Auth**

Initial account methods should stay simple.

Recommended V1:

* email magic link / OTP
* email + password if needed
* Google
* Apple when native/iOS launch requires it

Later:

* passkeys where appropriate

Never design fitness ownership around email addresses directly.

Every user-owned row should reference:

```text
auth.users.id
```

using UUID ownership.

---

# 5. PUBLIC PROFILE SEPARATION

Private account identity and public NinFit identity must be separate.

Suggested public profile entity:

```text
profiles
```

Possible fields:

```text
id
username
display_name
bio
avatar_path
created_at
updated_at
profile_visibility
```

Do NOT include private health information.

Public profile data should never contain:

* email
* weight
* heart rate
* HRV
* medical notes
* private programme details
* precise home location

---

# 6. USER SETTINGS

Suggested:

```text
user_settings
```

Possible groups:

## Appearance

* theme
* reduced motion
* sound
* haptics
* voice

## Fitness

* unit preference
* programme preferences

## Privacy

* profile visibility
* default activity visibility
* default route visibility
* Journey Wall visibility
* reaction permissions
* comment permissions

## AI

* AI enabled
* companion memory enabled
* nutrition AI enabled
* voice AI enabled

## Location

* Adventure location enabled
* live sharing defaults
* location history preference

Do not create one enormous JSON settings object if fields need to be secured or queried independently.

Small stable JSON blocks may still be appropriate for low-risk UI preferences.

---

# 7. PROGRAMME DATA

Suggested entities:

```text
programmes
programme_weeks
planned_sessions
planned_activities
```

A programme should preserve:

* ownership
* creation date
* current status
* programme version
* effective dates
* provenance
* user modifications

Programme history matters.

Do not silently mutate old programme history in a way that changes previously earned rewards.

Future adaptive changes should create a traceable programme revision rather than rewriting history invisibly.

---

# 8. ACTIVITY DATA

Suggested core entity:

```text
activities
```

Possible fields:

```text
id
user_id
activity_type
started_at
ended_at
local_date
duration_seconds
distance_metres
status
source
source_reference
created_at
updated_at
```

Possible activity types:

* walk
* run
* cycle
* hike
* strength
* yoga
* mobility
* swimming
* recovery
* other

Activity-specific details should not force hundreds of nullable columns into the core table.

Use dedicated detail tables where necessary.

Examples:

```text
gps_activity_details
strength_activity_details
swim_activity_details
```

---

# 9. GPS DATA

Raw GPS points can become enormous.

Do not store millions of individual GPS samples indefinitely without a reason.

Potential model:

```text
gps_tracks
```

with:

* activity_id
* encoded/compressed route
* distance
* elevation gain
* route privacy metadata
* verification state

Potential temporary raw-point storage:

```text
gps_track_samples_temp
```

or device-local processing before upload.

Prefer storing a processed route representation after verification.

---

# 10. HEALTH DATA

Health data requires stricter separation.

Potential entity family:

```text
health_measurements
health_import_batches
health_sources
```

Every measurement should preserve:

* type
* value
* unit
* measured_at
* source
* source_device
* imported_at
* confidence/provenance

Never silently overwrite a manual reading with wearable data.

---

# 11. GAME STATE

Do not store one giant opaque game-state JSON blob forever.

Long-term cloud model should make important permanent state queryable.

Possible entities:

```text
game_profiles
reward_events
skill_progress
trophies
user_trophies
```

## game_profiles

Could contain:

```text
user_id
overall_level
total_xp
active_mascot_id
updated_at
```

## reward_events

Append-only where possible.

Possible:

```text
id
user_id
reward_key
reward_kind
xp_awarded
skill
skill_xp_awarded
earned_at
source_event_id
```

`reward_key` should be unique per user where required for idempotency.

Never rely solely on a mutable XP number without reward evidence.

---

# 12. MASCOTS

Suggested:

```text
mascots
```

Possible fields:

```text
id
user_id
species_id
name
presentation
variant
rarity
stage
hatched_at
champion_at
created_at
active
```

Permanent identity belongs here.

Temporary condition should generally be derived rather than persisted as personality judgement.

---

# 13. MASCOT PASSPORT

Suggested:

```text
mascot_passports
```

Potential information:

* personality
* favourite activities
* bond state
* signature activity
* predecessor
* inherited visual trait
* inherited personality trait
* Legacy badge
* Champion date
* generation

Some of these may eventually deserve their own relational tables.

---

# 14. MASCOT MEMORIES

Suggested:

```text
mascot_memories
```

Possible:

```text
id
mascot_id
user_id
memory_type
occurred_at
source_event_id
title
summary
visibility
created_at
```

AI may write wording.

AI must not fabricate the underlying event.

---

# 15. LEGACY TREE

Suggested relationship table:

```text
mascot_legacy_links
```

Possible:

```text
predecessor_mascot_id
successor_mascot_id
visual_trait
personality_trait
legacy_badge
created_at
```

Do not delete old Champions.

---

# 16. SECRET PRESTIGE

Suggested eventual model:

```text
prestige_unlocks
```

Possible:

```text
id
user_id
mascot_id
prestige_type
earned_at
source_rule_version
```

Eligibility should be determined server-side or deterministically from trusted data when public/social prestige matters.

Never allow clients simply to submit:

```text
I earned Opal Wings
```

without verification.

---

# 17. COSMETICS

Suggested:

```text
cosmetic_catalogue
user_cosmetics
mascot_equipment
```

Catalogue contains product definitions.

Ownership contains earned/purchased provenance.

Example ownership fields:

```text
user_id
cosmetic_id
acquisition_type
acquired_at
source_reference
```

Possible acquisition types:

* achievement
* Adventure
* Crew
* season
* shop
* Secret Prestige
* founding
* promotional

Gameplay power must not live in cosmetic definitions.

---

# 18. TROPHY ROOM

Suggested:

```text
trophies
user_trophies
featured_trophies
```

Champion Relics may eventually have:

```text
champion_relics
```

Crew relics:

```text
crew_relics
```

Adventure relics:

```text
adventure_relics
```

These can share a common display abstraction later if useful.

---

# 19. ADVENTURES

Suggested core:

```text
adventures
```

Possible:

```text
id
slug
title
description
region_id
adventure_type
difficulty_metadata
visibility
creator_user_id
verification_level
status
created_at
```

Related entities:

```text
adventure_routes
adventure_checkpoints
adventure_completions
adventure_rewards
```

---

# 20. ADVENTURE COMPLETIONS

Suggested:

```text
adventure_completions
```

Possible:

```text
id
adventure_id
user_id
activity_id
started_at
completed_at
verification_status
verification_score
completion_path
earned_reward_state
```

Possible verification statuses:

* pending
* verified
* user_confirmed
* rejected
* needs_review

Never publicly label uncertainty as fraud.

---

# 21. ADVENTURE VAULT

Suggested:

```text
adventure_mascots
user_adventure_mascots
```

Adventure Mascots remain separate from the normal Legacy mascot system.

Ownership should preserve:

* Adventure that unlocked it
* date
* rarity
* discovery version
* region
* optional associated active mascot

---

# 22. ADVENTURE ATLAS

Suggested:

```text
regions
region_progress
```

Possible hierarchy:

```text
World
→ Country
→ Region
→ Area
→ Adventure
```

Do not store precise home location as the user's default region identifier.

---

# 23. FRIENDS

Suggested relationship:

```text
friendships
```

Possible status:

* pending
* accepted
* blocked

Avoid duplicate reciprocal rows if a single canonical relationship row can represent the friendship cleanly.

---

# 24. CREWS

Suggested:

```text
crews
crew_memberships
crew_sessions
crew_relics
```

Membership roles:

* owner
* organiser
* member
* guest

Roles never affect fitness progression.

---

# 25. CREW SESSIONS

Suggested:

```text
crew_sessions
crew_session_participants
```

Support:

* in-person
* virtual
* recurring
* Adventure
* Relay
* event

Individual users still record their own fitness activity.

The Crew session references those activities rather than replacing them.

---

# 26. LIVE CREW ROOM

Use Supabase Realtime only for temporary state such as:

* joined
* active
* finished
* optional shared progress
* one-tap encouragement

Do not persist unnecessary live telemetry forever.

Private health metrics must not be automatically broadcast.

---

# 27. JOURNEY WALL

Suggested:

```text
journey_posts
journey_post_media
```

Possible post types:

* activity
* PB
* Champion
* Adventure
* mascot discovery
* Crew
* seasonal memory
* photo
* relic

Every post has an explicit visibility state.

---

# 28. VISIBILITY MODEL

Standardise visibility values where possible:

```text
private
friends
crew
public
```

Some entities may require:

```text
selected_users
```

Do not scatter unrelated privacy booleans throughout the schema.

Use a clear policy model.

---

# 29. REACTIONS

Suggested:

```text
reactions
```

Reaction type may include:

* nice_one
* smashed_it
* respect
* opal
* hang_loose
* ride_on
* adventure
* pb

Server must validate that the user can see the target post before allowing a reaction.

---

# 30. COMMENTS

Suggested:

```text
comments
```

Comments should launch only inside trust layers allowed by product policy.

Possible moderation metadata:

```text
status
reported_count
moderation_state
```

Do not create public comments before moderation controls exist.

---

# 31. DISCOVER

Do not store an opaque AI-generated feed.

Discover should query approved public entities using:

* geography
* relevance
* activity type
* accessibility
* quality
* freshness
* creator trust
* safety

Raw engagement should not dominate ranking.

---

# 32. SEGMENTS

Suggested:

```text
segments
segment_routes
segment_attempts
```

Segment attempt:

```text
user_id
segment_id
activity_id
elapsed_ms
verification_status
recorded_at
```

Do not trust client-supplied segment times without activity evidence for public rankings.

---

# 33. PERSONAL BESTS

Suggested:

```text
personal_bests
```

or derive current PBs from immutable validated efforts with a materialised/cache layer.

PB history should remain available even after a newer PB replaces the current best.

---

# 34. RECORD LEGACY

Suggested:

```text
segment_record_history
```

Store historical:

* record holder
* record time
* set date
* superseded date
* duration held

That allows:

> Former Local Record Holder

without relying on mutable leaderboard history.

---

# 35. LEADERBOARDS

Prefer server-side SQL/functions/views.

Never download every segment attempt to the client and rank there.

Possible scopes:

* self
* friends
* Crew
* local
* global
* season
* event

Prize-event rankings require stronger verification.

---

# 36. CHALLENGE CIRCLES

Suggested:

```text
challenge_circles
challenge_circle_members
challenges
challenge_participation
```

Participation may use personalised goals rather than identical output.

---

# 37. ADAPTIVE RELAYS

Suggested:

```text
relay_events
relay_legs
relay_participants
```

Each leg can have an appropriate challenge.

Team contribution does not need to be raw-distance equivalent.

---

# 38. PRIVATE MESSAGING

Future NinFit messaging requires a dedicated security design.

Possible server tables:

```text
conversations
conversation_members
encrypted_messages
message_devices
```

The server stores ciphertext.

Do NOT store plaintext E2EE message content in Postgres.

Do NOT claim E2EE until proper:

* identity keys
* device keys
* key exchange
* group key rotation
* device removal
* recovery
* backup
* multi-device behaviour

have been designed.

---

# 39. STORAGE BUCKETS

Potential Supabase Storage buckets:

```text
avatars
journey-media
adventure-media
mascot-assets
generated-media
crew-media
```

Recommended policy:

## avatars

Public only if profile visibility permits.

## journey-media

Private by default.

Use signed URLs or authenticated access.

## adventure-media

Private by default.

## generated-media

Private by default.

AI-generated variants retain provenance.

## mascot-assets

Canonical application assets may eventually be public/CDN-served.

Do not mix private user photos with public application artwork.

---

# 40. MEDIA METADATA

Store media ownership and provenance in Postgres.

Example:

```text
media_assets
```

Fields:

* owner_user_id
* bucket
* object_path
* media_type
* created_at
* generated
* source_asset_id
* visibility
* location_metadata_removed

Do not trust bucket path alone as the entire authorisation model.

---

# 41. ROW LEVEL SECURITY

RLS should be enabled on every user-facing table exposed through Supabase APIs.

General rules:

## Private user rows

User may:

```text
SELECT / INSERT / UPDATE
WHERE user_id = auth.uid()
```

Deletion depends on entity semantics.

---

## Public profiles

Anyone may read only explicitly public profile rows/fields.

Private account details live elsewhere.

---

## Friend-visible content

Access should depend on an accepted friendship relationship.

---

## Crew-visible content

Access should depend on active Crew membership.

---

## Public Journey posts

Anyone may read only posts explicitly marked public.

---

## Admin/service operations

Use trusted server-side functions/service credentials.

Never place a service-role key in:

* Vite frontend
* browser storage
* GitHub
* public environment variables
* mobile bundle

---

# 42. API KEYS

Frontend eventually uses:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Only the publishable key belongs in the frontend.

Server-side functions may use privileged secrets when necessary.

Privileged secrets must remain:

* server-only
* protected in Supabase/Vercel environment configuration
* never committed

---

# 43. SYNC MODEL

Do not simply replace localStorage calls with Supabase calls.

Add a sync layer.

Conceptually:

```text
DOMAIN
↓
LOCAL REPOSITORY
↓
SYNC OUTBOX
↓
SUPABASE
↓
REMOTE CHANGES
↓
SYNC INBOX
↓
LOCAL REPOSITORY
```

---

# 44. SYNC OUTBOX

When local data changes, queue a sync operation.

Potential record:

```text
operation_id
entity_type
entity_id
operation
local_version
created_at
retry_count
```

Operations must be idempotent.

Network failure should not lose user fitness data.

---

# 45. CONFLICT STRATEGY

Different data requires different conflict rules.

## Append-only events

Examples:

* reward events
* memories
* activity events

Prefer union/idempotent merge.

## User preferences

Latest explicit user edit may win.

## Programme

Requires version/revision handling.

## Health measurements

Never silently overwrite conflicting provenance.

## Mascot permanent progression

Never regress permanent state because an older device syncs later.

---

# 46. CLIENT IDENTIFIERS

Generate stable UUIDs locally where practical.

This lets offline-created data sync without requiring a server round trip first.

Avoid server-only numeric IDs for core offline-created entities.

---

# 47. DELETION

User must eventually be able to:

* delete an activity
* delete a photo
* remove social posts
* leave Crew
* delete account
* remove AI memories
* revoke location sharing

Some historical integrity records may need special handling.

Do not claim something is deleted while secretly retaining identifiable copies indefinitely.

---

# 48. ACCOUNT DELETION

A full deletion workflow must cover:

* Auth user
* profile
* fitness records
* health records
* mascot data
* Journey Wall
* media
* social graph
* Crew membership
* Adventure history where appropriate
* AI memory
* encrypted-message metadata according to messaging design

Public/group records may need anonymisation rather than destructive removal if necessary for other users' shared history.

This requires explicit product/legal design before launch.

---

# 49. LOCATION PRIVACY

Never expose exact home start/end points by default.

Potential route-sharing modes:

* private
* full route
* hidden start/end
* approximate route
* stats only

Temporary Safety Mode location should not automatically become permanent route history.

---

# 50. LIVE LOCATION

Temporary sharing should have:

* explicit recipient
* start time
* automatic expiry
* visible sharing indicator
* manual stop
* minimal retention

Do not silently continue tracking.

---

# 51. AI DATA ACCESS

AI should receive the minimum context necessary for the task.

Do not dump a user's entire database into an LLM prompt.

Use a trusted context builder.

Example:

```text
verified relevant facts
+
allowed companion memory
+
programme boundary
+
current request
```

AI output then returns to the application as interpretation, not truth.

---

# 52. AI MEMORY

Potential:

```text
companion_memories
```

Each memory should have:

* owner
* topic/type
* text/structured value
* created date
* last used
* source
* user-visible flag

User should be able to inspect/delete important memories.

Do not confuse AI memory with immutable fitness history.

---

# 53. AI COST CONTROL

Future AI architecture should support:

* cheap model for routine phrasing
* stronger model only for complex reasoning
* caching
* short context
* deterministic code before AI
* daily/user rate limits where necessary
* optional AI features

Do not call a premium model for every animation or button press.

---

# 54. EDGE FUNCTIONS

Use Supabase Edge Functions for trusted server operations such as:

* competition verification
* privileged reward validation
* social moderation helpers
* secure media processing
* external API integrations
* AI gateway
* notification dispatch
* Adventure verification
* server-owned leaderboards

JWT verification should remain enabled for authenticated functions unless a specific secure exception is intentionally designed.

---

# 55. REALTIME

Use Realtime selectively.

Good candidates:

* Crew Room presence
* reactions
* Crew session state
* messaging envelope delivery
* temporary event state

Poor candidates:

* every heart-rate sample
* raw GPS stream for everyone
* unnecessary live game state

---

# 56. SERVER-SIDE VALIDATION

Anything with public prestige should not trust the client blindly.

Higher validation required for:

* public PBs
* segment records
* prize events
* Secret Prestige
* Adventure Mascots
* Crew event results
* competitive trophies

Private local achievements can be more forgiving where no third party is disadvantaged.

---

# 57. ANTI-CHEAT TIERS

## Tier 1 — Personal

Low-friction.

Used for:

* personal progress
* local celebrations

## Tier 2 — Social

More validation.

Used for:

* friends
* public PBs
* segments
* Adventure sharing

## Tier 3 — Competitive

Strong validation.

Used for:

* rankings
* records
* leagues

## Tier 4 — Prize

Highest validation.

Used where real-world value is awarded.

---

# 58. DATABASE MIGRATIONS

All production schema changes should be tracked as migrations.

Never casually alter production tables manually.

Preferred workflow:

1. specification
2. migration
3. test
4. RLS
5. security advisor
6. performance advisor
7. generated TypeScript types
8. app integration

---

# 59. GENERATED TYPES

After migrations:

Generate Supabase TypeScript types.

Application code should use generated types rather than hand-maintained copies wherever practical.

Do not make Supabase-generated database types replace the pure domain types.

Use mapping boundaries.

---

# 60. DOMAIN / DATABASE SEPARATION

Keep:

```text
NinFit domain types
```

separate from:

```text
Supabase persistence types
```

Create adapters.

Example:

```text
SupabaseActivityRow
↓ mapper
Activity
```

This preserves the current pure-domain architecture.

---

# 61. BACKEND DIRECTORY DIRECTION

Future repo structure could resemble:

```text
src/
  domain/
  data/
    local/
    sync/
    supabase/
  services/
```

Potential:

```text
supabase/
  migrations/
  functions/
```

Exact layout should follow current repository conventions when implementation begins.

---

# 62. FIRST BACKEND MILESTONE

Do NOT implement the entire schema at once.

Recommended first cloud milestone:

## B1 — Auth + Profile Foundation

Implement only:

* Supabase client
* environment variables
* Auth
* private profile
* public profile boundary
* basic user settings
* RLS
* logout
* account identity

No fitness migration yet.

---

# 63. SECOND BACKEND MILESTONE

## B2 — Cloud Backup / Sync Foundation

Implement:

* sync metadata
* outbox
* device IDs
* conflict framework
* cloud backup
* restore

Prove sync safely with a small subset of state.

---

# 64. THIRD BACKEND MILESTONE

## B3 — Fitness Sync

Add:

* programme
* sessions
* activities
* reward evidence

Preserve local-first operation.

---

# 65. FOURTH BACKEND MILESTONE

## B4 — Mascot Cloud State

Add:

* mascots
* passports
* memories
* Legacy
* trophies

---

# 66. FIFTH BACKEND MILESTONE

## B5 — Social Foundation

Add:

* friendships
* visibility
* Journey Profile
* reactions

---

# 67. SIXTH BACKEND MILESTONE

## B6 — Crews

Add:

* Crew identity
* membership
* sessions
* Crew relics
* temporary Realtime state

---

# 68. SEVENTH BACKEND MILESTONE

## B7 — Adventures

Add:

* regions
* Adventures
* routes
* verification
* completions
* Adventure Vault

---

# 69. EIGHTH BACKEND MILESTONE

## B8 — Segments / Competition

Add:

* segments
* attempts
* PBs
* leaderboards
* historical records

---

# 70. NINTH BACKEND MILESTONE

## B9 — Secure Messaging

Do not begin until a dedicated E2EE security design is approved.

---

# 71. TENTH BACKEND MILESTONE

## B10 — AI Platform

Add:

* trusted AI context builder
* AI memory
* AI gateway
* usage controls
* auditing/provenance
* model fallback

---

# 72. SECURITY RULES

Never:

* expose service-role credentials
* disable RLS on user tables without a very specific reason
* trust client-supplied ownership IDs
* trust client-supplied public achievement state
* store plaintext E2EE messages
* publish precise location by default
* allow AI to modify trusted fitness truth directly

---

# 73. INITIAL SUPABASE ENVIRONMENT

Frontend environment variables should eventually use:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Do not use:

```text
VITE_SUPABASE_SERVICE_ROLE_KEY
```

There should never be a service-role secret in the Vite/browser bundle.

---

# 74. CURRENT IMPLEMENTATION STATUS

Supabase project exists.

No NinFit production schema has been applied yet.

No application integration has been authorised yet.

This is intentional.

Current work remains focused on the mascot/game roadmap.

The backend project is being prepared ahead of the future account/cloud milestone.

---

# 75. FINAL BACKEND PRINCIPLE

NinFit should not become:

> a cloud app that stops working when the cloud disappears.

It should become:

> **a resilient local-first fitness app whose cloud layer adds continuity, community and intelligence.**

Fitness truth remains authoritative.

Game progression remains deterministic.

AI remains bounded.

Social remains optional.

Privacy remains the default.

Human control remains final.
