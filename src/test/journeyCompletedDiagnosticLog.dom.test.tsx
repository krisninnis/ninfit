// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Journey } from '../domain/journey';
import {
  clearCompletedJourneyDiagnosticLogs,
  preserveCompletedJourneyDiagnosticLog,
} from '../app/journeyCompletedDiagnosticLog';
import { createMemoryStorageAdapter, type StorageAdapter } from '../storage/StorageAdapter';
import { saveJourneyToHistory } from '../storage/journeyHistory';
import { JourneyDetailScreen } from '../ui/screens/JourneyDetailScreen';

const mocks = vi.hoisted(() => ({ adapter: null as StorageAdapter | null }));

vi.mock('../app/bootstrap', () => ({
  getAppContext: () => ({ adapter: mocks.adapter }),
}));

vi.mock('../ui/components/JourneyRouteMap', () => ({
  JourneyRouteMap: () => null,
}));

function completedWalk(id = 'journey-completed-diagnostic'): Journey {
  return {
    id,
    activityType: 'walk',
    status: 'completed',
    startedAt: '2026-09-12T10:00:00.000Z',
    endedAt: '2026-09-12T10:30:00.000Z',
    pauses: [],
    metrics: [],
    sources: [],
    privacy: {
      visibility: 'private',
      maskSensitiveStartEnd: true,
      preciseRouteCloudSync: false,
    },
    createdAt: '2026-09-12T10:00:00.000Z',
    updatedAt: '2026-09-12T10:30:00.000Z',
  };
}

describe('Completed Journey diagnostic evidence', () => {
  beforeEach(() => {
    clearCompletedJourneyDiagnosticLogs();
    mocks.adapter = createMemoryStorageAdapter();
  });

  afterEach(() => {
    cleanup();
    clearCompletedJourneyDiagnosticLogs();
    mocks.adapter = null;
  });

  it('offers the diagnostic log only for the matching completed Journey', () => {
    const journey = completedWalk();
    saveJourneyToHistory(mocks.adapter!, journey);

    preserveCompletedJourneyDiagnosticLog(
      journey.id,
      'NinFit Journey Diagnostic Log\n\n[NATIVE TRANSPORT]\nexample',
    );

    render(
      <JourneyDetailScreen
        journeyId={journey.id}
        onClose={() => {}}
        onPreviewPostcard={() => {}}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Copy diagnostic log' }),
    ).toBeTruthy();
  });

  it('does not expose another Journey diagnostic log', () => {
    const journey = completedWalk();
    saveJourneyToHistory(mocks.adapter!, journey);

    preserveCompletedJourneyDiagnosticLog(
      'different-journey',
      'diagnostic evidence for another Journey',
    );

    render(
      <JourneyDetailScreen
        journeyId={journey.id}
        onClose={() => {}}
        onPreviewPostcard={() => {}}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Copy diagnostic log' }),
    ).toBeNull();
  });

  it('copies the preserved diagnostic log exactly', async () => {
    const journey = completedWalk();
    saveJourneyToHistory(mocks.adapter!, journey);

    const diagnosticLog = [
      'NinFit Journey Diagnostic Log',
      '',
      '[NATIVE TRANSPORT]',
      'poll_drain status=recording queue=yes',
      '',
      '[MOTION DETECTOR]',
      'auto_pause moving->auto_paused',
    ].join('\n');

    preserveCompletedJourneyDiagnosticLog(journey.id, diagnosticLog);

    const writeText = vi.fn(async (_text: string) => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(
      <JourneyDetailScreen
        journeyId={journey.id}
        onClose={() => {}}
        onPreviewPostcard={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy diagnostic log' }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });

    expect(writeText).toHaveBeenCalledWith(diagnosticLog);
  });

  it('keeps the completed Journey usable when clipboard export fails', async () => {
    const journey = completedWalk();
    saveJourneyToHistory(mocks.adapter!, journey);

    preserveCompletedJourneyDiagnosticLog(journey.id, 'diagnostic evidence');

    const writeText = vi.fn(async (_text: string) => {
      throw new Error('Clipboard unavailable');
    });

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(
      <JourneyDetailScreen
        journeyId={journey.id}
        onClose={() => {}}
        onPreviewPostcard={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy diagnostic log' }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Completed Journey')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Preview Journey Postcard' }),
    ).toBeTruthy();
  });
});
