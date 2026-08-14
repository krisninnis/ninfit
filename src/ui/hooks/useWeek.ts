import { useMemo } from 'react';
import { getAppContext } from '../../app/bootstrap';
import { todayISO } from '../../domain/dates';
import { buildWeekView, type WeekView } from '../../domain/week';
import { programmeWeekNumber } from '../../domain/weeklyPlan';
import type { ISODate } from '../../domain/types';

/**
 * Orchestration only: fetch from the repository, hand everything to the domain.
 *
 * No calculation happens here and none happens in the screen. `buildWeekView` owns
 * the arithmetic, which is why it can all be tested without rendering anything.
 */

export interface WeekState {
  today: ISODate;
  week: WeekView;
  /** True when today falls before the programme start date. */
  beforeProgramme: boolean;
}

export function useWeek(): WeekState {
  const context = useMemo(() => getAppContext(), []);
  const today = useMemo(() => todayISO(), []);

  return useMemo(() => {
    const profile = context.repository.getProfile();
    const plans = context.repository.getWeeklyPlans();
    const logs = context.repository.listDailyLogs();
    const startDate = profile?.programmeStartDate ?? today;

    const currentWeek = programmeWeekNumber(startDate, today);
    const beforeProgramme = currentWeek === undefined;

    return {
      today,
      beforeProgramme,
      // Before the programme begins there is nothing to be behind on, so we simply
      // show week 1 as it stands.
      week: buildWeekView(plans, startDate, currentWeek ?? 1, logs, today),
    };
  }, [context, today]);
}
