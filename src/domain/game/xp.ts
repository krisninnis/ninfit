import type { ActivityType } from '../types';
import { SKILL_KINDS, type RewardKind, type SkillKind, type SkillProgress } from './types';

/**
 * XP, levels and the activity-to-skill mapping.
 *
 * All of it is a table. No React component computes progression, and changing the
 * economy means editing numbers here.
 *
 * The design rule behind the values: reward the behaviour. Doing the yoga and
 * skipping the walk is a genuine win worth genuine XP, and the session bonus is
 * deliberately small so that a partial day never feels like a wasted one.
 */

export const XP_REWARDS: Readonly<Record<RewardKind, number>> = {
  /** One planned activity, done. The workhorse reward. */
  activity_completed: 20,
  /** A modest bonus once every planned activity for the day is done. */
  session_completed: 15,
  first_programme_day: 25,
  /** Rest is part of the programme, so engaging with a rest day counts. */
  rest_day_observed: 10,
  first_measurement: 30,
  /** Overridden per tier by TROPHY_XP. */
  trophy_unlocked: 0,
};

export const TROPHY_XP = {
  bronze: 25,
  silver: 60,
  gold: 150,
  platinum: 400,
} as const;

/**
 * Overall level thresholds, levels 1 to 20.
 *
 * The curve: the step from level 1 to 2 costs 100 XP, and each subsequent step costs
 * 50 more than the one before. Gentle at the start so early wins feel quick, steeper
 * later so the numbers keep meaning something. Twenty levels is enough foundation;
 * the model scales by changing MAX_LEVEL.
 */
export const MAX_LEVEL = 20;

function buildThresholds(maxLevel: number, firstStep: number, growth: number): number[] {
  const thresholds = [0];
  let step = firstStep;
  for (let level = 2; level <= maxLevel; level += 1) {
    thresholds.push((thresholds[level - 2] ?? 0) + step);
    step += growth;
  }
  return thresholds;
}

/** Index 0 is level 1, which always starts at 0 XP. */
export const LEVEL_THRESHOLDS: readonly number[] = buildThresholds(MAX_LEVEL, 100, 50);

/** Skills climb on a shallower curve, to ten levels. */
export const MAX_SKILL_LEVEL = 10;
export const SKILL_THRESHOLDS: readonly number[] = buildThresholds(MAX_SKILL_LEVEL, 60, 30);

function levelFor(xp: number, thresholds: readonly number[]): number {
  let level = 1;
  for (let index = 1; index < thresholds.length; index += 1) {
    if (xp >= (thresholds[index] ?? Infinity)) level = index + 1;
    else break;
  }
  return level;
}

export function levelForXp(xp: number): number {
  return levelFor(xp, LEVEL_THRESHOLDS);
}

export function skillLevelForXp(xp: number): number {
  return levelFor(xp, SKILL_THRESHOLDS);
}

export interface LevelProgress {
  level: number;
  /** XP earned since this level began. */
  xpIntoLevel: number;
  /** XP needed to span this level. Undefined at the maximum. */
  xpForLevel?: number;
  /** 0 to 1. Exact here on purpose: the overall bar is allowed to be precise. */
  fraction: number;
  isMaxLevel: boolean;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelForXp(xp);
  const floor = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const ceiling = LEVEL_THRESHOLDS[level];

  if (ceiling === undefined) {
    return { level, xpIntoLevel: xp - floor, fraction: 1, isMaxLevel: true };
  }

  const span = ceiling - floor;
  return {
    level,
    xpIntoLevel: xp - floor,
    xpForLevel: span,
    fraction: span <= 0 ? 0 : (xp - floor) / span,
    isMaxLevel: false,
  };
}

// --- Activity to skill mapping ---------------------------------------------

/**
 * Which skills an activity feeds.
 *
 * `consistency` accrues from turning up at all, which is why nearly everything
 * contributes a little of it. `recovery` means engaging with recovery behaviour -
 * observing a rest day, doing gentle mobility work - and never claims the body is
 * recovered.
 */
export const ACTIVITY_SKILL_XP: Readonly<Record<ActivityType, Partial<Record<SkillKind, number>>>> =
  {
    yoga: { mobility: 15, recovery: 5, consistency: 5 },
    walk: { stamina: 15, consistency: 5 },
    rest: { recovery: 10, consistency: 5 },
    other: { strength: 15, consistency: 5 },
  };

export const REST_DAY_SKILL_XP: Partial<Record<SkillKind, number>> = {
  recovery: 10,
  consistency: 5,
};

export function skillXpForActivity(type: ActivityType): Partial<Record<SkillKind, number>> {
  return ACTIVITY_SKILL_XP[type] ?? {};
}

// --- Skill state -----------------------------------------------------------

export function createInitialSkills(): SkillProgress[] {
  return SKILL_KINDS.map((kind) => ({ kind, xp: 0, level: 1 }));
}

/** Adds XP to the named skills and recomputes their levels. Never mutates. */
export function applySkillXp(
  skills: readonly SkillProgress[],
  gains: Partial<Record<SkillKind, number>>,
): SkillProgress[] {
  return skills.map((skill) => {
    const gain = gains[skill.kind];
    if (gain === undefined || gain === 0) return skill;
    const xp = skill.xp + gain;
    return { kind: skill.kind, xp, level: skillLevelForXp(xp) };
  });
}

export function findSkill(
  skills: readonly SkillProgress[],
  kind: SkillKind,
): SkillProgress | undefined {
  return skills.find((skill) => skill.kind === kind);
}
