import { useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  getSession,
  onAuthStateChange,
  signIn,
  signOut,
  signUp,
} from '../../data/supabase/auth'
import { Section } from './Field'

type Mode = 'sign_in' | 'sign_up'

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.'
}

export function AccountSection() {
  const [session, setSession] = useState<Session | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [mode, setMode] = useState<Mode>('sign_in')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
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

    const unsubscribe = onAuthStateChange((nextSession) => {
      if (!active) return
      setSession(nextSession)
      setLoadingSession(false)
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setMessage(null)

    try {
      if (mode === 'sign_up') {
        await signUp({
          email: email.trim(),
          password,
          displayName: displayName.trim() || undefined,
        })

        setMessage(
          'Account created. If email confirmation is enabled, check your inbox, then sign in.',
        )
        setMode('sign_in')
      } else {
        await signIn({
          email: email.trim(),
          password,
        })
      }

      setPassword('')
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  async function handleSignOut() {
    setBusy(true)
    setError(null)
    setMessage(null)

    try {
      await signOut()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  if (loadingSession) {
    return (
      <Section title="NinFit account" defaultOpen={false}>
        <p className="footnote">Checking account…</p>
      </Section>
    )
  }

  if (session) {
    return (
      <Section title="NinFit account" defaultOpen={false}>
        <p className="footnote">
          Signed in as {session.user.email ?? 'your NinFit account'}.
        </p>

        <p className="footnote">
          Your fitness records still stay on this device for now. Cloud sync is not enabled yet.
        </p>

        {error ? (
          <p role="alert" className="footnote">
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
      </Section>
    )
  }

  return (
    <Section title="NinFit account" defaultOpen={false}>
      <p className="footnote">
        Optional. NinFit works without an account. Sign in when you want cloud features later.
      </p>

      <div className="confirm__actions">
        <button
          type="button"
          className={`btn ${mode === 'sign_in' ? 'btn--primary' : 'btn--secondary'}`}
          onClick={() => {
            setMode('sign_in')
            setError(null)
            setMessage(null)
          }}
        >
          Sign in
        </button>

        <button
          type="button"
          className={`btn ${mode === 'sign_up' ? 'btn--primary' : 'btn--secondary'}`}
          onClick={() => {
            setMode('sign_up')
            setError(null)
            setMessage(null)
          }}
        >
          Create account
        </button>
      </div>

      <form onSubmit={submit}>
        {mode === 'sign_up' ? (
          <div className="control">
            <label className="control__label" htmlFor="ninfit-display-name">
              Display name
            </label>
            <input
              id="ninfit-display-name"
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>
        ) : null}

        <div className="control">
          <label className="control__label" htmlFor="ninfit-email">
            Email
          </label>
          <input
            id="ninfit-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="control">
          <label className="control__label" htmlFor="ninfit-password">
            Password
          </label>
          <input
            id="ninfit-password"
            type="password"
            autoComplete={mode === 'sign_up' ? 'new-password' : 'current-password'}
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {message ? (
          <p role="status" className="footnote">
            {message}
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="footnote">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="btn btn--primary btn--block"
          disabled={busy}
        >
          {busy
            ? 'Please wait…'
            : mode === 'sign_up'
              ? 'Create account'
              : 'Sign in'}
        </button>
      </form>
    </Section>
  )
}