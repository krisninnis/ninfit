import { describe, expect, it } from 'vitest';

import { applyDailyLogUpdate, createEmptyDailyLog, type DailyLogUpdate } from '../domain/dailyLog';
import { addDays } from '../domain/dates';
import { sequentialIdFactory } from '../domain/ids';
import type {
  DailyLog,
  ISODate,
  PlannedActivity,
  PlannedSession,
  WeeklyPlan,
} from '../domain/types';
import { resolveSessionForDate, sessionForDayIndex } from '../domain/weeklyPlan';
import {
  CONSISTENCY_MILESTONES,
  consistencyProgress,
  consistencyRewardKey,
  consistencyTimeline,
  plannedDayKind,
} from '../domain/game/consistency';
import { createDefaultGameSettings, createInitialGameState } from '../domain/game/defaults';
import { deriveRewards, grantRewards, sealRewardKeys } from '../domain/game/rewards';
import type { GameState, RewardEvent } from '../domain/game/types';
import { CONSISTENCY_MILESTONE_XP, findSkill } from '../domain/game/xp';

/**
 * M2.5 consistency milestones.
 *
 * These tests exist to hold one product decision in place: the milestone counts
 * PLANNED OCCASIONS THAT WENT WELL, and never calendar days. Everything that follows
 * from that - rest bridging without a tap, low-frequency programmes taking a month to
 * reach seven, nothing punitive when a session goes by - is pinned below, because all
 * of it would be easy to "simplify" back into a daily streak by accident.
 *
 * Everything runs on in-memory fixtures. No repository, no storage adapter, no
 * browser state is touched.
 */

const START: ISODate = '2026-08-13'; // A Thursday, on purpose: no Monday anywhere.
const NOW = '2026-08-13T09:00:00.000+01:00';

/** A planned activity count, a planned rest day, or nothing planned at all. */
type DayShape = number | 'rest' | 'none';

function day(offset: number): ISODate {
  return addDays(START, offset);
}

function buildPlans(weeks: readonly DayShape[][]): WeeklyPlan[] {
  return weeks.map((week, weekIndex) => {
    const weekNumber = weekIndex + 1;
    const sessions: PlannedSession[] = [];

    week.forEach((shape, dayOffset) => {
      const dayIndex = dayOffset + 1;
      if (shape === 'none') return;

      const activities: PlannedActivity[] =
        shape === 'rest'
          ? []
          : Array.from({ length: shape }, (_unused, index) => ({
              id: `w${weekNumber}d${dayIndex}a${index + 1}`,
              type: 'walk' as const,
              label: 'Walk',
              durationMinutes: 20,
              intensity: 'very_light' as const,
            }));

      sessions.push({ id: `w${weekNumber}d${dayIndex}`, dayIndex, activities });
    });

    return {
      id: `plan-${weekNumber}`,
      programmeVersion: 'test',
      weekNumber,
      startDate: addDays(START, (weekNumber - 1) * 7),
      targetEffortMin: 0,
      targetEffortMax: 0,
      sessions,
      createdAt: NOW,
    };
  });
}

/** A week of planned activity every day. */
const EVERY_DAY: DayShape[] = [1, 1, 1, 1, 1, 1, 1];
/** Two planned sessions and five planned rest days: the recovery-heavy shape. */
const RECOVERY_HEAVY: DayShape[] = [1, 'rest', 'rest', 1, 'rest', 'rest', 'rest'];

function activityIdsOn(plans: readonly WeeklyPlan[], date: ISODate): string[] {
  return resolveSessionForDate(plans, START, date)?.session.activities.map((a) => a.id) ?? [];
}

function logOn(date: ISODate, exercise: DailyLogUpdate['exercise']): DailyLog {
  const base = createEmptyDailyLog({ date }, { now: NOW, makeId: sequentialIdFactory(`l-${date}`) });
  return applyDailyLogUpdate(
    base,
    { exercise },
    { now: NOW, makeId: sequentialIdFactory(`e-${date}`) },
  );
}

