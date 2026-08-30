import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The REAL parser out of the installed auth-js, not a copy of it. A reimplementation
// here would test my understanding of Supabase rather than Supabase, which is exactly
// the mistake that let the original defect through: the redirect looked correct, and
// nothing ever ran it past the code that actually consumes it.
//
// This is a deep import because `parseParametersFromURL` is not re-exported from the
// package entry point. If a future upgrade moves it, this import throws and the suite
// fails loudly - which is the right outcome. A silently skipped callback test would
// be worse than no test at all.
import { parseParametersFromURL } from '@supabase/auth-js/dist/main/lib/helpers.js';

import { confirmationRedirectUrl } from '../data/supabase/auth';
import {
  looksLikeAuthReturn,
  parseRouteFromHash,
  routeAfterHashChange,
  type AppRoute,
} from '../ui/tabs';

/**
 * The email confirmation callback, end to end.
 *
 * THE BUG THIS EXISTS TO PREVENT.
 *
 * We are on the implicit flow, so Supabase appends its tokens to the redirect URL as
 * a FRAGMENT. The redirect used to be `${origin}/#/account/confirmed`, which already
 * ended in a fragment, so the browser saw one fragment reading
 * `/account/confirmed#access_token=…`. `URLSearchParams` split that on `&` and `=`
 * and produced a first key of `"/account/confirmed#access_token"`. No `access_token`
 * key existed, `_isImplicitGrantCallback` returned false, and the session was never
 * established. Nothing threw. The email really was confirmed server-side, so the only
 * visible symptom was a login form where a welcome should have been.
 *
 * Every assertion below fails if the redirect grows a fragment again.
 */

const ORIGIN = 'https://ninfit.example';

/** How GoTrue hands an implicit-flow result back: fragment appended to redirectTo. */
function supabaseReturnUrl(redirectTo: string): string {
  return `${redirectTo}#access_token=AAA.BBB.CCC&refresh_token=DDD&expires_in=3600&token_type=bearer&type=signup`;
}

function hashOf(url: string): string {
  return new URL(url).hash;
}

// ---------------------------------------------------------------------------

describe('the confirmation redirect', () => {
  it('carries no fragment, so Supabase has the fragment to itself', () => {
    const redirect = confirmationRedirectUrl(ORIGIN);

    expect(redirect).toBe(`${ORIGIN}/`);
    expect(redirect, 'the redirect must not contain a fragment').not.toContain('#');
    expect(new URL(redirect).hash).toBe('');
  });

  it('is a real, absolute URL', () => {
    expect(() => new URL(confirmationRedirectUrl(ORIGIN))).not.toThrow();
  });
});

// ---------------------------------------------------------------------------

