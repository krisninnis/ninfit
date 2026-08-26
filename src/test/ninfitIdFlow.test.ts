import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('..', import.meta.url))

const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8')

/**
 * Source with comments removed, for every "must NOT contain" assertion.
 *
 * Without this, a comment explaining why the shell holds no session would fail a test
 * asserting the shell never mentions a session - the test reading the explanation as
 * the thing it forbids.
 */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

function openingTagContaining(source: string, needle: string): string {
  const at = source.indexOf(needle)
  if (at === -1) return ''
  const start = source.lastIndexOf('<', at)
  const end = source.indexOf('>', at)
  return start === -1 || end === -1 ? '' : source.slice(start, end + 1)
}

const app = read('App.tsx')
const screen = read('ui', 'screens', 'NinFitIdScreen.tsx')
const auth = read('ui', 'components', 'NinFitIdAuth.tsx')
const profileStyles = read('styles', 'screens', 'profile.css')

describe('NinFit ID entry flow', () => {
  it('has a dedicated NinFit ID screen', () => {
    expect(screen).toContain('Take your journey with you.')
  })

  it('explicitly keeps accounts optional', () => {
    expect(screen).toContain('NinFit works without an account')
    expect(screen).toContain('Not now')
  })

  it('offers email as the working account path', () => {
    expect(screen).toContain('Continue with email')
  })

  it('offers returning users a way to sign in', () => {
    expect(screen).toContain('Already have a NinFit ID?')
    expect(screen).toContain('Sign in')
    expect(screen).toContain("setStage({ kind: 'email', mode: 'sign_in' })")
  })

  it('opens account creation from the email button', () => {
    expect(screen).toContain("setStage({ kind: 'email', mode: 'sign_up' })")
  })

  it('shows Google without pretending it is active yet', () => {
    expect(screen).toContain('Continue with Google')
    expect(screen).toContain('coming soon')
    expect(screen).toContain('Soon')
  })

  it('shows Apple without pretending it is active yet', () => {
    expect(screen).toContain('Continue with Apple')
  })

  it('leaves both social buttons genuinely disabled and unwired', () => {
    const social = [...screen.matchAll(/className="ninfit-id__social"[\s\S]*?>/g)]
    expect(social).toHaveLength(2)
    for (const match of social) {
      expect(match[0]).toContain('disabled')
      expect(match[0]).not.toContain('onClick')
    }
    expect(screen).not.toContain('signInWithOAuth')
    expect(screen).not.toContain("provider: 'google'")
    expect(screen).not.toContain("provider: 'apple'")
  })
})

describe('email auth stays inside the dedicated experience', () => {
  it('does not send the user to Profile to create an account', () => {
    expect(app).not.toContain("window.location.hash = '#/profile'")
    expect(screen).not.toContain('profile')
  })

  it('transitions the same screen into an email auth stage', () => {
    expect(screen).toContain("stage.kind === 'email'")
    expect(screen).toContain('<NinFitIdAuth')
  })

  it('can return to the choice stage', () => {
    expect(screen).toContain("onBack={() => setStage({ kind: 'choice' })}")
    expect(auth).toContain('onBack')
  })
})

describe('routing', () => {
  it('shows the ID screen after onboarding completes', () => {
    expect(app).toContain('game.completeOnboarding(input)')
    expect(app).toContain('navigate(ACCOUNT_HASH)')
  })

  it('does not show the ID screen when onboarding is merely dismissed', () => {
    expect(app).toContain('setDismissedOnboarding(true)')
  })

  it('lets a user skip the ID screen into Today', () => {
    expect(app).toContain("onSkip={() => navigate(hashForTab('today'))}")
  })

  it('drives the ID screen from the URL, not a second navigation system', () => {
    expect(app).toContain('parseRouteFromHash')
    expect(app).toContain("route.kind === 'account'")
    // The old boolean is gone: one source of truth for where the user is.
    expect(code(app)).not.toContain('setShowNinFitId')
    expect(code(app)).not.toContain('useState<boolean>')
  })

  it('keeps the back button working by listening to hashchange', () => {
    expect(app).toContain("window.addEventListener('hashchange', syncFromHash)")
    expect(app).toContain("window.removeEventListener('hashchange', syncFromHash)")
  })

  it('passes the confirmation return through to the screen', () => {
    expect(app).toContain('returningFromConfirmation={route.confirmed}')
    expect(screen).toContain('returningFromConfirmation')
  })

  it('opens straight into auth when returning from a confirmation email', () => {
    expect(screen).toContain(
      "returningFromConfirmation\n      ? { kind: 'email', mode: 'sign_in' }",
    )
  })

  it('resolves a real session before claiming the account is connected', () => {
    expect(auth).toContain("returningFromConfirmation ? 'checking' : 'form'")
    expect(auth).toContain('getSession()')
    expect(auth).toContain("setPhase('connected')")
  })
})

describe('app-shell invariants', () => {
  it('keeps one shared selected-path app root', () => {
    const occurrences = [...app.matchAll(/data-path=/g)]
    const rootTag = openingTagContaining(app, 'data-path={game.state.pathId}')

    expect(occurrences).toHaveLength(1)
    expect(rootTag).toContain('className=')
    expect(rootTag).toContain('app')
    expect(rootTag).toContain('data-path={game.state.pathId}')
  })

  it('keeps onboarding itself unthemed', () => {
    const shell = code(app)
    const onboardingBranch = shell.slice(
      shell.indexOf('game.needsOnboarding'),
      shell.indexOf('const showNinFitId'),
    )
    expect(onboardingBranch).toContain('<div className="app">')
    expect(onboardingBranch).not.toContain('data-path')
  })

  it('hides the normal tab bar during the ID decision screen', () => {
    expect(app).toContain("const showPrimaryNav = route.kind === 'tab' || showJourneyHome")
    expect(app).toContain("route.kind === 'account'")
    expect(app).toMatch(/<TabBar\s+[\s\S]*?current=\{tab\}/)
  })

  it('still works with no account at all', () => {
    // Nothing in the shell awaits, checks or requires a session.
    expect(code(app)).not.toMatch(/\bsession\b/i)
    expect(code(app)).not.toContain('await')
  })
})

describe('visual direction', () => {
  it('reuses the established Journey Card styling rather than a new system', () => {
    expect(auth).toContain('account-journey')
    expect(profileStyles).toContain('.account-journey__status')
    expect(profileStyles).toContain('.account-journey__actions')
    expect(profileStyles).toContain('.account-journey__pending-email')
  })

  it('styles the sign-in link with existing tokens only', () => {
    const styles = read('styles', 'screens', 'ninfit-id.css')
    expect(styles).toContain('.ninfit-id__link')
    const block = styles.slice(styles.indexOf('.ninfit-id__link'))
    expect(block).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|oklch\(/i)
  })
})
