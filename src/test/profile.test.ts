import { beforeEach, describe, expect, it } from 'vitest';
import profileScreenSource from '../ui/screens/ProfileScreen.tsx?raw';
import useProfileSource from '../ui/hooks/useProfile.ts?raw';
import { createTodaySession } from '../app/todaySession';
import { PROGRAMME_START_DATE } from '../domain/defaults';
import { sequentialIdFactory } from '../domain/ids';
import { createMeasurement, isMeasurementEmpty } from '../domain/measurement';
import {
  addHealthNote,
  applyBaselineUpdate,
  applyProfileUpdate,
  createHealthNote,
  removeHealthNote,
  startDateChangeAffectsHistory,
} from '../domain/profile';
import { resolveToday } from '../domain/today';
import type { WeeklyPlan } from '../domain/types';
import {
  cmToInches,
  inchesToCm,
  kgToStoneAndPounds,
  stoneAndPoundsToKg,
} from '../domain/units';
import { createMemoryStorageAdapter, type StorageAdapter } from '../storage/StorageAdapter';
import { Repository, createRepository } from '../storage/repository';

const NOW = '2026-08-13T20:04:00.000+01:00';
const LATER = '2026-09-01T09:00:00.000+01:00';

let adapter: StorageAdapter;
let repo: Repository;
let plans: WeeklyPlan[];

function newRepo(store: StorageAdapter, prefix = 'seed'): Repository {
  return createRepository(store, { now: () => NOW, makeId: sequentialIdFactory(prefix) });
}

/** A fresh repository over the same store, as a reload would produce. */
function reload(): Repository {
  const next = newRepo(adapter, 'reload');
  next.initialise();
  return next;
}

beforeEach(() => {
  adapter = createMemoryStorageAdapter();
  repo = newRepo(adapter);
  repo.initialise();
  plans = repo.getWeeklyPlans();
});

// ---------------------------------------------------------------------------

describe('the seeded profile', () => {
  it('loads with the approved starting values', () => {
    const profile = repo.getProfile();
    expect(profile?.birthYear).toBe(1984);
    expect(profile?.sex).toBe('male');
    expect(profile?.heightCm).toBeCloseTo(180.3, 1);
    expect(profile?.programmeStartDate).toBe(PROGRAMME_START_DATE);
    expect(profile?.preferredUnits).toEqual({ weight: 'stone_lb', length: 'in' });
  });

  it('loads the baseline as recorded', () => {
    expect(repo.getBaseline()).toMatchObject({
      weightKg: 69.9,
      waistCm: 76.2,
      restingHeartRateBpm: 72,
      hrvMs: 37,
      averageDailySteps: 3000,
      backPain: 4,
      exerciseCapacityMinutes: 15,
      plannedDaysPerWeek: 6,
    });
  });
});

describe('profile edits persist', () => {
  it('survives a reload', () => {
    const profile = repo.getProfile();
    if (!profile) throw new Error('expected a profile');

    repo.saveProfile(
      applyProfileUpdate(profile, { displayName: 'Kris', heightCm: 181 }, { now: LATER }),
    );

    const reloaded = reload().getProfile();
    expect(reloaded?.displayName).toBe('Kris');
    expect(reloaded?.heightCm).toBe(181);
    expect(reloaded?.updatedAt).toBe(LATER);
    expect(reloaded?.createdAt).toBe(NOW);
  });

  it('keeps the preferred units after a reload', () => {
    const profile = repo.getProfile();
    if (!profile) throw new Error('expected a profile');

    repo.saveProfile(
      applyProfileUpdate(profile, { preferredUnits: { weight: 'kg', length: 'cm' } }),
    );

    expect(reload().getProfile()?.preferredUnits).toEqual({ weight: 'kg', length: 'cm' });
  });

  it('clears an optional field rather than storing an empty one', () => {
    const profile = repo.getProfile();
    if (!profile) throw new Error('expected a profile');

    repo.saveProfile(applyProfileUpdate(profile, { displayName: 'Kris' }));
    const named = reload().getProfile();
    if (!named) throw new Error('expected a profile');

    repo.saveProfile(applyProfileUpdate(named, { displayName: undefined }));
    const cleared = reload().getProfile();
    expect(cleared?.displayName).toBeUndefined();
    expect('displayName' in (cleared ?? {})).toBe(false);
  });

  it('never has its id or createdAt rewritten by an edit', () => {
    const profile = repo.getProfile();
    if (!profile) throw new Error('expected a profile');

    const edited = applyProfileUpdate(profile, { sex: 'prefer_not_to_say' }, { now: LATER });
    expect(edited.id).toBe(profile.id);
    expect(edited.createdAt).toBe(profile.createdAt);
  });
});

