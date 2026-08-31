import { beforeEach, describe, expect, it } from 'vitest';
import dataScreenSource from '../ui/screens/DataScreen.tsx?raw';
import useDataSource from '../ui/hooks/useData.ts?raw';
import { readAppData } from '../app/appData';
import { finishOnboarding, syncGame, updateGameSettings } from '../app/game';
import { createTodaySession, type TodaySession } from '../app/todaySession';
import { acknowledgeRestDay, toggleActivityCompletion } from '../domain/dailyLog';
import { PROGRAMME_START_DATE } from '../domain/defaults';
import { sequentialIdFactory } from '../domain/ids';
import { createMeasurement } from '../domain/measurement';
import { APP_VERSION, SCHEMA_VERSION } from '../domain/schema';
import { resolveToday } from '../domain/today';
import type { MetricSample, PlannedActivity, WeeklyPlan } from '../domain/types';
import {
  CSV_COLUMNS,
  UTF8_BOM,
  buildDailyCsv,
  csvCell,
  dailyCsvFilename,
} from '../io/exportCsv';
import { backupFilename, buildBackup, summariseBackup } from '../io/exportJson';
import { createMemoryStorageAdapter, type StorageAdapter } from '../storage/StorageAdapter';
import { Repository, createRepository } from '../storage/repository';

const NOW = '2026-08-14T12:42:00.000+01:00';
const DAY_1 = '2026-08-13';
const DAY_2 = '2026-08-14';
const REST_DAY = '2026-08-19';

let adapter: StorageAdapter;
let repo: Repository;
let plans: WeeklyPlan[];
let yoga: PlannedActivity;

const SAMPLE: MetricSample = {
  id: 'sample-1',
  kind: 'steps',
  value: 4231,
  unit: 'count',
  date: DAY_2,
  source: {
    sourceType: 'health_connect',
    sourceApp: 'com.android.healthconnect.phone.jd5bdd37e1a8d3667a05d0abebfc4a89e',
    sourceDevice: 'Pixel 8',
    externalId: 'hc-record-9931',
  },
  confidence: 0.94,
};

function newRepo(store: StorageAdapter, prefix = 'seed'): Repository {
  return createRepository(store, { now: () => NOW, makeId: sequentialIdFactory(prefix) });
}

