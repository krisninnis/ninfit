import type { DayState, WeekDay, WeekSummary } from '../../domain/week';
import { Section } from '../components/Field';
import { AttentionIcon } from '../components/Icon';
import { Screen } from '../components/Screen';
import { capitalise, formatCount, formatDateRange, formatShortDay } from '../format';
import { useWeek } from '../hooks/useWeek';

/**
 * A weekly journal, not a scorecard.
 *
 * Everything on this screen is either the programme as planned or something the user
 * recorded. Nothing is scored, ranked or expressed as a percentage of a target, and a
 * day with nothing in it simply says so.
 */

const NOT_RECORDED = 'Not recorded';

/** Calm, factual wording for each state. Nothing here implies a shortfall. */
function stateLabel(day: WeekDay): string | undefined {
  switch (day.state) {
    case 'rest':
      return 'Rest day';
    case 'complete':
      return 'Done';
    case 'partial':
      return `${day.completion.completedCount} of ${day.completion.plannedCount} done`;
    case 'future':
      return 'To come';
    case 'unplanned':
      return 'No plan';
    default:
      return undefined;
  }
}

function DayCard({ day }: { day: WeekDay }) {
  const label = stateLabel(day);
  const facts: string[] = [];

  if (day.recordedMinutes !== undefined) facts.push(`${day.recordedMinutes} min`);
  if (day.steps !== undefined) facts.push(`${formatCount(day.steps)} steps`);
  if (day.glasses !== undefined) facts.push(`${day.glasses} glasses`);
  if (day.morningFruit === true) facts.push('Fruit before midday');

  return (
    <li className={`card weekday weekday--${day.state}${day.isToday ? ' weekday--today' : ''}`}>
      <div className="weekday__head">
        <span className="weekday__index">Day {day.dayIndex}</span>
        <span className="weekday__date">{formatShortDay(day.date)}</span>
        {day.isToday ? <span className="weekday__today">Today</span> : null}
        {label !== undefined ? <span className="weekday__state">{label}</span> : null}
      </div>

      {day.state === 'rest' ? (
        <p className="weekday__rest">Recovery is part of the programme.</p>
      ) : null}

      {day.activities.length > 0 ? (
        <ul className="weekday__activities">
          {day.activities.map(({ activity, completed }) => (
            <li
              key={activity.id}
              className={`weekact${completed ? ' weekact--done' : ''}`}
            >
              <span className="weekact__mark" aria-hidden="true">
                {completed ? '✓' : '○'}
              </span>
              <span className="weekact__label">{capitalise(activity.label)}</span>
              <span className="weekact__duration">{activity.durationMinutes} min</span>
            </li>
          ))}
        </ul>
      ) : null}

      {day.restDayAcknowledged ? (
        <p className="weekday__note">You followed the rest day.</p>
      ) : null}

      {day.unplannedRestDayActivity ? (
        <p className="weekday__note">You recorded some activity on this rest day.</p>
      ) : null}

      {facts.length > 0 ? <p className="weekday__facts">{facts.join(' · ')}</p> : null}

      {day.symptomFlags.includes('toe_sensation_worse') ? (
        <p className="attention-note weekday__flag">
          <AttentionIcon />
          Toe sensation recorded as worse
        </p>
      ) : null}
    </li>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat stat--row">
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
    </div>
  );
}

