import { beforeEach, describe, expect, it } from 'vitest';
// Imported as text by Vite so the assertions below can inspect the real screen source
// without pulling in Node's fs types.
import todayScreenSource from '../ui/screens/TodayScreen.tsx?raw';
import { createTodaySession } from '../app/todaySession';
import { isDayMarkedComplete, symptomFlags } from '../domain/dailyLog';
import {
  PROGRAMME_START_DATE,
  WEEK_1_YOGA_VIDEO_LABEL,
  WEEK_1_YOGA_VIDEO_URL,
} from '../domain/defaults';
import { sequentialIdFactory } from '../domain/ids';
import { activitiesWithExternalContent, resolveToday } from '../domain/today';
import type { WeeklyPlan } from '../domain/types';
import { createMemoryStorageAdapter, type StorageAdapter } from '../storage/StorageAdapter';
import { DAILY_LOG_KEY_PREFIX, Repository, createRepository } from '../storage/repository';

const NOW = '2026-08-13T20:04:00.000+01:00';
const DAY_1 = '2026-08-13';
const DAY_2 = '2026-08-14';
const DAY_7 = '2026-08-19';

let adapter: StorageAdapter;
let repo: Repository;
let plans: WeeklyPlan[];

function newRepo(store: StorageAdapter, prefix = 'seed'): Repository {
  return createRepository(store, { now: () => NOW, makeId: sequentialIdFactory(prefix) });
}

function session(date: string, store: StorageAdapter = adapter) {
  const view = resolveToday(plans, PROGRAMME_START_DATE, date);
  return createTodaySession(newRepo(store, 'live'), date, {
    now: NOW,
    makeId: sequentialIdFactory(`s-${date}`),
    ...(view.planId !== undefined ? { weeklyPlanId: view.planId } : {}),
    ...(view.sessionId !== undefined ? { plannedSessionId: view.sessionId } : {}),
  });
}

function logKeys(store: StorageAdapter): string[] {
  return store.keys().filter((key) => key.startsWith(DAILY_LOG_KEY_PREFIX));
}

beforeEach(() => {
  adapter = createMemoryStorageAdapter();
  repo = newRepo(adapter);
  repo.initialise();
  plans = repo.getWeeklyPlans();
});

// ---------------------------------------------------------------------------

describe('application initialisation', () => {
  it('seeds and exposes everything Today needs', () => {
    expect(repo.getProfile()?.programmeStartDate).toBe(PROGRAMME_START_DATE);
    expect(repo.getWeeklyPlans()).toHaveLength(1);
    expect(repo.getDailyLog(DAY_1)).toBeUndefined();
  });

  it('does not resurrect defaults over stored data on a later launch', () => {
    const baseline = repo.getBaseline();
    if (!baseline) throw new Error('expected a baseline');
    repo.saveBaseline({ ...baseline, weightKg: 68.2 });

    newRepo(adapter, 'again').initialise();
    expect(repo.getBaseline()?.weightKg).toBe(68.2);
  });
});

describe('rolling programme resolution', () => {
  it('places the start date at week 1, day 1', () => {
    const view = resolveToday(plans, PROGRAMME_START_DATE, DAY_1);
    expect(view.weekNumber).toBe(1);
    expect(view.dayIndex).toBe(1);
    expect(view.status).toBe('planned');
  });

  it('advances the day index without reference to the weekday', () => {
    expect(resolveToday(plans, PROGRAMME_START_DATE, DAY_2).dayIndex).toBe(2);
    expect(resolveToday(plans, PROGRAMME_START_DATE, '2026-08-17').dayIndex).toBe(5);
    expect(resolveToday(plans, PROGRAMME_START_DATE, DAY_7).dayIndex).toBe(7);
  });

  it('rolls into week 2 on day 8', () => {
    const view = resolveToday(plans, PROGRAMME_START_DATE, '2026-08-20');
    expect(view.weekNumber).toBe(2);
    expect(view.dayIndex).toBe(1);
    expect(view.status).toBe('no_plan');
  });

  it('reports a calm state before the programme starts, not an error', () => {
    const view = resolveToday(plans, PROGRAMME_START_DATE, '2026-08-12');
    expect(view.status).toBe('before_programme');
    expect(view.activities).toEqual([]);
  });
});

