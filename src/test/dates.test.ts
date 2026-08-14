import { describe, expect, it } from 'vitest';
import {
  addDays,
  approximateAgeYears,
  compareISODate,
  datesBetween,
  differenceInDays,
  isAfterISODate,
  isBeforeISODate,
  isSameISODate,
  isValidISODate,
  isValidISODateTime,
  isWithinRange,
  isoDateFromTimestamp,
  nowTimestamp,
  parseISODate,
  subtractDays,
  toISODate,
  toISODateTime,
  todayISO,
} from '../domain/dates';

// The suite runs with TZ=Europe/London (set in vite.config.ts).
// British Summer Time in 2026 runs from Sunday 29 March to Sunday 25 October.
const BST_START = '2026-03-29';
const BST_END = '2026-10-25';

describe('toISODate', () => {
  it('reads local calendar components, not UTC', () => {
    expect(toISODate(new Date(2026, 7, 13, 12, 0))).toBe('2026-08-13');
    expect(toISODate(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
    expect(toISODate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });

  it('does not drift backwards in the small hours of a BST morning', () => {
    // 00:30 BST is 23:30 UTC the previous day. This is the exact bug that
    // toISOString() would introduce, so both sides are asserted.
    const earlyMorning = new Date(2026, 7, 13, 0, 30);
    expect(toISODate(earlyMorning)).toBe('2026-08-13');
    expect(earlyMorning.toISOString().slice(0, 10)).toBe('2026-08-12');
  });

  it('handles late evening in winter, when local time equals UTC', () => {
    const lateEvening = new Date(2026, 0, 15, 23, 45);
    expect(toISODate(lateEvening)).toBe('2026-01-15');
  });

  it('pads single-digit months and days', () => {
    expect(toISODate(new Date(2026, 2, 5))).toBe('2026-03-05');
  });
});

describe('todayISO', () => {
  it('returns the local day for the supplied instant', () => {
    expect(todayISO(new Date(2026, 7, 13, 23, 59, 59))).toBe('2026-08-13');
    expect(todayISO(new Date(2026, 7, 14, 0, 0, 1))).toBe('2026-08-14');
  });
});

describe('isValidISODate', () => {
  it('accepts well-formed real dates', () => {
    expect(isValidISODate('2026-08-13')).toBe(true);
    expect(isValidISODate('2028-02-29')).toBe(true); // leap year
  });

  it('rejects malformed or impossible dates', () => {
    expect(isValidISODate('2026-02-30')).toBe(false);
    expect(isValidISODate('2027-02-29')).toBe(false); // not a leap year
    expect(isValidISODate('2026-13-01')).toBe(false);
    expect(isValidISODate('2026-00-10')).toBe(false);
    expect(isValidISODate('2026-8-13')).toBe(false);
    expect(isValidISODate('13/08/2026')).toBe(false);
    expect(isValidISODate('')).toBe(false);
    expect(isValidISODate(undefined)).toBe(false);
    expect(isValidISODate(null)).toBe(false);
    expect(isValidISODate(20260813)).toBe(false);
  });
});

describe('parseISODate', () => {
  it('anchors at local noon so daylight-saving shifts cannot change the day', () => {
    const parsed = parseISODate('2026-08-13');
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(7);
    expect(parsed.getDate()).toBe(13);
    expect(parsed.getHours()).toBe(12);
  });

  it('round-trips through toISODate on both daylight-saving transition days', () => {
    expect(toISODate(parseISODate(BST_START))).toBe(BST_START);
    expect(toISODate(parseISODate(BST_END))).toBe(BST_END);
  });

  it('throws on an invalid date', () => {
    expect(() => parseISODate('2026-02-30')).toThrow(/Invalid ISO date/);
  });
});

describe('addDays / subtractDays', () => {
  it('crosses month boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-04-30', 1)).toBe('2026-05-01');
    expect(subtractDays('2026-03-01', 1)).toBe('2026-02-28');
  });

  it('crosses year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(subtractDays('2027-01-01', 1)).toBe('2026-12-31');
    expect(addDays('2026-12-25', 10)).toBe('2027-01-04');
  });

  it('handles leap and non-leap Februaries', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('is exact across the spring-forward transition', () => {
    expect(addDays('2026-03-28', 1)).toBe(BST_START);
    expect(addDays(BST_START, 1)).toBe('2026-03-30');
    expect(addDays('2026-03-28', 3)).toBe('2026-03-31');
  });

  it('is exact across the autumn fall-back transition', () => {
    expect(addDays('2026-10-24', 1)).toBe(BST_END);
    expect(addDays(BST_END, 1)).toBe('2026-10-26');
    expect(addDays('2026-10-24', 3)).toBe('2026-10-27');
  });

  it('returns the same day when adding zero', () => {
    expect(addDays('2026-08-13', 0)).toBe('2026-08-13');
  });

  it('spans a whole year correctly', () => {
    expect(addDays('2026-08-13', 365)).toBe('2027-08-13');
  });
});