/** Tick the first `count` planned activities on a date. */
function completed(
  plans: readonly WeeklyPlan[],
  date: ISODate,
  count = Number.POSITIVE_INFINITY,
): DailyLog {
  const ids = activityIdsOn(plans, date).slice(0, count);
  return logOn(date, { completedActivityIds: ids });
}

function snapshotOf(plans: readonly WeeklyPlan[], logs: readonly DailyLog[]) {
  return { programmeStartDate: START, plans, logs, measurementCount: 0 };
}

function progressFor(plans: readonly WeeklyPlan[], logs: readonly DailyLog[]) {
  return consistencyProgress({ programmeStartDate: START, plans, logs });
}

/** Derive and grant once, from a fresh game state. */
function sync(
  plans: readonly WeeklyPlan[],
  logs: readonly DailyLog[],
  state: GameState = createInitialGameState({ now: NOW }),
): { state: GameState; granted: RewardEvent[] } {
  return grantRewards(state, deriveRewards(snapshotOf(plans, logs)), {
    now: NOW,
    makeId: sequentialIdFactory('ev'),
    settings: createDefaultGameSettings(),
  });
}

function milestoneEvents(granted: readonly RewardEvent[]): RewardEvent[] {
  return granted.filter((event) => event.kind === 'consistency_milestone');
}

/** Complete every planned activity on the first `days` programme days that have any. */
function completeFirst(plans: readonly WeeklyPlan[], days: number): DailyLog[] {
  const logs: DailyLog[] = [];
  for (let offset = 0; logs.length < days && offset < 120; offset += 1) {
    const date = day(offset);
    if (activityIdsOn(plans, date).length === 0) continue;
    logs.push(completed(plans, date));
  }
  return logs;
}

// ---------------------------------------------------------------------------

describe('what counts as a qualifying occasion', () => {
  const plans = buildPlans([EVERY_DAY]);

  it('counts one qualifying occasion after the first good session', () => {
    const progress = progressFor(plans, [completed(plans, day(0))]);
    expect(progress.currentRun).toBe(1);
    expect(progress.awards).toEqual([]);
  });

  it('counts two, and still awards nothing', () => {
    const progress = progressFor(plans, [completed(plans, day(0)), completed(plans, day(1))]);
    expect(progress.currentRun).toBe(2);
    expect(progress.awards).toEqual([]);
  });

  it('treats a complete session as qualifying', () => {
    const twoActivities = buildPlans([[2, 1, 1, 1, 1, 1, 1]]);
    const progress = progressFor(twoActivities, [completed(twoActivities, day(0))]);
    expect(progress.currentRun).toBe(1);
  });

  it('treats a PARTIAL session as qualifying', () => {
    // One of two done. Partial completion counts, everywhere, always.
    const twoActivities = buildPlans([[2, 1, 1, 1, 1, 1, 1]]);
    const log = completed(twoActivities, day(0), 1);
    expect(activityIdsOn(twoActivities, day(0))).toHaveLength(2);
    expect(progressFor(twoActivities, [log]).currentRun).toBe(1);
  });

  it('counts a heavy day once, not once per activity', () => {
    const threeActivities = buildPlans([[3, 1, 1, 1, 1, 1, 1]]);
    const progress = progressFor(threeActivities, [completed(threeActivities, day(0))]);
    expect(activityIdsOn(threeActivities, day(0))).toHaveLength(3);
    expect(progress.currentRun).toBe(1);
  });

  it('honours a legacy record that only carries the day-level flag', () => {
    // Pre-per-activity records say "the session was done" and nothing finer.
    const log = logOn(day(0), { completed: true });
    expect(log.exercise?.completedActivityIds).toBeUndefined();
    expect(progressFor(plans, [log]).currentRun).toBe(1);
  });

  it('does not count a planned day with nothing recorded', () => {
    expect(progressFor(plans, []).currentRun).toBe(0);
    expect(progressFor(plans, [logOn(day(0), { durationMinutes: 30 })]).currentRun).toBe(0);
  });
});