describe('what each day shows', () => {
  it('day 1 shows beginner yoga and an easy walk', () => {
    const view = resolveToday(plans, PROGRAMME_START_DATE, DAY_1);
    expect(
      view.activities.map((activity) => [activity.label, activity.durationMinutes]),
    ).toEqual([
      ['beginner yoga', 10],
      ['easy walk', 5],
    ]);
    expect(view.plannedMinutes).toBe(15);
  });

  it('days 3 and 5 match day 1', () => {
    for (const date of ['2026-08-15', '2026-08-17']) {
      const view = resolveToday(plans, PROGRAMME_START_DATE, date);
      expect(view.activities.map((activity) => activity.type)).toEqual(['yoga', 'walk']);
    }
  });

  it('day 2 shows a single 15-minute easy walk', () => {
    const view = resolveToday(plans, PROGRAMME_START_DATE, DAY_2);
    expect(view.status).toBe('planned');
    expect(view.activities).toHaveLength(1);
    expect(view.activities[0]?.label).toBe('easy walk');
    expect(view.activities[0]?.durationMinutes).toBe(15);
  });

  it('days 4 and 6 match day 2', () => {
    for (const date of ['2026-08-16', '2026-08-18']) {
      const view = resolveToday(plans, PROGRAMME_START_DATE, date);
      expect(view.plannedMinutes).toBe(15);
      expect(view.activities).toHaveLength(1);
    }
  });

  it('day 7 is a rest day, not missing data and not a failure', () => {
    const view = resolveToday(plans, PROGRAMME_START_DATE, DAY_7);
    expect(view.status).toBe('rest');
    expect(view.activities).toEqual([]);
    expect(view.plannedMinutes).toBe(0);
    expect(view.sessionNote).toMatch(/rest/i);
    // A rest day is a planned day: it knows which week and plan it belongs to.
    expect(view.weekNumber).toBe(1);
    expect(view.planId).toBeDefined();
  });

  it('carries the target effort band as context', () => {
    const view = resolveToday(plans, PROGRAMME_START_DATE, DAY_1);
    expect([view.targetEffortMin, view.targetEffortMax]).toEqual([2, 4]);
  });
});

describe('yoga video link', () => {
  it('exposes the official YouTube URL on the yoga activity', () => {
    const view = resolveToday(plans, PROGRAMME_START_DATE, DAY_1);
    const yoga = view.activities.find((activity) => activity.type === 'yoga');

    expect(yoga?.externalUrl).toBe('https://www.youtube.com/watch?v=j7rKKpwdXNE');
    expect(yoga?.externalUrl).toBe(WEEK_1_YOGA_VIDEO_URL);
    expect(yoga?.provider).toBe('youtube');
  });

  it('always carries creator attribution alongside the link', () => {
    const view = resolveToday(plans, PROGRAMME_START_DATE, DAY_1);
    for (const activity of activitiesWithExternalContent(view)) {
      expect(activity.externalLabel).toBeDefined();
      expect(activity.externalLabel).toBe(WEEK_1_YOGA_VIDEO_LABEL);
    }
  });

  it('does not attach a link to the walk', () => {
    const view = resolveToday(plans, PROGRAMME_START_DATE, DAY_1);
    const walk = view.activities.find((activity) => activity.type === 'walk');
    expect(walk?.externalUrl).toBeUndefined();
    expect(activitiesWithExternalContent(view)).toHaveLength(1);
  });

  it('points at the official host, never a local or proxied copy', () => {
    const url = new URL(WEEK_1_YOGA_VIDEO_URL);
    expect(url.protocol).toBe('https:');
    expect(url.hostname).toBe('www.youtube.com');
    expect(WEEK_1_YOGA_VIDEO_URL).not.toMatch(/^\/|^\.|localhost|proxy|\.mp4|\.webm/i);
  });

  it('opens as an ordinary outbound link, and embeds nothing', () => {
    const source = todayScreenSource;

    // A plain anchor, opened safely in a new context.
    expect(source).toMatch(/href=\{activity\.externalUrl\}/);
    expect(source).toMatch(/target="_blank"/);
    expect(source).toMatch(/rel="noopener noreferrer"/);

    // No embedding, no hosting, no reproduction of the video itself.
    expect(source).not.toMatch(/<iframe/i);
    expect(source).not.toMatch(/<video/i);
    expect(source).not.toMatch(/youtube\.com\/embed/i);
    // The URL lives on the activity, not hardcoded into the screen.
    expect(source).not.toContain('j7rKKpwdXNE');
  });
});

