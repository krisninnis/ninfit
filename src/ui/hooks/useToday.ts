import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAppContext } from '../../app/bootstrap';
import { createTodaySession } from '../../app/todaySession';
import {
  dailyLogCompletion,
  isActivityCompleted,
  isRestDayAcknowledged,
  type DailyLogUpdate,
} from '../../domain/dailyLog';
import { todayISO } from '../../domain/dates';
import { deriveRewards } from '../../domain/game/rewards';
import { resolveToday, type TodayView } from '../../domain/today';
import type { DailyLog, ISODate } from '../../domain/types';
import type { DailyLogCompletion } from '../../domain/dailyLog';
import { telemetry } from '../../telemetry/runtime';

/**
 * Everything the Today screen needs, and nothing it doesn't.
 *
 * Persistence is debounced rather than immediate, so dragging a slider produces one
 * write instead of forty. The pending write is also flushed when the page is hidden,
 * which on a phone is what actually happens when you swipe the app away.
 */

const SAVE_DEBOUNCE_MS = 700;
const SAVED_INDICATOR_MS = 2000;

export type SaveIndicator = 'idle' | 'pending' | 'saved' | 'failed';

export interface TodayState {
  date: ISODate;
  view: TodayView;
  log: DailyLog;
  completion: DailyLogCompletion;
  saveIndicator: SaveIndicator;
  /** False when storage fell back to memory; the app still works, it just won't persist. */
  isPersistent: boolean;
  /** True when the store was written by a newer version and must not be touched. */
  isBlocked: boolean;
  update: (update: DailyLogUpdate) => void;
}

export function useToday(): TodayState {
  const context = useMemo(() => getAppContext(), []);
  // Resolved once per mount. A session that stays open past midnight keeps showing the
  // day it was opened on, which is the lesser evil compared with the screen silently
  // switching days underneath a half-finished entry.
  const date = useMemo(() => todayISO(), []);

  const profile = context.repository.getProfile();
  const plans = useMemo(() => context.repository.getWeeklyPlans(), [context]);

  const view = useMemo<TodayView>(() => {
    if (profile === undefined) {
      return { date, status: 'no_plan', activities: [], plannedMinutes: 0 };
    }
    return resolveToday(plans, profile.programmeStartDate, date);
  }, [plans, profile, date]);

  const session = useMemo(
    () =>
      createTodaySession(context.repository, date, {
        ...(view.planId !== undefined ? { weeklyPlanId: view.planId } : {}),
        ...(view.sessionId !== undefined ? { plannedSessionId: view.sessionId } : {}),
      }),
    [context, date, view.planId, view.sessionId],
  );

  const [log, setLog] = useState<DailyLog>(() => session.getLog());
  const [saveIndicator, setSaveIndicator] = useState<SaveIndicator>('idle');

  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const saveWithTelemetry = useCallback(() => {
    if (!session.hasUnsavedChanges()) return { status: 'skipped' as const };

    // Snapshot only the minimum truth needed to identify a completion transition.
    // This is read before the write; no health, measurement, route or note value is
    // ever handed to telemetry.
    const beforeLog = context.repository.getDailyLog(date);
    const beforeFacts = deriveRewards({
      programmeStartDate: profile?.programmeStartDate ?? date,
      plans,
      logs: context.repository.listDailyLogs(),
      measurementCount: context.repository.getMeasurements().length,
    });

    const outcome = session.save();
    if (outcome.status !== 'saved') return outcome;

    const afterLog = session.getLog();
    const newlyCompleted = view.activities.filter(
      (activity) =>
        !isActivityCompleted(beforeLog, activity.id)
        && isActivityCompleted(afterLog, activity.id),
    );

    if (newlyCompleted.length > 0 && beforeFacts.activeDays.length === 0) {
      telemetry().capture({ name: 'first_activity_recorded' });
    }
    for (const activity of newlyCompleted) {
      telemetry().capture({
        name: 'activity_recorded',
        properties: { type: activity.type, is_rest: false },
      });
    }

    if (!isRestDayAcknowledged(beforeLog) && isRestDayAcknowledged(afterLog)) {
      telemetry().capture({
        name: 'activity_recorded',
        properties: { type: 'rest', is_rest: true },
      });
    }

    return outcome;
  }, [context.repository, date, plans, profile?.programmeStartDate, session, view.activities]);

  const flush = useCallback(() => {
    if (saveTimer.current !== undefined) {
      clearTimeout(saveTimer.current);
      saveTimer.current = undefined;
    }
    const outcome = saveWithTelemetry();
    if (outcome.status === 'saved') setSaveIndicator('saved');
    else if (outcome.status === 'failed') setSaveIndicator('failed');
    else setSaveIndicator('idle');
  }, [saveWithTelemetry]);

  const update = useCallback(
    (patch: DailyLogUpdate) => {
      setLog(session.apply(patch));
      setSaveIndicator('pending');
      if (saveTimer.current !== undefined) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [session, flush],
  );

  // Let "Saved" fade back to nothing rather than sitting there demanding attention.
  useEffect(() => {
    if (saveIndicator !== 'saved') return;
    clearTimer.current = setTimeout(() => setSaveIndicator('idle'), SAVED_INDICATOR_MS);
    return () => {
      if (clearTimer.current !== undefined) clearTimeout(clearTimer.current);
    };
  }, [saveIndicator]);

  // Write before the phone takes the app away, and on unmount. This goes through the
  // same successful-write boundary as the debounce path, so hiding the app cannot make
  // analytics observe an activity that storage did not accept.
  useEffect(() => {
    const flushNow = () => {
      if (session.hasUnsavedChanges()) saveWithTelemetry();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushNow();
    };

    window.addEventListener('pagehide', flushNow);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', flushNow);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (saveTimer.current !== undefined) clearTimeout(saveTimer.current);
      flushNow();
    };
  }, [session, saveWithTelemetry]);

  return {
    date,
    view,
    log,
    completion: dailyLogCompletion(log),
    saveIndicator,
    isPersistent: context.isPersistent,
    isBlocked: context.initialisation.blocked,
    update,
  };
}
