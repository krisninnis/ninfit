import { lazy, Suspense, useState } from 'react';
import { getAppContext } from '../../app/bootstrap';
import { restartOnboarding } from '../../app/game';
import {
  FITNESS_PATHS,
  FITNESS_STAGE_LABELS,
  findPath,
  isHighlightedSkill,
} from '../../domain/game/paths';
import { findTrophy } from '../../domain/game/trophies';
import type { MascotPersonality, SkillKind, SocialMode } from '../../domain/game/types';
import { useGame } from '../hooks/useGame';
import { sortMeasurementsDescending } from '../../domain/measurement';
import type {
  DisplayUnitPreferences,
  ISODate,
  LengthDisplayUnit,
  PriorStructuredExercise,
  Sex,
  WeightDisplayUnit,
} from '../../domain/types';
import {
  cmToInches,
  formatHeight,
  inchesToCm,
  kgToStoneAndPounds,
  roundTo,
  stoneAndPoundsToKg,
} from '../../domain/units';
import {
  DateField,
  NoteField,
  NumberField,
  Scale,
  Section,
  SelectField,
  Stepper,
  TextField,
  Toggle,
} from '../components/Field';
import { AttentionIcon } from '../components/Icon';
import { Screen } from '../components/Screen';
import { formatShortDay } from '../format';
import { useProfile, type ProfileSaveStatus } from '../hooks/useProfile';

/**
 * Viewing and correcting the starting record.
 *
 * Canonical storage stays metric throughout. The imperial fields here convert on the
 * way in and out; no converted value is ever written to storage.
 */

const SEX_OPTIONS: ReadonlyArray<{ value: Sex; label: string }> = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const SKILL_LABELS: Readonly<Record<SkillKind, string>> = {
  strength: 'Strength',
  stamina: 'Stamina',
  mobility: 'Mobility',
  consistency: 'Consistency',
  recovery: 'Recovery',
};

const PRIOR_EXERCISE: ReadonlyArray<{ value: PriorStructuredExercise; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'some', label: 'Some' },
  { value: 'regular', label: 'Regular' },
];

const WEIGHT_UNITS: ReadonlyArray<{ value: WeightDisplayUnit; label: string }> = [
  { value: 'stone_lb', label: 'Stone and pounds' },
  { value: 'kg', label: 'Kilograms' },
];

const LENGTH_UNITS: ReadonlyArray<{ value: LengthDisplayUnit; label: string }> = [
  { value: 'in', label: 'Inches' },
  { value: 'cm', label: 'Centimetres' },
];

function SaveNote({ status }: { status: ProfileSaveStatus }) {
  if (status === 'idle') return null;
  const text =
    status === 'saved'
      ? 'Saved'
      : status === 'pending'
        ? 'Saving'
        : 'Not saved to this device. Your changes are still here.';
  return (
    <span className={`savedot savedot--${status}`} role="status">
      {text}
    </span>
  );
}

/** Weight in whichever unit the user thinks in. Always stored as kilograms. */
function WeightField({
  label,
  kg,
  unit,
  onChange,
}: {
  label: string;
  kg: number | undefined;
  unit: WeightDisplayUnit;
  onChange: (kg: number | undefined) => void;
}) {
  if (unit === 'kg') {
    return <NumberField label={label} value={kg === undefined ? undefined : roundTo(kg, 1)} onChange={onChange} unit="kg" />;
  }

  const parts = kg === undefined ? undefined : kgToStoneAndPounds(kg);

  return (
    <div className="pairfield">
      <NumberField
        label={`${label} (stone)`}
        value={parts?.stone}
        onChange={(stone) =>
          onChange(stone === undefined ? undefined : stoneAndPoundsToKg(stone, parts?.pounds ?? 0))
        }
        unit="st"
        min={0}
      />
      <NumberField
        label="and pounds"
        value={parts?.pounds}
        onChange={(pounds) =>
          onChange(parts === undefined ? undefined : stoneAndPoundsToKg(parts.stone, pounds ?? 0))
        }
        unit="lb"
        min={0}
      />
    </div>
  );
}

