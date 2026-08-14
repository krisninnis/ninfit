import { beforeEach, describe, expect, it } from 'vitest';
import { approximateAgeYears, isValidISODate, isValidISODateTime, parseISODate } from '../domain/dates';
import {
  PROGRAMME_START_DATE,
  SEED_AVERAGE_DAILY_STEPS,
  SEED_BACK_PAIN,
  SEED_EXERCISE_CAPACITY_MINUTES,
  SEED_HEIGHT_CM,
  SEED_HRV_MS,
  SEED_PLANNED_DAYS_PER_WEEK,
  SEED_RESTING_HEART_RATE_BPM,
  SEED_WAIST_CM,
  SEED_WEIGHT_KG,
  WEEK_1_PROGRAMME_VERSION,
  WEEK_1_TARGET_EFFORT_MAX,
  WEEK_1_TARGET_EFFORT_MIN,
  createSeedAppData,
  createSeedBaseline,
  createSeedHealthContext,
  createSeedProfile,
  createWeek1Plan,
} from '../domain/defaults';
import { sequentialIdFactory } from '../domain/ids';
import { SCHEMA_VERSION } from '../domain/schema';
import type { AppData } from '../domain/types';
import { isRestDay, plannedActivityLabels, plannedMinutes } from '../domain/weeklyPlan';

const NOW = '2026-08-13T20:04:00.000+01:00';

let data: AppData;

beforeEach(() => {
  data = createSeedAppData({ now: NOW, makeId: sequentialIdFactory('seed') });
});

describe('seeded profile', () => {
  it('starts the programme on Thursday 13 August 2026', () => {
    expect(PROGRAMME_START_DATE).toBe('2026-08-13');
    expect(isValidISODate(PROGRAMME_START_DATE)).toBe(true);
    expect(parseISODate(PROGRAMME_START_DATE).getDay()).toBe(4); // Thursday
    expect(data.profile.programmeStartDate).toBe(PROGRAMME_START_DATE);
  });

  it('represents age 42 at the start of the programme', () => {
    expect(approximateAgeYears(data.profile.birthYear, PROGRAMME_START_DATE)).toBe(42);
  });

  it('records sex and height as given', () => {
    expect(data.profile.sex).toBe('male');
    expect(data.profile.heightCm).toBe(SEED_HEIGHT_CM);
    expect(SEED_HEIGHT_CM).toBeCloseTo(180.3, 1);
  });

  it('defaults to the imperial display units the user thinks in', () => {
    expect(data.profile.preferredUnits).toEqual({ weight: 'stone_lb', length: 'in' });
  });

  it('stamps valid timestamps', () => {
    expect(isValidISODateTime(data.profile.createdAt)).toBe(true);
    expect(data.profile.createdAt).toBe(data.profile.updatedAt);
  });
});

describe('seeded baseline', () => {
  it('records every starting measurement in metric', () => {
    expect(data.baseline).toMatchObject({
      recordedOn: PROGRAMME_START_DATE,
      weightKg: SEED_WEIGHT_KG,
      waistCm: SEED_WAIST_CM,
      restingHeartRateBpm: SEED_RESTING_HEART_RATE_BPM,
      hrvMs: SEED_HRV_MS,
      averageDailySteps: SEED_AVERAGE_DAILY_STEPS,
      backPain: SEED_BACK_PAIN,
      exerciseCapacityMinutes: SEED_EXERCISE_CAPACITY_MINUTES,
      structuredExerciseBefore: 'none',
      plannedDaysPerWeek: SEED_PLANNED_DAYS_PER_WEEK,
    });
  });

  it('uses the agreed starting values', () => {
    expect(SEED_WEIGHT_KG).toBe(69.9);
    expect(SEED_WAIST_CM).toBe(76.2);
    expect(SEED_RESTING_HEART_RATE_BPM).toBe(72);
    expect(SEED_HRV_MS).toBe(37);
    expect(SEED_AVERAGE_DAILY_STEPS).toBe(3000);
    expect(SEED_BACK_PAIN).toBe(4);
    expect(SEED_EXERCISE_CAPACITY_MINUTES).toBe(15);
    expect(SEED_PLANNED_DAYS_PER_WEEK).toBe(6);
  });
});

describe('seeded health context', () => {
  it('records the four self-reported items', () => {
    expect(data.healthContext.notes.map((note) => note.label)).toEqual([
      'Lower-back prolapsed disc',
      'Previous sciatica',
      'Mild residual big-toe sensory symptoms',
      'Previous prediabetes result',
    ]);
  });

  it('marks every note as self-reported, never as a diagnosis', () => {
    for (const note of data.healthContext.notes) {
      expect(note.source).toBe('self_reported');
    }
  });

  it('keeps vague timing as a note rather than inventing a precise date', () => {
    const prediabetes = data.healthContext.notes.find((note) =>
      note.label.includes('prediabetes'),
    );
    expect(prediabetes?.noticedNote).toMatch(/two years ago/i);
    expect(prediabetes?.noticedOn).toBeUndefined();
  });

  it('gives every note its own id', () => {
    const ids = new Set(data.healthContext.notes.map((note) => note.id));
    expect(ids.size).toBe(data.healthContext.notes.length);
  });
});