describe("auth-js finds the token in what Supabase actually sends back", () => {
  it('detects access_token in the real return URL', () => {
    const url = supabaseReturnUrl(confirmationRedirectUrl(ORIGIN));
    const params = parseParametersFromURL(url);

    // This single assertion is the whole regression. It was false before the fix.
    expect(
      params.access_token,
      `auth-js found no access_token in ${url} - the confirmation link will not sign anybody in`,
    ).toBeDefined();
    expect(params.access_token).toBe('AAA.BBB.CCC');
  });

  it('also recovers the refresh token and the callback type', () => {
    const params = parseParametersFromURL(supabaseReturnUrl(confirmationRedirectUrl(ORIGIN)));

    expect(params.refresh_token).toBe('DDD');
    expect(params.type).toBe('signup');
  });

  it('satisfies the same condition auth-js gates the callback on', () => {
    // Mirrors `_isImplicitGrantCallback`: access_token OR an error field.
    const params = parseParametersFromURL(supabaseReturnUrl(confirmationRedirectUrl(ORIGIN)));
    const isImplicitGrantCallback = Boolean(
      params.access_token || params.error || params.error_description || params.error_code,
    );

    expect(isImplicitGrantCallback).toBe(true);
  });

  it('PROVES a hash route breaks it, so the fix cannot be quietly reverted', () => {
    // The exact shape that shipped broken. If somebody restores a hash route and
    // this stops failing, the parser has changed and the test above needs revisiting.
    const broken = parseParametersFromURL(supabaseReturnUrl(`${ORIGIN}/#/account/confirmed`));

    expect(broken.access_token).toBeUndefined();
    expect(Object.keys(broken)).toContain('/account/confirmed#access_token');
  });

  it('is not fooled by a redirect with a bare trailing hash either', () => {
    const broken = parseParametersFromURL(supabaseReturnUrl(`${ORIGIN}/#`));
    expect(broken.access_token).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------

describe('NinFit routes the callback into the account experience', () => {
  const returnUrl = supabaseReturnUrl(confirmationRedirectUrl(ORIGIN));

  it('recognises the callback fragment as an auth return', () => {
    expect(looksLikeAuthReturn(hashOf(returnUrl))).toBe(true);
  });

  it('lands the user on the confirmation route rather than Today', () => {
    expect(parseRouteFromHash(hashOf(returnUrl))).toEqual({
      kind: 'account',
      confirmed: true,
    });
  });

  it('routes an expired or refused link to the account screen too', () => {
    // Landing on Today after a failed link would look like nothing happened at all.
    const failure = `${confirmationRedirectUrl(ORIGIN)}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`;
    expect(parseRouteFromHash(hashOf(failure))).toEqual({ kind: 'account', confirmed: true });
  });
});

// ---------------------------------------------------------------------------

describe('the user survives auth-js clearing the fragment', () => {
  /**
   * After a successful callback auth-js runs `window.location.hash = ''` to get the
   * tokens out of the address bar. Assigning to `location.hash` fires `hashchange`.
   * Parsed naively, that empty hash is "the user went to Today" - which would yank
   * somebody off the account screen at the exact moment their session appeared.
   */
  const confirmed: AppRoute = { kind: 'account', confirmed: true };

  it('holds the confirmation route when the fragment is cleared', () => {
    expect(routeAfterHashChange(confirmed, '')).toEqual(confirmed);
    expect(routeAfterHashChange(confirmed, '#')).toEqual(confirmed);
  });

  it('still lets the user leave deliberately', () => {
    // Every real navigation sets a non-empty hash, so the hold cannot trap anyone.
    expect(routeAfterHashChange(confirmed, '#/today')).toEqual({ kind: 'tab', tab: 'today' });
    expect(routeAfterHashChange(confirmed, '#/profile')).toEqual({
      kind: 'tab',
      tab: 'profile',
    });
  });

  it('does not hold any other route on an empty hash', () => {
    // Only a confirmation in progress gets this treatment.
    const unconfirmed: AppRoute = { kind: 'account', confirmed: false };
    expect(routeAfterHashChange(unconfirmed, '')).toEqual({ kind: 'tab', tab: 'today' });
    expect(routeAfterHashChange({ kind: 'tab', tab: 'week' }, '')).toEqual({
      kind: 'tab',
      tab: 'today',
    });
  });

  it('is actually wired into the app shell, not just available', () => {
    // A pure function nothing calls would pass every test above and fix nothing.
    const app = readFileSync(fileURLToPath(new URL('../App.tsx', import.meta.url)), 'utf8');
    expect(app).toContain('routeAfterHashChange');
    expect(app).toContain("window.addEventListener('hashchange', syncFromHash)");
  });

  it('follows a normal hash change exactly as before', () => {
    for (const [hash, tab] of [
      ['#/week', 'week'],
      ['#/progress', 'progress'],
      ['#/settings', 'settings'],
    ] as const) {
      expect(routeAfterHashChange({ kind: 'tab', tab: 'today' }, hash)).toEqual({
        kind: 'tab',
        tab,
      });
    }
    expect(routeAfterHashChange({ kind: 'tab', tab: 'today' }, '#/data')).toEqual({
      kind: 'data',
    });
  });
});

// ---------------------------------------------------------------------------

describe('the whole journey, in order', () => {
  it('signup -> email -> link -> callback -> session -> connected state', () => {
    // 1. Signing up asks Supabase to return to a fragment-free URL.
    const redirect = confirmationRedirectUrl(ORIGIN);
    expect(redirect).not.toContain('#');

    // 2. The user follows the link; Supabase appends its tokens as a fragment.
    const returned = supabaseReturnUrl(redirect);

    // 3. NinFit reads the URL first and heads for the account experience.
    const route = parseRouteFromHash(hashOf(returned));
    expect(route).toEqual({ kind: 'account', confirmed: true });

    // 4. auth-js finds the token, so a session is genuinely established.
    expect(parseParametersFromURL(returned).access_token).toBeDefined();

    // 5. auth-js clears the fragment; the user stays where they are.
    expect(routeAfterHashChange(route, '')).toEqual(route);

    // 6. And leaves under their own steam when they choose to.
    expect(routeAfterHashChange(route, '#/today')).toEqual({ kind: 'tab', tab: 'today' });
  });
});
