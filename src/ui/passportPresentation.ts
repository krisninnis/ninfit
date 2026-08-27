import { MASCOT_STAGE_LABELS, visibleMascotFamily } from '../domain/game/mascot';
import { findPath } from '../domain/game/paths';
import type { GameState } from '../domain/game/types';

export type PassportPresentationStatus = 'sealed' | 'active';

export interface PassportPresentation {
  status: PassportPresentationStatus;
  title: string;
  pathName: string | null;
  familyName: string | null;
  familyGlyph: string | null;
  stageLabel: string | null;
  level: number;
  hatchedAt: string | null;
  lastEvolvedAt: string | null;
}

export function passportPresentation(state: GameState): PassportPresentation {
  const family = visibleMascotFamily(state.mascot);
  const path = state.pathId === undefined ? undefined : findPath(state.pathId);

  if (family === undefined) {
    return {
      status: 'sealed',
      title: 'Mystery Egg',
      pathName: path?.name ?? null,
      familyName: null,
      familyGlyph: null,
      stageLabel: null,
      level: state.xp.level,
      hatchedAt: null,
      lastEvolvedAt: null,
    };
  }

  return {
    status: 'active',
    title: family.name,
    pathName: path?.name ?? null,
    familyName: family.name,
    familyGlyph: family.glyph,
    stageLabel: MASCOT_STAGE_LABELS[state.mascot.stage],
    level: state.xp.level,
    hatchedAt: state.mascot.hatchedAt ?? null,
    lastEvolvedAt: state.mascot.lastEvolvedAt ?? null,
  };
}
