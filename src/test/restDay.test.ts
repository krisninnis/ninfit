import { beforeEach, describe, expect, it } from 'vitest';
import todayScreenSource from '../ui/screens/TodayScreen.tsx?raw';
import { finishOnboarding, syncGame } from '../app/game';
import { createTodaySession, type TodaySession } from '../app/todaySession';
import {
  acknowledgeRestDay,
  isDayMarkedComplete,
  isRestDayAcknowledged,
} from '../domain/dailyLog';
import { PROGRAMME_START_DATE } from '../domain/defaults';
import { XP_REWARDS } from '../domain/game/xp';
import type { OnboardingAnswers } from '../domain/game/types';
import { sequentialIdFactory } from '../domain/ids';
import { resolveToday } from '../domain/today';
import type { WeeklyPlan } from '../domain/types';
import { buildWeekView } from '../domain/week';
import { createMemoryStorageAdapter, type StorageAdapter } from '../storage/StorageAdapter';
import { Repository, createRepository } from '../storage/repository';

const NOW = '2026-08-13T20:04:00.000+01:00';
const DAY_1 = '2026-08-13';
const REST_DAY = '2026-08-19'; // day 7

let adapter: StorageAdapter;
let repo: Repository;
let plans: WeeklyPlan[];

const ANSWERS: OnboardingAnswers = {
  activityLevel: 'sedentary',
  structuredExercise: 'none',
  walkComfort: 'with_effort',
  mainGoal: 'start_moving',
};

function newRepo(store: StorageAdapter, prefix = 'seed'): Repository {
  return createRepository(store, { now: () => NOW, makeId: sequentialIdFactory(prefix) });
}

function reload(): Repository {
  const next = newRepo(adapter, 'reload');
  next.initialise();
  return next;
}

function session(date: string, store: Repository = repo): TodaySession {
  const view = resolveToday(plans, PROGRAMME_START_DATE, date);
  return createTodaySession(store, date, {
    now: NOW,
    makeId: sequentialIdFactory(`s-${date}`),
    ...(view.planId !== undefined ? { weeklyPlanId: view.planId } : {}),
    ...(view.sessionId !== undefined ? { plannedSessionId: view.sessionId } : {}),
  });
}

function record(date: string, update: Parameters<TodaySession['apply']>[0]): void {
  const entry = session(date);
  entry.apply(update);
  entry.save();
}

function sync(store: Repository = repo) {
  return syncGame(store, { now: NOW, today: DAY_1 });
}

function restXpAwards(store: Repository = repo) {
  return sync(store).granted.filter((event) => event.kind === 'rest_day_observed');
}

beforeEach(() => {
  adapter = createMemoryStorageAdapter();
  repo = newRepo(adapter);
  repo.initialise();
  plans = repo.getWeeklyPlans();
  finishOnboarding(
    repo,
    { answers: ANSWERS, recommendedPathId: 'start_moving', chosenPathId: 'start_moving' },
    NOW,
  );
});

// ---------------------------------------------------------------------------

describe('ordinary tracking never earns the rest-day reward', () => {
  it.each([
    ['water', { hydration: { glasses: 8 } }],
    ['food', { nutrition: { morningFruit: true, proteinMainMeal: true, fruitVegServings: 5 } }],
    ['sleep', { recovery: { sleepHours: 8 } }],
    ['resting heart rate and HRV', { recovery: { restingHeartRateBpm: 68, hrvMs: 44 } }],
    ['symptoms', { symptoms: { backPainBefore: 3, legPain: false, toeSensation: 'same' as const } }],
    ['notes', { recovery: { notes: 'Slept badly.' } }],
    ['steps alone', { exercise: { steps: 2100 } }],
  ])('recording %s on a rest day earns nothing', (_label, update) => {
    record(REST_DAY, update);

    expect(restXpAwards()).toEqual([]);
    expect(isRestDayAcknowledged(repo.getDailyLog(REST_DAY))).toBe(false);
  });

  it('records everything on the rest day without earning it', () => {
    record(REST_DAY, {
      hydration: { glasses: 7 },
      nutrition: { morningFruit: true },
      recovery: { sleepHours: 8, energy: 6, restingHeartRateBpm: 68, hrvMs: 44, notes: 'Fine.' },
      symptoms: { backPainBefore: 2, toeSensation: 'better' },
    });

    expect(restXpAwards()).toEqual([]);
    // The data is still all there. It simply is not an acknowledgement.
    const log = repo.getDailyLog(REST_DAY);
    expect(log?.hydration?.glasses).toBe(7);
    expect(log?.recovery?.sleepHours).toBe(8);
  });
});

