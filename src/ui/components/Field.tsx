import { useId, useState, type ReactNode } from 'react';

/**
 * The small set of mobile controls the Today screen is built from.
 *
 * Shared rules across all of them:
 *   - Nothing is required, so nothing has a validation or error state.
 *   - "Not recorded" is a first-class, unremarkable value, and every control that can
 *     hold a number can be cleared back to it.
 *   - Tap targets are at least 44px, and no control needs two hands.
 */

// --- Section ---------------------------------------------------------------

interface SectionProps {
  title: string;
  /** Shown next to the title when collapsed, so the section can be read at a glance. */
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function Section({ title, summary, defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section className="card section">
      <button
        type="button"
        className="section__header"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="section__title">{title}</span>
        {summary !== undefined ? <span className="section__summary">{summary}</span> : null}
        <span className={`section__chevron${open ? ' section__chevron--open' : ''}`} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>
      {open ? (
        <div className="section__body" id={contentId}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

// --- Toggle ----------------------------------------------------------------

interface ToggleProps {
  label: string;
  hint?: string;
  checked: boolean | undefined;
  onChange: (checked: boolean) => void;
}

/** A large tick row. An unticked box is simply not-yet-done, never a failure. */
export function Toggle({ label, hint, checked, onChange }: ToggleProps) {
  return (
    <label className="toggle">
      <input
        type="checkbox"
        className="toggle__input"
        checked={checked === true}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle__box" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <span className="toggle__text">
        <span className="toggle__label">{label}</span>
        {hint !== undefined ? <span className="toggle__hint">{hint}</span> : null}
      </span>
    </label>
  );
}

// --- Stepper ---------------------------------------------------------------

interface StepperProps {
  label: string;
  hint?: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  step?: number;
  min?: number;
  max?: number;
  /** Rendered after the number, e.g. "glasses". */
  unit?: string;
  decimals?: number;
}

/** Minus, value, plus. No typing, one thumb. */
export function Stepper({
  label,
  hint,
  value,
  onChange,
  step = 1,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  unit,
  decimals = 0,
}: StepperProps) {
  const current = value ?? 0;
  const shift = (delta: number) => {
    const next = Math.min(max, Math.max(min, Number((current + delta).toFixed(decimals + 2))));
    onChange(next);
  };

  return (
    <div className="control">
      <div className="control__head">
        <span className="control__label">{label}</span>
        {value !== undefined ? (
          <button type="button" className="control__clear" onClick={() => onChange(undefined)}>
            Clear
          </button>
        ) : null}
      </div>
      {hint !== undefined ? <p className="control__hint">{hint}</p> : null}
      <div className="stepper">
        <button
          type="button"
          className="stepper__button"
          onClick={() => shift(-step)}
          disabled={value !== undefined && current <= min}
          aria-label={`Decrease ${label}`}
        >
          &minus;
        </button>
        <span className="stepper__value">
          {value === undefined ? (
            <span className="stepper__empty">Not recorded</span>
          ) : (
            <>
              <strong>{value.toFixed(decimals)}</strong>
              {unit !== undefined ? <span className="stepper__unit">{unit}</span> : null}
            </>
          )}
        </span>
        <button
          type="button"
          className="stepper__button"
          onClick={() => shift(step)}
          disabled={value !== undefined && current >= max}
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

// --- Scale (0-10 / 1-10) ---------------------------------------------------

interface ScaleProps {
  label: string;
  hint?: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min?: number;
  max?: number;
  /** Optional words at each end, e.g. "none" and "severe". */
  lowLabel?: string;
  highLabel?: string;
}

/**
 * A slider rather than eleven chips: at 390px, eleven tap targets would be about 28px
 * each, well under the 44px minimum. The readout stays large and the value is only
 * recorded once the slider is actually moved.
 */
export function Scale({
  label,
  hint,
  value,
  onChange,
  min = 0,
  max = 10,
  lowLabel,
  highLabel,
}: ScaleProps) {
  const midpoint = Math.round((min + max) / 2);

  return (
    <div className="control">
      <div className="control__head">
        <span className="control__label">{label}</span>
        <span className="control__value">
          {value === undefined ? (
            <span className="control__empty">Not recorded</span>
          ) : (
            <strong>{value}</strong>
          )}
        </span>
      </div>
      {hint !== undefined ? <p className="control__hint">{hint}</p> : null}
      <input
        type="range"
        className={`scale${value === undefined ? ' scale--unset' : ''}`}
        min={min}
        max={max}
        step={1}
        value={value ?? midpoint}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
        aria-valuetext={value === undefined ? 'Not recorded' : String(value)}
      />
      <div className="scale__ends">
        <span>{lowLabel ?? min}</span>
        {value !== undefined ? (
          <button type="button" className="control__clear" onClick={() => onChange(undefined)}>
            Clear
          </button>
        ) : null}
        <span>{highLabel ?? max}</span>
      </div>
    </div>
  );
}

// --- Segmented choice ------------------------------------------------------

interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  /** Draws attention without alarm. Used only for a recorded symptom change. */
  flagged?: boolean;
}

interface ChoiceProps<T extends string> {
  label: string;
  hint?: string;
  options: readonly ChoiceOption<T>[];
  value: T | undefined;
  onChange: (value: T | undefined) => void;
}

/** Tapping the selected option again clears it, so a mis-tap is one tap to undo. */
export function Choice<T extends string>({ label, hint, options, value, onChange }: ChoiceProps<T>) {
  return (
    <div className="control">
      <div className="control__head">
        <span className="control__label">{label}</span>
      </div>
      {hint !== undefined ? <p className="control__hint">{hint}</p> : null}
      <div className="choice" role="group" aria-label={label}>
        {options.map((option) => {
          const selected = option.value === value;
          const flagged = selected && option.flagged === true;
          return (
            <button
              key={option.value}
              type="button"
              className={`choice__option${selected ? ' choice__option--selected' : ''}${
                flagged ? ' choice__option--flagged' : ''
              }`}
              aria-pressed={selected}
              onClick={() => onChange(selected ? undefined : option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- Number field ----------------------------------------------------------

interface NumberFieldProps {
  label: string;
  hint?: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  unit?: string;
  placeholder?: string;
  min?: number;
  max?: number;
}

/** For the few values that genuinely need typing. Numeric keypad, never a spinner. */
export function NumberField({
  label,
  hint,
  value,
  onChange,
  unit,
  placeholder,
  min,
  max,
}: NumberFieldProps) {
  const id = useId();

  return (
    <div className="control">
      <div className="control__head">
        <label className="control__label" htmlFor={id}>
          {label}
        </label>
        {value !== undefined ? (
          <button type="button" className="control__clear" onClick={() => onChange(undefined)}>
            Clear
          </button>
        ) : null}
      </div>
      {hint !== undefined ? <p className="control__hint">{hint}</p> : null}
      <div className="numberfield">
        <input
          id={id}
          className="numberfield__input"
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value ?? ''}
          placeholder={placeholder ?? 'Not recorded'}
          min={min}
          max={max}
          onChange={(event) => {
            const raw = event.target.value;
            // An emptied field means "not recorded", not zero.
            if (raw.trim() === '') return onChange(undefined);
            const parsed = Number(raw);
            onChange(Number.isFinite(parsed) ? parsed : undefined);
          }}
        />
        {unit !== undefined ? <span className="numberfield__unit">{unit}</span> : null}
      </div>
    </div>
  );
}

// --- Text ------------------------------------------------------------------

interface TextFieldProps {
  label: string;
  hint?: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
}

export function TextField({ label, hint, value, onChange, placeholder }: TextFieldProps) {
  const id = useId();
  return (
    <div className="control">
      <label className="control__label" htmlFor={id}>
        {label}
      </label>
      {hint !== undefined ? <p className="control__hint">{hint}</p> : null}
      <div className="numberfield">
        <input
          id={id}
          className="numberfield__input"
          type="text"
          value={value ?? ''}
          placeholder={placeholder ?? 'Not set'}
          onChange={(event) => {
            const raw = event.target.value;
            onChange(raw.trim() === '' ? undefined : raw);
          }}
        />
      </div>
    </div>
  );
}

// --- Select ----------------------------------------------------------------

interface SelectFieldProps<T extends string> {
  label: string;
  hint?: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}

/** A native select: familiar, accessible, and one tap on a phone. */
export function SelectField<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: SelectFieldProps<T>) {
  const id = useId();
  return (
    <div className="control">
      <label className="control__label" htmlFor={id}>
        {label}
      </label>
      {hint !== undefined ? <p className="control__hint">{hint}</p> : null}
      <div className="numberfield">
        <select
          id={id}
          className="numberfield__input"
          value={value}
          onChange={(event) => onChange(event.target.value as T)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// --- Date ------------------------------------------------------------------

interface DateFieldProps {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}

export function DateField({ label, hint, value, onChange }: DateFieldProps) {
  const id = useId();
  return (
    <div className="control">
      <label className="control__label" htmlFor={id}>
        {label}
      </label>
      {hint !== undefined ? <p className="control__hint">{hint}</p> : null}
      <div className="numberfield">
        <input
          id={id}
          className="numberfield__input"
          type="date"
          value={value}
          onChange={(event) => {
            if (event.target.value !== '') onChange(event.target.value);
          }}
        />
      </div>
    </div>
  );
}

// --- Note ------------------------------------------------------------------

interface NoteFieldProps {
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
}

/** Hidden behind a tap, because most days do not need one. */
export function NoteField({ label, value, onChange, placeholder }: NoteFieldProps) {
  const [open, setOpen] = useState(() => value !== undefined && value.length > 0);
  const id = useId();

  if (!open) {
    return (
      <button type="button" className="note__open" onClick={() => setOpen(true)}>
        + {label}
      </button>
    );
  }

  return (
    <div className="control">
      <label className="control__label" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        className="note__input"
        rows={3}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(event) => {
          const raw = event.target.value;
          onChange(raw.trim() === '' ? undefined : raw);
        }}
      />
    </div>
  );
}
