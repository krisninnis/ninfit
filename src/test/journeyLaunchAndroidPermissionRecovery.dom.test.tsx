// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStorageAdapter, type StorageAdapter } from '../storage/StorageAdapter';

/*
 * The Samsung failure this file exists for.
 *
 * The installed build registered its Capacitor plugins after super.onCreate(...), so the
 * Bridge answered `unable to find plugin : NinFitJourneyLocation` and every readiness
 * check REJECTED. The screen collapsed that into "NinFit could not confirm the Android
 * permissions. Try again when you are ready." - advice that could never work, on a phone
 * where precise location had just been granted by hand.
 *
 * Two things had to be true and were not:
 *   1. a rejection caused by a missing native plugin must not be reported as if the
 *      person could fix it in Android Settings, and
 *   2. a permission granted in Android Settings, with NinFit backgrounded, must be
 *      noticed when NinFit comes back - without NinFit prompting for anything.
 *
 * This drives the real screen through the real controller over a stubbed Capacitor
 * bridge, which is the only layer below the screen where the defect could hide.
 */

const mocks = vi.hoisted(() => ({
  adapter: null as StorageAdapter | null,
  native: true,
  platform: 'android',
  checkPermissionReadiness: vi.fn(),
  requestRequiredPermissions: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => mocks.native,
    getPlatform: () => mocks.platform,
  },
  registerPlugin: () => ({
    checkPermissionReadiness: mocks.checkPermissionReadiness,
    requestRequiredPermissions: mocks.requestRequiredPermissions,
  }),
}));

vi.mock('../app/bootstrap', () => ({
  getAppContext: () => ({
    adapter: mocks.adapter,
    repository: { getGameState: () => undefined },
  }),
}));

const BLOCKED = {
  preciseLocation: false,
  notificationRequired: true,
  notification: true,
  ready: false,
};

const READY = {
  preciseLocation: true,
  notificationRequired: true,
  notification: true,
  ready: true,
};

/** What Capacitor's Bridge actually answers for a plugin class it never registered. */
const missingPluginRejection = () =>
  Promise.reject(new Error('unable to find plugin : NinFitJourneyLocation'));

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

async function renderWalkRun() {
  const { JourneyLaunchScreen } = await import('../ui/screens/JourneyLaunchScreen');
  render(<JourneyLaunchScreen family="walk-run" onClose={() => {}} />);
  fireEvent.click(screen.getByLabelText('Walk'));
}

beforeEach(() => {
  mocks.adapter = createMemoryStorageAdapter();
  mocks.native = true;
  mocks.platform = 'android';
  mocks.checkPermissionReadiness.mockReset();
  mocks.requestRequiredPermissions.mockReset();
  setVisibility('visible');
});

afterEach(() => {
  cleanup();
  vi.resetModules();
});

describe('Journey launch on an installed Android build with a missing native plugin', () => {
  it('names the build rather than telling the person to try Android Settings again', async () => {
    mocks.checkPermissionReadiness.mockImplementation(missingPluginRejection);

    await renderWalkRun();

    const note = await screen.findByRole('alert');
    expect(note.getAttribute('data-permission-failure')).toBe('bridge_unavailable');
    expect(note.textContent).toContain('missing the Android Journey component');
    expect(note.textContent).toContain('Nothing was started');
    expect(note.textContent).not.toContain('Try again when you are ready');
  });

  it('still refuses to start, and never asks Android for a permission on its own', async () => {
    mocks.checkPermissionReadiness.mockImplementation(missingPluginRejection);

    await renderWalkRun();
    await screen.findByRole('alert');

    fireEvent.click(screen.getByRole('button', { name: /^Start/ }));
    await act(async () => { await Promise.resolve(); });

    expect(window.location.hash).not.toContain('journey');
    expect(mocks.requestRequiredPermissions).not.toHaveBeenCalled();
  });

  it('keeps the ordinary "try again" wording for a native failure it cannot attribute', async () => {
    mocks.checkPermissionReadiness.mockRejectedValue(new Error('Location services are off'));

    await renderWalkRun();

    const note = await screen.findByRole('alert');
    expect(note.getAttribute('data-permission-failure')).toBe('native_error');
    expect(note.textContent).toContain('Try again when you are ready');
  });
});

describe('Journey launch after a permission is granted in Android Settings', () => {
  it('notices the grant when NinFit returns to the foreground, without prompting', async () => {
    mocks.checkPermissionReadiness.mockResolvedValue(BLOCKED);

    await renderWalkRun();
    await screen.findByText(/Allow precise location before starting/);

    // The person leaves for Android Settings, grants precise location, and comes back.
    mocks.checkPermissionReadiness.mockResolvedValue(READY);
    act(() => { setVisibility('hidden'); });
    await act(async () => { setVisibility('visible'); });

    await waitFor(() => {
      expect(screen.queryByText(/Allow precise location before starting/)).toBeNull();
    });
    expect(mocks.requestRequiredPermissions).not.toHaveBeenCalled();
  });

  it('does not re-read while NinFit is still in the background', async () => {
    mocks.checkPermissionReadiness.mockResolvedValue(BLOCKED);

    await renderWalkRun();
    await screen.findByText(/Allow precise location before starting/);
    const readsAfterMount = mocks.checkPermissionReadiness.mock.calls.length;

    await act(async () => { setVisibility('hidden'); });

    expect(mocks.checkPermissionReadiness.mock.calls.length).toBe(readsAfterMount);
  });

  it('clears a bridge failure once the plugin answers on the way back', async () => {
    mocks.checkPermissionReadiness.mockImplementation(missingPluginRejection);

    await renderWalkRun();
    await screen.findByRole('alert');

    mocks.checkPermissionReadiness.mockResolvedValue(READY);
    act(() => { setVisibility('hidden'); });
    await act(async () => { setVisibility('visible'); });

    await waitFor(() => { expect(screen.queryByRole('alert')).toBeNull(); });
  });
});

describe('Journey launch on the browser build', () => {
  it('never touches the native permission surface or listens for Android resumes', async () => {
    mocks.native = false;
    mocks.platform = 'web';

    await renderWalkRun();
    await act(async () => { setVisibility('hidden'); setVisibility('visible'); });

    expect(mocks.checkPermissionReadiness).not.toHaveBeenCalled();
    expect(mocks.requestRequiredPermissions).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
