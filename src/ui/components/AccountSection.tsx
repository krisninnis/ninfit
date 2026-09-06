import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSession, onAuthStateChange, signOut } from '../../data/supabase/auth'
import { isSupabaseConfigured } from '../../data/supabase/env'
import { ACCOUNT_HASH } from '../tabs'
import { Section } from './Field'

/**
 * Account STATUS on Profile. Not account creation.
 *
 * This used to be the full signup and sign-in form, which put the most consequential
 * decision in the app three quarters of the way down a settings screen. Creating or
 * joining a NinFit ID now happens in the dedicated experience at `#/account`; what is
 * left here answers one question - are you connected, and what does that mean for
 * your data - and offers the one action that matches the answer.
 *
 * There is no password field in this file, by design. The only auth calls it makes
 * are read-only (`getSession`, `onAuthStateChange`) plus `signOut`.
 *
 * Still lazy-loaded from Profile, so the Supabase client stays out of the core
 * bundle for anyone who never opens this.
 */

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.'
}

export function AccountSection() {
  const [session, setSession] = useState<Session | null>(null)
  const [loadingSession, setLoadingSession] = useState(isSupabaseConfigured)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined

    let active = true

    getSession()
      .then((nextSession) => {
        if (active) setSession(nextSession)
      })
      .catch((caught) => {
        if (active) setError(errorMessage(caught))
      })
      .finally(() => {
        if (active) setLoadingSession(false)
      })

    let unsubscribe: () => void = () => {}
    try {
      unsubscribe = onAuthStateChange((nextSession) => {
        if (!active) return
        setSession(nextSession)
        setLoadingSession(false)
      })
    } catch (caught) {
      if (active) {
        setError(errorMessage(caught))
        setLoadingSession(false)
      }
    }

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  async function handleSignOut() {
    setBusy(true)
    setError(null)

    try {
      await signOut()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <Section title="NinFit account" defaultOpen={false}>
        <div className="account-journey account-journey--quiet">
          <span className="account-journey__eyebrow">Your NinFit</span>
          <h3 className="account-journey__title">Not available in this build</h3>
          <p className="account-journey__copy">
            NinFit still works without an account. Your fitness records remain on this
            device.
          </p>
        </div>
      </Section>
    )
  }

  if (loadingSession) {
    return (
      <Section title="NinFit account" defaultOpen={false}>
        <div className="account-journey account-journey--quiet">
          <span className="account-journey__eyebrow">Your NinFit</span>
          <p className="account-journey__status">Checking your account…</p>
        </div>
      </Section>
    )
  }

  if (session) {
    const displayName =
      typeof session.user.user_metadata?.['display_name'] === 'string'
        ? (session.user.user_metadata['display_name'] as string)
        : undefined

    return (
      <Section title="NinFit account" defaultOpen={false}>
        <div className="account-journey">
          <div className="account-journey__intro">
            <span className="account-journey__eyebrow">Your NinFit</span>

            <h3 className="account-journey__title">
              {displayName ?? session.user.email ?? 'Your NinFit account'}
            </h3>
          </div>

          <div className="account-journey__summary">
            <div className="account-journey__stat">
              <span className="account-journey__stat-label">Account</span>
              <span className="account-journey__stat-value">Connected</span>
            </div>

            <div className="account-journey__stat">
              <span className="account-journey__stat-label">Cloud sync</span>
              <span className="account-journey__stat-value">Not enabled</span>
            </div>

            <div className="account-journey__stat">
              <span className="account-journey__stat-label">Fitness data</span>
              <span className="account-journey__stat-value">On this device</span>
            </div>
          </div>

          {error ? (
            <p
              role="alert"
              className="account-journey__message account-journey__message--error"
            >
              {error}
            </p>
          ) : null}

          <button
            type="button"
            className="btn btn--secondary btn--block"
            disabled={busy}
            onClick={handleSignOut}
          >
            {busy ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </Section>
    )
  }

  return (
    <Section title="NinFit account" defaultOpen={false}>
      <div className="account-journey">
        <div className="account-journey__intro">
          <span className="account-journey__eyebrow">Your NinFit</span>

          <h3 className="account-journey__title">Not connected</h3>

          <p className="account-journey__copy">
            NinFit works without an account. Your fitness records remain on this
            device.
          </p>
        </div>

        {error ? (
          <p
            role="alert"
            className="account-journey__message account-journey__message--error"
          >
            {error}
          </p>
        ) : null}

        <a className="btn btn--primary btn--block" href={ACCOUNT_HASH}>
          Connect NinFit ID
        </a>
      </div>
    </Section>
  )
}
