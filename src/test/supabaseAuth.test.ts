import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('..', import.meta.url))

const AUTH_FILE = join(
  SRC,
  'data',
  'supabase',
  'auth.ts',
)

const source = readFileSync(AUTH_FILE, 'utf8')

describe('Supabase auth boundary', () => {
  it('uses the shared Supabase client', () => {
    expect(source).toContain("from './client'")
  })

  it('supports email and password sign-up', () => {
    expect(source).toContain('supabase.auth.signUp')
  })

  it('passes display name as user metadata for profile creation', () => {
    expect(source).toContain('display_name')
  })

  it('supports email and password sign-in', () => {
    expect(source).toContain(
      'supabase.auth.signInWithPassword',
    )
  })

  it('supports sign-out', () => {
    expect(source).toContain('supabase.auth.signOut')
  })

  it('supports restoring the current session', () => {
    expect(source).toContain('supabase.auth.getSession')
  })

  it('provides an auth-state subscription', () => {
    expect(source).toContain(
      'supabase.auth.onAuthStateChange',
    )
  })

  it('unsubscribes from the auth listener', () => {
    expect(source).toContain('subscription.unsubscribe()')
  })

  it('contains no privileged Supabase credential names', () => {
    expect(source).not.toMatch(
      /service[_-]?role|secret[_-]?key/i,
    )
  })

  it('directs confirmation emails back to NinFit', () => {
    expect(source).toContain('emailRedirectTo')
    expect(source).toContain('confirmationRedirectUrl')
  })

  it('leaves the fragment free for Supabase', () => {
    // We are on the implicit flow, so Supabase returns its tokens in the fragment.
    // A redirect that already ends in one produces a nested fragment, and auth-js
    // then cannot find the access_token - the user is never signed in. This asserts
    // the SHAPE; authCallback.test.ts proves the consequence against the real parser.
    //
    // Comments are stripped first: the doc comment above the helper quotes both old
    // destinations precisely in order to explain why they were wrong.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')

    expect(code).toContain('return `${origin}/`')
    expect(code).not.toContain('/#/account/confirmed')
    expect(code).not.toContain('/#/profile')
    expect(code).not.toMatch(/origin\}\/#/)
  })

  it('sends resent confirmations to the same destination', () => {
    const redirects = [...source.matchAll(/emailRedirectTo/g)]
    expect(redirects.length).toBeGreaterThanOrEqual(2)
    expect(source).toContain('confirmationRedirectUrl()')
  })

  it('returns both user and session from signup', () => {
    expect(source).toContain('user: data.user')
    expect(source).toContain('session: data.session')
  })

  it('can resend a signup confirmation email', () => {
    expect(source).toContain('resendConfirmation')
    expect(source).toContain('supabase.auth.resend')
    expect(source).toContain("type: 'signup'")
  })
})