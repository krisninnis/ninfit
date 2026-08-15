# NinFit Mascot & Game System v1

**Status:** Canonical product decision record  
**Scope:** Mascot, game, AI companion, habitat, legacy, prestige, rewards, and future Adventure systems  
**Repository:** `C:\Users\thoma\fitness-tracker`  
**Product:** NinFit  
**Version:** v1  
**Last updated:** 15 August 2026

---

## 1. Purpose

This document records the current product decisions for NinFit's mascot and game systems.

It exists so future development work does not depend on chat history or memory alone.

Use this document alongside the repository, roadmap, design documentation, and relevant `SKILL.md` files.

### Decision labels

- **LOCKED** — decided product direction. Do not casually change during implementation.
- **DIRECTION** — agreed concept, but implementation details still need specification.
- **FUTURE** — intentionally not part of the current implementation milestone.
- **OPEN** — requires a later product decision before implementation.

Repository truth always overrides stale implementation details in this document.

---

## 2. Product North Star — LOCKED

NinFit is becoming:

> A premium fitness companion app where real fitness progress drives a long-term creature-collection and progression game.

Core relationship:

> **FITNESS IS THE PRODUCT. THE GAME IS THE EMOTIONAL REINFORCEMENT LAYER.**

Product North Star:

> **CALM BY DEFAULT. ENERGY EARNED. SHOWING UP CELEBRATED.**

NinFit should be especially welcoming to:

- beginners
- people returning to fitness
- users intimidated by conventional fitness apps
- people whose fitness journey includes recovery and rest

---

## 3. Non-negotiable product principles — LOCKED

- Fitness comes first.
- Give the user one obvious next action.
- Personal progress matters more than comparison.
- Social features are optional.
- Calm is the default.
- Energy and celebration are earned.
- Partial completion counts.
- Planned rest is part of the programme.
- No guilt.
- No broken-streak punishment.
- No red generic failure state.
- Health data is private by default.
- No pay-to-win.
- No paid loot boxes.
- No paid random eggs.
- Missing data remains missing.
- Never fabricate health or fitness readings.
- Never fabricate activity completion.
- Never fabricate PBs, XP, trophies, progression, or rewards.
- Never diagnose.
- Preserve data provenance.
- Permanent mascot progress is never removed because of inactivity.
- Mascots never die, starve, or become sad because the user missed exercise.
- Sustainable activity must beat overtraining.
- Rest, recovery, illness, holidays, and life interruptions must never be framed as failure.

Preferred return language:

> **Good to see you.**

---

# PART I — CORE MASCOT SYSTEM

## 4. Mascot art direction — LOCKED

Mascots should be:

- recognisable real-animal-based creatures
- premium creature-collecting-game art
- expressive
- slightly exaggerated
- strong silhouettes
- soft cel-shaded / premium mobile-game finish
- not photorealistic
- not chibi
- adult enough for a premium fitness product

Starter mascots should feel:

> **YOUNG AND CAPABLE**

not helpless or babyish.

NinFit may draw inspiration from the emotional qualities of creature-collection games and virtual companions, but must not copy protected character designs, silhouettes, names, or franchise-specific visual language.

---

## 5. Starter species — LOCKED

Launch target:

- Tortoise
- Bear
- Fox
- Otter
- Wolf

These are the current intended five core starter species.

---

## 6. Five permanent mascot stages — LOCKED

Persisted internal stage IDs remain:

1. `starter`
2. `growing`
3. `capable`
4. `advanced`
5. `elite`

Do not rename stored IDs without an explicitly authorised migration.

Product-facing labels are:

1. Starter
2. Growing
3. Active
4. Athletic
5. Champion

Change intensity:

- Starter → Growing: subtle
- Growing → Active: moderate
- Active → Athletic: stronger
- Athletic → Champion: dramatic

Permanent progression should show increasing:

- capability
- energy
- posture
- confidence
- learned activity skills
- gear/accessories

Do not communicate:

> thin = fit

Do not use body weight or BMI as mascot progression criteria.

---

## 7. Permanent appearance vs temporary condition — LOCKED

Permanent growth and temporary condition are separate systems.

Current temporary condition vocabulary:

- `energised`
- `normal`
- `resting`
- `slouch`
- `max_chill`

Temporary condition should be:

- derived
- adaptive to the user's programme
- reversible
- never persisted as a judgement about the person

One missed workout should normally do nothing.