describe('baseline edits persist and stay historical', () => {
  it('survives a reload and is not restored to the seed', () => {
    const baseline = repo.getBaseline();
    if (!baseline) throw new Error('expected a baseline');

    repo.saveBaseline(applyBaselineUpdate(baseline, { weightKg: 68.4, waistCm: 74.9 }));

    const reloaded = reload().getBaseline();
    expect(reloaded?.weightKg).toBe(68.4);
    expect(reloaded?.waistCm).toBe(74.9);
  });

  it('keeps its original recorded date when edited', () => {
    const baseline = repo.getBaseline();
    if (!baseline) throw new Error('expected a baseline');

    const edited = applyBaselineUpdate(baseline, { weightKg: 68.4 });
    expect(edited.recordedOn).toBe(PROGRAMME_START_DATE);
    expect(edited.id).toBe(baseline.id);
  });

  it('is not changed by anything logged later', () => {
    const today = createTodaySession(repo, PROGRAMME_START_DATE, {
      now: NOW,
      makeId: sequentialIdFactory('t'),
    });
    today.apply({ recovery: { restingHeartRateBpm: 64 }, exercise: { steps: 9000 } });
    today.save();

    expect(reload().getBaseline()?.restingHeartRateBpm).toBe(72);
    expect(reload().getBaseline()?.averageDailySteps).toBe(3000);
  });

  it('keeps an explicit zero and an explicit false through an edit', () => {
    const baseline = repo.getBaseline();
    if (!baseline) throw new Error('expected a baseline');

    repo.saveBaseline(applyBaselineUpdate(baseline, { backPain: 0, plannedDaysPerWeek: 0 }));

    const reloaded = reload().getBaseline();
    expect(reloaded?.backPain).toBe(0);
    expect(reloaded?.plannedDaysPerWeek).toBe(0);
  });
});

describe('programme start date', () => {
  it('changes how future dates resolve onto the programme', () => {
    const profile = repo.getProfile();
    if (!profile) throw new Error('expected a profile');

    // Before: 14 August is day 2.
    expect(resolveToday(plans, profile.programmeStartDate, '2026-08-14').dayIndex).toBe(2);

    repo.saveProfile(applyProfileUpdate(profile, { programmeStartDate: '2026-08-14' }));
    const moved = reload().getProfile();
    if (!moved) throw new Error('expected a profile');

    // After: 14 August is day 1.
    expect(resolveToday(plans, moved.programmeStartDate, '2026-08-14').dayIndex).toBe(1);
    expect(resolveToday(plans, moved.programmeStartDate, '2026-08-13').status).toBe(
      'before_programme',
    );
  });

  it('does not move or rewrite any recorded day', () => {
    const today = createTodaySession(repo, '2026-08-13', {
      now: NOW,
      makeId: sequentialIdFactory('t'),
    });
    today.apply({ exercise: { steps: 3200 } });
    today.save();

    const before = repo.getDailyLog('2026-08-13');

    const profile = repo.getProfile();
    if (!profile) throw new Error('expected a profile');
    repo.saveProfile(applyProfileUpdate(profile, { programmeStartDate: '2026-08-20' }));

    const after = reload();
    expect(after.listDailyLogDates()).toEqual(['2026-08-13']);
    expect(after.getDailyLog('2026-08-13')).toEqual(before);
  });

  it('flags a change that would renumber existing records', () => {
    expect(startDateChangeAffectsHistory('2026-08-13', '2026-08-20', true)).toBe(true);
    expect(startDateChangeAffectsHistory('2026-08-13', '2026-08-20', false)).toBe(false);
    expect(startDateChangeAffectsHistory('2026-08-13', '2026-08-13', true)).toBe(false);
  });

  it('warns before saving rather than after', () => {
    expect(profileScreenSource).toMatch(/startDateAffectsHistory/);
    expect(profileScreenSource).toMatch(/pendingStart/);
  });
});

describe('measurements', () => {
  it('persists a new measurement', () => {
    const measurement = createMeasurement(
      { recordedOn: '2026-09-01', weightKg: 69.2, waistCm: 75, notes: 'Morning.' },
      { makeId: sequentialIdFactory('m') },
    );
    repo.saveMeasurements([measurement]);

    expect(reload().getMeasurements()).toEqual([measurement]);
  });

  it('accepts a partial measurement and leaves the rest absent', () => {
    const measurement = createMeasurement(
      { recordedOn: '2026-09-01', weightKg: 69.2 },
      { makeId: sequentialIdFactory('m') },
    );
    repo.saveMeasurements([measurement]);

    const stored = reload().getMeasurements()[0];
    expect(stored?.weightKg).toBe(69.2);
    expect(stored?.waistCm).toBeUndefined();
    expect('waistCm' in (stored ?? {})).toBe(false);
    expect(stored?.notes).toBeUndefined();
  });

  it('recognises a measurement holding nothing but a date', () => {
    const empty = createMeasurement({ recordedOn: '2026-09-01' }, { makeId: sequentialIdFactory('m') });
    expect(isMeasurementEmpty(empty)).toBe(true);

    const withNote = createMeasurement(
      { recordedOn: '2026-09-01', notes: 'Felt heavy.' },
      { makeId: sequentialIdFactory('m2') },
    );
    expect(isMeasurementEmpty(withNote)).toBe(false);
  });

  it('keeps a recorded zero', () => {
    const measurement = createMeasurement(
      { recordedOn: '2026-09-01', hrvMs: 0 },
      { makeId: sequentialIdFactory('m') },
    );
    repo.saveMeasurements([measurement]);
    expect(reload().getMeasurements()[0]?.hrvMs).toBe(0);
  });

  it('rejects an impossible date', () => {
    expect(() => createMeasurement({ recordedOn: '2026-02-30' })).toThrow(/Invalid measurement date/);
  });
});

