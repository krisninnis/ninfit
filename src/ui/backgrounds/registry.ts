import type { TabId } from '../tabs';

/**
 * The NinFit world map: one entry per region the user can visit.
 *
 * WHAT THIS IS FOR. Screens name a region; they never name a file. Every fact about
 * how a region is painted - which artwork, where its focal point is, how heavily it
 * is veiled - lives here, so re-cropping an image or swapping an asset is a change to
 * this table and to nothing else. No component may hold a background URL.
 *
 * WHY IDS AND NOT PATHS. `BackdropId` is a closed union, so a typo is a compile
 * error rather than a silently missing image, and the domain never learns a filename.
 * The game and fitness layers know nothing about this module at all.
 *
 * ARTWORK IS DECORATIVE, ALWAYS. `label` exists for documentation, tooling and tests;
 * it is NOT rendered as alt text, because the backdrop is `aria-hidden`. Every screen
 * states its own meaning in text. Removing all the artwork must cost the user nothing
 * but atmosphere - if a region ever needs its picture to be understood, that is a bug
 * in the screen, not a missing description here.
 *
 * BACKGROUNDS ARE NOT PATHS. A backdrop says which part of the world you are in. The
 * `data-path` accent says which fitness path you chose. They are set in different
 * places, from different state, and neither may be derived from the other.
 *
 * WHERE THE FILES LIVE. Production artwork is served from `public/backgrounds/<id>/`
 * and referenced by URL, deliberately NOT imported. An `import` would put every
 * region's art into the module graph and hand the bundler a reason to preload art for
 * fifteen places the user is not standing in. A URL means the browser fetches exactly
 * the one backdrop on screen, caches it, and the JavaScript bundle never grows.
 */

export const BACKDROP_IDS = [
  'today',
  'week',
  'progress',
  'adventures',
  'zen',
  'flow',
  'trail',
  'forge',
  'pulse',
  'flex',
  'trophy-vault',
  'shop',
  'journey-wall',
  'crews',
  'profile',
  'settings',
  'data',
] as const;

export type BackdropId = (typeof BACKDROP_IDS)[number];

/**
 * The part of the artwork that must survive cropping.
 *
 * Expressed 0-1 so it maps straight onto `background-position` at any viewport. A
 * horizon at 0.42 stays a horizon on a 390px phone and on a 2560px monitor; a hard
 * `center` would swallow it on one of the two.
 */
export interface FocalPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * The minimum opacity of the contrast veil on a phone, per mode.
 *
 * THESE NUMBERS ARE COMPUTED, NOT CHOSEN BY EYE.
 *
 * On a phone the content fills the screen, so there is nowhere for artwork to be
 * that is not behind text - and the heading and standfirst sit directly on the veil
 * rather than on a card. The veil therefore has to hold WCAG AA against artwork we
 * have not drawn yet, which means against the worst case: solid black and solid
 * white.
 *
 * Solving that for the three text roles gives, as the alpha needed for 4.5:1:
 *
 *              secondary   tertiary
 *   light        0.814       0.969
 *   dark         0.849       0.933
 *
 * Tertiary is the binding constraint, hence the floors below. Anything gentler
 * looks better in a screenshot and fails a real user on a bright bus.
 *
 * The consequence is deliberate and worth stating plainly: ON MOBILE THE ARTWORK IS
 * ATMOSPHERE, NOT SCENERY. Immersion is a desktop affordance, where a 720px column
 * leaves room either side that no text ever occupies and the veil can lift to
 * roughly 40% - see backdrop.css.
 */
export interface VeilStrength {
  readonly light: number;
  readonly dark: number;
}

/**
 * The floors below which a region may not veil. Enforced by test.
 *
 * A region may veil HARDER than this - busier artwork should - but never softer,
 * whatever it does to the mood.
 */
export const MIN_VEIL: VeilStrength = { light: 0.97, dark: 0.95 };

