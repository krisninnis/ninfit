import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  journeyCompanionContext,
  journeyCompanionMessage,
  type JourneyCompanionContext,
  type JourneyCompanionFacts,
} from '../domain/game/journeyCompanionContext';
import type { MascotFamily, MascotPersonality } from '../domain/game/types';
import {
  JOURNEY_COMPANION_LIFETIME,
  JOURNEY_COMPANION_PRESENTATION,
  journeyCompanionLifetime,
  journeyCompanionPresence,
  journeyCompanionPresentation,
} from '../ui/journeyCompanionPresentation';

/**
 * Architectural guards for the Journey Home path companion.
 *
 * The companion is downstream presentation. These tests exist to keep it there: it
 * may react to Journey truth that already exists, and it may never create, mutate,
 * persist, celebrate or fabricate any of it.
 */

const SRC = fileURLToPath(new URL('..', import.meta.url));
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const projection = read('domain', 'game', 'journeyCompanionContext.ts');
const presentation = read('ui', 'journeyCompanionPresentation.ts');
const component = read('ui', 'components', 'JourneyCompanion.tsx');
const home = read('ui', 'screens', 'JourneyScreen.tsx');

const NEW_MODULES: ReadonlyArray<[string, string]> = [
  ['journeyCompanionContext.ts', projection],
  ['journeyCompanionPresentation.ts', presentation],
  ['JourneyCompanion.tsx', component],
];

const CONTEXTS: readonly JourneyCompanionContext[] = [
  'journey_continuing',
  'journey_history',
  'journey_invitation',
];

const PERSONALITIES: readonly MascotPersonality[] = ['quiet', 'normal', 'chatty'];

const facts = (
  hasActiveJourney: boolean,
  hasCompletedJourney: boolean,
): JourneyCompanionFacts => ({ hasActiveJourney, hasCompletedJourney });

const FAMILY: MascotFamily = { id: 'tortoise', name: 'Tortoise', glyph: 'T' };

// --- The projection ---------------------------------------------------------

describe('journey companion context', () => {
  it('is total over every combination of the two facts it is given', () => {
    expect(journeyCompanionContext(facts(true, true))).toBe('journey_continuing');
    expect(journeyCompanionContext(facts(true, false))).toBe('journey_continuing');
    expect(journeyCompanionContext(facts(false, true))).toBe('journey_history');
    expect(journeyCompanionContext(facts(false, false))).toBe('journey_invitation');
  });

  it('lets a live Journey outrank history, because the live thing is the thing', () => {
    expect(journeyCompanionContext(facts(true, true))).toBe('journey_continuing');
  });

  it('invites rather than comments when nothing has happened yet', () => {
    // Being new is not a lapse and must never be worded as one.
    expect(journeyCompanionContext(facts(false, false))).toBe('journey_invitation');
  });

  it('is pure: same facts in, same context out, and the input is untouched', () => {
    const input = facts(false, true);
    const frozen = Object.freeze({ ...input });
    expect(journeyCompanionContext(frozen)).toBe(journeyCompanionContext(frozen));
    expect(input).toEqual({ hasActiveJourney: false, hasCompletedJourney: true });
  });
});

// --- What the projection is structurally unable to see -----------------------