describe('unit conversion round-trips without drift', () => {
  it('keeps 30 inches as 76.2 cm', () => {
    expect(inchesToCm(30)).toBeCloseTo(76.2, 9);
    expect(cmToInches(76.2)).toBeCloseTo(30, 9);
    expect(inchesToCm(cmToInches(76.2))).toBeCloseTo(76.2, 9);
  });

  it('displays 69.9 kg as 11 stone and stays there through repeated edits', () => {
    let kg = 69.9;
    expect(kgToStoneAndPounds(kg)).toEqual({ stone: 11, pounds: 0.1 });

    // Editing the field re-reads the display value and writes it back, repeatedly.
    for (let pass = 0; pass < 5; pass += 1) {
      const { stone, pounds } = kgToStoneAndPounds(kg);
      kg = stoneAndPoundsToKg(stone, pounds);
    }

    expect(kgToStoneAndPounds(kg)).toEqual({ stone: 11, pounds: 0.1 });
    expect(kg).toBeCloseTo(69.9, 1);
  });

  it('does not drift when a length is edited repeatedly', () => {
    let cm = 76.2;
    for (let pass = 0; pass < 5; pass += 1) {
      cm = inchesToCm(Number(cmToInches(cm).toFixed(1)));
    }
    expect(cm).toBeCloseTo(76.2, 6);
  });

  it('stores only metric, never the converted value', () => {
    expect(repo.getBaseline()?.waistCm).toBe(76.2);
    const raw = adapter.get('ft:v1:baseline') ?? '';
    expect(raw).not.toMatch(/waistIn|weightSt|weightLb/);
  });
});

describe('health notes', () => {
  it('preserves vague timing exactly as written', () => {
    const note = repo
      .getHealthContext()
      ?.notes.find((entry) => entry.label.includes('prediabetes'));

    expect(note?.noticedNote).toBe('Approximately two years ago.');
    expect(note?.noticedOn).toBeUndefined();
  });

  it('marks every note as self-reported, including new ones', () => {
    const context = repo.getHealthContext();
    if (!context) throw new Error('expected a health context');

    const added = addHealthNote(
      context,
      createHealthNote(
        { label: 'Occasional hip tightness', noticedNote: 'Last winter, roughly' },
        { makeId: sequentialIdFactory('n') },
      ),
      { now: LATER },
    );
    repo.saveHealthContext(added);

    const reloaded = reload().getHealthContext();
    expect(reloaded?.notes).toHaveLength(5);
    expect(reloaded?.notes.every((note) => note.source === 'self_reported')).toBe(true);
    expect(reloaded?.notes[4]?.noticedNote).toBe('Last winter, roughly');
    expect(reloaded?.notes[4]?.noticedOn).toBeUndefined();
  });

  it('removes a note without touching the others', () => {
    const context = repo.getHealthContext();
    if (!context) throw new Error('expected a health context');
    const target = context.notes[1];
    if (!target) throw new Error('expected a second note');

    repo.saveHealthContext(removeHealthNote(context, target.id, { now: LATER }));

    const reloaded = reload().getHealthContext();
    expect(reloaded?.notes).toHaveLength(3);
    expect(reloaded?.notes.some((note) => note.id === target.id)).toBe(false);
    expect(reloaded?.notes[0]?.label).toBe('Lower-back prolapsed disc');
  });

  it('presents notes as the user own words, never as a diagnosis', () => {
    expect(profileScreenSource).toMatch(/self-reported/i);
    expect(profileScreenSource).toMatch(/no diagnosis|makes no diagnosis/i);
  });
});

describe('architecture', () => {
  it('keeps localStorage out of the Profile UI', () => {
    expect(profileScreenSource).not.toMatch(/localStorage/);
    expect(useProfileSource).not.toMatch(/localStorage/);
  });

  it('keeps a failed write visible rather than pretending it saved', () => {
    expect(useProfileSource).toMatch(/setStatus\('failed'\)/);
  });

  it('seed defaults never overwrite an edit on a later launch', () => {
    const baseline = repo.getBaseline();
    if (!baseline) throw new Error('expected a baseline');
    repo.saveBaseline(applyBaselineUpdate(baseline, { weightKg: 68.4 }));

    reload();
    reload();

    expect(repo.getBaseline()?.weightKg).toBe(68.4);
  });
});
