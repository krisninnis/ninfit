import { useMemo, useState, type CSSProperties } from 'react';
import { getAppContext } from '../../app/bootstrap';
import { EggArt } from '../components/EggArt';
import { HatchCompanionMedia } from '../components/HatchCompanionMedia';
import { useHatchCinematic } from '../hooks/useHatchCinematic';
import { crackStageForProgress } from '../../domain/game/egg';
import { FITNESS_PATHS, FITNESS_STAGE_LABELS, findPath } from '../../domain/game/paths';
import {
  isReadyToRecommend,
  isRequiredQuestion,
  onboardingStages,
  prefillFromExistingData,
  recommendPath,
  stageProgress,
  type OnboardingQuestion,
} from '../../domain/game/onboarding';
import type { FitnessPathId, OnboardingAnswers } from '../../domain/game/types';
import type { FinishOnboardingInput } from '../../app/game';

interface OnboardingScreenProps {
  onStartJourney: (input: FinishOnboardingInput) => void;
  onFinished: () => void;
  onDismiss: () => void;
  /** Undefined until the authoritative hatch has revealed the family. */
  companionName?: string;
  /** Reviewed standing frame, supplied only after the domain reveals the family. */
  companionArtSrc?: string;
  /** Optional one-shot reveal motion, supplied on the same post-hatch boundary. */
  companionMotionSrc?: string;
}

type AnswerValue = string | string[] | undefined;

function readAnswer(answers: OnboardingAnswers, id: string): AnswerValue {
  const value = (answers as Record<string, unknown>)[id];
  if (Array.isArray(value)) return value as string[];
  if (value === undefined) return undefined;
  return String(value);
}

function coerce(id: string, raw: string): unknown {
  if (id === 'returningAfterBreak') return raw === 'true';
  if (id === 'availableMinutes') return Number(raw);
  return raw;
}

function isAnswered(answers: OnboardingAnswers, question: OnboardingQuestion): boolean {
  const value = readAnswer(answers, question.id);
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== '';
}

