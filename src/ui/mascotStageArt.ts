import type { MascotFamilyId, MascotStageId } from '../domain/game/types';

/**
 * Reviewed standing companion artwork.
 *
 * Presentation only. This registry never decides which mascot exists, whether the
 * egg has hatched, when evolution happens, or what the companion has noticed.
 *
 * Missing entries deliberately return undefined so unfinished species and stages
 * continue to use the existing glyph fallback.
 */
export interface MascotStageArt {
  /**
   * The resting still. For a stage that also has motion this MUST be a frame taken
   * from that motion asset, so the two share framing, scale and character exactly and
   * the swap between them is invisible. A separately drawn still is what forced the
   * previous CSS scale compensation, and compensation is not a fix.
   */
  src: string;
  /** Optional one-shot motion. Never looped, never autoplayed on load. */
  motionSrc?: string;
}

type MascotStageArtKey = `${MascotFamilyId}:${MascotStageId}`;

export const MASCOT_STAGE_ART: Readonly<
  Partial<Record<MascotStageArtKey, MascotStageArt>>
> = {
  'tortoise:starter': {
    /* Frame 0 of the wave below - the video's own keyframe, at rest. */
    src: '/mascots/tortoise/tortoise-starter-wave-rest-v1.png',
    motionSrc: '/mascots/tortoise/tortoise-starter-wave-v1.webm',
  },
};

export function mascotStageArt(
  familyId: MascotFamilyId,
  stage: MascotStageId,
): MascotStageArt | undefined {
  return MASCOT_STAGE_ART[`${familyId}:${stage}`];
}
