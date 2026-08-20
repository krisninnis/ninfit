NinFit — Product & Development Roadmap

Version:
2026-08-20

Working brand:
NinFit

NIN:
Next · Improvement · Now

Brand philosophy:
Move · Grow · Evolve


==================================================
NORTH-STAR PRODUCT RULE
==================================================

FITNESS IS THE PRODUCT.

THE GAME IS THE EMOTIONAL REINFORCEMENT LAYER.

Fitness data is the truth layer.

The programme helps the user decide what to do.

The game celebrates trusted fitness behaviour and progress.

The mascot makes the journey feel alive.

The user remains in control.


==================================================
CORE PRODUCT PRINCIPLES
==================================================

- Personal progress first
- Social competition optional
- Food informative, not moral
- Calories burned are estimates
- App proposes, user decides
- Calm by default
- Energy and celebration are earned
- Reward behaviour, not just outcomes
- Partial completion counts
- Rest is part of the programme
- No guilt
- No punishment
- No broken-streak pressure
- No red generic failure states
- Health data private by default
- Cosmetics never affect fitness progression
- No pay-to-win
- No paid loot boxes
- No paid random eggs
- Curiosity is rewarded alongside consistency
- Game mechanics must never falsify fitness truth
- Mascots encourage rather than shame
- Missing data remains missing
- Never fabricate activity completion
- Never fabricate PBs
- Never fabricate XP
- Never fabricate trophies
- Never fabricate progression
- Never fabricate rewards
- Never diagnose
- Preserve provenance
- Permanent mascot progress is never removed because of inactivity
- Mascots never die, starve or become sad because exercise was missed
- Sustainable activity must beat overtraining
- Rest, recovery, illness, holidays and life interruptions are not failure
- The user can always return

Preferred return language:

“Good to see you.”

Core emotional rule:

NinFit rewards showing up.

It never punishes being human.


==================================================
PRODUCT ARCHITECTURE PRINCIPLES
==================================================

NinFit consists of four conceptual layers:

1. FITNESS TRUTH
2. PROGRAMME / COACHING
3. GAME / COLLECTION
4. SOCIAL

Fitness truth is authoritative.

Programme logic may propose actions.

The user decides whether to accept them.

Game systems consume trusted fitness/programme outcomes.

Game systems never modify fitness truth to manufacture rewards.

Social systems are optional and must never be required to use
the core fitness product.

Mascots are presentation/relationship characters.

Mascots do not own domain logic.

Architecture:

Domain
↓
Programme / Game State
↓
Presentation State
↓
Mascot / UI

AI principle:

RULES DETERMINE REALITY.

AI MAKES REALITY FEEL PERSONAL.


==================================================
CURRENT REPOSITORY STATUS — AUGUST 2026
==================================================

Current main foundation includes:

- Vite + React + TypeScript
- local-first architecture
- pure domain layer
- localStorage repository
- Today
- Week
- Progress
- Profile
- Data
- JSON backup/import
- CSV export
- schema/version handling
- corruption/quarantine handling
- adaptive onboarding
- five fitness paths
- Mystery Egg
- XP
- overall levels
- five skills
- trophy framework
- mascot state
- hatch state
- game settings
- social/privacy settings foundation
- sound/haptic settings foundation
- per-activity completion
- rest-day acknowledgement
- reward idempotency
- CSS token system
- dark mode
- reduced motion
- card taxonomy
- attention accessibility
- responsive desktop shell
- optional NinFit ID journey
- Supabase authentication boundary
- email confirmation flow
- startup cinematic
- Opal presentation foundation
- five-path mascot architecture separation
- central NinFit background registry
- 17 production world regions
- 34 production mobile/desktop background assets
- background accessibility rules
- reduced-data behaviour
- lazy page-background loading
- production background asset budgets

Merged foundation commit:

54dc070
Merge pull request #1
Build NinFit world, account journey and production backgrounds

Current development branch:

phase6/today-home-redesign-v1


==================================================
CURRENT TECHNICAL HOUSEKEEPING
==================================================

Before progressing significantly beyond the current Phase 6 slice:

1. Finish the current Today/Home vertical slice.
2. Fix deployment health.
3. Resolve repository line-ending hygiene separately.
4. Verify the branch cleanly.
5. Commit only scoped semantic changes.

Deployment-health issues identified during the Phase 6 maintenance pass were resolved and browser-verified on 20 August 2026:

- Supabase public frontend environment configuration present
- modern mobile-web-app-capable metadata present
- missing favicon/background requests resolved
- fresh production deployment loaded with a clean browser console

Do not expose privileged Supabase credentials.

VITE_SUPABASE_URL and the public anonymous/publishable key are
frontend configuration.

Privileged/service-role credentials must never enter client code.


==================================================
CURRENT FITNESS PATHS
==================================================

1. Start Moving
2. Build Strength
3. Build Stamina
4. Balanced Fitness
5. Return to Fitness


==================================================
SKILLS
==================================================

- Strength
- Stamina
- Mobility
- Consistency
- Recovery


==================================================
CORE PATH MASCOT ARCHITECTURE — LOCKED
==================================================

Exactly five path mascot families:

Start Moving
→ Tortoise

Build Strength
→ Bear

Build Stamina
→ Fox

Balanced Fitness
→ Otter

Return to Fitness
→ Wolf

This set is CLOSED.

A sixth path mascot requires a sixth fitness path.

All five families have equal gameplay status.

No species provides a fitness advantage.


==================================================
OPAL ARCHITECTURE — LOCKED
==================================================

Opal is NOT one of the five fitness-path mascots.

Opal is the universal NinFit companion / guide.

Every user has Opal.

Opal is:

- not selected
- not earned
- not hatched
- not a fitness path
- not part of MascotFamilyId
- not the user's evolving path creature

Opal roles:

1. Onboarding Guide
2. Account Setup Guide
3. NinFit Assistant
4. Fitness Coach interface
5. Achievement Companion
6. Celebration character
7. Recovery/return companion
8. Monthly Drop guide
9. Game-system explainer
10. Secret/easter-egg hint character where appropriate

The user's PATH MASCOT owns the emotional progression journey:

MYSTERY EGG
↓
HATCH
↓
GROWTH
↓
EVOLUTION
↓
CHAMPION
↓
LEGACY

Opal does NOT replace this journey.

On Today:

- path mascot / Mystery Egg represents the user's fitness journey
- Opal may appear contextually
- Opal should not compete permanently for equal visual dominance
- Opal speaks/guides
- the path mascot grows with the user

Do not introduce two giant permanent character cards on mobile.


==================================================
MYSTERY EGG — LOCKED
==================================================

The Mystery Egg contains the user's future path mascot.

Before hatch:

- universal
- path-neutral visually
- species secret
- no silhouette leak
- no animal clues
- no colour-based species leak

