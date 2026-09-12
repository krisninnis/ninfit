import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');
const app = read('App.tsx');
const home = read('ui', 'screens', 'JourneyScreen.tsx');
const launch = read('ui', 'screens', 'JourneyLaunchScreen.tsx');
const families = read('ui', 'journeyActivityFamilies.ts');
const screen = read('ui', 'screens', 'ActiveJourneyScreen.tsx');

function between(source: string, start: string, end: string): string {
  const startAt = source.indexOf(start);
  const endAt = source.indexOf(end, startAt + start.length);
  return startAt === -1 || endAt === -1 ? '' : source.slice(startAt, endAt);
}

function effectDependenciesAfter(source: string, marker: string): string[] {
  const markerAt = source.indexOf(marker);
  if (markerAt === -1) return [];

  const match = source.slice(markerAt).match(/\},\s*\[([^\]]*)\]\s*\);/);
  const dependencies = match?.[1];
  if (dependencies === undefined) return [];

  return dependencies
    .split(',')
    .map((dependency) => dependency.trim())
    .filter((dependency) => dependency.length > 0)
    .sort();
}

describe('Journey product ownership', () => {
  it('renders Journey Home as a primary destination and keeps active recording immersive', () => {
    expect(app).toContain("route.kind === 'journey-home'");
    expect(app).toContain("route.kind === 'journey-active'");
    expect(app).toContain('<JourneyScreen />');
    expect(app).toContain('<ActiveJourneyScreen');
    expect(app).toContain('onClose={() => navigate(JOURNEY_HASH)}');
    expect(app).toContain('onCompleted={(journeyId) => navigate(journeyCompleteHash(journeyId))}');
    expect(app).not.toContain('JourneyLauncher');
  });

  it('starts activities through the launch controller, never by building a Journey', () => {
    for (const [name, source] of [['Journey Home', home], ['launch screen', launch]] as const) {
      expect(source, name).toContain('createJourneyLaunchController');
      expect(source, name).not.toContain("status: 'recording'");
      expect(source, name).not.toContain("kind: 'ninfit_phone_gps'");
    }

    expect(home).toContain('launch.start(activityType, nowIso())');
    expect(launch).toContain('launch.start(chosen, nowIso())');
    expect(launch).toContain('const chosen = sole ?? selected');

    for (const activityType of ["'walk'", "'run'", "'cycle'", "'swim'"]) {
      expect(families, activityType).toContain(activityType);
    }
  });
});

describe('Journey GPS ownership', () => {
  it('binds the screen to the motion-aware provider session', () => {
    expect(screen).toContain('startJourneyMotionSession');
    expect(screen).toContain('sessionRef');
    expect(screen).not.toContain('navigator.geolocation');
    expect(screen).not.toContain('watchPosition(');
  });

  it('keeps the motion provider alive across automatic Journey status transitions', () => {
    const dependencies = effectDependenciesAfter(screen, 'startJourneyMotionSession({');
    expect(dependencies).toEqual(['journey?.activityType', 'store']);
    expect(dependencies).not.toContain('journey?.status');
    expect(dependencies).not.toContain('journey');
  });

  it('does not start phone GPS for swim', () => {
    expect(screen).toContain("if (!journeyUsesPhoneGps(current.activityType))");
    expect(screen).toContain("setGpsState('not_applicable')");
  });

  it('uses durable-safe manual pause when a native queue exists and preserves the synchronous fallback', () => {
    const pause = between(screen, 'const pause = () => {', 'const resume = () => {');
    expect(pause).toContain('if (session === null || durableQueue === null) {');
    expect(pause).toContain('stopGps();');
    expect(pause).toContain('recovery.pause');
    expect(pause).toContain("saveJourneyPauseOrigin(store, next.id, 'manual')");
    expect(pause).toContain('pauseJourneyAfterNativeReconciliation({');

    const nativePath = pause.slice(pause.indexOf('setPausing(true);'));
    expect(nativePath).not.toContain('recovery.pause');
    expect(nativePath).not.toContain("saveJourneyPauseOrigin(store, next.id, 'manual')");
  });

  it('stops GPS before completion can persist history and clear recovery', () => {
    const finish = between(screen, 'const finish = () => {', '  const leave = () => {');
    expect(finish).toContain('stopGps();');
    expect(finish).toContain('recovery.complete');
    expect(finish.indexOf('stopGps();')).toBeLessThan(finish.indexOf('recovery.complete'));
    expect(finish).toContain('if (session === null || durableQueue === null) {');
    const nativePath = between(finish, 'setFinishing(true);', '});');
    expect(nativePath).toContain('completeJourneyAfterNativeReconciliation({');
    expect(nativePath).not.toContain('recovery.complete');
  });

  it('stops the Journey location session when leaving without discarding recovery', () => {
    const leave = between(screen, 'const leave = () => {', 'return (');
    expect(leave).toContain('stopGps();');
    expect(leave).toContain('onClose();');
    expect(leave).not.toContain('recovery.discard');
  });

  it('contains synchronous provider/session startup failures instead of crashing the Journey screen', () => {
    expect(screen).toContain('try {');
    expect(screen).toContain("setGpsState('runtime_error')");
  });

  it('protects Journey controls on native background and uses foreground only to reconcile durable fixes', () => {
    expect(screen).toContain('subscribeInjectedJourneyAppLifecycle');
    const lifecycleEffect = between(
      screen,
      'return subscribeInjectedJourneyAppLifecycle((state) => {',
      "if (journey?.status !== 'recording' && !autoPaused && controlsLocked) {",
    );
    expect(lifecycleEffect).toContain("if (state === 'backgrounded') {");
    expect(lifecycleEffect).toContain('setControlsLocked(true);');
    expect(lifecycleEffect).toContain('durableReplay.reconcile()');
    expect(lifecycleEffect).not.toContain('setControlsLocked(false)');
  });
});