describe('opening Today does not create a record', () => {
  it('writes nothing when the screen is merely opened', () => {
    const today = session(DAY_1);

    expect(today.isPersisted()).toBe(false);
    expect(today.getLog().date).toBe(DAY_1);
    expect(logKeys(adapter)).toEqual([]);

    today.save();
    expect(logKeys(adapter)).toEqual([]);
  });

  it('links a newly created log to the plan it was logged against', () => {
    const view = resolveToday(plans, PROGRAMME_START_DATE, DAY_1);
    const log = session(DAY_1).getLog();
    expect(log.weeklyPlanId).toBe(view.planId);
    expect(log.plannedSessionId).toBe(view.sessionId);
  });

  it('creates the day on the first real edit', () => {
    const today = session(DAY_1);
    today.apply({ hydration: { glasses: 1 } });
    expect(today.save().status).toBe('saved');

    expect(logKeys(adapter)).toEqual([`${DAILY_LOG_KEY_PREFIX}${DAY_1}`]);
    expect(repo.getDailyLog(DAY_1)?.hydration?.glasses).toBe(1);
  });

  it('still writes nothing if an edit leaves the day empty', () => {
    const today = session(DAY_1);
    today.apply({ hydration: { glasses: 2 } });
    today.apply({ hydration: { glasses: undefined } });

    expect(today.save().status).toBe('skipped');
    expect(logKeys(adapter)).toEqual([]);
  });

  it('does write once the day exists, even if it is emptied again', () => {
    const first = session(DAY_1);
    first.apply({ hydration: { glasses: 2 } });
    first.save();

    const second = session(DAY_1);
    second.apply({ hydration: { glasses: undefined } });
    expect(second.save().status).toBe('saved');
    expect(repo.getDailyLog(DAY_1)?.hydration?.glasses).toBeUndefined();
  });
});

