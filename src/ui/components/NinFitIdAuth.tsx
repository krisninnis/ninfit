import { useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  getSession,
  onAuthStateChange,
  resendConfirmation,
  signIn,
  signUp,
} from '../../data/supabase/auth'
import {
  MIN_PASSWORD_LENGTH,
  maskEmail,
  passwordChecks,
  signUpOutcome,
  validateSignUp,
  type AuthMode,
  type AuthPhase,
} from '../account/accountFlow'

/**
 * The email half of the NinFit ID experience.
 *
 * LAZY BY CONSTRUCTION. This is the only component on the ID screen that touches
 * `@supabase/supabase-js`, and `NinFitIdScreen` reaches it through `React.lazy`.
 * Keeping the import here rather than one level up is what keeps roughly 200 kB of
 * auth client out of the bundle every user downloads, including the majority who
 * press "Not now" and never create an account at all.
 *
 * FOUR PHASES, NOT ONE FORM. Signing up and signing in look similar and end very
 * differently: a signup that needs email confirmation has no session, and the old
 * behaviour of dropping the user back on a sign-in form after that was actively
 * misleading - the credentials they had just chosen would not work yet. Each outcome
 * gets its own state and its own honest sentence.
 *
 * Passwords live in component state for exactly as long as the request takes and are
 * cleared afterwards. Nothing writes them to storage, and nothing logs them.
 */

interface NinFitIdAuthProps {
  initialMode: AuthMode
  /** True when the user has just arrived from a confirmation email link. */
  returningFromConfirmation: boolean
  onBack: () => void
  onContinue: () => void
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.'
}

