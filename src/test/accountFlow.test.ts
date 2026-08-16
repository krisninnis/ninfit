import { describe, expect, it } from 'vitest';

import {
  MIN_PASSWORD_LENGTH,
  maskEmail,
  passwordChecks,
  signUpOutcome,
  validateSignUp,
} from '../ui/account/accountFlow';
import {
  ACCOUNT_CONFIRMED_HASH,
  ACCOUNT_HASH,
  TABS,
  hashForTab,
  looksLikeAuthReturn,
  parseRouteFromHash,
  parseTabFromHash,
} from '../ui/tabs';

/**
 * The NinFit ID flow rules, executed rather than read back as source text.
 *
 * The rest of the account suite asserts on file contents, which is the right tool for
 * "is the form still in the right screen". It is the wrong tool for "does the
 * validation still reject a short password", because a rule can stop running while
 * its source line survives. Everything testable by execution is tested here.
 */

const GOOD = 'a-long-enough-password';

describe('signup validation', () => {
  it('accepts a long, matching password that differs from the email', () => {
    expect(
      validateSignUp({ email: 'kris@example.com', password: GOOD, repeatPassword: GOOD }),
    ).toBeUndefined();
  });

  it('rejects a password under the minimum length', () => {
    const short = 'a'.repeat(MIN_PASSWORD_LENGTH - 1);
    expect(
      validateSignUp({ email: 'kris@example.com', password: short, repeatPassword: short }),
    ).toBe('Use at least 12 characters for your password.');
  });

  it('accepts a password of exactly the minimum length', () => {
    const exact = 'a'.repeat(MIN_PASSWORD_LENGTH);
    expect(
      validateSignUp({ email: 'kris@example.com', password: exact, repeatPassword: exact }),
    ).toBeUndefined();
  });

  it('rejects mismatched passwords', () => {
    expect(
      validateSignUp({
        email: 'kris@example.com',
        password: GOOD,
        repeatPassword: `${GOOD}x`,
      }),
    ).toBe('The passwords do not match.');
  });

  it('rejects a password equal to the email, whatever the casing or spacing', () => {
    const email = 'kris@example.com';
    expect(
      validateSignUp({ email: `  ${email.toUpperCase()}  `, password: email, repeatPassword: email }),
    ).toBe('Your password cannot be the same as your email address.');
  });

  it('reports length before mismatch, so the user fixes the real problem first', () => {
    expect(validateSignUp({ email: 'k@e.com', password: 'short', repeatPassword: 'other' })).toBe(
      'Use at least 12 characters for your password.',
    );
  });

  it('requires twelve characters', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(12);
  });
});

describe('the visible password requirements', () => {
  it('shows nothing as satisfied on an untouched form', () => {
    expect(passwordChecks({ email: '', password: '', repeatPassword: '' })).toEqual({
      longEnough: false,
      matches: false,
      differsFromEmail: false,
    });
  });

  it('does not call two empty passwords a match', () => {
    expect(passwordChecks({ email: '', password: '', repeatPassword: '' }).matches).toBe(false);
  });

  it('tracks each requirement independently', () => {
    expect(
      passwordChecks({ email: 'kris@example.com', password: GOOD, repeatPassword: GOOD }),
    ).toEqual({ longEnough: true, matches: true, differsFromEmail: true });
  });

  it('marks a short but matching password as matching and not long enough', () => {
    const checks = passwordChecks({ email: 'k@e.com', password: 'abc', repeatPassword: 'abc' });
    expect(checks.longEnough).toBe(false);
    expect(checks.matches).toBe(true);
  });
});

describe('what a signup result means', () => {
  it('maps a returned session to the connected state', () => {
    expect(signUpOutcome({ user: { id: 'u1' }, session: { access_token: 'x' } })).toBe(
      'connected',
    );
  });

  it('maps a user with NO session to the confirmation state', () => {
    // This is the case the old flow got wrong: it sent the user back to a sign-in
    // form with credentials that would not work until the email was confirmed.
    expect(signUpOutcome({ user: { id: 'u1' }, session: null })).toBe('confirm');
  });

  it('refuses to claim an email was sent when nothing came back', () => {
    expect(signUpOutcome({ user: null, session: null })).toBe('unknown');
  });
});