Hatch remains explicit.

No automatic hatch.

Permanent hatch/progression truth belongs in deterministic game logic.

Presentation crack progress may be derived.

The egg may use premium iridescent/opalescent visual treatment,
but it is not Opal the companion.


--------------------------------------------------
HATCH TRIGGER — LOCKED (SUPERSEDES THE EARLIER RULE)
--------------------------------------------------

Hatching is the emotional payoff for COMPLETING ONBOARDING
and choosing a path.

It is NOT earned with activity.

There is no six-qualifying-day requirement, and no waiting
period before a user meets their companion.

First-run journey:

START NINFIT
-> MYSTERY EGG
-> ONBOARDING QUESTIONS
-> CRACK 1
-> CRACK 2
-> CRACK 3
-> PATH RECOMMENDATION
-> USER ACCEPTS OR CHOOSES ANOTHER PATH
-> START MY JOURNEY
-> HATCH CINEMATIC
-> STARTER MASCOT REVEAL
-> OPTIONAL NINFIT ID
-> TODAY
-> REAL FITNESS EARNS GROWTH / XP / EVOLUTION

Rules:

- onboarding progress drives the presentation cracking
- crack progress is derived from questionnaire progress only,
  never from awarded reward keys or activity
- crack progress is presentation and is never persisted
- the FINAL chosen path determines the hidden mascot family
- the recommendation may be overridden, and overriding is
  a first-class outcome
- the species stays hidden until the real hatch transition
- one explicit action, "Start my journey", begins the hatch
- exactly one real hatch mutation performs the transition
- hatching grants no XP, no PB, no trophy, no consistency
  and no fabricated activity

After hatch:

REAL FITNESS drives XP, growth, evolution, Champion and Legacy.

Migration and recovery:

Onboarding complete plus an unhatched egg means the egg is ready.

One deterministic rule serves the new flow and rescues any
save that completed onboarding under the old activity-earned
rule, so nobody is left holding an egg that can never open.

Re-running onboarding never resets an existing mascot, its
stage, its XP or its evolution.


==================================================
PHASE 3 — TYPOGRAPHY + RESPONSIVE LAYOUT
STATUS: COMPLETE / FOUNDATION SHIPPED
==================================================

Goal:
Turn the existing mobile prototype into a polished responsive application.

Implemented direction:

- formal typography roles
- Display
- Title
- Heading
- Body
- Body Strong
- Small
- Caption
- Stat
- tabular numeric values
- improved vertical rhythm
- responsive gutters
- small-phone support
- tablet support
- desktop support
- landscape-safe behaviour

Reference sizes:

- small phone: ~360px
- standard phone: 390–430px
- tablet: 600–899px
- desktop: 900px+

Do not add a custom font without a later deliberate brand decision.


==================================================
PHASE 3A — DESKTOP APPLICATION EXPERIENCE
STATUS: FOUNDATION COMPLETE
==================================================

Goal:
Make desktop deliberate rather than a stretched phone.

Implemented foundation:

- persistent desktop navigation
- shared tab/navigation truth
- bounded reading column
- mobile bottom navigation retained
- responsive composition
- desktop shell

Future desktop expansion may include:

- dashboard overview
- mascot presentation region
- Today summary
- Week summary
- Progress summary
- Trophy Vault access
- Shop access
- Adventures access
- Zen access
- account/settings access

Desktop and mobile share:

- domain
- data
- business logic
- visual language
- accessibility
- game systems

They may differ in:

- composition
- navigation
- information density
- decorative presentation

Never simply stretch mobile UI across desktop.


==================================================
PHASE 4 — NINFIT THEME ENGINE
STATUS: SUBSTANTIALLY COMPLETE
==================================================

Theme hierarchy:

1. Default NinFit
2. Fitness path
3. future mascot-specific presentation
4. future environment/cosmetic presentation

Default startup:
Neutral premium NinFit.

Do not reveal species before hatch.

Path accents:

Start Moving
- warm soft green

Build Strength
- deep terracotta / rust

Build Stamina
- energetic cyan-blue

Balanced Fitness
- teal / turquoise

Return to Fitness
- deep indigo / purple

Requirements:

- OKLCH
- light mode
- dark mode
- greyscale
- colour-vision separation
- attention amber remains semantically separate

Attention always uses:

- icon
- wording
- colour


==================================================
PHASE 5 — ONBOARDING VISUAL JOURNEY
STATUS: SUBSTANTIALLY COMPLETE
==================================================

Journey:

1. Mystery Egg
2. progress indicator
3. one dominant question
4. short supporting copy
5. large answer cards
6. Back / Continue

Recommendation:

- recommended path
- why
- starting stage
- Start this path
- See other paths
- user override

Mobile-first.


==================================================
PHASE 5A — NINFIT ID / ACCOUNT ENTRY
STATUS: IMPLEMENTED — DEPLOYMENT HEALTH VERIFIED
==================================================

NinFit works without an account.

Preferred journey:

ONBOARDING
↓
MYSTERY EGG
↓
PATH RECOMMENDATION
↓
START NINFIT
↓
NINFIT ID DECISION
↓
CREATE / SIGN IN / SKIP
↓
TODAY

Current foundation includes:

- email/password
- confirmation flow
- password confirmation
- visibility controls
- resend state
- sign-in after confirmation
- service boundary
- optional account flow

Future providers:

- Google
- Apple
- validated equivalents

Account may later enable:

- cloud backup
- multi-device continuity
- social identity
- friends
- public profile
- cloud features

Never imply fitness data is cloud-synchronised before explicit
sync exists.

DEPLOYMENT STATUS:

The deployed account journey passed the Phase 6 browser-health check
after the Vercel/public environment configuration fixes.


==================================================
PHASE 5B — OPAL AS NINFIT COMPANION
STATUS: PRESENTATION FOUNDATION BUILT
==================================================

Opal is the friendly NinFit guide.

Opal may explain:

- onboarding
- account options
- navigation
- daily plans
- achievements
- trophies
- game systems
- challenges
- monthly drops
- settings
- recovery/return

Opal must not:

- own business logic
- fabricate data
- diagnose
- silently modify programmes
- shame
- create mandatory maintenance

AI assistance must:

- be transparent
- preserve user control
- distinguish suggestion from fact
- consume trusted app data
- remain bounded


==================================================
PHASE 6 — TODAY / HOME REDESIGN
STATUS: ACTIVE CURRENT WORKSTREAM
==================================================

Goal:
Create the core daily NinFit experience.

Core rule:

E WITH A AS THE BACKBONE.

The experience may combine:

- fitness
- mascot
- progress
- rewards
- world

but TODAY'S REAL FITNESS ACTION is the backbone.

Desired loop:

OPEN NINFIT
↓
UNDERSTAND TODAY'S ACTION
↓
MASCOT / OPAL PROVIDES EMOTIONAL CONTEXT
↓
DO REAL ACTIVITY
↓
TRUSTED FITNESS RECORD
↓
REWARD / PROGRESS
↓
SHORT CELEBRATION
↓
RETURN TO CALM HOME


Hierarchy:

1. Mystery Egg / path mascot
2. Overall Level + XP
3. short contextual message
4. Today's workout
5. Quick Check-In
6. collapsible tracking

Today's workout:
PRIMARY ACTION.

Mascot:
Emotional hook, but not more important than the workout.

Quick Check-In:
Only when useful/relevant.

Possible chips:

- Energy
- Water
- Steps
- Back

Tracking:

Default open where appropriate:

- Exercise/how it went
- Back & symptoms

Default collapsed:

- Food
- Water
- Sleep/recovery

NO DAILY COMPLETION SCORE.

Remove presentation such as:

“N of M sections recorded”

if it implies the user's day has been graded.


--------------------------------------------------
PHASE 6 — CONTEXTUAL COMPANION MESSAGE
--------------------------------------------------

Context should derive from trusted domain/game state.

Possible contexts include:

- normal day
- session complete
- partial complete
- rest day
- returning
- trophy
- level-up
- evolution-ready
- other verified events

Screen components should not invent game truth.

Presentation consumes context.

Meaningful outcome should generally outrank absence messaging.

Example:

A returning user who completed today's session should primarily be
celebrated for today's session.


==================================================
PHASE 6A — NINFIT WORLD / PAGE ARCHITECTURE
STATUS: ARCHITECTURE + BACKGROUND FOUNDATION AHEAD OF PLAN
==================================================

Purposeful destinations:

Core:

- Today
- Week
- Progress
- Adventures
- Challenges
- Trophy Vault
- Companion / Mascot
- Shop
- Journey Wall
- Crews
- Profile
- Settings
- Data

Fitness worlds:

- Flow
- Zen Zone
- Trail
- Forge
- Pulse
- Flex Lab

Background architecture is already implemented.

17 production regions currently exist:

- Today
- Week
- Progress
- Adventures
- Zen
- Flow
- Trail
- Forge
- Pulse
- Flex
- Trophy Vault
- Shop
- Journey Wall
- Crews
- Profile
- Settings
- Data

Onboarding remains separate.

All 17 regions currently have:

- mobile art
- desktop art
- central registry wiring
- focal/crop rules
- veil/readability treatment
- lazy loading
- reduced-data handling

Current production target:

- mobile 1080 × 1920
- desktop 2880 × 1620
- ≤250 KB per production WebP

Do NOT regenerate this background set merely because Phase 12
still exists.

Future page work should build FUNCTIONAL DESTINATIONS on top of
the established world architecture.


==================================================
PHASE 7 — WEEK / PROGRESS / PROFILE / DATA POLISH
STATUS: FUTURE
==================================================

Week:

- practical day cards remain
- light seven-day journey trail
- complete
- partial
- today
- rest
- future
- mascot may move along trail
- trail remains secondary to records

Progress:

Data first.

Then:

- meaningful PB area
- milestone highlights
- recent trophies

Profile:

1. You
2. Your Programme
3. Where You Started
4. Your Notes
5. Game
6. Settings

Data:

Calm and trustworthy.

Priorities:

- backup
- import
- privacy
- provenance
- data durability

Avoid unnecessary game decoration.


==================================================
PHASE 8 — REWARD PRESENTATION + MOTION
STATUS: FUTURE — PRODUCT DIRECTION EXPANDED
==================================================

Goal:
Deliver dopamine without turning NinFit into an arcade.

Reward intensity is graduated.

NORMAL ACTIVITY:

- satisfying tick
- short completion response
- XP/progress movement
- small mascot reaction
- inspirational line
- occasional surprise cosmetic/material reward

MEDIUM:

- trophy
- PB
- level-up
- challenge completion
- consistency milestone

MAJOR:

- hatch
- evolution
- Champion
- Gold/Platinum trophy
- major Adventure
- Secret Prestige discovery
- major yearly achievement

Motion levels:

- instant
- standard
- reward
- cinematic

Rule:

REWARD FREQUENCY CAN BE HIGH.

REWARD INTENSITY MUST BE GRADUATED.

Do not fire maximum celebration for ordinary activity.

Respect reduced motion.

Sound/haptics optional.


==================================================
PHASE 8A — INSPIRATIONAL QUOTE SYSTEM
STATUS: FUTURE — LOCKED DIRECTION
==================================================

Ordinary completions may surface a short inspirational line.

Quote mix:

- mostly original NinFit writing
- small curated collection of famous attributed quotes
- famous quotes reserved for meaningful moments

Tone:

- short
- grounded
- encouraging
- never preachy
- never guilt-based

Context examples:

ordinary session
→ showing up

PB
→ growth

return after difficulty
→ resilience

planned rest
→ recovery is training too

Special milestone quotes:

- automatically become Journey memories where appropriate

Any ordinary quote:

- user may choose “Keep this”

Kept quotes may later appear in:

- Journey Wall
- Trophy Room
- mascot memories

Avoid excessive repetition.


==================================================
PHASE 9 — NINFIT BRAND FOUNDATION
STATUS: FUTURE LEGAL / MARKET VALIDATION
==================================================

Working brand:
NinFit

NIN:
Next · Improvement · Now

Potential tagline:
Move · Grow · Evolve

Brand character:
70% serious
30% playful

Before final public lock:

- UK trademark search
- international trademark research
- Companies House
- App Store
- Google Play
- domains
- competing software/fitness brands


==================================================
PHASE 10 — MASCOT ART PIPELINE
STATUS: READY FOR CONTROLLED PRODUCTION PASS
==================================================

Goal:
Create canonical production characters, not random AI images.

Art direction:

- premium 2D / 2.5D
- expressive
- stylised middle ground
- strong silhouette
- polished creature-game quality
- adult enough for a fitness product
- not photorealistic
- not excessively chibi

Path mascot evolution:

Cute / young-capable
↓
Confident
↓
Adventurous
↓
Athletic
↓
Elite
↓
Legendary / Champion

Core species:

- Tortoise
- Bear
- Fox
- Otter
- Wolf

Same creature identity throughout progression.

Personality matures slightly but remains recognisable.

IMPORTANT:

DO NOT GENERATE ALL FAMILIES BLINDLY.

Prove one complete family pipeline first.

Suggested first path family:

Tortoise

Then:

- Bear
- Fox
- Otter
- Wolf

Use Gemini or another validated generation tool as an ART SOURCE,
not as the production naming/architecture system.

Generated artwork remains reference/source until:

- reviewed
- visually approved
- converted
- named canonically
- placed in stable production paths
- tested in actual UI


