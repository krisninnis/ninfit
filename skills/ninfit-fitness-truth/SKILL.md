# NinFit Fitness Truth

## Purpose

Use this skill whenever work touches fitness data, health data, activity logs, rewards, PBs, progression, programme adherence, AI interpretation, nutrition logging, sensors, imports, or derived facts.

Core rule:

**FITNESS DATA IS THE TRUTH LAYER.**

The game and AI sit downstream of trusted data.

## Truth pipeline

Prefer this conceptual order:

1. Source data
2. Provenance
3. Validation/normalisation
4. Trusted derived facts
5. Deterministic programme/reward logic
6. Game progression
7. AI interpretation/presentation
8. User-facing explanation

Do not reverse this pipeline.

## Never fabricate

NinFit must never fabricate:
- steps
- distance
- workout completion
- heart rate
- HRV
- sleep
- calories
- weight
- blood pressure
- PBs
- activity duration
- nutrition intake
- health readings
- XP
- trophies
- progression state

Missing data remains missing.

Unknown remains unknown.

## Provenance

Preserve where data came from.

Useful provenance distinctions include:
- device-measured
- user-entered
- imported
- derived
- AI-estimated
- user-confirmed

Do not silently convert estimates into measured facts.

## AI-estimated nutrition

AI may estimate food from:
- photo
- voice
- natural-language text

But it must clearly indicate uncertainty.

Before uncertain AI-estimated nutrition becomes trusted, require user confirmation where appropriate.

Rule:

**AI may estimate. NinFit must never pretend an estimate was measured.**

## Deterministic progression

These must not be awarded solely because an LLM says they occurred:
- XP
- levels
- stage progression
- PBs
- trophies
- Champion
- Secret Prestige
- hatch eligibility
- evolution eligibility
- streak/adherence rewards

AI may explain or celebrate these states only after trusted logic determines them.

## Personal bests

PBs must be grounded in comparable trusted activity data.

Do not fabricate comparability across:
- different distances
- different exercise definitions
- incompatible units
- uncertain estimates

If comparability is unsafe or unclear, say so.

## Monotonic permanent progression

Permanent mascot/game progress should use durable evidence.

If a permanent state must never reverse, do not derive it naively from mutable live logs unless there is a designed one-way latch.

For append-only achievements, prefer append-only evidence where architecture supports it.

## Rest and recovery

Planned rest can represent successful programme adherence.

Rest is not failure.

A game system may distinguish “activity completed” from “planned rest followed” when the distinction has product meaning, but neither should be framed as bad behaviour.

## Sustainable programme rule

Do not create algorithms whose default direction is always:
- more
- longer
- harder
- faster

Adaptation may go upward or downward.

Sustainable adherence is more important than overtraining.

## Safe programme boundaries

Game rewards must not incentivise unsafe activity.

Do not generate new physical targets merely to preserve:
- streaks
- cosmetics
- XP
- Secret Prestige
- rarity
- seasonal rewards

## Sensors and missing readings

If a sensor or integration fails:
- do not invent a plausible reading
- show missing/unknown state
- preserve prior data if valid
- distinguish stale data from current data

## Health scope

NinFit may support fitness and general wellbeing.

It must not present fabricated diagnosis or certainty.

For symptoms, injury, disease, medication, clinical nutrition, or other medical questions:
- use appropriate safety boundaries
- avoid pretending app-generated reasoning is a clinician
- provide escalation paths when necessary

## Privacy

Health data is private by default.

Do not expose health data through:
- social profiles
- public mascot cards
- shared Legacy views
- trophy sharing

unless the user explicitly chooses the exact data to share.