Planned rest never counts as failure.

Long inactivity may change mascot presentation through:

- posture
- energy
- clothing
- environment
- comedy props

Possible Maximum Chill props include:

- hoodie
- joggers
- slippers
- beanbag
- blanket
- remote
- takeaway carton
- snack bag

Do not call the mascot "fat".

Return messaging remains warm.

---

## 8. Starter selection — DIRECTION

Starter selection should eventually be:

> **CURATED RANDOM**

not pure random.

Hidden weighting may use:

- fitness path
- onboarding preferences
- personality input

Before hatch:

- no species name
- no species silhouette
- no species-specific clue
- no future starter-selection leakage

After the first reveal, the user gets one subtle one-time:

> **Not for me**

reroll.

No paid rerolls.

---

## 9. Naming — LOCKED

At hatch:

- mascot receives a default name
- default pool may depend on species, personality, and presentation

User may rename the mascot at any time.

---

## 10. Personality — LOCKED

Personality follows:

> **Nature + Shared History**

Species provides a base personality.

Possible tendencies include:

- calm
- playful
- determined
- adventurous

Onboarding may slightly shape the individual.

Over time, shared experiences can add secondary traits and quirks.

Examples:

- loves morning walks
- celebrates strength PBs
- falls asleep during recovery sessions
- develops attachment to a favourite accessory

These are not stats to optimise.

Temporary inactivity never makes the mascot's core personality worse.

---

## 11. Favourite activities — LOCKED

Mascot favourite activities develop through shared history.

Species/personality may create initial tendencies, but real favourites emerge from the user's actual fitness journey.

A passport may eventually show:

- Favourite activity
- Also loves
- Signature activity

Champion may permanently record favourites from that chapter of the user's journey.

---

## 12. Shared Journey Bond — LOCKED

Mascots develop a bond with the user through meaningful shared experiences.

Bond may grow through:

- completed planned activities
- planned recovery/rest
- returning after time away
- PBs
- milestones
- stage progression
- favourite activity discoveries
- trophies
- Secret Prestige
- Champion moments
- evolution moments

Bond:

- grows
- never decays
- is not a Tamagotchi-style maintenance meter
- should not be grindable through pointless tapping

Possible bond labels include:

- New Companion
- Getting to Know You
- Training Partners
- Trusted Partners
- Lifelong Partners

Exact product wording may be refined later.

---

## 13. Daily mascot interaction frequency — LOCKED

Use a few meaningful interactions rather than constant interruption.

Typical active day:

> approximately 2–4 meaningful mascot interactions

Interactions should be context-driven rather than rigidly timer-driven.

Possible moments:

- first app visit
- completed activity
- planned rest/check-in
- earned milestone

Quiet days stay quiet.

The mascot never demands attention because the user has not opened NinFit.

---

## 14. Contextual daily greeting — LOCKED

On first meaningful visit of the day, mascot may give a short contextual greeting using trusted context such as:

- today's plan
- rest/recovery state
- recent meaningful shared event
- current mascot condition
- personality
- favourite activities
- return after absence

Greeting should usually be brief.

Deeper conversation happens only if the user engages.

---

# PART II — MEMORIES, LEGACY & CHAMPION

## 15. Living Memory Book — LOCKED

NinFit automatically captures a small, curated number of meaningful memories.

Examples:

- first activity together
- PB
- milestone
- Champion
- return after time away
- Legacy interaction
- seasonal event
- funny mascot incident

Users may later be allowed to save selected memories themselves.

Do not record negative failure memories such as:

- missed-workout counts
- broken-streak history
- guilt-oriented absence summaries

Memories remain attached to the mascot after Champion.

---

## 16. Champion Ceremony — LOCKED

Champion is one of NinFit's major emotional payoffs.

Preferred flow:

1. User completes the real activity/milestone that earns Champion.
2. NinFit indicates that something special has happened.
3. User explicitly starts the Champion ceremony when ready.
4. Shared journey highlights are shown.
5. Earlier mascot stages may briefly appear.
6. Champion form is revealed.
7. Signature Champion presentation appears.
8. Permanent Champion record/relic is awarded.
9. Legacy Champions may attend.
10. User gets time with Champion before starting the next Legacy chapter.

Champion must not feel like:

> Congratulations — now we're replacing your mascot.

---

## 17. Champion Relic — LOCKED

Every Champion leaves a permanent personalised relic.

