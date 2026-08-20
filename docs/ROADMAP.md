NinFit — Product & Development Roadmap

Working brand:
NinFit

NIN:
Next · Improvement · Now

Brand philosophy:
Move · Grow · Evolve

Core product rule:
Fitness data is the truth layer.
The game celebrates trusted fitness data.

Core design rules:
- Personal progress first
- Social competition optional
- Food informative, not moral
- Calories burned are estimates
- App proposes, user decides
- Calm by default, energy is earned
- Reward behaviour, not just outcomes
- Rest is part of the programme
- No guilt, punishment, broken-streak pressure or red failure states
- Health data private by default
- Cosmetics never affect fitness progression
- No pay-to-win
- Curiosity is rewarded alongside consistency
- Game mechanics must never falsify fitness truth
- Mascots encourage rather than shame
- User always remains in control


==================================================
PRODUCT ARCHITECTURE PRINCIPLES
==================================================

NinFit consists of four conceptual layers:

1. FITNESS TRUTH
2. PROGRAMME / COACHING
3. GAME / COLLECTION
4. SOCIAL

Fitness truth is authoritative.

The game celebrates trusted fitness data.

The game must never modify, fabricate or override fitness records
to create rewards.

Programme logic may propose actions.

The user decides whether to accept them.

Social systems are optional and must never be required to use
the core fitness product.

Mascots are presentation/companion characters.

Mascots do not own domain logic.

Architecture principle:

Domain
↓
Programme / Game state
↓
Presentation state
↓
Mascot / UI


==================================================
CURRENT FOUNDATION — COMPLETE
==================================================

Completed foundations:

- Vite + React + TypeScript
- local-first architecture
- pure domain layer
- localStorage repository
- Today screen
- Week screen
- Progress screen
- Profile screen
- Data / export / import
- JSON backups
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
- attention-state accessibility

Current fitness paths:

1. Start Moving
2. Build Strength
3. Build Stamina
4. Balanced Fitness
5. Return to Fitness

Skills:

- Strength
- Stamina
- Mobility
- Consistency
- Recovery


==================================================
PHASE 3 — TYPOGRAPHY + RESPONSIVE LAYOUT
==================================================

Goal:
Turn the existing mobile prototype into a polished responsive application.

Implement:

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
- landscape safe areas
- 720px desktop maximum content width

Target sizes:

- small phone: ~360px
- standard phone: 390–430px
- tablet: 600–899px
- desktop: 900px+

Do not add a custom font yet.


==================================================
PHASE 3A — DESKTOP APPLICATION EXPERIENCE
==================================================

Goal:
Make desktop a deliberate NinFit experience rather than a stretched
mobile layout.

Mobile:

- mobile-first layout
- bottom navigation
- thumb-friendly controls
- compact content
- contextual back navigation

Desktop:

- dedicated dashboard/application shell
- persistent navigation/sidebar
- wider content canvas
- larger content regions
- dashboard overview
- mascot presentation area
- Today summary
- Week summary
- Progress summary
- quick access to Trophy Vault
- quick access to Shop
- quick access to Adventures
- quick access to Zen Zone
- profile/account access
- settings access

Tablet:

- adaptive hybrid layout
- retain appropriate bottom navigation or compact navigation
- gradually introduce wider layouts

Desktop and mobile share:

- domain
- data
- business logic
- visual language
- accessibility rules
- game systems

They may differ in:

- composition
- navigation
- information density
- content width
- decorative presentation

Do not simply stretch the mobile interface across desktop.


==================================================
PHASE 4 — NINFIT THEME ENGINE
==================================================

Goal:
Create runtime themes without changing component logic.

Theme hierarchy:

1. Default NinFit theme
2. Fitness-path theme
3. Future mascot-specific theme
4. Future environment/cosmetic theme

Default startup:
Neutral premium NinFit theme.

Do not reveal mascot identity through theme before hatch.

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

- use OKLCH
- separate paths by hue, lightness and chroma
- verify light mode
- verify dark mode
- verify greyscale
- verify colour-vision accessibility

Implementation:
Use data-path on the root.

Attention amber remains separate and always uses:
- icon
- wording
- colour

Future support:
System / Light / Dark.


==================================================
PHASE 5 — ONBOARDING VISUAL JOURNEY
==================================================

Goal:
Make onboarding feel like the beginning of a fitness adventure.

One question per screen.

Structure:

1. Mystery Egg
2. progress indicator
3. one dominant question
4. short supporting copy
5. large answer cards
6. Back / Continue

