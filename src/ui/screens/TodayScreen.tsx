import { useEffect } from 'react';
import {
  acknowledgeRestDay,
  hasSymptomFlag,
  isActivityCompleted,
  toggleActivityCompletion,
} from '../../domain/dailyLog';
import { GameHeader } from '../components/GameHeader';
import { useGame } from '../hooks/useGame';
import { todaySessionCompletion } from '../../domain/today';
import type { SessionCompletion } from '../../domain/weeklyPlan';
import type { PlannedActivity, SymptomTrend } from '../../domain/types';
import { Choice, NoteField, NumberField, Scale, Section, Stepper, Toggle } from '../components/Field';
import { AttentionIcon } from '../components/Icon';
import { Screen } from '../components/Screen';
import { capitalise, formatCount, formatLongDate } from '../format';
import { useToday, type SaveIndicator } from '../hooks/useToday';

/** A rough guide, not a target and certainly not a medical requirement. */
const HYDRATION_GUIDE_LOW = 6;
const HYDRATION_GUIDE_HIGH = 8;

const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const;

const TOE_OPTIONS = [
  { value: 'better', label: 'Better' },
  { value: 'same', label: 'Same' },
  // Flagged so a recorded change is visible. It is a fact on the record, nothing more:
  // the app does not assess it, act on it, or let it affect completion.
  { value: 'worse', label: 'Worse', flagged: true },
] as const;

function SaveDot({ indicator }: { indicator: SaveIndicator }) {
  if (indicator === 'idle') return null;
  const text =
    indicator === 'saved' ? 'Saved' : indicator === 'pending' ? 'Saving' : 'Not saved to this device';
  return (
    <span className={`savedot savedot--${indicator}`} role="status">
      {text}
    </span>
  );
}

interface ActivityRowProps {
  activity: PlannedActivity;
  completed: boolean;
  onToggle: (completed: boolean) => void;
}

/**
 * One planned activity, completable on its own. Ticking the yoga never touches the
 * walk, and neither is affected by anything recorded about symptoms.
 */