function QuestionStage({
  question,
  answers,
  onAnswer,
}: {
  question: OnboardingQuestion;
  answers: OnboardingAnswers;
  onAnswer: (id: string, value: unknown) => void;
}) {
  const current = readAnswer(answers, question.id);
  const headingId = `q-${question.id}`;

  return (
    <section className="step__panel">
      <h2 className="step__prompt" id={headingId}>
        {question.prompt}
      </h2>
      {question.help !== undefined ? <p className="step__help">{question.help}</p> : null}

      {question.kind === 'text' ? (
        <textarea
          className="note__input"
          rows={4}
          aria-labelledby={headingId}
          value={typeof current === 'string' ? current : ''}
          onChange={(event) =>
            onAnswer(question.id, event.target.value === '' ? undefined : event.target.value)
          }
          placeholder="Optional"
        />
      ) : (
        <div className="step__options" role="group" aria-labelledby={headingId}>
          {(question.options ?? []).map((option) => {
            const selected =
              question.kind === 'multi'
                ? Array.isArray(current) && current.includes(option.value)
                : current === option.value;

            return (
              <button
                key={option.value}
                type="button"
                className={`step__option${selected ? ' step__option--selected' : ''}`}
                aria-pressed={selected}
                onClick={() => {
                  if (question.kind === 'multi') {
                    const existing = Array.isArray(current) ? current : [];
                    const next = selected
                      ? existing.filter((entry) => entry !== option.value)
                      : [...existing, option.value];
                    onAnswer(question.id, next.length === 0 ? undefined : next);
                  } else {
                    onAnswer(question.id, selected ? undefined : coerce(question.id, option.value));
                  }
                }}
              >
                <span className="step__optionLabel">{option.label}</span>
                <span className="step__optionMark" aria-hidden="true">
                  {selected ? '✓' : ''}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function OnboardingScreen({
  onStartJourney,
  onFinished,
  onDismiss,
  companionName,
  companionArtSrc,
  companionMotionSrc,
}: OnboardingScreenProps) {
  const context = useMemo(() => getAppContext(), []);
  const [answers, setAnswers] = useState<OnboardingAnswers>(() =>
    prefillFromExistingData(context.repository.getProfile(), context.repository.getBaseline()),
  );
  const [index, setIndex] = useState(0);
  const [showAllPaths, setShowAllPaths] = useState(false);
  const [chosenPathId, setChosenPathId] = useState<FitnessPathId | undefined>(undefined);
  const [journeyStarted, setJourneyStarted] = useState(false);

  const stages = useMemo(() => onboardingStages(answers), [answers]);
  const safeIndex = Math.min(index, stages.length - 1);
  const stage = stages[safeIndex] ?? { kind: 'welcome' as const };
  const progress = stageProgress(stages, safeIndex);

  const ready = isReadyToRecommend(answers);
  const recommendation = useMemo(() => (ready ? recommendPath(answers) : undefined), [answers, ready]);

  const setAnswer = (id: string, value: unknown) => {
    setAnswers((current) => {
      const next = { ...current } as Record<string, unknown>;
      if (value === undefined) delete next[id];
      else next[id] = value;
      return next as OnboardingAnswers;
    });
  };

  const goBack = () => setIndex((value) => Math.max(0, value - 1));
  const goNext = () => setIndex((value) => Math.min(stages.length - 1, value + 1));
  const finalPathId = chosenPathId ?? recommendation?.pathId;

  /*
   * Onboarding and Today share the same timing/authority hook. `onStartJourney` is
   * called only at its real break point. The family and both companion media props
   * remain undefined until App re-renders from that authoritative state change.
   */
  const hatch = useHatchCinematic({
    canHatch: recommendation !== undefined && finalPathId !== undefined && !journeyStarted,
    onHatch: () => {
      if (recommendation === undefined || finalPathId === undefined) return;
      setJourneyStarted(true);
      onStartJourney({
        answers,
        recommendedPathId: recommendation.pathId,
        chosenPathId: finalPathId,
      });
    },
  });

  const hatched = journeyStarted && companionName !== undefined;
  const canContinue =
    stage.kind !== 'question' || !isRequiredQuestion(stage.question.id) || isAnswered(answers, stage.question);
  const energy = progress.fraction;

  return (
    <div className="step" style={{ '--energy': energy } as CSSProperties}>
      <div className={`step__egg${hatch.isRunning ? ` egg-hatch--${hatch.phase}` : ''}`}>
        {hatch.phase.startsWith('reduced-') ? (
          <div className="egg-hatch__reduced" role="status" aria-live="polite">
            <span>{hatch.phase === 'reduced-ready' ? 'Your egg is ready.' : hatch.phase === 'reduced-opening' ? 'It’s opening.' : 'Meet your companion.'}</span>
            <button type="button" className="egg-hatch__skip" onClick={hatch.skip}>Skip</button>
          </div>
        ) : null}

        {!hatched || hatch.isRunning ? (
          <EggArt
            energy={energy}
            crackStage={crackStageForProgress(progress.fraction)}
          />
        ) : companionArtSrc !== undefined ? (
          <img className="step__companionArt" src={companionArtSrc} alt="" aria-hidden="true" />
        ) : (
          <span className="step__companionMark" aria-hidden="true">
            {companionName?.slice(0, 1)}
          </span>
        )}

        {hatched && hatch.isRunning ? (
          <HatchCompanionMedia
            phase={hatch.phase}
            standingSrc={companionArtSrc}
            motionSrc={companionMotionSrc}
            fallbackMark={companionName?.slice(0, 1)}
          />
        ) : null}

        {hatch.phase === 'flash' ? <span className="egg__hatchFlash" aria-hidden="true" /> : null}
      </div>

      {stage.kind !== 'welcome' ? (
        <div
          className="step__progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress.fraction * 100)}
          aria-label="Onboarding progress"
        >
          <span className="step__progressFill" style={{ width: `${progress.fraction * 100}%` }} />
        </div>
      ) : null}

      <div className="step__body" key={journeyStarted ? 'reveal' : safeIndex}>
        {journeyStarted && companionName !== undefined ? (
          <section className="step__panel">
            <span className="onboard__label">Your companion</span>
            <h1 className="step__title">{companionName}</h1>
            <p className="step__help">
              Say hello. They will grow as you move - real sessions, real progress, at
              whatever pace suits you.
            </p>
            <button type="button" className="btn btn--primary btn--block" onClick={onFinished}>
              Continue
            </button>
          </section>
        ) : null}

        {journeyStarted && companionName === undefined ? (
          <section className="step__panel">
            <h1 className="step__title">Almost there</h1>
            <p className="step__help">Getting your companion ready.</p>
          </section>
        ) : null}

        {!journeyStarted && stage.kind === 'welcome' ? (
          <section className="step__panel">
            <h1 className="step__title">Let&rsquo;s find your starting point</h1>
            <p className="step__help">
              A few questions will help us recommend a fitness path. You can change the
              recommendation before starting, and change your mind later.
            </p>
            <p className="step__help">Nothing here is medical, and none of it is shared.</p>
          </section>
        ) : null}

        {!journeyStarted && stage.kind === 'question' ? (
          <QuestionStage question={stage.question} answers={answers} onAnswer={setAnswer} />
        ) : null}

        {!journeyStarted && stage.kind === 'recommendation' && recommendation !== undefined ? (
          <section className="step__panel step__reveal" data-path={finalPathId}>
            <span className="onboard__label">
              {chosenPathId === undefined ? 'Based on your answers' : 'Your choice'}
            </span>
            <h1 className="onboard__path">{findPath(finalPathId ?? recommendation.pathId).name}</h1>
            <p className="step__help">{findPath(finalPathId ?? recommendation.pathId).summary}</p>
            {chosenPathId === undefined ? (
              <p className="onboard__why">{recommendation.explanation}</p>
            ) : (
              <p className="onboard__why">
                You picked this one. Nothing about the recommendation is lost - you can change
                direction whenever you like.
              </p>
            )}
            <p className="footnote">
              Starting stage: {FITNESS_STAGE_LABELS[recommendation.fitnessStage]}. Everyone begins
              the game at level 1, whatever their starting point. You can change direction later.
            </p>

            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={hatch.request}
              disabled={hatch.isRunning}
            >
              {hatch.isRunning ? 'Hatching…' : 'Start my journey'}
            </button>
            <button
              type="button"
              className="btn btn--quiet btn--block"
              aria-expanded={showAllPaths}
              onClick={() => setShowAllPaths((value) => !value)}
            >
              {showAllPaths ? 'Hide other paths' : 'See other paths'}
            </button>

            {showAllPaths ? (
              <ul className="step__paths">
                {FITNESS_PATHS.filter((path) => path.id !== finalPathId).map((path) => (
                  <li className="surface step__path" key={path.id}>
                    <h2 className="onboard__path">{path.name}</h2>
                    <p className="footnote">{path.summary}</p>
                    <button
                      type="button"
                      className="btn btn--secondary btn--block"
                      onClick={() => setChosenPathId(path.id)}
                    >
                      Choose {path.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        {!journeyStarted && stage.kind === 'recommendation' && recommendation === undefined ? (
          <section className="step__panel">
            <h1 className="step__title">Almost there</h1>
            <p className="step__help">
              Go back and answer the first few questions and we can suggest a path.
            </p>
          </section>
        ) : null}
      </div>

      <nav className="step__nav" aria-label="Onboarding navigation">
        {journeyStarted ? null : safeIndex > 0 ? (
          <button type="button" className="btn btn--secondary" onClick={goBack}>
            Back
          </button>
        ) : (
          <button type="button" className="btn btn--secondary" onClick={onDismiss}>
            Not now
          </button>
        )}

        {!journeyStarted && stage.kind !== 'recommendation' ? (
          <button type="button" className="btn btn--primary step__next" disabled={!canContinue} onClick={goNext}>
            {stage.kind === 'welcome' ? 'Start' : 'Continue'}
          </button>
        ) : null}
      </nav>
    </div>
  );
}
