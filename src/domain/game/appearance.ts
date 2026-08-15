import type { MascotIdentity } from './identity';
import type { CosmeticInventory, MascotStageId } from './types';

/**
 * The PERMANENT half of the mascot: what was earned, and what it is wearing.
 *
 * The counterpart to `condition.ts`. Between them they carve the mascot in two:
 *
 *   appearance  earned, persisted, never lost to inactivity
 *   mood        derived, disposable, never written down
 *
 * A renderer takes both. Nothing else may. In particular no function may read a
 * `MascotMood` and produce a `MascotAppearance` or a `MascotState` - that direction
 * is what would let a quiet fortnight cost somebody a stage, and it is the single
 * failure this split exists to make impossible.
 *
 * Cosmetics sit on this side because they are owned and persist, but they remain
 * inert: `CosmeticInventory` is carried here for rendering and is read by nothing
 * that computes progression.
 */
export interface MascotAppearance {
  /** Earned. Only a completed evolution changes this. */
  stage: MascotStageId;
  identity: MascotIdentity;
  cosmetics: CosmeticInventory;
}

/**
 * Everything a mascot renderer needs, with the two halves kept visibly separate.
 *
 * Passing one object with a `permanent` and a `temporary` branch, rather than a
 * flattened bag of props, means a component cannot accidentally treat a mood field
 * as though it were durable.
 */
export interface MascotRenderModel {
  permanent: MascotAppearance;
  temporary: import('./condition').MascotMood;
}