function StepsChart({ days }: { days: WeekDay[] }) {
  const recorded = days.filter((day) => day.steps !== undefined);
  if (recorded.length === 0) {
    return <p className="empty">Nothing recorded yet.</p>;
  }

  // Scaled against the best day so far, purely so the bars are legible.
  const highest = Math.max(...recorded.map((day) => day.steps ?? 0), 1);

  return (
    <div className="bars">
      {days.map((day) => {
        const value = day.steps;
        return (
          <div className="bars__row" key={day.date}>
            <span className="bars__label">Day {day.dayIndex}</span>
            <span className="bars__track">
              {value !== undefined ? (
                <span
                  className="bars__fill"
                  style={{ width: `${Math.max(2, (value / highest) * 100)}%` }}
                />
              ) : null}
            </span>
            <span className="bars__value">
              {value === undefined ? <span className="muted">—</span> : formatCount(value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function nutritionState(value: boolean | undefined): string {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return '—';
}

function summaryLines(summary: WeekSummary): Array<[string, string]> {
  return [
    [
      'Minutes recorded',
      summary.exerciseMinutes === undefined ? NOT_RECORDED : `${summary.exerciseMinutes} min`,
    ],
    [
      'Activities completed',
      `${summary.completedActivities} of ${summary.plannedActivities}`,
    ],
    ['Sessions fully done', String(summary.completeSessions)],
    ...(summary.partialSessions > 0
      ? ([['Partly done', String(summary.partialSessions)]] as Array<[string, string]>)
      : []),
    [
      'Average steps',
      summary.averageSteps === undefined
        ? 'Not enough data yet'
        : `${formatCount(summary.averageSteps)} over ${summary.stepDaysRecorded} day${
            summary.stepDaysRecorded === 1 ? '' : 's'
          }`,
    ],
    [
      'Average effort',
      summary.averageEffort === undefined ? 'Not enough data yet' : `${summary.averageEffort} / 10`,
    ],
  ];
}

export function WeekScreen() {
  const { week, beforeProgramme } = useWeek();
  const { summary, days } = week;

  return (
    <Screen
      title={`Week ${week.weekNumber}`}
      subtitle={formatDateRange(week.startDate, week.endDate)}
    >
      <p className="week__intro">
        {beforeProgramme
          ? 'Your programme has not started yet. Here is what week 1 holds.'
          : week.weekNumber === 1
            ? 'Your first week is about consistency and seeing how your body responds.'
            : 'A rolling seven days from your programme start date.'}
      </p>

      {!week.hasPlan ? (
        <section className="card">
          <p className="empty">
            There is no plan for this week yet. Anything you record still appears below.
          </p>
        </section>
      ) : null}

      <ul className="week__days">
        {days.map((day) => (
          <DayCard key={day.date} day={day} />
        ))}
      </ul>

      <Section title="This week so far">
        {summary.daysLogged === 0 ? (
          <p className="empty">Nothing recorded yet.</p>
        ) : (
          <div className="stats">
            {summaryLines(summary).map(([label, value]) => (
              <SummaryRow key={label} label={label} value={value} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Steps">
        <StepsChart days={days} />
      </Section>

      <Section title="Back and symptoms">
        {days.every((day) => day.backPainBefore === undefined && day.backPainAfter === undefined) ? (
          <p className="empty">Nothing recorded yet.</p>
        ) : (
          <div className="stats">
            {days.map((day) => (
              <div className="stat stat--row" key={day.date}>
                <span className="stat__label">
                  Day {day.dayIndex}
                  {day.symptomFlags.includes('toe_sensation_worse') ? (
                    <span className="attention-chip">
                      <AttentionIcon />toe worse
                    </span>
                  ) : null}
                  {day.symptomFlags.includes('leg_pain') ? (
                    <span className="attention-chip">
                      <AttentionIcon />leg pain
                    </span>
                  ) : null}
                </span>
                <span className="stat__value">
                  {day.backPainBefore === undefined && day.backPainAfter === undefined ? (
                    <span className="muted">—</span>
                  ) : (
                    <>
                      {day.backPainBefore ?? '—'} <span className="muted">to</span>{' '}
                      {day.backPainAfter ?? '—'}
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="footnote">Before and after exercise, as you recorded them.</p>
      </Section>

      <Section title="Food and water" defaultOpen={false}>
        <div className="stats">
          {days.map((day) => (
            <div className="stat stat--row" key={day.date}>
              <span className="stat__label">Day {day.dayIndex}</span>
              <span className="stat__value">
                <span className="muted">fruit</span> {nutritionState(day.morningFruit)}
                {'  '}
                <span className="muted">water</span>{' '}
                {day.glasses === undefined ? '—' : day.glasses}
              </span>
            </div>
          ))}
        </div>
        <p className="footnote">
          Water usually lands somewhere around 6–8 glasses. It is a rough guide, not a target.
        </p>
      </Section>

      <Section title="Sleep and recovery" defaultOpen={false}>
        {summary.averageSleepHours === undefined &&
        summary.averageEnergy === undefined &&
        summary.averageRestingHeartRateBpm === undefined &&
        summary.averageHrvMs === undefined ? (
          <p className="empty">Nothing recorded yet.</p>
        ) : (
          <div className="stats">
            <SummaryRow
              label="Average sleep"
              value={
                summary.averageSleepHours === undefined
                  ? NOT_RECORDED
                  : `${summary.averageSleepHours} hours`
              }
            />
            <SummaryRow
              label="Average energy"
              value={
                summary.averageEnergy === undefined ? NOT_RECORDED : `${summary.averageEnergy} / 10`
              }
            />
            <SummaryRow
              label="Average resting heart rate"
              value={
                summary.averageRestingHeartRateBpm === undefined
                  ? NOT_RECORDED
                  : `${summary.averageRestingHeartRateBpm} bpm`
              }
            />
            <SummaryRow
              label="Average HRV"
              value={summary.averageHrvMs === undefined ? NOT_RECORDED : `${summary.averageHrvMs} ms`}
            />
          </div>
        )}
        <p className="footnote">Your own recorded numbers, nothing more.</p>
      </Section>

      <p className="today__disclaimer">A personal record, not a medical assessment.</p>
    </Screen>
  );
}

export type { DayState };
