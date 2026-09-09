import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const screen = readFileSync(join(SRC, 'ui', 'screens', 'ActiveJourneyScreen.tsx'), 'utf8');

describe('native durable Journey live wiring', () => {
  it('creates one durable replay coordinator for the active motion session', () => {
    expect(screen).toContain('resolveInjectedNativeJourneyDurableQueue()');
    expect(screen).toContain('createNativeJourneyDurableReplayCoordinator({');
    expect(screen).toContain('journeyId: current.id');
    expect(screen).toContain('session,');
    expect(screen).toContain('durableReplayRef.current = durableReplay');
  });

  it('reconciles once on session start and again when the native app foregrounds', () => {
    expect(screen).toContain('void durableReplay.reconcile().then');
    expect(screen).toContain("if (state === 'backgrounded')");
    expect(screen).toContain('const durableReplay = durableReplayRef.current;');
    expect(screen.match(/void durableReplay\.reconcile\(\)\.then/g)).toHaveLength(2);
  });

  it('keeps background control protection and surfaces durable replay integrity failures', () => {
    expect(screen).toContain('setControlsLocked(true);');
    expect(screen).toContain("result.stopReason !== null");
    expect(screen).toContain("setGpsState('runtime_error')");
  });
});
