import { compareISODate } from '../dates';
import type { DailyLog, ISODate, PlannedSession, WeeklyPlan } from '../types';
import {
  DAYS_PER_WEEK,
  findWeeklyPlan,
  isRestDay,
  rollingWeekDates,
  sessionForDayIndex,
  summariseSessionCompletion,
} from '../weeklyPlan';

/**
 * Consistency milestones: showing up three times, then seven times.
 *
 * NOT A DAILY STREAK. Nothing in this module counts calendar days, and nothing here
 * requires the user to open NinFit on any particular date. A milestone measures
 * PLANNED ACTIVITY OCCASIONS THAT WENT WELL, so somebody on a two-session-a-week
 * programme reaches seven in three and a half weeks and somebody on a five-session
 * programme reaches it in a fortnight. Both are equally consistent with their own
 * programme, and the model says so.
 *
 * THE THREE OUTCOMES A PLANNED DAY CAN HAVE.
 *
 *   qualified   a planned activity day with at least one activity done
 *   bridge      a planned rest day - passes through, changing nothing
 *   missed      a planned activity day that went by with nothing done
 *
 * A day with no planned session at all is not in the timeline. It cannot qualify,
 * and just as importantly it cannot end anything: there was nothing planned to miss.
 * That is a different thing from a rest day, and `plannedDayKind` keeps them apart.
 *
 * WHY PLANNED REST BRIDGES RATHER THAN COUNTS.
 *
 * Rest is part of the programme, so it must never end a run. But it must not advance
 * one either, or the fastest way to a milestone would be a programme full of rest
 * days. Bridging is the only behaviour that is neutral in both directions.
 *
 * Crucially the bridge is read from the PROGRAMME, not from the log. It needs no
 * `restDayAcknowledged`, no reward key and no tap. A user who rests on Tuesday
 * without opening the app at all loses nothing, which is the entire point: the
 * programme already said Tuesday was rest, so there is nothing to confirm.
 *
 * WHAT THE END OF A RUN IS, AND IS NOT.
 *
 * It is the count returning to zero on the next derivation. It is not a state. There
 * is no `broken`, no `failed`, no `lost`, nothing persisted and nothing emitted. XP
 * already granted stays granted, milestone keys stay in `awardedKeys` forever, and
 * the mascot never learns this happened. The user simply starts counting again from
 * their next good session.
 *
 * WHY THE WALK STOPS AT THE LAST QUALIFYING OCCASION.
 *
 * Judging days after the most recent success would require a clock, and would mean
 * this module deciding that today's planned session has been "missed" while the user
 * still has the evening to do it. So the timeline is truncated at the last qualifying
 * occasion and everything after it is simply not yet judged. Two consequences worth
 * knowing: the derivation is completely clock-free and therefore reproducible, and
 * `currentRun` means "the run as of the last thing that went well", never "the run
 * you are about to lose".
 */

/** The only two milestones M2.5 awards. Longer-horizon design is a later decision. */
export const CONSISTENCY_MILESTONES = [3, 7] as const;

export type ConsistencyMilestone = (typeof CONSISTENCY_MILESTONES)[number];

/** What the PROGRAMME says about a date, independent of anything the user recorded. */
export type PlannedDayKind =
  /** A planned session with at least one activity in it. */
  | 'activity'
  /** A planned session with no activities. Rest is planned, so it is a real answer. */
  | 'rest'
  /** No session covers this date. Not rest - nothing was ever asked of this day. */
  | 'unplanned';

export type ConsistencyOutcome = 'qualified' | 'bridge' | 'missed';

export interface ConsistencyDay {
  date: ISODate;
  kind: PlannedDayKind;
  outcome: ConsistencyOutcome;
}

export interface ConsistencyMilestoneAward {
  milestone: ConsistencyMilestone;
  /**
   * How many times this milestone has been reached in total, across every run.
   *
   * This, and not the date, is what the reward key is built from - see
   * `consistencyRewardKey`.
   */
  occurrence: number;
  /** The qualifying occasion on which it was reached. Reporting only. */
  date: ISODate;
  key: string;
}

export interface ConsistencyProgress {
  /** Qualifying occasions since the last one that did not go well. */
  currentRun: number;
  /** The best run so far. Only ever rises. */
  longestRun: number;
  /** Every milestone the recorded data has reached, in order. */
  awards: ConsistencyMilestoneAward[];
}

export interface ConsistencySnapshot {
  programmeStartDate: ISODate;
  plans: readonly WeeklyPlan[];
  logs: readonly DailyLog[];
}