--------------------------------------------------
CANONICAL PATH MASCOT SHEET
--------------------------------------------------

Each canonical species/stage system should cover:

- front
- 3/4
- side
- back
- silhouette
- palette
- proportions
- eye/face language
- idle
- happy
- excited
- determined
- tired
- sleepy
- encouraging
- surprised
- proud
- celebration
- resting
- return-after-absence
- PB reaction
- trophy reaction
- level-up
- evolution
- secret discovery
- cosmetic attachment points
- pickup/drag pose
- drop/settle pose

Do not attempt species × stages × conditions × all activities ×
all cosmetics as baked independent images if a reusable rig/layer
strategy can avoid the combinatorial explosion.


==================================================
PHASE 10A — OPAL CANONICAL CHARACTER
STATUS: FUTURE PRODUCTION ART
==================================================

Goal:
Establish Opal's definitive visual identity.

IMPORTANT CORRECTION:

Opal does NOT hatch or evolve through the user's path journey.

Remove the old concept:

Egg
→ Hatchling
→ Explorer
→ Adventurer
→ Champion
→ Legend

That progression belongs conceptually to path mascots, not Opal.

Opal should instead have a stable canonical identity with:

- silhouette
- proportions
- face language
- eye style
- material/rendering style
- colour language
- crystal/gem identity
- expression language
- pose language
- cosmetic attachment system

Opal may have:

- presentation variants
- outfits
- poses
- seasonal forms
- approved special effects
- contextual states

but Opal does not compete with the user's path mascot for the
egg-to-Champion journey.


==================================================
PHASE 10B — MASCOT CONDITION SYSTEM
STATUS: FUTURE
==================================================

Condition is TEMPORARY.

Progression is PERMANENT.

Permanent:

- XP
- level
- evolution/stage
- trophies
- unlocks
- cosmetics
- Champion
- Legacy
- Prestige

Temporary:

- condition
- energy
- presentation state

Possible condition ladder:

1. Energetic
2. Active
3. Normal
4. Low Energy
5. Sleepy
6. Lounging
7. Sofa Sleep

Condition must NEVER:

- remove XP
- remove levels
- remove trophies
- remove cosmetics
- punish absence
- shame
- diagnose
- create pet-care chores

A high-level mascot may temporarily look sleepy.

Its permanent achievements remain.


==================================================
PHASE 10C — MASCOT EXPRESSIONS + DIRECT INTERACTION
STATUS: FUTURE — EXPANDED
==================================================

Canonical reaction set:

- idle
- happy
- excited
- determined
- tired
- sleepy
- encouraging
- surprised
- proud
- celebrating
- resting
- returning
- PB
- trophy
- level-up
- evolution
- secret discovery

Event triggers:

- workout complete
- partial completion
- rest
- PB
- trophy
- level-up
- challenge
- programme progression
- return after absence
- evolution
- secret discovery


--------------------------------------------------
DIRECT MASCOT INTERACTION — LOCKED DIRECTION
--------------------------------------------------

Mobile:

- touch-and-hold to pick up mascot
- drag within safe screen area
- dedicated pickup/holding-on pose
- mascot visually braces, grips, hangs or reacts while carried
- release to settle

Desktop:

- pointer/click-and-hold
- drag
- same pickup state
- release to settle

Species may react differently.

Examples:

Tortoise:
- retracts/braces slightly

Bear:
- paws tuck/grip

Fox:
- braces paws

Otter:
- playful hanging pose

Wolf:
- surprised but confident hold

Rules:

- dragging earns no XP
- no grind reward
- does not affect fitness truth
- mascot cannot permanently obstruct critical UI
- unsafe placement snaps/settles to nearest safe area
- position may be remembered by device/layout
- resize/orientation must recalculate safe bounds
- reduced motion receives simplified transitions
- keyboard/accessibility alternative required

Accessible movement may include:

Move mascot:
- Home
- Top left
- Top right
- Bottom left
- Bottom right


--------------------------------------------------
MINIMISE → HOME
--------------------------------------------------

Mascot should not simply disappear.

Minimise sends the mascot visually back to its habitat/home.

Possible sequence:

mascot shrinks / moves away
↓
returns to home
↓
home remains subtle part of world
↓
user may bring mascot back

Default behaviour on small screens should remain calm.

Mascot should not float over the interface continuously unless
the user wants it.


==================================================
PHASE 10D — SECRET MASCOTS + SECRET FORMS
STATUS: FUTURE
==================================================

Goal:
Reward curiosity.

Possible categories:

- secret mascots
- secret path forms
- alternate forms
- event characters
- Easter-egg characters
- ultra-rare discoveries

Some remain completely unknown until discovered.

Unlock methods may include:

- unusual achievement combinations
- exploration
- hidden interactions
- special challenges
- events
- milestone combinations
- Easter eggs
- harmless secret codes

Secret content:

- cosmetic/collectible
- no fitness advantage

Exact formulas may remain hidden.


==================================================
PHASE 10E — COMPANION / MASCOT COLLECTION
STATUS: FUTURE
==================================================

Collection may display:

- path mascot stages
- discovered characters
- secret forms
- cosmetics
- accessories
- environments
- poses
- animations

Undiscovered:

???
Mystery silhouette
Locked

Do not reveal every secret unlock condition.

Opal remains universal NinFit guide even as collections expand.


==================================================
PHASE 10F — MASCOT HOME / HABITAT
STATUS: FUTURE — EXPANDED
==================================================

Goal:
Give the mascot somewhere to belong without building a virtual-pet chore system.

Each species may have a themed home.

Examples:

Tortoise
- garden / stone nook

Bear
- woodland den

Fox
- warm burrow

Otter
- waterside nook

Wolf
- mountain shelter

Habitat can display:

- earned decorations
- favourite objects
- keepsakes
- Champion Relics
- memories
- seasonal details
- Legacy visitors

Habitat interactions remain optional.

No:

- feeding meter
- cleaning
- happiness bar
- compulsory daily care
- punishment

AI may later select among APPROVED habitat states.

AI cannot invent permanent rewards.


==================================================
PHASE 10G — CHAMPION + LIVING LEGACY
STATUS: FUTURE — LOCKED DIRECTION
==================================================

Major long-term mascot milestone:

CHAMPION

Champion Ceremony should include:

- journey recap
- Champion reveal
- permanent trophy
- passport/history record
- Legacy attendance where available
- time to enjoy Champion before any later evolution/transition

Each Champion leaves:

CHAMPION RELIC

Champion Relic is:

- personalised
- earned
- permanent
- not purchasable

Living Legacy:

- previous Champions may visit
- previous Champions may be invited
- Legacy interactions remain lightweight
- memories persist
- current mascot remains central


==================================================
PHASE 10H — SECRET PRESTIGE
STATUS: FUTURE — LOCKED DIRECTION
==================================================