describe('explicit acknowledgement', () => {
  it('awards exactly 10 XP, once', () => {
    record(REST_DAY, acknowledgeRestDay(true));

    const awards = restXpAwards();
    expect(awards).toHaveLength(1);
    expect(awards[0]?.xp).toBe(10);
    expect(awards[0]?.xp).toBe(XP_REWARDS.rest_day_observed);
  });

  it('uses a deterministic key tied to the date', () => {
    record(REST_DAY, acknowledgeRestDay(true));
    const awards = restXpAwards();
    expect(awards[0]?.key).toBe(`rest:${REST_DAY}`);
    expect(awards[0]?.date).toBe(REST_DAY);
  });

  it('grants nothing extra on repeated evaluation', () => {
    record(REST_DAY, acknowledgeRestDay(true));
    const total = sync().state.xp.total;

    expect(sync().granted).toEqual([]);
    expect(sync().granted).toEqual([]);
    expect(repo.getGameState()?.xp.total).toBe(total);
  });

  it('grants nothing extra after a reload', () => {
    record(REST_DAY, acknowledgeRestDay(true));
    const total = sync().state.xp.total;

    const after = reload();
    const resynced = sync(after);
    expect(resynced.granted).toEqual([]);
    expect(resynced.state.xp.total).toBe(total);
  });

  it('cannot be farmed by unacknowledging and acknowledging again', () => {
    record(REST_DAY, acknowledgeRestDay(true));
    const earned = sync().state.xp.total;

    record(REST_DAY, acknowledgeRestDay(false));
    expect(sync().state.xp.total).toBe(earned); // earned XP is never clawed back

    record(REST_DAY, acknowledgeRestDay(true));
    expect(sync().granted).toEqual([]);
    expect(repo.getGameState()?.xp.total).toBe(earned);

    for (let round = 0; round < 10; round += 1) {
      record(REST_DAY, acknowledgeRestDay(round % 2 === 0));
      sync();
    }
    expect(repo.getGameState()?.xp.total).toBe(earned);
  });

  it('feeds the recovery and consistency skills', () => {
    record(REST_DAY, acknowledgeRestDay(true));
    const skills = sync().state.skills;

    expect(skills.find((skill) => skill.kind === 'recovery')?.xp).toBeGreaterThan(0);
    expect(skills.find((skill) => skill.kind === 'consistency')?.xp).toBeGreaterThan(0);
  });
});

describe('the three rest-day states stay distinguishable', () => {
  it('an untouched rest day is neither acknowledged nor active', () => {
    expect(repo.getDailyLog(REST_DAY)).toBeUndefined();
    const day = buildWeekView(plans, PROGRAMME_START_DATE, 1, repo.listDailyLogs(), DAY_1).days[6];
    expect(day?.state).toBe('rest');
    expect(day?.restDayAcknowledged).toBe(false);
    expect(day?.unplannedRestDayActivity).toBe(false);
  });

  it('acknowledged rest is distinct from doing something active', () => {
    record(REST_DAY, acknowledgeRestDay(true));
    const log = repo.getDailyLog(REST_DAY);

    expect(isRestDayAcknowledged(log)).toBe(true);
    expect(isDayMarkedComplete(log)).toBe(false);
  });

  it('records optional activity separately, and can hold both', () => {
    record(REST_DAY, acknowledgeRestDay(true));
    record(REST_DAY, { exercise: { completed: true, durationMinutes: 20 } });

    const log = repo.getDailyLog(REST_DAY);
    expect(isRestDayAcknowledged(log)).toBe(true);
    expect(isDayMarkedComplete(log)).toBe(true);
    expect(log?.exercise?.durationMinutes).toBe(20);

    const day = buildWeekView(plans, PROGRAMME_START_DATE, 1, repo.listDailyLogs(), DAY_1).days[6];
    expect(day?.state).toBe('rest');
    expect(day?.restDayAcknowledged).toBe(true);
    expect(day?.unplannedRestDayActivity).toBe(true);
  });

  it('activity alone does not count as acknowledgement', () => {
    record(REST_DAY, { exercise: { completed: true } });

    expect(isRestDayAcknowledged(repo.getDailyLog(REST_DAY))).toBe(false);
    expect(restXpAwards()).toEqual([]);
  });
});

describe('an unacknowledged rest day is never a failure', () => {
  it('still reads as a rest day in the week', () => {
    record(REST_DAY, { hydration: { glasses: 6 } });

    const week = buildWeekView(plans, PROGRAMME_START_DATE, 1, repo.listDailyLogs(), '2026-08-20');
    const day = week.days[6];

    expect(day?.state).toBe('rest');
    expect(week.summary.restDays).toBe(1);
    expect(week.summary.partialSessions).toBe(0);
    expect(week.summary.completeSessions).toBe(0);
  });

  it('is described without any language of failure', () => {
    expect(todayScreenSource).toMatch(/Recovery is part of the programme/);
    expect(todayScreenSource).toMatch(/I followed today/);
    expect(todayScreenSource).not.toMatch(/missed|failed|broke|streak/i);
  });

  it('asks about following the plan, not about exercising', () => {
    // The acknowledgement and the optional-activity toggle are separate controls.
    expect(todayScreenSource).toMatch(/acknowledgeRestDay/);
    expect(todayScreenSource).toMatch(/did something active anyway/);
  });
});

describe('nothing else about rest days changed', () => {
  it('leaves a planned session day unaffected', () => {
    const view = resolveToday(plans, PROGRAMME_START_DATE, DAY_1);
    const [yoga] = view.activities;
    if (!yoga) throw new Error('expected a planned activity');

    record(DAY_1, { exercise: { completedActivityIds: [yoga.id] } });
    const awards = sync().granted;

    expect(awards.some((event) => event.kind === 'activity_completed')).toBe(true);
    expect(awards.some((event) => event.kind === 'rest_day_observed')).toBe(false);
  });

  it('does not let acknowledgement create a fake completed session', () => {
    record(REST_DAY, acknowledgeRestDay(true));
    const week = buildWeekView(plans, PROGRAMME_START_DATE, 1, repo.listDailyLogs(), '2026-08-20');

    expect(week.summary.completeSessions).toBe(0);
    expect(week.days[6]?.activities).toEqual([]);
  });
});
