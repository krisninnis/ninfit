import { isValidISODate, nowTimestamp } from '../domain/dates';
import { createSeedAppData } from '../domain/defaults';
import {
  createDefaultGameSettings,
  createInitialGameState,
  normaliseGameSettings,
} from '../domain/game/defaults';
import {
  isPendingRewardDeliveries,
  withoutPendingRewardDeliveries,
} from '../domain/game/rewardDelivery';
import type { GameSettings, GameState } from '../domain/game/types';
import { newId, type IdFactory } from '../domain/ids';
import { SCHEMA_VERSION } from '../domain/schema';
import type {
  AppMeta,
  BaselineMeasurement,
  DailyLog,
  HealthContext,
  ISODate,
  ISODateTime,
  Measurement,
  MetricSample,
  UserProfile,
  WeeklyPlan,
} from '../domain/types';
import type { StorageAdapter } from './StorageAdapter';

/**
 * The only application-facing persistence API.
 *
 * Nothing above this layer may touch the adapter, and nothing below it knows the
 * adapter exists. The domain stays pure; this file owns serialisation, key layout,
 * seeding and the handling of anything unreadable.
 *
 * TODO (Step 7 - export/import): import must NOT be exposed here. It belongs in the
 * io layer, and it should offer ONE combined operation that validates, migrates and
 * normalises in a single call. Exposing `validateExportEnvelope` and
 * `migrateExportEnvelope` separately invites a caller to use a legacy envelope
 * between the two, at which point `data.metricSamples` is still absent despite the
 * type claiming otherwise. One door, not two.
 */

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

export const KEY_PREFIX = 'ft:v1';

export const STORAGE_KEYS = {
  profile: `${KEY_PREFIX}:profile`,
  health: `${KEY_PREFIX}:health`,
  baseline: `${KEY_PREFIX}:baseline`,
  measurements: `${KEY_PREFIX}:measurements`,
  plans: `${KEY_PREFIX}:plans`,
  metricSamples: `${KEY_PREFIX}:metricSamples`,
  meta: `${KEY_PREFIX}:meta`,
  /** The game layer. Kept entirely separate from fitness records. */
  game: `${KEY_PREFIX}:game`,
  gameSettings: `${KEY_PREFIX}:gameSettings`,
} as const;

/** One key per calendar day, so writing today never rewrites any other day. */
export const DAILY_LOG_KEY_PREFIX = `${KEY_PREFIX}:log:`;

/** Corrupt values are copied here rather than deleted. */
export const QUARANTINE_KEY_PREFIX = `${KEY_PREFIX}:quarantine:`;

export function dailyLogKey(date: ISODate): string {
  if (!isValidISODate(date)) {
    throw new Error(`Invalid daily log date: ${JSON.stringify(date)}`);
  }
  return `${DAILY_LOG_KEY_PREFIX}${date}`;
}

export function dateFromDailyLogKey(key: string): ISODate | undefined {
  if (!key.startsWith(DAILY_LOG_KEY_PREFIX)) return undefined;
  const date = key.slice(DAILY_LOG_KEY_PREFIX.length);
  return isValidISODate(date) ? date : undefined;
}

// ---------------------------------------------------------------------------
// Failure reporting
// ---------------------------------------------------------------------------

export type StorageIssueKind =
  | 'invalid_json'
  | 'invalid_shape'
  | 'date_mismatch'
  | 'unsupported_schema_version';

export interface StorageIssue {
  kind: StorageIssueKind;
  key: string;
  detail: string;
  /** Where the unreadable value was copied to. Nothing is ever destroyed. */
  quarantinedAs?: string;
}

/** Thrown when the backing store refuses a write, e.g. quota exceeded. */
export class StorageWriteError extends Error {
  constructor(
    readonly key: string,
    readonly cause: unknown,
  ) {
    super(`Failed to write ${key}: ${String(cause)}`);
    this.name = 'StorageWriteError';
  }
}

