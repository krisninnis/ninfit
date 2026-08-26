import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');
const app = read('App.tsx');
const home = read('ui', 'screens', 'JourneyScreen.tsx');
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
    expect(app).toContain("<ActiveJourneyScreen onClose={() => navigate(JOURNEY_HASH)} />");
    expect(app).not.toContain('JourneyLauncher');
  });

  it('starts activities through the launch controller from Journey Home, not Today', () => {
    expect(home).toContain('createJourneyLaunchController');
    expect(home).toContain('PRIMARY_ACTIVITIES');
    expect(home).toContain("'walk'");
    expect(home).toContain("'run'");
    expect(home).toContain("'cycle'");
    expect(home).toContain("'swim'");
    expect(home).toContain('launch.start(activityType, nowIso())');
    expect(home).not.toContain("status: 'recording'");
    expect(home).not.toContain("kind: 'ninfit_phone_gps'");
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
