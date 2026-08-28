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
  src: string;
}

type MascotStageArtKey = `${MascotFamilyId}:${MascotStageId}`;

export const MASCOT_STAGE_ART: Readonly<
  Partial<Record<MascotStageArtKey, MascotStageArt>>
> = {
  'tortoise:starter': {
    src: '/mascots/tortoise/tortoise-starter-companion-v1.png',
  },
};

export function mascotStageArt(
  familyId: MascotFamilyId,
  stage: MascotStageId,
): MascotStageArt | undefined {
  return MASCOT_STAGE_ART[`${familyId}:${stage}`];
}