function session(date: string): TodaySession {
  const view = resolveToday(plans, PROGRAMME_START_DATE, date);
  return createTodaySession(repo, date, {
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

beforeEach(() => {
  adapter = createMemoryStorageAdapter();
  repo = newRepo(adapter);
  repo.initialise();
  plans = repo.getWeeklyPlans();

  const [first] = resolveToday(plans, PROGRAMME_START_DATE, DAY_1).activities;
  if (!first) throw new Error('expected a planned activity');
  yoga = first;
});

// ---------------------------------------------------------------------------

describe('the JSON backup', () => {
  it('carries the full envelope metadata', () => {
    const backup = buildBackup(repo, { now: NOW, today: DAY_2 });

    expect(backup.envelope.app).toBe('fitness-tracker');
    expect(backup.envelope.appVersion).toBe(APP_VERSION);
    expect(backup.envelope.schemaVersion).toBe(SCHEMA_VERSION);
    expect(backup.envelope.exportedAt).toBe(NOW);
  });

  it('includes every fitness collection', () => {
    record(DAY_1, { exercise: { steps: 3200 } });
    repo.saveMeasurements([
      createMeasurement({ recordedOn: DAY_2, weightKg: 69.2 }, { makeId: sequentialIdFactory('m') }),
    ]);
    repo.saveMetricSamples([SAMPLE]);

    const { data } = buildBackup(repo, { now: NOW }).envelope;

    expect(data.profile.programmeStartDate).toBe(PROGRAMME_START_DATE);
    expect(data.healthContext.notes).toHaveLength(4);
    expect(data.baseline.weightKg).toBe(69.9);
    expect(data.measurements).toHaveLength(1);
    expect(data.weeklyPlans).toHaveLength(1);
    expect(data.dailyLogs).toHaveLength(1);
    expect(data.metricSamples).toEqual([SAMPLE]);
  });

  it('includes game state and settings as a sibling block', () => {
    finishOnboarding(
      repo,
      {
        answers: { activityLevel: 'sedentary', structuredExercise: 'none', walkComfort: 'not_yet', mainGoal: 'start_moving' },
        recommendedPathId: 'start_moving',
        chosenPathId: 'build_stamina',
      },
      NOW,
    );
    record(DAY_1, toggleActivityCompletion(undefined, yoga.id, true));
    syncGame(repo, { now: NOW, today: DAY_1 });
    updateGameSettings(repo, { mascotPersonality: 'chatty' });

    const envelope = buildBackup(repo, { now: NOW }).envelope;

    expect(envelope.game).toBeDefined();
    expect(envelope.game?.state.xp.total).toBeGreaterThan(0);
    expect(envelope.game?.state.pathId).toBe('build_stamina');
    expect(envelope.game?.state.onboarding.overrodeRecommendation).toBe(true);
    expect(envelope.game?.state.awardedKeys.length).toBeGreaterThan(0);
    expect(envelope.game?.state.trophies[0]?.visibility).toBe('private');
    expect(envelope.game?.settings.mascotPersonality).toBe('chatty');
    // Game data sits beside the fitness data, never inside it.
    expect('game' in envelope.data).toBe(false);
  });

  it('names the file with the local calendar date and nothing personal', () => {
    expect(backupFilename('2026-08-14')).toBe('fitness-tracker-backup-2026-08-14.json');
    expect(backupFilename('2026-08-14')).not.toMatch(/kris|weight|69|profile/i);
  });

  it('preserves explicit zero, explicit false and genuinely missing fields', () => {
    record(DAY_1, {
      exercise: { steps: 0, completed: false },
      nutrition: { morningFruit: false },
      hydration: { glasses: 0 },
    });

    const roundTripped = JSON.parse(JSON.stringify(buildBackup(repo, { now: NOW }).envelope));
    const log = roundTripped.data.dailyLogs[0];

    expect(log.exercise.steps).toBe(0);
    expect(log.exercise.completed).toBe(false);
    expect(log.nutrition.morningFruit).toBe(false);
    expect(log.hydration.glasses).toBe(0);
    expect('effort' in log.exercise).toBe(false);
    expect(log.symptoms).toBeUndefined();
  });

  it('preserves vague health-note timing and provenance strings', () => {
    repo.saveMetricSamples([SAMPLE]);
    const envelope = JSON.parse(JSON.stringify(buildBackup(repo, { now: NOW }).envelope));

    const note = envelope.data.healthContext.notes.find((entry: { label: string }) =>
      entry.label.includes('prediabetes'),
    );
    expect(note.noticedNote).toBe('Approximately two years ago.');
    expect('noticedOn' in note).toBe(false);

    expect(envelope.data.metricSamples[0].source.sourceApp).toBe(SAMPLE.source.sourceApp);
    expect(envelope.data.metricSamples[0].source.externalId).toBe('hc-record-9931');
  });

  it('is readable JSON rather than a single line', () => {
    expect(buildBackup(repo, { now: NOW }).contents).toContain('\n');
  });
});

describe('the backup summary', () => {
  it('counts what is in the file without exposing any of it', () => {
    record(DAY_1, { exercise: { steps: 3200 } });
    const summary = summariseBackup(buildBackup(repo, { now: NOW }).envelope);

    expect(summary).toMatchObject({
      exportedAt: NOW,
      dailyLogs: 1,
      measurements: 0,
      weeklyPlans: 1,
      programmeStartDate: PROGRAMME_START_DATE,
      hasGameData: true,
    });
    // Nothing personal: no notes, no weights, no symptoms.
    expect(JSON.stringify(summary)).not.toMatch(/prolapsed|sciatica|prediabetes|69\.9/);
  });
});

describe('CSV escaping', () => {
  it('leaves ordinary values alone', () => {
    expect(csvCell('walk')).toBe('walk');
    expect(csvCell(15)).toBe('15');
  });

  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('yoga, then a walk')).toBe('"yoga, then a walk"');
    expect(csvCell('said "fine"')).toBe('"said ""fine"""');
    expect(csvCell('line one\nline two')).toBe('"line one\nline two"');
    expect(csvCell('carriage\r\nreturn')).toBe('"carriage\r\nreturn"');
  });

  it('quotes values with surrounding whitespace, which would otherwise be lost', () => {
    expect(csvCell('  padded  ')).toBe('"  padded  "');
  });

  it('writes an empty cell for missing, but keeps zero and false', () => {
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(null)).toBe('');
    expect(csvCell('')).toBe('');
    expect(csvCell(0)).toBe('0');
    expect(csvCell(false)).toBe('false');
    expect(csvCell(true)).toBe('true');
  });

  it('passes Unicode through untouched', () => {
    expect(csvCell('café ☕ 走路')).toBe('café ☕ 走路');
  });
});

