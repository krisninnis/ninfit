import { parseISODate } from '../domain/dates';
import type { ISODate } from '../domain/types';

/** Display formatting. Presentation only - nothing here is ever stored. */

const LONG_DATE = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const SHORT_DAY = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const DAY_OF_MONTH = new Intl.DateTimeFormat('en-GB', { day: 'numeric' });
const DAY_AND_MONTH = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' });

export function formatLongDate(date: ISODate): string {
  return LONG_DATE.format(parseISODate(date));
}

/** "Thu 13 Aug". */
export function formatShortDay(date: ISODate): string {
  return SHORT_DAY.format(parseISODate(date));
}

/** "13-19 August", or "30 August - 5 September" when the range crosses a month. */
export function formatDateRange(start: ISODate, end: ISODate): string {
  const from = parseISODate(start);
  const to = parseISODate(end);
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  return sameMonth
    ? `${DAY_OF_MONTH.format(from)}–${DAY_AND_MONTH.format(to)}`
    : `${DAY_AND_MONTH.format(from)} – ${DAY_AND_MONTH.format(to)}`;
}

/** Thousands separators, so five-figure step counts stay readable at a glance. */
export function formatCount(value: number): string {
  return new Intl.NumberFormat('en-GB').format(value);
}

/** Sentence case for a stored activity label such as "beginner yoga". */
export function capitalise(text: string): string {
  return text.length === 0 ? text : text[0]!.toUpperCase() + text.slice(1);
}

export function formatActivity(label: string, durationMinutes: number): string {
  return `${capitalise(label)} - ${durationMinutes} min`;
}