Secret Prestige is achievement-only.

Never purchasable.

Possible presentation:

- Opal-like markings
- capes
- wings
- aura
- species-specific effects

Before first discovery:

- rumours
- hints
- mystery

After discovery:

- Passport section may reveal system existence

Exact formula remains hidden.

Prestige may secretly consider broad journey patterns including:

- performance
- consistency
- resilience
- exploration
- personal improvement
- long-term behaviour

Different species may value different genuine achievement patterns.

No single visible grind counter.

No fake fitness.

No purchased shortcut.


==================================================
PHASE 11 — TROPHY + COSMETIC SYSTEM
STATUS: FUTURE
==================================================

Trophy tiers:

- Bronze
- Silver
- Gold
- Platinum

Categories may include:

- Activity
- Consistency
- Stamina
- Strength
- Mobility
- Recovery
- Exploration
- PB
- Mascot
- Challenge
- Monthly
- Yearly
- Special/Event
- Secret
- Resilience

Trophy visibility:

- Private
- Friends
- Public

Founding-user possibilities:

- Founding User trophy
- cosmetic
- profile emblem

Cosmetics remain visual.

Never:

- XP boost
- progression boost
- rarity boost
- Prestige shortcut
- fitness advantage


==================================================
PHASE 11A — COLLECTION + REWARD ECONOMY
STATUS: FUTURE — PRODUCT RULES LOCKED
==================================================

Reward formula:

GUARANTEED PROGRESS
+
OCCASIONAL SURPRISE

Every legitimate activity should reliably produce appropriate
progress.

Surprise layer is extra excitement.

Surprise rewards should generally be influenced by the activity.

Examples:

walking/hiking
→ Trail pool

mobility/yoga
→ Flow / Zen / Flex-related pool

strength
→ Forge pool

cardio
→ Pulse pool

Surprise rewards may include:

- cosmetics
- materials
- seeds
- postcards
- keepsakes
- habitat decorations
- Journey objects
- poses
- animations
- harmless secrets


--------------------------------------------------
RARITY
--------------------------------------------------

Normal rewards:

- simple rarity may be visible
- visual treatment may indicate significance

Secret / Prestige:

- intentionally mysterious
- may not reveal rarity or conditions until discovered

Avoid loud loot-game presentation.


--------------------------------------------------
DUPLICATES
--------------------------------------------------

Unique rewards generally leave the drop pool once owned.

Repeatable categories may include:

- materials
- seeds
- postcards
- seasonal keepsakes
- logical consumable game-layer resources

Do not repeatedly award the same rare cosmetic as filler.


--------------------------------------------------
MAIN CURRENCY
--------------------------------------------------

Use one understandable soft currency.

Earn through genuine:

- activity
- milestones
- achievements
- challenges
- exploration

Also support non-currency collectible materials.

Do not build five confusing path wallets.


--------------------------------------------------
SHOP
--------------------------------------------------

Shop may eventually contain:

- mascot cosmetics
- outfits
- accessories
- Trophy Room decorations
- habitat decorations
- Journey Wall frames
- profile cosmetics
- environmental objects
- presentation animations
- cosmetic effects
- saved presets
- convenience/display options

Some Shop inventory may require an achievement/discovery before
becoming available.

Rotation is allowed.

PERMANENT FOMO IS NOT.

Rotated items should generally return.

Shop items may improve:

- presentation
- personalisation
- convenience

They must not improve:

- XP rate
- rarity odds
- evolution speed
- PB reward
- Prestige
- fitness progression
- leaderboard performance


--------------------------------------------------
REAL-MONEY MONETISATION
--------------------------------------------------

At launch:

DO NOT SELL SOFT CURRENCY.

Do not add real-money currency yet.

Revisit monetisation later when the mature product has evidence
about what users value.

Never sell:

- Secret Prestige
- Champion Relics
- genuine achievement trophies
- fitness records
- PBs
- progression


==================================================
PHASE 11B — 1-UP SYSTEM
STATUS: FUTURE
==================================================

1-Ups are game-layer only.

Possible uses:

- retry optional game challenge
- protect optional game opportunity
- playful bonus interaction
- event interaction

Never:

- alter fitness records
- fake activity
- bypass safety
- manipulate leaderboard
- create paid competitive advantage


==================================================
PHASE 11C — SECRET CODES / CHEAT SYSTEM
STATUS: FUTURE
==================================================

Old-school fun is allowed.

Possible effects:

- Retro Mode
- visual effects
- secret animations
- cosmetics
- hidden rooms
- alternate UI
- jokes
- dialogue
- harmless character forms

Secret Room / Cheat Console may eventually exist.

Cheats never:

- fake fitness
- grant PB
- grant trophies dishonestly
- bypass health rules
- manipulate rankings
- grant Prestige dishonestly
- grant Champion dishonestly


==================================================
PHASE 11D — TROPHY VAULT
STATUS: FUTURE
==================================================

Goal:
Create a living collection room rather than a static badge list.

Support:

- Bronze
- Silver
- Gold
- Platinum
- locked
- secret
- new
- rarity where appropriate

Mascot may appear.

User can feature trophies.

Profile showcase may contain:

- main mascot
- outfit
- environment
- three featured trophies

Long term:

LIVING TROPHY ROOM

It develops through achievement.

Major accomplishments may unlock:

- displays
- alcoves
- walls
- spaces
- PB areas
- Legacy areas
- Secret Prestige areas

It should feel like:

a personal NinFit clubhouse built by years of showing up.


==================================================
PHASE 12 — ART / ENVIRONMENT PIPELINE
STATUS: BACKGROUND FOUNDATION COMPLETE
==================================================

The original environment/background objective is substantially complete.

Existing production world:

17 regions
34 responsive WebPs
central registry
accessibility veils
focal points
lazy loading
reduced-data handling
asset budgets

Do not redo them without a clear art-direction reason.

Future Phase 12 work includes:

- seasonal variants
- habitat scenes
- character/environment integration
- event scenes
- animated environmental details
- additional functional destination art

Visual language:

- premium
- polished
- painterly / high-quality 2.5D
- colourful
- atmospheric
- friendly
- adventurous
- sophisticated
- cinematic
- not childish

Backgrounds contain:

- no baked UI
- no buttons
- no headings
- no fake stats
- no mascot identity
- no path truth


==================================================
PHASE 12A — VISUAL ASSET PIPELINE
STATUS: ACTIVE PRINCIPLE / FUTURE EXPANSION
==================================================

Asset categories:

- mascots
- mascot stages
- expressions
- animations
- trophies
- emblems
- cosmetics
- capes
- 1-Ups
- environments
- effects
- event art
- decorative UI

Generated AI artwork is SOURCE MATERIAL until approved.

Canonical asset requirements:

