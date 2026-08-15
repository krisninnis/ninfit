import type { DailyLogUpdate } from '../../domain/dailyLog';
import type { DailyLog } from '../../domain/types';
import { formatCount } from '../format';

/**
 * The three numbers worth catching on the way past.
 *
 * WHY THIS EXISTS. Recording a glass of water used to mean scrolling to the Water
 * section, expanding it, finding the stepper and tapping it. The benchmark was blunt
 * about the cost of that: logging friction is the most repeated complaint across the
 * highest-grossing trackers in the category, and the app that wins on it wins by
 * being fast between sets, not by having more fields.
 *
 * So the three most-repeated entries get a one-tap route here, and keep their full
 * detail in the sections below. This is progressive disclosure, not duplication:
 * the same state, reached quickly here and thoroughly there.
 *
 * Water gets plus and minus because it is genuinely a per-tap number. Steps and
 * sleep get a direct field, because typing 3420 is one interaction and a stepper
 * would be hundreds.
 *
 * Nothing here is a target. A blank value reads "not recorded", never "missed".
 */

interface QuickCheckInProps {
  log: DailyLog;
  /** The same partial-update shape the Today screen already speaks. */
  onChange: (patch: DailyLogUpdate) => void;
}

const MAX_GLASSES = 30;

function Readout({ value, unit }: { value: string | undefined; unit?: string }) {
  if (value === undefined) return <span className="checkin__empty">Not recorded</span>;
  return (
    <span className="checkin__value">
      {value}
      {unit !== undefined ? <span className="checkin__unit"> {unit}</span> : null}
    </span>
  );
}

export function QuickCheckIn({ log, onChange }: QuickCheckInProps) {
  const steps = log.exercise?.steps;
  const glasses = log.hydration?.glasses;
  const sleep = log.recovery?.sleepHours;

  const setGlasses = (next: number) => {
    const clamped = Math.max(0, Math.min(MAX_GLASSES, next));
    onChange({ hydration: { glasses: clamped } });
  };

  return (
    <section className="card card--action checkin" aria-labelledby="checkin-title">
      <h2 className="checkin__title" id="checkin-title">
        Quick check-in
      </h2>

      <ul className="checkin__list">
        <li className="checkin__row">
          <label className="checkin__label" htmlFor="checkin-steps">
            Steps
          </label>
          <Readout value={steps === undefined ? undefined : formatCount(steps)} />
          <input
            id="checkin-steps"
            className="checkin__input"
            type="number"
            inputMode="numeric"
            min={0}
            value={steps ?? ''}
            placeholder="—"
            onChange={(event) => {
              const raw = event.target.value;
              onChange({
                exercise: { steps: raw === '' ? undefined : Math.max(0, Number(raw)) },
              });
            }}
          />
        </li>

        <li className="checkin__row">
          <span className="checkin__label" id="checkin-water">
            Water
          </span>
          <Readout value={glasses === undefined ? undefined : String(glasses)} unit="glasses" />
          <span className="checkin__pair">
            <button
              type="button"
              className="checkin__step"
              aria-label="One glass fewer"
              disabled={(glasses ?? 0) <= 0}
              onClick={() => setGlasses((glasses ?? 0) - 1)}
            >
              <span aria-hidden="true">&minus;</span>
            </button>
            <button
              type="button"
              className="checkin__step"
              aria-label="One glass more"
              onClick={() => setGlasses((glasses ?? 0) + 1)}
            >
              <span aria-hidden="true">+</span>
            </button>
          </span>
        </li>

        <li className="checkin__row">
          <label className="checkin__label" htmlFor="checkin-sleep">
            Sleep
          </label>
          <Readout value={sleep === undefined ? undefined : String(sleep)} unit="hours" />
          <input
            id="checkin-sleep"
            className="checkin__input"
            type="number"
            inputMode="decimal"
            step={0.5}
            min={0}
            max={16}
            value={sleep ?? ''}
            placeholder="—"
            onChange={(event) => {
              const raw = event.target.value;
              onChange({
                recovery: { sleepHours: raw === '' ? undefined : Number(raw) },
              });
            }}
          />
        </li>
      </ul>
    </section>
  );
}
