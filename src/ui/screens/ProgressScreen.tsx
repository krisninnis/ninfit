import { MIN_SPAN } from '../../domain/chartScale';
import type { MetricSeries, ProgressRangeId, ProgressSummary } from '../../domain/progress';
import type { DisplayUnitPreferences } from '../../domain/types';
import { formatLength, formatWeight, roundTo } from '../../domain/units';
import { Section } from '../components/Field';
import { AttentionIcon } from '../components/Icon';
import { Screen } from '../components/Screen';
import { Sparkline } from '../components/Sparkline';
import { formatCount, formatShortDay } from '../format';
import { useProgress } from '../hooks/useProgress';

/**
 * Trends against the user's own recorded history.
 *
 * Every number here is either something they entered or a plain count of those
 * entries. There is no score, no target, no population comparison, and no judgement
 * of what any value means. Where there is not enough data, the screen says so rather
 * than filling the gap.
 */

const NOT_ENOUGH = 'Not enough data yet';
const NONE_RECORDED = 'No readings recorded';

const RANGES: ReadonlyArray<{ id: ProgressRangeId; label: string }> = [
  { id: 'week', label: 'This week' },
  { id: 'all', label: 'All time' },
];

function samples(count: number): string {
  return `${count} reading${count === 1 ? '' : 's'}`;
}

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="stat stat--tile">
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
      {note !== undefined ? <span className="stat__meta">{note}</span> : null}
    </div>
  );
}

interface TrendProps {
  label: string;
  series: MetricSeries;
  format: (value: number) => string;
  minSpan: number;
  /** The user's own starting figure, shown for reference only. */
  baseline?: number;
}

/**
 * One metric over time: current value, its relationship to the user's own baseline,
 * a sparkline, and how many readings it rests on. No interpretation of any kind.
 *
 * WHY THE LATEST READING LEADS.
 *
 * This row used to read "<first> to <latest>" at the largest type on the line, which
 * put the oldest figure first and left the reader working out which end was now. On a
 * metric that had moved a long way it read as a headline claim about the movement
 * rather than a statement of where things stand.
 *
 * So the current reading is the value, and the earlier one moves into the meta line
 * as "from X". Nothing is hidden and nothing new is asserted - the same two numbers
 * are on screen, in the order the question "where am I now" actually asks for.
 *
 * The words stay neutral on purpose. "from" describes the series; "up", "down",
 * "better" and "improving" would all be judgements about a body measurement, and
 * this screen does not make those.
 */
function Trend({ label, series, format, minSpan, baseline }: TrendProps) {
  const { first, latest, points } = series;

  if (latest === undefined || first === undefined) {
    return (
      <div className="trend">
        <div className="trend__head">
          <span className="trend__label">{label}</span>
          <span className="trend__empty">{NONE_RECORDED}</span>
        </div>
      </div>
    );
  }

  const changed = points.length > 1 && first.value !== latest.value;

  return (
    <div className="trend">
      <div className="trend__head">
        <span className="trend__label">{label}</span>
        <span className="trend__value">{format(latest.value)}</span>
      </div>
      <Sparkline points={points} scaleOptions={{ minSpan }} label={`${label} over time`} />
      <div className="trend__foot">
        <span className="trend__span">
          {points.length > 1
            ? `${formatShortDay(first.date)} – ${formatShortDay(latest.date)}`
            : formatShortDay(latest.date)}
        </span>
        <span className="trend__meta">
          {changed ? `from ${format(first.value)} · ` : ''}
          {samples(points.length)}
          {baseline !== undefined ? ` · baseline ${format(baseline)}` : ''}
        </span>
      </div>
    </div>
  );
}

function overviewStats(summary: ProgressSummary): Array<[string, string, string | undefined]> {
  return [
    [
      'Average steps',
      summary.averageSteps === undefined ? NOT_ENOUGH : formatCount(summary.averageSteps),
      summary.baselineAverageDailySteps === undefined
        ? undefined
        : `over ${samples(summary.sampleCounts.steps)} · baseline estimate about ${formatCount(
            summary.baselineAverageDailySteps,
          )}`,
    ],
    [
      'Exercise minutes',
      summary.exerciseMinutes === undefined ? NOT_ENOUGH : `${summary.exerciseMinutes} min`,
      `over ${samples(summary.sampleCounts.exerciseMinutes)}`,
    ],
    [
      'Activities completed',
      String(summary.activity.completedActivities),
      summary.activity.partialSessions > 0
        ? `${summary.activity.completeSessions} full, ${summary.activity.partialSessions} partly done`
        : `${summary.activity.completeSessions} full session${
            summary.activity.completeSessions === 1 ? '' : 's'
          }`,
    ],
    [
      'Average effort',
      summary.averageEffort === undefined ? NOT_ENOUGH : `${summary.averageEffort} / 10`,
      `over ${samples(summary.sampleCounts.effort)}`,
    ],
  ];
}

