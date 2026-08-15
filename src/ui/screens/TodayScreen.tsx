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
import { QuickCheckIn } from '../components/QuickCheckIn';
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

/**
 * The one action the plan card offers.
 *
 * There is exactly one, and it always points at the FIRST thing still to do. If that
 * activity has a video it opens it, because that is a real thing the app can do; if
 * it does not, the button ticks that single activity off.
 *
 * Deliberately per-activity, never per-session. A "mark the session complete" button
 * was proposed once before and rejected: ticking three things at once loses the
 * information that only one of them happened, and partial completion is supposed to
 * count for something here.
 */
function primaryAction(
  activities: readonly PlannedActivity[],
  isDone: (id: string) => boolean,
): { activity: PlannedActivity } | undefined {
  const next = activities.find((activity) => !isDone(activity.id));
  return next === undefined ? undefined : { activity: next };
}

/** Total planned minutes, shown as one number rather than three hints. */
function totalMinutes(activities: readonly PlannedActivity[]): number {
  return activities.reduce((sum, activity) => sum + activity.durationMinutes, 0);
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

  const nextUp = primaryAction(view.activities, (id) => isActivityCompleted(log, id));
  const plannedMinutes = totalMinutes(view.activities);
  const activeDays = game.facts.activeDays.length;

  return (
    <Screen title="Today" subtitle={formatLongDate(date)}>
      {/*
        PHASE 6 ORDER. Context, then companion, then the plan - and the plan is the
        hero. This used to open with the game card, which meant the first and largest
        thing on the screen answered "how am I doing?" before anything answered "what
        am I doing today?". Those two questions are now in the right order.
      */}
      <div className="today__meta">
        <span className="today__programme">
          {view.weekNumber !== undefined && view.dayIndex !== undefined
            ? `Week ${view.weekNumber} · Day ${view.dayIndex}`
            : 'Not started yet'}
        </span>
        <SaveDot indicator={saveIndicator} />
      </div>

      <GameHeader
        state={game.state}
        settings={game.settings}
        granted={game.granted}
        onHatch={game.hatch}
        onEvolve={game.evolve}
      />

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
        <section className="card card--action plan plan--hero">
          <div className="plan__head">
            <h2 className="plan__title">Today&rsquo;s session</h2>
            {/* Duration and intensity as two glanceable facts, not two sentences. */}
            <p className="plan__facts">
              {plannedMinutes > 0 ? <span className="plan__fact">{plannedMinutes} min</span> : null}
              {view.targetEffortMin !== undefined && view.targetEffortMax !== undefined ? (
                <span className="plan__fact">
                  Effort {view.targetEffortMin}&ndash;{view.targetEffortMax}
                </span>
              ) : null}
            </p>
          </div>

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

          {/* Exactly one primary action, always pointing at the next undone thing. */}
          {nextUp !== undefined ? (
            nextUp.activity.externalUrl !== undefined ? (
              <a
                className="btn btn--primary btn--block plan__cta"
                href={nextUp.activity.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Start {nextUp.activity.label}
              </a>
            ) : (
              <button
                type="button"
                className="btn btn--primary btn--block plan__cta"
                onClick={() => update(toggleActivityCompletion(log, nextUp.activity.id, true))}
              >
                Mark {nextUp.activity.label} done
              </button>
            )
          ) : null}

          <p className="plan__status">{completionText(sessionCompletion)}</p>
          {view.targetEffortMin !== undefined ? (
            <p className="plan__hint">Gentle is the point.</p>
          ) : null}
        </section>
      ) : null}

      {/*
        Rest is a planned day, so it gets the hero treatment and a real primary action
        of its own. Every benchmark treats a rest day as an empty state; here it is
        something you can complete, because the programme asked for it.
      */}
      {view.status === 'rest' ? (
        <section className="card card--action plan plan--hero plan--rest">
          <div className="plan__head">
            <h2 className="plan__title">Rest day</h2>
            <p className="plan__facts">
              <span className="plan__fact">Planned</span>
            </p>
          </div>
          <p className="plan__rest">Recovery is part of the programme.</p>

          {exercise?.restDayAcknowledged !== true ? (
            <button
              type="button"
              className="btn btn--primary btn--block plan__cta"
              onClick={() => update(acknowledgeRestDay(true))}
            >
              I rested today
            </button>
          ) : (
            <p className="plan__status">Rest day done.</p>
          )}

          <div className="plan__complete">
            {exercise?.restDayAcknowledged === true ? (
              <Toggle
                label="I followed today&rsquo;s rest day"
                hint="Resting is the plan today."
                checked={exercise?.restDayAcknowledged}
                onChange={(checked) => update(acknowledgeRestDay(checked))}
              />
            ) : null}
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

      {/* --- Quick check-in ------------------------------------------------- */}

      <QuickCheckIn log={log} onChange={update} />

      {/* --- How it went --------------------------------------------------- */}

      {/*
        Everything below is closed by default from Phase 6 on. Open sections turned
        Today into a page of forms, which is the "wall of metrics" the benchmark
        warned about. Each header now carries its own value, so closed still answers
        the question - it just stops shouting it.
      */}
      <Section
        title="How did it go?"
        defaultOpen={false}
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
        defaultOpen={false}
        summary={
          hasSymptomFlag(log)
            ? 'Change recorded'
            : symptoms?.backPainAfter !== undefined
              ? `Pain ${symptoms.backPainAfter}/10`
              : undefined
        }
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

      <Section
        title="Today&rsquo;s food target"
        defaultOpen={false}
        summary={
          nutrition?.fruitVegServings !== undefined
            ? `${nutrition.fruitVegServings} servings`
            : undefined
        }
      >
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
        defaultOpen={false}
        summary={
          hydration?.glasses !== undefined ? `${hydration.glasses} glasses` : undefined
        }
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

      <Section
        title="Sleep and recovery"
        defaultOpen={false}
        summary={recovery?.sleepHours !== undefined ? `${recovery.sleepHours} hours` : undefined}
      >
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

      {/*
        One insight, not a dashboard. It counts distinct days with something completed,
        which is the number this product is actually about - showing up - rather than
        how much of a form has been filled in.
      */}
      <p className="today__insight">
        {activeDays === 0
          ? 'Your first active day starts whenever you are ready.'
          : `${activeDays} active ${activeDays === 1 ? 'day' : 'days'} so far.`}
      </p>

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
