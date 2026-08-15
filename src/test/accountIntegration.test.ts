import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('..', import.meta.url))
const account = readFileSync(
  join(SRC, 'ui', 'components', 'AccountSection.tsx'),
  'utf8',
)
const profile = readFileSync(
  join(SRC, 'ui', 'screens', 'ProfileScreen.tsx'),
  'utf8',
)
const app = readFileSync(join(SRC, 'App.tsx'), 'utf8')

describe('NinFit account integration', () => {
  it('keeps authentication inside the Supabase boundary', () => {
    expect(account).toContain("from '../../data/supabase/auth'")
  })

  it('restores an existing session', () => {
    expect(account).toContain('getSession()')
  })

  it('subscribes to future auth changes', () => {
    expect(account).toContain('onAuthStateChange')
  })

  it('cleans up the auth subscription', () => {
    expect(account).toContain('unsubscribe()')
  })

  it('supports account creation', () => {
    expect(account).toContain('await signUp')
  })

  it('supports sign in', () => {
    expect(account).toContain('await signIn')
  })

  it('supports sign out', () => {
    expect(account).toContain('await signOut')
  })

  it('keeps password fields hidden unless the user reveals them', () => {
    expect(account).toContain(
      "type={showPassword ? 'text' : 'password'}",
    )
    expect(account).toContain(
      "type={showRepeatPassword ? 'text' : 'password'}",
    )
    expect(account).toContain("useState(false)")
  })

  it('states that an account is optional', () => {
    expect(account).toContain('NinFit works without an account')
  })

  it('does not claim fitness data is already cloud synced', () => {
    expect(account).toContain('Cloud sync is not enabled yet')
  })

  it('places account controls on Profile', () => {
    expect(profile).toContain('<AccountSection />')
  })

  it('does not gate the application behind authentication', () => {
    expect(app).not.toContain('AccountSection')
    expect(app).not.toContain('getSession')
    expect(app).not.toContain('signIn')
  })

  it('contains no privileged Supabase credential names', () => {
    expect(account).not.toMatch(/service[_-]?role|secret[_-]?key/i)
  })

  it('uses the Journey Card identity language', () => {
    expect(account).toContain('Take your journey with you.')
  })

  it('states the local-first privacy promise', () => {
    expect(account).toContain('Local by default · You choose what syncs')
  })

  it('uses dedicated full-width account inputs', () => {
    expect(account).toContain('account-journey__input')
  })

  it('uses the Journey Card layout primitive', () => {
    expect(account).toContain('account-journey')
  })

  it('gives the account action a NinFit-specific label', () => {
    expect(account).toContain('Create my NinFit ID')
  })

  it('lazy-loads the cloud account feature', () => {
    expect(profile).toContain("lazy(() =>")
    expect(profile).toContain("import('../components/AccountSection')")
  })

  it('does not statically import the cloud account feature', () => {
    expect(profile).not.toContain(
      "import { AccountSection } from '../components/AccountSection'",
    )
  })

  it('provides a loading fallback while cloud code arrives', () => {
    expect(profile).toContain('<Suspense')
    expect(profile).toContain('Account controls loading…')
  })

  it('asks for the password twice during account creation', () => {
    expect(account).toContain('Repeat password')
    expect(account).toContain('repeatPassword')
  })

  it('rejects mismatched account-creation passwords', () => {
    expect(account).toContain('The passwords do not match.')
  })

  it('requires at least twelve characters when creating an account', () => {
    expect(account).toContain('password.length < 12')
    expect(account).toContain('Be at least 12 characters')
  })

  it('lets the user reveal and hide their password', () => {
    expect(account).toContain('Show password')
    expect(account).toContain('Hide password')
    expect(account).toContain('showPassword')
  })

  it('lets the user reveal and hide the repeated password', () => {
    expect(account).toContain('Show repeated password')
    expect(account).toContain('Hide repeated password')
  })

  it('shows account password requirements', () => {
    expect(account).toContain('Your password should:')
    expect(account).toContain('Password requirements')
  })
})