The relic may reflect:

- species
- generation
- dominant activity journey
- meaningful achievements
- bond
- Secret Prestige

Relics are not generic identical cups.

Champion Relics cannot be bought.

Over time, the Trophy Room becomes a visual history of the user's real fitness journey.

---

## 18. Living Legacy — LOCKED

Old Champions are never deleted.

After passing the Legacy forward:

- old Champion moves into the collection
- passport remains
- bond remains
- memories remain
- appearance remains
- achievements remain

Old Champions may:

- naturally visit around meaningful moments
- be deliberately invited back
- interact with the active mascot
- attend hatch/Champion/Legacy moments

Meaningful visit triggers may include:

- new hatch
- PB
- Champion promotion
- anniversary
- favourite shared activity
- Secret Prestige
- return after absence

---

## 19. Lightweight Living Family — LOCKED

Legacy mascots remember predecessor/successor relationships.

They may occasionally have personality-driven interactions.

Examples:

- old Champion encouraging successor
- playful mascots chasing each other
- calm mascot sleeping nearby
- generations celebrating a new Champion
- first-ever mascot returning for a major milestone

Do not build a full mascot-to-mascot relationship simulator.

No friendship meters between every mascot.

---

## 20. Legacy Memories — LOCKED

Rare mascot-to-mascot interactions may become permanent Legacy Memories.

Example:

> **Legacy Memory discovered**  
> Atlas showed Pip his old training spot.

These are story/memory rewards, not gameplay power.

---

## 21. Legacy inheritance — LOCKED

New mascot may inherit:

1. one subtle visual legacy token
2. one personality tendency
3. one legacy badge

Inheritance is cosmetic/personality only.

No gameplay power inheritance.

---

## 22. Legacy Tree + passports — DIRECTION

Long-term system:

> **Legacy Tree + individual mascot passports**

Passport may eventually contain:

- name
- species
- presentation
- rarity
- variant
- personality
- hatch date
- Champion date
- favourite activities
- unlocked outfits
- signature animations
- trophies
- predecessor
- inherited visual trait
- inherited personality trait
- legacy badge
- what was passed forward
- bond
- memories
- Secret Prestige discoveries

Goal:

> years of real fitness become a personal creature lineage, not only charts.

---

# PART III — PRESTIGE, RARITY, COSMETICS & SECRETS

## 23. Secret Prestige — LOCKED

NinFit has hidden achievement-only prestige cosmetics.

Secret Prestige recognises sustained personal progress and consistency.

It should not be based purely on absolute athletic performance.

Potential inputs may include:

- repeated personal bests relative to the user
- sustained personalised-plan consistency
- meaningful long-term engagement
- major Legacy achievements

Potential prestige progression:

- Opal mark
- species-specific feature/cape
- wings/aura
- ultimate Legacy effect

Secret Prestige:

- cannot be bought
- is permanent once earned
- does not affect capability
- does not alter XP
- does not alter evolution power
- is separate from normal rarity

Before first discovery, NinFit may only hint:

> some mascots develop rare traits through exceptional journeys

After first discovery, a Secret Prestige passport section may appear.

Exact undiscovered formulas remain hidden.

---

## 24. Secret Prestige discovery style — LOCKED

Use:

> **Rumoured → discovery system**

Before unlock:

- subtle hints only

On first unlock:

> **SECRET TRAIT DISCOVERED**

The passport then exposes a Secret Prestige section without revealing exact formulas for future discoveries.

---

## 25. Rarity — LOCKED

Possible cosmetic variant rarity:

- Normal
- Uncommon
- Rare
- Epic
- Legendary

Rarity is cosmetic only.

No capability advantage.

Use:

> **Curated surprise + protection**

Do not use cruel pure RNG.

Long-term Legacy participation can improve opportunities or eligibility.

Legendary should not simply mean:

> 0.1% random chance

Rarity and prestige are separate systems.

A Normal mascot may become more prestigious than a Legendary through the journey they share with the user.

---

## 26. Smart Wardrobe — LOCKED

User controls the mascot's core personal look.

NinFit may temporarily add appropriate contextual gear.

Examples:

- cycling helmet
- yoga accessory
- trainers
- goggles
- recovery clothing
- seasonal accessory

When context ends, return to the user's selected outfit.

Possible future saved looks:

- Everyday
- Training
- Smart
- Favourite