- stable ID
- stable filename
- asset category
- intended use
- rarity if applicable
- unlock source
- light/dark requirements
- responsive requirements
- accessibility requirements
- production size/performance requirement

Never build runtime logic around random Gemini filenames.


==================================================
PHASE 13 — PWA + INSTALLABILITY
STATUS: FUTURE
==================================================

Goal:
Proper installable mobile web app.

Implement:

- manifest
- icons
- splash behaviour
- offline shell
- safe updates
- installability
- production deployment
- offline-safe local tracking
- modern mobile-web-app-capable metadata

Verify:

- Android
- iPhone/PWA
- desktop
- offline
- durability communication


==================================================
PHASE 14 — REMINDERS
STATUS: FUTURE
==================================================

User-controlled.

Hydration:

- Fixed
- Smart
- Off

Meals:

- Fixed
- Smart
- Off

Later:

- Workout
- Recovery
- Measurement

Good:

“Fancy some water?”

“Have you eaten yet?”

Bad:

“You are behind.”

“You missed lunch.”


==================================================
PHASE 15 — CAPACITOR / NATIVE FOUNDATION
STATUS: FUTURE
==================================================

Wrap existing Vite/React app.

Preserve:

- domain
- UI
- game system
- persistence boundaries
- tests

Gain:

- Health Connect
- HealthKit
- sensors
- background health access
- notifications
- camera
- GPS/background location


==================================================
PHASE 16 — WEARABLE + HEALTH INTEGRATIONS
STATUS: FUTURE
==================================================

Android first.

Health Connect where appropriate.

Then HealthKit.

Possible imports:

- steps
- heart rate
- resting HR
- HRV
- sleep
- workouts
- distance
- active minutes

Manual remains supported.

Every sample retains provenance:

- manual
- phone
- Health Connect
- HealthKit
- wearable
- imported

Never silently overwrite manual truth.


==================================================
PHASE 17 — GPS ACTIVITY RECORDER
STATUS: FUTURE
==================================================

Activities:

- Walk
- Run
- Cycle
- Hike

Live priority:

1. Timer
2. Distance
3. Pace/speed
4. Map
5. Heart rate where available

Controls:

- Pause
- Resume
- Finish

Route private by default.

Share options:

- Full
- Hide start/end
- Approximate
- Stats only


==================================================
PHASE 18 — PERSONAL BEST ENGINE
STATUS: FUTURE
==================================================

Primary competitive principle:

YOU VS YOU.

PB examples:

- fastest 1 km
- fastest 5 km
- longest walk
- longest run
- longest ride
- repeated segment
- strength milestones where valid

Never create PBs for inappropriate health metrics such as:

- pain
- high HR
- poor sleep

Celebration intensity scales to significance.


==================================================
PHASE 19 — ESTIMATED ENERGY
STATUS: FUTURE
==================================================

Use:

“Estimated active calories”

Never present as exact.

Do not automatically convert activity calories into permission to eat.

Visibility:

- Prominent
- Secondary
- Hidden


==================================================
PHASE 20 — FOOD SCANNER
STATUS: FUTURE
==================================================

Goal:
Convenient food information without moral scoring.

Possible provider:
Open Food Facts or validated equivalent.

Show:

- Protein
- Fibre
- Salt
- Sugar
- Calories
- Serving info

Then contextual interpretation.

No:

GOOD FOOD
BAD FOOD

Optional:
“See alternatives”


==================================================
PHASE 21 — NUTRITION INTELLIGENCE
STATUS: FUTURE
==================================================

Beginner-first.

Focus:

- protein
- fibre
- fruit/veg
- hydration
- meal regularity

Calories optional.

Minimum logging necessary.

No guilt.

No mandatory perfect diary.


==================================================
PHASE 22 — PERSONAL + MONTHLY CHALLENGES
STATUS: FUTURE — MAJOR PRODUCT DIRECTION EXPANDED
==================================================

Basic personal examples:

- first five planned activities
- walking distance milestone
- mobility challenge
- balanced week
- personal step challenge

Challenge system must adapt to ability/recent behaviour where practical.

Do not give a beginner the same numerical target as an advanced user
merely because the calendar changed.

Partial progress visible.

No broken-streak punishment.


==================================================
PHASE 22A — NINFIT DROP DAY
STATUS: FUTURE — LOCKED
==================================================

NINFIT DROP DAY:

THE 1ST OF EVERY MONTH.

Product rhythm:

Every first of the month,
the NinFit world gets a little bigger.

First open of the month may reveal:

NEW THIS MONTH

Opal may introduce:

- new announced achievements
- personal challenges
- community challenge
- Shop discoveries
- new quotes
- new cosmetics
- world details
- occasional Adventure
- hints about secret additions

Some additions should remain undisclosed.

Possible message:

“Something new has appeared in NinFit…”

Monthly drops should eventually be content-driven rather than require
a full app-store binary release for every change.


--------------------------------------------------
MONTHLY CHALLENGE STRUCTURE
--------------------------------------------------

Each month may contain:

1. PERSONALISED CHALLENGE
2. OPTIONAL STRETCH CHALLENGE
3. GLOBAL / COMMUNITY CHALLENGE
4. HIDDEN MONTHLY CHALLENGE

Hidden challenge:

- requirements are not shown
- genuine activity may trigger it naturally
- cannot encourage unsafe activity
- exact formula remains hidden

Example:

SECRET DISCOVERED
Dawn Walker

The user should not be encouraged to overtrain to hunt secrets.


==================================================
PHASE 22B — MONTHLY + YEARLY COLLECTIONS
STATUS: FUTURE — LOCKED DIRECTION
==================================================

Monthly challenge completion may award:

- XP
- currency
- cosmetic
- trophy
- permanent Journey memory
- yearly collection piece

YEARLY COLLECTION:

12 monthly pieces contribute to a year's collection.

Missing a month does NOT permanently destroy the collection.

Archive route:

- previous month remains recoverable later
- archive route may be different/harder
- main collection remains earnable

NO PERMANENT FOMO.


--------------------------------------------------
FULL-YEAR REWARD
--------------------------------------------------

Completing all 12 pieces earns:

- Trophy Vault centrepiece
- permanent Journey memory
- non-purchasable cosmetic/environmental reward

Natural completion during the actual calendar year may also unlock:

SECRET NATURAL-YEAR BONUS

This bonus should be:

- cosmetic
- subtle
- non-essential
- non-competitive

Archive completion still earns the main collection.


--------------------------------------------------
YEARLY CENTREPIECE — DIRECTION
--------------------------------------------------

Preferred concept:

- one evolving object in Trophy Vault
- changes as monthly pieces are added
- each month also creates its own Journey memory

Future possibility:

The yearly object may subtly reflect the activities that dominated
that user's year.

Two users may therefore have visually different versions of the same
year's journey piece.