Mystery Egg:

- universal
- mascot remains secret
- no animal clues
- neutral colour before recommendation

Background:

- premium neutral base
- subtle gradient/shape energy
- gradually more energetic through onboarding
- no path colour before recommendation

Recommendation screen:

- recommended path
- why it was recommended
- starting fitness stage
- Start this path
- See other paths
- user can override recommendation

Mobile-first:
390px primary target.


==================================================
PHASE 5A — NINFIT ID / ACCOUNT ENTRY JOURNEY
==================================================

Goal:
Place account creation at a natural point in the product journey
without gating the application behind an account.

Core principle:

NinFit works without an account.

The user should experience the beginning of NinFit before being asked
to create an identity.

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

Account creation must never block core local-first use.

Account options:

- Email + password
- Google
- Apple
- future validated providers where appropriate

Email account requirements:

- email confirmation
- repeat password
- password visibility toggle
- password requirements
- resend confirmation
- clear confirmation state
- safe error handling

Account system:

- Supabase or validated equivalent
- privileged credentials never exposed
- authentication isolated behind a service boundary
- local-first data remains authoritative for local use
- future cloud sync must be explicit

Account should eventually enable:

- cloud backup
- multi-device continuity
- social identity
- friends
- public profile
- future cloud features

Do not imply that fitness data is already cloud-synchronised
when it is not.

Opal acts as the friendly guide through this process.


==================================================
PHASE 5B — OPAL AS NINFIT COMPANION
==================================================

Goal:
Make Opal the central friendly character of the NinFit experience.

Opal is not merely a mascot.

Opal is the canonical NinFit companion.

Roles:

1. Onboarding Guide
2. Account Setup Guide
3. NinFit Assistant
4. Fitness Coach interface
5. Achievement Companion
6. Celebration character
7. Recovery/return companion

Opal may help explain:

- NinFit
- onboarding
- account options
- navigation
- daily plans
- achievements
- trophies
- game systems
- available activities
- settings

Opal must not:

- own business logic
- fabricate fitness data
- make medical diagnoses
- silently change programmes
- shame the user
- create mandatory maintenance tasks

AI assistance must:

- be transparent
- preserve user control
- distinguish suggestions from facts
- use trusted application data
- avoid pretending to be a medical professional


==================================================
PHASE 6 — TODAY / HOME REDESIGN
==================================================

Goal:
Create the core daily NinFit experience.

Hierarchy:

1. Mystery Egg / mascot
2. Overall Level + XP
3. short mascot message
4. Today's workout
5. Quick Check-In
6. collapsible trackers

Mascot:

Emotional hook, but not larger or more important than today's workout.

Today's workout:
Primary action.

Quick Check-In:
Only appears when data exists.

Possible chips:

- Energy
- Water
- Steps
- Back

Tracking cards:

Default open:

- Exercise/how it went
- Back & symptoms

Default collapsed:

- Food
- Water
- Sleep/recovery

No daily completion score.


==================================================
PHASE 6A — NINFIT WORLD / PAGE ARCHITECTURE
==================================================

Goal:
Give each major NinFit system its own purposeful destination.

Core areas:

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

Fitness/activity areas:

- Flow
- Zen Zone
- Trail
- Forge
- Pulse
- Flex Lab

Examples:

FLOW
- yoga
- mobility flow
- linked video sessions
- routines
- progress/context

ZEN ZONE
- meditation
- breathing
- relaxation
- recovery
- calm visual environment

TRAIL
- walking
- hiking
- exploration
- future GPS activities

FORGE
- strength
- resistance
- progressive training

PULSE
- cardio
- stamina
- heart-rate-aware activities where available

FLEX LAB
- mobility
- flexibility
- stretching

Pages must have a clear purpose.

Do not create pages merely to increase navigation.

Mobile:

- bottom navigation remains primary
- contextual navigation/back for secondary pages

Desktop:

- persistent navigation/sidebar
- dashboard access
- wider layouts

All pages share:

- domain
- data
- game state
- visual system
- accessibility rules


==================================================
PHASE 7 — WEEK / PROGRESS / PROFILE / DATA POLISH
==================================================

Week:
Keep practical day cards.

Add a light 7-day journey trail:

- complete
- partial
- today
- rest
- future

Mascot/egg can move along the trail.

Trail remains secondary to real records.

Progress:
Data first.

Then:

- meaningful personal-best region
- milestone highlights
- recent trophies

