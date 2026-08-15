import type { ISODate, ISODateTime, UUID } from '../types';

/**
 * The game layer.
 *
 * A motivation layer that sits on top of the tracker. It reads fitness facts and
 * never writes them: no game state lives in `DailyLog`, and nothing here can change
 * what the user recorded about their body.
 *
 * Principles encoded in these types:
 *   - Reward the behaviour, not the outcome. Partial work earns real XP.
 *   - Rest is part of the programme, never a gap.
 *   - Nothing auto-triggers. Hatching and evolving are the user's to press.
 *   - Everything social is off and private by default.
 *   - Cosmetics are decoration and can never affect progression.
 */

// --- Paths and stages ------------------------------------------------------

/** Product paths, not medical classifications. The user can always override. */
export type FitnessPathId =
  | 'start_moving'
  | 'build_strength'
  | 'build_stamina'
  | 'balanced_fitness'
  | 'return_to_fitness';

/**
 * Where the user is starting from within their path. Deliberately separate from
 * game level: someone fitter starts at a later fitness stage but still at level 1.
 */
export type FitnessStageId = 'settling_in' | 'building' | 'developing' | 'experienced';

export type SkillKind = 'strength' | 'stamina' | 'mobility' | 'consistency' | 'recovery';

export const SKILL_KINDS: readonly SkillKind[] = [
  'strength',
  'stamina',
  'mobility',
  'consistency',
  'recovery',
] as const;

export interface FitnessPath {
  id: FitnessPathId;
  name: string;
  summary: string;
  /** Which mascot family this path hatches. Data-driven, swappable. */
  mascotFamilyId: MascotFamilyId;
  /** Two or three skills this path leans on. The others still progress. */
  highlightedSkills: readonly SkillKind[];
}

// --- Mascot ----------------------------------------------------------------

export type MascotFamilyId = 'tortoise' | 'bear' | 'fox' | 'otter' | 'wolf';

/** Cute at the start, progressively more impressive. */
export type MascotStageId = 'starter' | 'growing' | 'capable' | 'advanced' | 'elite';

export const MASCOT_STAGES: readonly MascotStageId[] = [
  'starter',
  'growing',
  'capable',
  'advanced',
  'elite',
] as const;

export interface MascotFamily {
  id: MascotFamilyId;
  /** Never rendered before the egg hatches. */
  name: string;
  /** Placeholder art until real assets exist. */
  glyph: string;
}

export type EggState = 'unhatched' | 'ready' | 'hatched';

/**
 * Qualitative only. An exact percentage to the next evolution would remove the
 * mystery, so the model refuses to expose one.
 */
export type EvolutionStatus =
  | 'settling_in'
  | 'growing'
  | 'getting_stronger'
  | 'nearly_ready'
  | 'evolution_close';

export interface MascotState {
  /**
   * Known internally from the moment the path is chosen, but never surfaced by the
   * UI until `eggState` is 'hatched'.
   */
  familyId: MascotFamilyId;
  eggState: EggState;
  stage: MascotStageId;
  /** Earned and waiting. Evolution is always user-triggered. */
  evolutionReady: boolean;
  hatchedAt?: ISODateTime;
  lastEvolvedAt?: ISODateTime;
}

// --- Progression -----------------------------------------------------------

export interface XPState {
  /** Lifetime XP. Never decreases. */
  total: number;
  /** Overall game level, always starting at 1 for everyone. */
  level: number;
}

export interface SkillProgress {
  kind: SkillKind;
  xp: number;
  level: number;
}

// --- Trophies --------------------------------------------------------------

export type TrophyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

/** Independent of health data. A public trophy never exposes a measurement. */
export type RewardVisibility = 'private' | 'friends' | 'public';

export interface TrophyDefinition {
  id: string;
  tier: TrophyTier;
  name: string;
  description: string;
  /** Hidden until unlocked, for the long-term ones. */
  secret?: boolean;
}

export interface TrophyUnlock {
  trophyId: string;
  unlockedAt: ISODateTime;
  /** Always 'private' on unlock. Changing it is a deliberate user act. */
  visibility: RewardVisibility;
}

