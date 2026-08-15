interface NinFitIdScreenProps {
  onContinueWithEmail: () => void
  onSkip: () => void
}

export function NinFitIdScreen({
  onContinueWithEmail,
  onSkip,
}: NinFitIdScreenProps) {
  return (
    <div className="ninfit-id">
      <div className="ninfit-id__hero">
        <span className="ninfit-id__eyebrow">
          Your NinFit
        </span>

        <h1 className="ninfit-id__title">
          Take your journey with you.
        </h1>

        <p className="ninfit-id__copy">
          NinFit works without an account. A NinFit ID will let your
          future progress, trophies, Adventures and Crews travel with you.
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
          <span className="ninfit-id__coming-soon">
            Soon
          </span>
        </button>

        <button
          type="button"
          className="ninfit-id__social"
          disabled
          aria-label="Continue with Apple, coming soon"
        >
          <span aria-hidden="true" className="ninfit-id__social-mark">
            
          </span>
          <span>Continue with Apple</span>
          <span className="ninfit-id__coming-soon">
            Soon
          </span>
        </button>

        <div className="ninfit-id__divider">
          <span>or</span>
        </div>

        <button
          type="button"
          className="btn btn--primary btn--block ninfit-id__email"
          onClick={onContinueWithEmail}
        >
          Continue with email
        </button>

        <button
          type="button"
          className="btn btn--quiet btn--block"
          onClick={onSkip}
        >
          Not now
        </button>
      </div>

      <p className="ninfit-id__footer">
        Already have a NinFit ID? You’ll be able to sign in with email,
        Google or Apple.
      </p>
    </div>
  )
}
