import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAppContext } from '../../app/bootstrap';
import { todayISO } from '../../domain/dates';
import { createMeasurement, isMeasurementEmpty, type CreateMeasurementInput } from '../../domain/measurement';
import {
  addHealthNote,
  applyBaselineUpdate,
  applyProfileUpdate,
  createHealthNote,
  removeHealthNote,
  startDateChangeAffectsHistory,
  type CreateHealthNoteInput,
} from '../../domain/profile';
import type {
  BaselineMeasurement,
  HealthContext,
  ISODate,
  Measurement,
  UserProfile,
  UUID,
} from '../../domain/types';

/**
 * Editing the profile, baseline, health notes and measurements.
 *
 * Writes are debounced for the typed fields, because a number input fires on every
 * keystroke, and immediate for discrete actions like adding a note. If a write fails
 * the edit stays on screen and the status says so - it is never reported as saved.
 */

const SAVE_DEBOUNCE_MS = 600;
const SAVED_INDICATOR_MS = 2000;

export type ProfileSaveStatus = 'idle' | 'pending' | 'saved' | 'failed';

export interface ProfileState {
  profile: UserProfile | undefined;
  baseline: BaselineMeasurement | undefined;
  healthContext: HealthContext | undefined;
  measurements: Measurement[];
  today: ISODate;
  status: ProfileSaveStatus;
  hasStorageIssues: boolean;
  /** True when changing the start date would renumber days already recorded. */
  startDateAffectsHistory: (nextStart: ISODate) => boolean;

  updateProfile: (patch: Partial<UserProfile>) => void;
  updateBaseline: (patch: Partial<BaselineMeasurement>) => void;
  addNote: (input: CreateHealthNoteInput) => void;
  removeNote: (noteId: UUID) => void;
  addMeasurement: (input: CreateMeasurementInput) => boolean;
}

export function useProfile(): ProfileState {
  const context = useMemo(() => getAppContext(), []);
  const repository = context.repository;
  const today = useMemo(() => todayISO(), []);

  const [profile, setProfile] = useState<UserProfile | undefined>(() => repository.getProfile());
  const [baseline, setBaseline] = useState<BaselineMeasurement | undefined>(() =>
    repository.getBaseline(),
  );
  const [healthContext, setHealthContext] = useState<HealthContext | undefined>(() =>
    repository.getHealthContext(),
  );
  const [measurements, setMeasurements] = useState<Measurement[]>(() =>
    repository.getMeasurements(),
  );
  const [status, setStatus] = useState<ProfileSaveStatus>('idle');

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<(() => void) | undefined>(undefined);

  const runWrite = useCallback((write: () => void) => {
    try {
      write();
      setStatus('saved');
    } catch {
      // The edit remains in state. Nothing claims it was stored.
      setStatus('failed');
    }
  }, []);

  const scheduleWrite = useCallback(
    (write: () => void) => {
      pending.current = write;
      setStatus('pending');
      if (timer.current !== undefined) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const queued = pending.current;
        pending.current = undefined;
        if (queued !== undefined) runWrite(queued);
      }, SAVE_DEBOUNCE_MS);
    },
    [runWrite],
  );

  // Flush anything outstanding before the page goes away.
  useEffect(() => {
    const flush = () => {
      const queued = pending.current;
      if (queued === undefined) return;
      pending.current = undefined;
      if (timer.current !== undefined) clearTimeout(timer.current);
      try {
        queued();
      } catch {
        /* reported on the next interaction rather than during teardown */
      }
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  useEffect(() => {
    if (status !== 'saved') return;
    const handle = setTimeout(() => setStatus('idle'), SAVED_INDICATOR_MS);
    return () => clearTimeout(handle);
  }, [status]);

  const updateProfile = useCallback(
    (patch: Partial<UserProfile>) => {
      setProfile((current) => {
        if (current === undefined) return current;
        const next = applyProfileUpdate(current, patch);
        scheduleWrite(() => repository.saveProfile(next));
        return next;
      });
    },
    [repository, scheduleWrite],
  );

  const updateBaseline = useCallback(
    (patch: Partial<BaselineMeasurement>) => {
      setBaseline((current) => {
        if (current === undefined) return current;
        const next = applyBaselineUpdate(current, patch);
        scheduleWrite(() => repository.saveBaseline(next));
        return next;
      });
    },
    [repository, scheduleWrite],
  );

  const addNote = useCallback(
    (input: CreateHealthNoteInput) => {
      setHealthContext((current) => {
        if (current === undefined) return current;
        const next = addHealthNote(current, createHealthNote(input));
        runWrite(() => repository.saveHealthContext(next));
        return next;
      });
    },
    [repository, runWrite],
  );

  const removeNote = useCallback(
    (noteId: UUID) => {
      setHealthContext((current) => {
        if (current === undefined) return current;
        const next = removeHealthNote(current, noteId);
        runWrite(() => repository.saveHealthContext(next));
        return next;
      });
    },
    [repository, runWrite],
  );

  const addMeasurement = useCallback(
    (input: CreateMeasurementInput) => {
      const measurement = createMeasurement(input);
      // A date with nothing attached is not a measurement.
      if (isMeasurementEmpty(measurement)) return false;

      setMeasurements((current) => {
        const next = [...current, measurement];
        runWrite(() => repository.saveMeasurements(next));
        return next;
      });
      return true;
    },
    [repository, runWrite],
  );

  const startDateAffectsHistory = useCallback(
    (nextStart: ISODate) =>
      startDateChangeAffectsHistory(
        profile?.programmeStartDate ?? nextStart,
        nextStart,
        repository.listDailyLogDates().length > 0,
      ),
    [profile, repository],
  );

  return {
    profile,
    baseline,
    healthContext,
    measurements,
    today,
    status,
    hasStorageIssues: repository.getIssues().length > 0,
    startDateAffectsHistory,
    updateProfile,
    updateBaseline,
    addNote,
    removeNote,
    addMeasurement,
  };
}