type ReadResult<T> =
  | { status: 'absent' }
  | { status: 'ok'; value: T }
  | { status: 'invalid'; issue: StorageIssue };

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export interface RepositoryOptions {
  /** Injectable clock, so seeding and quarantine naming are deterministic in tests. */
  now?: () => ISODateTime;
  makeId?: IdFactory;
}

export interface InitialiseResult {
  /** True when no `meta` existed, i.e. this is a genuine first run. */
  firstRun: boolean;
  /** Which keys were written by seeding. Empty on an already-initialised store. */
  seeded: string[];
  issues: StorageIssue[];
  /**
   * True when the store cannot be safely used - currently only when it was written
   * by a newer schema version than this build understands. Nothing is seeded and
   * nothing is overwritten in that case.
   */
  blocked: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class Repository {
  private readonly adapter: StorageAdapter;
  private readonly now: () => ISODateTime;
  private readonly makeId: IdFactory;
  private readonly issues: StorageIssue[] = [];

  constructor(adapter: StorageAdapter, options: RepositoryOptions = {}) {
    this.adapter = adapter;
    this.now = options.now ?? (() => nowTimestamp());
    this.makeId = options.makeId ?? newId;
  }

  // --- Low-level read/write ------------------------------------------------

  private write(key: string, value: unknown): void {
    try {
      this.adapter.set(key, JSON.stringify(value));
    } catch (cause) {
      throw new StorageWriteError(key, cause);
    }
  }

  /**
   * Parse a stored value.
   *
   * Three outcomes, kept distinct on purpose. 'absent' means never written and is a
   * normal state. 'invalid' means something is there but unreadable, and is NOT the
   * same as absent: treating it as absent would let seeding quietly replace real data
   * with defaults. Unreadable values are copied to a quarantine key first, so the raw
   * text remains recoverable by hand.
   */
  private read<T>(key: string, guard: (value: unknown) => boolean): ReadResult<T> {
    const raw = this.adapter.get(key);
    if (raw === null) return { status: 'absent' };

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return { status: 'invalid', issue: this.quarantine(key, raw, 'invalid_json', String(error)) };
    }

    if (!guard(parsed)) {
      return {
        status: 'invalid',
        issue: this.quarantine(key, raw, 'invalid_shape', 'Stored value is not the expected shape'),
      };
    }

    return { status: 'ok', value: parsed as T };
  }

  private quarantine(
    key: string,
    raw: string,
    kind: StorageIssueKind,
    detail: string,
  ): StorageIssue {
    const quarantinedAs = `${QUARANTINE_KEY_PREFIX}${key}:${this.now()}`;
    let issue: StorageIssue = { kind, key, detail };
    try {
      // Copy, never move. The original stays put so a later repair can still see it,
      // and so an unrelated valid key is never touched.
      this.adapter.set(quarantinedAs, raw);
      issue = { ...issue, quarantinedAs };
    } catch {
      // If even the quarantine copy fails, the original is still intact. Carry on.
    }
    this.recordIssue(issue);
    return issue;
  }

  /**
   * Quarantine a value once per key and kind, for the whole session.
   *
   * `getGameState` runs on nearly every render, so an unconditional copy would write a
   * fresh timestamped quarantine key every time and fill the store with duplicates of
   * the same bad value. `recordIssue` already de-duplicates the report; this
   * de-duplicates the copy that goes with it.
   */
  private quarantineOnce(key: string, kind: StorageIssueKind, detail: string): void {
    if (this.issues.some((issue) => issue.key === key && issue.kind === kind)) return;

    const raw = this.adapter.get(key);
    if (raw === null) {
      this.recordIssue({ kind, key, detail });
      return;
    }
    this.quarantine(key, raw, kind, detail);
  }

  private recordIssue(issue: StorageIssue): void {
    const alreadyKnown = this.issues.some(
      (existing) => existing.key === issue.key && existing.kind === issue.kind,
    );
    if (!alreadyKnown) this.issues.push(issue);
  }

  /** Everything unreadable encountered so far this session. */
  getIssues(): StorageIssue[] {
    return [...this.issues];
  }