export function NinFitIdAuth({
  initialMode,
  returningFromConfirmation,
  onBack,
  onContinue,
}: NinFitIdAuthProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [phase, setPhase] = useState<AuthPhase>(
    returningFromConfirmation ? 'checking' : 'form',
  )
  const [session, setSession] = useState<Session | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showRepeatPassword, setShowRepeatPassword] = useState(false)
  const [pendingEmail, setPendingEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Restore an existing session, and follow any later change. This is what makes a
  // confirmation link work: the user returns, Supabase resolves the session from the
  // URL, and the screen moves to `connected` without the user typing anything again.
  useEffect(() => {
    let active = true

    getSession()
      .then((next) => {
        if (!active) return
        setSession(next)
        if (next) setPhase('connected')
        else if (returningFromConfirmation) setPhase('form')
      })
      .catch((caught) => {
        if (!active) return
        setError(errorMessage(caught))
        setPhase('form')
      })

    const unsubscribe = onAuthStateChange((next) => {
      if (!active) return
      setSession(next)
      if (next) setPhase('connected')
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [returningFromConfirmation])

  function clearSecrets() {
    setPassword('')
    setRepeatPassword('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setMessage(null)

    try {
      if (mode === 'sign_up') {
        const invalid = validateSignUp({ email, password, repeatPassword })
        if (invalid) throw new Error(invalid)

        const result = await signUp({
          email: email.trim(),
          password,
          displayName: displayName.trim() || undefined,
        })

        const outcome = signUpOutcome(result)
        clearSecrets()

        if (outcome === 'connected') {
          // The session listener will also fire; setting it here avoids a flicker.
          setPhase('connected')
          return
        }

        if (outcome === 'confirm') {
          setPendingEmail(email.trim())
          setPhase('confirm')
          return
        }

        // No session and no user. Say so rather than pointing at an inbox.
        throw new Error(
          'Your NinFit ID could not be created just now. Please try again.',
        )
      }

      await signIn({ email: email.trim(), password })
      clearSecrets()
      setPhase('connected')
    } catch (caught) {
      clearSecrets()
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  async function handleResend() {
    setBusy(true)
    setError(null)
    setMessage(null)

    try {
      await resendConfirmation(pendingEmail)
      setMessage('Confirmation email sent again.')
    } catch (caught) {
      // Deliberately no success message on the failure path.
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  function useDifferentEmail() {
    setPhase('form')
    setMode('sign_up')
    setPendingEmail('')
    setMessage(null)
    setError(null)
    clearSecrets()
  }

  // --- checking -------------------------------------------------------------

  if (phase === 'checking') {
    return (
      <div className="account-journey account-journey--quiet">
        <span className="account-journey__eyebrow">Your NinFit</span>
        <p className="account-journey__status">Confirming your NinFit ID…</p>
      </div>
    )
  }

  // --- connected ------------------------------------------------------------

  if (phase === 'connected') {
    return (
      <div className="account-journey">
        <div className="account-journey__intro">
          <span className="account-journey__eyebrow">Your NinFit</span>

          <h2 className="account-journey__title">Your journey is connected.</h2>

          <p className="account-journey__copy">
            Signed in as {session?.user.email ?? 'your NinFit account'}.
          </p>

          <div className="account-journey__privacy">
            <span className="account-journey__privacy-mark" aria-hidden="true">
              ◇
            </span>
            <span>
              Your fitness records still stay on this device. Cloud sync is not
              enabled yet.
            </span>
          </div>
        </div>

        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={onContinue}
        >
          Continue to Today
        </button>
      </div>
    )
  }

  // --- confirm --------------------------------------------------------------

  if (phase === 'confirm') {
    return (
      <div className="account-journey">
        <div className="account-journey__intro">
          <span className="account-journey__eyebrow">Check your email</span>

          <h2 className="account-journey__title">One more step.</h2>

          <p className="account-journey__copy">
            We sent a confirmation link to{' '}
            <strong className="account-journey__pending-email">
              {maskEmail(pendingEmail)}
            </strong>
            . Confirm your email to finish creating your NinFit ID.
          </p>

          <div className="account-journey__privacy">
            <span className="account-journey__privacy-mark" aria-hidden="true">
              ◇
            </span>
            <span>
              You can keep training meanwhile. Nothing here is required to use
              NinFit.
            </span>
          </div>
        </div>

        {message ? (
          <p role="status" className="account-journey__message">
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

        <div className="account-journey__actions">
          <button
            type="button"
            className="btn btn--secondary btn--block"
            disabled={busy}
            onClick={handleResend}
          >
            {busy ? 'Please wait…' : 'Resend confirmation'}
          </button>

          <button
            type="button"
            className="btn btn--quiet btn--block"
            onClick={useDifferentEmail}
          >
            Use a different email
          </button>

          <button
            type="button"
            className="btn btn--quiet btn--block"
            onClick={onContinue}
          >
            Continue to Today
          </button>
        </div>
      </div>
    )
  }

  // --- form -----------------------------------------------------------------

  const checks = passwordChecks({ email, password, repeatPassword })
  const isSignUp = mode === 'sign_up'

  return (
    <div className="account-journey">
      <div className="account-journey__intro">
        <span className="account-journey__eyebrow">Your NinFit</span>

        <h2 className="account-journey__title">
          {isSignUp ? 'Create your NinFit ID.' : 'Welcome back.'}
        </h2>

        <p className="account-journey__copy">
          NinFit works without an account. A NinFit ID lets your future progress
          travel with you.
        </p>

        <div className="account-journey__privacy">
          <span className="account-journey__privacy-mark" aria-hidden="true">
            ◇
          </span>
          <span>Local by default · You choose what syncs</span>
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
            !isSignUp
              ? 'account-journey__mode-button account-journey__mode-button--active'
              : 'account-journey__mode-button'
          }
          aria-pressed={!isSignUp}
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
            isSignUp
              ? 'account-journey__mode-button account-journey__mode-button--active'
              : 'account-journey__mode-button'
          }
          aria-pressed={isSignUp}
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
        {isSignUp ? (
          <label className="account-journey__field">
            <span className="account-journey__field-label">Display name</span>
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
          <span className="account-journey__field-label">Email</span>
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
          <span className="account-journey__field-label">Password</span>

          <span className="account-journey__password-wrap">
            <input
              className="account-journey__input account-journey__input--password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              required
              minLength={isSignUp ? MIN_PASSWORD_LENGTH : 1}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={isSignUp ? 'Create a password' : 'Your password'}
            />

            <button
              type="button"
              className="account-journey__reveal"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((current) => !current)}
            >
              <span aria-hidden="true">{showPassword ? '◉' : '◎'}</span>
            </button>
          </span>
        </label>

        {isSignUp ? (
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
                  minLength={MIN_PASSWORD_LENGTH}
                  value={repeatPassword}
                  onChange={(event) => setRepeatPassword(event.target.value)}
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
                  onClick={() => setShowRepeatPassword((current) => !current)}
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
                <li className={checks.longEnough ? 'is-met' : undefined}>
                  Be at least {MIN_PASSWORD_LENGTH} characters
                </li>
                <li className={checks.matches ? 'is-met' : undefined}>
                  Match the repeated password
                </li>
                <li className={checks.differsFromEmail ? 'is-met' : undefined}>
                  Not be the same as your email address
                </li>
                <li>Be unique to NinFit and not reused elsewhere</li>
              </ul>
            </div>
          </>
        ) : null}

        {message ? (
          <p role="status" className="account-journey__message">
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
            : isSignUp
              ? 'Create my NinFit ID'
              : 'Continue'}
        </button>
      </form>

      <button type="button" className="btn btn--quiet btn--block" onClick={onBack}>
        Back
      </button>
    </div>
  )
}