/**
 * The reward key for one milestone reaching.
 *
 * DELIBERATELY KEYED BY ORDINAL, NOT BY DATE.
 *
 * A date-based key such as `consistency:3x:2026-08-20` looks tidier and is quietly
 * unsafe. Weekly plans are mutable. Edit a past week so that one more day becomes a
 * planned activity, and the run that used to reach three on the 20th now reaches it
 * on the 25th - a key that has never been seen, so a second 30 XP is handed out for
 * the same milestone.
 *
 * An ordinal key cannot do that. Under the same edit the milestone is still the first
 * time three was reached, so the key is unchanged and nothing is granted. A duplicate
 * needs the NUMBER of reachings to rise, which is precisely the condition under which
 * a new award is correct.
 *
 * The residual limitation, stated plainly rather than papered over: an edit that
 * splits one long run into two shorter ones can raise that count and grant a
 * milestone the user did not newly achieve. That is generous rather than punitive,
 * it costs nothing already earned, and no screen in the app currently edits a plan.
 * The opposite direction is safe by construction - a lower count leaves the earlier
 * key sitting in `awardedKeys`, where nothing ever removes it.
 */
export function consistencyRewardKey(
  milestone: ConsistencyMilestone,
  occurrence: number,
): string {
  return `consistency:${milestone}x:${occurrence}`;
}

/** What the programme asked of this date. Never consults the log. */
export function plannedDayKind(session: PlannedSession | undefined): PlannedDayKind {
  if (session === undefined) return 'unplanned';
  return isRestDay(session) ? 'rest' : 'activity';
}

/**
 * Every planned date, in order, with what became of it.
 *
 * Only dates the programme actually covers appear. Weeks are resolved through
 * `findWeeklyPlan` so that a duplicated week number is read exactly as the rest of the
 * domain reads it, and dates come from `rollingWeekDates`, which is anchored to the
 * programme start rather than to any Monday.
 */
export function consistencyTimeline(snapshot: ConsistencySnapshot): ConsistencyDay[] {
  const logsByDate = new Map(snapshot.logs.map((log) => [log.date, log]));
  const weekNumbers = [...new Set(snapshot.plans.map((plan) => plan.weekNumber))].sort(
    (a, b) => a - b,
  );

  const days = new Map<ISODate, ConsistencyDay>();

  for (const weekNumber of weekNumbers) {
    if (weekNumber < 1) continue;
    const plan = findWeeklyPlan(snapshot.plans, weekNumber);
    if (plan === undefined) continue;

    const dates = rollingWeekDates(snapshot.programmeStartDate, weekNumber);

    for (let offset = 0; offset < DAYS_PER_WEEK; offset += 1) {
      const date = dates[offset];
      if (date === undefined) continue;

      const session = sessionForDayIndex(plan, offset + 1);
      const kind = plannedDayKind(session);
      if (kind === 'unplanned') continue;

      if (kind === 'rest') {
        days.set(date, { date, kind, outcome: 'bridge' });
        continue;
      }

      // The one place completion is read, and it goes through the single source of
      // truth rather than re-deriving "was this done" a second way.
      const status = summariseSessionCompletion(session, logsByDate.get(date)).status;
      const qualified = status === 'complete' || status === 'partial';
      days.set(date, { date, kind, outcome: qualified ? 'qualified' : 'missed' });
    }
  }

  return [...days.values()].sort((a, b) => compareISODate(a.date, b.date));
}

/**
 * Walk the timeline and collect what it earned.
 *
 * Pure and clock-free: the same snapshot always gives the same answer. Multiple
 * activities on one planned day are already one entry in the timeline, so a heavy day
 * counts once - the occasion is the unit, not the activity.
 */
export function consistencyProgress(snapshot: ConsistencySnapshot): ConsistencyProgress {
  const timeline = consistencyTimeline(snapshot);

  // Nothing after the last success is judged; see the module note.
  let lastQualified = -1;
  for (let index = 0; index < timeline.length; index += 1) {
    if (timeline[index]?.outcome === 'qualified') lastQualified = index;
  }

  const awards: ConsistencyMilestoneAward[] = [];
  const occurrences = new Map<ConsistencyMilestone, number>();

  let currentRun = 0;
  let longestRun = 0;

  for (let index = 0; index <= lastQualified; index += 1) {
    const day = timeline[index];
    if (day === undefined) continue;

    if (day.outcome === 'bridge') continue;

    if (day.outcome === 'missed') {
      // Silently. No event, no state, no record that this happened.
      currentRun = 0;
      continue;
    }

    currentRun += 1;
    if (currentRun > longestRun) longestRun = currentRun;

    for (const milestone of CONSISTENCY_MILESTONES) {
      // Equality, not `>=`: a run passing seven awards nothing further, and a run can
      // only ever hit a given number once because it resets to zero, never to two.
      if (currentRun !== milestone) continue;
      const occurrence = (occurrences.get(milestone) ?? 0) + 1;
      occurrences.set(milestone, occurrence);
      awards.push({
        milestone,
        occurrence,
        date: day.date,
        key: consistencyRewardKey(milestone, occurrence),
      });
    }
  }

  return { currentRun, longestRun, awards };
}
