import { useMemo, useState } from 'react';
import { getAppContext } from '../../app/bootstrap';
import { readAppData } from '../../app/appData';
import { todayISO } from '../../domain/dates';
import {
  progressWindow,
  summariseProgress,
  type ProgressRangeId,
  type ProgressSummary,
} from '../../domain/progress';
import type { AppData, ISODate } from '../../domain/types';

/**
 * Orchestration only. The domain does the arithmetic; this fetches and memoises.
 *
 * There is no separate analytics store: every number on Progress is recomputed from
 * the same daily logs Today and Week read, so the three screens cannot disagree.
 */

export interface ProgressState {
  today: ISODate;
  range: ProgressRangeId;
  setRange: (range: ProgressRangeId) => void;
  summary: ProgressSummary;
  data: AppData;
  /**
   * True when the repository could not read something. Shown as a calm note so an
   * unreadable record is never mistaken for a genuinely empty history.
   */
  hasStorageIssues: boolean;
}

export function useProgress(): ProgressState {
  const context = useMemo(() => getAppContext(), []);
  const today = useMemo(() => todayISO(), []);
  const [range, setRange] = useState<ProgressRangeId>('week');

  const data = useMemo(() => readAppData(context.repository), [context]);

  const summary = useMemo(
    () => summariseProgress(data, progressWindow(range, data.profile.programmeStartDate, today)),
    [data, range, today],
  );

  return {
    today,
    range,
    setRange,
    summary,
    data,
    hasStorageIssues: context.repository.getIssues().length > 0,
  };
}