Profile sections:

1. You
2. Your Programme
3. Where You Started
4. Your Notes
5. Game
6. Settings

Data:

Remain calm and trustworthy.

No unnecessary mascot/game styling.

Backup/import/privacy take priority.


==================================================
PHASE 8 — REWARD PRESENTATION + MOTION
==================================================

Goal:
Make achievements satisfying without turning everything into an
arcade machine.

Normal activity:

- tick
- short “You did it!”
- XP pop
- small mascot reaction

Medium events:

- trophy
- level-up
- PB
- challenge completion

Major/cinematic:

- egg hatch
- mascot evolution
- Gold trophy
- Platinum trophy
- major journey milestone
- secret discovery

Motion levels:

- instant
- standard
- reward
- cinematic

CSS first.

Respect reduced motion.

Sound and haptics remain optional.


==================================================
PHASE 9 — NINFIT BRAND FOUNDATION
==================================================

Working name:
NinFit

NIN:
Next · Improvement · Now

Potential public tagline:
Move · Grow · Evolve

Brand character:
70% serious
30% playful

Brand voice:
Adaptive.

Normal use:
calm and supportive.

Achievements:
energetic and celebratory.

Before finalising NinFit:

Research:

- UK trademarks
- international trademarks
- Companies House
- App Store
- Google Play
- domains
- existing fitness/software brands

Do not treat the working name as legally final until checked.


==================================================
PHASE 10 — MASCOT ART PIPELINE
==================================================

Goal:
Create canonical NinFit mascots rather than random AI-generated
characters.

Art style:
Premium 2D / 2.5D.

Body proportions:
Stylised middle ground.

Evolution:
Cute/natural → progressively cooler → slightly fantastical.

Shared stages:

1. Starter
2. Growing
3. Capable
4. Advanced
5. Elite

Same companion throughout.

Personality matures slightly but remains recognisable.

Core mascot families:

Start Moving → Tortoise
Build Strength → Bear
Build Stamina → Fox
Balanced Fitness → Otter
Return to Fitness → Wolf

Core families have equal status.

--------------------------------------------------
MASCOT ARCHITECTURE — DECIDED
--------------------------------------------------

CORE PATH MASCOTS:
Tortoise / Bear / Fox / Otter / Wolf

Exactly five, one per fitness path. This set is closed. Adding a
sixth means adding a sixth fitness path.

OPAL:
Separate NinFit companion / guide. Opal is NOT a fitness-path
mascot and must never appear in the path mascot family set.
Opal is not chosen, earned or hatched — every user has the same
companion from first launch. See Phase 5B.

OWL + RED PANDA:
Future character possibilities only. Not current core fitness
paths, not path mascot families, and not scheduled.

Reference artwork exists for characters that are not path
mascots. Artwork existing is not a product decision — a
character joins the path system only through an explicit
milestone.

Rare versions are cosmetic variants/forms only.

No gameplay advantage.

First family:
Prove the whole pipeline with one family before producing the rest.

Canonical mascot sheet should include:

- front
- 3/4
- side
- back
- colour palette
- proportions
- expressions
- idle pose
- celebration
- rest
- PB reaction
- trophy reaction
- cosmetic attachment points

Then create:

- Bear
- Fox
- Otter
- Wolf


==================================================
PHASE 10A — OPAL CANONICAL CHARACTER
==================================================

Goal:
Establish Opal as the definitive NinFit reference character.

Opal is the first production mascot and visual reference for
the wider mascot universe.

Opal must establish:

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

Opal evolution:

1. Egg
2. Hatchling
3. Explorer
4. Adventurer
5. Champion
6. Legend

Evolution should feel like:

cute
↓
confident
↓
adventurous
↓
athletic
↓
impressive
↓
legendary

Do not create an abrupt baby-to-bodybuilder transformation.

Opal remains recognisable throughout.


==================================================
PHASE 10B — MASCOT CONDITION SYSTEM
==================================================

Goal:
Give mascots a temporary visual state reflecting consistency.

Mascot condition is separate from permanent progression.

Permanent:

- level
- XP
- evolution
- trophies
- unlocks
- cosmetics

Temporary:

- condition
- energy
- presentation state

Condition ladder:

1. Energetic
2. Active
3. Normal
4. Low Energy
5. Sleepy
6. Lounging
7. Sofa Sleep

Energetic:

- lively idle
- confident pose
- energetic expression

Active:

- happy
- ready
- positive movement

Normal:

