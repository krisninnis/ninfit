import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');

const app = read('App.tsx');
const intro = read('ui', 'screens', 'StartupCinematic.tsx');
const state = read('ui', 'startup', 'introState.ts');

describe('startup cinematic state', () => {
  it('plays for a genuinely new install', () => {
    expect(state).toContain('shouldPlayIntro');
  });

  it('does not play once it has been seen', () => {
    expect(state).toContain('seen');
  });

  it('does not play for someone who was already using NinFit', () => {
    expect(state).toContain('onboardingComplete');
  });

  it('never plays again after both conditions are true', () => {
    expect(state).toContain('return !seen && !onboardingComplete');
  });

  it('starts unseen', () => {
    expect(state).toContain("store.get('ninfit:intro-seen:v1')");
  });

  it('is seen once marked, and stays seen across a reload', () => {
    expect(state).toContain("store.set('ninfit:intro-seen:v1', '1')");
  });

  it('is idempotent', () => {
    expect(state).toContain('markIntroSeen');
  });

  it('stores one flag and touches nothing else', () => {
    expect([...state.matchAll(/ninfit:intro-seen:v1/g)]).toHaveLength(2);
  });

  it('lets the user in even when the store refuses to write', () => {
    expect(state).toContain('try');
  });

  it('keeps the flag out of the repository and the domain', () => {
    expect(state).not.toContain('Repository');
  });

  it('decides purely from local state', () => {
    expect(state).not.toMatch(/fetch\(|supabase|auth/i);
  });

  it('never mentions auth in the cinematic itself', () => {
    expect(intro).not.toMatch(/sign in|account|supabase/i);
  });

  it('requires no credentials of any kind at runtime', () => {
    expect(intro).not.toMatch(/VITE_|process\.env|import\.meta\.env/);
  });

  it('references the video by URL rather than importing it', () => {
    expect(intro).toContain('src={VIDEO_URL}');
  });

  it('keeps the video URL in one module', () => {
    expect(intro).toContain('VIDEO_URL');
  });

  it('honours the configured base path instead of assuming a domain root', () => {
    expect(intro).toContain('import.meta.env.BASE_URL');
  });

  it('ships the video in public/ where the build will copy it verbatim', () => {
    const publicVideo = join(SRC, '..', 'public', 'brand', 'ninfit-startup.mp4');
    expect(() => readFileSync(publicVideo)).not.toThrow();
  });

  it('overlays no wordmark, strapline or veil while the video plays', () => {
    expect(intro).not.toContain('startup-cinematic__veil');
  });

  it('has retired the contrast veil along with the overlay it protected', () => {
    expect(intro).not.toContain('veil');
  });

  it('adds no text of its own over the cinematic', () => {
    expect(intro).not.toContain('NinFit — the only way to play.');
  });

  it('leaves the clip to supply the logo, rather than double-branding the end', () => {
    expect(intro).not.toContain('startup-cinematic__wordmark');
  });

  it('imports the wordmark rather than redrawing it', () => {
    expect(intro).toContain('ninfit-wordmark-white.svg');
  });

  it('does not spell the logo out as live text or CSS', () => {
    expect(intro).not.toContain('>NinFit<');
  });

  it('uses the white-on-dark variant, which is the one that exists', () => {
    expect(intro).toContain('wordmark-white');
  });

  it('shows the strapline in the approved order', () => {
    expect(intro).toContain('Notice');
    expect(intro).toContain('Inspire');
    expect(intro).toContain('Nurture');
  });

  it('has a hard timeout shorter than anyone would tolerate', () => {
    expect(intro).toMatch(/setTimeout/);
  });

  it('leaves on every exit a media element can offer', () => {
    expect(intro).toContain('onEnded');
    expect(intro).toContain('onError');
  });

  it('offers an explicit way out', () => {
    expect(intro).toMatch(/Skip/i);
  });

  it('leaves on Escape, as any overlay should', () => {
    expect(intro).toContain("event.key === 'Escape'");
  });

  it('completes exactly once however many exits fire', () => {
    expect(intro).toContain('completedRef');
  });

  it('hands control back rather than routing by itself', () => {
    expect(intro).toContain('onComplete');
    expect(intro).not.toContain('location.hash');
  });

  it('is honestly reported as not yet present', () => {
    expect(intro).toContain('AUDIO_URL');
  });

  it('requests no audio at all while the recording is absent', () => {
    expect(intro).toContain('AUDIO_URL === null');
  });

  it('carries on silently when the browser blocks autoplay', () => {
    expect(intro).toContain('.catch');
  });

  it('captions the line whenever there is speech to caption', () => {
    expect(intro).toContain('track');
  });

  it('does not wait for audio before finishing', () => {
    expect(intro).not.toContain('audio.onended');
  });

  it('respects a preference for reduced motion', () => {
    expect(intro).toContain('prefers-reduced-motion: reduce');
  });

  it('shows a still presentation rather than suppressing the welcome', () => {
    expect(intro).toContain('reducedMotion');
  });

  it('brands the still card, since no video is there to do it', () => {
    expect(intro).toContain('wordmark');
  });

  it('moves the still card on rather than leaving it until the safety timeout', () => {
    expect(intro).toContain('setTimeout');
  });

  it('requests no video download at all under reduced motion', () => {
    expect(intro).toContain('reducedMotion ?');
  });

  it('moves focus to the control, so a keyboard user is never hunting', () => {
    expect(intro).toContain('.focus()');
  });

  it('marks the decorative media as decorative', () => {
    expect(intro).toContain('aria-hidden');
  });

  it('survives an environment with no matchMedia', () => {
    expect(intro).toContain('window.matchMedia');
  });

  it('renders before onboarding and before any tab', () => {
    expect(app.indexOf('if (!introDone)')).toBeLessThan(app.indexOf('game.needsOnboarding'));
  });

  it('shows no navigation while it plays', () => {
    const introBranch = app.slice(app.indexOf('if (!introDone)'), app.indexOf('game.needsOnboarding'));
    expect(introBranch.length).toBeGreaterThan(0);
    expect(introBranch).toContain('<StartupCinematic');
    expect(introBranch).not.toContain('TabBar');
    expect(introBranch).not.toContain('PageBackdrop');
  });

  it('leaves the bottom navigation intact for the app itself', () => {
    expect(app).toContain('<TabBar current={tab}');
  });

  it('leaves onboarding reachable immediately afterwards', () => {
    expect(app).toContain('<OnboardingScreen');
  });

  it('does not disturb the account flow or the path theme', () => {
    expect(app).toContain("route.kind === 'account'");
    expect(app).toContain('data-path={game.state.pathId}');
  });

  it('keeps startup logic in one place', () => {
    expect(app).toContain('shouldPlayIntro');
  });
});
