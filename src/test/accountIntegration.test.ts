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

  it('uses a password input rather than displaying the password', () => {
    expect(account).toContain('type="password"')
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
})