- relaxed
- neutral
- healthy presentation

Low Energy:

- slower
- slightly tired

Sleepy:

- yawning
- sleepy eyes
- slower idle

Lounging:

- sitting
- relaxed
- sofa/chair interactions

Sofa Sleep:

- sleeping
- blanket
- subtle breathing
- floating Zs
- optional ambient TV interaction

Important:

Condition must NEVER:

- remove XP
- remove levels
- remove trophies
- remove cosmetics
- punish absence
- shame the user
- imply a medical diagnosis
- create mandatory pet-care chores

Condition recovers gradually as meaningful activity returns.

A high-level mascot can temporarily be in a low-condition state.

The mascot reflects the journey.

It does not judge the user.


==================================================
PHASE 10C — MASCOT EXPRESSIONS + REACTIONS
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
- returning after absence
- personal best
- trophy
- level-up
- evolution
- secret discovery

Event-driven reactions:

- workout complete
- partial completion
- rest day
- PB
- trophy
- level-up
- challenge completion
- programme progression
- return after absence
- evolution
- secret discovery

Mascot interaction remains light.

Allowed:

- tap reactions
- idle animations
- expressions
- celebration
- rest/sleep
- contextual comments

Not allowed:

- feeding obligations
- happiness bars
- punishment for absence
- maintenance chores


==================================================
PHASE 10D — SECRET MASCOTS + SECRET EVOLUTIONS
==================================================

Goal:
Reward curiosity and exploration.

NinFit contains hidden collectible mascots and forms.

Categories:

- secret mascots
- secret evolutions
- alternate forms
- event mascots
- Easter-egg mascots
- ultra-rare discoveries

Some secret mascots must not appear in the normal catalogue
until discovered.

Possible unlock methods:

- unusual achievement combinations
- exploration
- hidden interactions
- special challenges
- event participation
- milestone combinations
- Easter eggs
- secret codes

Examples:

- Zen Opal
- Trail Opal
- Forge Opal
- Pulse Opal
- Flow Opal
- Retro mascot
- Glitch mascot
- developer/Easter-egg mascot
- unknown ??? mascot

Secret content is collectible/cosmetic.

Never grant fitness advantages.

Discovery itself is part of the reward.


==================================================
PHASE 10E — MASCOT COLLECTION / COMPANION VAULT
==================================================

Goal:
Give users a dedicated place to discover and display their
mascot collection.

Companion Vault displays:

- discovered mascots
- undiscovered mascots
- evolution forms
- secret forms
- condition previews
- cosmetics
- accessories

Undiscovered content may display:

???
Mystery silhouette
Locked

Secret content does not necessarily reveal its unlock condition.

User can select:

- active companion
- active evolution
- outfit
- accessories
- environment
- featured animation

Opal remains the central companion even as the collection expands.


==================================================
PHASE 11 — TROPHY + COSMETIC VISUAL SYSTEM
==================================================

Trophy tiers:

- Bronze
- Silver
- Gold
- Platinum

Possible achievement categories:

- Activity
- Consistency
- Stamina
- Strength
- Mobility
- Recovery
- Exploration
- Personal Best
- Mascot
- Special/Event
- Secret

Secret trophies supported.

Future global rarity supported.

Trophy visibility:

- Private
- Friends
- Public

Founding users:

Potential founding set:

- Founding User trophy
- cosmetic
- profile emblem

Cosmetics:

- accessories
- outfits
- colour variants
- environments
- poses
- animations
- effects
- capes

Cosmetics are always visual only.

No XP boost.
No progression advantage.
No pay-to-win.


==================================================
PHASE 11A — COLLECTION + REWARD ECONOMY
==================================================

Goal:
Create a coherent visual collection system across NinFit.

Collection categories:

- Mascots
- Evolutions
- Trophies
- Emblems
- Outfits
- Accessories
- Capes
- Environments
- Effects
- Poses
- Animations
- 1-Ups
- Secret discoveries

Reward sources:

- XP
- levels
- achievements
- personal bests
- challenges
- Adventures
- programme milestones
- events
- exploration
- secret discoveries

Some items are never sold.

They must be earned or discovered.

The reward economy must remain cosmetic-first.

No pay-to-win.


==================================================
PHASE 11B — 1-UP SYSTEM
==================================================

Goal:
Introduce playful old-school game mechanics without compromising
fitness truth.

1-Ups are game-layer rewards only.

Possible uses:

- retry an optional game challenge
- protect an optional game-layer opportunity
- revive an optional challenge
- unlock a playful bonus interaction
- trigger a special cosmetic/event interaction

1-Ups must NEVER:

- alter fitness data
- fake activity
- increase health metrics
- bypass safety limits
- manipulate leaderboards
- create competitive advantage
- become pay-to-win

1-Ups are earned through:

- play
- exploration
- achievements
- secret discoveries
- events
- special challenges


==================================================
PHASE 11C — SECRET CODES / CHEAT SYSTEM
==================================================

Goal:
Capture the fun of old-school computer and console games.

NinFit may contain hidden codes and Easter eggs.

Cheats are deliberately playful and game-layer only.

Possible effects:

- Retro Mode
- special mascot forms
- visual effects
- secret animations
- cosmetic unlocks
- hidden rooms
- alternate UI treatments
- joke interactions
- special mascot dialogue

Cheats must NEVER:

- modify fitness records
- fake exercise
- grant unfair competitive advantages
- manipulate leaderboards
- bypass health/safety rules

Future feature:

SECRET ROOM / CHEAT CONSOLE

Potentially hidden behind discovery.

The console may contain:

- discovered codes
- undiscovered slots
- hints
- secret interactions

Some codes may be hinted at.

Others may require genuine discovery.

The system should feel like a discovery rather than a conventional
settings menu.


==================================================
PHASE 11D — TROPHY VAULT
==================================================

Goal:
Create a full collection experience.

Game-like display room plus accessible grid fallback.

Support:

- Bronze
- Silver
- Gold
- Platinum
- locked
- secret
- unlocked
- newly unlocked
- rarity later

Mascot can appear in the Trophy Vault.

User chooses featured trophies.

Profile showcase can contain:

- main mascot
- outfit
- environment
- 3 featured trophies

Visibility:

- Private
- Friends
- Public


==================================================
PHASE 12 — NINFIT ART / ENVIRONMENT PIPELINE
==================================================

Goal:
Create a coherent visual world rather than isolated background images.

Initial environments may include:

- Today / Home
- Week
- Progress
- Adventures
- Zen Zone
- Flow
- Trail
- Forge
- Pulse
- Flex Lab
- Trophy Vault
- Shop
- Journey Wall
- Crews
- Profile
- Settings
- Data
- seasonal/event environments

Art direction:

- premium illustrated
- 2D / 2.5D
- colourful
- atmospheric
- friendly
- polished
- adventurous
- collectible/game-like

Background artwork is decorative.

It must never be the only source of meaning.

Each production asset should have:

- canonical source
- intended page
- mobile treatment
- desktop treatment
- crop/focal-point guidance
- light/dark treatment where required
- accessibility/readability guidance

Use a central background registry.

Do not scatter arbitrary image URLs throughout screen components.

Backgrounds should sit behind:

1. artwork
2. contrast/gradient treatment
3. application surfaces/cards
4. content

Artwork must not compromise readability.

Do not load every environment eagerly.

Use appropriate asset sizing and lazy loading.


==================================================
PHASE 12A — NINFIT VISUAL ASSET PIPELINE
==================================================

Goal:
Turn generated concept artwork into controlled production assets.

Asset categories:

- Mascots
- Mascot evolutions
- Mascot expressions
- Mascot animations
- Trophies
- Emblems
- Cosmetics
- Capes
- 1-Ups
- Backgrounds
- Environments
- Effects
- Event artwork
- UI decorative artwork

Generated AI artwork is reference/source material until it has
been reviewed and converted into canonical production assets.

Do not build the application around random generated filenames.

Each canonical asset should have:

- stable ID
- asset category
- intended use
- rarity where applicable
- unlock source
- light/dark requirements
- responsive requirements
- accessibility requirements

Production asset selection must remain consistent with the
NinFit visual language.


==================================================
PHASE 13 — PWA + INSTALLABILITY
==================================================

Goal:
Make NinFit a proper installable mobile web application.

Implement:

- web app manifest
- app icons
- splash behaviour
- offline shell
- safe update behaviour
- installability
- production deployment
- offline-safe local tracking

Verify:

- Android
- iPhone/PWA where supported
- desktop
- offline
- local storage durability communication


==================================================
PHASE 14 — REMINDERS
==================================================

User-controlled reminders.

Hydration:

- Fixed
- Smart
- Off

Meal reminders:

- Fixed
- Smart
- Off

Also support later:

- Workout
- Recovery
- Measurement/weigh-in

Tone:

Good:
“Fancy some water?”
“Have you eaten yet?”

Bad:
“You are behind.”
“You missed lunch.”

No guilt.


==================================================
PHASE 15 — CAPACITOR / NATIVE FOUNDATION
==================================================

Goal:
Add native access without rewriting NinFit.

Wrap existing Vite/React application using Capacitor or the best
validated native-shell option.

Preserve:

- domain
- UI
- game system
- persistence boundaries
- IO
- tests

Gain access to native capabilities:

- Health Connect
- HealthKit
- sensors
- background health data
- notifications
- stronger camera control
- GPS/background location


==================================================
PHASE 16 — WEARABLE + HEALTH INTEGRATIONS
==================================================

Android first.

Use Health Connect where appropriate.

Then iPhone via HealthKit.

Possible imported data:

- steps
- heart rate
- resting HR
- HRV
- sleep
- workouts
- distance
- active minutes

Fitbit / watch / third-party data should preferably arrive through
platform health stores where practical.

Manual tracking remains supported.

Data provenance must always identify source.

Examples:

- manual
- phone sensor
- Health Connect
- HealthKit
- wearable
- imported

Never silently overwrite manually entered data.


==================================================
PHASE 17 — GPS ACTIVITY RECORDER
==================================================

Supported activities:

- Walk
- Run
- Cycle
- Hike

Live activity screen prioritises:

1. Timer
2. Distance
3. Pace / speed
4. Map
5. Heart rate where available

Controls:

- Pause
- Resume
- Finish

Route privacy defaults to private.

Sharing options:

- Full route
- Hide start/end
- Approximate route
- Stats only

Later allow configurable live metrics.


==================================================
PHASE 18 — PERSONAL BEST ENGINE
==================================================

Main competitive principle:

YOU vs YOU.

Personal bests first.

Possible PBs:

- fastest 1 km
- fastest 5 km
- longest walk
- longest run
- longest ride
- best segment
- highest sensible activity metric
- strength milestones later

Never create PBs for inappropriate health metrics such as:

- pain
- high HR
- low sleep

Post-activity example:

YOU DID IT!

3.4 km
36:18

NEW PERSONAL BEST
42 seconds faster

+ XP
Stamina increased
Mascot reaction

Celebration intensity adapts to significance.


==================================================
PHASE 19 — ESTIMATED CALORIES / ENERGY
==================================================

Show energy expenditure only as an estimate.

Wording:

“Estimated active calories”

Never:

“You burned exactly X calories.”

Do not automatically convert exercise calories into permission to eat
additional calories.

Calorie visibility should be configurable:

- Prominent
- Secondary
- Hidden


==================================================
PHASE 20 — NINFIT FOOD SCANNER
==================================================

Goal:
Yuka-style convenience without simplistic moral food scoring.

Barcode scan.

Initial data provider candidate:
Open Food Facts or another validated source.

Show practical summary first:

- Protein
- Fibre
- Salt
- Sugar
- Calories
- serving information

Then:

“How this fits your day”

Example:

- Useful protein contribution
- Low fibre
- You have had little fruit/veg so far
- Salt is already fairly high today

No:

GOOD / BAD food judgement.

Optional:

“See alternatives”

Food alternatives appear only after the facts.


==================================================
PHASE 21 — NUTRITION INTELLIGENCE
==================================================

Beginner-first nutrition.

Focus on:

- protein
- fibre
- fruit/veg
- hydration
- meal regularity

Calories optional.

Minimum logging necessary.

Food is contextual rather than moral.

No guilt.

No rigid requirement that every meal be logged.


==================================================
PHASE 22 — PERSONAL CHALLENGES
==================================================

Start with challenges that do not require social infrastructure.

Examples:

- complete first 5 planned activities
- walking-distance milestone
- mobility challenge
- balanced-week challenge
- personal step challenge

Rewards:

- XP
- badges
- cosmetics
- trophies
- evolution progress
- secret discoveries

Partial progress should be visible.

No streak punishment.


==================================================
PHASE 23 — ADVENTURES / EXPLORATION
==================================================

Goal:
Turn real fitness progress into an explorable NinFit world.

Adventures may include:

- walking journeys
- themed activity journeys
- exploration milestones
- zone-specific challenges
- narrative progression
- environmental unlocks
- secret discoveries

Adventures can unlock:

- trophies
- cosmetics
- environments
- mascot forms
- 1-Ups
- secret content

The fitness activity remains the truth layer.

The game represents the achievement.