describe('the daily CSV', () => {
  function csv(): string {
    return buildDailyCsv(readAppData(repo), { today: DAY_2 }).contents;
  }

  function rows(): string[] {
    return csv().replace(UTF8_BOM, '').trimEnd().split('\r\n');
  }

  it('starts with a byte order mark so spreadsheets read UTF-8 correctly', () => {
    expect(csv().startsWith(UTF8_BOM)).toBe(true);
  });

  it('writes a header and one row per recorded day, oldest first', () => {
    record(DAY_2, { exercise: { steps: 5000 } });
    record(DAY_1, { exercise: { steps: 3000 } });

    const lines = rows();
    expect(lines[0]).toBe(CSV_COLUMNS.join(','));
    expect(lines).toHaveLength(3);
    expect(lines[1]?.startsWith(DAY_1)).toBe(true);
    expect(lines[2]?.startsWith(DAY_2)).toBe(true);
  });

  it('is deterministic', () => {
    record(DAY_1, { exercise: { steps: 3000 } });
    expect(csv()).toBe(csv());
  });

  it('records programme position and planned work', () => {
    record(DAY_1, toggleActivityCompletion(undefined, yoga.id, true));
    const row = rows()[1] ?? '';

    expect(row).toContain('2026-08-13');
    // Activities are joined with a semicolon precisely so the cell needs no quoting.
    expect(row).toContain('beginner yoga (10m); easy walk (5m)');
    expect(row).toContain('partial');

    const cells = row.split(',');
    expect(cells[CSV_COLUMNS.indexOf('planned_minutes')]).toBe('15');
    expect(cells[CSV_COLUMNS.indexOf('completed_activities')]).toBe('beginner yoga (10m)');
  });

  it('marks a followed rest day, and leaves it empty when unanswered', () => {
    record(REST_DAY, acknowledgeRestDay(true));
    expect(rows()[1]).toContain('true');

    const other = newRepo(createMemoryStorageAdapter(), 'other');
    other.initialise();
    const csvNoAnswer = buildDailyCsv(readAppData(other), { today: DAY_2 }).contents;
    expect(csvNoAnswer.replace(UTF8_BOM, '').trimEnd().split('\r\n')).toHaveLength(1);
  });

  it('keeps missing empty and explicit zero as zero', () => {
    record(DAY_1, { exercise: { steps: 0 }, hydration: { glasses: 0 } });
    const cells = (rows()[1] ?? '').split(',');

    const stepsIndex = CSV_COLUMNS.indexOf('steps');
    const effortIndex = CSV_COLUMNS.indexOf('effort');
    const sleepIndex = CSV_COLUMNS.indexOf('sleep_hours');

    expect(cells[stepsIndex]).toBe('0');
    expect(cells[effortIndex]).toBe('');
    expect(cells[sleepIndex]).toBe('');
  });

  it('keeps explicit false as false and unanswered as empty', () => {
    record(DAY_1, { symptoms: { legPain: false }, nutrition: { morningFruit: false } });
    const cells = (rows()[1] ?? '').split(',');

    expect(cells[CSV_COLUMNS.indexOf('leg_pain')]).toBe('false');
    expect(cells[CSV_COLUMNS.indexOf('fruit_before_midday')]).toBe('false');
    expect(cells[CSV_COLUMNS.indexOf('gousto')]).toBe('');
  });

  it('escapes a note containing a comma, a quote and a newline', () => {
    record(DAY_1, { exercise: { notes: 'Felt "ok", then\nbetter' } });
    const line = rows()[1] ?? '';

    expect(line).toContain('"Felt ""ok"", then\nbetter"');
  });

  it('survives Unicode in a note', () => {
    record(DAY_1, { recovery: { notes: 'Slept badly ☕ 走路' } });
    expect(rows().join('\n')).toContain('Slept badly ☕ 走路');
  });

  it('names the file with the local date', () => {
    expect(dailyCsvFilename('2026-08-14')).toBe('fitness-tracker-daily-2026-08-14.csv');
  });

  it('carries no game state', () => {
    record(DAY_1, toggleActivityCompletion(undefined, yoga.id, true));
    syncGame(repo, { now: NOW, today: DAY_1 });

    const text = csv();
    expect(text).not.toMatch(/\bxp\b|trophy|trophies|mascot|awardedKeys/i);
  });
});

