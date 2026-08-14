import type { ISODate, ISODateTime } from './types';

/**
 * Local-calendar date handling.
 *
 * THE RULE: `Date.prototype.toISOString()` must never be used to derive a day key.
 * It converts to UTC first, so at 00:30 on a British Summer Time morning it reports
 * yesterday. Everything here works from local date components instead.
 *
 * Day arithmetic is anchored at local noon rather than midnight. Midnight does not
 * exist on some daylight-saving transition days in some timezones, whereas noon
 * always does, so noon-anchoring makes `addDays` and `differenceInDays` exact.
 */

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

function pad(value: number, length = 2): string {
  return String(Math.abs(value)).padStart(length, '0');
}

/** Structurally and calendrically valid? Rejects 2026-02-30 and 2026-13-01. */
export function isValidISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, rawYear, rawMonth, rawDay] = match;
  if (rawYear === undefined || rawMonth === undefined || rawDay === undefined) return false;
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const probe = new Date(year, month - 1, day, 12);
  return (
    probe.getFullYear() === year && probe.getMonth() === month - 1 && probe.getDate() === day
  );
}

function assertISODate(value: ISODate): void {
  if (!isValidISODate(value)) {
    throw new Error(`Invalid ISO date: ${JSON.stringify(value)}`);
  }
}

/** The local calendar day of a `Date`. Never goes via UTC. */
export function toISODate(date: Date): ISODate {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local noon on the given day. The anchor used for all day arithmetic. */
export function parseISODate(value: ISODate): Date {
  assertISODate(value);
  const match = ISO_DATE_PATTERN.exec(value);
  const year = Number(match?.[1]);
  const month = Number(match?.[2]);
  const day = Number(match?.[3]);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/** Today, as a local day key. */
export function todayISO(now: Date = new Date()): ISODate {
  return toISODate(now);
}

export function addDays(value: ISODate, days: number): ISODate {
  const anchor = parseISODate(value);
  anchor.setDate(anchor.getDate() + days);
  return toISODate(anchor);
}

export function subtractDays(value: ISODate, days: number): ISODate {
  return addDays(value, -days);
}

/** Whole days from `from` to `to`. Negative when `to` is earlier. */
export function differenceInDays(from: ISODate, to: ISODate): number {
  const start = parseISODate(from).getTime();
  const end = parseISODate(to).getTime();
  return Math.round((end - start) / MS_PER_DAY);
}

/** -1, 0 or 1. Safe to hand to `Array.prototype.sort`. */
export function compareISODate(a: ISODate, b: ISODate): number {
  assertISODate(a);
  assertISODate(b);
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function isSameISODate(a: ISODate, b: ISODate): boolean {
  return compareISODate(a, b) === 0;
}

export function isBeforeISODate(a: ISODate, b: ISODate): boolean {
  return compareISODate(a, b) < 0;
}

export function isAfterISODate(a: ISODate, b: ISODate): boolean {
  return compareISODate(a, b) > 0;
}

/** Inclusive at both ends. */
export function isWithinRange(value: ISODate, from: ISODate, to: ISODate): boolean {
  return compareISODate(value, from) >= 0 && compareISODate(value, to) <= 0;
}

/** Inclusive range of day keys. Returns [] if `to` precedes `from`. */
export function datesBetween(from: ISODate, to: ISODate): ISODate[] {
  const span = differenceInDays(from, to);
  if (span < 0) return [];
  const days: ISODate[] = [];
  for (let offset = 0; offset <= span; offset += 1) {
    days.push(addDays(from, offset));
  }
  return days;
}

function formatOffset(date: Date): string {
  // getTimezoneOffset is minutes BEHIND UTC, so the sign is inverted.
  const totalMinutes = -date.getTimezoneOffset();
  const sign = totalMinutes < 0 ? '-' : '+';
  const hours = Math.floor(Math.abs(totalMinutes) / 60);
  const minutes = Math.abs(totalMinutes) % 60;
  return `${sign}${pad(hours)}:${pad(minutes)}`;
}

/**
 * Full local timestamp with an explicit offset, e.g. 2026-08-13T20:04:00.000+01:00.
 * The offset is always written out (never "Z") so exports stay unambiguous.
 */
export function toISODateTime(date: Date = new Date()): ISODateTime {
  const time =
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `.${pad(date.getMilliseconds(), 3)}`;
  return `${toISODate(date)}T${time}${formatOffset(date)}`;
}

/** Convenience alias for the current timestamp. */
export function nowTimestamp(now: Date = new Date()): ISODateTime {
  return toISODateTime(now);
}

/** The day part of a timestamp, without reparsing it as a UTC instant. */
export function isoDateFromTimestamp(value: ISODateTime): ISODate {
  const day = value.slice(0, 10);
  assertISODate(day);
  return day;
}

export function isValidISODateTime(value: unknown): value is ISODateTime {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?([+-]\d{2}:\d{2}|Z)$/.test(value)) {
    return false;
  }
  return isValidISODate(value.slice(0, 10)) && !Number.isNaN(Date.parse(value));
}

/**
 * Age in whole years, approximate because only a birth year is stored.
 * Off by up to one year depending on whether the birthday has passed.
 */
export function approximateAgeYears(birthYear: number, onDate: ISODate): number {
  assertISODate(onDate);
  return Number(onDate.slice(0, 4)) - birthYear;
}
