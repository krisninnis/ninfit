/**
 * The decisions behind the NinFit ID experience, with no React and no Supabase.
 *
 * WHY THIS IS A SEPARATE MODULE.
 *
 * Everything here is a rule rather than a rendering concern: what makes a password
 * acceptable, what a signup result means, how much of an email is safe to show. Kept
 * inside the component these would only be testable by reading the JSX back as text,
 * which is how a validation rule quietly stops running without any test noticing.
 * Pulled out, they are executed by the suite.
 *
 * It also keeps this file free of `@supabase/supabase-js`, so importing it costs the
 * core bundle nothing. Session and user shapes are described structurally rather than
 * imported, deliberately.
 */

/** Long, because length beats character-class rules. Matches the signup form. */
export const MIN_PASSWORD_LENGTH = 12;

export type AuthMode = 'sign_in' | 'sign_up';

/**
 * Where the dedicated experience currently is.
 *
 *   form       collecting credentials
 *   checking   a session may already exist; we are asking, and claiming nothing yet
 *   confirm    signup succeeded but needs an email confirmation before it is usable
 *   connected  a real session exists
 */
export type AuthPhase = 'form' | 'checking' | 'confirm' | 'connected';

export interface SignUpDraft {
  email: string;
  password: string;
  repeatPassword: string;
}

export interface PasswordChecks {
  longEnough: boolean;
  matches: boolean;
  differsFromEmail: boolean;
}

/**
 * The live state of each visible requirement.
 *
 * `matches` and `differsFromEmail` stay false while the relevant field is empty, so
 * an untouched form shows nothing as satisfied rather than flattering the user with
 * ticks they have not earned.
 */
export function passwordChecks(draft: SignUpDraft): PasswordChecks {
  const email = draft.email.trim().toLowerCase();
  const password = draft.password;

  return {
    longEnough: password.length >= MIN_PASSWORD_LENGTH,
    matches: draft.repeatPassword.length > 0 && password === draft.repeatPassword,
    differsFromEmail:
      email.length > 0 && password.length > 0 && password.toLowerCase() !== email,
  };
}

/**
 * The first thing wrong with a signup draft, or undefined if it is usable.
 *
 * Order matters: length is reported before mismatch, because telling somebody their
 * two short passwords do not match sends them to fix the wrong thing.
 */
export function validateSignUp(draft: SignUpDraft): string | undefined {
  if (draft.password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`;
  }

  if (draft.password !== draft.repeatPassword) {
    return 'The passwords do not match.';
  }

  const email = draft.email.trim();
  if (email.length > 0 && draft.password.toLowerCase() === email.toLowerCase()) {
    return 'Your password cannot be the same as your email address.';
  }

  return undefined;
}

/** The shape of a signup result, described rather than imported. */
export interface SignUpLike {
  user: { id?: string } | null;
  session: unknown | null;
}

export type SignUpOutcome =
  /** A session came back. The account is usable right now. */
  | 'connected'
  /** A user came back without a session: Supabase wants the email confirmed first. */
  | 'confirm'
  /** Neither. Something is wrong, and we must not claim an email was sent. */
  | 'unknown';

/**
 * What a signup result actually means.
 *
 * The `unknown` case exists because the honest failure here is silent: an anomalous
 * result with no user and no session would otherwise fall into the confirmation
 * branch and tell somebody to check an inbox that will never receive anything.
 */
export function signUpOutcome(result: SignUpLike): SignUpOutcome {
  if (result.session !== null && result.session !== undefined) return 'connected';
  if (result.user !== null && result.user !== undefined) return 'confirm';
  return 'unknown';
}

/**
 * An email with most of the local part hidden.
 *
 * Enough for somebody to recognise which address they typed, without printing it in
 * full on a screen that may be read over a shoulder. Anything that does not look like
 * an address is masked entirely rather than echoed back.
 */
export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0 || at === trimmed.length - 1) return '•••';

  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const first = local.slice(0, 1);
  const hidden = '•'.repeat(Math.min(Math.max(local.length - 1, 3), 4));

  return `${first}${hidden}@${domain}`;
}