describe('Week 1 programme', () => {
  it('carries a stable programme version', () => {
    const plan = data.weeklyPlans[0];
    expect(WEEK_1_PROGRAMME_VERSION).toBe('week-1-v1');
    expect(plan?.programmeVersion).toBe('week-1-v1');
    expect(plan?.weekNumber).toBe(1);
    expect(plan?.startDate).toBe(PROGRAMME_START_DATE);
  });

  it('sets the target effort band at 2 to 4', () => {
    const plan = data.weeklyPlans[0];
    expect([WEEK_1_TARGET_EFFORT_MIN, WEEK_1_TARGET_EFFORT_MAX]).toEqual([2, 4]);
    expect(plan?.targetEffortMin).toBe(2);
    expect(plan?.targetEffortMax).toBe(4);
  });

  it('has exactly seven sessions, one per day index', () => {
    const plan = createWeek1Plan({ now: NOW, makeId: sequentialIdFactory('p') });
    expect(plan.sessions.map((session) => session.dayIndex)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('alternates yoga-plus-walk with a longer walk on days 1 to 6', () => {
    const plan = createWeek1Plan({ now: NOW, makeId: sequentialIdFactory('p') });
    const labelsFor = (dayIndex: number) =>
      plannedActivityLabels(plan.sessions.find((session) => session.dayIndex === dayIndex));

    for (const dayIndex of [1, 3, 5]) {
      expect(labelsFor(dayIndex)).toEqual(['10-minute beginner yoga', '5-minute easy walk']);
    }
    for (const dayIndex of [2, 4, 6]) {
      expect(labelsFor(dayIndex)).toEqual(['15-minute easy walk']);
    }
  });

  it('makes day 7 a rest day', () => {
    const plan = createWeek1Plan({ now: NOW, makeId: sequentialIdFactory('p') });
    const day7 = plan.sessions.find((session) => session.dayIndex === 7);
    expect(isRestDay(day7)).toBe(true);
    expect(day7?.activities).toEqual([]);
    expect(day7?.note).toMatch(/rest/i);
  });

  it('plans exactly 15 minutes on every active day', () => {
    const plan = createWeek1Plan({ now: NOW, makeId: sequentialIdFactory('p') });
    for (const session of plan.sessions) {
      expect(plannedMinutes(session)).toBe(isRestDay(session) ? 0 : 15);
    }
  });

  it('keeps every activity at very light intensity', () => {
    const plan = createWeek1Plan({ now: NOW, makeId: sequentialIdFactory('p') });
    for (const session of plan.sessions) {
      for (const activity of session.activities) {
        expect(activity.intensity).toBe('very_light');
      }
    }
  });
});

describe('internal consistency of the seed', () => {
  it('plans six active days, matching the stated days per week', () => {
    const plan = data.weeklyPlans[0];
    const activeDays = plan?.sessions.filter((session) => !isRestDay(session)) ?? [];
    expect(activeDays).toHaveLength(SEED_PLANNED_DAYS_PER_WEEK);
    expect(data.baseline.plannedDaysPerWeek).toBe(activeDays.length);
  });

  it('never plans more minutes than the stated starting capacity', () => {
    const plan = data.weeklyPlans[0];
    for (const session of plan?.sessions ?? []) {
      expect(plannedMinutes(session)).toBeLessThanOrEqual(SEED_EXERCISE_CAPACITY_MINUTES);
    }
  });

  it('anchors the baseline, the profile and week 1 to the same start date', () => {
    expect(data.baseline.recordedOn).toBe(data.profile.programmeStartDate);
    expect(data.weeklyPlans[0]?.startDate).toBe(data.profile.programmeStartDate);
  });

  it('starts with the current schema version and no data yet', () => {
    expect(data.meta.schemaVersion).toBe(SCHEMA_VERSION);
    expect(data.meta.lastExportedAt).toBeUndefined();
    expect(data.dailyLogs).toEqual([]);
    expect(data.measurements).toEqual([]);
    expect(data.weeklyPlans).toHaveLength(1);
  });

  it('gives every seeded entity a distinct id', () => {
    const plan = data.weeklyPlans[0];
    const ids = [
      data.profile.id,
      data.healthContext.id,
      data.baseline.id,
      plan?.id,
      ...data.healthContext.notes.map((note) => note.id),
      ...(plan?.sessions.map((session) => session.id) ?? []),
      ...(plan?.sessions.flatMap((session) => session.activities.map((a) => a.id)) ?? []),
    ].filter((id): id is string => id !== undefined);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('honours an overridden programme start date throughout', () => {
    const shifted = createSeedAppData({
      now: NOW,
      makeId: sequentialIdFactory('alt'),
      programmeStartDate: '2026-09-01',
    });
    expect(shifted.profile.programmeStartDate).toBe('2026-09-01');
    expect(shifted.baseline.recordedOn).toBe('2026-09-01');
    expect(shifted.weeklyPlans[0]?.startDate).toBe('2026-09-01');
  });
});

describe('seed factories are independent', () => {
  it('produces fresh objects on each call', () => {
    const a = createSeedProfile({ now: NOW, makeId: sequentialIdFactory('a') });
    const b = createSeedProfile({ now: NOW, makeId: sequentialIdFactory('b') });
    expect(a).not.toBe(b);
    expect(a.id).not.toBe(b.id);

    const health = createSeedHealthContext({ now: NOW, makeId: sequentialIdFactory('h') });
    health.notes.pop();
    expect(createSeedHealthContext({ now: NOW, makeId: sequentialIdFactory('h2') }).notes)
      .toHaveLength(4);

    expect(createSeedBaseline({ now: NOW, makeId: sequentialIdFactory('b2') }).weightKg).toBe(
      SEED_WEIGHT_KG,
    );
  });
});