// --- Reward events ---------------------------------------------------------

export type RewardKind =
  | 'activity_completed'
  | 'session_completed'
  | 'first_programme_day'
  | 'rest_day_observed'
  | 'first_measurement'
  /** Three or seven planned activity occasions that went well. Never a daily streak. */
  | 'consistency_milestone'
  | 'trophy_unlocked';

/**
 * A reward that has been granted.
 *
 * `key` is derived from the underlying fitness fact, not from a click. The same fact
 * always produces the same key, which is what makes granting idempotent across
 * reloads, re-renders and re-reads.
 */
export interface RewardEvent {
  id: UUID;
  key: string;
  kind: RewardKind;
  xp: number;
  skillXp: Partial<Record<SkillKind, number>>;
  label: string;
  /** The programme day the reward came from, where it has one. */
  date?: ISODate;
  awardedAt: ISODateTime;
}

// --- Settings --------------------------------------------------------------

export type MascotPersonality = 'quiet' | 'normal' | 'chatty';

/**
 * Everything social starts off. Health data is private by default and stays private
 * regardless of what a trophy's visibility is set to.
 */
export type SocialMode = 'private' | 'friends' | 'community';

export interface ChallengeToggles {
  personal: boolean;
  friends: boolean;
  community: boolean;
}

export interface GameSettings {
  mascotPersonality: MascotPersonality;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  socialMode: SocialMode;
  challenges: ChallengeToggles;
  /** Default visibility applied to newly unlocked trophies. */
  defaultTrophyVisibility: RewardVisibility;
}

// --- Cosmetics -------------------------------------------------------------

export type CosmeticSlot = 'accessory' | 'outfit' | 'colour' | 'background' | 'effect';

/**
 * Purely visual, forever. Nothing in the progression model reads these, and no
 * function may ever let a cosmetic change XP, evolution or rewards.
 */
export interface CosmeticItem {
  id: string;
  slot: CosmeticSlot;
  name: string;
}

export interface CosmeticInventory {
  ownedIds: string[];
  equipped: Partial<Record<CosmeticSlot, string>>;
}

// --- Onboarding ------------------------------------------------------------

export interface OnboardingAnswers {
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active';
  structuredExercise?: 'none' | 'occasional' | 'regular';
  walkComfort?: 'not_yet' | 'with_effort' | 'comfortable';
  mainGoal?: 'start_moving' | 'strength' | 'stamina' | 'balanced' | 'return';
  previousExperience?: 'none' | 'some' | 'lots';
  returningAfterBreak?: boolean;
  availableMinutes?: 10 | 20 | 30 | 45;
  preferredActivities?: Array<'walking' | 'yoga' | 'strength' | 'cycling' | 'swimming'>;
  equipmentAccess?: 'none' | 'home' | 'gym';
  confidence?: 'low' | 'medium' | 'high';
  /** Free text, entirely optional. Never parsed, never classified. */
  anythingElse?: string;
}

export interface OnboardingState {
  completed: boolean;
  completedAt?: ISODateTime;
  answers: OnboardingAnswers;
  recommendedPathId?: FitnessPathId;
  /** True when the user picked something other than the recommendation. */
  overrodeRecommendation: boolean;
}

// --- Aggregate -------------------------------------------------------------

export const GAME_SCHEMA_VERSION = 1;

export interface GameState {
  schemaVersion: number;
  createdAt: ISODateTime;
  onboarding: OnboardingState;
  /** Undefined until onboarding picks one. */
  pathId?: FitnessPathId;
  fitnessStage: FitnessStageId;
  mascot: MascotState;
  xp: XPState;
  skills: SkillProgress[];
  trophies: TrophyUnlock[];
  /**
   * Every reward key already granted. This is the whole of the idempotency
   * mechanism: a key present here is never granted a second time.
   */
  awardedKeys: string[];
  /** Most recent first, capped. Used only to show what just happened. */
  recentEvents: RewardEvent[];
  cosmetics: CosmeticInventory;
}
