/**
 * The complete v0.1 domain model.
 *
 * Rules that hold everywhere in this file:
 *   - Measurements are stored in METRIC. Imperial exists only as a display conversion.
 *   - `ISODate` is a LOCAL calendar day ("2026-08-13"), never a UTC instant.
 *   - `ISODateTime` is a full timestamp with offset ("2026-08-13T20:04:00.000+01:00").
 *   - Optional means genuinely absent. A missing metric is never a zero.
 *   - Health information is user-entered context, never a diagnosis.
 *
 * This file has no imports. Everything else in the domain builds on it, which keeps
 * the entities directly translatable to Postgres tables later on.
 */

/** Local calendar day, `YYYY-MM-DD`. */
export type ISODate = string;

/** Full timestamp with explicit offset, `YYYY-MM-DDTHH:mm:ss.sss+/-HH:MM`. */
export type ISODateTime = string;

export type UUID = string;

/** Integer 0-10. Not validated at the type level; use the domain guards. */
export type Scale10 = number;

export type SymptomTrend = 'better' | 'same' | 'worse';

export type Sex = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export type ActivityType = 'yoga' | 'walk' | 'rest' | 'other';

/** v0.1 deliberately offers nothing above "light". */
export type ActivityIntensity = 'very_light' | 'light';

export type PriorStructuredExercise = 'none' | 'some' | 'regular';

export type WeightDisplayUnit = 'kg' | 'stone_lb';
export type LengthDisplayUnit = 'cm' | 'in';

export interface DisplayUnitPreferences {
  weight: WeightDisplayUnit;
  length: LengthDisplayUnit;
}

// ---------------------------------------------------------------------------
// Profile and health context
// ---------------------------------------------------------------------------