Secret Prestige pieces must not be silently hidden by normal automatic gear.

---

## 27. Old-school secrets & cheat codes — LOCKED

NinFit may include:

- secret phrases
- hidden interaction sequences
- developer Easter eggs

Possible harmless effects:

- strange outfits
- retro/pixel presentation
- large-head mode
- unusual idle animation
- disco habitat
- hidden sound set
- temporary joke cosmetics

Cheats may change fun.

Cheats must never fake achievement.

They cannot modify or fabricate:

- activity history
- health data
- PBs
- XP
- levels
- trophies
- evolution eligibility
- Secret Prestige
- Champion
- fitness measurements

Cheat cosmetics must remain visually distinct from earned Secret Prestige.

---

# PART IV — HABITAT, TROPHY ROOM & SEASONS

## 28. Evolving Personal Habitat — LOCKED

The active mascot lives in a NinFit habitat that evolves through its journey.

The habitat may be influenced by:

- personality
- favourite activities
- mascot stage
- trophies
- Legacy
- Secret Prestige
- seasons
- earned decorations
- user-selected cosmetics

Examples:

- yoga mat becomes a familiar permanent object
- walking/adventure mementos accumulate
- Maximum Chill mascot somehow acquires a suspiciously permanent beanbag

Species may influence how the mascot uses the room without requiring completely separate environments for every species.

No maintenance chores.

No:

- cleaning meter
- feeding requirement
- decaying furniture
- habitat punishment

The habitat is a reward space, not another responsibility.

---

## 29. Light Interactive Sandbox — LOCKED

Habitat interaction should be optional and light.

Possible interactions:

- tap beanbag → mascot flops into it
- tap yoga mat → approved pose
- tap trophy → mascot reacts to memory
- tap Legacy object → old mascot may appear
- seasonal interactions
- harmless hidden sequences
- rare animations
- Easter eggs

Do not turn the habitat into a mini-game-heavy second product.

---

## 30. AI Habitat Director — LOCKED

AI may select from approved:

- habitat states
- interactions
- decorations
- mascot behaviours
- Legacy interactions

Examples:

- recovery day → quiet corner
- walking consistency → highlight walking memento
- Champion anniversary → relevant relic display
- Halloween → approved seasonal state
- Maximum Chill → beanbag/blanket/comedy setup

AI cannot invent permanent rewards or arbitrary unapproved assets.

---

## 31. Living Trophy Room — LOCKED

The Trophy Room:

- naturally develops through achievement
- allows optional personalisation
- houses Legacy mascots
- displays Champion Relics
- contains rare discoveries and Easter eggs

Major accomplishments may unlock new:

- displays
- alcoves
- walls
- spaces
- Legacy sections
- PB displays
- Secret Prestige areas

It should feel like:

> a personal NinFit clubhouse built by years of showing up

rather than a static achievements screen.

---

## 32. Living Seasons + Permanent Memories — LOCKED

Seasonal content may include:

- Halloween
- Christmas
- summer
- anniversaries
- other special events

The world may change through:

- habitat decorations
- Trophy Room details
- seasonal mascot behaviour
- optional activities/challenges
- seasonal cosmetics

Avoid FOMO.

Missing a seasonal event is not failure.

Many seasonal cosmetics should be allowed to return.

Dated rewards should represent memories, not broken collections.

Example:

> First NinFit Christmas — 2026

---

# PART V — ACTIVITY, QUESTS & INTERACTION

## 33. Activity-aware mascots — DIRECTION

Mascots should eventually visually participate in:

- yoga
- walking
- running
- cycling
- strength
- mobility/stretching
- swimming
- recovery/rest

Each permanent stage may show more advanced activity presentation.

Example yoga progression:

- Starter → simple seated stretch
- Growing → basic balance
- Active → intermediate pose
- Athletic → advanced pose
- Champion → signature pose

Champion may unlock signature activity-specific animation.

An advanced mascot pose must never imply the user should attempt it.

Activity mirroring should be adaptive:

- yoga/mobility: more frequent
- running/cycling/walking: mostly ambient/checkpoints
- strength: between-set/contextual
- recovery: intentional rest pose

---

## 34. Programme-aware Mascot Quests — LOCKED

Mascots may offer optional quests.

Quest rule:

> **The game can encourage the programme. It cannot escalate the programme.**

Do not issue generic targets that conflict with the user's plan.

Good:

> Complete one of today's planned activities together.

Good recovery example:

> Today's mission is taking it easy. Check in when you've had your planned recovery.

Bad:

> Run 5K today for a cosmetic.

No mascot should encourage harder, longer, or more frequent exercise solely to obtain game rewards.

---

# PART VI — AI INTELLIGENCE LAYER

## 35. AI product role — LOCKED

NinFit uses:

> **AI Intelligence Layer**

Core architecture:

> **Rules determine reality. AI makes reality feel personal.**

Trusted deterministic systems own:

- fitness truth
- health-data truth
- programme constraints
- reward eligibility
- XP
- PBs
- trophies
- hatch progression
- stage progression
- Champion
- Secret Prestige eligibility
- evolution eligibility
- persistence
- provenance
- safety limits

AI may own:

- wording
- explanation
- personalisation
- summarisation
- personality expression
- dialogue
- memory narration
- contextual relevance
- safe option presentation
- selection among approved animations

Core NinFit must still work if AI is unavailable.

---

## 36. Mascot + Expert Engine — LOCKED

The mascot is the relationship/personality layer.

An underlying NinFit Expert Engine handles bounded reasoning over:

- verified data
- programme rules
- safety boundaries
- user preferences
- approved knowledge

The user can talk naturally to the mascot without needing to understand internal architecture.

The mascot does not independently invent workouts or medical advice.

---

## 37. Character conversation with boundaries — LOCKED

Mascots may hold natural conversations rooted in being fitness companions.

They may discuss:

- today's activity
- programme
- progress
- favourite activities
- mascot memories
- trophies
- outfits
- habitat
- Legacy mascots
- quests
- returning after time away
- light everyday banter

Mascot is not:

- a general-purpose therapist
- a doctor
- an autonomous clinician
- an unlimited life assistant

---

## 38. Curated Companion Memory — LOCKED

Mascot AI may remember selected long-term context that improves the fitness relationship.

Examples:

- favourite activities
- preferred workout times
- goals the user explicitly wants remembered
- encouragement style
- routine preferences
- names/nicknames
- meaningful mascot memories
- return-from-break context
- Legacy/Champion history

Do not silently build an unlimited personal dossier.

Important remembered items should be inspectable and removable.

Verified fitness history remains separate from AI memory.

---

## 39. AI Director — LOCKED

AI may choose from a library of approved mascot behaviours.

Example inputs:

- verified event
- mascot personality
- bond
- condition
- available approved animations

AI may choose:

- quiet-proud pose
- victory spin
- excited hop
- calm nod
- Legacy interaction

AI does not determine whether the event happened.

AI directs approved content; it does not invent achievement or truth.

---

## 40. Layered voice system — LOCKED

Voice is optional.

Direction:

1. optional short voiced moments
2. stylised/softened species sounds
3. optional full spoken conversation later

Voice, sound effects, music, haptics, and motion preferences remain independent.

No essential information may exist only in sound.

---

## 41. Deterministic Quest + AI Story Layer — LOCKED

Trusted logic determines:

- valid quest
- completion conditions
- reward
- programme boundary
- whether day is activity/rest/recovery

AI determines:

- wording
- personality
- narrative framing
- contextual presentation

AI may not invent unsafe new objectives.

---

## 42. Guardrailed Adaptive Programme — LOCKED

NinFit may learn what works for the user.

Programme adaptation may go:

- upward
- downward

Meaningful changes should be:

- explainable
- visible
- within safe deterministic boundaries
- user-involved

Example:

> We've finished the 20-minute walks much more consistently than the 30-minute ones. Want to make 20 minutes our normal target for now?

Do not automatically equate more with better.

Sustainable adherence beats overtraining.

---

## 43. Gentle Context Check-In — LOCKED

One missed workout should not trigger intervention.

If a meaningful pattern of reduced engagement develops, NinFit may gently ask for context.

Possible responses:

- Keep going
- Make it lighter
- I'm taking a break
- I'm recovering
- Something else

No answer represents failure.

If the user intentionally takes a break:

- stop nagging
- remove streak pressure
- preserve permanent progress
- allow relaxed mascot behaviour

On return:

> **Good to see you.**

Do not say:

> You missed 23 workouts.

---

## 44. Layered Progress Reviews — LOCKED

Use:

### Weekly check-in
Short and encouraging.

Possible content:

- what went well
- personalised consistency
- meaningful PBs/milestones
- recovery/rest adherence
- one sensible focus

