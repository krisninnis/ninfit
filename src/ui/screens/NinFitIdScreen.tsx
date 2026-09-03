import { Suspense, lazy, useState } from 'react'
import { isSupabaseConfigured } from '../../config/supabase'
import type { AuthMode } from '../account/accountFlow'

/**
 * The dedicated NinFit ID experience.
 *
 * Account creation and sign-in both live here rather than inside Profile, because
 * this is the one place in the app where the user is actually being asked to make
 * that decision. Profile keeps a status card and nothing more.
 *
 * The Supabase-backed half is behind `lazy`, so choosing "Not now" - which is the
 * expected answer, and must stay the comfortable one - downloads no auth client at
 * all. This file itself imports only a type from the flow module, which erases.
 *
 * Google and Apple are rendered and disabled. They are not wired to anything, and
 * their labels say "Soon" rather than implying a button that merely failed.
 */

const NinFitIdAuth = lazy(() =>
  import('../components/NinFitIdAuth').then((module) => ({
    default: module.NinFitIdAuth,
  })),
)

interface NinFitIdScreenProps {
  /** True when the user has just followed a confirmation link back into the app. */
  returningFromConfirmation?: boolean
  /** Leave the ID experience and get on with training. */
  onSkip: () => void
  /** Test seam; production reads the build's public Supabase configuration. */
  supabaseConfigured?: boolean
}

type Stage = { kind: 'choice' } | { kind: 'email'; mode: AuthMode }

export function NinFitIdScreen({
  returningFromConfirmation = false,
  onSkip,
  supabaseConfigured = isSupabaseConfigured,
}: NinFitIdScreenProps) {
  // Arriving from a confirmation link goes straight to the auth half, which resolves
  // the real session before claiming anything.
  const [stage, setStage] = useState<Stage>(() =>
    returningFromConfirmation
      ? { kind: 'email', mode: 'sign_in' }
      : { kind: 'choice' },
  )

  if (stage.kind === 'email') {
    if (!supabaseConfigured) {
      return (
        <div className="ninfit-id">
          <div className="account-journey account-journey--quiet" role="status">
            <span className="account-journey__eyebrow">Your NinFit</span>
            <h1 className="account-journey__title">NinFit ID is not available locally.</h1>
            <p className="account-journey__status">
              The fitness app still works normally and keeps your information on this device.
            </p>
            <div className="account-journey__actions">
              {!returningFromConfirmation ? (
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => setStage({ kind: 'choice' })}
                >
                  Back
                </button>
              ) : null}
              <button type="button" className="btn btn--primary" onClick={onSkip}>
                Continue to Today
              </button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="ninfit-id">
        <Suspense
          fallback={
            <div className="account-journey account-journey--quiet">
              <span className="account-journey__eyebrow">Your NinFit</span>
              <p className="account-journey__status">Loading your NinFit ID…</p>
            </div>
          }
        >
          <NinFitIdAuth
            initialMode={stage.mode}
            returningFromConfirmation={returningFromConfirmation}
            onBack={() => setStage({ kind: 'choice' })}
            onContinue={onSkip}
          />
        </Suspense>
      </div>
    )
  }

  return (
    <div className="ninfit-id">
      <div className="ninfit-id__hero">
        <span className="ninfit-id__eyebrow">Your NinFit</span>

        <h1 className="ninfit-id__title">Take your journey with you.</h1>

        <p className="ninfit-id__copy">
          NinFit works without an account. A NinFit ID will let your future
          progress, trophies, Adventures and Crews travel with you.
        </p>

        <div className="ninfit-id__privacy">
          <span aria-hidden="true">◇</span>
          <span>Local by default · You choose what syncs</span>
        </div>
      </div>

      <div className="ninfit-id__actions">
        <button
          type="button"
          className="ninfit-id__social"
          disabled
          aria-label="Continue with Google, coming soon"
        >
          <span aria-hidden="true" className="ninfit-id__social-mark">
            G
          </span>
          <span>Continue with Google</span>
          <span className="ninfit-id__coming-soon">Soon</span>
        </button>

        <button
          type="button"
          className="ninfit-id__social"
          disabled
          aria-label="Continue with Apple, coming soon"
        >
          <span aria-hidden="true" className="ninfit-id__social-mark">

          </span>
          <span>Continue with Apple</span>
          <span className="ninfit-id__coming-soon">Soon</span>
        </button>

        <div className="ninfit-id__divider">
          <span>or</span>
        </div>

        <button
          type="button"
          className="btn btn--primary btn--block ninfit-id__email"
          onClick={() => setStage({ kind: 'email', mode: 'sign_up' })}
        >
          Continue with email
        </button>

        <button type="button" className="btn btn--quiet btn--block" onClick={onSkip}>
          Not now
        </button>
      </div>

      <p className="ninfit-id__footer">
        Already have a NinFit ID?{' '}
        <button
          type="button"
          className="ninfit-id__link"
          onClick={() => setStage({ kind: 'email', mode: 'sign_in' })}
        >
          Sign in
        </button>
      </p>
    </div>
  )
}