export function ProgressScreen() {
  const { range, setRange, summary, data, hasStorageIssues } = useProgress();
  const units: DisplayUnitPreferences = data.profile.preferredUnits;
  const { sampleCounts, symptoms } = summary;

  return (
    <Screen title="Progress" subtitle="Your own recorded numbers over time.">
      <div className="rangebar" role="group" aria-label="Time range">
        {RANGES.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`rangebar__option${range === option.id ? ' rangebar__option--selected' : ''}`}
            aria-pressed={range === option.id}
            onClick={() => setRange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {hasStorageIssues ? (
        <section className="card card--attention">
          <AttentionIcon />
          <p>Some stored data could not be read, so parts of this may be incomplete.</p>
        </section>
      ) : null}

      <section className="card">
        <p className="progress__group">Activity</p>
        <div className="statgrid">
          {overviewStats(summary).map(([label, value, note]) => (
            <Stat key={label} label={label} value={value} note={note} />
          ))}
        </div>
        <p className="footnote">
          {summary.daysLogged === 0
            ? 'Nothing recorded in this range yet.'
            : `${summary.daysLogged} day${summary.daysLogged === 1 ? '' : 's'} with something recorded.`}
        </p>
      </section>

      <Section title="Body">
        <Trend
          label="Weight"
          series={summary.weightKg}
          format={(value) => formatWeight(value, units.weight)}
          minSpan={MIN_SPAN.weightKg}
          {...(data.baseline.weightKg !== undefined ? { baseline: data.baseline.weightKg } : {})}
        />
        <Trend
          label="Waist"
          series={summary.waistCm}
          format={(value) => formatLength(value, units.length)}
          minSpan={MIN_SPAN.waistCm}
          {...(data.baseline.waistCm !== undefined ? { baseline: data.baseline.waistCm } : {})}
        />
      </Section>

      <Section title="Heart and recovery">
        <Trend
          label="Resting heart rate"
          series={summary.restingHeartRateBpm}
          format={(value) => `${roundTo(value, 0)} bpm`}
          minSpan={MIN_SPAN.restingHeartRateBpm}
          {...(data.baseline.restingHeartRateBpm !== undefined
            ? { baseline: data.baseline.restingHeartRateBpm }
            : {})}
        />
        <Trend
          label="HRV"
          series={summary.hrvMs}
          format={(value) => `${roundTo(value, 0)} ms`}
          minSpan={MIN_SPAN.hrvMs}
          {...(data.baseline.hrvMs !== undefined ? { baseline: data.baseline.hrvMs } : {})}
        />
        <div className="statgrid">
          <Stat
            label="Average sleep"
            value={
              summary.averageSleepHours === undefined
                ? NOT_ENOUGH
                : `${summary.averageSleepHours} hours`
            }
            note={`over ${samples(sampleCounts.sleep)}`}
          />
          <Stat
            label="Average energy"
            value={summary.averageEnergy === undefined ? NOT_ENOUGH : `${summary.averageEnergy} / 10`}
            note={`your own rating, over ${samples(sampleCounts.energy)}`}
          />
        </div>
        <p className="footnote">
          Recorded values only. Nothing here is assessed or scored.
        </p>
      </Section>

      <Section title="Back and symptoms">
        <div className="statgrid">
          <Stat
            label="Average back pain"
            value={
              summary.averageBackPain === undefined ? NOT_ENOUGH : `${summary.averageBackPain} / 10`
            }
            note={`over ${samples(sampleCounts.backPain)}`}
          />
          <Stat
            label="Days with leg pain recorded"
            value={String(symptoms.legPainDays)}
            note={`of ${samples(symptoms.daysWithSymptomRecord)}`}
          />
        </div>
        <div className="stats">
          <div className="stat stat--row">
            <span className="stat__label">Toe sensation recorded as better</span>
            <span className="stat__value">{symptoms.toeBetter}</span>
          </div>
          <div className="stat stat--row">
            <span className="stat__label">Recorded as same</span>
            <span className="stat__value">{symptoms.toeSame}</span>
          </div>
          <div className="stat stat--row">
            <span className="stat__label">
              Recorded as worse
              {symptoms.toeWorse > 0 ? <span className="attention-chip">
                <AttentionIcon />noted
              </span> : null}
            </span>
            <span className="stat__value">{symptoms.toeWorse}</span>
          </div>
        </div>
        <p className="footnote">Counts of what you recorded, nothing more.</p>
      </Section>

      <p className="today__disclaimer">A personal record, not a medical assessment.</p>
    </Screen>
  );
}