### Monthly Journey Review
Deeper review of:

- activity trends
- programme adaptations
- meaningful fitness patterns
- nutrition habits if enabled
- favourite activities
- mascot growth
- memories
- trophies
- what appears to work best

AI tells the story.

Underlying facts come from trusted NinFit data.

---

# PART VII — NUTRITION

## 45. Personal Nutrition Companion — LOCKED

Nutrition should be:

- practical
- flexible
- food-positive
- non-punitive
- optional in depth

Possible support:

- meal ideas
- snack ideas
- hydration
- protein/fibre awareness
- food preferences
- dislikes
- budget-conscious options
- shopping lists
- meal prep
- recovery meal suggestions
- gradual habit improvement
- food pattern summaries
- optional calories/macros

Do not make calorie tracking mandatory.

Avoid punitive language such as:

> You exceeded your calories today.

---

## 46. Multimodal Smart Logging — LOCKED

Food logging may support:

- photo
- voice
- natural-language text
- barcode
- favourites/recent meals
- manual entry

AI may estimate meal content.

Uncertain information must be clearly marked.

User should confirm uncertain estimates before NinFit treats them as trusted nutrition data.

Preserve provenance such as:

- measured
- user-entered
- imported
- AI-estimated
- user-confirmed

Rule:

> **AI may estimate. NinFit must never pretend an estimate was measured.**

---

## 47. Professional boundary — LOCKED

Do not present an AI model as a registered dietitian/dietician, clinician, physiotherapist, or other regulated professional unless NinFit actually includes appropriately qualified professional oversight and the product claim is legally justified.

AI may provide bounded general support.

Clinical or medical nutrition decisions require stronger professional governance/escalation.

---

# PART VIII — OPAL EGG & HATCHING

## 48. Opal Egg art direction — LOCKED

Egg should be:

- hybrid realistic/stylised
- natural egg silhouette
- approximately 10–15% wider/rounder
- milky opal material
- restrained green/blue/faint violet iridescence
- premium creature-game rendering
- path-neutral
- species-neutral
- no silhouette leak before hatch

---

## 49. Hatch visual sequence — DIRECTION

Long-term sequence:

1. pristine Opal Egg
2. tiny hairline crack
3. branching cracks
4. larger cracks
5. subtle shell movement
6. hatch-ready
7. user explicitly taps Hatch
8. crack sequence accelerates
9. shell opens into two halves
10. Opal light
11. mascot appears
12. first species sound
13. reveal/name moment

Animal remains secret until final split.

---

## 50. Current M2 egg-state direction — LOCKED FOR CURRENT WORKSTREAM

Persisted `EggState` remains:

- `unhatched`
- `ready`
- `hatched`

Do not add a persisted `cracking` state merely to represent visual crack progress.

Crack progress should be derived.

Current approved M2 product direction:

- use append-only activity reward-key history for monotonic progression
- do not use reversible live active-day count for permanent crack stage
- duplicate same-day activity contributes one qualifying day
- rest does not advance M2 crack progression
- historical sealed activity keys count
- crack stage never heals
- hatch remains explicit
- no auto-hatch
- species secrecy remains intact
- no schema migration merely for derived crack stage

Current intended new-user journey:

- 0 qualifying days → pristine
- 1 → crack stage 1
- 2 → crack stage 2
- 3 → crack stage 3
- 4 → crack stage 4
- 5 → crack stage 5
- 6 → hatch-ready

Existing `ready` or `hatched` states must not be pushed backwards.

Visual crack rendering remains separate from the state-machine milestone.

---

# PART IX — TROPHIES, STREAKS & REWARDS

## 51. Consistency rewards — LOCKED DIRECTION

Use:

- short streak bonuses
- weekly personalised consistency

Approved short streak direction:

- 3-day bonus
- 7-day bonus

Main progression is based on sustainable personalised-plan adherence.

Planned rest can count as successful adherence.

Missing a streak causes:

- no punishment
- no XP removal
- no mascot sadness
- no permanent loss

Rewards may escalate from:

- XP
- earned currency

to:

- cosmetics
- habitat items
- sounds
- poses
- animation unlocks
- legacy rewards

---

## 52. Reward randomness — LOCKED

Use:

> guaranteed reward + optional transparent surprise cosmetic bonus

Surprise reward must come from a clearly defined non-paid cosmetic pool.

