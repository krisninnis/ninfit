import { useMemo, useState, type CSSProperties } from 'react';
import { getAppContext } from '../../app/bootstrap';
import { EggArt } from '../components/EggArt';
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

/**
 * Onboarding, one question at a time.
 *
 * The flow is adaptive, so the stage list is recomputed from the answers after every
 * change and a follow-up can appear or vanish mid-flow. That is also why there is no
 * fixed "step x of y" label: the total genuinely moves, and a bar over what is currently
 * resolved is the truthful version.
 *
 * Answers live in component state, so going Back and forward again never loses one.
 * Nothing is written until the user accepts a path, so a half-finished flow is never
 * stored as a completed classification.
 *
 * The mascot stays secret throughout. No animal, family or silhouette appears here.
 */

interface OnboardingScreenProps {
  onComplete: (input: FinishOnboardingInput) => void;
  onDismiss: () => void;
}

type AnswerValue = string | string[] | undefined;

function readAnswer(answers: OnboardingAnswers, id: string): AnswerValue {
  const value = (answers as Record<string, unknown>)[id];
  if (Array.isArray(value)) return value as string[];
  if (value === undefined) return undefined;
  return String(value);
}

/** Options carry strings; the few typed fields convert back here. */
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
                {/* A tick as well as colour, so selection is never colour alone. */}
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

export function OnboardingScreen({ onComplete, onDismiss }: OnboardingScreenProps) {
  const context = useMemo(() => getAppContext(), []);

  // Prefilled from what the tracker already knows. Private health notes are never
  // read, and nothing about the person is inferred from them.
  const [answers, setAnswers] = useState<OnboardingAnswers>(() =>
    prefillFromExistingData(context.repository.getProfile(), context.repository.getBaseline()),
  );
  const [index, setIndex] = useState(0);
  const [showAllPaths, setShowAllPaths] = useState(false);

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

  const accept = (pathId: FitnessPathId) => {
    if (recommendation === undefined) return;
    onComplete({ answers, recommendedPathId: recommendation.pathId, chosenPathId: pathId });
  };

  const canContinue =
    stage.kind !== 'question' || !isRequiredQuestion(stage.question.id) || isAnswered(answers, stage.question);

  /**
   * How far along the journey feels, 0 to 1.
   *
   * Reused from the progress model rather than being a second, parallel notion of
   * "how far in are we" that could drift out of step with the bar. It drives the
   * background wash and the egg's presence, both of which are decoration computed
   * from a value that is already tested.
   */
  const energy = progress.fraction;

  return (
    <div className="step" style={{ '--energy': energy } as CSSProperties}>
      {/*
        The egg sits above the progress bar and stays in the same place for the whole
        flow, so it reads as one object travelling with the user rather than an
        illustration that changes per screen. It is identical on every path.
      */}
      <div className="step__egg">
        <EggArt energy={energy} />
      </div>

      {stage.kind !== 'welcome' ? (
        <div className="step__progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.fraction * 100)} aria-label="Onboarding progress">
          <span className="step__progressFill" style={{ width: `${progress.fraction * 100}%` }} />
        </div>
      ) : null}

      <div className="step__body" key={safeIndex}>
        {stage.kind === 'welcome' ? (
          <section className="step__panel">
            <h1 className="step__title">Let&rsquo;s find your starting point</h1>
            <p className="step__help">
              A few questions will help us recommend a fitness path. You can change the
              recommendation before starting, and change your mind later.
            </p>
            <p className="step__help">Nothing here is medical, and none of it is shared.</p>
          </section>
        ) : null}

        {stage.kind === 'question' ? (
          <QuestionStage question={stage.question} answers={answers} onAnswer={setAnswer} />
        ) : null}

        {stage.kind === 'recommendation' && recommendation !== undefined ? (
          /*
           * THE ONE PLACE A PATH BECOMES VISIBLE DURING ONBOARDING.
           *
           * `data-path` is scoped to this section and rendered only on this stage, so
           * the accent cannot appear on any earlier screen: there is no element to
           * carry it until the recommendation exists. Everything outside this section
           * - the egg, the background wash, the progress bar, the navigation - stays
           * on the neutral accent, which is why the reveal reads as a moment.
           *
           * It names the PATH, not the animal. The mascot stays sealed until the user
           * opens the egg later on Today, which is a separate and explicit action.
           */
          <section className="step__panel step__reveal" data-path={recommendation.pathId}>
            <span className="onboard__label">Based on your answers</span>
            <h1 className="onboard__path">{findPath(recommendation.pathId).name}</h1>
            <p className="step__help">{findPath(recommendation.pathId).summary}</p>
            <p className="onboard__why">{recommendation.explanation}</p>
            <p className="footnote">
              Starting stage: {FITNESS_STAGE_LABELS[recommendation.fitnessStage]}. Everyone begins
              the game at level 1, whatever their starting point. You can change direction later.
            </p>

            <button type="button" className="btn btn--primary btn--block" onClick={() => accept(recommendation.pathId)}>
              Start this path
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
                {FITNESS_PATHS.filter((path) => path.id !== recommendation.pathId).map((path) => (
                  <li className="surface step__path" key={path.id}>
                    <h2 className="onboard__path">{path.name}</h2>
                    <p className="footnote">{path.summary}</p>
                    <button
                      type="button"
                      className="btn btn--secondary btn--block"
                      onClick={() => accept(path.id)}
                    >
                      Choose {path.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        {stage.kind === 'recommendation' && recommendation === undefined ? (
          <section className="step__panel">
            <h1 className="step__title">Almost there</h1>
            <p className="step__help">
              Go back and answer the first few questions and we can suggest a path.
            </p>
          </section>
        ) : null}
      </div>

      <nav className="step__nav" aria-label="Onboarding navigation">
        {safeIndex > 0 ? (
          <button type="button" className="btn btn--secondary" onClick={goBack}>
            Back
          </button>
        ) : (
          <button type="button" className="btn btn--secondary" onClick={onDismiss}>
            Not now
          </button>
        )}

        {stage.kind !== 'recommendation' ? (
          <button type="button" className="btn btn--primary step__next" disabled={!canContinue} onClick={goNext}>
            {stage.kind === 'welcome' ? 'Start' : 'Continue'}
          </button>
        ) : null}
      </nav>
    </div>
  );
}