==================================================
PHASE 24 — ACCOUNTS / BACKEND / CLOUD
==================================================

Only add backend infrastructure when NinFit genuinely needs:

- accounts
- cloud backup
- friends
- public profiles
- community
- segments
- global rankings

Potential backend:
Supabase or best validated equivalent.

Local-first design should remain respected.

Users should retain export/data portability.

Cloud sync must be explicit.

Never silently move local health data to the cloud.


==================================================
PHASE 25 — SOCIAL + FRIENDS
==================================================

Social modes:

- Private
- Friends
- Community

User can change them.

Challenge controls independent:

- Personal
- Friends
- Community

Health data stays private by default.

Game/profile sharing may include:

- mascot
- level
- trophies
- cosmetics
- selected PBs
- selected activities

Sensitive data never becomes public automatically.


==================================================
PHASE 26 — JOURNEY WALL
==================================================

Goal:
Create a visual history of the user's journey.

Possible content:

- milestones
- trophies
- mascot evolutions
- personal bests
- major challenges
- Adventures
- programme changes
- special events
- founding status

Journey Wall should be:

- personal by default
- chronological
- visual
- accessible
- exportable where appropriate

Public sharing must be optional.


==================================================
PHASE 27 — CREWS
==================================================

Goal:
Create optional small-group social progression.

Crews may eventually support:

- shared challenges
- group milestones
- mascot showcases
- reactions
- crew trophies
- crew environments
- cooperative Adventures

Crews must not require public health data.

Members control what they share.

No pressure mechanics.


==================================================
PHASE 28 — GPS SEGMENTS
==================================================

Users can define route segments.

Example:

Castle Hill Climb
0.82 km

Record repeated efforts.

Primary view:

Personal

Optional:

Friends
Community

Segment data needs:

- GPS validation
- timing
- route matching
- privacy
- anti-cheat
- duplicate handling


==================================================
PHASE 29 — LEADERBOARDS / LEAGUES
==================================================

Default order:

1. Personal
2. Friends
3. Community

Personal competition remains primary.

Potential ability bands:

- Starter
- Bronze
- Silver
- Gold
- Elite

Do not automatically pit beginners against elite athletes.

Potential leaderboard categories:

- segment time
- distance
- event/challenge rankings
- selected community achievements

Route and privacy settings respected.

Game mechanics must never allow cosmetic ownership or purchases
to create competitive advantage.


==================================================
PHASE 30 — KUDOS / REACTIONS
==================================================

Lightweight social encouragement.

Possible reactions:

- Nice one
- Strong
- Smashed it
- PB
- custom NinFit-branded reactions later

Do not optimise for engagement spam.

Mascots also react to fitness events.

Event-driven reactions:

- workout complete
- partial completion
- rest day
- PB
- trophy
- level up
- return after absence
- programme progression
- evolution
- secret discovery


==================================================
PHASE 31 — INTELLIGENT PROGRAMME PROGRESSION
==================================================

NinFit can analyse actual history.

It may propose progression.

Example:

Suggested next week:
Increase two walks from 15 → 18 minutes.

Evidence shown briefly.

User options:

- Accept
- Modify
- Keep current plan

Never silently increase exercise.

Path reassessment:

Periodically check.

Only recommend change when enough meaningful data exists.

Rule:

No data, no guess.
Weak data, no confident recommendation.

Never automatically switch the user's path.


==================================================
PHASE 32 — SEASONAL EVENTS
==================================================

Goal:
Create occasional reasons to return without creating compulsive
engagement pressure.

Possible events:

- seasonal environments
- limited cosmetic sets
- mascot variants
- special Adventures
- community milestones
- event trophies
- event 1-Ups
- secret discoveries

Seasonal rewards:

Most return later where appropriate.

Original participants may retain provenance labels such as:

“Founding Season 2026”

Rare commemorative exclusives should be used sparingly.

No event should punish users for taking breaks.


==================================================
PHASE 33 — BETA HARDENING
==================================================

Before public launch deeply test:

- accessibility
- large text
- reduced motion
- colour blindness
- dark/light/system themes
- low-end Android
- iPhone
- tablets
- desktop
- mobile navigation
- desktop dashboard
- offline
- storage durability
- JSON backup/import
- GPS accuracy
- GPS battery use
- background GPS
- Health Connect
- HealthKit
- wearable reconciliation
- food scanner accuracy
- barcode failures
- privacy
- account deletion
- route privacy
- location masking
- security
- social controls
- anti-cheat
- leaderboard abuse
- performance
- bundle size
- app startup
- battery consumption
- mascot asset loading
- background asset loading
- lazy loading
- animation performance
- reduced-motion behaviour
- secret-game systems cannot alter fitness truth


