import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('..', import.meta.url))

const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8')

/**
 * Source with comments removed.
 *
 * Every "must NOT contain" assertion below runs against this rather than the raw
 * file. A doc comment explaining why there is no password field here would otherwise
 * fail a test asserting that the word does not appear - the test would be reading the
 * explanation as the thing it forbids.
 */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

/** Profile's account card: status and management only. */
const status = read('ui', 'components', 'AccountSection.tsx')
/** The dedicated NinFit ID experience: where accounts are actually created. */
const auth = read('ui', 'components', 'NinFitIdAuth.tsx')
const idScreen = read('ui', 'screens', 'NinFitIdScreen.tsx')
const profile = read('ui', 'screens', 'ProfileScreen.tsx')
const app = read('App.tsx')

/**
 * Where the account experience lives, and what it is allowed to claim.
 *
 * These are source assertions on purpose: the question they answer is "is the signup
 * form still in the dedicated experience and out of Profile", which is a question
 * about structure. The rules the form applies are executed in accountFlow.test.ts.
 */

describe('the account form lives in the dedicated NinFit ID experience', () => {
  it('collects a display name, email and password there', () => {
    expect(auth).toContain('Display name')
    expect(auth).toContain('Email')
    expect(auth).toContain('Password')
  })

  it('asks for the password twice when creating an account', () => {
    expect(auth).toContain('Repeat password')
    expect(auth).toContain('repeatPassword')
  })

  it('keeps the repeated password out of sign-in', () => {
    // The repeat field and the requirement list are both inside the isSignUp branch.
    expect(auth).toContain('{isSignUp ? (')
    expect(auth).toContain('autoComplete="new-password"')
    expect(auth).toContain("autoComplete={isSignUp ? 'new-password' : 'current-password'}")
  })

  it('keeps both password fields hidden unless revealed', () => {
    expect(auth).toContain("type={showPassword ? 'text' : 'password'}")
    expect(auth).toContain("type={showRepeatPassword ? 'text' : 'password'}")
    expect(auth).toContain('useState(false)')
  })

  it('labels the reveal controls for screen readers', () => {
    expect(auth).toContain('Show password')
    expect(auth).toContain('Hide password')
    expect(auth).toContain('Show repeated password')
    expect(auth).toContain('Hide repeated password')
  })

  it('shows the password requirement list', () => {
    expect(auth).toContain('Your password should:')
    expect(auth).toContain('Password requirements')
    expect(auth).toContain('Be at least {MIN_PASSWORD_LENGTH} characters')
  })

  it('applies the shared validation rather than its own copy of the rules', () => {
    expect(auth).toContain("from '../account/accountFlow'")
    expect(auth).toContain('validateSignUp(')
    expect(auth).toContain('passwordChecks(')
  })

  it('supports both signing in and creating an account', () => {
    expect(auth).toContain('await signUp')
    expect(auth).toContain('await signIn')
    expect(auth).toContain('Create my NinFit ID')
  })

  it('names the action in NinFit terms', () => {
    expect(auth).toContain('Create my NinFit ID')
  })
})

describe('email confirmation is its own state', () => {
  it('has a dedicated confirmation phase', () => {
    expect(auth).toContain("phase === 'confirm'")
    expect(auth).toContain('Check your email')
    expect(auth).toContain('Confirm your email to finish creating your NinFit ID')
  })

  it('decides the phase from the real signup result', () => {
    expect(auth).toContain('signUpOutcome(result)')
    expect(auth).toContain("outcome === 'confirm'")
    expect(auth).toContain("outcome === 'connected'")
  })

  it('no longer dumps the user back on a sign-in form after signup', () => {
    expect(auth).not.toContain('check your inbox, then sign in')
    expect(auth).not.toContain("setMode('sign_in')\n        setPhase")
  })

  it('resends through the auth boundary', () => {
    expect(auth).toContain('resendConfirmation')
    expect(auth).toContain("from '../../data/supabase/auth'")
  })

  it('does not claim an email was sent when the resend fails', () => {
    // The success message is set only after the awaited call returns.
    const resend = auth.slice(auth.indexOf('async function handleResend'))
    const success = resend.indexOf('Confirmation email sent again.')
    const caught = resend.indexOf('} catch (caught)')
    expect(success).toBeGreaterThan(-1)
    expect(success).toBeLessThan(caught)
  })

  it('offers a way back to a different email', () => {
    expect(auth).toContain('Use a different email')
    expect(auth).toContain('function useDifferentEmail')
    expect(auth).toContain("setPhase('form')")
  })

  it('masks the pending address', () => {
    expect(auth).toContain('maskEmail(pendingEmail)')
  })

  it('does not block the user from training while unconfirmed', () => {
    expect(auth).toContain('Continue to Today')
  })
})