export interface UserProfile {
  id: UUID;
  displayName?: string;
  /**
   * Birth year only. Age is therefore approximate to within a year, which is
   * all this app needs and avoids storing a precise date of birth.
   */
  birthYear: number;
  sex: Sex;
  heightCm: number;
  /** Day 1 of the programme. All rolling weeks are anchored to this date. */
  programmeStartDate: ISODate;
  preferredUnits: DisplayUnitPreferences;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/**
 * A note the user has written about their own health.
 *
 * `source` is fixed to 'self_reported' in v0.1 and exists so that a future
 * clinician-entered or imported note is distinguishable rather than conflated.
 * Nothing in the app interprets, scores or acts on these notes.
 */
export interface HealthNote {
  id: UUID;
  label: string;
  detail?: string;
  /** Use only when the date is actually known. */
  noticedOn?: ISODate;
  /** Free text for vague timing, e.g. "approximately two years ago". */
  noticedNote?: string;
  source: 'self_reported';
}

export interface HealthContext {
  id: UUID;
  notes: HealthNote[];
  updatedAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Measurements
// ---------------------------------------------------------------------------

/** The starting point. Exactly one of these exists, and it is editable. */
export interface BaselineMeasurement {
  id: UUID;
  recordedOn: ISODate;
  weightKg?: number;
  waistCm?: number;
  restingHeartRateBpm?: number;
  hrvMs?: number;
  averageDailySteps?: number;
  backPain?: Scale10;
  exerciseCapacityMinutes?: number;
  structuredExerciseBefore?: PriorStructuredExercise;
  plannedDaysPerWeek?: number;
  notes?: string;
}

/**
 * An ad-hoc re-measurement taken after the baseline.
 *
 * MANUAL ONLY. This is "I got the tape measure out on Sunday": one entry per local
 * day, no time of day, no source. Passive device streams must NOT be written here -
 * they belong in `MetricSample`, which is timestamped, attributed and multi-per-day.
 * Conflating the two would be expensive to undo.
 */
export interface Measurement {
  id: UUID;
  recordedOn: ISODate;
  weightKg?: number;
  waistCm?: number;
  restingHeartRateBpm?: number;
  hrvMs?: number;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Programme
// ---------------------------------------------------------------------------

/** Where a linked instructional video lives. We link out; we never host or embed. */
export type ExternalContentProvider = 'youtube' | 'other';

export interface PlannedActivity {
  id: UUID;
  type: ActivityType;
  label: string;
  durationMinutes: number;
  intensity: ActivityIntensity;
  /**
   * Optional link to third-party instructional content, opened in the browser or the
   * provider's own app. The content is never downloaded, proxied, copied, embedded or
   * presented as ours, and `externalLabel` must always be shown as attribution
   * wherever the link is offered.
   */
  externalUrl?: string;
  /** Creator attribution, e.g. "Yoga With Adriene". Displayed with the link. */
  externalLabel?: string;
  provider?: ExternalContentProvider;
}

export interface PlannedSession {
  id: UUID;
  /** 1-7 within the rolling week. */
  dayIndex: number;
  /** An empty array means a rest day. */
  activities: PlannedActivity[];
  note?: string;
}

/**
 * A rolling seven-day block of the programme, anchored to
 * `UserProfile.programmeStartDate`  -  not to Monday.
 *
 * `programmeVersion` is a stable, human-readable identifier such as "week-1-v1".
 * Revising a week mints a new version (...-v2) rather than editing the old one, so
 * historical daily logs keep pointing at the plan they were actually logged against.
 */
export interface WeeklyPlan {
  id: UUID;
  programmeVersion: string;
  weekNumber: number;
  startDate: ISODate;
  label?: string;
  targetEffortMin: number;
  targetEffortMax: number;
  sessions: PlannedSession[];
  createdAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Daily log
// ---------------------------------------------------------------------------

export interface ExerciseLog {
  id: UUID;
  /**
   * Day-level completion. NARROW PURPOSE, read it carefully.
   *
   * This answers "did I do something active today" for days that have NO planned
   * activities: a rest day, or a date the programme does not cover. On a day that
   * does have planned activities it is not the answer - `completedActivityIds` is -
   * and it is consulted only as a legacy fallback for records written before
   * per-activity completion existed.
   *
   * There is exactly one source of truth for "was the session completed", and it is
   * `summariseSessionCompletion`. Never read either field directly to answer that.
   */
  completed?: boolean;
  /**
   * Which of the day's `PlannedActivity` ids were completed, by stable id.
   *
   * Present and empty means "nothing done yet", which is different from absent,
   * meaning "this record predates per-activity completion". Presence therefore takes
   * precedence over `completed` on planned days.
   */
  completedActivityIds?: UUID[];
  /**
   * "I followed today's planned rest day."
   *
   * Only meaningful on a planned rest day, and deliberately distinct from
   * `completed`, which on a rest day means "I did something active anyway". Rest is
   * the planned activity, so acknowledging it is participation, not inactivity.
   *
   * It exists because no ordinary tracking field should imply it: recording water,
   * food, sleep or symptoms says nothing about whether the rest was intentional.
   * Absent simply means unacknowledged, which is a perfectly valid rest day.
   */
  restDayAcknowledged?: boolean;
  actualActivity?: string;
  durationMinutes?: number;
  effort?: Scale10;
  /**
   * The MANUALLY ENTERED step count.
   *
   * A future passive value (Health Connect, HealthKit, phone sensor) arrives as a
   * `MetricSample` and may take display precedence over this number. It must never
   * overwrite it: what the user typed is a fact about what they said, and it stays.
   */
  steps?: number;
  notes?: string;
}

export interface SymptomLog {
  id: UUID;
  backPainBefore?: Scale10;
  backPainAfter?: Scale10;
  legPain?: boolean;
  toeSensation?: SymptomTrend;
  notes?: string;
}

/** No calorie counting in v0.1, by design. */
export interface NutritionLog {
  id: UUID;
  morningFruit?: boolean;
  proteinMainMeal?: boolean;
  goustoMeal?: boolean;
  fruitVegServings?: number;
  snackNote?: string;
}

export interface HydrationLog {
  id: UUID;
  /** Uncapped. The 6-8 band is a rough guide shown in the UI, not a limit. */
  glasses?: number;
  extraFluidNote?: string;
}

export interface RecoveryLog {
  id: UUID;
  sleepHours?: number;
  energy?: Scale10;
  restingHeartRateBpm?: number;
  hrvMs?: number;
  notes?: string;
}

/** One document per calendar day. Every field, and every section, is optional. */
export interface DailyLog {
  id: UUID;
  /** Unique business key. One log per local calendar day. */
  date: ISODate;
  weeklyPlanId?: UUID;
  plannedSessionId?: UUID;
  exercise?: ExerciseLog;
  symptoms?: SymptomLog;
  nutrition?: NutritionLog;
  hydration?: HydrationLog;
  recovery?: RecoveryLog;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** The five tracking sections of a day, in the order they appear on Today. */
export const DAILY_LOG_SECTIONS = [
  'exercise',
  'symptoms',
  'nutrition',
  'hydration',
  'recovery',
] as const;

export type DailyLogSection = (typeof DAILY_LOG_SECTIONS)[number];

// ---------------------------------------------------------------------------
// Provenance and observed data
// ---------------------------------------------------------------------------

/**
 * FUTURE-FACING. Reserved in v0.1 so the export envelope shape is final from the
 * first export. Nothing collects, reads or displays these yet.
 *
 * The active/passive split this exists to protect:
 *
 *   DailyLog      what the person SAID.     One per local day. Implicitly manual.
 *   MetricSample  what was OBSERVED.        Timestamped, attributed, many per day.
 *
 * These are not to be merged. Intended platform order is: the current PWA/manual
 * tracker, then a Capacitor wrapper, then an Android Health Connect provider, then an
 * iOS HealthKit provider. The same types must serve both platforms, so nothing here
 * may assume Android, and nothing here may assume iOS.
 */

export type SourceType =
  /** Typed in by the user. */
  | 'manual'
  /** Phone pedometer or motion sensor. */
  | 'phone_sensor'
  /** Android platform health store. */
  | 'health_connect'
  /** Apple platform health store. */
  | 'healthkit'
  /** A direct vendor API, if one is ever unavoidable. */
  | 'wearable'
  /** Experimental camera photoplethysmography. */
  | 'camera_ppg'
  /** Read from a file. */
  | 'imported'
  /** Computed by this app from other values. */
  | 'derived';

/**
 * Where a value came from.
 *
 * `sourceApp`, `sourceDevice` and `externalId` are OPAQUE strings. Never parse them,
 * never match on them, never hardcode one. Health Connect in particular attributes
 * on-device steps to a per-device, per-reading-app synthetic package name that must be
 * fetched at runtime, so any code that assumed a fixed identifier would be wrong.
 */
export interface DataSource {
  sourceType: SourceType;
  /** Package name, bundle id or synthetic package name. Opaque. */
  sourceApp?: string;
  /** Human-readable device, e.g. "Pixel 8" or "Apple Watch Series 9". Opaque. */
  sourceDevice?: string;
  /** The provider's own record id, so a re-sync updates instead of duplicating. */
  externalId?: string;
  /** When the world was observed. */
  measuredAt?: ISODateTime;
  /** When the value entered this app's store. */
  importedAt?: ISODateTime;
}

/** Reserved metric vocabulary. Extended only when something actually reads it. */
export type MetricKind =
  | 'steps'
  | 'heart_rate'
  | 'resting_heart_rate'
  | 'hrv'
  | 'sleep_duration'
  | 'active_minutes'
  | 'distance_metres'
  | 'weight_kg'
  | 'waist_cm';

/**
 * A single observed value, always attributed.
 *
 * TIMEZONE RULE for whoever writes the first provider: `date` is the LOCAL calendar
 * day this sample belongs to. Health Connect and HealthKit both aggregate over
 * instants, so a "daily total" must be requested as the instant range spanned by that
 * local day using that day's local offset - never UTC midnight to UTC midnight. In
 * British Summer Time those differ by an hour, which silently moves steps between days.
 */
export interface MetricSample {
  id: UUID;
  kind: MetricKind;
  value: number;
  /** Explicit, never inferred from `kind`. e.g. "count", "bpm", "ms", "minutes". */
  unit: string;
  /** Local calendar day, for joining against `DailyLog`. */
  date: ISODate;
  /** Present for sub-daily samples; absent for whole-day totals. */
  startAt?: ISODateTime;
  endAt?: ISODateTime;
  source: DataSource;
  /** 0-1. Only meaningful for experimental sources such as camera PPG. */
  confidence?: number;
}

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

export interface AppMeta {
  schemaVersion: number;
  createdAt: ISODateTime;
  /** Set on every successful export. Surfaced on the Data screen. */
  lastExportedAt?: ISODateTime;
}

/** Everything the app holds. This is the unit of export and import. */
export interface AppData {
  meta: AppMeta;
  profile: UserProfile;
  healthContext: HealthContext;
  baseline: BaselineMeasurement;
  /** User-taken measurements only. See the note on `Measurement`. */
  measurements: Measurement[];
  weeklyPlans: WeeklyPlan[];
  dailyLogs: DailyLog[];
  /**
   * Device-observed samples. Always `[]` in v0.1 - reserved so that the export
   * envelope shape is final from the very first export and no future import has to
   * special-case a missing array.
   */
  metricSamples: MetricSample[];
}
