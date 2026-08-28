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
    /*
     * RE-POINTED, NOT WEAKENED. Finish now lands on the completion moment rather than
     * straight on the durable record. Both are read-only views of the same completed
     * Journey, and the id is still the only thing that crosses - so what this guards
     * is unchanged: completion navigates by stable id and never by carrying a Journey
     * object through the router. The completion screen's own onward route back to the
     * detail record is pinned in `journeyCompletionDetailWiring.test.ts`.
     */
    expect(app).toContain('onCompleted={(journeyId) => navigate(journeyCompleteHash(journeyId))}');
    expect(app).not.toContain('JourneyLauncher');
  });

  it('starts activities through the launch controller, never by building a Journey', () => {
    /*
     * RE-POINTED, NOT WEAKENED. The four activity tiles became three activity-family
     * doors, and Walk/Run now chooses its type on the companion launch screen - so the
     * property is asserted across BOTH screens instead of one. What it protects is
     * unchanged and is the important part: all four activity types are still offered,
     * and neither screen ever constructs a Journey, a recording status or a GPS source
     * for itself.
     */
    for (const [name, source] of [['Journey Home', home], ['launch screen', launch]] as const) {
      expect(source, name).toContain('createJourneyLaunchController');
      expect(source, name).not.toContain("status: 'recording'");
      expect(source, name).not.toContain("kind: 'ninfit_phone_gps'");
    }

    // Journey Home starts the single-type families directly, exactly as it always has.
    expect(home).toContain('launch.start(activityType, nowIso())');
    // The launch screen starts the type the user chose, and only that.
    expect(launch).toContain('launch.start(selected, nowIso())');

    // All four activity types remain reachable, and remain four.
    for (const activityType of ["'walk'", "'run'", "'cycle'", "'swim'"]) {
      expect(families, activityType).toContain(activityType);
    }
  });
});

describe('foreground GPS ownership', () => {
  it('binds the screen to the hardened foreground session', () => {
    expect(screen).toContain('startForegroundJourneyGpsSession');
    expect(screen).toContain('sessionRef');
    expect(screen).not.toContain('navigator.geolocation');
    expect(screen).not.toContain('watchPosition(');
  });

  it('keys watcher lifetime to recorder status and activity type, not the changing Journey object', () => {
    const dependencies = effectDependenciesAfter(screen, 'startForegroundJourneyGpsSession({');
    expect(dependencies).toEqual(['journey?.activityType', 'journey?.status', 'store']);
    expect(dependencies).not.toContain('journey');
  });

  it('does not start phone GPS for swim', () => {
    expect(screen).toContain("if (!journeyUsesPhoneGps(current.activityType))");
    expect(screen).toContain("setGpsState('not_applicable')");
  });

  it('stops GPS before persisting a pause transition', () => {
    const pause = between(screen, 'const pause = () => {', 'const resume = () => {');
    expect(pause).toContain('stopGps();');
    expect(pause).toContain('recovery.pause');
    expect(pause.indexOf('stopGps();')).toBeLessThan(pause.indexOf('recovery.pause'));
  });

  it('stops GPS before completion can persist history and clear recovery', () => {
    const finish = between(screen, 'const finish = () => {', 'const leave = () => {');
    expect(finish).toContain('stopGps();');
    expect(finish).toContain('recovery.complete');
    expect(finish.indexOf('stopGps();')).toBeLessThan(finish.indexOf('recovery.complete'));
  });

  it('stops foreground GPS when leaving without discarding recovery', () => {
    const leave = between(screen, 'const leave = () => {', 'return (');
    expect(leave).toContain('stopGps();');
    expect(leave).toContain('onClose();');
    expect(leave).not.toContain('recovery.discard');
  });

  it('contains synchronous watcher startup failures instead of crashing the Journey screen', () => {
    expect(screen).toContain('try {');
    expect(screen).toContain("setGpsState('runtime_error')");
  });
});
