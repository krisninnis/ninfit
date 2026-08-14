import type { MascotPersonality } from './types';

/**
 * What the mascot says.
 *
 * A small data table, not a language model. Nothing here is generated, personalised
 * from health data, or capable of saying anything about someone's body.
 *
 * The tone rule is absolute: no guilt, ever. Coming back after two weeks away gets
 * "Ready when you are", never "you broke your streak". There is nothing to break.
 */

export type MascotContext =
  | 'egg_waiting'
  | 'hatch_ready'
  | 'just_hatched'
  | 'session_complete'
  | 'partial_complete'
  | 'rest_day'
  | 'returning'
  | 'idle'
  | 'evolution_ready'
  | 'trophy';

type MessageTable = Readonly<Record<MascotContext, Readonly<Record<MascotPersonality, string | undefined>>>>;

const MESSAGES: MessageTable = {
  egg_waiting: {
    quiet: undefined,
    normal: 'Something inside is moving.',
    chatty: 'Something in there is definitely moving. No idea what yet.',
  },
  hatch_ready: {
    quiet: 'Ready.',
    normal: "Something's happening...",
    chatty: "Something's happening. Whenever you're ready to look.",
  },
  just_hatched: {
    quiet: 'Hello.',
    normal: 'Well then. Hello.',
    chatty: 'Well then, hello. Looks like we are doing this together.',
  },
  session_complete: {
    quiet: undefined,
    normal: 'All of it. Nice one.',
    chatty: 'That is the whole session done. Genuinely good going.',
  },
  // Partial is a win, and is worded as one. Never "you only did half".
  partial_complete: {
    quiet: undefined,
    normal: 'That counts.',
    chatty: 'You did some of it, and that absolutely counts. Same again tomorrow.',
  },
  rest_day: {
    quiet: undefined,
    normal: 'Rest day. That is part of it.',
    chatty: 'Rest day today. Resting is part of the programme, not a day off from it.',
  },
  returning: {
    quiet: 'Ready when you are.',
    normal: 'Ready when you are.',
    chatty: 'Good to see you. Ready when you are, no rush.',
  },
  idle: {
    quiet: undefined,
    normal: 'Whenever suits.',
    chatty: 'No pressure today. Whenever suits you.',
  },
  evolution_ready: {
    quiet: 'Something has changed.',
    normal: 'Something has changed. Take a look when you want to.',
    chatty: 'Something has definitely changed. Have a look whenever you fancy it.',
  },
  trophy: {
    quiet: undefined,
    normal: 'That one is worth keeping.',
    chatty: 'New trophy. That one is worth keeping hold of.',
  },
};

/** Undefined means say nothing, which is the point of the quiet personality. */
export function mascotMessage(
  context: MascotContext,
  personality: MascotPersonality,
): string | undefined {
  return MESSAGES[context][personality];
}

/** Days away before the mascot greets a return rather than saying nothing. */
export const RETURNING_AFTER_DAYS = 4;