describe('differenceInDays', () => {
  it('counts whole days in both directions', () => {
    expect(differenceInDays('2026-08-13', '2026-08-20')).toBe(7);
    expect(differenceInDays('2026-08-20', '2026-08-13')).toBe(-7);
    expect(differenceInDays('2026-08-13', '2026-08-13')).toBe(0);
  });

  it('is unaffected by daylight-saving transitions', () => {
    // The 23-hour and 25-hour days must still count as one day each.
    expect(differenceInDays('2026-03-28', '2026-03-30')).toBe(2);
    expect(differenceInDays('2026-10-24', '2026-10-26')).toBe(2);
    expect(differenceInDays('2026-03-01', '2026-11-01')).toBe(245);
  });

  it('counts across a year boundary', () => {
    expect(differenceInDays('2026-12-30', '2027-01-02')).toBe(3);
  });
});

describe('comparison helpers', () => {
  it('orders dates', () => {
    expect(compareISODate('2026-08-13', '2026-08-14')).toBe(-1);
    expect(compareISODate('2026-08-14', '2026-08-13')).toBe(1);
    expect(compareISODate('2026-08-13', '2026-08-13')).toBe(0);
    expect(isSameISODate('2026-08-13', '2026-08-13')).toBe(true);
    expect(isBeforeISODate('2026-08-13', '2026-08-14')).toBe(true);
    expect(isAfterISODate('2026-08-14', '2026-08-13')).toBe(true);
  });

  it('treats range bounds as inclusive', () => {
    expect(isWithinRange('2026-08-13', '2026-08-13', '2026-08-19')).toBe(true);
    expect(isWithinRange('2026-08-19', '2026-08-13', '2026-08-19')).toBe(true);
    expect(isWithinRange('2026-08-12', '2026-08-13', '2026-08-19')).toBe(false);
    expect(isWithinRange('2026-08-20', '2026-08-13', '2026-08-19')).toBe(false);
  });
});

describe('datesBetween', () => {
  it('is inclusive of both ends', () => {
    const days = datesBetween('2026-08-13', '2026-08-19');
    expect(days).toHaveLength(7);
    expect(days[0]).toBe('2026-08-13');
    expect(days[6]).toBe('2026-08-19');
  });

  it('returns a single day when both ends match', () => {
    expect(datesBetween('2026-08-13', '2026-08-13')).toEqual(['2026-08-13']);
  });

  it('returns nothing when the range is reversed', () => {
    expect(datesBetween('2026-08-19', '2026-08-13')).toEqual([]);
  });
});

describe('toISODateTime', () => {
  it('writes the British Summer Time offset explicitly', () => {
    expect(toISODateTime(new Date(2026, 7, 13, 20, 4, 0, 0))).toBe(
      '2026-08-13T20:04:00.000+01:00',
    );
  });

  it('writes +00:00 rather than Z in winter', () => {
    expect(toISODateTime(new Date(2026, 0, 15, 9, 5, 30, 250))).toBe(
      '2026-01-15T09:05:30.250+00:00',
    );
  });

  it('keeps the local day even at 00:30 BST', () => {
    expect(toISODateTime(new Date(2026, 7, 13, 0, 30))).toMatch(/^2026-08-13T00:30/);
  });

  it('nowTimestamp produces a valid timestamp', () => {
    expect(isValidISODateTime(nowTimestamp())).toBe(true);
  });
});

describe('isValidISODateTime', () => {
  it('accepts offset and Z forms', () => {
    expect(isValidISODateTime('2026-08-13T20:04:00.000+01:00')).toBe(true);
    expect(isValidISODateTime('2026-08-13T20:04:00.000Z')).toBe(true);
    expect(isValidISODateTime('2026-08-13T20:04:00Z')).toBe(true);
  });

  it('rejects dates, bare times and nonsense', () => {
    expect(isValidISODateTime('2026-08-13')).toBe(false);
    expect(isValidISODateTime('2026-08-13T20:04:00')).toBe(false);
    expect(isValidISODateTime('2026-02-30T20:04:00Z')).toBe(false);
    expect(isValidISODateTime(null)).toBe(false);
  });
});

describe('isoDateFromTimestamp', () => {
  it('takes the day part without reinterpreting the instant', () => {
    expect(isoDateFromTimestamp('2026-08-13T00:30:00.000+01:00')).toBe('2026-08-13');
  });
});

describe('approximateAgeYears', () => {
  it('gives 42 for the seeded birth year at the programme start', () => {
    expect(approximateAgeYears(1984, '2026-08-13')).toBe(42);
  });
});