==================================================
PHASE 22C — RESILIENCE / COMEBACK ACHIEVEMENTS
STATUS: FUTURE — LOCKED DIRECTION
==================================================

Minimum wins count.

Example:

Planned:
30 minutes

Completed:
7 minutes

Truth remains:

7 completed
30 planned

Emotional interpretation:

YOU SHOWED UP.

Do not falsify completion.

Shorter effort may receive appropriately smaller progression while
still being positively recognised.


--------------------------------------------------
HIDDEN RESILIENCE ACHIEVEMENTS
--------------------------------------------------

Rare hidden achievements may recognise long-term patterns such as:

- returning after a break
- repeatedly choosing a smaller safe session instead of nothing
- rebuilding consistency
- persistence through difficult periods

They should be:

- rare
- emotionally meaningful
- non-grindable
- based on genuine history

Do not display:

“Do 12 partial workouts to unlock Resilience III.”

Exact thresholds may remain hidden.

Resilience may secretly contribute to Secret Prestige.


==================================================
PHASE 23 — ADVENTURES / EXPLORATION
STATUS: FUTURE
==================================================

Turn real movement into world exploration.

May include:

- walking journeys
- hiking
- themed routes
- exploration milestones
- narrative
- environmental unlocks
- discoveries
- secret content

Rewards:

- trophies
- cosmetics
- environments
- mascot forms
- materials
- 1-Ups
- secret discoveries

Location:

- explicit opt-in
- private by default
- minimal retained data
- never live-shared by default

Safety:

Never:

“Climb this mountain today or lose your reward.”


==================================================
PHASE 24 — CLOUD / BACKEND EXPANSION
STATUS: FOUNDATION AUTH EXISTS; SYNC FUTURE
==================================================

Account/auth foundation already exists.

Future backend should be added only when needed for:

- cloud backup
- sync
- friends
- profiles
- community
- segments
- rankings
- remote content

Local-first remains respected.

Cloud sync explicit.

Never silently upload health records.


==================================================
PHASE 25 — SOCIAL + FRIENDS
STATUS: FUTURE
==================================================

Modes:

- Private
- Friends
- Community

Challenge visibility separately configurable.

Shareable game/profile information may include:

- mascot
- level
- trophies
- cosmetics
- selected PBs
- selected activities

Sensitive health data never public automatically.


==================================================
PHASE 26 — JOURNEY WALL
STATUS: FUTURE — EXPANDED
==================================================

Visual history.

Possible entries:

- milestones
- trophies
- evolutions
- PBs
- challenges
- Adventures
- programme changes
- events
- founding status
- monthly memories
- yearly memories
- special quotes
- manually kept inspirational quotes
- Champion moments
- Legacy memories
- secret discoveries

Personal/private by default.

Chronological.

Accessible.

Sharing optional.


==================================================
PHASE 27 — CREWS
STATUS: FUTURE
==================================================

Optional small groups.

May include:

- shared challenges
- milestones
- mascot showcases
- reactions
- crew trophies
- cooperative Adventures

No required health-data sharing.

No pressure mechanics.


==================================================
PHASE 28 — GPS SEGMENTS
STATUS: FUTURE
==================================================

User-defined route segments.

Primary:

Personal.

Optional:

Friends.
Community.

Requires:

- GPS validation
- route matching
- timing
- privacy
- anti-cheat
- duplicate handling


==================================================
PHASE 29 — LEADERBOARDS / LEAGUES
STATUS: FUTURE
==================================================

Default order:

1. Personal
2. Friends
3. Community

Ability bands may include:

- Starter
- Bronze
- Silver
- Gold
- Elite

Do not automatically pit beginners against elite athletes.

Cosmetics/purchases never confer ranking advantage.


==================================================
PHASE 30 — KUDOS / REACTIONS
STATUS: FUTURE
==================================================

Light encouragement.

Examples:

- Nice one
- Strong
- Smashed it
- PB
- branded reactions later

Avoid engagement spam.

Mascots may react to verified events.


==================================================
PHASE 31 — INTELLIGENT PROGRAMME PROGRESSION
STATUS: FUTURE
==================================================

Analyse actual history.

Propose progression.

Example:

Suggested next week:
Increase two walks from 15 → 18 minutes.

Show brief evidence.

Options:

- Accept
- Modify
- Keep current

Never silently increase exercise.

Rule:

No data, no guess.

Weak data, no confident recommendation.

Never automatically switch path.


==================================================
PHASE 32 — LIVING SEASONS + EVENTS
STATUS: FUTURE — EXPANDED
==================================================

Possible:

- Halloween
- Christmas
- summer
- anniversaries
- special events

World may change through:

- habitat decorations
- Trophy Room details
- mascot behaviour
- activities
- Adventures
- cosmetics
- environmental variants

Avoid FOMO.

Missing event is not failure.

Most cosmetics may return.

Dated rewards should represent memories.

Example:

First NinFit Christmas — 2026

NinFit Drop Day is monthly.

Seasonal events are larger occasional layers on top of that rhythm.


==================================================
PHASE 33 — BETA HARDENING
STATUS: FUTURE
==================================================

Deep testing:

- accessibility
- keyboard access
- drag alternative controls
- large text
- reduced motion
- colour blindness
- themes
- low-end Android
- iPhone
- tablet
- desktop
- navigation
- offline
- storage durability
- backup/import
- GPS accuracy
- GPS battery
- background GPS
- Health Connect
- HealthKit
- wearables
- food accuracy
- privacy
- account deletion
- route privacy
- security
- social controls
- anti-cheat
- performance
- bundle size
- startup
- mascot assets
- background assets
- lazy loading
- animations
- monthly content delivery
- reward idempotency
- secret systems cannot mutate fitness truth
- Shop cannot affect progression
- no paid competitive advantage


==================================================
PHASE 34 — NINFIT V1 LAUNCH
STATUS: FUTURE
==================================================

Target final loop:

ONBOARD
↓
MYSTERY EGG
↓
PERSONAL PROGRAMME
↓
NINFIT ID OPTIONAL
↓
TODAY'S REAL ACTION
↓
MOVE
↓
TRACK TRUSTED FITNESS DATA
↓
YOU DID IT
↓
XP / PROGRESS
↓
SMALL REWARD
↓
INSPIRATIONAL MOMENT
↓
SKILLS
↓
PERSONAL BESTS
↓
TROPHIES
↓
PATH MASCOT REACTION
↓
MASCOT EVOLUTION
↓
CHAMPION / LEGACY
↓
COSMETICS
↓
ADVENTURES
↓
DISCOVER SECRET CONTENT
↓
NEXT IMPROVEMENT

Opal accompanies and guides this journey.

Opal does not replace the path mascot journey.


==================================================
MASCOT EVOLUTION PHILOSOPHY
==================================================

Path mascot progression:

