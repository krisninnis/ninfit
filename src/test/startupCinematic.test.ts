import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { createMemoryStorageAdapter, type StorageAdapter } from '../storage/StorageAdapter';
import {
  INTRO_SEEN_KEY,
  hasSeenIntro,
  markIntroSeen,
  shouldPlayIntro,
} from '../ui/startup/introState';
import {
  INTRO_SAFETY_TIMEOUT_MS,
  INTRO_STILL_HOLD_MS,
  INTRO_VIDEO_URL,
  INTRO_VOICEOVER_LINE,
  introVoiceover,
} from '../ui/startup/introMedia';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const ROOT = join(SRC, '..');
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const app = read('App.tsx');
const cinematic = read('ui', 'screens', 'StartupCinematic.tsx');
const media = read('ui', 'startup', 'introMedia.ts');

/**
 * The startup cinematic.
 *
 * The decisions worth defending are all about what happens when things go wrong: a
 * splash screen is the first thing a new user sees, and there is nothing else on
 * screen to explain a hang. So the behavioural tests here are mostly about the
 * cinematic getting OUT of the way - on a missing video, on blocked audio, on a
 * second launch - rather than about it appearing.
 */

// ---------------------------------------------------------------------------

describe('who sees the cinematic', () => {
  it('plays for a genuinely new install', () => {
    expect(shouldPlayIntro({ seen: false, onboardingComplete: false })).toBe(true);
  });

  it('does not play once it has been seen', () => {
    expect(shouldPlayIntro({ seen: true, onboardingComplete: false })).toBe(false);
  });

  it('does not play for someone who was already using NinFit', () => {
    // The upgrade path. Their flag is absent because the feature did not exist, and
    // greeting a long-standing user with "welcome to NinFit" would be absurd.
    expect(shouldPlayIntro({ seen: false, onboardingComplete: true })).toBe(false);
  });

  it('never plays again after both conditions are true', () => {
    expect(shouldPlayIntro({ seen: true, onboardingComplete: true })).toBe(false);
  });
});

describe('remembering that it has played', () => {
  let store: StorageAdapter;

  const fresh = () => createMemoryStorageAdapter();

  it('starts unseen', () => {
    store = fresh();
    expect(hasSeenIntro(store)).toBe(false);
  });

  it('is seen once marked, and stays seen across a reload', () => {
    store = fresh();
    markIntroSeen(store);

    expect(hasSeenIntro(store)).toBe(true);
    // A "reload" is a new reader over the same persisted bytes.
    const reloaded = createMemoryStorageAdapter({ [INTRO_SEEN_KEY]: store.get(INTRO_SEEN_KEY)! });
    expect(hasSeenIntro(reloaded)).toBe(true);
  });

  it('is idempotent', () => {
    store = fresh();
    markIntroSeen(store);
    markIntroSeen(store);
    expect(store.keys().filter((key) => key === INTRO_SEEN_KEY)).toHaveLength(1);
  });

  it('stores one flag and touches nothing else', () => {
    store = fresh();
    markIntroSeen(store);
    expect(store.keys()).toEqual([INTRO_SEEN_KEY]);
  });

  it('lets the user in even when the store refuses to write', () => {
    // A locked-down or full store must not crash the very first launch. Seeing the
    // intro twice is a far better failure than never reaching the app.
    const readOnly: StorageAdapter = {
      get: () => null,
      set: () => {
        throw new Error('QuotaExceededError');
      },
      remove: () => {},
      keys: () => [],
    };

    expect(() => markIntroSeen(readOnly)).not.toThrow();
    expect(hasSeenIntro(readOnly)).toBe(false);
  });

  it('keeps the flag out of the repository and the domain', () => {
    // Watching an intro is not a fitness fact: no schema version, no export.
    const repository = read('storage', 'repository.ts');
    expect(repository).not.toContain('introSeen');
    expect(read('domain', 'schema.ts')).not.toContain('introSeen');
    expect(INTRO_SEEN_KEY).toBe('ft:v1:introSeen');
  });
});

// ---------------------------------------------------------------------------