describe('everything the screen records survives', () => {
  function record(update: Parameters<ReturnType<typeof session>['apply']>[0]) {
    const today = session(DAY_1);
    today.apply(update);
    expect(today.save().status).toBe('saved');
    const stored = repo.getDailyLog(DAY_1);
    if (!stored) throw new Error('expected the day to be stored');
    return stored;
  }

  it('completion', () => {
    expect(record({ exercise: { completed: true } }).exercise?.completed).toBe(true);
  });

  it('duration and effort', () => {
    const stored = record({ exercise: { durationMinutes: 15, effort: 3 } });
    expect(stored.exercise?.durationMinutes).toBe(15);
    expect(stored.exercise?.effort).toBe(3);
  });

  it('steps', () => {
    expect(record({ exercise: { steps: 3214 } }).exercise?.steps).toBe(3214);
  });

  it('back pain before and after', () => {
    const stored = record({ symptoms: { backPainBefore: 4, backPainAfter: 6 } });
    expect(stored.symptoms?.backPainBefore).toBe(4);
    expect(stored.symptoms?.backPainAfter).toBe(6);
  });

  it('leg pain, both answers, distinct from not answering', () => {
    expect(record({ symptoms: { legPain: true } }).symptoms?.legPain).toBe(true);

    const no = session(DAY_2);
    no.apply({ symptoms: { legPain: false } });
    no.save();
    expect(repo.getDailyLog(DAY_2)?.symptoms?.legPain).toBe(false);

    const unanswered = repo.getDailyLog(DAY_7);
    expect(unanswered).toBeUndefined();
  });

  it('toe sensation', () => {
    expect(record({ symptoms: { toeSensation: 'worse' } }).symptoms?.toeSensation).toBe('worse');
  });

  it('nutrition fields', () => {
    const stored = record({
      nutrition: {
        morningFruit: true,
        proteinMainMeal: true,
        goustoMeal: false,
        fruitVegServings: 4,
        snackNote: 'Two squares of chocolate.',
      },
    });
    expect(stored.nutrition).toMatchObject({
      morningFruit: true,
      proteinMainMeal: true,
      goustoMeal: false,
      fruitVegServings: 4,
      snackNote: 'Two squares of chocolate.',
    });
  });

  it('hydration', () => {
    const stored = record({ hydration: { glasses: 6, extraFluidNote: 'Two teas.' } });
    expect(stored.hydration?.glasses).toBe(6);
    expect(stored.hydration?.extraFluidNote).toBe('Two teas.');
  });

  it('recovery fields', () => {
    const stored = record({
      recovery: { sleepHours: 7.5, energy: 6, restingHeartRateBpm: 71, hrvMs: 39 },
    });
    expect(stored.recovery).toMatchObject({
      sleepHours: 7.5,
      energy: 6,
      restingHeartRateBpm: 71,
      hrvMs: 39,
    });
  });

  it('an explicit zero', () => {
    const stored = record({
      exercise: { steps: 0, durationMinutes: 0 },
      symptoms: { backPainBefore: 0 },
      hydration: { glasses: 0 },
    });
    expect(stored.exercise?.steps).toBe(0);
    expect(stored.exercise?.durationMinutes).toBe(0);
    expect(stored.symptoms?.backPainBefore).toBe(0);
    expect(stored.hydration?.glasses).toBe(0);
  });

  it('an explicit false', () => {
    const stored = record({
      exercise: { completed: false },
      nutrition: { morningFruit: false },
      symptoms: { legPain: false },
    });
    expect(stored.exercise?.completed).toBe(false);
    expect(stored.nutrition?.morningFruit).toBe(false);
    expect(stored.symptoms?.legPain).toBe(false);
  });

  it('leaves untouched fields absent rather than defaulting them', () => {
    const stored = record({ exercise: { completed: true } });
    expect(stored.exercise && 'steps' in stored.exercise).toBe(false);
    expect(stored.symptoms).toBeUndefined();
    expect(stored.nutrition).toBeUndefined();
    expect(stored.recovery).toBeUndefined();
  });
});

describe('completion is never touched by symptoms', () => {
  it('stays true when every symptom is recorded as worse', () => {
    const today = session(DAY_1);
    today.apply({ exercise: { completed: true, durationMinutes: 15, effort: 3 } });
    today.apply({
      symptoms: { backPainBefore: 3, backPainAfter: 8, legPain: true, toeSensation: 'worse' },
    });
    today.save();

    const stored = repo.getDailyLog(DAY_1);
    expect(stored?.exercise?.completed).toBe(true);
    expect(isDayMarkedComplete(stored)).toBe(true);
    expect(symptomFlags(stored)).toEqual(['leg_pain', 'toe_sensation_worse']);
  });

  it('recording symptoms after completing does not rewrite the completion', () => {
    const first = session(DAY_1);
    first.apply({ exercise: { completed: true } });
    first.save();

    const later = session(DAY_1);
    later.apply({ symptoms: { toeSensation: 'worse' } });
    later.save();

    expect(repo.getDailyLog(DAY_1)?.exercise?.completed).toBe(true);
  });
});

