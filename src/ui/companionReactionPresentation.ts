import type { MascotContext } from '../domain/game/messages';

/**
 * Visual treatment for an already-decided companion context.
 *
 * This module does not decide what happened. It receives MascotContext from the
 * deterministic domain path and maps that context to a small presentation vocabulary.
 * Adding a new MascotContext must therefore make this mapping fail to compile until
 * its visual treatment is chosen deliberately.
 */
export type CompanionReactionPresentation =
  | 'calm'
  | 'action'
  | 'warm'
  | 'rest'
  | 'welcome'
  | 'celebrate';

export const COMPANION_REACTION_PRESENTATION: Readonly<
  Record<MascotContext, CompanionReactionPresentation>
> = {
  egg_waiting: 'calm',
  hatch_ready: 'action',
  just_hatched: 'warm',
  session_complete: 'warm',
  partial_complete: 'warm',
  rest_day: 'rest',
  returning: 'welcome',
  idle: 'calm',
  evolution_ready: 'action',
  trophy: 'celebrate',
};

export function companionReactionPresentation(
  context: MascotContext,
): CompanionReactionPresentation {
  return COMPANION_REACTION_PRESENTATION[context];
}
