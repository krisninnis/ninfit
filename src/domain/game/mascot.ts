import type { ISODateTime } from '../types';
import { findMascotFamily } from './paths';
import {
  MASCOT_STAGES,
  type EvolutionStatus,
  type MascotFamily,
  type MascotStageId,
  type MascotState,
} from './types';

/**
 * The egg, the mascot and how it progresses.
 *
 * Three rules:
 *
 *   - Nothing happens automatically. The egg becomes READY to hatch and the mascot
 *     becomes READY to evolve; pressing the button is always the user's.
 *   - The animal is a secret until the egg hatches. `visibleMascotFamily` returns
 *     undefined before then, so no screen can leak it through a name or a glyph.
 *   - Progress toward evolution is described in words, never as a percentage. The
 *     overall XP bar is allowed to be precise; this deliberately is not.
 */

/** Distinct programme days with activity before the egg is ready. */
export const HATCH_ACTIVE_DAYS_REQUIRED = 2;

/**
 * LEGACY SCAFFOLDING - scheduled for replacement in the evolution milestone.
 *
 * Overall level is a stand-in for a richer rule that will eventually weigh
 * programme adherence, activity history, the chosen path and a user choice between
 * eligible branches. Kept crude on purpose so it is obvious this is scaffolding.
 *
 * M1 deliberately does NOT change it. Evolution timing must be identical before and
 * after this milestone, because a user part-way to a stage should not find the
 * goalposts moved by a refactor they never asked for.
 */
export const EVOLUTION_LEVEL_GATES: Readonly<Record<MascotStageId, number | undefined>> = {
  starter: 5,
  growing: 10,
  capable: 15,
  advanced: 20,
  elite: undefined,
};

export function nextStage(stage: MascotStageId): MascotStageId | undefined {
  const index = MASCOT_STAGES.indexOf(stage);
  return index === -1 ? undefined : MASCOT_STAGES[index + 1];
}

export function stageIndex(stage: MascotStageId): number {
  return Math.max(0, MASCOT_STAGES.indexOf(stage));
}

/** The family, but only once it is no longer a secret. */
export function visibleMascotFamily(mascot: MascotState): MascotFamily | undefined {
  if (mascot.eggState !== 'hatched') return undefined;
  return findMascotFamily(mascot.familyId);
}

export function isHatched(mascot: MascotState): boolean {
  return mascot.eggState === 'hatched';
}

/** Enough distinct active days to make the egg ready. */
export function isHatchEligible(distinctActiveDays: number): boolean {
  return distinctActiveDays >= HATCH_ACTIVE_DAYS_REQUIRED;
}

/**
 * Move the egg to 'ready' when it has earned it, and mark evolution availability.
 * Never hatches and never evolves: both remain user actions.
 */
export function evaluateMascot(
  mascot: MascotState,
  facts: { distinctActiveDays: number; level: number },
): MascotState {
  let next = mascot;

  if (next.eggState === 'unhatched' && isHatchEligible(facts.distinctActiveDays)) {
    next = { ...next, eggState: 'ready' };
  }

  const ready = isEvolutionEligible(next, facts.level);
  if (ready !== next.evolutionReady) {
    next = { ...next, evolutionReady: ready };
  }

  return next;
}

export function isEvolutionEligible(mascot: MascotState, level: number): boolean {
  if (mascot.eggState !== 'hatched') return false;
  const gate = EVOLUTION_LEVEL_GATES[mascot.stage];
  if (gate === undefined) return false; // already elite
  return level >= gate;
}

/** Hatch, on request. A no-op unless the egg is ready. */
export function hatchEgg(mascot: MascotState, now: ISODateTime): MascotState {
  if (mascot.eggState !== 'ready') return mascot;
  return { ...mascot, eggState: 'hatched', stage: 'starter', hatchedAt: now };
}

/** Evolve, on request. A no-op unless evolution has been earned. */
export function evolveMascot(mascot: MascotState, now: ISODateTime): MascotState {
  if (!mascot.evolutionReady) return mascot;
  const upcoming = nextStage(mascot.stage);
  if (upcoming === undefined) return mascot;
  return { ...mascot, stage: upcoming, evolutionReady: false, lastEvolvedAt: now };
}

/**
 * How close the next evolution feels, in words.
 *
 * Returns a band rather than a number so there is something left to wonder about.
 */
export function evolutionStatus(mascot: MascotState, level: number): EvolutionStatus {
  if (mascot.evolutionReady) return 'evolution_close';

  const gate = EVOLUTION_LEVEL_GATES[mascot.stage];
  if (gate === undefined) return 'settling_in';

  const previousGate = previousGateFor(mascot.stage);
  const span = gate - previousGate;
  const progressed = span <= 0 ? 0 : (level - previousGate) / span;

  if (progressed >= 0.75) return 'nearly_ready';
  if (progressed >= 0.5) return 'getting_stronger';
  if (progressed >= 0.25) return 'growing';
  return 'settling_in';
}

function previousGateFor(stage: MascotStageId): number {
  const index = stageIndex(stage);
  if (index === 0) return 1;
  const previous = MASCOT_STAGES[index - 1];
  return previous === undefined ? 1 : (EVOLUTION_LEVEL_GATES[previous] ?? 1);
}

export const EVOLUTION_STATUS_LABELS: Readonly<Record<EvolutionStatus, string>> = {
  settling_in: 'Settling in',
  growing: 'Growing',
  getting_stronger: 'Getting stronger',
  nearly_ready: 'Nearly ready',
  evolution_close: 'Something is about to change',
};

/**
 * The five growth stages, as the product names them.
 *
 * THE STORED IDS ARE NOT THE PRODUCT NAMES, AND THAT IS DELIBERATE. `capable`,
 * `advanced` and `elite` are already written into every existing save; renaming
 * them would be a data migration bought with real risk in exchange for nothing a
 * user could see. Ids are internal, labels are product, and this table is the one
 * place the two meet.
 *
 *   starter  -> Starter     growing  -> Growing     capable -> Active
 *   advanced -> Athletic    elite    -> Champion
 */
export const MASCOT_STAGE_LABELS: Readonly<Record<MascotStageId, string>> = {
  starter: 'Starter',
  growing: 'Growing',
  capable: 'Active',
  advanced: 'Athletic',
  elite: 'Champion',
};