/** Length in the preferred unit. Always stored as centimetres. */
function LengthField({
  label,
  cm,
  unit,
  onChange,
}: {
  label: string;
  cm: number | undefined;
  unit: LengthDisplayUnit;
  onChange: (cm: number | undefined) => void;
}) {
  if (unit === 'cm') {
    return (
      <NumberField
        label={label}
        value={cm === undefined ? undefined : roundTo(cm, 1)}
        onChange={onChange}
        unit="cm"
      />
    );
  }
  return (
    <NumberField
      label={label}
      value={cm === undefined ? undefined : roundTo(cmToInches(cm), 1)}
      onChange={(inches) => onChange(inches === undefined ? undefined : inchesToCm(inches))}
      unit="in"
    />
  );
}

interface DraftMeasurement {
  recordedOn: ISODate;
  weightKg?: number;
  waistCm?: number;
  restingHeartRateBpm?: number;
  hrvMs?: number;
  notes?: string;
}

const AccountSection = lazy(() =>
  import('../components/AccountSection').then((module) => ({
    default: module.AccountSection,
  })),
);
export function ProfileScreen() {
  const {
    profile,
    baseline,
    healthContext,
    measurements,
    today,
    status,
    hasStorageIssues,
    startDateAffectsHistory,
    updateProfile,
    updateBaseline,
    addNote,
    removeNote,
    addMeasurement,
  } = useProfile();

  const [pendingStart, setPendingStart] = useState<ISODate | undefined>(undefined);
  const [draft, setDraft] = useState<DraftMeasurement>({ recordedOn: today });
  const [newNote, setNewNote] = useState<string | undefined>(undefined);
  const [newNoteWhen, setNewNoteWhen] = useState<string | undefined>(undefined);

  if (profile === undefined || baseline === undefined) {
    return (
      <Screen title="Profile & baseline">
        <section className="card card--attention">
          <AttentionIcon />
          <p>
            Your profile could not be read from this device. Nothing has been changed or
            overwritten.
          </p>
        </section>
      </Screen>
    );
  }

  const units: DisplayUnitPreferences = profile.preferredUnits;
  const patchDraft = (patch: Partial<DraftMeasurement>) =>
    setDraft((current) => ({ ...current, ...patch }));

  return (
    <Screen title="Profile & baseline" subtitle="Your starting measurements and your own notes.">
      <div className="today__meta">
        <span className="today__programme">Everything here is editable</span>
        <SaveNote status={status} />
      </div>

      <Suspense
        fallback={
          <section className="card">
            <p className="footnote">Account controls loading…</p>
          </section>
        }
      >
        <AccountSection />
      </Suspense>

      {hasStorageIssues ? (
        <section className="card card--attention">
          <AttentionIcon />
          <p>Some stored data could not be read. Nothing has been repaired or removed.</p>
        </section>
      ) : null}

      <Section title="You">
        <TextField
          label="Name"
          value={profile.displayName}
          onChange={(displayName) => updateProfile({ displayName })}
          placeholder="Optional"
        />
        <NumberField
          label="Birth year"
          hint="Year only. Age is approximate, and that is enough."
          value={profile.birthYear}
          onChange={(birthYear) => {
            if (birthYear !== undefined) updateProfile({ birthYear });
          }}
          min={1900}
          max={2100}
        />
        <SelectField
          label="Sex"
          value={profile.sex}
          options={SEX_OPTIONS}
          onChange={(sex) => updateProfile({ sex })}
        />
        <NumberField
          label="Height"
          value={roundTo(profile.heightCm, 1)}
          onChange={(heightCm) => {
            if (heightCm !== undefined) updateProfile({ heightCm });
          }}
          unit="cm"
        />
        <p className="footnote">That is {formatHeight(profile.heightCm, 'in')}.</p>
      </Section>

      <Section title="Units" defaultOpen={false}>
        <SelectField
          label="Show weight in"
          value={units.weight}
          options={WEIGHT_UNITS}
          onChange={(weight) => updateProfile({ preferredUnits: { ...units, weight } })}
        />
        <SelectField
          label="Show lengths in"
          value={units.length}
          options={LENGTH_UNITS}
          onChange={(length) => updateProfile({ preferredUnits: { ...units, length } })}
        />
        <p className="footnote">Stored in kilograms and centimetres either way.</p>
      </Section>

      <Section title="Programme">
        <DateField
          label="Programme start date"
          hint="Day 1 of week 1. Weeks roll on from here, not from a Monday."
          value={pendingStart ?? profile.programmeStartDate}
          onChange={(next) => {
            if (startDateAffectsHistory(next)) setPendingStart(next);
            else updateProfile({ programmeStartDate: next });
          }}
        />
        {pendingStart !== undefined ? (
          <div className="confirm">
            <p>
              You have days already recorded. Changing the start date will renumber which
              programme day those dates fall on. The records themselves are not changed or moved.
            </p>
            <div className="confirm__actions">
              <button
                type="button"
                className="btn btn--secondary btn--block"
                onClick={() => setPendingStart(undefined)}
              >
                Leave it
              </button>
              <button
                type="button"
                className="btn btn--attention btn--block"
                onClick={() => {
                  updateProfile({ programmeStartDate: pendingStart });
                  setPendingStart(undefined);
                }}
              >
                Change start date
              </button>
            </div>
          </div>
        ) : null}
      </Section>

      <Section title="Baseline: where you started" defaultOpen={false}>
        <p className="footnote">
          A historical record of your starting point. Editing it corrects that record; it does
          not create a new measurement, and nothing you log later changes it.
        </p>
        <WeightField
          label="Weight"
          kg={baseline.weightKg}
          unit={units.weight}
          onChange={(weightKg) => updateBaseline({ weightKg })}
        />
        <LengthField
          label="Waist"
          cm={baseline.waistCm}
          unit={units.length}
          onChange={(waistCm) => updateBaseline({ waistCm })}
        />
        <NumberField
          label="Resting heart rate"
          value={baseline.restingHeartRateBpm}
          onChange={(restingHeartRateBpm) => updateBaseline({ restingHeartRateBpm })}
          unit="bpm"
        />
        <NumberField
          label="HRV"
          value={baseline.hrvMs}
          onChange={(hrvMs) => updateBaseline({ hrvMs })}
          unit="ms"
        />
        <NumberField
          label="Estimated average daily steps"
          hint="Your estimate at the start, not a measured day."
          value={baseline.averageDailySteps}
          onChange={(averageDailySteps) => updateBaseline({ averageDailySteps })}
        />
        <Scale
          label="Back pain at the start"
          value={baseline.backPain}
          onChange={(backPain) => updateBaseline({ backPain })}
          lowLabel="none"
          highLabel="severe"
        />
        <Stepper
          label="Exercise capacity at the start"
          value={baseline.exerciseCapacityMinutes}
          onChange={(exerciseCapacityMinutes) => updateBaseline({ exerciseCapacityMinutes })}
          step={5}
          max={180}
          unit="min"
        />
        <SelectField
          label="Structured exercise before starting"
          value={baseline.structuredExerciseBefore ?? 'none'}
          options={PRIOR_EXERCISE}
          onChange={(structuredExerciseBefore) => updateBaseline({ structuredExerciseBefore })}
        />
        <Stepper
          label="Planned active days per week"
          value={baseline.plannedDaysPerWeek}
          onChange={(plannedDaysPerWeek) => updateBaseline({ plannedDaysPerWeek })}
          max={7}
          unit="days"
        />
      </Section>

      <Section title="Add a measurement" defaultOpen={false}>
        <p className="footnote">Fill in whatever you have. Everything except the date is optional.</p>
        <DateField
          label="Date"
          value={draft.recordedOn}
          onChange={(recordedOn) => patchDraft({ recordedOn })}
        />
        <WeightField
          label="Weight"
          kg={draft.weightKg}
          unit={units.weight}
          onChange={(weightKg) => patchDraft({ weightKg })}
        />
        <LengthField
          label="Waist"
          cm={draft.waistCm}
          unit={units.length}
          onChange={(waistCm) => patchDraft({ waistCm })}
        />
        <NumberField
          label="Resting heart rate"
          value={draft.restingHeartRateBpm}
          onChange={(restingHeartRateBpm) => patchDraft({ restingHeartRateBpm })}
          unit="bpm"
        />
        <NumberField
          label="HRV"
          value={draft.hrvMs}
          onChange={(hrvMs) => patchDraft({ hrvMs })}
          unit="ms"
        />
        <NoteField
          label="Note"
          value={draft.notes}
          onChange={(notes) => patchDraft({ notes })}
        />
        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={() => {
            if (addMeasurement(draft)) setDraft({ recordedOn: today });
          }}
        >
          Add measurement
        </button>

        {measurements.length > 0 ? (
          <div className="stats">
            {sortMeasurementsDescending(measurements).map((measurement) => (
              <div className="stat stat--row" key={measurement.id}>
                <span className="stat__label">{formatShortDay(measurement.recordedOn)}</span>
                <span className="stat__value">
                  {[
                    measurement.weightKg === undefined ? undefined : `${roundTo(measurement.weightKg, 1)} kg`,
                    measurement.waistCm === undefined ? undefined : `${roundTo(measurement.waistCm, 1)} cm`,
                    measurement.restingHeartRateBpm === undefined
                      ? undefined
                      : `${measurement.restingHeartRateBpm} bpm`,
                    measurement.hrvMs === undefined ? undefined : `${measurement.hrvMs} ms`,
                  ]
                    .filter((part) => part !== undefined)
                    .join(' · ')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty">No measurements recorded yet.</p>
        )}
      </Section>

      <Section title="Your notes: self-reported context" defaultOpen={false}>
        <p className="footnote">
          Your own words about your health. The app records them and does nothing else with
          them: it makes no diagnosis and draws no conclusions.
        </p>
        {healthContext !== undefined && healthContext.notes.length > 0 ? (
          <ul className="notelist">
            {healthContext.notes.map((note) => (
              <li className="surface notelist__item" key={note.id}>
                <span className="notelist__text">
                  <span className="notelist__label">{note.label}</span>
                  {note.detail !== undefined ? (
                    <span className="notelist__detail">{note.detail}</span>
                  ) : null}
                  {note.noticedNote !== undefined ? (
                    <span className="notelist__detail">{note.noticedNote}</span>
                  ) : null}
                  {note.noticedOn !== undefined ? (
                    <span className="notelist__detail">{formatShortDay(note.noticedOn)}</span>
                  ) : null}
                </span>
                <button
                  type="button"
                  className="notelist__remove"
                  onClick={() => removeNote(note.id)}
                  aria-label={`Remove ${note.label}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">No notes recorded.</p>
        )}

        <TextField
          label="Add a note"
          value={newNote}
          onChange={setNewNote}
          placeholder="In your own words"
        />
        <TextField
          label="When, roughly"
          hint="Vague is fine. It is stored exactly as you write it."
          value={newNoteWhen}
          onChange={setNewNoteWhen}
          placeholder="Approximately two years ago"
        />
        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={() => {
            if (newNote === undefined || newNote.trim() === '') return;
            addNote({
              label: newNote.trim(),
              ...(newNoteWhen !== undefined ? { noticedNote: newNoteWhen } : {}),
            });
            setNewNote(undefined);
            setNewNoteWhen(undefined);
          }}
        >
          Add note
        </button>
      </Section>

      <GameSettingsSection />

      <p className="today__disclaimer">A personal record, not a medical assessment.</p>
    </Screen>
  );
}

const PERSONALITIES: ReadonlyArray<{ value: MascotPersonality; label: string }> = [
  { value: 'quiet', label: 'Quiet' },
  { value: 'normal', label: 'Normal' },
  { value: 'chatty', label: 'Chatty' },
];

const SOCIAL_MODES: ReadonlyArray<{ value: SocialMode; label: string }> = [
  { value: 'private', label: 'Private' },
  { value: 'friends', label: 'Friends' },
  { value: 'community', label: 'Community' },
];

/**
 * Game preferences and trophies.
 *
 * Everything social is a preference only: there is no networking behind any of it
 * yet. Whatever is chosen here, health data stays private - a trophy's visibility
 * never carries a measurement, a symptom or a note with it.
 */
function GameSettingsSection() {
  const game = useGame();
  const { state, settings } = game;
  const path = state.pathId === undefined ? undefined : findPath(state.pathId);

  return (
    <>
      <Section title="Your path and mascot" defaultOpen={false}>
        <div className="stats">
          <div className="stat stat--row">
            <span className="stat__label">Path</span>
            <span className="stat__value">{path?.name ?? 'Not chosen yet'}</span>
          </div>
          <div className="stat stat--row">
            <span className="stat__label">Starting stage</span>
            <span className="stat__value">{FITNESS_STAGE_LABELS[state.fitnessStage]}</span>
          </div>
          <div className="stat stat--row">
            <span className="stat__label">Level</span>
            <span className="stat__value">
              {state.xp.level} · {state.xp.total} XP
            </span>
          </div>
        </div>

        <SelectField
          label="Switch path"
          hint="You are never locked in. Progress already earned is kept."
          value={state.pathId ?? 'start_moving'}
          options={FITNESS_PATHS.map((entry) => ({ value: entry.id, label: entry.name }))}
          onChange={(pathId) => game.choosePath(pathId)}
        />

        <div className="stats">
          {state.skills.map((skill) => (
            <div className="stat stat--row" key={skill.kind}>
              <span className="stat__label">
                {SKILL_LABELS[skill.kind]}
                {isHighlightedSkill(state.pathId, skill.kind) ? (
                  <span className="stat__flag">focus</span>
                ) : null}
              </span>
              <span className="stat__value">
                Level {skill.level} · {skill.xp} XP
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Trophies" defaultOpen={false}>
        {state.trophies.length === 0 ? (
          <p className="empty">None yet. The first one is not far away.</p>
        ) : (
          <div className="stats">
            {state.trophies.map((unlock) => {
              const trophy = findTrophy(unlock.trophyId);
              return (
                <div className="stat stat--row" key={unlock.trophyId}>
                  <span className="stat__label">
                    <span className={`tier tier--${trophy?.tier ?? 'bronze'}`}>
                      {trophy?.tier ?? 'bronze'}
                    </span>{' '}
                    {trophy?.name ?? unlock.trophyId}
                  </span>
                  <span className="stat__value muted">{unlock.visibility}</span>
                </div>
              );
            })}
          </div>
        )}
        <p className="footnote">
          Trophies are private unless you change that. Nothing about your body is ever
          attached to one.
        </p>
      </Section>

      <Section title="Game settings" defaultOpen={false}>
        <SelectField
          label="Mascot personality"
          value={settings.mascotPersonality}
          options={PERSONALITIES}
          onChange={(mascotPersonality) => game.updateSettings({ mascotPersonality })}
        />
        <Toggle
          label="Sound"
          checked={settings.soundEnabled}
          onChange={(soundEnabled) => game.updateSettings({ soundEnabled })}
        />
        <Toggle
          label="Haptics"
          checked={settings.hapticsEnabled}
          onChange={(hapticsEnabled) => game.updateSettings({ hapticsEnabled })}
        />
        <SelectField
          label="Social mode"
          hint="Not connected to anything yet. Private by default, and health data stays private whatever you pick."
          value={settings.socialMode}
          options={SOCIAL_MODES}
          onChange={(socialMode) => game.updateSettings({ socialMode })}
        />
        <Toggle
          label="Personal challenges"
          checked={settings.challenges.personal}
          onChange={(personal) =>
            game.updateSettings({ challenges: { ...settings.challenges, personal } })
          }
        />
        <Toggle
          label="Friend challenges"
          checked={settings.challenges.friends}
          onChange={(friends) =>
            game.updateSettings({ challenges: { ...settings.challenges, friends } })
          }
        />
        <Toggle
          label="Community challenges"
          checked={settings.challenges.community}
          onChange={(community) =>
            game.updateSettings({ challenges: { ...settings.challenges, community } })
          }
        />
        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={() => {
            restartOnboarding(getAppContext().repository);
            window.location.reload();
          }}
        >
          Run onboarding again
        </button>
        <p className="footnote">
          Rerunning it only reconsiders your path. XP, trophies and everything in the tracker
          are kept.
        </p>
      </Section>
    </>
  );
}