No paid mystery boxes.

---

# PART X — ADVENTURES & LOCATION

## 53. NinFit Adventures — DIRECTION

NinFit may eventually offer opt-in real-world Adventures using location/activity evidence.

Examples:

- hiking routes
- hills
- mountains
- walking trails
- cycle routes
- parks
- landmarks
- curated NinFit challenges

Example concept:

> Reach/complete a qualifying Pen y Fan summit Adventure in Bannau Brycheiniog, Wales.

The goal is not to copy Pokémon GO.

NinFit should encourage users to enjoy the real-world activity rather than stare at the phone while moving.

---

## 54. Location privacy — LOCKED DIRECTION

Location features must be:

- explicit opt-in
- private by default
- minimal in retained data
- clear about what is collected
- never automatically socially shared

Sharing an Adventure must never reveal live location by default.

Health data must not be bundled into a public Adventure share card.

---

## 55. Adventure safety — LOCKED DIRECTION

Adventure mechanics must not pressure users into unsafe behaviour.

Do not use mechanics such as:

> Climb this mountain today or lose the reward.

Adventure design may need to account for:

- route difficulty
- weather
- GPS uncertainty
- altitude
- accessibility
- local conditions
- user programme compatibility

A real-world achievement should be verified using sensible evidence and tolerances rather than a single brittle GPS point.

Exact verification architecture remains a later specification.

---

## 56. Adventure Discovery rewards — DIRECTION

Major Adventures may have layered rewards.

Possible structure:

### Normal completion
Permanent Adventure badge/relic.

### Special Adventure
Earned cosmetic for the mascot who accompanied the user.

### Exceptional/secret Adventure
A Secret Adventure Mascot discovery.

Secret Adventure Mascots should feel genuinely discoverable.

A possible reveal:

> an unfamiliar Opal Egg appears later in the habitat

The system should not necessarily tell users in advance which Adventures contain secret mascots.

---

## 57. Adventure Mascots — LOCKED DIRECTION

Adventure Mascots:

- are separate from the active Legacy mascot
- do not replace the active mascot
- represent real-world exploration achievements
- live in their own collection
- can support optional social bragging/sharing
- do not expose health data
- do not expose live location

They may be inspired by:

- mountains
- forests
- coastlines
- cycling routes
- regional environments

They should remain original NinFit creatures and not copies of existing game characters.

---

## 58. Adventure Vault — LOCKED DIRECTION

Adventure Mascots belong in a separate:

> **ADVENTURE VAULT**

not the ordinary Legacy collection.

The Vault may show:

- mascot
- Adventure
- region
- date discovered
- category
- rarity
- first-time discovery status
- share card

Adventure discoveries can function as optional social bragging rights.

---

## 59. Adventure social sharing — LOCKED DIRECTION

Users may optionally share:

- individual Adventure Mascot
- Adventure completion card
- rare discovery
- regional milestone
- selected Vault profile

Share cards should emphasise:

- achievement
- creature art
- Adventure identity

Do not automatically share:

- live location
- route start/end if privacy-sensitive
- health metrics
- private programme details

---

## 60. Adventure Atlas + Vault — OPEN

Current recommendation:

> **Adventure Atlas + Vault**

Potential organisation:

### By geography
- Wales
- Scotland
- England
- Europe
- future regions

### By Adventure type
- Mountains
- Coastal
- Trails
- Cycling
- Woodland
- Urban/landmark exploration

The Vault would hold discoveries.

The Atlas would show where the user's fitness journey has taken them.

This has been proposed but not yet formally locked by user Q&A.

---

# PART XI — SOCIAL

## 61. Social principles — LOCKED

Social is:

- optional
- private by default
- achievement-oriented rather than pressure-oriented

Possible shareable items:

- one mascot
- Champion form
- Legacy Tree branch
- milestone card
- selected collection profile
- Adventure discovery
- Adventure Vault card

Never expose health data automatically.

---

# PART XII — ART PRODUCTION STRATEGY

## 62. Art combinatorics constraint — LOCKED

Do not naively create:

> species × stages × presentations × activities × conditions × cosmetics

as thousands of separate final renders.

Preferred production strategy:

- canonical base mascot form
- presentation via layers where practical
- activity groups rather than art for every tiny activity
- condition overlays mainly on idle states
- cosmetic slots attached to stable anchor points
- prove the art/rig strategy using ONE species first

