import { LivingScrim } from '../components/LivingScrim';
import { Screen } from '../components/Screen';
import { useGame } from '../hooks/useGame';
import { passportPresentation } from '../passportPresentation';

interface PassportScreenProps {
  onClose(): void;
}

function formatPassportDate(value: string | null): string {
  if (value === null) return 'Not recorded';
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function PassportScreen({ onClose }: PassportScreenProps) {
  const game = useGame();
  const passport = passportPresentation(game.state);

  return (
    <Screen
      title="Passport"
      subtitle="The record of your current NinFit companion."
    >
      <button type="button" className="passport__back" onClick={onClose}>
        <span aria-hidden="true">←</span>
        <span>Profile</span>
      </button>

      <LivingScrim variant="hero" className="passport__hero">
        <div className="passport__identity">
          <div className="passport__portrait" aria-hidden="true">
            {passport.familyGlyph ?? '?'}
          </div>

          <div className="passport__identity-copy">
            <p className="passport__eyebrow">
              {passport.status === 'active' ? 'Current companion' : 'Sealed passport'}
            </p>
            <h2>{passport.title}</h2>
            <p>
              {passport.status === 'active'
                ? 'This page records what NinFit already knows about your companion.'
                : 'Your companion remains a surprise until the egg hatches.'}
            </p>
          </div>
        </div>
      </LivingScrim>

      {passport.status === 'active' ? (
        <section className="passport__record" aria-labelledby="passport-record-title">
          <div className="passport__section-heading">
            <p className="passport__eyebrow">Journey record</p>
            <h2 id="passport-record-title">Current chapter</h2>
          </div>

          <dl className="passport__facts">
            <div>
              <dt>Companion</dt>
              <dd>{passport.familyName}</dd>
            </div>
            <div>
              <dt>Path</dt>
              <dd>{passport.pathName ?? 'Not chosen yet'}</dd>
            </div>
            <div>
              <dt>Stage</dt>
              <dd>{passport.stageLabel}</dd>
            </div>
            <div>
              <dt>Level</dt>
              <dd>{passport.level}</dd>
            </div>
            <div>
              <dt>Hatched</dt>
              <dd>{formatPassportDate(passport.hatchedAt)}</dd>
            </div>
            <div>
              <dt>Last evolution</dt>
              <dd>{formatPassportDate(passport.lastEvolvedAt)}</dd>
            </div>
          </dl>
        </section>
      ) : (
        <section className="passport__sealed-note" aria-label="Passport not yet opened">
          <strong>Nothing is revealed early.</strong>
          <p>
            The species, stage and hatch record appear here only after the egg opens.
          </p>
          {passport.pathName !== null ? (
            <p>Your chosen fitness path is {passport.pathName}.</p>
          ) : null}
        </section>
      )}

      <p className="passport__footnote">
        Passport v1 is read-only. It does not change XP, evolution, rewards, rarity or fitness data.
      </p>
    </Screen>
  );
}
