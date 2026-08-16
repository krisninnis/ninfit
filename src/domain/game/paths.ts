import type {
  FitnessPath,
  FitnessPathId,
  FitnessStageId,
  MascotFamily,
  MascotFamilyId,
  SkillKind,
} from './types';

/**
 * Paths, and the mascot families they hatch.
 *
 * Entirely data-driven. Changing which animal belongs to a path, or adding a sixth
 * path, is an edit to these tables and nothing else: no screen contains
 * animal-specific logic.
 *
 * These are product paths. They describe how someone wants to train, not anything
 * about their health.
 */

export const FITNESS_PATHS: readonly FitnessPath[] = [
  {
    id: 'start_moving',
    name: 'Start Moving',
    summary: 'Short, gentle sessions to build the habit first. Everything else follows.',
    mascotFamilyId: 'tortoise',
    highlightedSkills: ['consistency', 'mobility'],
  },
  {
    id: 'build_strength',
    name: 'Build Strength',
    summary: 'Progressive strength work, with enough movement to keep everything else ticking.',
    mascotFamilyId: 'bear',
    highlightedSkills: ['strength', 'consistency'],
  },
  {
    id: 'build_stamina',
    name: 'Build Stamina',
    summary: 'Walking and cardio, building how far and how long rather than how hard.',
    mascotFamilyId: 'fox',
    highlightedSkills: ['stamina', 'consistency'],
  },
  {
    id: 'balanced_fitness',
    name: 'Balanced Fitness',
    summary: 'A mix of strength, stamina and mobility, without specialising in any of them.',
    mascotFamilyId: 'otter',
    highlightedSkills: ['strength', 'stamina', 'mobility'],
  },
  {
    id: 'return_to_fitness',
    name: 'Return to Fitness',
    summary: 'Rebuilding after a break, starting below where you left off on purpose.',
    mascotFamilyId: 'wolf',
    highlightedSkills: ['consistency', 'recovery', 'stamina'],
  },
] as const;

/**
 * The five core path mascot families. This list is closed.
 *
 * One family per fitness path, and no more: Opal is the companion and lives in
 * companion.ts, while Owl and Red Panda are future character possibilities with no
 * path, no family id and no presence in this table. Adding a sixth entry here means
 * adding a sixth fitness path, which is a product decision rather than a data one.
 *
 * TEMPORARY: `glyph` is a single letter, not mascot artwork.
 *
 * It exists so the progression model could be built and tested without blocking on
 * illustration, and it is the only visual any family currently has. It is a
 * presentation fallback and nothing more - no domain logic reads it, no reward or
 * evolution depends on it, and it must be replaced by real artwork rather than
 * dressed up. See the mascot art pipeline in the roadmap.
 */
export const MASCOT_FAMILIES: readonly MascotFamily[] = [
  { id: 'tortoise', name: 'Tortoise', glyph: 'T' },
  { id: 'bear', name: 'Bear', glyph: 'B' },
  { id: 'fox', name: 'Fox', glyph: 'F' },
  { id: 'otter', name: 'Otter', glyph: 'O' },
  { id: 'wolf', name: 'Wolf', glyph: 'W' },
] as const;

export const FITNESS_STAGES: readonly FitnessStageId[] = [
  'settling_in',
  'building',
  'developing',
  'experienced',
] as const;

export const FITNESS_STAGE_LABELS: Readonly<Record<FitnessStageId, string>> = {
  settling_in: 'Settling in',
  building: 'Building',
  developing: 'Developing',
  experienced: 'Experienced',
};

export function findPath(id: FitnessPathId): FitnessPath {
  const found = FITNESS_PATHS.find((path) => path.id === id);
  if (!found) throw new Error(`Unknown fitness path: ${id}`);
  return found;
}

export function findMascotFamily(id: MascotFamilyId): MascotFamily {
  const found = MASCOT_FAMILIES.find((family) => family.id === id);
  if (!found) throw new Error(`Unknown mascot family: ${id}`);
  return found;
}

/**
 * The mascot family a path hatches. The single place that mapping is expressed.
 *
 * LEGACY BEHAVIOUR, PRESERVED ON PURPOSE. This is a deterministic 1:1 map, so today
 * the path decides the species outright and it is settled before the egg even
 * exists. The approved direction replaces it with curated-random selection from a
 * weighted shortlist, seeded and recorded on the mascot's passport.
 *
 * That replacement belongs to the hatch milestone, not here. M1 changes nothing
 * about which mascot anyone receives - `src/test/game.test.ts` pins the five
 * mappings, and those assertions must keep passing until selection is genuinely
 * replaced.
 */
export function mascotFamilyForPath(id: FitnessPathId): MascotFamilyId {
  return findPath(id).mascotFamilyId;
}

/**
 * The two or three skills a path leans on. The other tracks remain fully visible and
 * fully capable of progressing: highlighting is emphasis, never a restriction.
 */
export function highlightedSkillsForPath(id: FitnessPathId): readonly SkillKind[] {
  return findPath(id).highlightedSkills;
}

export function isHighlightedSkill(pathId: FitnessPathId | undefined, skill: SkillKind): boolean {
  if (pathId === undefined) return false;
  return highlightedSkillsForPath(pathId).includes(skill);
}