describe('the connected state', () => {
  it('exists and lets the user get on with Today', () => {
    expect(auth).toContain("phase === 'connected'")
    expect(auth).toContain('Your journey is connected.')
    expect(auth).toContain('Continue to Today')
  })

  it('restores an existing session and follows later changes', () => {
    expect(auth).toContain('getSession()')
    expect(auth).toContain('onAuthStateChange')
    expect(auth).toContain('unsubscribe()')
  })
})

describe('Profile is account status only', () => {
  it('still shows the account card', () => {
    expect(profile).toContain('<AccountSection />')
  })

  it('contains no password field at all', () => {
    expect(code(status)).not.toMatch(/password/i)
    expect(code(status)).not.toContain('<input')
  })

  it('contains no signup or sign-in call', () => {
    expect(code(status)).not.toContain('signUp')
    expect(code(status)).not.toContain('signIn')
    expect(code(status)).not.toContain('<form')
  })

  it('offers a route into the dedicated experience when signed out', () => {
    expect(status).toContain('Not connected')
    expect(status).toContain('Connect NinFit ID')
    expect(status).toContain('ACCOUNT_HASH')
  })

  it('says where the fitness records are when signed out', () => {
    expect(status).toContain('Your fitness records remain on this')
  })

  it('offers status and sign-out when signed in', () => {
    expect(status).toContain('Connected')
    expect(status).toContain('Cloud sync')
    expect(status).toContain('Not enabled')
    expect(status).toContain('On this device')
    expect(status).toContain('Sign out')
    expect(status).toContain('await signOut')
  })
})

describe('lazy loading keeps Supabase out of the core bundle', () => {
  it('lazy-loads the account status card from Profile', () => {
    expect(profile).toContain('lazy(() =>')
    // Quote style is a formatter's business, not this test's. What must hold is
    // that the module is reached through a dynamic import rather than a static one.
    expect(profile).toMatch(/import\(\s*['"]\.\.\/components\/AccountSection['"]\s*\)/)
    expect(profile).toContain('<Suspense')
  })

  it('lazy-loads the auth experience from the ID screen', () => {
    expect(idScreen).toContain('lazy(() =>')
    expect(idScreen).toContain("import('../components/NinFitIdAuth')")
    expect(idScreen).toContain('<Suspense')
  })

  it('never statically imports either cloud component', () => {
    // Quote-style independent, for the same reason as the dynamic-import check
    // above: a `toContain` on a single-quoted specifier stopped being able to fail
    // the moment the screen was reformatted with double quotes.
    expect(profile).not.toMatch(
      /import\s*\{\s*AccountSection\s*\}\s*from\s*['"]\.\.\/components\/AccountSection['"]/,
    )
    expect(idScreen).not.toContain(
      "import { NinFitIdAuth } from '../components/NinFitIdAuth'",
    )
  })

  it('keeps the Supabase client out of the statically imported screen', () => {
    expect(idScreen).not.toContain('data/supabase')
    expect(idScreen).not.toContain('@supabase/supabase-js')
  })

  it('keeps the Supabase client out of App', () => {
    expect(app).not.toContain('data/supabase')
    expect(app).not.toContain('@supabase/supabase-js')
  })

  it('imports only an erasable type from the flow module into the ID screen', () => {
    expect(idScreen).toContain("import type { AuthMode } from '../account/accountFlow'")
  })
})

describe('honesty and privacy', () => {
  it('does not gate the application behind authentication', () => {
    expect(app).not.toContain('AccountSection')
    expect(app).not.toContain('NinFitIdAuth')
    expect(app).not.toContain('getSession')
    expect(app).not.toContain('signIn')
  })

  it('states that an account is optional', () => {
    expect(auth).toContain('NinFit works without an account')
    expect(status).toContain('NinFit works without an account')
  })

  it('does not claim fitness data is cloud synced', () => {
    expect(auth).toContain('Cloud sync is not')
    expect(status).toContain('Not enabled')
    for (const source of [auth, status, idScreen, app]) {
      expect(source).not.toMatch(/synced to the cloud|backed up to the cloud|cloud backup/i)
    }
  })

  it('contains no privileged Supabase credential names', () => {
    for (const source of [auth, status, idScreen, app]) {
      expect(source).not.toMatch(/service[_-]?role|secret[_-]?key/i)
    }
  })

  it('never persists or logs a password', () => {
    for (const source of [auth, status]) {
      expect(code(source)).not.toMatch(/localStorage|sessionStorage|indexedDB/)
      expect(code(source)).not.toMatch(/console\.(log|warn|error|info|debug)/)
    }
  })

  it('clears the password fields after every attempt', () => {
    expect(auth).toContain('function clearSecrets')
    expect(auth).toContain("setPassword('')")
    expect(auth).toContain("setRepeatPassword('')")
  })

  it('keeps the Journey Card identity language', () => {
    expect(idScreen).toContain('Take your journey with you.')
    expect(auth).toContain('Local by default · You choose what syncs')
  })

  it('reuses the existing account layout primitives', () => {
    expect(auth).toContain('account-journey')
    expect(auth).toContain('account-journey__input')
    expect(status).toContain('account-journey')
  })
})