function ActivityRow({ activity, completed, onToggle }: ActivityRowProps) {
  return (
    <li className="surface activity">
      <Toggle
        label={capitalise(activity.label)}
        hint={`${activity.durationMinutes} min`}
        checked={completed}
        onChange={onToggle}
      />
      {activity.externalUrl !== undefined ? (
        <a
          className="activity__link"
          href={activity.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span aria-hidden="true">&#9654;</span> Start {activity.type === 'yoga' ? 'yoga ' : ''}video
        </a>
      ) : null}
      {activity.externalUrl !== undefined && activity.externalLabel !== undefined ? (
        <span className="activity__credit">
          Video: {activity.externalLabel}
          {activity.provider === 'youtube' ? ' · YouTube' : ''}
        </span>
      ) : null}
    </li>
  );
}

/** Calm, factual, and never phrased as a shortfall. */
function completionText(completion: SessionCompletion): string {
  switch (completion.status) {
    case 'complete':
      return 'All done for today.';
    case 'partial':
      return `${completion.completedCount} of ${completion.plannedCount} done.`;
    default:
      return 'Tick each one as you go.';
  }
}

export function TodayScreen() {
  const { date, view, log, completion, saveIndicator, isPersistent, isBlocked, update } = useToday();
  const game = useGame();

  // Rewards are derived from what is stored, so the game catches up once a change has
  // actually been written rather than on every keystroke.
  useEffect(() => {
    if (saveIndicator === 'saved') game.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveIndicator]);

  const exercise = log.exercise;
  const symptoms = log.symptoms;
  const nutrition = log.nutrition;
  const hydration = log.hydration;
  const recovery = log.recovery;

  const sessionCompletion = todaySessionCompletion(view, log);
  const glasses = hydration?.glasses ?? 0;
  const hydrationPercent = Math.min(100, (glasses / HYDRATION_GUIDE_HIGH) * 100);

  if (isBlocked) {
    return (
      <Screen title="Today" subtitle={formatLongDate(date)}>
        <section className="card card--attention">
          <AttentionIcon />
          <p>
            This device holds data saved by a newer version of the app, so nothing has been
            changed or opened. Updating the app should sort it out.
          </p>
        </section>
      </Screen>
    );
  }

  return (
    <Screen title="Today" subtitle={formatLongDate(date)}>
      {/* The hook first, then today's plan. The game never buries the workout. */}
      <GameHeader
        state={game.state}
        settings={game.settings}
        granted={game.granted}
        onHatch={game.hatch}
        onEvolve={game.evolve}
      />

      <div className="today__meta">
        <span className="today__programme">
          {view.weekNumber !== undefined && view.dayIndex !== undefined
            ? `Week ${view.weekNumber} · Day ${view.dayIndex}`
            : 'Not started yet'}
        </span>
        <SaveDot indicator={saveIndicator} />
      </div>

      {!isPersistent ? (
        <section className="card card--attention">
          <AttentionIcon />
          <p>
            This browser will not let the app store anything, so today&rsquo;s entries will not be
            here when you come back. Everything on screen still works.
          </p>
        </section>
      ) : null}

      {/* --- The plan ------------------------------------------------------ */}

      {view.status === 'planned' ? (
        <section className="card card--action plan">
          <h2 className="plan__title">Today&rsquo;s session</h2>
          {view.targetEffortMin !== undefined && view.targetEffortMax !== undefined ? (
            <p className="plan__effort">
              Aim for about {view.targetEffortMin}&ndash;{view.targetEffortMax} out of 10 effort. Gentle
              is the point.
            </p>
          ) : null}
          <ul className="plan__activities">
            {view.activities.map((activity) => (
              <ActivityRow
                key={activity.id}
                activity={activity}
                completed={isActivityCompleted(log, activity.id)}
                onToggle={(checked) => update(toggleActivityCompletion(log, activity.id, checked))}
              />
            ))}
          </ul>
          <p className="plan__status">{completionText(sessionCompletion)}</p>
        </section>
      ) : null}

      {view.status === 'rest' ? (
        <section className="card card--action plan plan--rest">
          <h2 className="plan__title">Rest day</h2>
          <p className="plan__rest">Recovery is part of the programme.</p>
          <p className="plan__hint">
            Anything below is still worth recording if you feel like it.
          </p>
          <div className="plan__complete">
            {/* Rest is the planned activity, so this asks whether you followed the
                plan - not whether you exercised. */}
            <Toggle
              label="I followed today&rsquo;s rest day"
              hint="Resting is the plan today."
              checked={exercise?.restDayAcknowledged}
              onChange={(checked) => update(acknowledgeRestDay(checked))}
            />
            <Toggle
              label="I did something active anyway"
              hint="Optional, and entirely separate."
              checked={exercise?.completed}
              onChange={(checked) => update({ exercise: { completed: checked } })}
            />
          </div>
        </section>
      ) : null}

      {view.status === 'before_programme' ? (
        <section className="card card--action plan">
          <h2 className="plan__title">Nothing planned yet</h2>
          <p className="plan__hint">Your programme starts a little later. Today is yours.</p>
        </section>
      ) : null}

      {view.status === 'no_plan' ? (
        <section className="card card--action plan">
          <h2 className="plan__title">No session planned</h2>
          <p className="plan__hint">
            There is no plan for today yet. You can still record anything below.
          </p>
          <div className="plan__complete">
            <Toggle
              label="I did some activity today"
              hint="Optional."
              checked={exercise?.completed}
              onChange={(checked) => update({ exercise: { completed: checked } })}
            />
          </div>
        </section>
      ) : null}

      {/* --- How it went --------------------------------------------------- */}

      <Section
        title="How did it go?"
        summary={
          exercise?.durationMinutes !== undefined ? `${exercise.durationMinutes} min` : undefined
        }
      >
        <Stepper
          label="Time spent"
          value={exercise?.durationMinutes}
          onChange={(value) => update({ exercise: { durationMinutes: value } })}
          step={5}
          max={240}
          unit="min"
        />
        <Scale
          label="Effort"
          hint="How hard it felt, not how hard it should have been."
          value={exercise?.effort}
          onChange={(value) => update({ exercise: { effort: value } })}
          min={1}
          max={10}
          lowLabel="easy"
          highLabel="very hard"
        />
        <NumberField
          label="Steps today"
          hint="Entered by hand for now."
          value={exercise?.steps}
          onChange={(value) => update({ exercise: { steps: value } })}
          min={0}
          placeholder="Not recorded"
        />
        {exercise?.steps !== undefined ? (
          <p className="control__readout">{formatCount(exercise.steps)} steps</p>
        ) : null}
        <NoteField
          label="Note about the session"
          value={exercise?.notes}
          onChange={(value) => update({ exercise: { notes: value } })}
          placeholder="Anything worth remembering."
        />
      </Section>

      {/* --- Back and symptoms --------------------------------------------- */}

      <Section
        title="How is your back?"
        summary={hasSymptomFlag(log) ? 'Change recorded' : undefined}
      >
        <Scale
          label="Back pain before"
          value={symptoms?.backPainBefore}
          onChange={(value) => update({ symptoms: { backPainBefore: value } })}
          lowLabel="none"
          highLabel="severe"
        />
        <Scale
          label="Back pain after"
          value={symptoms?.backPainAfter}
          onChange={(value) => update({ symptoms: { backPainAfter: value } })}
          lowLabel="none"
          highLabel="severe"
        />
        <Choice
          label="Leg pain"
          options={YES_NO}
          value={symptoms?.legPain === undefined ? undefined : symptoms.legPain ? 'yes' : 'no'}
          onChange={(value) =>
            update({ symptoms: { legPain: value === undefined ? undefined : value === 'yes' } })
          }
        />
        <Choice<SymptomTrend>
          label="Toe numbness or tingling"
          options={TOE_OPTIONS}
          value={symptoms?.toeSensation}
          onChange={(value) => update({ symptoms: { toeSensation: value } })}
        />
        {symptoms?.toeSensation === 'worse' ? (
          <p className="attention-note">
            <AttentionIcon />
            Recorded as worse today.
          </p>
        ) : null}
        <NoteField
          label="Note about symptoms"
          value={symptoms?.notes}
          onChange={(value) => update({ symptoms: { notes: value } })}
          placeholder="In your own words."
        />
      </Section>

      {/* --- Food ----------------------------------------------------------- */}

      <Section title="Today&rsquo;s food target">
        <Toggle
          label="Fruit before midday"
          checked={nutrition?.morningFruit}
          onChange={(checked) => update({ nutrition: { morningFruit: checked } })}
        />
        <Toggle
          label="Main meal with protein"
          checked={nutrition?.proteinMainMeal}
          onChange={(checked) => update({ nutrition: { proteinMainMeal: checked } })}
        />
        <Toggle
          label="Gousto meal"
          checked={nutrition?.goustoMeal}
          onChange={(checked) => update({ nutrition: { goustoMeal: checked } })}
        />
        <Stepper
          label="Fruit and veg"
          value={nutrition?.fruitVegServings}
          onChange={(value) => update({ nutrition: { fruitVegServings: value } })}
          max={20}
          unit="servings"
        />
        <NoteField
          label="Snacks or chocolate"
          value={nutrition?.snackNote}
          onChange={(value) => update({ nutrition: { snackNote: value } })}
          placeholder="Just a note. No counting."
        />
      </Section>

      {/* --- Water ---------------------------------------------------------- */}

      <Section
        title="Water"
        summary={hydration?.glasses !== undefined ? `${hydration.glasses}` : undefined}
      >
        <Stepper
          label="Glasses or cups"
          hint={`Most days land somewhere around ${HYDRATION_GUIDE_LOW}–${HYDRATION_GUIDE_HIGH}. It is a rough guide, not a target.`}
          value={hydration?.glasses}
          onChange={(value) => update({ hydration: { glasses: value } })}
          max={30}
        />
        <div
          className="hydration"
          role="img"
          aria-label={`${glasses} glasses recorded`}
        >
          <div className="hydration__fill" style={{ width: `${hydrationPercent}%` }} />
        </div>
        <NoteField
          label="Other drinks"
          value={hydration?.extraFluidNote}
          onChange={(value) => update({ hydration: { extraFluidNote: value } })}
          placeholder="Tea, squash, anything else."
        />
      </Section>

      {/* --- Recovery -------------------------------------------------------- */}

      <Section title="Sleep and recovery" defaultOpen={false}>
        <Stepper
          label="Sleep"
          value={recovery?.sleepHours}
          onChange={(value) => update({ recovery: { sleepHours: value } })}
          step={0.5}
          max={16}
          unit="hours"
          decimals={1}
        />
        <Scale
          label="Energy"
          value={recovery?.energy}
          onChange={(value) => update({ recovery: { energy: value } })}
          min={1}
          max={10}
          lowLabel="flat"
          highLabel="good"
        />
        <NumberField
          label="Resting heart rate"
          value={recovery?.restingHeartRateBpm}
          onChange={(value) => update({ recovery: { restingHeartRateBpm: value } })}
          unit="bpm"
          min={20}
          max={220}
        />
        <NumberField
          label="HRV"
          value={recovery?.hrvMs}
          onChange={(value) => update({ recovery: { hrvMs: value } })}
          unit="ms"
          min={0}
          max={300}
        />
        <NoteField
          label="Note about how you slept"
          value={recovery?.notes}
          onChange={(value) => update({ recovery: { notes: value } })}
        />
      </Section>

      <p className="today__footer">
        {completion.filled === 0
          ? 'Nothing recorded yet today.'
          : `${completion.filled} of ${completion.total} sections recorded.`}
      </p>
      <p className="today__disclaimer">
        A personal record, not a medical assessment.
      </p>
    </Screen>
  );
}
