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
  const [repeatPassword, setRepeatPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showRepeatPassword, setShowRepeatPassword] = useState(false)
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
        if (password.length < 12) {
          throw new Error('Use at least 12 characters for your password.')
        }

        if (password !== repeatPassword) {
          throw new Error('The passwords do not match.')
        }

        if (
          email.trim().length > 0 &&
          password.toLowerCase() === email.trim().toLowerCase()
        ) {
          throw new Error('Your password cannot be the same as your email address.')
        }
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
      setRepeatPassword('')
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
        <div className="account-journey account-journey--quiet">
          <span className="account-journey__eyebrow">Your NinFit</span>
          <p className="account-journey__status">Checking your account…</p>
        </div>
      </Section>
    )
  }

  if (session) {
    return (
      <Section title="NinFit account" defaultOpen={false}>
        <div className="account-journey">
          <div className="account-journey__intro">
            <span className="account-journey__eyebrow">Your NinFit</span>

            <h3 className="account-journey__title">
              Your journey is connected.
            </h3>

            <p className="account-journey__copy">
              Signed in as {session.user.email ?? 'your NinFit account'}.
            </p>

            <div className="account-journey__privacy">
              <span className="account-journey__privacy-mark" aria-hidden="true">
                ◇
              </span>
              <span>
                Your fitness records still stay on this device. Cloud sync is not enabled yet.
              </span>
            </div>
          </div>

          <div className="account-journey__summary">
            <div className="account-journey__stat">
              <span className="account-journey__stat-label">
                Account
              </span>
              <span className="account-journey__stat-value">
                Connected
              </span>
            </div>

            <div className="account-journey__stat">
              <span className="account-journey__stat-label">
                Fitness data
              </span>
              <span className="account-journey__stat-value">
                On this device
              </span>
            </div>

            <div className="account-journey__stat">
              <span className="account-journey__stat-label">
                Cloud sync
              </span>
              <span className="account-journey__stat-value">
                Not enabled
              </span>
            </div>
          </div>

          {error ? (
            <p role="alert" className="account-journey__message account-journey__message--error">
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
          <span className="account-journey__eyebrow">
            Your NinFit
          </span>

          <h3 className="account-journey__title">
            Take your journey with you.
          </h3>

          <p className="account-journey__copy">
            NinFit works without an account. Create your NinFit ID when you want
            your future trophies, Adventures, Crews and Journey Wall to travel with you.
          </p>

          <div className="account-journey__privacy">
            <span
              className="account-journey__privacy-mark"
              aria-hidden="true"
            >
              ◇
            </span>
            <span>
              Local by default · You choose what syncs
            </span>
          </div>
        </div>

        <div
          className="account-journey__mode"
          role="group"
          aria-label="Account action"
        >
          <button
            type="button"
            className={
              mode === 'sign_in'
                ? 'account-journey__mode-button account-journey__mode-button--active'
                : 'account-journey__mode-button'
            }
            aria-pressed={mode === 'sign_in'}
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
            className={
              mode === 'sign_up'
                ? 'account-journey__mode-button account-journey__mode-button--active'
                : 'account-journey__mode-button'
            }
            aria-pressed={mode === 'sign_up'}
            onClick={() => {
              setMode('sign_up')
              setError(null)
              setMessage(null)
            }}
          >
            Create account
          </button>
        </div>

        <form className="account-journey__auth" onSubmit={submit}>
          {mode === 'sign_up' ? (
            <label className="account-journey__field">
              <span className="account-journey__field-label">
                Display name
              </span>
              <input
                className="account-journey__input"
                type="text"
                autoComplete="name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="What should NinFit call you?"
              />
            </label>
          ) : null}

          <label className="account-journey__field">
            <span className="account-journey__field-label">
              Email
            </span>
            <input
              className="account-journey__input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <label className="account-journey__field">
            <span className="account-journey__field-label">
              Password
            </span>

            <span className="account-journey__password-wrap">
              <input
                className="account-journey__input account-journey__input--password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={
                  mode === 'sign_up'
                    ? 'new-password'
                    : 'current-password'
                }
                required
                minLength={mode === 'sign_up' ? 12 : 1}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={
                  mode === 'sign_up'
                    ? 'Create a password'
                    : 'Your password'
                }
              />

              <button
                type="button"
                className="account-journey__reveal"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((current) => !current)}
              >
                <span aria-hidden="true">
                  {showPassword ? '◉' : '◎'}
                </span>
              </button>
            </span>
          </label>

          {mode === 'sign_up' ? (
            <>
              <label className="account-journey__field">
                <span className="account-journey__field-label">
                  Repeat password
                </span>

                <span className="account-journey__password-wrap">
                  <input
                    className="account-journey__input account-journey__input--password"
                    type={showRepeatPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={12}
                    value={repeatPassword}
                    onChange={(event) =>
                      setRepeatPassword(event.target.value)
                    }
                    placeholder="Repeat your password"
                  />

                  <button
                    type="button"
                    className="account-journey__reveal"
                    aria-label={
                      showRepeatPassword
                        ? 'Hide repeated password'
                        : 'Show repeated password'
                    }
                    aria-pressed={showRepeatPassword}
                    onClick={() =>
                      setShowRepeatPassword((current) => !current)
                    }
                  >
                    <span aria-hidden="true">
                      {showRepeatPassword ? '◉' : '◎'}
                    </span>
                  </button>
                </span>
              </label>

              <div
                className="account-journey__requirements"
                aria-label="Password requirements"
              >
                <span className="account-journey__requirements-title">
                  Your password should:
                </span>

                <ul className="account-journey__requirements-list">
                  <li className={password.length >= 12 ? 'is-met' : undefined}>
                    Be at least 12 characters
                  </li>
                  <li
                    className={
                      repeatPassword.length > 0 &&
                      password === repeatPassword
                        ? 'is-met'
                        : undefined
                    }
                  >
                    Match the repeated password
                  </li>
                  <li
                    className={
                      email.trim().length > 0 &&
                      password.length > 0 &&
                      password.toLowerCase() !==
                        email.trim().toLowerCase()
                        ? 'is-met'
                        : undefined
                    }
                  >
                    Not be the same as your email address
                  </li>
                  <li>
                    Be unique to NinFit and not reused elsewhere
                  </li>
                </ul>
              </div>
            </>
          ) : null}

          {message ? (
            <p
              role="status"
              className="account-journey__message"
            >
              {message}
            </p>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="account-journey__message account-journey__message--error"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="btn btn--primary btn--block account-journey__submit"
            disabled={busy}
          >
            {busy
              ? 'Please wait…'
              : mode === 'sign_up'
                ? 'Create my NinFit ID'
                : 'Continue'}
          </button>
        </form>
      </div>
    </Section>
  )
}