==================================================
PHASE 34 — NINFIT V1 LAUNCH
==================================================

Final product loop:

ONBOARD
↓
MYSTERY EGG
↓
PERSONAL PROGRAMME
↓
NINFIT ID OPTIONAL
↓
MOVE
↓
TRACK TRUSTED FITNESS DATA
↓
YOU DID IT
↓
XP
↓
SKILLS
↓
PERSONAL BESTS
↓
TROPHIES
↓
MASCOT REACTION
↓
MASCOT EVOLUTION
↓
COSMETICS
↓
ADVENTURES
↓
DISCOVER SECRET CONTENT
↓
NEXT IMPROVEMENT

NinFit principle:

NEXT
IMPROVEMENT
NOW


==================================================
MASCOT UNIVERSE — LONG-TERM DESIGN
==================================================

NinFit mascots exist as a collectible universe.

Core families:

- Tortoise
- Bear
- Fox
- Otter
- Wolf

Opal is the canonical companion and first production mascot.

Future mascot families may be themed around:

- Nature
- Fire
- Water
- Air
- Light
- Technology
- Stars
- Sound
- Ancient / fantasy
- Seasonal worlds

Mascot families must have equal gameplay status.

No mascot provides a fitness advantage.

Mascot rarity is visual/collectible only.


==================================================
MASCOT EVOLUTION PHILOSOPHY
==================================================

Evolution:

Cute
↓
Confident
↓
Adventurous
↓
Athletic
↓
Elite
↓
Legendary

Evolution should feel earned.

Evolution can use:

- XP
- level
- activity milestones
- challenges
- Adventures
- path milestones
- special discoveries

Alternate evolutions may require unusual achievements.

Evolution is permanent.

Condition is temporary.


==================================================
MASCOT CONDITION PHILOSOPHY
==================================================

Mascot condition exists to make the journey feel alive.

It must never become a virtual-pet obligation.

The user does not have to:

- feed the mascot
- clean the mascot
- maintain happiness
- perform daily pet chores

The mascot reacts to the user's real journey.

The user is not responsible for keeping a fictional character alive.

The mascot always remains recoverable.

Return after absence should produce:

- warmth
- encouragement
- humour
- a simple next step

Never:

- guilt
- punishment
- shame
- loss of progress


==================================================
GAME ECONOMY RULES
==================================================

The game layer rewards:

- consistency
- effort
- exploration
- curiosity
- milestones
- achievements
- personal improvement

It must never reward:

- falsified activity
- unhealthy behaviour
- pain
- sleep deprivation
- overtraining
- leaderboard manipulation

Cosmetics:

Visual only.

No XP boosts.

No progression boosts.

No fitness advantage.

No pay-to-win.


==================================================
DEVELOPMENT RULE
==================================================

Do not jump randomly between roadmap phases.

Every workstream should:

1. inspect the repository first
2. define acceptance criteria
3. implement one bounded vertical slice
4. run tests
5. run typecheck
6. run build
7. manually verify relevant UI
8. report concerns
9. STOP
10. wait for approval before moving forward

New ideas go into the appropriate future roadmap phase instead of
interrupting the current workstream.

Repository remains the source of truth.

Fitness truth first.
Programme second.
Game layer third.
Social layer optional.
Human control always.

When a new feature is proposed, first determine which roadmap phase
owns it.

Do not create duplicate systems when an existing roadmap system
already provides the correct architectural home.

Prefer:

- reusable primitives
- central registries
- domain-driven state
- explicit boundaries
- testable rules
- progressive enhancement
- local-first behaviour
- lazy loading for optional/heavy features

Avoid:

- screen-specific business logic
- hardcoded unlocks scattered through UI
- random asset paths
- duplicated navigation logic
- duplicated theme logic
- hidden fitness-data mutation
- unnecessary dependencies
- large eagerly loaded game assets
- premature social infrastructure
- premature backend complexity


==================================================
NINFIT NORTH STAR
==================================================

NinFit should feel like:

A calm, trustworthy fitness tracker
+
a personal coach
+
a living mascot companion
+
a collectible adventure game
+
an optional social world.

The fitness is real.

The game celebrates it.

The mascot makes it feel alive.

The user remains in control.