describe('the companion consumes Journey truth and cannot create any', () => {
  it('accepts two booleans, so no Journey measurement can reach presentation', () => {
    const executable = code(projection);
    expect(executable).toContain('hasActiveJourney: boolean;');
    expect(executable).toContain('hasCompletedJourney: boolean;');
    // No third field, and in particular no Journey, metric, route or number.
    const fields = executable
      .slice(
        executable.indexOf('interface JourneyCompanionFacts'),
        executable.indexOf('}', executable.indexOf('interface JourneyCompanionFacts')),
      )
      .match(/^\s*\w+[?]?:/gm) ?? [];
    expect(fields).toHaveLength(2);
  });

  it('never imports a Journey, a metric, a route or storage', () => {
    for (const [name, source] of NEW_MODULES) {
      const imports = code(source).match(/^import[\s\S]*?from\s+'[^']+';$/gm) ?? [];
      const joined = imports.join('\n');
      expect(joined, `${name} imports Journey truth`).not.toMatch(
        /domain\/journey|journeyDistance|journeyGps|journeyRecorder|journeyRecovery|journeyRoute/,
      );
      expect(joined, `${name} imports storage or app orchestration`).not.toMatch(
        /storage\/|app\/|bootstrap|repository/,
      );
    }
  });

  it('never names a distance, duration, route, PB, trophy, XP or reward', () => {
    for (const [name, source] of NEW_MODULES) {
      expect(code(source), `${name} reaches fitness truth`).not.toMatch(
        /distance|duration|elapsed|moving_seconds|metrics|route|latitude|longitude|accepted[Pp]oints|personalBest|\bpb\b|trophy|\bxp\b|reward/i,
      );
    }
  });

  it('introduces no persistence of its own', () => {
    for (const [name, source] of NEW_MODULES) {
      expect(code(source), `${name} persists something`).not.toMatch(
        /localStorage|sessionStorage|indexedDB|schemaVersion|\.set\(|save[A-Z]|persist/i,
      );
    }
  });

  it('mutates no game state: nothing grants, syncs, hatches or evolves', () => {
    for (const [name, source] of [...NEW_MODULES, ['JourneyScreen.tsx', home]] as const) {
      expect(code(source), `${name} mutates the game layer`).not.toMatch(
        /grantRewards|syncGame|useGame|saveGameState|hatchEggNow|evolveMascotNow|deriveRewards|switchPath/,
      );
    }
  });
});

// --- The copy ---------------------------------------------------------------

describe('journey companion copy', () => {
  it('answers for every context and personality from a fixed table', () => {
    for (const context of CONTEXTS) {
      for (const personality of PERSONALITIES) {
        const message = journeyCompanionMessage(context, personality);
        expect(message === undefined || typeof message === 'string').toBe(true);
        if (typeof message === 'string') expect(message.length).toBeGreaterThan(0);
      }
    }
  });

  it('lets the quiet personality stay silent', () => {
    expect(journeyCompanionMessage('journey_invitation', 'quiet')).toBeUndefined();
    expect(journeyCompanionMessage('journey_history', 'quiet')).toBeUndefined();
  });

  it('states no number, so nothing can be read as a measurement', () => {
    for (const context of CONTEXTS) {
      for (const personality of PERSONALITIES) {
        expect(journeyCompanionMessage(context, personality) ?? '').not.toMatch(/\d/);
      }
    }
  });

  it('carries no guilt, streak, score or pressure vocabulary', () => {
    for (const context of CONTEXTS) {
      for (const personality of PERSONALITIES) {
        expect(journeyCompanionMessage(context, personality) ?? '').not.toMatch(
          /streak|missed|failed|behind|should|must|only|again today|don't|keep it up|goal|target|score|record/i,
        );
      }
    }
  });

  it('looks copy up rather than composing it', () => {
    const executable = code(projection);
    expect(executable).toContain('return JOURNEY_MESSAGES[context][personality];');
    // No template literals and no concatenation anywhere in the module.
    expect(executable).not.toMatch(/`/);
    expect(executable).not.toMatch(/\+\s*['"]|['"]\s*\+/);
  });
});

// --- Lifetime: historical completion is not a fresh event --------------------

describe('journey companion lifetime', () => {
  it('classifies every context deliberately in both maps', () => {
    expect(Object.keys(JOURNEY_COMPANION_PRESENTATION).sort()).toEqual([...CONTEXTS].sort());
    expect(Object.keys(JOURNEY_COMPANION_LIFETIME).sort()).toEqual([...CONTEXTS].sort());
  });

  it('makes every Journey context standing, never a moment', () => {
    for (const context of CONTEXTS) {
      expect(journeyCompanionLifetime(context)).toBe('standing');
    }
    expect(Object.values(JOURNEY_COMPANION_LIFETIME)).not.toContain('moment');
  });

  it('leaves celebration unreachable from Journey Home', () => {
    // A Journey stored last spring looks identical on load to one finished a minute
    // ago, so nothing here may treat stored history as something that just happened.
    for (const context of CONTEXTS) {
      expect(journeyCompanionPresentation(context)).not.toBe('celebrate');
    }
    expect(Object.values(JOURNEY_COMPANION_PRESENTATION)).not.toContain('celebrate');
    expect(journeyCompanionPresentation('journey_history')).toBe('warm');
  });

  it('invents no freshness identity, timer or dwell for Journey', () => {
    for (const [name, source] of NEW_MODULES) {
      expect(code(source), `${name} invents freshness`).not.toMatch(
        /setTimeout|setInterval|requestAnimationFrame|Date\.now|new Date|DWELL|freshMomentKey|momentActive/,
      );
    }
  });

  it('holds no state at all, so nothing can get stuck looking excited', () => {
    expect(code(component)).not.toMatch(/useState|useEffect|useRef|useReducer/);
  });
});

// --- Presence: the egg stays a secret ---------------------------------------

describe('journey companion presence', () => {
  it('shows nothing at all until the egg has hatched', () => {
    for (const combination of [[true, true], [true, false], [false, true], [false, false]] as const) {
      expect(
        journeyCompanionPresence(undefined, facts(combination[0], combination[1])),
      ).toBeUndefined();
    }
  });

  it('passes the resolved family straight through rather than rebuilding it', () => {
    const presence = journeyCompanionPresence(FAMILY, facts(false, true));
    expect(presence?.family).toBe(FAMILY);
    expect(presence?.context).toBe('journey_history');
  });

  it('pairs the family with the context the facts decided', () => {
    expect(journeyCompanionPresence(FAMILY, facts(true, false))?.context).toBe(
      'journey_continuing',
    );
    expect(journeyCompanionPresence(FAMILY, facts(false, false))?.context).toBe(
      'journey_invitation',
    );
  });
});

// --- Opal is not the Journey companion --------------------------------------

describe('the path mascot owns Journey Home, not Opal', () => {
  it('never reaches Opal from the Journey companion path', () => {
    for (const [name, source] of [...NEW_MODULES, ['JourneyScreen.tsx', home]] as const) {
      expect(code(source), `${name} reaches Opal`).not.toMatch(
        /\bOpal\b|\bCOMPANION_PRESENTATION\b|\bCompanionId\b|\bCOMPANION_ID\b|'opal'|opal__/,
      );
    }
  });

  it('resolves the companion from the path mascot family instead', () => {
    expect(home).toContain('visibleMascotFamily');
    expect(code(component)).toContain('presence.family.name');
    expect(code(component)).toContain('presence.family.glyph');
  });

  it('adds one strip and no second character card: no level, bar or controls', () => {
    const executable = code(component);
    expect(executable).not.toMatch(/levelProgress|xpbar|Level |EggArt|<button|onHatch|onEvolve/);
  });
});

// --- Wiring -----------------------------------------------------------------

describe('journey home wiring', () => {
  it('renders the companion from the presence projection', () => {
    expect(home).toContain('journeyCompanionPresence(');
    expect(home).toContain('<JourneyCompanion');
    expect(home).toContain('presence={companion}');
  });

  it('passes only two booleans into the companion', () => {
    expect(home).toContain('hasActiveJourney: active !== null');
    expect(home).toContain('hasCompletedJourney: history.length > 0');
  });

  it('keeps consuming the Journey truth the screen already owned', () => {
    expect(home).toContain('loadJourneyHistory(storage)');
    expect(home).toContain('launch.loadActive()');
    expect(home).toContain('createJourneyLaunchController');
  });

  it('reads game state without syncing, granting or writing it', () => {
    expect(home).toContain('repository.getGameState()');
    expect(home).toContain('repository.getGameSettings()');
    expect(code(home)).not.toMatch(/repository\.save|adapter\.set|storage\.set/);
  });

  it('records no Journey and rewrites no Journey history', () => {
    expect(code(home)).not.toMatch(
      /saveJourneyToHistory|replaceJourneyHistory|removeJourneyFromHistory|saveActiveJourneySnapshot|clearActiveJourneySnapshot/,
    );
  });

  it('changes no Journey privacy or route behaviour', () => {
    expect(code(home)).not.toMatch(
      /privacy|visibility|maskSensitiveStartEnd|preciseRouteCloudSync|latitude|longitude|acceptedPoints|segmentStarts/,
    );
  });

  it('leaves the companion out of the screen entirely when there is none', () => {
    expect(home).toContain('{companion !== undefined ? (');
  });
});

// --- Presentation stays presentation ----------------------------------------

describe('the companion stays downstream of Journey', () => {
  it('is never imported by Journey domain, app or storage code', () => {
    for (const path of [
      ['domain', 'journey.ts'],
      ['domain', 'journeyRecorder.ts'],
      ['domain', 'journeyRecovery.ts'],
      ['domain', 'journeyGpsRuntime.ts'],
      ['domain', 'journeyRoutePrivacy.ts'],
      ['app', 'journeyLaunchController.ts'],
      ['app', 'journeyRecoveryController.ts'],
      ['app', 'journeyGpsRuntimeController.ts'],
      ['storage', 'journeyHistory.ts'],
      ['storage', 'activeJourneySnapshot.ts'],
    ]) {
      expect(read(...path), `${path.join('/')} depends on companion presentation`).not.toMatch(
        /journeyCompanion|JourneyCompanion/,
      );
    }
  });

  it('reuses the existing companion vocabulary rather than declaring a second one', () => {
    expect(presentation).toContain("from './companionReactionPresentation'");
    expect(code(presentation)).not.toMatch(
      /type CompanionReactionPresentation\s*=|type CompanionReactionLifetime\s*=/,
    );
  });

  it("leaves Today's companion untouched", () => {
    const today = code(read('ui', 'components', 'GameHeader.tsx'));
    expect(today).not.toMatch(/journeyCompanion|JourneyCompanion/);
  });
});