describe('the Data screen', () => {
  it('never touches localStorage itself', () => {
    expect(dataScreenSource).not.toMatch(/localStorage/);
    expect(useDataSource).not.toMatch(/localStorage/);
  });

  it('stamps the backup time only after the file has been handed over', () => {
    // downloadFile runs first; updateMeta follows it.
    const order = useDataSource.indexOf('downloadFile(backup)');
    const stamp = useDataSource.indexOf('lastExportedAt: nowTimestamp()');
    expect(order).toBeGreaterThan(-1);
    expect(stamp).toBeGreaterThan(order);
  });

  it('does not treat the CSV as a backup', () => {
    const csvBlock = useDataSource.slice(
      useDataSource.indexOf('const exportCsv'),
      useDataSource.indexOf('const chooseFile'),
    );
    expect(csvBlock).not.toMatch(/updateMeta/);
    expect(dataScreenSource).toMatch(/not a full backup/);
  });

  it('shows Never before any backup has been taken', () => {
    expect(repo.getMeta()?.lastExportedAt).toBeUndefined();
    expect(dataScreenSource).toMatch(/'Never'/);
  });

  it('waits for confirmation before importing', () => {
    // chooseFile only validates and stores a pending import; commitImport is
    // reachable only from confirmImport.
    const chooseBlock = useDataSource.slice(
      useDataSource.indexOf('const chooseFile'),
      useDataSource.indexOf('const cancelImport'),
    );
    expect(chooseBlock).not.toMatch(/commitImport/);
    expect(useDataSource).toMatch(/const confirmImport[\s\S]*commitImport/);
    expect(dataScreenSource).toMatch(/Back up and replace/);
  });

  it('explains storage and does not overstate it', () => {
    expect(dataScreenSource).toMatch(/not synced to your NinFit ID or to the cloud/i);
    expect(dataScreenSource).toMatch(/personal health and fitness information/i);
  });

  it('surfaces storage issues in human terms, without raw values', () => {
    expect(dataScreenSource).toMatch(/Could not read/);
    expect(dataScreenSource).toMatch(/Nothing has been deleted or repaired/);
    expect(dataScreenSource).not.toMatch(/issue\.detail|JSON\.stringify/);
  });

  it('warns when storage is not durable', () => {
    expect(dataScreenSource).toMatch(/only available for this session/i);
  });
});

// ---------------------------------------------------------------------------

/**
 * How the Data screen is weighted.
 *
 * These guard a presentation contract, not a layout. The screen may be restyled
 * freely; what it may not do is make the full backup look like one option among
 * three again, or push the explanation back above the actions.
 */