// ---------------------------------------------------------------------------

describe('unplanned days are not planned consistency', () => {
  it('does not count activity on a day the programme never planned', () => {
    // Day 2 has no session at all. The day-level completed flag is the strongest
    // signal such a day can carry, and it still must not advance the milestone,
    // because a milestone measures the PROGRAMME being followed.
    const plans = buildPlans([[1, 'none', 1, 1, 1, 1, 1]]);
    const logs = [
      completed(plans, day(0)),
      logOn(day(1), { completed: true }),
      completed(plans, day(2)),
    ];
    expect(activityIdsOn(plans, day(1))).toEqual([]);
    expect(progressFor(plans, logs).currentRun).toBe(2);
  });

  it('classifies an unplanned day as unplanned, never as rest', () => {
    const plans = buildPlans([[1, 'none', 'rest', 1, 1, 1, 1]]);
    const plan = plans[0];
    expect(plan).toBeDefined();
    if (plan === undefined) return;

    expect(plannedDayKind(sessionForDayIndex(plan, 1))).toBe('activity');
    expect(plannedDayKind(sessionForDayIndex(plan, 2))).toBe('unplanned');
    expect(plannedDayKind(sessionForDayIndex(plan, 3))).toBe('rest');
    expect(plannedDayKind(undefined)).toBe('unplanned');
  });

  it('keeps unplanned days out of the timeline entirely', () => {
    const plans = buildPlans([[1, 'none', 'rest', 1, 1, 1, 1]]);
    const timeline = consistencyTimeline({ programmeStartDate: START, plans, logs: [] });
    expect(timeline.map((entry) => entry.date)).not.toContain(day(1));
    expect(timeline.find((entry) => entry.date === day(2))?.kind).toBe('rest');
  });

  it('does not end a run on a day nothing was planned for', () => {
    const plans = buildPlans([[1, 'none', 1, 1, 1, 1, 1]]);
    const logs = [completed(plans, day(0)), completed(plans, day(2)), completed(plans, day(3))];
    const progress = progressFor(plans, logs);
    expect(progress.currentRun).toBe(3);
    expect(progress.awards).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------

describe('planned rest is a neutral bridge', () => {
  const plans = buildPlans([[1, 'rest', 1, 'rest', 1, 1, 1]]);

  it('does not advance the count', () => {
    const logs = [completed(plans, day(0)), completed(plans, day(2))];
    expect(progressFor(plans, logs).currentRun).toBe(2);
  });

  it('does not end the run', () => {
    const logs = [completed(plans, day(0)), completed(plans, day(2)), completed(plans, day(4))];
    // Two rest days sit between these three sessions and neither interrupts anything.
    expect(progressFor(plans, logs).currentRun).toBe(3);
    expect(progressFor(plans, logs).awards).toHaveLength(1);
  });

  it('needs no rest-day acknowledgement', () => {
    const logs = [completed(plans, day(0)), completed(plans, day(2)), completed(plans, day(4))];
    for (const log of logs) {
      expect(log.exercise?.restDayAcknowledged).toBeUndefined();
    }
    expect(progressFor(plans, logs).currentRun).toBe(3);
  });

  it('needs no log at all on the rest day', () => {
    // The decisive assertion for "you may close the app on a rest day": there is no
    // record whatsoever for day(1) or day(3), and the run is untouched.
    const logs = [completed(plans, day(0)), completed(plans, day(2)), completed(plans, day(4))];
    expect(logs.map((log) => log.date)).toEqual([day(0), day(2), day(4)]);
    expect(progressFor(plans, logs).currentRun).toBe(3);
  });

  it('needs no reward key on the rest day', () => {
    const logs = [completed(plans, day(0)), completed(plans, day(2)), completed(plans, day(4))];
    const { state } = sync(plans, logs);
    expect(state.awardedKeys.some((key) => key.startsWith('rest:'))).toBe(false);
    expect(state.awardedKeys).toContain(consistencyRewardKey(3, 1));
  });

  it('bridges across several consecutive rest days', () => {
    const long = buildPlans([[1, 'rest', 'rest', 'rest', 'rest', 'rest', 1]]);
    const logs = [completed(long, day(0)), completed(long, day(6))];
    expect(progressFor(long, logs).currentRun).toBe(2);
  });

  it('never lets rest alone earn a milestone', () => {
    const restOnly = buildPlans([['rest', 'rest', 'rest', 'rest', 'rest', 'rest', 'rest']]);
    const progress = progressFor(restOnly, []);
    expect(progress.currentRun).toBe(0);
    expect(progress.awards).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe('the 3x milestone', () => {
  const plans = buildPlans([EVERY_DAY]);
  const logs = completeFirst(plans, 3);

  it('is reached on the third qualifying occasion', () => {
    const progress = progressFor(plans, logs);
    expect(progress.currentRun).toBe(3);
    expect(progress.awards).toEqual([
      { milestone: 3, occurrence: 1, date: day(2), key: 'consistency:3x:1' },
    ]);
  });

  it('grants 30 XP and 5 consistency skill XP', () => {
    const { state, granted } = sync(plans, logs);
    const events = milestoneEvents(granted);

    expect(events).toHaveLength(1);
    expect(events[0]?.xp).toBe(30);
    expect(events[0]?.xp).toBe(CONSISTENCY_MILESTONE_XP[3]);
    expect(events[0]?.skillXp).toEqual({ consistency: 5 });
    expect(events[0]?.label).toBe('Three sessions of consistency');
    expect(state.awardedKeys).toContain('consistency:3x:1');
  });

  it('grants exactly once, however many times the data is re-derived', () => {
    const first = sync(plans, logs);
    const second = sync(plans, logs, first.state);
    const third = sync(plans, logs, second.state);

    expect(milestoneEvents(first.granted)).toHaveLength(1);
    expect(milestoneEvents(second.granted)).toHaveLength(0);
    expect(milestoneEvents(third.granted)).toHaveLength(0);
    expect(third.state.xp.total).toBe(first.state.xp.total);
  });
});

// ---------------------------------------------------------------------------

describe('the 7x milestone', () => {
  const plans = buildPlans([EVERY_DAY]);
  const logs = completeFirst(plans, 7);

  it('is reached on the seventh qualifying occasion', () => {
    const progress = progressFor(plans, logs);
    expect(progress.currentRun).toBe(7);
    expect(progress.awards.map((award) => award.key)).toEqual([
      'consistency:3x:1',
      'consistency:7x:1',
    ]);
    expect(progress.awards[1]?.date).toBe(day(6));
  });

  it('grants 80 XP and 10 consistency skill XP', () => {
    const { granted } = sync(plans, logs);
    const seven = milestoneEvents(granted).find((event) => event.key === 'consistency:7x:1');

    expect(seven?.xp).toBe(80);
    expect(seven?.xp).toBe(CONSISTENCY_MILESTONE_XP[7]);
    expect(seven?.skillXp).toEqual({ consistency: 10 });
    expect(seven?.label).toBe('Seven sessions of consistency');
  });

  it('grants exactly once', () => {
    const first = sync(plans, logs);
    const second = sync(plans, logs, first.state);
    // Sorted, because `grantRewards` reverses the granted list on its way into
    // `recentEvents` and this test is about how many, not in what order.
    expect(milestoneEvents(first.granted).map((e) => e.key).sort()).toEqual([
      'consistency:3x:1',
      'consistency:7x:1',
    ]);
    expect(milestoneEvents(second.granted)).toEqual([]);
  });

  it('adds both milestones to the consistency skill and nothing else', () => {
    const { state } = sync(plans, logs);
    const bare = sync(plans, []).state;
    const gained = (game: GameState) => findSkill(game.skills, 'consistency')?.xp ?? 0;
    // 5 from the 3x plus 10 from the 7x, on top of whatever the sessions themselves gave.
    expect(gained(state)).toBeGreaterThan(gained(bare));
  });
});

// ---------------------------------------------------------------------------

describe('beyond seven', () => {
  it('keeps counting but awards nothing further', () => {
    const plans = buildPlans([EVERY_DAY, EVERY_DAY]);
    const logs = completeFirst(plans, 12);
    const progress = progressFor(plans, logs);

    expect(progress.currentRun).toBe(12);
    expect(progress.awards.map((award) => award.key)).toEqual([
      'consistency:3x:1',
      'consistency:7x:1',
    ]);
  });

  it('defines no milestone other than three and seven', () => {
    expect([...CONSISTENCY_MILESTONES]).toEqual([3, 7]);
  });
});

// ---------------------------------------------------------------------------

describe('what ends a run, and what that costs', () => {
  const plans = buildPlans([EVERY_DAY, EVERY_DAY]);

  it('ends the run when a planned session goes by with nothing done', () => {
    const logs = [
      completed(plans, day(0)),
      completed(plans, day(1)),
      // day(2) planned, nothing recorded.
      completed(plans, day(3)),
      completed(plans, day(4)),
    ];
    const progress = progressFor(plans, logs);
    expect(progress.currentRun).toBe(2);
    expect(progress.longestRun).toBe(2);
    expect(progress.awards).toEqual([]);
  });

  it('ends it silently: no event, no negative reward, no punitive key', () => {
    const logs = [
      completed(plans, day(0)),
      completed(plans, day(1)),
      completed(plans, day(3)),
    ];
    const { state, granted } = sync(plans, logs);

    expect(milestoneEvents(granted)).toEqual([]);
    for (const event of granted) {
      expect(event.xp).toBeGreaterThanOrEqual(0);
      for (const value of Object.values(event.skillXp)) {
        expect(value).toBeGreaterThanOrEqual(0);
      }
    }
    const persisted = JSON.stringify(state).toLowerCase();
    for (const word of ['broken', 'failed', 'lost', 'missed_streak', 'streak']) {
      expect(persisted, `persisted state must not mention "${word}"`).not.toContain(word);
    }
  });

  it('keeps an earned 3x after a later session is missed', () => {
    const earned = sync(plans, completeFirst(plans, 3));
    expect(earned.state.awardedKeys).toContain('consistency:3x:1');

    // The same three good days, then a planned day that went by.
    const after = sync(plans, completeFirst(plans, 3), earned.state);
    expect(after.state.awardedKeys).toContain('consistency:3x:1');
    expect(after.state.xp.total).toBeGreaterThanOrEqual(earned.state.xp.total);
    expect(milestoneEvents(after.granted)).toEqual([]);
  });

  it('keeps an earned 7x after a later session is missed', () => {
    const earned = sync(plans, completeFirst(plans, 7));
    expect(earned.state.awardedKeys).toContain('consistency:7x:1');

    const logs = [...completeFirst(plans, 7), completed(plans, day(9))];
    const after = sync(plans, logs, earned.state);
    expect(after.state.awardedKeys).toContain('consistency:7x:1');
    expect(milestoneEvents(after.granted)).toEqual([]);
    expect(progressFor(plans, logs).currentRun).toBe(1);
  });

  it('never removes XP when work is un-ticked', () => {
    const logs = completeFirst(plans, 7);
    const earned = sync(plans, logs);
    const before = earned.state.xp.total;

    // Everything un-ticked. The derivation now finds no qualifying occasion at all.
    const cleared = logs.map((log) => logOn(log.date, { completedActivityIds: [] }));
    expect(progressFor(plans, cleared).currentRun).toBe(0);

    const after = sync(plans, cleared, earned.state);
    expect(after.state.xp.total).toBe(before);
    expect(after.state.awardedKeys).toContain('consistency:3x:1');
    expect(after.state.awardedKeys).toContain('consistency:7x:1');
    expect(after.granted).toEqual([]);
  });

  it('lets a new run earn the 3x again as a separate occurrence', () => {
    const logs = [
      completed(plans, day(0)),
      completed(plans, day(1)),
      completed(plans, day(2)),
      // day(3) missed.
      completed(plans, day(4)),
      completed(plans, day(5)),
      completed(plans, day(6)),
    ];
    const progress = progressFor(plans, logs);
    expect(progress.awards.map((award) => award.key)).toEqual([
      'consistency:3x:1',
      'consistency:3x:2',
    ]);
    expect(progress.currentRun).toBe(3);
    expect(progress.longestRun).toBe(3);

    const { granted } = sync(plans, logs);
    expect(milestoneEvents(granted)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------

describe('programme shape', () => {
  it('starts midweek without a Monday anywhere in sight', () => {
    // 2026-08-13 is a Thursday. Day index 1 of every week must land on a Thursday.
    expect(new Date(`${START}T12:00:00`).getDay()).toBe(4);
    const plans = buildPlans([RECOVERY_HEAVY, RECOVERY_HEAVY]);
    const timeline = consistencyTimeline({ programmeStartDate: START, plans, logs: [] });

    expect(timeline[0]?.date).toBe('2026-08-13');
    expect(timeline[7]?.date).toBe('2026-08-20');
    expect(new Date(`${timeline[7]?.date}T12:00:00`).getDay()).toBe(4);
  });

  it('lets a low-frequency programme reach 7x across several weeks', () => {
    const plans = buildPlans([RECOVERY_HEAVY, RECOVERY_HEAVY, RECOVERY_HEAVY, RECOVERY_HEAVY]);
    const logs = completeFirst(plans, 7);
    const progress = progressFor(plans, logs);

    expect(progress.currentRun).toBe(7);
    expect(progress.awards.map((award) => award.key)).toEqual([
      'consistency:3x:1',
      'consistency:7x:1',
    ]);
    // Two sessions a week, so the seventh occasion is three weeks out. That is the
    // whole point: seven OCCASIONS, not seven days.
    expect(progress.awards[1]?.date).toBe(day(21));
  });

  it('progresses through a recovery-heavy week with five planned rest days', () => {
    const plans = buildPlans([RECOVERY_HEAVY, RECOVERY_HEAVY]);
    const restDays = consistencyTimeline({ programmeStartDate: START, plans, logs: [] }).filter(
      (entry) => entry.kind === 'rest',
    );
    expect(restDays).toHaveLength(10);

    const logs = completeFirst(plans, 3);
    expect(progressFor(plans, logs).awards.map((a) => a.key)).toEqual(['consistency:3x:1']);
  });

  it('handles the autumn clock change without losing or repeating a day', () => {
    // UK clocks go back on 2026-10-25, inside week 11 of a programme starting 13 Aug.
    const weeks = Array.from({ length: 12 }, () => EVERY_DAY);
    const plans = buildPlans(weeks);
    const timeline = consistencyTimeline({ programmeStartDate: START, plans, logs: [] });

    expect(timeline).toHaveLength(84);
    expect(new Set(timeline.map((entry) => entry.date)).size).toBe(84);
    expect(timeline.map((entry) => entry.date)).toContain('2026-10-25');
    for (let index = 1; index < timeline.length; index += 1) {
      expect(timeline[index]?.date).toBe(addDays(timeline[index - 1]?.date ?? START, 1));
    }
  });

  it('reads local day keys and never constructs a UTC date', async () => {
    const source = (await import('../domain/game/consistency.ts?raw')).default;
    expect(source).not.toContain('toISOString');
    expect(source).not.toContain('new Date');
  });
});

// ---------------------------------------------------------------------------

describe('idempotency across imports, re-syncs and plan edits', () => {
  const plans = buildPlans([EVERY_DAY, EVERY_DAY]);
  const logs = completeFirst(plans, 7);

  it('grants nothing at all on a repeat sync of unchanged data', () => {
    const first = sync(plans, logs);
    const second = sync(plans, logs, first.state);
    expect(second.granted).toEqual([]);
    expect(second.state.xp.total).toBe(first.state.xp.total);
  });

  it('seals imported history without paying out for it', () => {
    const facts = deriveRewards(snapshotOf(plans, logs));
    const sealed = sealRewardKeys(createInitialGameState({ now: NOW }), facts);

    expect(sealed.awardedKeys).toContain('consistency:3x:1');
    expect(sealed.awardedKeys).toContain('consistency:7x:1');
    expect(sealed.xp.total).toBe(0);

    const after = sync(plans, logs, sealed);
    expect(after.granted).toEqual([]);
    expect(after.state.xp.total).toBe(0);
  });

  it('does not duplicate XP for a key that is already recorded', () => {
    const seeded: GameState = {
      ...createInitialGameState({ now: NOW }),
      awardedKeys: ['consistency:3x:1', 'consistency:7x:1'],
    };
    const { granted } = sync(plans, logs, seeded);
    expect(milestoneEvents(granted)).toEqual([]);
  });

  it('keys by occurrence, so a plan edit cannot re-pay the same milestone', () => {
    const earned = sync(plans, completeFirst(plans, 3));
    expect(earned.state.awardedKeys).toContain('consistency:3x:1');

    // The plan is rewritten so a previously unplanned day now carries a session. The
    // milestone is still the FIRST time three was reached, so the key is unchanged.
    const edited = buildPlans([[1, 1, 1, 1, 1, 1, 1], EVERY_DAY]);
    const editedLogs = [
      completed(edited, day(0)),
      completed(edited, day(1)),
      completed(edited, day(2)),
    ];
    const after = sync(edited, editedLogs, earned.state);
    expect(milestoneEvents(after.granted)).toEqual([]);
    expect(after.state.awardedKeys.filter((key) => key.startsWith('consistency:3x'))).toEqual([
      'consistency:3x:1',
    ]);
  });

  it('builds the same key from the same milestone and occurrence, every time', () => {
    expect(consistencyRewardKey(3, 1)).toBe('consistency:3x:1');
    expect(consistencyRewardKey(7, 2)).toBe('consistency:7x:2');
  });

  it('is order-independent: shuffled logs give an identical result', () => {
    const shuffled = [...logs].reverse();
    expect(progressFor(plans, shuffled)).toEqual(progressFor(plans, logs));
  });
});

// ---------------------------------------------------------------------------

describe('nothing punitive is ever written down', () => {
  const plans = buildPlans([EVERY_DAY, EVERY_DAY]);

  it('persists no consistency counter of any kind', () => {
    const { state } = sync(plans, completeFirst(plans, 7));
    const keys = Object.keys(state);
    for (const forbidden of ['streak', 'consistency', 'run', 'currentRun', 'longestRun']) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it('records only milestones in awardedKeys, never a shortfall', () => {
    const logs = [completed(plans, day(0)), completed(plans, day(2))]; // day(1) missed
    const { state } = sync(plans, logs);
    const consistencyKeys = state.awardedKeys.filter((key) => key.startsWith('consistency:'));
    expect(consistencyKeys).toEqual([]);
  });

  it('leaves the mascot untouched by a run ending', () => {
    const good = sync(plans, completeFirst(plans, 3));
    const logs = [...completeFirst(plans, 3), completed(plans, day(4))]; // day(3) missed
    const after = sync(plans, logs, good.state);

    expect(after.state.mascot.stage).toBe(good.state.mascot.stage);
    expect(after.state.mascot.eggState).toBe(good.state.mascot.eggState);
    expect(after.state.mascot.evolutionReady).toBe(good.state.mascot.evolutionReady);
  });

  it('exposes no weekly percentage or denominator', () => {
    const progress = progressFor(plans, completeFirst(plans, 3));
    expect(Object.keys(progress).sort()).toEqual(['awards', 'currentRun', 'longestRun']);
  });
});
