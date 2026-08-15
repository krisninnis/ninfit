# NinFit AI Intelligence Layer

## Purpose

Use this skill for any AI-powered NinFit feature including mascot conversation, plan explanation, programme adaptation, nutrition support, multimodal logging, memories, quests, progress reviews, voice, AI-directed animation, or contextual personalisation.

Core rule:

**Rules determine reality. AI makes reality feel personal.**

## Layer model

### NinFit trusted systems own:
- fitness truth
- health-data truth
- programme constraints
- reward eligibility
- XP
- PBs
- trophies
- egg/hatch progression
- Champion eligibility
- Secret Prestige eligibility
- evolution eligibility
- persistence
- provenance
- safety limits

### AI may own:
- wording
- explanation
- summarisation
- personalisation
- personality expression
- contextual relevance
- dialogue
- memory narration
- safe choice ordering
- selection among approved animations
- transformation of trusted facts into story

AI is not the database, referee, or medical professional.

## Core fallback

Core NinFit must still function if AI is unavailable.

AI failure must not block:
- logging
- tracking
- fitness data
- core programme
- deterministic rewards
- progression
- hatch
- Champion
- collection

## Mascot + Expert Engine

The mascot is the relationship and personality layer.

The expert/intelligence layer performs bounded reasoning over trusted NinFit context.

The user may talk naturally to the mascot without exposing internal architecture.

Example:
- User asks: “What should I do today?”
- Trusted programme determines valid options.
- AI explains the valid option in mascot voice.

Do not let the mascot invent a workout beyond allowed programme boundaries.

## Character conversation with boundaries

Mascots may discuss:
- today’s activity
- progress
- programme
- favourite activities
- mascot memories
- trophies
- outfits
- habitat
- Legacy mascots
- quests
- returning after absence
- light everyday banter

Mascot is not an all-purpose therapist, doctor, or life assistant.

## Curated Companion Memory

Long-term AI memory should be deliberately limited.

Appropriate remembered context may include:
- favourite activities
- preferred workout times
- goals the user explicitly wants remembered
- encouragement style
- routine preferences
- meaningful mascot memories
- relevant return-from-break context
- Legacy/Champion history
- names/nicknames

Do not silently build an unlimited personal dossier.

Important remembered items should be inspectable and removable by the user.

Keep verified fitness history separate from AI memory.

## AI Director

AI may choose among approved mascot behaviours.

Example inputs:
- verified event
- mascot species
- personality
- bond
- current condition
- available approved animations

AI may select:
- proud pose
- excited hop
- calm nod
- celebration
- Legacy interaction

AI does not determine whether the underlying event occurred.

Do not let AI freely generate unreviewed physical actions that could create safety or visual-consistency problems.

## Deterministic Quest + AI Story Layer

Trusted logic determines:
- objective
- completion rule
- reward
- safety boundary
- whether today is activity/rest/recovery

AI determines:
- wording
- personality
- presentation
- narrative flavour

No AI-generated quest may escalate the user beyond the safe programme merely for game rewards.

## Guardrailed adaptive programme

AI may notice patterns and propose programme changes.

Meaningful adaptation should be:
- explainable
- visible
- within deterministic safe boundaries
- allowed to go down as well as up
- user-involved for significant changes

Preferred interaction:
- AI notices a consistent pattern
- explains what it noticed
- offers a small set of safe choices
- user accepts or declines

Do not assume more activity is always better.

## Gentle Context Check-In

Do not react to one missed workout.

If a meaningful drop in engagement appears, AI may gently ask for context.

Possible user choices:
- keep plan
- make it lighter
- taking a break
- recovering
- something else

No option should represent failure.

Return messaging should be warm.

Preferred:
**“Good to see you.”**

Avoid:
- “You missed 23 workouts.”
- guilt
- broken-streak framing

## Layered progress reviews

Use:
- short weekly check-ins
- deeper monthly Journey Reviews

AI may summarise:
- what went well
- personalised consistency
- meaningful PBs
- recovery adherence
- useful trends
- favourite activities
- programme adaptations
- mascot growth
- memories/trophies

Underlying facts must come from trusted NinFit data.

## Nutrition support

Prefer the product framing:

**Personal Nutrition Companion**

AI may help with:
- meal ideas
- snack ideas
- hydration
- protein/fibre awareness
- preferences/dislikes
- budget options
- shopping lists
- meal prep
- workout/recovery meal suggestions
- habit improvements
- food-pattern summaries
- optional calorie/macronutrient tracking

Default experience should be food-positive and low-pressure.

Avoid punitive food language.

## Professional boundaries

Do not present an AI model as a registered dietitian/dietician, clinician, physiotherapist, or other regulated professional unless the product actually includes appropriately qualified professional oversight and the claim is legally justified.

AI may provide bounded general support and should escalate beyond scope when professional judgement is required.

## Multimodal Smart Logging

Food logging may support:
- photo
- voice
- natural-language text
- barcode
- favourites
- recent meals
- manual entry

AI may propose structured data.

Uncertain estimates should be clearly marked.

User confirmation should convert proposed/estimated entries into user-confirmed data where appropriate.

## Voice

Voice is optional.

Layered voice direction:
1. short voiced moments
2. stylised species sounds
3. optional full spoken conversation later

Voice, sound effects, music, haptics, and motion should have independent controls.

No essential information may exist only in audio.

## Privacy and memory

Do not include sensitive health details in mascot dialogue, public sharing, or social surfaces unless the user explicitly chooses to expose them.

AI memory should use the minimum relevant context needed for the experience.

## Implementation principle

Before adding AI, identify:
1. trusted input facts
2. deterministic boundaries
3. allowed AI outputs
4. forbidden AI outputs
5. fallback behaviour
6. persistence policy
7. provenance
8. user control
9. safety escalation
10. tests for hallucination-sensitive boundaries

If these are unclear, investigate before implementation.
