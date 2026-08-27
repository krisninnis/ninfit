import {
  journeyCompanionContext,
  type JourneyCompanionContext,
  type JourneyCompanionFacts,
} from '../domain/game/journeyCompanionContext';
import type { MascotFamily } from '../domain/game/types';
import type {
  CompanionReactionLifetime,
  CompanionReactionPresentation,
} from './companionReactionPresentation';

/**
 * Visual treatment for an already-decided Journey companion context.
 *
 * This module does not decide what happened on Journey. It receives a context from
 * the deterministic domain projection and maps it into the companion presentation
 * vocabulary that already exists - the same `CompanionReactionPresentation` union
 * Today uses, imported rather than redeclared, so there is one set of atmospheres in
 * the app and not two that can drift apart.
 *
 * WHY THERE IS NO MOMENT TIER HERE, AND WHY THAT IS THE DESIGN.
 *
 * Today can afford transient emphasis because it has a trustworthy freshness
 * identity: the ids of the rewards the most recent sync actually granted, which is
 * empty on a repeat or a reload. Journey has no equivalent. Journey history is read
 * from storage and a Journey completed a minute ago is indistinguishable, on load,
 * from one completed last spring.
 *
 * So every Journey context is `standing`. The presence stays calm and stays truthful
 * for as long as its truth is current, and there is no timer, no dwell and no
 * freshness semantics invented for a screen that cannot honestly prove freshness.
 * Historical completion therefore cannot masquerade as a fresh event: the strongest
 * treatment it can ever reach is `warm`, and `celebrate` is unreachable from Journey
 * Home entirely.
 */

export const JOURNEY_COMPANION_PRESENTATION: Readonly<
  Record<JourneyCompanionContext, CompanionReactionPresentation>
> = {
  journey_continuing: 'action',
  journey_history: 'warm',
  journey_invitation: 'calm',
};

export const JOURNEY_COMPANION_LIFETIME: Readonly<
  Record<JourneyCompanionContext, CompanionReactionLifetime>
> = {
  journey_continuing: 'standing',
  journey_history: 'standing',
  journey_invitation: 'standing',
};

export function journeyCompanionPresentation(
  context: JourneyCompanionContext,
): CompanionReactionPresentation {
  return JOURNEY_COMPANION_PRESENTATION[context];
}

export function journeyCompanionLifetime(
  context: JourneyCompanionContext,
): CompanionReactionLifetime {
  return JOURNEY_COMPANION_LIFETIME[context];
}

export interface JourneyCompanionPresence {
  family: MascotFamily;
  context: JourneyCompanionContext;
}

/**
 * Whether there is a companion to show at all, and which context it is in.
 *
 * THE EGG IS STILL A SECRET AND THIS IS WHERE THAT IS ENFORCED FOR JOURNEY.
 *
 * `visibleMascotFamily` returns undefined until the egg has hatched, and an
 * unhatched companion has no name, no glyph and nothing it could say without
 * spoiling the one surprise the product has. So an absent family means an absent
 * presence: Journey Home shows nothing rather than a second Mystery Egg card
 * competing with Today's.
 *
 * The family is passed straight through, never rebuilt, so this cannot become a
 * second opinion about who the companion is.
 */
export function journeyCompanionPresence(
  family: MascotFamily | undefined,
  facts: JourneyCompanionFacts,
): JourneyCompanionPresence | undefined {
  if (family === undefined) return undefined;
  return { family, context: journeyCompanionContext(facts) };
}
