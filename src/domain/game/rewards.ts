import {
  completedActivityIds,
  isDailyLogEmpty,
  isRestDayAcknowledged,
  usesLegacyCompletion,
} from '../dailyLog';
import { nowTimestamp } from '../dates';
import { newId, type IdFactory } from '../ids';
import type { DailyLog, ISODate, ISODateTime, PlannedActivity, WeeklyPlan } from '../types';
import { isRestDay, resolveSessionForDate, summariseSessionCompletion } from '../weeklyPlan';
import { qualifyingActiveDays } from './egg';
import { evaluateMascot } from './mascot';
import { earnedTrophies, type TrophyFacts } from './trophies';
import type {
  GameSettings,
  GameState,
  RewardEvent,
  RewardKind,
  SkillKind,
  TrophyUnlock,
} from './types';
import { REST_DAY_SKILL_XP, TROPHY_XP, XP_REWARDS, applySkillXp, levelForXp, skillXpForActivity } from './xp';

/**
 * Turning recorded fitness into rewards, exactly once.
 *
 * THE IDEMPOTENCY RULE, because it is the thing most likely to be got wrong:
 *
 * Rewards are DERIVED FROM PERSISTED STATE, never from a click, a callback or a
 * render. Each one carries a key built from the fact that earned it, such as
 * `activity:2026-08-13:{activityId}`. Granting checks that key against
 * `awardedKeys` and skips anything already there. A reload re-derives the identical
 * set of keys and therefore grants nothing.
 *
 * Un-ticking is deliberate too: XP already earned is NOT taken back, and re-ticking
 * grants nothing new because the key is still recorded. Toggling a checkbox a hundred
 * times yields exactly the XP of doing it once. There is no way to farm it.
 */

const MAX_RECENT_EVENTS = 20;

export interface FitnessSnapshot {
  programmeStartDate: ISODate;
  plans: readonly WeeklyPlan[];
  logs: readonly DailyLog[];
  measurementCount: number;
}

export interface EarnedReward {
  key: string;
  kind: RewardKind;
  xp: number;
  skillXp: Partial<Record<SkillKind, number>>;
  label: string;
  date?: ISODate;
  trophyId?: string;
}

export interface DerivedFacts extends TrophyFacts {
  rewards: EarnedReward[];
  /** Distinct programme days with any completed activity. Drives hatch eligibility. */
  activeDays: ISODate[];
  lastActiveDate?: ISODate;
}

/** Which of a day's planned activities count as done, legacy records included. */
function completedActivitiesFor(
  activities: readonly PlannedActivity[],
  log: DailyLog,
): PlannedActivity[] {
  const completion = summariseSessionCompletion({ id: 'x', dayIndex: 1, activities: [...activities] }, log);

  // A record predating per-activity completion says only "the session was done", so
  // that is read as all of its activities rather than none.
  if (usesLegacyCompletion(log)) {
    return completion.status === 'complete' ? [...activities] : [];
  }

  const ticked = completedActivityIds(log);
  return activities.filter((activity) => ticked.includes(activity.id));
}

/**
 * Everything the recorded data has earned, whether or not it has been granted yet.
 * Pure: the same snapshot always produces the same list, in the same order.
 */