describe('weight on the Data screen follows consequence', () => {
  /**
   * Comments stripped first. This screen's docstring explains the weighting rule at
   * length and therefore names the classes these tests forbid, so a scan of the raw
   * source would match the explanation and report the opposite of the truth.
   */
  const code = dataScreenSource
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

  const between = (open: string, close: string): string => {
    const start = code.indexOf(open);
    expect(start, `missing ${open}`).toBeGreaterThan(-1);
    const rest = code.slice(start + open.length);
    const end = rest.indexOf(close);
    return end === -1 ? rest : rest.slice(0, end);
  };

  it('gives the full backup the only primary export button', () => {
    const backup = between('<Section title="Backup">', '</Section>');
    expect(backup).toMatch(/btn btn--primary btn--block/);
    expect(backup).toMatch(/Export JSON backup/);
  });

  it('keeps the everyday export secondary, and says it is not a backup', () => {
    const csv = between('<Section title="Everyday export">', '</Section>');
    expect(csv).toMatch(/btn btn--secondary btn--block/);
    expect(csv).not.toMatch(/btn--primary/);
    expect(csv).toMatch(/not a full backup/);
  });

  it('does not open the restore path on a primary button', () => {
    // The entry point is secondary; the confirmation inside it is what carries
    // weight, and it keeps its attention styling.
    const entry = between('<Section title="Restore from a backup"', '<div className="confirm">');
    expect(entry).toMatch(/Choose a backup file/);
    expect(entry).not.toMatch(/btn--primary/);
    expect(code).toMatch(/btn btn--attention btn--block/);
  });

  it('marks a device that has never been backed up', () => {
    const backup = between('<Section title="Backup">', '</Section>');
    expect(backup).toMatch(/attention-chip/);
  });

  it('orders the screen actions first, explanation after, issues last', () => {
    const backup = code.indexOf('<Section title="Backup">');
    const csv = code.indexOf('<Section title="Everyday export">');
    const restore = code.indexOf('<Section title="Restore from a backup"');
    const storage = code.indexOf('className="card card--info"');
    const issues = code.indexOf('<Section title="Stored data issue">');

    for (const index of [backup, csv, restore, storage, issues]) {
      expect(index).toBeGreaterThan(-1);
    }
    expect(csv).toBeGreaterThan(backup);
    expect(restore).toBeGreaterThan(csv);
    expect(storage).toBeGreaterThan(restore);
    expect(issues).toBeGreaterThan(storage);
  });

  it('keeps the temporary-session warning above everything', () => {
    const warning = code.indexOf('only available for this session');
    expect(warning).toBeGreaterThan(-1);
    expect(warning).toBeLessThan(code.indexOf('<Section title="Backup">'));
  });

  it('states the account boundary rather than implying there is no account', () => {
    // NinFit ID exists and is reachable from Profile. Saying the app has no account
    // at all stopped being true; saying the fitness records have none still is.
    expect(code).toMatch(/stored on this device/i);
    expect(code).toMatch(/not synced to your NinFit ID or to the cloud/i);
    expect(code).toMatch(/does not contain your fitness records/i);
  });

  it('draws nothing from the game layer', () => {
    /*
     * A word ban would be wrong here: the import confirmation legitimately REPORTS
     * what a backup contains, trophies included, and "export" contains "xp". What
     * must stay out is the game layer itself, so this checks imports rather than
     * prose. Reward STYLING is guarded separately in cardTaxonomy.test.ts.
     */
    expect(code).not.toMatch(/domain\/game/);
    expect(code).not.toMatch(/components\/(Opal|EggArt|GameHeader)/);
  });
});


describe('backup integrity is consequence-weighted', () => {
  it('does not let the full JSON backup silently drop Journey history', () => {
    const exportSource = readFileSync(
      fileURLToPath(new URL('../io/exportJson.ts', import.meta.url)),
      'utf8',
    );

    expect(exportSource).toMatch(/journeyResult\.issue/);
    expect(exportSource).toMatch(/throw new Error/);
    expect(exportSource).toMatch(/Journey history could not be included safely/i);
  });

  it('keeps the Data hook error path visible when backup construction throws', () => {
    expect(useDataSource).toMatch(/try \{[\s\S]*buildBackup[\s\S]*catch \(error\)/);
    expect(useDataSource).toMatch(/The backup could not be saved/);
  });
});
