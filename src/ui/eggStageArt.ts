import { MAX_CRACK_STAGE } from '../domain/game/egg';

/**
 * Reviewed premium egg artwork, by crack stage.
 *
 * The same shape as `mascotStageArt.ts`, deliberately: one central registry, screens
 * name a stage rather than a file, and a missing entry returns `undefined` so the
 * caller falls back. Repeating that shape rather than inventing a second one is the
 * point - there is now one way art reaches the runtime in this codebase.
 *
 * WHY THE EGG NEEDS ITS OWN REGISTRY RATHER THAN A ROW IN THE MASCOT ONE.
 *
 * `MASCOT_STAGE_ART` is keyed by `family:stage`. The egg has no family and must never
 * acquire one - a lookup that took a family would be a lookup somebody could one day
 * pass a real family to, and the answer would leak the species. This registry's key
 * is a number between 0 and 5 and there is nothing else to give it.
 *
 * PRESENTATION ONLY. Nothing here decides whether the egg may open, when it opens, or
 * what is inside. It answers "what does the shell look like at stage n" and nothing
 * else. `src/domain/game/egg.ts` owns the stage; `useHatchCinematic` owns the moment;
 * `hatchEgg` owns the outcome.
 */
export interface EggStageArt {
  /** Path under `public/`. Species-neutral by construction - see the guard. */
  src: string;
}

/** 0 through `MAX_CRACK_STAGE`, mirroring the domain exactly. */
export type EggCrackStage = 0 | 1 | 2 | 3 | 4 | 5;

export const EGG_CRACK_STAGES: readonly EggCrackStage[] = [0, 1, 2, 3, 4, 5];

/**
 * The approved production set (#134, PR #195).
 *
 * All six derive from one canonical master, `src/art/egg/eggMaster.ts`, and are
 * cumulative: stage n contains stage n-1's fractures verbatim. That is checked by
 * `src/test/eggProductionArt.test.ts`, not assumed here.
 *
 * The filenames carry no family, no path and no species. That is not a naming
 * preference: an asset URL is the one disclosure channel that survives every
 * DOM-level precaution, because it reaches the network panel whatever the markup
 * says.
 */
export const EGG_STAGE_ART: Readonly<Partial<Record<EggCrackStage, EggStageArt>>> = {
  0: { src: '/egg/egg-stage-0-v1.svg' },
  1: { src: '/egg/egg-stage-1-v1.svg' },
  2: { src: '/egg/egg-stage-2-v1.svg' },
  3: { src: '/egg/egg-stage-3-v1.svg' },
  4: { src: '/egg/egg-stage-4-v1.svg' },
  5: { src: '/egg/egg-stage-5-v1.svg' },
};

/**
 * The artwork for a stage, or `undefined` if there is none.
 *
 * Undefined is an ordinary answer, not an error: it is what keeps the code-drawn
 * shell load-bearing while a stage is unreviewed, exactly as a missing mascot entry
 * keeps the glyph load-bearing. The clamp mirrors `EggArt`'s, so a malformed caller
 * gets stage 0 rather than a hole.
 */
export function eggStageArt(stage: number): EggStageArt | undefined {
  if (!Number.isFinite(stage)) return EGG_STAGE_ART[0];
  const clamped = Math.max(0, Math.min(MAX_CRACK_STAGE, Math.floor(stage)));
  return EGG_STAGE_ART[clamped as EggCrackStage];
}

/**
 * Whether the whole reviewed set is present.
 *
 * All or nothing on purpose. A partial set would mean the shell changed rendering
 * language halfway through the questionnaire - reviewed artwork at stage 2, a code
 * drawing at stage 3 - which reads as a bug even though every individual asset is
 * fine. One missing stage sends the whole presentation back to the fallback.
 */
export function hasCompleteEggStageArt(): boolean {
  return EGG_CRACK_STAGES.every((stage) => EGG_STAGE_ART[stage] !== undefined);
}