export function deriveRewards(snapshot: FitnessSnapshot): DerivedFacts {
  const rewards: EarnedReward[] = [];
  const activeDays: ISODate[] = [];

  let completedActivities = 0;
  let fullSessions = 0;
  let restDaysObserved = 0;
  let programmeDaysRecorded = 0;

  const logs = [...snapshot.logs].sort((a, b) => (a.date < b.date ? -1 : 1));

  for (const log of logs) {
    if (isDailyLogEmpty(log)) continue;
    programmeDaysRecorded += 1;

    const resolved = resolveSessionForDate(snapshot.plans, snapshot.programmeStartDate, log.date);
    const session = resolved?.session;

    if (isRestDay(session)) {
      // Following the planned rest is participation, and it has to be SAID.
      // Recording water, food, sleep, heart rate, symptoms or notes on a rest day is
      // ordinary tracking and earns nothing here, because none of it tells us the
      // rest was intentional.
      if (isRestDayAcknowledged(log)) {
        restDaysObserved += 1;
        rewards.push({
          key: `rest:${log.date}`,
          kind: 'rest_day_observed',
          xp: XP_REWARDS.rest_day_observed,
          skillXp: REST_DAY_SKILL_XP,
          label: 'Rest day followed',
          date: log.date,
        });
      }
      continue;
    }

    const activities = session?.activities ?? [];
    const done = completedActivitiesFor(activities, log);

    for (const activity of done) {
      completedActivities += 1;
      rewards.push({
        key: `activity:${log.date}:${activity.id}`,
        kind: 'activity_completed',
        xp: XP_REWARDS.activity_completed,
        skillXp: skillXpForActivity(activity.type),
        label: `${activity.label} completed`,
        date: log.date,
      });
    }

    if (done.length > 0) {
      activeDays.push(log.date);
    }

    if (activities.length > 0 && done.length === activities.length) {
      fullSessions += 1;
      rewards.push({
        key: `session:${log.date}`,
        kind: 'session_completed',
        xp: XP_REWARDS.session_completed,
        skillXp: { consistency: 5 },
        label: 'Whole session done',
        date: log.date,
      });
    }
  }

  if (programmeDaysRecorded > 0) {
    const firstDate = logs.find((log) => !isDailyLogEmpty(log))?.date;
    rewards.unshift({
      key: 'first_programme_day',
      kind: 'first_programme_day',
      xp: XP_REWARDS.first_programme_day,
      skillXp: { consistency: 10 },
      label: 'First day recorded',
      ...(firstDate !== undefined ? { date: firstDate } : {}),
    });
  }

  if (snapshot.measurementCount > 0) {
    rewards.push({
      key: 'first_measurement',
      kind: 'first_measurement',
      xp: XP_REWARDS.first_measurement,
      skillXp: { consistency: 5 },
      label: 'First measurement recorded',
    });
  }

  const facts: TrophyFacts = {
    completedActivities,
    fullSessions,
    distinctActiveDays: activeDays.length,
    programmeDaysRecorded,
    restDaysObserved,
    measurementsRecorded: snapshot.measurementCount,
  };

  for (const trophy of earnedTrophies(facts)) {
    rewards.push({
      key: `trophy:${trophy.id}`,
      kind: 'trophy_unlocked',
      xp: TROPHY_XP[trophy.tier],
      skillXp: {},
      label: trophy.name,
      trophyId: trophy.id,
    });
  }

  return {
    ...facts,
    rewards,
    activeDays,
    ...(activeDays.length > 0 ? { lastActiveDate: activeDays[activeDays.length - 1] } : {}),
  };
}

/**
 * Record every currently-earned key as already awarded, WITHOUT granting anything.
 *
 * Used when importing a backup that carries fitness history but no game state. Left
 * alone, the next sync would scan months of imported days and hand out a huge
 * retroactive XP burst for work the game never watched happen. Sealing the keys says
 * "these are accounted for", so the import starts at zero and every later sync stays
 * idempotent.
 */
export function sealRewardKeys(state: GameState, facts: DerivedFacts): GameState {
  const keys = new Set([...state.awardedKeys, ...facts.rewards.map((reward) => reward.key)]);
  return { ...state, awardedKeys: [...keys] };
}

export interface GrantOptions {
  now?: ISODateTime;
  makeId?: IdFactory;
  settings: GameSettings;
}

export interface GrantResult {
  state: GameState;
  /** Only what was granted this time. Empty on every repeat run. */
  granted: RewardEvent[];
}

/**
 * Apply everything earned but not yet awarded.
 *
 * Running this twice over unchanged data grants nothing the second time, which is
 * what makes it safe to call on every load, every render pass and every tab switch.
 */
export function grantRewards(
  state: GameState,
  facts: DerivedFacts,
  options: GrantOptions,
): GrantResult {
  const timestamp = options.now ?? nowTimestamp();
  const makeId = options.makeId ?? newId;

  const awarded = new Set(state.awardedKeys);
  const granted: RewardEvent[] = [];

  let xpTotal = state.xp.total;
  let skills = state.skills;
  const trophies: TrophyUnlock[] = [...state.trophies];

  for (const reward of facts.rewards) {
    if (awarded.has(reward.key)) continue;
    awarded.add(reward.key);

    xpTotal += reward.xp;
    skills = applySkillXp(skills, reward.skillXp);

    if (reward.trophyId !== undefined) {
      trophies.push({
        trophyId: reward.trophyId,
        unlockedAt: timestamp,
        // Private on unlock, always. Sharing is a separate, deliberate act.
        visibility: options.settings.defaultTrophyVisibility,
      });
    }

    granted.push({
      id: makeId(),
      key: reward.key,
      kind: reward.kind,
      xp: reward.xp,
      skillXp: reward.skillXp,
      label: reward.label,
      ...(reward.date !== undefined ? { date: reward.date } : {}),
      awardedAt: timestamp,
    });
  }

  const level = levelForXp(xpTotal);
  // Counted from the awarded keys AFTER this pass has added its own, and never from
  // `facts.distinctActiveDays` - that figure is recomputed from live logs and falls
  // when an activity is un-ticked, which would let the shell heal.
  const mascot = evaluateMascot(state.mascot, {
    qualifyingDays: qualifyingActiveDays([...awarded]),
    level,
  });

  return {
    state: {
      ...state,
      xp: { total: xpTotal, level },
      skills,
      trophies,
      mascot,
      awardedKeys: [...awarded],
      recentEvents: [...granted.reverse(), ...state.recentEvents].slice(0, MAX_RECENT_EVENTS),
    },
    granted,
  };
}