Young / capable
↓
Confident
↓
Adventurous
↓
Athletic
↓
Elite
↓
Champion / Legendary

Evolution is permanent.

Condition is temporary.

Evolution may use trusted:

- XP
- level
- activity milestones
- programme adherence
- challenges
- Adventures
- path achievements
- discoveries

Alternate evolution/form conditions may remain secret.


==================================================
MASCOT CONDITION PHILOSOPHY
==================================================

Condition makes the mascot feel alive.

It must never become a virtual-pet obligation.

No:

- feeding
- cleaning
- mandatory happiness
- pet chores

Return after absence:

- warmth
- humour
- encouragement
- simple next action

Never:

- guilt
- punishment
- shame
- loss of permanent progress


==================================================
REWARD PHILOSOPHY
==================================================

Ordinary fitness completion:

reliable progress
+
small dopamine hit
+
occasional surprise

A reward must never be necessary for the fitness record to count.

Fitness truth remains independent.


==================================================
MISS / ADAPTATION PHILOSOPHY
==================================================

If a planned session is missed:

- acknowledge gently if useful
- offer a lighter option where appropriate
- programme may adapt
- no XP loss
- no bond loss
- no mascot disappointment
- no broken-streak shame

Rest and life interruptions remain valid parts of the journey.


==================================================
GAME ECONOMY RULES
==================================================

Reward:

- consistency
- effort
- exploration
- curiosity
- milestones
- personal improvement
- resilience
- safe programme adherence

Never reward:

- falsified activity
- unsafe behaviour
- pain
- sleep deprivation
- overtraining
- leaderboard manipulation

Cosmetics:
visual only.

No:

- XP boost
- progression boost
- rarity boost
- Prestige boost
- fitness advantage
- pay-to-win


==================================================
AI INTELLIGENCE LAYER
==================================================

Rules determine:

- fitness truth
- programme constraints
- rewards
- XP
- PB
- trophies
- hatch
- evolution
- Champion
- Prestige eligibility
- persistence
- provenance
- safety

AI may help with:

- wording
- explanation
- personalisation
- dialogue
- memory narration
- contextual relevance
- selecting approved animations
- selecting approved habitat state
- presenting safe options

Core NinFit must still function if AI is unavailable.

Professional boundary:

Do not present AI as a doctor, physiotherapist, registered
dietitian/dietician or other regulated clinician unless appropriate
professional governance genuinely exists.


==================================================
MONTHLY CONTENT SAFETY
==================================================

Monthly drops must never become compulsive pressure.

Do not use:

- countdown panic
- permanent loss threats
- daily login requirements
- punishment for missing a month
- unsafe fitness targets

Use:

- curiosity
- fresh content
- optional challenges
- discovery
- archive recovery
- memories


==================================================
DEVELOPMENT RULE — LOCKED
==================================================

Do not jump randomly between phases.

Every workstream must:

1. inspect repository truth
2. read relevant canonical docs
3. define acceptance criteria
4. implement one bounded vertical slice
5. run focused tests
6. run full appropriate tests
7. run typecheck
8. run production build
9. manually verify relevant UI
10. report concerns
11. STOP
12. wait for approval before commit/push or next slice

New ideas go into the appropriate roadmap phase.

They do not interrupt the current workstream merely because they
are exciting.

Repository truth remains authoritative.

When a new feature is proposed:

FIRST identify which roadmap phase owns it.

Avoid duplicate systems.

Prefer:

- domain-driven state
- reusable primitives
- central registries
- explicit boundaries
- testable rules
- progressive enhancement
- local-first behaviour
- lazy loading
- stable asset IDs
- small coherent commits

Avoid:

- screen-specific business logic
- scattered hard-coded unlocks
- random asset filenames
- duplicated navigation
- duplicated theme logic
- hidden fitness mutation
- unnecessary dependencies
- eagerly loading large game assets
- premature social architecture
- premature cloud complexity


==================================================
GIT / REPOSITORY HYGIENE
==================================================

Before any work:

git branch --show-current
git status --short
git log --oneline -10
Test-Path .git\index.lock

Do not casually:

- reset
- restore
- stash
- clean
- rebase
- force-push
- normalise unrelated files

Current known line-ending issue:

A set of files in the Windows checkout may appear modified solely
because LF/CRLF differs.

Do not sweep that churn into feature commits.

Handle line-ending policy as a dedicated repository-maintenance
workstream.

Prefer a deliberate .gitattributes policy and controlled
renormalisation after review.


==================================================
CURRENT PRIORITY ORDER
==================================================

CURRENT:

1. Finish Phase 6 Today/Home slice
2. Preserve contextual companion-domain work
3. remove daily completion-score presentation
4. maintain path-mascot vs Opal separation
5. review Phase 6 changes

IMMEDIATELY AFTER:

6. Fix Vercel/Supabase deployment health
7. verify fresh production deployment
8. verify CSS asset loading
9. add modern PWA/mobile meta
10. resolve CRLF repository hygiene separately
11. clean tests/build
12. scoped Phase 6 commit/push

THEN:

13. Complete remaining Today/Home experience
14. Continue world destination functionality
15. Week/Progress/Profile/Data polish
16. Reward presentation
17. Begin CONTROLLED mascot art pipeline
18. prove one path mascot family
19. integrate actual mascot assets
20. continue reward/trophy/economy systems

DO NOT:

Generate all mascots/trophies/cosmetics and wire them blindly before
the first production mascot pipeline is proven.


==================================================
NINFIT LONG-TERM EXPERIENCE
==================================================

The ideal user experience:

You open NinFit.

You immediately know the realistic fitness action for today.

Your path mascot reflects your long-term journey.

Opal helps you understand the world without taking control away.

You perform genuine activity.

NinFit records what actually happened.

Even a small safe effort can count as showing up.

The game celebrates the truth.

You receive reliable progress.

Sometimes you discover something unexpected.

Your trophies, mascot, habitat and world gradually reflect years of
real history.

Missing time never destroys your story.

Returning is always allowed.

Over months:

your collection grows.

Over years:

your Trophy Room, Journey Wall, Champions, Relics and memories become
a record of the person who kept coming back.


==================================================
NINFIT NORTH STAR
==================================================

NinFit should feel like:

A calm, trustworthy fitness tracker
+
a personal coach
+
a living path mascot journey
+
Opal as a friendly universal companion
+
a collectible adventure game
+
an optional social world.

The fitness is real.

The game celebrates it.

The path mascot grows with it.

Opal helps make sense of it.

The user remains in control.


==================================================
FINAL PRODUCT RULE
==================================================

FITNESS FIRST.

SHOWING UP CELEBRATED.

TRUTH NEVER FAKED.

CALM BY DEFAULT.

ENERGY EARNED.

MOVE.

GROW.

EVOLVE.