  private readRecord<T>(key: string): T | undefined {
    const result = this.read<T>(key, isRecord);
    return result.status === 'ok' ? result.value : undefined;
  }

  private readArray<T>(key: string): T[] {
    const result = this.read<T[]>(key, Array.isArray);
    return result.status === 'ok' ? result.value : [];
  }

  // --- Initialisation and seeding -----------------------------------------

  /**
   * Seed anything genuinely absent, and nothing else.
   *
   * Idempotence comes from checking each key independently rather than from a single
   * "have I run before" flag. That gives the behaviour required in three separate
   * cases at once:
   *
   *   - An edited profile, baseline or plan is PRESENT, so it is never touched.
   *   - An intentionally emptied array is PRESENT (the key holds `[]`), so it is not
   *     refilled with defaults on the next launch.
   *   - An unreadable key is neither present nor absent. It is skipped and reported,
   *     because overwriting possibly-recoverable data with a default is the one
   *     outcome worse than showing an error.
   */
  initialise(): InitialiseResult {
    const metaResult = this.read<AppMeta>(STORAGE_KEYS.meta, isRecord);
    const firstRun = metaResult.status === 'absent';

    if (metaResult.status === 'ok') {
      const storedVersion = metaResult.value.schemaVersion;
      if (typeof storedVersion === 'number' && storedVersion > SCHEMA_VERSION) {
        const issue: StorageIssue = {
          kind: 'unsupported_schema_version',
          key: STORAGE_KEYS.meta,
          detail:
            `Stored data uses schema version ${storedVersion}, but this build understands ` +
            `version ${SCHEMA_VERSION}. Refusing to seed or modify anything.`,
        };
        this.recordIssue(issue);
        return { firstRun: false, seeded: [], issues: this.getIssues(), blocked: true };
      }
    }

    const seeded: string[] = [];
    // Built once so every seeded entity shares one consistent start date and clock.
    let defaults: ReturnType<typeof createSeedAppData> | undefined;
    const seedData = () =>
      (defaults ??= createSeedAppData({ now: this.now(), makeId: this.makeId }));

    const seedIfAbsent = (key: string, value: () => unknown) => {
      if (this.adapter.get(key) !== null) return; // present, or present-but-invalid
      this.write(key, value());
      seeded.push(key);
    };

    seedIfAbsent(STORAGE_KEYS.profile, () => seedData().profile);
    seedIfAbsent(STORAGE_KEYS.health, () => seedData().healthContext);
    seedIfAbsent(STORAGE_KEYS.baseline, () => seedData().baseline);
    seedIfAbsent(STORAGE_KEYS.measurements, () => seedData().measurements);
    seedIfAbsent(STORAGE_KEYS.plans, () => seedData().weeklyPlans);
    seedIfAbsent(STORAGE_KEYS.metricSamples, () => seedData().metricSamples);
    seedIfAbsent(STORAGE_KEYS.meta, () => seedData().meta);

    // The game layer seeds through exactly the same absent-only rule, so adding it to
    // an install that already holds months of fitness data creates the missing game
    // state and touches nothing else.
    seedIfAbsent(STORAGE_KEYS.game, () => createInitialGameState({ now: this.now() }));
    seedIfAbsent(STORAGE_KEYS.gameSettings, () => createDefaultGameSettings());

    // Deliberately no daily logs. A day's record is created when the user first
    // records something on that day, not in advance for the whole programme.

    return { firstRun, seeded, issues: this.getIssues(), blocked: false };
  }

  // --- Profile -------------------------------------------------------------

  getProfile(): UserProfile | undefined {
    return this.readRecord<UserProfile>(STORAGE_KEYS.profile);
  }

  saveProfile(profile: UserProfile): void {
    this.write(STORAGE_KEYS.profile, profile);
  }

  // --- Health context ------------------------------------------------------

  getHealthContext(): HealthContext | undefined {
    return this.readRecord<HealthContext>(STORAGE_KEYS.health);
  }