describe('no account is required', () => {
  it('decides purely from local state', () => {
    // The whole decision surface is two booleans, neither of them a session.
    expect(shouldPlayIntro.length).toBe(1);
    expect(code(read('ui', 'startup', 'introState.ts'))).not.toMatch(
      /session|supabase|signIn|account/i,
    );
  });

  it('never mentions auth in the cinematic itself', () => {
    expect(code(cinematic)).not.toMatch(/session|supabase|signIn|signUp|account/i);
  });

  it('requires no credentials of any kind at runtime', () => {
    // Particularly: the voiceover is a static file, not an ElevenLabs API call.
    for (const source of [code(cinematic), code(media)]) {
      expect(source).not.toMatch(/elevenlabs|api[_-]?key|xi-api|apiKey|token/i);
      expect(source).not.toMatch(/fetch\(|XMLHttpRequest/);
    }
  });
});

// ---------------------------------------------------------------------------

describe('media is served, not bundled', () => {
  it('references the video by URL rather than importing it', () => {
    expect(INTRO_VIDEO_URL).toContain('intro/ninfit-intro-v1.mp4');
    expect(media).not.toMatch(/^import .*\.mp4/m);
    expect(cinematic).not.toMatch(/^import .*\.mp4/m);
  });

  it('keeps the video URL in one module', () => {
    // No screen may hold a media URL of its own.
    expect(code(app)).not.toContain('.mp4');
    expect(code(cinematic)).not.toContain('.mp4');
    expect(cinematic).toContain('INTRO_VIDEO_URL');
  });

  it('honours the configured base path instead of assuming a domain root', () => {
    expect(media).toContain('import.meta.env');
    expect(media).toContain('BASE_URL');
  });

  it('ships the video in public/ where the build will copy it verbatim', () => {
    // `readFileSync` is typed here as utf8-only, so the file is read as text. That is
    // fine for what this checks: the four bytes before the box type are a big-endian
    // length - small integers, single-byte under UTF-8 - so these offsets stay
    // aligned, and a substantial decoded length still proves a real asset is present
    // rather than a placeholder or an LFS pointer.
    const content = readFileSync(join(ROOT, 'public', 'intro', 'ninfit-intro-v1.mp4'), 'utf8');

    // ISO Media / MP4 container: the 'ftyp' box type sits at byte offset 4.
    expect(content.slice(4, 8)).toBe('ftyp');
    expect(content.length).toBeGreaterThan(100_000);
  });
});

// ---------------------------------------------------------------------------

describe('the cinematic plays unbranded, because the clip brands itself', () => {
  /**
   * The MP4 carries its own logo card over its final ~2.4 seconds (it fades in
   * around 3.5s and holds to the 5.875s end). An overlaid wordmark therefore put the
   * logo on screen from the very first frame AND again at the end. The clip is now
   * left to play exactly as authored and the app adds nothing on top of it.
   */
  const videoBranch = cinematic.slice(
    cinematic.indexOf('reducedMotion ? ('),
    cinematic.indexOf('startup__controls'),
  );

  it('overlays no wordmark, strapline or veil while the video plays', () => {
    // The brand block exists exactly once, inside the reduced-motion branch.
    expect([...cinematic.matchAll(/startup__wordmark/g)]).toHaveLength(1);
    expect([...cinematic.matchAll(/startup__brand/g)]).toHaveLength(1);
    expect(cinematic).toContain('{reducedMotion ? (\n          <div className="startup__brand">');
  });

  it('has retired the contrast veil along with the overlay it protected', () => {
    // It existed only to keep overlaid text readable, and was dimming the reveal.
    expect(cinematic).not.toContain('startup__veil');
    expect(read('styles', 'screens', 'startup.css')).not.toContain('.startup__veil {');
  });

  it('adds no text of its own over the cinematic', () => {
    // Only the audio caption may appear, and only when a recording is playing.
    const strings = [...videoBranch.matchAll(/>\s*[A-Z][A-Za-z ,.'’—•-]{3,}\s*</g)];
    expect(strings.map((match) => match[0])).toEqual([]);
  });

  it('leaves the clip to supply the logo, rather than double-branding the end', () => {
    // No second app-rendered end card: the video already holds one for ~2.4s.
    expect(cinematic).not.toMatch(/endCard|logoCard|showLogo/i);
  });
});

describe('the real brand asset is used', () => {
  it('imports the wordmark rather than redrawing it', () => {
    // Still required: the reduced-motion still has no video to brand it, so the app
    // supplies the logo there and it must be the genuine asset.
    expect(cinematic).toContain("from '../../assets/brand/ninfit-wordmark-dark.svg'");
    expect(cinematic).toContain('<img className="startup__wordmark"');
    expect(cinematic).toContain('alt="NinFit"');
  });

  it('does not spell the logo out as live text or CSS', () => {
    const startupCss = read('styles', 'screens', 'startup.css');
    expect(startupCss).not.toContain('content: "NinFit"');
    expect(code(cinematic)).not.toMatch(/>\s*NinFit\s*</);
  });

  it('uses the white-on-dark variant, which is the one that exists', () => {
    const svg = readFileSync(
      join(SRC, 'assets', 'brand', 'ninfit-wordmark-dark.svg'),
      'utf8',
    );
    expect(svg).toContain('#FFFFFF');
    expect(svg).toContain('aria-label="NinFit"');
  });

  it('shows the strapline in the approved order', () => {
    expect(cinematic).toContain('Move • Grow • Evolve');
  });
});

// ---------------------------------------------------------------------------

describe('nobody gets stuck', () => {
  it('has a hard timeout shorter than anyone would tolerate', () => {
    // The asset is 5.875s. This is the backstop for events that never arrive.
    expect(INTRO_SAFETY_TIMEOUT_MS).toBeGreaterThan(6_000);
    expect(INTRO_SAFETY_TIMEOUT_MS).toBeLessThanOrEqual(10_000);
    expect(cinematic).toContain('setTimeout(finish, INTRO_SAFETY_TIMEOUT_MS)');
  });

  it('leaves on every exit a media element can offer', () => {
    expect(cinematic).toContain('onEnded={finish}');
    // A missing, blocked or undecodable video must not hold the door shut.
    expect(cinematic).toContain('onError={finish}');
  });

  it('offers an explicit way out', () => {
    expect(cinematic).toContain('Skip');
    expect(cinematic).toContain('onClick={finish}');
  });

  it('leaves on Escape, as any overlay should', () => {
    expect(cinematic).toContain("event.key === 'Escape'");
  });

  it('completes exactly once however many exits fire', () => {
    // Ending and skipping can race; routing must not be entered twice.
    expect(cinematic).toContain('if (finished.current) return');
    expect(cinematic).toContain('finished.current = true');
  });

  it('hands control back rather than routing by itself', () => {
    // The cinematic knows nothing about tabs, hashes or onboarding.
    expect(code(cinematic)).not.toContain('location.hash');
    expect(code(cinematic)).not.toContain('parseRouteFromHash');
    expect(cinematic).toContain('onComplete');
  });
});

// ---------------------------------------------------------------------------

describe('audio never blocks anything', () => {
  it('is honestly reported as not yet present', () => {
    const voiceover = introVoiceover();
    expect(voiceover.available).toBe(false);
    expect(voiceover.url).toContain('intro/ninfit-intro-voiceover-v1.mp3');
  });

  it('requests no audio at all while the recording is absent', () => {
    // Otherwise every first launch fires a guaranteed 404.
    expect(cinematic).toContain('voiceover.available ? (');
    expect(cinematic).toContain('if (!voiceover.available) return');
  });

  it('carries on silently when the browser blocks autoplay', () => {
    expect(cinematic).toContain('.catch(');
    expect(cinematic).toContain('setSoundBlocked(true)');
    // Blocked audio offers a control; it never gates the cinematic finishing.
    expect(cinematic).toContain('Play sound');
  });

  it('captions the line whenever there is speech to caption', () => {
    // Tied to the audio rather than shown unconditionally: with a recording playing
    // this is what a deaf or hard-of-hearing user reads instead of hearing it, and
    // with no recording there is nothing to caption and the cinematic runs clean.
    expect(INTRO_VOICEOVER_LINE).toBe(
      'Welcome to NinFit. Move, grow, evolve — one step at a time.',
    );
    expect(cinematic).toContain('voiceover.available ? <p className="startup__line">');
  });

  it('does not wait for audio before finishing', () => {
    // `finish` is never called from the audio path.
    const audioEffect = cinematic.slice(
      cinematic.indexOf('if (!voiceover.available) return'),
      cinematic.indexOf('const playSound'),
    );
    expect(audioEffect).not.toContain('finish()');
  });
});

// ---------------------------------------------------------------------------

describe('accessibility', () => {
  it('respects a preference for reduced motion', () => {
    expect(cinematic).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
    expect(cinematic).toContain('reducedMotion ? (');
  });

  it('shows a still presentation rather than suppressing the welcome', () => {
    expect(cinematic).toContain('startup__still');
    const startupCss = read('styles', 'screens', 'startup.css');
    expect(startupCss).toContain('.startup__still');
  });

  it('brands the still card, since no video is there to do it', () => {
    // Without this the reduced-motion path would be a blank gradient.
    expect(cinematic).toContain('{reducedMotion ? (\n          <div className="startup__brand">');
  });

  it('moves the still card on rather than leaving it until the safety timeout', () => {
    expect(INTRO_STILL_HOLD_MS).toBeGreaterThan(1_500);
    expect(INTRO_STILL_HOLD_MS).toBeLessThan(INTRO_SAFETY_TIMEOUT_MS);
    expect(cinematic).toContain('setTimeout(finish, INTRO_STILL_HOLD_MS)');
  });

  it('requests no video download at all under reduced motion', () => {
    // The <video> is inside the false branch, so nothing is fetched.
    const stage = cinematic.slice(
      cinematic.indexOf('reducedMotion ? ('),
      cinematic.indexOf('startup__veil'),
    );
    expect(stage.indexOf('startup__still')).toBeLessThan(stage.indexOf('<video'));
  });

  it('moves focus to the control, so a keyboard user is never hunting', () => {
    expect(cinematic).toContain('skipRef.current?.focus()');
    expect(cinematic).toContain('ref={skipRef}');
  });

  it('marks the decorative media as decorative', () => {
    expect(cinematic).toContain('aria-hidden="true"');
  });

  it('survives an environment with no matchMedia', () => {
    expect(cinematic).toContain("typeof window.matchMedia !== 'function'");
  });
});

// ---------------------------------------------------------------------------

describe('it does not disturb the running app', () => {
  // The onboarding BRANCH, not the first mention of the flag - `game.needsOnboarding`
  // is also read in the `introDone` initialiser above it, which made an earlier
  // version of these two tests compare the wrong positions and silently slice an
  // empty string.
  const ONBOARDING_BRANCH =
    'if ((game.needsOnboarding || revealingCompanion) && !dismissedOnboarding)';
  const INTRO_BRANCH = 'if (!introDone)';

  it('renders before onboarding and before any tab', () => {
    const shell = code(app);
    const introAt = shell.indexOf(INTRO_BRANCH);
    const onboardingAt = shell.indexOf(ONBOARDING_BRANCH);

    expect(introAt).toBeGreaterThan(-1);
    expect(onboardingAt).toBeGreaterThan(-1);
    expect(introAt).toBeLessThan(onboardingAt);
  });

  it('shows no navigation while it plays', () => {
    // It returns its own root; the shell, TabBar and backdrop are all below it.
    expect(app).toContain('<StartupCinematic');

    const shell = code(app);
    const introBranch = shell.slice(
      shell.indexOf(INTRO_BRANCH),
      shell.indexOf(ONBOARDING_BRANCH),
    );

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
    // The guard also keeps the screen mounted through the hatch and the reveal.
    expect(app).toContain('(game.needsOnboarding || revealingCompanion) && !dismissedOnboarding');
  });

  it('does not disturb the account flow or the path theme', () => {
    expect(app).toContain('<NinFitIdScreen');
    expect([...app.matchAll(/data-path=/g)]).toHaveLength(1);
    expect(app).toContain('routeAfterHashChange');
  });

  it('keeps startup logic in one place', () => {
    // No second screen may decide whether the intro plays.
    for (const screen of ['TodayScreen', 'ProfileScreen', 'OnboardingScreen']) {
      expect(read('ui', 'screens', `${screen}.tsx`)).not.toContain('shouldPlayIntro');
    }
  });
});