Do not commission or generate hundreds of final mascot assets until the one-species proof works.

---

# PART XIII — ROADMAP

## 63. Current mascot roadmap — DIRECTION

Approximate roadmap:

- **M1 — Mascot Domain Foundation** — COMPLETE
- **M2 — Opal Egg State Machine** — CURRENT WORKSTREAM
- **M2.5 — Short streak / adherence bonuses**
- **M3a — One starter species + five-stage art/rig proof**
- **M3b — Remaining four starter species**
- **M4 — Hatch sequence + passport + curated starter selection + one reroll**
- **M5 — Activity-aware poses**
- **M6 — Temporary condition/comedy states**
- **M7 — Collection + mascot passport UI**
- **M8 — Branching evolution + legacy inheritance**
- **M9 — Cosmetics**
- **M10 — Habitat**
- **M11 — Shop/economy**
- **M12 — Optional social sharing**

Future systems such as AI, Adventure Vault, Living Trophy Room, and broader habitat intelligence need to be integrated into the roadmap deliberately rather than started opportunistically.

Repository architecture may justify changing milestone ordering.

---

# PART XIV — IMPLEMENTATION BOUNDARIES

## 64. Product Q&A is not implementation — LOCKED

Discussing and locking a concept does not authorise implementation.

Implementation happens through explicit milestones/tasks.

Do not automatically:

- modify repository
- stage
- commit
- push
- merge
- deploy
- install dependencies
- rewrite schema
- start future milestones

because a product idea appears in this document.

---

## 65. AI implementation boundary — LOCKED

Before adding an AI-powered feature, identify:

1. trusted input facts
2. deterministic boundaries
3. allowed AI outputs
4. forbidden AI outputs
5. fallback behaviour
6. persistence policy
7. provenance
8. user control
9. safety escalation
10. hallucination-sensitive tests

If these are unclear:

> investigate before implementation

---

## 66. Adventure implementation boundary — LOCKED

Before implementing location Adventures, create a dedicated specification covering at minimum:

- explicit consent
- permission lifecycle
- background location policy
- local vs server processing
- retained location granularity
- route/POI data sources
- route licensing
- GPS tolerance
- spoofing/cheating posture
- offline behaviour
- accessibility
- dangerous-route handling
- weather integration if used
- completion verification
- data deletion
- social privacy
- child/teen considerations if applicable
- jurisdiction/privacy requirements
- battery impact

Do not casually add background location tracking during unrelated milestones.

---

# PART XV — OPEN PRODUCT DECISIONS

## 67. Current open items

These are intentionally not yet locked:

### Adventure Atlas organisation
Whether the final product uses the proposed:

> Adventure Atlas + Vault

structure exactly as described.

### Secret Adventure Mascot rules
Exact rules for:
- which Adventures qualify
- whether all countries/regions receive equivalents
- rarity
- repeat completion
- route variants
- accessibility alternatives
- discovery thresholds

### Adventure verification
Exact method for proving meaningful completion without brittle GPS logic or unsafe incentives.

### AI commercial/service architecture
Exact:
- model providers
- local/cloud split
- cost controls
- offline fallback
- privacy architecture
- consent
- retention

### Nutrition governance
Exact boundary between:
- general nutrition support
- condition-specific nutrition
- regulated professional oversight

### Voice architecture
Exact voice provider, local/cloud choice, privacy, and cost.

### Habitat implementation
Exact 2D/3D/rig technology and rendering architecture.

### Secret Prestige formulas
Exact hidden criteria remain intentionally unspecified.

---

# PART XVI — SUMMARY CONTRACT

## 68. The NinFit mascot/game contract

NinFit should become a fitness product where:

- real activity grows a long-term creature journey
- mascots become more individual through shared history
- rest is respected
- absence is not punished
- old Champions remain part of the user's world
- achievements leave permanent visual history
- secrets reward curiosity
- prestige rewards real personal consistency
- AI makes the experience personal without becoming the source of truth
- nutrition support stays practical and non-punitive
- habitats and Trophy Rooms evolve through the journey
- real-world Adventures can eventually populate a separate Adventure Vault
- social sharing celebrates selected achievements without exposing health/location data
- the game never pressures users into unsafe exercise
- no amount of money can buy fake fitness prestige

The long-term emotional goal is:

> **Years of real fitness become a living personal history of creatures, memories, places, trophies, and achievements.**