  saveHealthContext(context: HealthContext): void {
    this.write(STORAGE_KEYS.health, context);
  }

  // --- Baseline ------------------------------------------------------------

  getBaseline(): BaselineMeasurement | undefined {
    return this.readRecord<BaselineMeasurement>(STORAGE_KEYS.baseline);
  }

  saveBaseline(baseline: BaselineMeasurement): void {
    this.write(STORAGE_KEYS.baseline, baseline);
  }

  // --- Measurements --------------------------------------------------------

  getMeasurements(): Measurement[] {
    return this.readArray<Measurement>(STORAGE_KEYS.measurements);
  }

  saveMeasurements(measurements: Measurement[]): void {
    this.write(STORAGE_KEYS.measurements, measurements);
  }

  /** Replace by id if present, otherwise append. The simplest safe update for v0.1. */
  upsertMeasurement(measurement: Measurement): void {
    const existing = this.getMeasurements();
    const index = existing.findIndex((entry) => entry.id === measurement.id);
    if (index === -1) this.saveMeasurements([...existing, measurement]);
    else this.saveMeasurements(existing.map((entry, at) => (at === index ? measurement : entry)));
  }

  // --- Weekly plans --------------------------------------------------------

  getWeeklyPlans(): WeeklyPlan[] {
    return this.readArray<WeeklyPlan>(STORAGE_KEYS.plans);
  }

  saveWeeklyPlans(plans: WeeklyPlan[]): void {
    this.write(STORAGE_KEYS.plans, plans);
  }

  /** Replace by id if present, otherwise append. Never creates a second week 1. */
  upsertWeeklyPlan(plan: WeeklyPlan): void {
    const existing = this.getWeeklyPlans();
    const index = existing.findIndex((entry) => entry.id === plan.id);
    if (index === -1) this.saveWeeklyPlans([...existing, plan]);
    else this.saveWeeklyPlans(existing.map((entry, at) => (at === index ? plan : entry)));
  }

  // --- Metric samples ------------------------------------------------------

  /**
   * The device-observed stream. Empty throughout v0.1: nothing collects into it yet,
   * and no provider or reconciliation logic exists. Stored separately from daily logs
   * on purpose - see the note on `MetricSample`.
   */
  getMetricSamples(): MetricSample[] {
    return this.readArray<MetricSample>(STORAGE_KEYS.metricSamples);
  }

  saveMetricSamples(samples: MetricSample[]): void {
    this.write(STORAGE_KEYS.metricSamples, samples);
  }

  // --- Daily logs ----------------------------------------------------------

  /**
   * A day's record, or undefined when that day has never been written.
   *
   * A stored log whose `date` disagrees with its key is treated as unreadable rather
   * than trusted, since one of the two is wrong and we cannot tell which.
   */
  getDailyLog(date: ISODate): DailyLog | undefined {
    const key = dailyLogKey(date);
    const result = this.read<DailyLog>(key, isRecord);
    if (result.status !== 'ok') return undefined;

    if (result.value.date !== date) {
      this.recordIssue({
        kind: 'date_mismatch',
        key,
        detail: `Key is for ${date} but the record says ${String(result.value.date)}`,
      });
      return undefined;
    }
    return result.value;
  }

  /** Writes exactly one key: this day's. No other day is read or rewritten. */
  saveDailyLog(log: DailyLog): void {
    this.write(dailyLogKey(log.date), log);
  }

  /**
   * Needed because a future import must be able to remove days that existed before
   * the import but not after. Without it, importing a second dataset would silently
   * merge the two. Also lets a user drop a day recorded by mistake.
   */
  removeDailyLog(date: ISODate): void {
    this.adapter.remove(dailyLogKey(date));
  }

  /** Every day key currently stored, sorted ascending. */
  listDailyLogDates(): ISODate[] {
    const dates: ISODate[] = [];
    for (const key of this.adapter.keys()) {
      const date = dateFromDailyLogKey(key);
      if (date !== undefined) dates.push(date);
    }
    // ISO dates are lexicographically ordered, so a plain string sort is correct.
    return dates.sort();
  }

