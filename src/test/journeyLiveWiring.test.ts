import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');
const app = read('App.tsx');
const screen = read('ui', 'screens', 'ActiveJourneyScreen.tsx');
const launcher = read('ui', 'components', 'JourneyLauncher.tsx');
const launcherCss = read('styles', 'components', 'journey-launcher.css');

function between(source: string, start: string, end: string): string {
  const startAt = source.indexOf(start);
  const endAt = source.indexOf(end, startAt + start.length);
  return startAt === -1 || endAt === -1 ? '' : source.slice(startAt, endAt);
}

function compact(source: string): string {
  return source.replace(/\s+/g, '');
}

describe('live Journey entry point', () => {
  it('offers the launcher only from Today and opens the standalone Journey route', () => {
    expect(app).toContain("route.kind === 'tab' && tab === 'today'");
    expect(app).toContain('<JourneyLauncher onOpen={() => navigate(JOURNEY_HASH)} />');
    expect(app).toContain('JOURNEY_HASH');
  });

  it('reserves scroll space so the fixed Today launcher cannot cover interactive content', () => {
    expect(app).toContain("showJourneyLauncher ? ' app--today' : ''");
    expect(launcherCss).toContain('.app--today .app__main');
    expect(launcherCss).toContain('padding-bottom: calc(');
  });

  it('creates or resumes through the launch controller rather than constructing a Journey in React', () => {
    expect(launcher).toContain('createJourneyLaunchController');
    expect(launcher).toContain("launch.start('walk', nowIso())");
    expect(launcher).not.toContain("status: 'recording'");
    expect(launcher).not.toContain("kind: 'ninfit_phone_gps'");
  });
});

describe('foreground GPS ownership', () => {
  it('binds the screen to the hardened foreground session', () => {
    expect(screen).toContain('startForegroundJourneyGpsSession');
    expect(screen).toContain('sessionRef');
    expect(screen).not.toContain('navigator.geolocation');
    expect(screen).not.toContain('watchPosition(');
  });

  it('keys watcher lifetime to recorder status instead of the changing Journey object', () => {
    const source = compact(screen);
    expect(source).toContain('},[journey?.status,store]);');
    expect(source).not.toContain('},[journey,store]);');
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
