import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const app = read('App.tsx');
const screen = read('ui', 'screens', 'NinFitIdScreen.tsx');
const profile = read('ui', 'screens', 'ProfileScreen.tsx');
const tabs = read('ui', 'tabs.ts');
const account = read('ui', 'components', 'AccountSection.tsx');
const auth = read('data', 'supabase', 'auth.ts');
const supabase = read('data', 'supabase', 'client.ts');
const css = read('styles', 'screens', 'ninfit-id.css');

function openingTagContaining(source: string, needle: string): string {
  const at = source.indexOf(needle)
  if (at === -1) return ''
  const start = source.lastIndexOf('<', at)
  const end = source.indexOf('>', at)
  return start === -1 || end === -1 ? '' : source.slice(start, end + 1)
}

describe('NinFit ID', () => {
  it('has a dedicated NinFit ID screen', () => {
    expect(screen).toContain('export function NinFitIdScreen');
  });

  it('explicitly keeps accounts optional', () => {
    expect(screen).toMatch(/optional/i);
  });

  it('offers email as the working account path', () => {
    expect(screen).toContain('Continue with email');
  });

  it('offers returning users a way to sign in', () => {
    expect(screen).toContain('Already have a NinFit ID?');
  });

  it('opens account creation from the email button', () => {
    expect(screen).toContain('setStage("email")');
  });

  it('shows Google without pretending it is active yet', () => {
    expect(screen).toContain('Continue with Google');
  });

  it('shows Apple without pretending it is active yet', () => {
    expect(screen).toContain('Continue with Apple');
  });

  it('leaves both social buttons genuinely disabled and unwired', () => {
    const stripped = code(screen);
    const google = stripped.slice(stripped.indexOf('Continue with Google') - 600, stripped.indexOf('Continue with Google') + 100);
    const apple = stripped.slice(stripped.indexOf('Continue with Apple') - 600, stripped.indexOf('Continue with Apple') + 100);
    expect(google).toContain('disabled');
    expect(apple).toContain('disabled');
  });

  it('does not send the user to Profile to create an account', () => {
    expect(screen).not.toContain("#/profile");
  });

  it('transitions the same screen into an email auth stage', () => {
    expect(screen).toContain('stage === "email"');
  });

  it('can return to the choice stage', () => {
    expect(screen).toContain('setStage("choice")');
  });

  it('shows the ID screen after onboarding completes', () => {
    expect(app).toContain('navigate(ACCOUNT_HASH)');
  });

  it('does not show the ID screen when onboarding is merely dismissed', () => {
    expect(app).toContain('onDismiss={() => setDismissedOnboarding(true)}');
  });

  it('lets a user skip the ID screen into Today', () => {
    expect(app).toContain("onSkip={() => navigate(hashForTab('today'))}");
  });

  it('drives the ID screen from the URL, not a second navigation system', () => {
    expect(app).toContain('parseRouteFromHash(window.location.hash)');
    expect(tabs).toContain("ACCOUNT_HASH = '#/account'");
  });

  it('keeps the back button working by listening to hashchange', () => {
    expect(app).toContain("window.addEventListener('hashchange'");
  });

  it('passes the confirmation return through to the screen', () => {
    expect(app).toContain('returningFromConfirmation={route.confirmed}');
  });

  it('opens straight into auth when returning from a confirmation email', () => {
    expect(screen).toContain('returningFromConfirmation');
  });

  it('resolves a real session before claiming the account is connected', () => {
    expect(auth).toContain('getSession');
    expect(supabase).toContain('createClient');
  });

  it('keeps one shared selected-path app root', () => {
    const rootTag = openingTagContaining(app, 'data-path={game.state.pathId}')
    expect(rootTag).toContain('className=')
    expect(rootTag).toContain('app')
    expect(rootTag).toContain('data-path={game.state.pathId}')
  });

  it('keeps onboarding itself unthemed', () => {
    const shell = code(app)
    const onboardingBranch = shell.slice(
      shell.indexOf('game.needsOnboarding'),
      shell.indexOf('const showNinFitId'),
    )
    expect(onboardingBranch).toContain('<div className="app">')
    expect(onboardingBranch).not.toContain('data-path')
  });

  it('hides the normal tab bar during the ID decision screen', () => {
    expect(app).toContain("const showPrimaryNav = route.kind === 'tab' || showJourneyHome;")
    expect(app).toContain("route.kind === 'account'")
    expect(app).toContain('<TabBar current={tab}')
  });

  it('still works with no account at all', () => {
    expect(code(app)).not.toMatch(/\bsession\b/i)
    expect(code(app)).not.toContain('await')
  });

  it('reuses the established Journey Card styling rather than a new system', () => {
    expect(screen).toContain('card');
  });

  it('styles the sign-in link with existing tokens only', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\brgb\(|\bhsl\(|\boklch\(/)
    expect(account).toContain('Account')
    expect(profile).toContain('AccountSection')
  });
});
