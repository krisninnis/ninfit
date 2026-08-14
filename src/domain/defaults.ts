import { nowTimestamp } from './dates';
import { newId, type IdFactory } from './ids';
import { SCHEMA_VERSION } from './schema';
import type {
  AppData,
  AppMeta,
  BaselineMeasurement,
  HealthContext,
  HealthNote,
  ISODate,
  ISODateTime,
  UserProfile,
  WeeklyPlan,
} from './types';
import { createWeeklyPlan, type CreateSessionInput } from './weeklyPlan';

/**
 * The seeded starting state.
 *
 * Everything here is the user's own entered information. The health notes in
 * particular are self-reported context: the app stores them, shows them back, and
 * does nothing else with them. There is no diagnosis, scoring or interpretation.
 */

/** Day 1 of the programme: Thursday 13 August 2026. */
export const PROGRAMME_START_DATE: ISODate = '2026-08-13';

/** Age 42 at the programme start. Only the year is stored, so age is approximate. */
export const SEED_BIRTH_YEAR = 1984;

export const SEED_HEIGHT_CM = 180.3; // 5 ft 11 in
export const SEED_WEIGHT_KG = 69.9; // about 11 stone
export const SEED_WAIST_CM = 76.2; // 30 in
export const SEED_RESTING_HEART_RATE_BPM = 72;
export const SEED_HRV_MS = 37;
export const SEED_AVERAGE_DAILY_STEPS = 3000;
export const SEED_BACK_PAIN = 4;
export const SEED_EXERCISE_CAPACITY_MINUTES = 15;
export const SEED_PLANNED_DAYS_PER_WEEK = 6;

export const WEEK_1_PROGRAMME_VERSION = 'week-1-v1';
export const WEEK_1_TARGET_EFFORT_MIN = 2;
export const WEEK_1_TARGET_EFFORT_MAX = 4;

export interface SeedOptions {
  now?: ISODateTime;
  makeId?: IdFactory;
  programmeStartDate?: ISODate;
}

// --- Profile ---------------------------------------------------------------

export function createSeedProfile(options: SeedOptions = {}): UserProfile {
  const timestamp = options.now ?? nowTimestamp();
  const makeId = options.makeId ?? newId;
  return {
    id: makeId(),
    birthYear: SEED_BIRTH_YEAR,
    sex: 'male',
    heightCm: SEED_HEIGHT_CM,
    programmeStartDate: options.programmeStartDate ?? PROGRAMME_START_DATE,
    preferredUnits: { weight: 'stone_lb', length: 'in' },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

// --- Health context --------------------------------------------------------

/**
 * Self-reported health context, exactly as described by the user.
 *
 * `noticedNote` carries vague timing as free text rather than inventing a precise
 * `noticedOn` date the user never gave.
 */
export function createSeedHealthContext(options: SeedOptions = {}): HealthContext {
  const makeId = options.makeId ?? newId;
  const notes: HealthNote[] = [
    {
      id: makeId(),
      label: 'Lower-back prolapsed disc',
      source: 'self_reported',
    },
    {
      id: makeId(),
      label: 'Previous sciatica',
      source: 'self_reported',
    },
    {
      id: makeId(),
      label: 'Mild residual big-toe sensory symptoms',
      detail: 'Altered sensation around the big toe.',
      source: 'self_reported',
    },
    {
      id: makeId(),
      label: 'Previous prediabetes result',
      noticedNote: 'Approximately two years ago.',
      source: 'self_reported',
    },
  ];

  return {
    id: makeId(),
    notes,
    updatedAt: options.now ?? nowTimestamp(),
  };
}

// --- Baseline --------------------------------------------------------------

export function createSeedBaseline(options: SeedOptions = {}): BaselineMeasurement {
  const makeId = options.makeId ?? newId;
  return {
    id: makeId(),
    recordedOn: options.programmeStartDate ?? PROGRAMME_START_DATE,
    weightKg: SEED_WEIGHT_KG,
    waistCm: SEED_WAIST_CM,
    restingHeartRateBpm: SEED_RESTING_HEART_RATE_BPM,
    hrvMs: SEED_HRV_MS,
    averageDailySteps: SEED_AVERAGE_DAILY_STEPS,
    backPain: SEED_BACK_PAIN,
    exerciseCapacityMinutes: SEED_EXERCISE_CAPACITY_MINUTES,
    structuredExerciseBefore: 'none',
    plannedDaysPerWeek: SEED_PLANNED_DAYS_PER_WEEK,
  };
}

// --- Week 1 ----------------------------------------------------------------

/**
 * The beginner yoga session links out to a freely available video on YouTube.
 *
 * We link only. The video is not downloaded, proxied, copied, hosted or embedded, and
 * the creator is credited wherever the link appears. If the link ever breaks, the
 * activity simply loses its button and remains a perfectly valid planned activity.
 */
export const WEEK_1_YOGA_VIDEO_URL = 'https://www.youtube.com/watch?v=j7rKKpwdXNE';
export const WEEK_1_YOGA_VIDEO_LABEL = 'Yoga With Adriene';

const YOGA_AND_WALK: CreateSessionInput['activities'] = [
  {
    type: 'yoga',
    label: 'beginner yoga',
    durationMinutes: 10,
    intensity: 'very_light',
    externalUrl: WEEK_1_YOGA_VIDEO_URL,
    externalLabel: WEEK_1_YOGA_VIDEO_LABEL,
    provider: 'youtube',
  },
  { type: 'walk', label: 'easy walk', durationMinutes: 5, intensity: 'very_light' },
];

const EASY_WALK: CreateSessionInput['activities'] = [
  { type: 'walk', label: 'easy walk', durationMinutes: 15, intensity: 'very_light' },
];

/** Days 1-6 alternate yoga-plus-walk with a longer walk. Day 7 is rest. */
export const WEEK_1_SESSIONS: CreateSessionInput[] = [
  { dayIndex: 1, activities: YOGA_AND_WALK },
  { dayIndex: 2, activities: EASY_WALK },
  { dayIndex: 3, activities: YOGA_AND_WALK },
  { dayIndex: 4, activities: EASY_WALK },
  { dayIndex: 5, activities: YOGA_AND_WALK },
  { dayIndex: 6, activities: EASY_WALK },
  { dayIndex: 7, activities: [], note: 'Rest day.' },
];

export function createWeek1Plan(options: SeedOptions = {}): WeeklyPlan {
  return createWeeklyPlan(
    {
      programmeVersion: WEEK_1_PROGRAMME_VERSION,
      weekNumber: 1,
      startDate: options.programmeStartDate ?? PROGRAMME_START_DATE,
      label: 'Week 1 - starting gently',
      targetEffortMin: WEEK_1_TARGET_EFFORT_MIN,
      targetEffortMax: WEEK_1_TARGET_EFFORT_MAX,
      sessions: WEEK_1_SESSIONS,
    },
    options,
  );
}

// --- Whole starting state --------------------------------------------------

export function createInitialMeta(options: SeedOptions = {}): AppMeta {
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: options.now ?? nowTimestamp(),
  };
}

/** The complete state a first-run install begins with. */
export function createSeedAppData(options: SeedOptions = {}): AppData {
  return {
    meta: createInitialMeta(options),
    profile: createSeedProfile(options),
    healthContext: createSeedHealthContext(options),
    baseline: createSeedBaseline(options),
    measurements: [],
    weeklyPlans: [createWeek1Plan(options)],
    dailyLogs: [],
    // Reserved for future device-observed data. Nothing writes here in v0.1.
    metricSamples: [],
  };
}