  /** Every readable day, ascending by date. Unreadable days are skipped and reported. */
  listDailyLogs(): DailyLog[] {
    const logs: DailyLog[] = [];
    for (const date of this.listDailyLogDates()) {
      const log = this.getDailyLog(date);
      if (log !== undefined) logs.push(log);
    }
    return logs;
  }

  // --- Game ----------------------------------------------------------------

  /**
   * The game layer, stored under its own keys.
   *
   * Nothing here belongs in a `DailyLog`: that stays a fitness journal, and game
   * state is derived from it rather than mixed into it.
   */
  /**
   * ONE SEMANTIC CHECK BEYOND "IS IT A RECORD", AND DELIBERATELY ONLY ONE.
   *
   * `pendingRewardDeliveries` is the reward delivery queue, and it is the only field
   * here that presentation puts in front of a person verbatim. An unreadable one is
   * therefore refused rather than rendered, in the same spirit as `getDailyLog`
   * refusing a record whose date disagrees with its key.
   *
   * WHY THE WHOLE RECORD IS NOT REFUSED. Returning `undefined` would hand the caller
   * a fresh game state with empty `awardedKeys`, and the next sync would re-grant
   * months of history as though it had all just happened. Losing somebody's XP and
   * trophies over an unreadable delivery ticket would be far worse than the problem.
   * So the remedy is scoped: the queue is dropped from what callers see, and every
   * field that represents something the user actually earned is returned untouched.
   *
   * NOTHING IS DESTROYED. The stored value is copied to quarantine before it is
   * ignored, and this read never writes over it - the original stays exactly where it
   * was until some later legitimate write of game state replaces it. See
   * `docs/architecture/ninfit-durable-reward-delivery-v1.md` section 15.
   */
  getGameState(): GameState | undefined {
    const state = this.readRecord<GameState>(STORAGE_KEYS.game);
    if (state === undefined) return undefined;
    if (
      state.pendingRewardDeliveries === undefined
      || isPendingRewardDeliveries(state.pendingRewardDeliveries)
    ) {
      return state;
    }

    this.quarantineOnce(
      STORAGE_KEYS.game,
      'invalid_shape',
      'pendingRewardDeliveries is not a list of granted rewards, so no reward will be '
        + 'presented from it. XP, skills, trophies and awarded keys are unaffected.',
    );
    return withoutPendingRewardDeliveries(state);
  }

  saveGameState(state: GameState): void {
    this.write(STORAGE_KEYS.game, state);
  }

  getGameSettings(): GameSettings | undefined {
    const stored = this.readRecord<Partial<GameSettings>>(STORAGE_KEYS.gameSettings);
    return stored === undefined ? undefined : normaliseGameSettings(stored);
  }

  saveGameSettings(settings: GameSettings): void {
    this.write(STORAGE_KEYS.gameSettings, normaliseGameSettings(settings));
  }

  // --- Meta ----------------------------------------------------------------

  getMeta(): AppMeta | undefined {
    return this.readRecord<AppMeta>(STORAGE_KEYS.meta);
  }

  /**
   * Merge a patch into the stored metadata. `createdAt` is never rewritten, and
   * `schemaVersion` always reflects this build.
   */
  updateMeta(patch: Partial<Omit<AppMeta, 'createdAt'>>): AppMeta {
    const existing = this.getMeta();
    const next: AppMeta = {
      schemaVersion: SCHEMA_VERSION,
      createdAt: existing?.createdAt ?? this.now(),
      ...(existing?.lastExportedAt !== undefined
        ? { lastExportedAt: existing.lastExportedAt }
        : {}),
      ...patch,
    };
    this.write(STORAGE_KEYS.meta, next);
    return next;
  }
}

export function createRepository(
  adapter: StorageAdapter,
  options: RepositoryOptions = {},
): Repository {
  return new Repository(adapter, options);
}