export interface BackdropDefinition {
  readonly id: BackdropId;
  /** The region's name, in words. Documentation and tests - never alt text. */
  readonly label: string;
  /** One line on the intended atmosphere, for whoever produces the artwork. */
  readonly brief: string;
  readonly focal: FocalPoint;
  readonly veil: VeilStrength;
  /**
   * Served URLs, once real artwork exists. Absent means "not yet produced", and the
   * placeholder treatment applies. Absent is a normal, honest state: it is never
   * filled with an unrelated image to make a screen look finished.
   */
  readonly art?: {
    readonly mobile: string;
    readonly desktop: string;
  };
}

/** Where a region's artwork will be served from, once it exists. */
export function backdropAssetDir(id: BackdropId): string {
  return `/backgrounds/${id}`;
}

/**
 * Every region, including the ones with no screen yet.
 *
 * The future regions are listed on purpose. They cost nothing, they let the artwork
 * be commissioned as one coherent set rather than piecemeal, and they stop the next
 * person inventing a second naming scheme. Listing a region here does NOT build it -
 * there is no Shop, no Crews and no Trophy Vault in this milestone.
 */
export const BACKDROPS: Readonly<Record<BackdropId, BackdropDefinition>> = {
  today: {
    id: 'today',
    label: 'Today',
    brief: 'Sunrise over a path through gentle hills. Focus, plan, achieve.',
    focal: { x: 0.5, y: 0.38 },
    veil: { light: 0.97, dark: 0.95 },
    art: {
      mobile: '/backgrounds/today/today-mobile.webp',
      desktop: '/backgrounds/today/today-desktop.webp',
    },
  },
  week: {
    id: 'week',
    label: 'This week',
    brief: 'A signposted trail winding between hills. Your week, your journey.',
    focal: { x: 0.5, y: 0.45 },
    veil: { light: 0.97, dark: 0.95 },
    art: {
      mobile: '/backgrounds/week/week-mobile.webp',
      desktop: '/backgrounds/week/week-desktop.webp',
    },
  },
  progress: {
    id: 'progress',
    label: 'Progress',
    brief: 'A calm valley at dusk with a rising line of light. Reflect and grow.',
    focal: { x: 0.5, y: 0.42 },
    veil: { light: 0.97, dark: 0.95 },
    art: {
      mobile: '/backgrounds/progress/progress-mobile.webp',
      desktop: '/backgrounds/progress/progress-desktop.webp',
    },
  },
  adventures: {
    id: 'adventures',
    label: 'Adventures',
    brief: 'Floating islands and a distant tower. Explore, discover, earn.',
    focal: { x: 0.55, y: 0.4 },
    veil: { light: 0.98, dark: 0.96 },
    art: {
      mobile: '/backgrounds/adventures/adventures-mobile.webp',
      desktop: '/backgrounds/adventures/adventures-desktop.webp',
    },
  },
  zen: {
    id: 'zen',
    label: 'Zen Zone',
    brief: 'A quiet waterfall and torii gate in deep green. Breathe and restore.',
    focal: { x: 0.5, y: 0.5 },
    veil: { light: 0.97, dark: 0.95 },
    art: {
      mobile: '/backgrounds/zen/zen-mobile.webp',
      desktop: '/backgrounds/zen/zen-desktop.webp',
    },
  },
  flow: {
    id: 'flow',
    label: 'Flow',
    brief: 'Sunset over calm water, seen from a mat. Move, stretch, flow.',
    focal: { x: 0.5, y: 0.44 },
    veil: { light: 0.97, dark: 0.95 },
    art: {
      mobile: '/backgrounds/flow/flow-mobile.webp',
      desktop: '/backgrounds/flow/flow-desktop.webp',
    },
  },
  trail: {
    id: 'trail',
    label: 'Trail',
    brief: 'A woodland path beside a stream. Step, explore, go further.',
    focal: { x: 0.5, y: 0.48 },
    veil: { light: 0.97, dark: 0.95 },
    art: {
      mobile: '/backgrounds/trail/trail-mobile.webp',
      desktop: '/backgrounds/trail/trail-desktop.webp',
    },
  },
  forge: {
    id: 'forge',
    label: 'Forge',
    brief: 'A warm stone chamber with a lit hearth. Build, power, become stronger.',
    focal: { x: 0.5, y: 0.5 },
    veil: { light: 0.98, dark: 0.96 },
    art: {
      mobile: '/backgrounds/forge/forge-mobile.webp',
      desktop: '/backgrounds/forge/forge-desktop.webp',
    },
  },
  pulse: {
    id: 'pulse',
    label: 'Pulse',
    brief: 'A luminous track at night with a rhythm line. Raise, pump, energise.',
    focal: { x: 0.5, y: 0.52 },
    veil: { light: 0.98, dark: 0.96 },
    art: {
      mobile: '/backgrounds/pulse/pulse-mobile.webp',
      desktop: '/backgrounds/pulse/pulse-desktop.webp',
    },
  },
  flex: {
    id: 'flex',
    label: 'Flex Lab',
    brief: 'A bright, clean studio with a wide window. Move, stretch, improve.',
    focal: { x: 0.5, y: 0.46 },
    veil: { light: 0.97, dark: 0.95 },
    art: {
      mobile: '/backgrounds/flex/flex-mobile.webp',
      desktop: '/backgrounds/flex/flex-desktop.webp',
    },
  },
  'trophy-vault': {
    id: 'trophy-vault',
    label: 'Trophy Vault',
    brief: 'A pillared hall around a single lit plinth. Earned with effort.',
    focal: { x: 0.5, y: 0.46 },
    veil: { light: 0.98, dark: 0.96 },
    art: {
      mobile: '/backgrounds/trophy-vault/trophy-vault-mobile.webp',
      desktop: '/backgrounds/trophy-vault/trophy-vault-desktop.webp',
    },
  },
  shop: {
    id: 'shop',
    label: 'Shop',
    brief: 'A warm workshop of shelves and lanterns. Customise, unlock, shine.',
    focal: { x: 0.5, y: 0.48 },
    veil: { light: 0.98, dark: 0.96 },
    art: {
      mobile: '/backgrounds/shop/shop-mobile.webp',
      desktop: '/backgrounds/shop/shop-desktop.webp',
    },
  },
  'journey-wall': {
    id: 'journey-wall',
    label: 'Journey Wall',
    brief: 'Pictures strung above soft cloud. Your story, your legacy.',
    focal: { x: 0.5, y: 0.4 },
    veil: { light: 0.97, dark: 0.95 },
  },
  crews: {
    id: 'crews',
    label: 'Crews',
    brief: 'A shared island gathering place. Together, stronger, better.',
    focal: { x: 0.5, y: 0.44 },
    veil: { light: 0.98, dark: 0.96 },
  },
  profile: {
    id: 'profile',
    label: 'Profile',
    brief: 'A quiet room with a window and a mirror. You, your stats, your journey.',
    focal: { x: 0.5, y: 0.44 },
    veil: { light: 0.97, dark: 0.95 },
    art: {
      mobile: '/backgrounds/profile/profile-mobile.webp',
      desktop: '/backgrounds/profile/profile-desktop.webp',
    },
  },
  settings: {
    id: 'settings',
    label: 'Settings',
    brief: 'A still balcony under a clear night sky. Personalise and control.',
    focal: { x: 0.5, y: 0.42 },
    veil: { light: 0.97, dark: 0.95 },
  },
  data: {
    id: 'data',
    label: 'Your data',
    brief: 'A calm, orderly room of screens. Understand, manage, secure.',
    focal: { x: 0.5, y: 0.46 },
    veil: { light: 0.98, dark: 0.96 },
    art: {
      mobile: '/backgrounds/data/data-mobile.webp',
      desktop: '/backgrounds/data/data-desktop.webp',
    },
  },
};

export function backdrop(id: BackdropId): BackdropDefinition {
  return BACKDROPS[id];
}

/** True once real artwork has been produced for a region. */
export function hasArtwork(id: BackdropId): boolean {
  return BACKDROPS[id].art !== undefined;
}

/**
 * Which region each existing screen stands in.
 *
 * The single place a route becomes a backdrop. Typed against `TabId`, so adding a
 * sixth tab without deciding where in the world it sits will not compile.
 */
export const BACKDROP_FOR_TAB: Readonly<Record<TabId, BackdropId>> = {
  today: 'today',
  week: 'week',
  progress: 'progress',
  profile: 'profile',
  data: 'data',
};