describe('reopening and partial edits', () => {
  it('restores what was recorded when Today is opened again', () => {
    const first = session(DAY_1);
    first.apply({
      exercise: { completed: true, durationMinutes: 15, effort: 3, steps: 3214 },
      hydration: { glasses: 5 },
    });
    first.save();

    // A fresh session over the same store, as a reload would produce.
    const reopened = session(DAY_1);
    expect(reopened.isPersisted()).toBe(true);

    const log = reopened.getLog();
    expect(log.exercise?.completed).toBe(true);
    expect(log.exercise?.durationMinutes).toBe(15);
    expect(log.exercise?.effort).toBe(3);
    expect(log.exercise?.steps).toBe(3214);
    expect(log.hydration?.glasses).toBe(5);
  });

  it('editing one section leaves every other section intact', () => {
    const first = session(DAY_1);
    first.apply({
      exercise: { completed: true, steps: 3214 },
      symptoms: { backPainBefore: 4 },
      nutrition: { morningFruit: true },
      recovery: { sleepHours: 7 },
    });
    first.save();

    const second = session(DAY_1);
    second.apply({ hydration: { glasses: 6 } });
    second.save();

    const stored = repo.getDailyLog(DAY_1);
    expect(stored?.exercise?.completed).toBe(true);
    expect(stored?.exercise?.steps).toBe(3214);
    expect(stored?.symptoms?.backPainBefore).toBe(4);
    expect(stored?.nutrition?.morningFruit).toBe(true);
    expect(stored?.recovery?.sleepHours).toBe(7);
    expect(stored?.hydration?.glasses).toBe(6);
  });

  it('editing a field within a section leaves its siblings intact', () => {
    const first = session(DAY_1);
    first.apply({ exercise: { completed: true, durationMinutes: 15, effort: 3, steps: 1000 } });
    first.save();

    const second = session(DAY_1);
    second.apply({ exercise: { steps: 4200 } });
    second.save();

    const stored = repo.getDailyLog(DAY_1);
    expect(stored?.exercise).toMatchObject({
      completed: true,
      durationMinutes: 15,
      effort: 3,
      steps: 4200,
    });
  });

  it('keeps id and createdAt across a reopen and edit', () => {
    const first = session(DAY_1);
    first.apply({ hydration: { glasses: 1 } });
    first.save();
    const original = repo.getDailyLog(DAY_1);

    const second = session(DAY_1);
    second.apply({ hydration: { glasses: 2 } });
    second.save();

    const updated = repo.getDailyLog(DAY_1);
    expect(updated?.id).toBe(original?.id);
    expect(updated?.createdAt).toBe(original?.createdAt);
  });

  it('records a rest day without disturbing the days around it', () => {
    const rest = session(DAY_7);
    rest.apply({ hydration: { glasses: 4 }, recovery: { energy: 7 } });
    rest.save();

    const day1 = session(DAY_1);
    day1.apply({ exercise: { completed: true } });
    day1.save();

    expect(repo.getDailyLog(DAY_7)?.hydration?.glasses).toBe(4);
    expect(repo.getDailyLog(DAY_7)?.exercise).toBeUndefined();
    expect(repo.getDailyLog(DAY_1)?.exercise?.completed).toBe(true);
    expect(logKeys(adapter).sort()).toEqual([
      `${DAILY_LOG_KEY_PREFIX}${DAY_1}`,
      `${DAILY_LOG_KEY_PREFIX}${DAY_7}`,
    ]);
  });
});

describe('saving failures are reported, not thrown', () => {
  it('returns a failed outcome and keeps the entry in memory', () => {
    const failing: StorageAdapter = {
      get: () => null,
      set: () => {
        throw new Error('QuotaExceededError');
      },
      remove: () => undefined,
      keys: () => [],
    };
    const today = createTodaySession(newRepo(failing, 'x'), DAY_1, {
      now: NOW,
      makeId: sequentialIdFactory('f'),
    });

    today.apply({ hydration: { glasses: 3 } });
    const outcome = today.save();

    expect(outcome.status).toBe('failed');
    expect(today.getLog().hydration?.glasses).toBe(3);
    expect(today.isPersisted()).toBe(false);
  });
});