describe('masking the pending email', () => {
  it('keeps the first character and the domain', () => {
    expect(maskEmail('kris@example.com')).toBe('k•••@example.com');
  });

  it('never echoes the full local part', () => {
    const masked = maskEmail('christopher@example.com');
    expect(masked).not.toContain('christopher');
    expect(masked.endsWith('@example.com')).toBe(true);
  });

  it('caps the hidden run so length is not leaked', () => {
    expect(maskEmail('a@e.com')).toBe('a•••@e.com');
    expect(maskEmail('averyveryverylongname@e.com')).toBe('a••••@e.com');
  });

  it('masks anything that is not an address rather than echoing it', () => {
    expect(maskEmail('not-an-email')).toBe('•••');
    expect(maskEmail('@example.com')).toBe('•••');
    expect(maskEmail('kris@')).toBe('•••');
    expect(maskEmail('')).toBe('•••');
  });

  it('trims before masking', () => {
    expect(maskEmail('  kris@example.com  ')).toBe('k•••@example.com');
  });
});

describe('the account route', () => {
  it('recognises the dedicated NinFit ID experience', () => {
    expect(parseRouteFromHash(ACCOUNT_HASH)).toEqual({ kind: 'account', confirmed: false });
  });

  it('recognises a return from a confirmation email', () => {
    expect(parseRouteFromHash(ACCOUNT_CONFIRMED_HASH)).toEqual({
      kind: 'account',
      confirmed: true,
    });
  });

  it('is tolerant of casing, spacing and a trailing slash', () => {
    expect(parseRouteFromHash('  #/ACCOUNT/  ')).toEqual({ kind: 'account', confirmed: false });
    expect(parseRouteFromHash('#/Account/Confirmed')).toEqual({
      kind: 'account',
      confirmed: true,
    });
  });

  it('still routes every tab exactly as before', () => {
    for (const tab of TABS) {
      expect(parseRouteFromHash(hashForTab(tab.id))).toEqual({ kind: 'tab', tab: tab.id });
    }
  });

  it('sends anything unrecognised to Today rather than a blank screen', () => {
    expect(parseRouteFromHash('#/nonsense')).toEqual({ kind: 'tab', tab: 'today' });
    expect(parseRouteFromHash('')).toEqual({ kind: 'tab', tab: 'today' });
  });

  it('leaves tab parsing untouched, account hash included', () => {
    // The account route is not a tab, so the tab parser must fall back rather than
    // inventing a sixth destination.
    expect(parseTabFromHash(ACCOUNT_HASH)).toBe('today');
    expect(parseTabFromHash(ACCOUNT_CONFIRMED_HASH)).toBe('today');
  });

  it('is not offered as a tab in the tab bar', () => {
    expect(TABS.map((tab) => tab.id)).not.toContain('account');
  });
});

describe('returning from a confirmation email', () => {
  it('recognises an implicit-flow fragment that replaced our route', () => {
    expect(looksLikeAuthReturn('#access_token=abc&type=signup')).toBe(true);
    expect(parseRouteFromHash('#access_token=abc&refresh_token=def&type=signup')).toEqual({
      kind: 'account',
      confirmed: true,
    });
  });

  it('recognises a fragment appended to our route', () => {
    expect(parseRouteFromHash('#/account/confirmed#access_token=abc')).toEqual({
      kind: 'account',
      confirmed: true,
    });
  });

  it('routes an auth error back to the account experience rather than Today', () => {
    // Landing on Today after a failed link would look like nothing happened.
    expect(parseRouteFromHash('#error_code=otp_expired&error_description=expired')).toEqual({
      kind: 'account',
      confirmed: true,
    });
  });

  it('recognises the other email link types', () => {
    for (const type of ['magiclink', 'recovery', 'invite', 'email_change']) {
      expect(looksLikeAuthReturn(`#type=${type}`), type).toBe(true);
    }
  });

  it('does not mistake ordinary navigation for an auth return', () => {
    for (const hash of ['#/today', '#/profile', '#/account', '#/week', '', '#/nonsense']) {
      expect(looksLikeAuthReturn(hash), hash).toBe(false);
    }
  });

  it('does not fire on a word that merely contains a parameter name', () => {
    expect(looksLikeAuthReturn('#/my_access_token=1')).toBe(false);
    expect(looksLikeAuthReturn('#/prototype=signup')).toBe(false);
  });

  it('never reads a token, only notices one is present', () => {
    // The route carries a boolean and nothing else; the Supabase client is the only
    // thing that consumes the URL.
    const route = parseRouteFromHash('#access_token=super-secret-value&type=signup');
    expect(JSON.stringify(route)).not.toContain('super-secret-value');
    expect(route).toEqual({ kind: 'account', confirmed: true });
  });
});
